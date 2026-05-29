import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Flame, Target, Map, Trophy } from "lucide-react";
import type { BowlingBlockType } from "./types";

interface Props {
  value: BowlingBlockType | null;
  onChange: (t: BowlingBlockType) => void;
}

const OPTIONS: { value: BowlingBlockType; label: string; description: string; icon: any; color: string }[] = [
  { value: "warmup", label: "Échauffement", description: "Préparation, mise en route, exercices libres", icon: Flame, color: "from-orange-500/15 to-orange-500/5 border-orange-500/30" },
  { value: "technical", label: "Travail Technique", description: "Axe, vitesse, rotation, profondeur, routine", icon: Target, color: "from-cyan-500/15 to-cyan-500/5 border-cyan-500/30" },
  { value: "tactical", label: "Travail Tactique", description: "Zones, flèches, lattes, pattern, déplacements", icon: Map, color: "from-violet-500/15 to-violet-500/5 border-violet-500/30" },
  { value: "games", label: "Parties d'entraînement", description: "Parties complètes avec feuille de score", icon: Trophy, color: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30" },
];

export function BowlingBlockTypePicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {OPTIONS.map((o) => {
        const Icon = o.icon;
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "text-left rounded-2xl p-4 border bg-gradient-to-br transition-all hover:shadow-md",
              o.color,
              selected ? "ring-2 ring-primary shadow-lg" : "",
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-5 w-5" />
              <span className="font-semibold">{o.label}</span>
            </div>
            <p className="text-xs text-muted-foreground">{o.description}</p>
          </button>
        );
      })}
    </div>
  );
}
