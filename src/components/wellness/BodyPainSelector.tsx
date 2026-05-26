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

// Anatomical body silhouette (stylised muscular reference, viewBox 100x100)
function BodySilhouette({ side }: { side: "front" | "back" }) {
  const gradId = `bodyGrad-${side}`;
  const shadeId = `bodyShade-${side}`;
  const skin = "hsl(28 38% 72%)";
  const skinDark = "hsl(22 35% 58%)";
  const muscleLine = "hsl(22 40% 38% / 0.45)";

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 h-full w-full pointer-events-none"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={skin} />
          <stop offset="100%" stopColor={skinDark} />
        </linearGradient>
        <radialGradient id={shadeId} cx="0.5" cy="0.4" r="0.7">
          <stop offset="60%" stopColor="transparent" />
          <stop offset="100%" stopColor="hsl(22 40% 25% / 0.35)" />
        </radialGradient>
      </defs>

      {/* ===== Head ===== */}
      <ellipse cx="50" cy="6.5" rx="5" ry="6" fill={`url(#${gradId})`} stroke={skinDark} strokeWidth="0.3" />
      {/* Neck */}
      <path d="M46.5,11 Q50,13.5 53.5,11 L54,15 Q50,16.5 46,15 Z" fill={`url(#${gradId})`} stroke={skinDark} strokeWidth="0.3" />

      {/* ===== Torso ===== */}
      {/* Shoulders + ribcage + waist outline */}
      <path
        d="M34,16 Q40,15 50,15 Q60,15 66,16 L72,21 Q74,28 73,36 L70,42 Q68,46 64,48 L36,48 Q32,46 30,42 L27,36 Q26,28 28,21 Z"
        fill={`url(#${gradId})`}
        stroke={skinDark}
        strokeWidth="0.4"
      />

      {/* Deltoids */}
      <ellipse cx="30" cy="20" rx="4.5" ry="3.5" fill={skinDark} opacity="0.35" />
      <ellipse cx="70" cy="20" rx="4.5" ry="3.5" fill={skinDark} opacity="0.35" />

      {side === "front" ? (
        <>
          {/* Pectorals */}
          <path d="M40,21 Q44,20 49,21 L49,29 Q44,30 39,28 Z" fill="none" stroke={muscleLine} strokeWidth="0.4" />
          <path d="M60,21 Q56,20 51,21 L51,29 Q56,30 61,28 Z" fill="none" stroke={muscleLine} strokeWidth="0.4" />
          {/* Sternum line */}
          <line x1="50" y1="21" x2="50" y2="32" stroke={muscleLine} strokeWidth="0.4" />
          {/* Abs grid */}
          <path d="M44,32 L56,32 M44,36 L56,36 M44,40 L56,40 M50,32 L50,44" stroke={muscleLine} strokeWidth="0.4" fill="none" />
          {/* Obliques */}
          <path d="M40,32 Q38,38 42,44" stroke={muscleLine} strokeWidth="0.4" fill="none" />
          <path d="M60,32 Q62,38 58,44" stroke={muscleLine} strokeWidth="0.4" fill="none" />
        </>
      ) : (
        <>
          {/* Spine */}
          <line x1="50" y1="17" x2="50" y2="46" stroke={muscleLine} strokeWidth="0.5" />
          {/* Trapezius */}
          <path d="M40,16 Q50,22 60,16" stroke={muscleLine} strokeWidth="0.5" fill="none" />
          {/* Lat lines */}
          <path d="M32,24 Q36,34 42,40" stroke={muscleLine} strokeWidth="0.4" fill="none" />
          <path d="M68,24 Q64,34 58,40" stroke={muscleLine} strokeWidth="0.4" fill="none" />
          {/* Lower back dimples */}
          <circle cx="46" cy="44" r="0.6" fill={muscleLine} />
          <circle cx="54" cy="44" r="0.6" fill={muscleLine} />
        </>
      )}

      {/* ===== Arms ===== */}
      {/* Upper arm L */}
      <path d="M27,21 Q22,24 21,32 L24,38 Q27,35 28,28 Z" fill={`url(#${gradId})`} stroke={skinDark} strokeWidth="0.3" />
      {/* Upper arm R */}
      <path d="M73,21 Q78,24 79,32 L76,38 Q73,35 72,28 Z" fill={`url(#${gradId})`} stroke={skinDark} strokeWidth="0.3" />
      {/* Forearm L */}
      <path d="M21,32 Q19,40 19,48 L23,49 Q24,40 24,38 Z" fill={`url(#${gradId})`} stroke={skinDark} strokeWidth="0.3" />
      {/* Forearm R */}
      <path d="M79,32 Q81,40 81,48 L77,49 Q76,40 76,38 Z" fill={`url(#${gradId})`} stroke={skinDark} strokeWidth="0.3" />
      {/* Hands */}
      <ellipse cx="21" cy="52" rx="2.4" ry="3" fill={`url(#${gradId})`} stroke={skinDark} strokeWidth="0.3" />
      <ellipse cx="79" cy="52" rx="2.4" ry="3" fill={`url(#${gradId})`} stroke={skinDark} strokeWidth="0.3" />
      {/* Biceps/triceps subtle line */}
      <path d="M24,24 Q25,30 26,34" stroke={muscleLine} strokeWidth="0.3" fill="none" />
      <path d="M76,24 Q75,30 74,34" stroke={muscleLine} strokeWidth="0.3" fill="none" />

      {/* ===== Pelvis ===== */}
      <path d="M34,46 Q50,52 66,46 L64,54 Q50,57 36,54 Z" fill={`url(#${gradId})`} stroke={skinDark} strokeWidth="0.3" />
      {side === "front" && (
        <path d="M44,50 Q50,54 56,50" stroke={muscleLine} strokeWidth="0.4" fill="none" />
      )}

      {/* ===== Legs ===== */}
      {/* Thigh L */}
      <path d="M36,53 Q34,62 36,72 L43,73 Q44,62 44,54 Z" fill={`url(#${gradId})`} stroke={skinDark} strokeWidth="0.3" />
      {/* Thigh R */}
      <path d="M64,53 Q66,62 64,72 L57,73 Q56,62 56,54 Z" fill={`url(#${gradId})`} stroke={skinDark} strokeWidth="0.3" />
      {side === "front" ? (
        <>
          {/* Quad lines */}
          <path d="M40,57 Q40,65 42,72" stroke={muscleLine} strokeWidth="0.4" fill="none" />
          <path d="M60,57 Q60,65 58,72" stroke={muscleLine} strokeWidth="0.4" fill="none" />
        </>
      ) : (
        <>
          {/* Hamstring */}
          <path d="M40,57 Q39,65 41,72" stroke={muscleLine} strokeWidth="0.4" fill="none" />
          <path d="M60,57 Q61,65 59,72" stroke={muscleLine} strokeWidth="0.4" fill="none" />
        </>
      )}
      {/* Knees */}
      <ellipse cx="40" cy="73" rx="3" ry="2" fill={skinDark} opacity="0.4" />
      <ellipse cx="60" cy="73" rx="3" ry="2" fill={skinDark} opacity="0.4" />
      {/* Calves */}
      <path d="M37,74 Q35,84 38,92 L43,92 Q44,84 42,74 Z" fill={`url(#${gradId})`} stroke={skinDark} strokeWidth="0.3" />
      <path d="M63,74 Q65,84 62,92 L57,92 Q56,84 58,74 Z" fill={`url(#${gradId})`} stroke={skinDark} strokeWidth="0.3" />
      {side === "back" && (
        <>
          <path d="M40,78 Q40,84 41,90" stroke={muscleLine} strokeWidth="0.4" fill="none" />
          <path d="M60,78 Q60,84 59,90" stroke={muscleLine} strokeWidth="0.4" fill="none" />
        </>
      )}
      {/* Ankles + feet */}
      <ellipse cx="40" cy="93" rx="2" ry="1.3" fill={skinDark} opacity="0.5" />
      <ellipse cx="60" cy="93" rx="2" ry="1.3" fill={skinDark} opacity="0.5" />
      <ellipse cx="40.5" cy="96.5" rx="3.5" ry="2.2" fill={`url(#${gradId})`} stroke={skinDark} strokeWidth="0.3" />
      <ellipse cx="59.5" cy="96.5" rx="3.5" ry="2.2" fill={`url(#${gradId})`} stroke={skinDark} strokeWidth="0.3" />

      {/* Global shading overlay */}
      <rect x="0" y="0" width="100" height="100" fill={`url(#${shadeId})`} />
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
                : "h-3 w-3 border-white/80 bg-white/70 shadow-sm hover:bg-white",
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
      <div className="grid grid-cols-2 gap-3 bg-gradient-to-b from-surface-sunken/60 to-surface-sunken/20 rounded-2xl border p-3 shadow-inner">
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
