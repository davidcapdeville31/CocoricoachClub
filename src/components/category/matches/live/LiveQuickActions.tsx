import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { EventType } from "./types";
import {
  Trophy, Zap, Target, Crosshair, Shield, Anchor, Footprints, Flag,
  AlertTriangle, RefreshCw, Activity, MapPin, Move, Square, Hand,
} from "lucide-react";

interface Action {
  type: EventType;
  label: string;
  shortcut?: string;
  group: "score" | "conquete" | "defense" | "discipline" | "jeu";
  icon: any;
}

const ACTIONS: Action[] = [
  { type: "try", label: "Essai", shortcut: "E", group: "score", icon: Trophy },
  { type: "conversion", label: "Transfo", group: "score", icon: Target },
  { type: "penalty_kick", label: "Pénalité", shortcut: "P", group: "score", icon: Crosshair },
  { type: "drop", label: "Drop", shortcut: "D", group: "score", icon: Zap },
  { type: "lineout", label: "Touche", shortcut: "T", group: "conquete", icon: Anchor },
  { type: "scrum", label: "Mêlée", shortcut: "M", group: "conquete", icon: Shield },
  { type: "ruck", label: "Ruck", group: "conquete", icon: RefreshCw },
  { type: "maul", label: "Ballon porté", group: "conquete", icon: Move },
  { type: "tackle", label: "Plaquage", group: "defense", icon: Footprints },
  { type: "turnover", label: "Turnover", group: "defense", icon: RefreshCw },
  { type: "knock_on", label: "En-avant", group: "defense", icon: Hand },
  { type: "foul", label: "Faute", group: "discipline", icon: AlertTriangle },
  { type: "yellow_card", label: "Jaune", shortcut: "C", group: "discipline", icon: Square },
  { type: "red_card", label: "Rouge", group: "discipline", icon: Square },
  { type: "substitution", label: "Remplacement", group: "discipline", icon: RefreshCw },
  { type: "injury", label: "Blessure", group: "discipline", icon: Activity },
  { type: "kickoff", label: "Coup d'envoi", group: "jeu", icon: Flag },
  { type: "restart", label: "Renvoi", group: "jeu", icon: Flag },
  { type: "kick", label: "Jeu au pied", group: "jeu", icon: Footprints },
  { type: "occupation", label: "Occupation", group: "jeu", icon: MapPin },
  { type: "exit_22", label: "Sortie 22", group: "jeu", icon: MapPin },
];

const GROUP_STYLES: Record<Action["group"], string> = {
  score: "bg-green-600 hover:bg-green-700 text-white",
  conquete: "bg-purple-600 hover:bg-purple-700 text-white",
  defense: "bg-blue-600 hover:bg-blue-700 text-white",
  discipline: "bg-orange-600 hover:bg-orange-700 text-white",
  jeu: "bg-slate-600 hover:bg-slate-700 text-white",
};

const GROUP_LABELS: Record<Action["group"], string> = {
  score: "Marqué",
  conquete: "Conquête",
  defense: "Défense",
  discipline: "Discipline",
  jeu: "Jeu",
};

export function LiveQuickActions({ onSelect }: { onSelect: (t: EventType) => void }) {
  const groups = (Object.keys(GROUP_LABELS) as Action["group"][]);
  return (
    <Card className="p-3 space-y-3">
      {groups.map((g) => (
        <div key={g}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{GROUP_LABELS[g]}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {ACTIONS.filter((a) => a.group === g).map((a) => {
              const Icon = a.icon;
              return (
                <Button
                  key={a.type}
                  onClick={() => onSelect(a.type)}
                  className={`${GROUP_STYLES[g]} h-14 flex-col gap-0.5 px-2 relative shadow-md`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-[11px] font-semibold leading-none">{a.label}</span>
                  {a.shortcut && <kbd className="absolute top-1 right-1 text-[9px] bg-black/20 rounded px-1">{a.shortcut}</kbd>}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </Card>
  );
}
