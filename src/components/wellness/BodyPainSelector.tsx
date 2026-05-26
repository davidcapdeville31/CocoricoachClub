import { useState } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePainConfig, type PainConfig } from "@/lib/wellness/questionConfig";

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
  { id: "head_front", label: "Tête", zone: "Tête", side: "front", cx: 50, cy: 7 },
  { id: "neck_front", label: "Nuque / Cervicales", zone: "Haut du corps", side: "front", cx: 50, cy: 14 },
  { id: "shoulder_l", label: "Épaule gauche", zone: "Haut du corps", side: "front", cx: 32, cy: 19 },
  { id: "shoulder_r", label: "Épaule droite", zone: "Haut du corps", side: "front", cx: 68, cy: 19 },
  { id: "pec_l", label: "Pectoral gauche", zone: "Haut du corps", side: "front", cx: 41, cy: 24 },
  { id: "pec_r", label: "Pectoral droit", zone: "Haut du corps", side: "front", cx: 59, cy: 24 },
  { id: "biceps_l", label: "Bras gauche (biceps)", zone: "Haut du corps", side: "front", cx: 26, cy: 28 },
  { id: "biceps_r", label: "Bras droit (biceps)", zone: "Haut du corps", side: "front", cx: 74, cy: 28 },
  { id: "abs", label: "Abdominaux", zone: "Abdomen", side: "front", cx: 50, cy: 33 },
  { id: "elbow_l_f", label: "Coude gauche", zone: "Haut du corps", side: "front", cx: 23, cy: 36 },
  { id: "elbow_r_f", label: "Coude droit", zone: "Haut du corps", side: "front", cx: 77, cy: 36 },
  { id: "forearm_l", label: "Avant-bras gauche", zone: "Haut du corps", side: "front", cx: 20, cy: 42 },
  { id: "forearm_r", label: "Avant-bras droit", zone: "Haut du corps", side: "front", cx: 80, cy: 42 },
  { id: "wrist_l_f", label: "Poignet gauche", zone: "Haut du corps", side: "front", cx: 17, cy: 48 },
  { id: "wrist_r_f", label: "Poignet droit", zone: "Haut du corps", side: "front", cx: 83, cy: 48 },
  { id: "hip_l", label: "Hanche gauche", zone: "Bas du corps", side: "front", cx: 42, cy: 46 },
  { id: "hip_r", label: "Hanche droite", zone: "Bas du corps", side: "front", cx: 58, cy: 46 },
  { id: "adductor_l", label: "Adducteur gauche", zone: "Bas du corps", side: "front", cx: 46, cy: 52 },
  { id: "adductor_r", label: "Adducteur droit", zone: "Bas du corps", side: "front", cx: 54, cy: 52 },
  { id: "quad_l", label: "Cuisse gauche (quadriceps)", zone: "Bas du corps", side: "front", cx: 40, cy: 58 },
  { id: "quad_r", label: "Cuisse droite (quadriceps)", zone: "Bas du corps", side: "front", cx: 60, cy: 58 },
  { id: "knee_l", label: "Genou gauche", zone: "Bas du corps", side: "front", cx: 41, cy: 70 },
  { id: "knee_r", label: "Genou droit", zone: "Bas du corps", side: "front", cx: 59, cy: 70 },
  { id: "tibia_l", label: "Tibia gauche", zone: "Bas du corps", side: "front", cx: 41, cy: 80 },
  { id: "tibia_r", label: "Tibia droit", zone: "Bas du corps", side: "front", cx: 59, cy: 80 },
  { id: "ankle_l_f", label: "Cheville gauche", zone: "Bas du corps", side: "front", cx: 41, cy: 92 },
  { id: "ankle_r_f", label: "Cheville droite", zone: "Bas du corps", side: "front", cx: 59, cy: 92 },

  // ===== BACK =====
  { id: "head_back", label: "Tête (arrière)", zone: "Tête", side: "back", cx: 50, cy: 7 },
  { id: "trapez", label: "Trapèzes / Nuque", zone: "Haut du corps", side: "back", cx: 50, cy: 15 },
  { id: "upper_back", label: "Dos (haut)", zone: "Haut du corps", side: "back", cx: 50, cy: 24 },
  { id: "shoulder_lb", label: "Épaule gauche", zone: "Haut du corps", side: "back", cx: 32, cy: 19 },
  { id: "shoulder_rb", label: "Épaule droite", zone: "Haut du corps", side: "back", cx: 68, cy: 19 },
  { id: "triceps_l", label: "Bras gauche (triceps)", zone: "Haut du corps", side: "back", cx: 26, cy: 28 },
  { id: "triceps_r", label: "Bras droit (triceps)", zone: "Haut du corps", side: "back", cx: 74, cy: 28 },
  { id: "lumbar", label: "Dos (bas) / Lombaires", zone: "Bas du corps", side: "back", cx: 50, cy: 38 },
  { id: "elbow_l_b", label: "Coude gauche", zone: "Haut du corps", side: "back", cx: 23, cy: 36 },
  { id: "elbow_r_b", label: "Coude droit", zone: "Haut du corps", side: "back", cx: 77, cy: 36 },
  { id: "glute_l", label: "Fessier gauche", zone: "Bas du corps", side: "back", cx: 43, cy: 47 },
  { id: "glute_r", label: "Fessier droit", zone: "Bas du corps", side: "back", cx: 57, cy: 47 },
  { id: "hamstring_l", label: "Ischio-jambier gauche", zone: "Bas du corps", side: "back", cx: 41, cy: 58 },
  { id: "hamstring_r", label: "Ischio-jambier droit", zone: "Bas du corps", side: "back", cx: 59, cy: 58 },
  { id: "knee_l_b", label: "Genou gauche (creux poplité)", zone: "Bas du corps", side: "back", cx: 41, cy: 70 },
  { id: "knee_r_b", label: "Genou droit (creux poplité)", zone: "Bas du corps", side: "back", cx: 59, cy: 70 },
  { id: "calf_l", label: "Mollet gauche", zone: "Bas du corps", side: "back", cx: 41, cy: 80 },
  { id: "calf_r", label: "Mollet droit", zone: "Bas du corps", side: "back", cx: 59, cy: 80 },
  { id: "achille_l", label: "Tendon d'Achille gauche", zone: "Bas du corps", side: "back", cx: 41, cy: 90 },
  { id: "achille_r", label: "Tendon d'Achille droit", zone: "Bas du corps", side: "back", cx: 59, cy: 90 },
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

