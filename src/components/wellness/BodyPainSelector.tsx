import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import bodyAnatomyFront from "@/assets/body-anatomy-front.png";
import bodyAnatomyBack from "@/assets/body-anatomy-back.png";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePainConfig, DEFAULT_PAIN_CONFIG, type PainConfig } from "@/lib/wellness/questionConfig";

export type BodyRegion = {
  id: string;
  label: string;
  zone: string;
  side: "front" | "back";
  cx: number;
  cy: number;
};

const REGIONS: BodyRegion[] = [
  // ===== FRONT =====
  { id: "head_front", label: "Tête", zone: "Tête", side: "front", cx: 50, cy: 9 },
  { id: "neck_front", label: "Nuque / Cervicales", zone: "Haut du corps", side: "front", cx: 50, cy: 17 },
  { id: "shoulder_l", label: "Épaule droite", zone: "Haut du corps", side: "front", cx: 38, cy: 21 },
  { id: "shoulder_r", label: "Épaule gauche", zone: "Haut du corps", side: "front", cx: 62, cy: 21 },
  { id: "pec_l", label: "Pectoral droit", zone: "Haut du corps", side: "front", cx: 43, cy: 26 },
  { id: "pec_r", label: "Pectoral gauche", zone: "Haut du corps", side: "front", cx: 57, cy: 26 },
  { id: "biceps_l", label: "Bras droit (biceps)", zone: "Haut du corps", side: "front", cx: 37, cy: 31 },
  { id: "biceps_r", label: "Bras gauche (biceps)", zone: "Haut du corps", side: "front", cx: 63, cy: 31 },
  { id: "abs", label: "Abdominaux", zone: "Abdomen", side: "front", cx: 50, cy: 42 },
  { id: "oblique_l", label: "Oblique droit", zone: "Abdomen", side: "front", cx: 44, cy: 43 },
  { id: "oblique_r", label: "Oblique gauche", zone: "Abdomen", side: "front", cx: 56, cy: 43 },
  { id: "elbow_l_f", label: "Coude droit", zone: "Haut du corps", side: "front", cx: 34, cy: 36 },
  { id: "elbow_r_f", label: "Coude gauche", zone: "Haut du corps", side: "front", cx: 66, cy: 36 },
  { id: "forearm_l", label: "Avant-bras droit", zone: "Haut du corps", side: "front", cx: 32, cy: 43 },
  { id: "forearm_r", label: "Avant-bras gauche", zone: "Haut du corps", side: "front", cx: 68, cy: 43 },
  { id: "wrist_l_f", label: "Poignet droit", zone: "Haut du corps", side: "front", cx: 31, cy: 49 },
  { id: "wrist_r_f", label: "Poignet gauche", zone: "Haut du corps", side: "front", cx: 69, cy: 49 },
  { id: "hand_l_f", label: "Main droite", zone: "Haut du corps", side: "front", cx: 28, cy: 57 },
  { id: "hand_r_f", label: "Main gauche", zone: "Haut du corps", side: "front", cx: 72, cy: 57 },
  { id: "hip_l", label: "Hanche droite", zone: "Bas du corps", side: "front", cx: 43, cy: 46 },
  { id: "hip_r", label: "Hanche gauche", zone: "Bas du corps", side: "front", cx: 57, cy: 46 },
  { id: "adductor_l", label: "Adducteur droit", zone: "Bas du corps", side: "front", cx: 47, cy: 53 },
  { id: "adductor_r", label: "Adducteur gauche", zone: "Bas du corps", side: "front", cx: 53, cy: 53 },
  { id: "quad_l", label: "Cuisse droite (quadriceps)", zone: "Bas du corps", side: "front", cx: 42, cy: 60 },
  { id: "quad_r", label: "Cuisse gauche (quadriceps)", zone: "Bas du corps", side: "front", cx: 58, cy: 60 },
  { id: "knee_l", label: "Genou droit", zone: "Bas du corps", side: "front", cx: 43, cy: 70 },
  { id: "knee_r", label: "Genou gauche", zone: "Bas du corps", side: "front", cx: 57, cy: 70 },
  { id: "tibia_l", label: "Tibia droit", zone: "Bas du corps", side: "front", cx: 44, cy: 79 },
  { id: "tibia_r", label: "Tibia gauche", zone: "Bas du corps", side: "front", cx: 56, cy: 79 },
  { id: "ankle_l_f", label: "Cheville droite", zone: "Bas du corps", side: "front", cx: 45, cy: 87 },
  { id: "ankle_r_f", label: "Cheville gauche", zone: "Bas du corps", side: "front", cx: 55, cy: 87 },
  { id: "foot_l_f", label: "Pied droit", zone: "Bas du corps", side: "front", cx: 45, cy: 92 },
  { id: "foot_r_f", label: "Pied gauche", zone: "Bas du corps", side: "front", cx: 55, cy: 92 },

  // ===== BACK =====
  { id: "head_back", label: "Tête (arrière)", zone: "Tête", side: "back", cx: 50, cy: 9 },
  { id: "nuque_back", label: "Nuque", zone: "Haut du corps", side: "back", cx: 50, cy: 16 },
  { id: "trapez", label: "Trapèzes", zone: "Haut du corps", side: "back", cx: 50, cy: 21 },
  { id: "shoulder_lb", label: "Épaule gauche", zone: "Haut du corps", side: "back", cx: 36, cy: 22 },
  { id: "shoulder_rb", label: "Épaule droite", zone: "Haut du corps", side: "back", cx: 64, cy: 22 },
  { id: "dorsal_l", label: "Dorsal gauche", zone: "Haut du corps", side: "back", cx: 43, cy: 29 },
  { id: "dorsal_r", label: "Dorsal droit", zone: "Haut du corps", side: "back", cx: 57, cy: 29 },
  { id: "triceps_l", label: "Bras gauche (triceps)", zone: "Haut du corps", side: "back", cx: 36, cy: 31 },
  { id: "triceps_r", label: "Bras droit (triceps)", zone: "Haut du corps", side: "back", cx: 64, cy: 31 },
  { id: "elbow_l_b", label: "Coude gauche", zone: "Haut du corps", side: "back", cx: 35, cy: 40 },
  { id: "elbow_r_b", label: "Coude droit", zone: "Haut du corps", side: "back", cx: 65, cy: 40 },
  { id: "forearm_l_b", label: "Avant-bras gauche", zone: "Haut du corps", side: "back", cx: 34, cy: 46 },
  { id: "forearm_r_b", label: "Avant-bras droit", zone: "Haut du corps", side: "back", cx: 66, cy: 46 },
  { id: "hand_l_b", label: "Main gauche", zone: "Haut du corps", side: "back", cx: 32, cy: 57 },
  { id: "hand_r_b", label: "Main droite", zone: "Haut du corps", side: "back", cx: 68, cy: 57 },
  { id: "lumbar", label: "Dos (bas) / Lombaires", zone: "Bas du corps", side: "back", cx: 50, cy: 44 },
  { id: "glute_l", label: "Fessier gauche", zone: "Bas du corps", side: "back", cx: 44, cy: 51 },
  { id: "glute_r", label: "Fessier droit", zone: "Bas du corps", side: "back", cx: 56, cy: 51 },
  { id: "hamstring_l", label: "Ischio-jambier gauche", zone: "Bas du corps", side: "back", cx: 43, cy: 60 },
  { id: "hamstring_r", label: "Ischio-jambier droit", zone: "Bas du corps", side: "back", cx: 57, cy: 60 },
  { id: "knee_l_b", label: "Creux poplité gauche", zone: "Bas du corps", side: "back", cx: 43, cy: 70 },
  { id: "knee_r_b", label: "Creux poplité droit", zone: "Bas du corps", side: "back", cx: 57, cy: 70 },
  { id: "calf_l", label: "Mollet gauche", zone: "Bas du corps", side: "back", cx: 44, cy: 78 },
  { id: "calf_r", label: "Mollet droit", zone: "Bas du corps", side: "back", cx: 56, cy: 78 },
  { id: "achille_l", label: "Tendon d'Achille gauche", zone: "Bas du corps", side: "back", cx: 45, cy: 87 },
  { id: "achille_r", label: "Tendon d'Achille droit", zone: "Bas du corps", side: "back", cx: 55, cy: 87 },
  { id: "heel_l", label: "Talon gauche", zone: "Bas du corps", side: "back", cx: 45, cy: 92 },
  { id: "heel_r", label: "Talon droit", zone: "Bas du corps", side: "back", cx: 55, cy: 92 },
];

