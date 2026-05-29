// Builders étape 2 : un par type de bloc. Champs structurés.
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TECHNICAL_EXERCISE_TYPES,
  SEQUENCE_MODES,
  THROW_PRESETS,
  PRIORITY_OPTIONS,
} from "@/lib/constants/bowlingTechnicalParameters";
import { TACTICAL_EXERCISE_TYPES, PATTERN_DIFFICULTY, GAME_OBJECTIVES } from "@/lib/constants/bowlingTacticalZones";
import { BowlingParametersPicker } from "../selectors/BowlingParametersPicker";
import { BowlingZoneSelector } from "../selectors/BowlingZoneSelector";
import { BowlingTargetOutcomesPicker } from "../selectors/BowlingTargetOutcomesPicker";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BowlingBlockDraft } from "./types";

interface Props {
  value: BowlingBlockDraft;
  onChange: (next: BowlingBlockDraft) => void;
  categoryId: string;
}

// ---- Bloc commun (titre, durée, lancers, priorité, consigne, note) ----
function CommonFields({ value, onChange }: Props) {
  const update = (patch: Partial<BowlingBlockDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2 space-y-1">
        <Label className="text-xs">Titre du bloc (optionnel — un titre auto sera généré)</Label>
        <Input value={value.title} onChange={(e) => update({ title: e.target.value })} placeholder="ex. Travail axe 0°" className="h-9 text-sm" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Durée (min)</Label>
        <Input type="number" min={1} value={value.duration_min} onChange={(e) => update({ duration_min: parseInt(e.target.value || "0", 10) })} className="h-9 text-sm" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Nombre de lancers</Label>
        <div className="flex flex-wrap gap-1 mb-1">
          {THROW_PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => update({ planned_throws: p })}
              className={`px-2 py-0.5 rounded-md text-[11px] border ${value.planned_throws === p ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background hover:bg-muted"}`}>{p}</button>
          ))}
        </div>
        <Input type="number" min={1} value={value.planned_throws} onChange={(e) => update({ planned_throws: parseInt(e.target.value || "0", 10) })} className="h-9 text-sm" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Priorité</Label>
        <Select value={value.priority} onValueChange={(v) => update({ priority: v as any })}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent className="z-[100]">
            {PRIORITY_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="sm:col-span-2 space-y-1">
        <Label className="text-xs">Consigne coach (visible athlète)</Label>
        <Textarea rows={2} value={value.coach_instruction} onChange={(e) => update({ coach_instruction: e.target.value })} className="text-sm" />
      </div>
      <div className="sm:col-span-2 space-y-1">
        <Label className="text-xs">Note interne (coach uniquement)</Label>
        <Textarea rows={2} value={value.internal_note} onChange={(e) => update({ internal_note: e.target.value })} className="text-sm" />
      </div>
    </div>
  );
}