// Stylised body silhouette as an inline SVG (front view base shape)
function BodySilhouette({ side, color = "hsl(var(--muted-foreground) / 0.35)" }: { side: "front" | "back"; color?: string }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full pointer-events-none">
      {/* Head */}
      <ellipse cx="50" cy="7" rx="6" ry="6" fill={color} />
      {/* Neck */}
      <rect x="47" y="12" width="6" height="3" fill={color} />
      {/* Torso */}
      <path
        d={
          side === "front"
            ? "M30,18 L70,18 L74,42 L66,46 L58,48 L42,48 L34,46 L26,42 Z"
            : "M30,18 L70,18 L74,42 L66,46 L58,48 L42,48 L34,46 L26,42 Z"
        }
        fill={color}
      />
      {/* Arms */}
      <path d="M30,18 L22,22 L18,50 L22,52 L26,30 Z" fill={color} />
      <path d="M70,18 L78,22 L82,50 L78,52 L74,30 Z" fill={color} />
      {/* Pelvis */}
      <path d="M34,46 L66,46 L64,55 L36,55 Z" fill={color} />
      {/* Legs */}
      <path d="M36,55 L44,55 L43,95 L39,95 Z" fill={color} />
      <path d="M56,55 L64,55 L61,95 L57,95 Z" fill={color} />
      {/* Feet */}
      <ellipse cx="41" cy="97" rx="3.5" ry="2" fill={color} />
      <ellipse cx="59" cy="97" rx="3.5" ry="2" fill={color} />
    </svg>
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
              "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all",
              "hover:scale-125 hover:z-10",
              isSelected
                ? "h-5 w-5 ring-2 ring-foreground shadow-lg z-20"
                : "h-3 w-3 border-foreground/30 bg-background/60",
            )}
            style={{
              left: `${r.cx}%`,
              top: `${r.cy}%`,
              backgroundColor: isSelected ? intensityColor : undefined,
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
  const config: PainConfig = painConfig ?? {
    scale: [],
    natures: [],
  };

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
      <div className="grid grid-cols-2 gap-2 bg-surface-sunken/40 rounded-xl border p-2">
        <div className="relative aspect-[1/2] mx-auto w-full max-w-[180px]">
          <div className="absolute top-1 left-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Face
          </div>
          <BodySilhouette side="front" />
          <BodyDots
            regions={REGIONS.filter((r) => r.side === "front")}
            selectedId={selectedRegionId}
            onSelect={handleRegionSelect}
            intensity={intensity}
            intensityColor={intensityColor}
          />
        </div>
        <div className="relative aspect-[1/2] mx-auto w-full max-w-[180px]">
          <div className="absolute top-1 left-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Dos
          </div>
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
