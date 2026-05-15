import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { EventType } from "./types";
import {
  Trophy, Zap, Target, Crosshair, Shield, Anchor, Footprints, Flag,
  AlertTriangle, RefreshCw, Activity, MapPin, Move, Square, Hand,
  Repeat, ArrowRightLeft, Layers, Send, Wind,
} from "lucide-react";
import { useStatPreferences } from "@/hooks/use-stat-preferences";

interface Action {
  type: EventType;
  label: string;
  shortcut?: string;
  group: "score" | "conquete" | "attaque" | "defense" | "discipline" | "jeu" | "changement";
  icon: any;
  /**
   * Clés du référentiel `RUGBY_STATS` qui activent ce bouton.
   * Le bouton est masqué uniquement si AUCUNE des clés n'est activée
   * dans les préférences (et qu'au moins une préférence existe).
   * Si vide ⇒ toujours visible (action structurelle, ex. blessure).
   */
  refKeys: string[];
}

const ACTIONS: Action[] = [
  { type: "try", label: "Essai", shortcut: "E", group: "score", icon: Trophy, refKeys: ["tries"] },
  { type: "conversion", label: "Transfo", group: "score", icon: Target, refKeys: ["conversionsMade", "conversionsMissed"] },
  { type: "penalty_kick", label: "Pénalité", shortcut: "P", group: "score", icon: Crosshair, refKeys: ["penaltiesMade", "penaltiesMissed"] },
  { type: "drop", label: "Drop", shortcut: "D", group: "score", icon: Zap, refKeys: ["dropsMade", "dropsMissed"] },
  { type: "lineout", label: "Touche", shortcut: "T", group: "conquete", icon: Anchor, refKeys: ["lineoutsWon", "lineoutsLost"] },
  { type: "scrum", label: "Mêlée", shortcut: "M", group: "conquete", icon: Shield, refKeys: ["scrumsWon", "scrumsLost"] },
  { type: "maul", label: "Maul", group: "conquete", icon: Layers, refKeys: ["mauls"] },
  { type: "ruck", label: "Ruck", group: "conquete", icon: Repeat, refKeys: ["rucks"] },
  // Plaquage géré via panneau inline dédié (TackleInlinePanel)
  { type: "pass", label: "Passe", group: "attaque", icon: Send, refKeys: ["passesMade", "passesMissed"] },
  { type: "line_break", label: "Franchissement", group: "attaque", icon: Wind, refKeys: ["lineBreaks"] },
  { type: "knock_on", label: "En-avant", group: "defense", icon: Hand, refKeys: ["knockOns"] },
  { type: "turnover", label: "Ballon gratté", group: "defense", icon: ArrowRightLeft, refKeys: ["turnoversWon"] },
  { type: "foul", label: "Faute", group: "discipline", icon: AlertTriangle, refKeys: ["fouls"] },
  { type: "yellow_card", label: "Jaune", shortcut: "C", group: "discipline", icon: Square, refKeys: ["yellowCards"] },
  { type: "red_card", label: "Rouge", group: "discipline", icon: Square, refKeys: ["redCards"] },
  { type: "injury", label: "Blessure", group: "discipline", icon: Activity, refKeys: [] },
  { type: "kick", label: "Jeu au pied", group: "jeu", icon: Footprints, refKeys: ["kicksMade", "kicksMissed"] },
  { type: "substitution", label: "Changement", group: "changement", icon: RefreshCw, refKeys: [] },
];

const GROUP_STYLES: Record<Action["group"], string> = {
  score: "bg-green-600 hover:bg-green-700 text-white",
  conquete: "bg-purple-600 hover:bg-purple-700 text-white",
  attaque: "bg-amber-600 hover:bg-amber-700 text-white",
  defense: "bg-blue-600 hover:bg-blue-700 text-white",
  discipline: "bg-orange-600 hover:bg-orange-700 text-white",
  jeu: "bg-slate-600 hover:bg-slate-700 text-white",
  changement: "bg-indigo-600 hover:bg-indigo-700 text-white",
};

const GROUP_LABELS: Record<Action["group"], string> = {
  score: "Marqué",
  conquete: "Conquête",
  attaque: "Attaque",
  defense: "Défense",
  discipline: "Discipline",
  jeu: "Jeu",
  changement: "Changements",
};

const GROUP_PAIRS: Action["group"][][] = [
  ["score", "conquete"],
  ["attaque", "defense"],
  ["discipline", "jeu"],
  ["changement"],
];

interface LiveQuickActionsProps {
  onSelect: (t: EventType) => void;
  /** Filtrage selon préférences statistiques de la catégorie / match. */
  categoryId?: string;
  sportType?: string;
  matchId?: string;
}

export function LiveQuickActions({ onSelect, categoryId, sportType = "rugby_xv", matchId }: LiveQuickActionsProps) {
  const { enabledStatKeys, hasCustomPreferences } = useStatPreferences({
    categoryId: categoryId ?? "",
    sportType,
    matchId,
  });
  const enabledSet = useMemo(() => new Set(enabledStatKeys), [enabledStatKeys]);

  const visibleActions = useMemo(() => {
    if (!categoryId || !hasCustomPreferences) return ACTIONS;
    return ACTIONS.filter((a) => a.refKeys.length === 0 || a.refKeys.some((k) => enabledSet.has(k)));
  }, [categoryId, hasCustomPreferences, enabledSet]);

  const renderGroup = (g: Action["group"]) => {
    const items = visibleActions.filter((a) => a.group === g);
    if (items.length === 0) return null;
    return (
      <div key={g}>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{GROUP_LABELS[g]}</div>
        <div className="grid grid-cols-2 gap-1.5">
          {items.map((a) => {
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
    );
  };

  return (
    <Card className="p-3 space-y-3">
      {GROUP_PAIRS.map((pair, i) => {
        const rendered = pair.map(renderGroup).filter(Boolean);
        if (rendered.length === 0) return null;
        return (
          <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rendered}
          </div>
        );
      })}
    </Card>
  );
}