export function BowlingTechnicalBuilder(props: Props) {
  const { value, onChange } = props;
  const cfg = value.config;
  return (
    <div className="space-y-4">
      <CommonFields {...props} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Type d'exercice technique</Label>
          <Select value={cfg.exercise_type || ""} onValueChange={(v) => onChange({ ...value, config: { ...cfg, exercise_type: v } })}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choisir..." /></SelectTrigger>
            <SelectContent className="z-[100]">
              {TECHNICAL_EXERCISE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Mode d'enchaînement</Label>
          <Select value={cfg.sequence || ""} onValueChange={(v) => onChange({ ...value, config: { ...cfg, sequence: v } })}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choisir..." /></SelectTrigger>
            <SelectContent className="z-[100]">
              {SEQUENCE_MODES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs">Paramètres techniques (multi-sélection)</Label>
        <BowlingParametersPicker value={cfg.parameters || []} onChange={(p) => onChange({ ...value, config: { ...cfg, parameters: p } })} />
      </div>
      <div>
        <Label className="text-xs">Objectifs de résultat</Label>
        <BowlingTargetOutcomesPicker value={value.objectives} onChange={(o) => onChange({ ...value, objectives: o })} />
      </div>
    </div>
  );
}

export function BowlingTacticalBuilder(props: Props) {
  const { value, onChange, categoryId } = props;
  const cfg = value.config;

  const { data: patterns } = useQuery({
    queryKey: ["bowling_oil_patterns_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bowling_oil_patterns").select("id, name, length_feet").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="space-y-4">
      <CommonFields {...props} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Type d'exercice tactique</Label>
          <Select value={cfg.tactical_type || ""} onValueChange={(v) => onChange({ ...value, config: { ...cfg, tactical_type: v } })}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choisir..." /></SelectTrigger>
            <SelectContent className="z-[100]">
              {TACTICAL_EXERCISE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Pattern (huilage)</Label>
          <Select value={value.pattern_id || "__none__"} onValueChange={(v) => onChange({ ...value, pattern_id: v === "__none__" ? null : v })}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="z-[100]">
              <SelectItem value="__none__" className="italic">Libre / non défini</SelectItem>
              {(patterns || []).map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.name}{p.length_feet ? ` · ${p.length_feet}ft` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Difficulté pattern</Label>
          <Select value={cfg.pattern_difficulty || ""} onValueChange={(v) => onChange({ ...value, config: { ...cfg, pattern_difficulty: v } })}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent className="z-[100]">
              {PATTERN_DIFFICULTY.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Commentaire pattern</Label>
          <Input value={cfg.pattern_comment || ""} onChange={(e) => onChange({ ...value, config: { ...cfg, pattern_comment: e.target.value } })} className="h-9 text-sm" placeholder="ex. fin, neuf, abrasif…" />
        </div>
      </div>

      <BowlingZoneSelector
        selected={cfg.zones || []}
        onChange={(z) => onChange({ ...value, config: { ...cfg, zones: z } })}
        throwsPerZone={cfg.throws_per_zone}
        onThrowsPerZoneChange={(n) => onChange({ ...value, config: { ...cfg, throws_per_zone: n } })}
      />

      <div>
        <Label className="text-xs">Objectifs de résultat</Label>
        <BowlingTargetOutcomesPicker value={value.objectives} onChange={(o) => onChange({ ...value, objectives: o })} />
      </div>
    </div>
  );
}

export function BowlingGamesBuilder(props: Props) {
  const { value, onChange } = props;
  const cfg = value.config;
  const { data: patterns } = useQuery({
    queryKey: ["bowling_oil_patterns_all"],
    queryFn: async () => {
      const { data } = await supabase.from("bowling_oil_patterns").select("id, name, length_feet").order("name");
      return data || [];
    },
  });
  return (
    <div className="space-y-4">
      <CommonFields {...props} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Nombre de parties</Label>
          <Input type="number" min={1} value={cfg.games_count ?? ""} onChange={(e) => onChange({ ...value, config: { ...cfg, games_count: parseInt(e.target.value || "0", 10) } })} className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Pattern</Label>
          <Select value={value.pattern_id || "__none__"} onValueChange={(v) => onChange({ ...value, pattern_id: v === "__none__" ? null : v })}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="z-[100]">
              <SelectItem value="__none__" className="italic">Libre</SelectItem>
              {(patterns || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2 space-y-1">
          <Label className="text-xs">Objectif principal</Label>
          <Select value={cfg.objective || ""} onValueChange={(v) => onChange({ ...value, config: { ...cfg, objective: v } })}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choisir..." /></SelectTrigger>
            <SelectContent className="z-[100]">
              {GAME_OBJECTIVES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export function BowlingWarmupBuilder(props: Props) {
  return (
    <div className="space-y-4">
      <CommonFields {...props} />
      <p className="text-xs text-muted-foreground italic">
        L'échauffement reste libre : indiquez simplement la durée, le nombre de lancers et une éventuelle consigne.
      </p>
    </div>
  );
}