export interface BodyPainValue {
  region: string;
  zone: string;
  nature: string;
  intensity: number;
}

export interface BodyPainEntry extends BodyPainValue {
  region_id?: string;
}

interface Props {
  /** Multi-pain entries. */
  entries: BodyPainEntry[];
  onChange: (entries: BodyPainEntry[]) => void;
  categoryId: string;
  compact?: boolean;
  disabled?: boolean;
}

function BodySilhouette({ side }: { side: "front" | "back" }) {
  return (
    <img
      src={side === "front" ? bodyAnatomyFront : bodyAnatomyBack}
      alt={side === "front" ? "Vue de face du corps humain" : "Vue de dos du corps humain"}
      className="absolute inset-0 h-full w-full object-contain pointer-events-none select-none"
      draggable={false}
      loading="lazy"
    />
  );
}

function BodyDots({
  regions,
  entriesByRegionId,
  selectedRegionId,
  onSelect,
  config,
  disabled,
}: {
  regions: BodyRegion[];
  entriesByRegionId: Map<string, BodyPainEntry>;
  selectedRegionId?: string;
  onSelect: (r: BodyRegion) => void;
  config: PainConfig;
  disabled?: boolean;
}) {
  return (
    <div className="absolute inset-0">
      {regions.map((r) => {
        const entry = entriesByRegionId.get(r.id);
        const hasEntry = !!entry;
        const isSelected = selectedRegionId === r.id;
        const color = hasEntry
          ? (config.scale.find((s) => s.value === entry.intensity)?.color ?? "#dc2626")
          : "#dc2626";
        return (
          <button
            key={r.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(r)}
            title={r.label}
            aria-label={r.label}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all",
              !disabled && "hover:scale-[2] hover:z-10 ring-[0.5px] ring-white/80",
              hasEntry
                ? "h-3 w-3 sm:h-4 sm:w-4 ring-2 ring-foreground/70 shadow-md z-10"
                : isSelected
                  ? "h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 ring-2 ring-foreground shadow-md z-20"
                  : "h-[5px] w-[5px] sm:h-2 sm:w-2 hover:opacity-90",
              disabled && "cursor-not-allowed opacity-60",
            )}
            style={{ left: `${r.cx}%`, top: `${r.cy}%`, backgroundColor: color }}
          >
            {hasEntry && (
              <span className="absolute inset-0 flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white">
                {entry.intensity}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function BodyPainSelector({ entries, onChange, categoryId, compact, disabled }: Props) {
  const { data: painConfig } = usePainConfig(categoryId);
  const config: PainConfig = painConfig ?? DEFAULT_PAIN_CONFIG;

  const [selectedRegionId, setSelectedRegionId] = useState<string | undefined>();

  const entriesByRegionId = useMemo(() => {
    const m = new Map<string, BodyPainEntry>();
    for (const e of entries) {
      if (e.region_id) m.set(e.region_id, e);
    }
    return m;
  }, [entries]);

  const selectedEntry = selectedRegionId ? entriesByRegionId.get(selectedRegionId) : undefined;

  const handleRegionSelect = (r: BodyRegion) => {
    if (disabled) return;
    setSelectedRegionId(r.id);
    if (!entriesByRegionId.has(r.id)) {
      // Add new entry with defaults
      const defaultNature = config.natures[0]?.key ?? "musculaire";
      const newEntry: BodyPainEntry = {
        region_id: r.id,
        region: r.label,
        zone: r.zone,
        nature: defaultNature,
        intensity: 3,
      };
      onChange([...entries, newEntry]);
    }
  };

  const updateEntry = (regionId: string, patch: Partial<BodyPainEntry>) => {
    onChange(entries.map((e) => (e.region_id === regionId ? { ...e, ...patch } : e)));
  };

  const removeEntry = (regionId: string) => {
    onChange(entries.filter((e) => e.region_id !== regionId));
    if (selectedRegionId === regionId) setSelectedRegionId(undefined);
  };

  return (
    <div className={cn("space-y-3", compact && "space-y-2", disabled && "opacity-60 pointer-events-none select-none")}>
      {/* Body diagrams */}
      <div className="grid grid-cols-2 gap-2 bg-gradient-to-b from-surface-sunken/60 to-surface-sunken/20 rounded-2xl border p-2 shadow-inner overflow-hidden">
        <div className="relative aspect-square mx-auto w-full max-w-[320px] overflow-hidden">
          <div className="absolute top-1 left-1 z-10 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Face
          </div>
          <div className="absolute inset-0">
            <BodySilhouette side="front" />
            <BodyDots
              regions={REGIONS.filter((r) => r.side === "front")}
              entriesByRegionId={entriesByRegionId}
              selectedRegionId={selectedRegionId}
              onSelect={handleRegionSelect}
              config={config}
              disabled={disabled}
            />
          </div>
        </div>
        <div className="relative aspect-square mx-auto w-full max-w-[320px] overflow-hidden">
          <div className="absolute top-1 left-1 z-10 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Dos
          </div>
          <div className="absolute inset-0">
            <BodySilhouette side="back" />
            <BodyDots
              regions={REGIONS.filter((r) => r.side === "back")}
              entriesByRegionId={entriesByRegionId}
              selectedRegionId={selectedRegionId}
              onSelect={handleRegionSelect}
              config={config}
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground italic text-center">
        Cliquez sur chaque zone douloureuse. Vous pouvez en ajouter plusieurs.
      </p>

      {/* List of pain entries */}
      {entries.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs">Mes douleurs ({entries.length})</Label>
          <div className="space-y-2">
            {entries.map((e) => {
              const isOpen = selectedRegionId === e.region_id;
              const color = config.scale.find((s) => s.value === e.intensity)?.color ?? "#dc2626";
              return (
                <div
                  key={e.region_id ?? e.region}
                  className={cn(
                    "rounded-lg border bg-muted/20 overflow-hidden transition-all",
                    isOpen && "ring-2 ring-primary/40",
                  )}
                >
                  <div className="flex items-center gap-2 px-3 py-2">
                    <span
                      className="h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {e.intensity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedRegionId(isOpen ? undefined : e.region_id)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="text-sm font-semibold truncate">{e.region}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {e.zone} · {config.natures.find((n) => n.key === e.nature)?.label ?? e.nature}
                      </div>
                    </button>
                    <Badge variant="outline" className="text-[10px] shrink-0">{e.intensity}/5</Badge>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 text-destructive"
                      onClick={() => removeEntry(e.region_id!)}
                      aria-label="Supprimer cette douleur"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-2 border-t bg-background/40">
                      <div>
                        <Label className="text-[11px] mb-1 block">Nature</Label>
                        <Select
                          value={e.nature}
                          onValueChange={(v) => updateEntry(e.region_id!, { nature: v })}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                          <SelectContent>
                            {config.natures.map((n) => (
                              <SelectItem key={n.key} value={n.key}>
                                {n.emoji ? `${n.emoji} ${n.label}` : n.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[11px] mb-1 flex items-center justify-between">
                          <span>Intensité</span>
                          <span className="text-[10px] text-muted-foreground">
                            {config.scale.find((s) => s.value === e.intensity)?.label}
                          </span>
                        </Label>
                        <div className="grid grid-cols-5 gap-1">
                          {config.scale.map((lvl) => {
                            const sel = e.intensity === lvl.value;
                            return (
                              <button
                                key={lvl.value}
                                type="button"
                                onClick={() => updateEntry(e.region_id!, { intensity: lvl.value })}
                                title={lvl.label}
                                className={cn(
                                  "h-9 rounded-md text-sm font-bold border transition-all active:scale-95",
                                  sel
                                    ? "ring-2 ring-foreground/60 text-white shadow-md scale-105"
                                    : "text-foreground/80 hover:scale-105",
                                )}
                                style={{
                                  backgroundColor: sel ? lvl.color : `color-mix(in hsl, ${lvl.color} 25%, transparent)`,
                                  borderColor: lvl.color,
                                }}
                              >
                                {lvl.value}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
            <Plus className="h-3 w-3" /> Cliquez sur une autre zone du corps pour ajouter une douleur.
          </p>
        </div>
      )}
    </div>
  );
}
