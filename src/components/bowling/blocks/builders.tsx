// Builders étape 2 — version "premium" alignée sur le mode simplifié.
// Un builder par type de bloc (technical / tactical / games / warmup).
// Header avec icône colorée + titre inline, inputs en surface-sunken,
// boutons pill, contenu rounded-2xl.
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Wrench, Target, Circle, Flame, Clock, Hash } from "lucide-react";
import {
  THROW_PRESETS,
} from "@/lib/constants/bowlingTechnicalParameters";
import {
  GAME_OBJECTIVES,
} from "@/lib/constants/bowlingTacticalZones";
import { BowlingParametersPicker } from "../selectors/BowlingParametersPicker";
import { BowlingZoneSelector } from "../selectors/BowlingZoneSelector";
import { BowlingTargetOutcomesPicker } from "../selectors/BowlingTargetOutcomesPicker";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BowlingBlockDraft, BowlingBlockType } from "./types";

interface Props {
  value: BowlingBlockDraft;
  onChange: (next: BowlingBlockDraft) => void;
  categoryId: string;
}

// Objectifs de résultat autorisés en mode avancé
const ADVANCED_TARGET_OUTCOMES = ["pin_1", "pocket", "pocket_strike"];

// ---- Atomes UI partagés ----------------------------------------------------

type BlockTheme = {
  icon: typeof Wrench;
  label: string;
  accent: string; // bg-{color}-500/10
  text: string; // text-{color}-600
  border: string; // border-l-{color}-500
};

const THEMES: Record<BowlingBlockType, BlockTheme> = {
  technical: { icon: Wrench, label: "Technique", accent: "bg-emerald-500/10", text: "text-emerald-600", border: "border-l-emerald-500" },
  tactical:  { icon: Target, label: "Tactique",  accent: "bg-blue-500/10",    text: "text-blue-600",    border: "border-l-blue-500" },
  games:     { icon: Circle, label: "Parties",   accent: "bg-amber-500/10",   text: "text-amber-600",   border: "border-l-amber-500" },
  warmup:    { icon: Flame,  label: "Échauffement", accent: "bg-violet-500/10", text: "text-violet-600", border: "border-l-violet-500" },
};

function BlockShell({
  value,
  onChange,
  children,
}: Props & { children: React.ReactNode }) {
  const theme = THEMES[value.block_type];
  const Icon = theme.icon;
  return (
    <Card className={`space-y-4 rounded-2xl border-l-4 ${theme.border} bg-surface p-4 shadow-sm`}>
      {/* Header */}
      <div className="flex items-start gap-2">
        <div className={`rounded-lg ${theme.accent} p-2`}>
          <Icon className={`h-4 w-4 ${theme.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Bloc {theme.label}
          </p>
          <Input
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            placeholder="Titre du bloc (optionnel — auto-généré)"
            className="mt-1 h-8 text-sm bg-surface-sunken"
          />
        </div>
      </div>

      {children}
    </Card>
  );
}

function DurationThrows({ value, onChange, lockThrows = false }: Props & { lockThrows?: boolean }) {
  const update = (patch: Partial<BowlingBlockDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label className="text-xs flex items-center gap-1">
          <Clock className="h-3 w-3" /> Durée (min)
        </Label>
        <Input
          type="number"
          min={1}
          value={value.duration_min}
          onChange={(e) => update({ duration_min: parseInt(e.target.value || "0", 10) })}
          className="h-9 text-sm bg-surface-sunken"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs flex items-center gap-1">
          <Hash className="h-3 w-3" /> Nombre de lancers
          {lockThrows && (
            <span className="text-[10px] font-normal text-muted-foreground italic ml-1">
              (calculé auto depuis les zones)
            </span>
          )}
        </Label>
        {!lockThrows && (
          <div className="flex flex-wrap gap-1 mb-1">
            {THROW_PRESETS.map((p) => {
              const active = value.planned_throws === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => update({ planned_throws: p })}
                  className={`px-2.5 py-0.5 rounded-md text-[11px] border transition-all ${
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        )}
        <Input
          type="number"
          min={1}
          value={value.planned_throws}
          onChange={(e) => update({ planned_throws: parseInt(e.target.value || "0", 10) })}
          readOnly={lockThrows}
          disabled={lockThrows}
          className={`h-9 text-sm bg-surface-sunken ${lockThrows ? "opacity-70 cursor-not-allowed" : ""}`}
        />
      </div>
    </div>
  );
}

function SectionLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {children}
      </Label>
      {hint && <span className="text-[10px] text-muted-foreground italic">{hint}</span>}
    </div>
  );
}

// ---- Builders --------------------------------------------------------------

