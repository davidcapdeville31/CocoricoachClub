import { useState } from "react";
import { cn } from "@/lib/utils";
import bodyAnatomyFront from "@/assets/body-anatomy-front.png";
import bodyAnatomyBack from "@/assets/body-anatomy-back.png";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  zone: string; // matches PAIN_ZONES.zone
  // Position in % of the SVG viewbox (front or back)
  side: "front" | "back";
  cx: number; // 0..100
  cy: number; // 0..100
};

// Coordinates calibrated against a 200x500 stylised silhouette displayed at 50% width each side.
const REGIONS: BodyRegion[] = [
  // ===== FRONT =====
  { id: "head_front", label: "Tête", zone: "Tête", side: "front", cx: 50, cy: 9 },
  { id: "neck_front", label: "Nuque / Cervicales", zone: "Haut du corps", side: "front", cx: 50, cy: 17 },
  // NOTE: front view = athlete faces the viewer. Athlete's RIGHT side appears on
  // screen LEFT, so labels are mirrored vs back view.
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
  region: string; // location label
  zone: string;
  nature: string;
  intensity: number;
}

interface Props {
  value: Partial<BodyPainValue>;
  onChange: (v: BodyPainValue) => void;
  categoryId: string;
  compact?: boolean;
}

// Realistic anatomical body silhouette using high-quality medical illustrations
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
  selectedId,
  onSelect,
  intensity,
  intensityColor,
}: {
  regions: BodyRegion[];
  selectedId?: string;
  onSelect: (r: BodyRegion) => void;
  intensity: number;
  intensityColor: string;
}) {
  return (
    <div className="absolute inset-0">
      {regions.map((r) => {
        const isSelected = selectedId === r.id;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelect(r)}
            title={r.label}
            aria-label={r.label}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all",
              "hover:scale-150 hover:z-10 ring-2 ring-white shadow-sm",
              isSelected
                ? "h-3.5 w-3.5 ring-foreground shadow-md z-20"
                : "h-2.5 w-2.5 hover:opacity-80",
            )}
            style={{
              left: `${r.cx}%`,
              top: `${r.cy}%`,
              // Fixed dark navy independent from club branding so dots stay visible
              // on every theme/skin (the primary token can be overridden by club branding).
              backgroundColor: isSelected ? intensityColor : "hsl(222, 47%, 18%)",
            }}
          >
            {isSelected && (
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                {intensity}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function BodyPainSelector({ value, onChange, categoryId, compact }: Props) {
  const { data: painConfig } = usePainConfig(categoryId);
  // Fallback to defaults while loading so the UI (intensity 1-5 + natures) is always interactive.
  const config: PainConfig = painConfig ?? DEFAULT_PAIN_CONFIG;

  const [selectedRegionId, setSelectedRegionId] = useState<string | undefined>();

  const intensity = value.intensity ?? 3;
  const nature = value.nature ?? config.natures[0]?.key ?? "musculaire";

  const intensityColor =
    config.scale.find((s) => s.value === intensity)?.color ?? "hsl(var(--destructive))";

  const handleRegionSelect = (r: BodyRegion) => {
    setSelectedRegionId(r.id);
    onChange({
      region: r.label,
      zone: r.zone,
      nature,
      intensity,
    });
  };

  const handleNatureChange = (n: string) => {
    onChange({
      region: value.region ?? "",
      zone: value.zone ?? "",
      nature: n,
      intensity,
    });
  };

  const handleIntensityChange = (i: number) => {
    onChange({
      region: value.region ?? "",
      zone: value.zone ?? "",
      nature,
      intensity: i,
    });
  };

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
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
              selectedId={selectedRegionId}
              onSelect={handleRegionSelect}
              intensity={intensity}
              intensityColor={intensityColor}
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
              selectedId={selectedRegionId}
              onSelect={handleRegionSelect}
              intensity={intensity}
              intensityColor={intensityColor}
            />
          </div>
        </div>
      </div>

      {/* Selected location summary */}
      {value.region ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Zone sélectionnée</span>
            <span className="text-sm font-semibold">{value.region}</span>
          </div>
          <Badge variant="outline" className="text-xs">{value.zone}</Badge>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic text-center">
          Cliquez sur la zone du corps où vous avez mal.
        </p>
      )}

      {/* Nature dropdown */}
      <div>
        <Label className="text-xs mb-1 block">Nature de la douleur</Label>
        <Select value={nature} onValueChange={handleNatureChange}>
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

      {/* Intensity scale 1-5 (uses customizable colors/labels) */}
      <div>
        <Label className="text-xs mb-1 flex items-center justify-between">
          <span>Intensité</span>
          <span className="text-[10px] text-muted-foreground">
            {config.scale.find((s) => s.value === intensity)?.label}
          </span>
        </Label>
        <div className="grid grid-cols-5 gap-1">
          {config.scale.map((lvl) => {
            const isSelected = intensity === lvl.value;
            return (
              <button
                key={lvl.value}
                type="button"
                onClick={() => handleIntensityChange(lvl.value)}
                title={lvl.label}
                className={cn(
                  "h-9 rounded-md text-sm font-bold border transition-all active:scale-95",
                  isSelected
                    ? "ring-2 ring-foreground/60 text-white shadow-md scale-105"
                    : "text-foreground/80 hover:scale-105",
                )}
                style={{
                  backgroundColor: isSelected ? lvl.color : `color-mix(in hsl, ${lvl.color} 25%, transparent)`,
                  borderColor: lvl.color,
                }}
              >
                {lvl.value}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground italic mt-1">
          1 = {config.scale[0]?.label} · 5 = {config.scale[4]?.label}
        </p>
      </div>
    </div>
  );
}