export function BowlingTechnicalBuilder(props: Props) {
  const { value, onChange } = props;
  const cfg = value.config;
  const paramCount = (cfg.parameters || []).length;

  // Pré-sélectionne les critères de réussite par défaut (quille 1, poche, strike+poche)
  // pour que le coach puisse les valider lancer par lancer sans étape supplémentaire.
  useEffect(() => {
    if (!value.objectives || value.objectives.length === 0) {
      onChange({ ...value, objectives: [...ADVANCED_TARGET_OUTCOMES] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return (
    <BlockShell {...props}>
      <DurationThrows {...props} />

      <div className="rounded-xl border border-border/60 bg-surface-sunken p-3 space-y-2">
        <SectionLabel hint="Sélectionne un ou plusieurs paramètres techniques">
          Paramètres techniques
        </SectionLabel>
        <BowlingParametersPicker
          value={cfg.parameters || []}
          onChange={(p) => onChange({ ...value, config: { ...cfg, parameters: p } })}
        />
        {paramCount > 0 && (
          <Badge variant="outline" className="text-[10px]">
            {paramCount} paramètre{paramCount > 1 ? "s" : ""} sélectionné{paramCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <SectionLabel>Objectifs de résultat</SectionLabel>
        <BowlingTargetOutcomesPicker
          value={value.objectives}
          onChange={(o) => onChange({ ...value, objectives: o })}
          allowed={ADVANCED_TARGET_OUTCOMES}
        />
      </div>
    </BlockShell>
  );
}

export function BowlingTacticalBuilder(props: Props) {
  const { value, onChange } = props;
  const cfg = value.config;

  const zonesCount = (cfg.zones || []).length;
  const throwsByZone = cfg.throws_by_zone || {};
  const totalFromZones = (cfg.zones || []).reduce(
    (s, z) => s + (throwsByZone[z] || 0),
    0,
  );

  // Sync auto du nombre total de lancers (en haut) avec la somme par zone
  useEffect(() => {
    if (totalFromZones > 0 && totalFromZones !== value.planned_throws) {
      onChange({ ...value, planned_throws: totalFromZones });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalFromZones]);

  return (
    <BlockShell {...props}>
      <DurationThrows {...props} lockThrows />


      {/* Zones + lancers/zone */}
      <div className="space-y-2">
        <SectionLabel hint={zonesCount > 0 ? `${zonesCount} zone${zonesCount > 1 ? "s" : ""} sélectionnée${zonesCount > 1 ? "s" : ""}` : undefined}>
          Zones de jeu & volume
        </SectionLabel>
        <BowlingZoneSelector
          selected={cfg.zones || []}
          onChange={(z) => {
            // Nettoie les zones désélectionnées de la map
            const cleaned: Record<string, number> = {};
            z.forEach((zone) => {
              if (throwsByZone[zone]) cleaned[zone] = throwsByZone[zone];
            });
            onChange({ ...value, config: { ...cfg, zones: z, throws_by_zone: cleaned } });
          }}
          throwsByZone={throwsByZone}
          onThrowsByZoneChange={(m) =>
            onChange({ ...value, config: { ...cfg, throws_by_zone: m } })
          }
        />
      </div>

      {/* Objectifs */}
      <div className="space-y-2">
        <SectionLabel>Objectifs de résultat</SectionLabel>
        <BowlingTargetOutcomesPicker
          value={value.objectives}
          onChange={(o) => onChange({ ...value, objectives: o })}
          allowed={ADVANCED_TARGET_OUTCOMES}
        />
      </div>
    </BlockShell>
  );
}


export function BowlingGamesBuilder(props: Props) {
  const { value, onChange } = props;
  const cfg = value.config;
  const { data: patterns } = useQuery({
    queryKey: ["bowling_oil_patterns_all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bowling_oil_patterns")
        .select("id, name, length_feet")
        .order("name");
      return data || [];
    },
  });
  return (
    <BlockShell {...props}>
      <DurationThrows {...props} />

      <div className="rounded-xl border border-border/60 bg-surface-sunken p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Nombre de parties</Label>
          <Input
            type="number"
            min={1}
            value={cfg.games_count ?? ""}
            onChange={(e) =>
              onChange({ ...value, config: { ...cfg, games_count: parseInt(e.target.value || "0", 10) } })
            }
            className="h-9 text-sm bg-surface"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Pattern</Label>
          <Select
            value={value.pattern_id || "__none__"}
            onValueChange={(v) => onChange({ ...value, pattern_id: v === "__none__" ? null : v })}
          >
            <SelectTrigger className="h-9 text-sm bg-surface"><SelectValue /></SelectTrigger>
            <SelectContent className="z-[100]">
              <SelectItem value="__none__" className="italic">Libre</SelectItem>
              {(patterns || []).map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2 space-y-1">
          <Label className="text-xs">Objectif principal</Label>
          <Select
            value={cfg.objective || ""}
            onValueChange={(v) => onChange({ ...value, config: { ...cfg, objective: v } })}
          >
            <SelectTrigger className="h-9 text-sm bg-surface"><SelectValue placeholder="Choisir..." /></SelectTrigger>
            <SelectContent className="z-[100]">
              {GAME_OBJECTIVES.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </BlockShell>
  );
}

export function BowlingWarmupBuilder(props: Props) {
  return (
    <BlockShell {...props}>
      <DurationThrows {...props} />
      <p className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-3 text-xs italic text-muted-foreground">
        L'échauffement reste libre : indiquez la durée, le nombre de lancers et
        ajoutez une consigne dans les notes si besoin.
      </p>
    </BlockShell>
  );
}
