/**
 * ReadOnlySeriesDisplay - Affichage statique des séries pour les méthodes validées
 * 
 * Utilisé par Rest-Pause, Drop Set, Pyramides pour afficher les séries
 * en mode lecture seule après validation, avec des badges statiques
 * sans aucun indice d'interactivité.
 */

import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

interface SeriesData {
  reps: string;
  percentage?: number;
  load?: number;
  tempo?: string;
  rpe?: number;
  rir?: number;
  pauseSeconds?: number;
  angle?: number;
  timeUnderTension?: number;
}

interface ReadOnlySeriesDisplayProps {
  series: SeriesData[];
  methodLabel: string;
  methodColor: string; // e.g. "amber", "red", "emerald"
  seriesLabel?: string; // e.g. "Bloc", "Drop", "Série"
  seriesLabelFn?: (idx: number) => string; // Custom label per index (overrides seriesLabel)
  showPause?: boolean;
  restSeconds?: number;
  visibleVariables?: string[];
  /** Nombre de séries complètes (ex: combien de fois répéter la séquence de drops) */
  setsCount?: number;
}

const COLOR_MAP: Record<string, { bg: string; text: string; badgeBg: string }> = {
  amber: { bg: "bg-amber-500/5", text: "text-amber-600", badgeBg: "bg-amber-500/10 border-amber-500/30" },
  red: { bg: "bg-red-500/5", text: "text-red-600", badgeBg: "bg-red-500/10 border-red-500/30" },
  emerald: { bg: "bg-emerald-500/5", text: "text-emerald-600", badgeBg: "bg-emerald-500/10 border-emerald-500/30" },
  teal: { bg: "bg-teal-500/5", text: "text-teal-600", badgeBg: "bg-teal-500/10 border-teal-500/30" },
  sky: { bg: "bg-sky-500/5", text: "text-sky-600", badgeBg: "bg-sky-500/10 border-sky-500/30" },
  stone: { bg: "bg-stone-500/5", text: "text-muted-foreground", badgeBg: "bg-stone-500/10 border-stone-500/30" },
  slate: { bg: "bg-slate-500/5", text: "text-muted-foreground", badgeBg: "bg-slate-500/10 border-slate-500/30" },
  rose: { bg: "bg-rose-500/5", text: "text-rose-600", badgeBg: "bg-rose-500/10 border-rose-500/30" },
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const ReadOnlySeriesDisplay: React.FC<ReadOnlySeriesDisplayProps> = ({
  series,
  methodLabel,
  methodColor,
  seriesLabel = "Série",
  seriesLabelFn,
  showPause = false,
  restSeconds,
  visibleVariables,
  setsCount,
}) => {
  const colors = COLOR_MAP[methodColor] || COLOR_MAP.amber;

  return (
    <div className={cn("space-y-2 p-2 rounded-md border", colors.bg, `border-${methodColor}-500/30`)}>
      <div className="flex items-center justify-between">
        <span className={cn("text-xs font-medium", colors.text)}>{methodLabel}</span>
        {setsCount !== undefined && setsCount > 0 && (
          <Badge variant="secondary" className="text-[10px] font-medium px-1.5 py-0.5">
            {setsCount} séries
          </Badge>
        )}
      </div>
      <div className="space-y-1.5">
        {series.map((s, idx) => (
          <div key={idx} className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className={cn("text-[10px] font-medium px-1.5 py-0.5", colors.badgeBg)}>
              {seriesLabelFn ? seriesLabelFn(idx) : `${seriesLabel} ${idx + 1}`}
            </Badge>

            {/* Reps */}
            <Badge variant="secondary" className="text-[10px] font-medium px-1.5 py-0.5">
              {s.reps === 'MAX' ? (
                <span className="text-red-600 font-bold">MAX</span>
              ) : (
                <>{s.reps} reps</>
              )}
            </Badge>

            {/* Pause (Rest-Pause) */}
            {showPause && s.pauseSeconds !== undefined && idx < series.length - 1 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                {s.pauseSeconds}s pause
              </Badge>
            )}

            {/* %1RM */}
            {s.percentage !== undefined && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                {s.percentage}%
              </Badge>
            )}

            {/* Load */}
            {s.load !== undefined && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                {s.load}kg
              </Badge>
            )}

            {/* Tempo */}
            {s.tempo !== undefined && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                {s.tempo}
              </Badge>
            )}

            {/* RPE - red when MAX */}
            {s.rpe !== undefined && (
              <Badge variant="secondary" className={cn(
                "text-[10px] px-1.5 py-0.5",
                s.reps === 'MAX' && "bg-red-100 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 font-bold"
              )}>
                RPE {s.rpe}
              </Badge>
            )}

            {/* RIR - red when MAX */}
            {s.rir !== undefined && (
              <Badge variant="secondary" className={cn(
                "text-[10px] px-1.5 py-0.5",
                s.reps === 'MAX' && "bg-red-100 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 font-bold"
              )}>
                RIR {s.rir}
              </Badge>
            )}

            {/* Angle */}
            {s.angle !== undefined && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                {s.angle}°
              </Badge>
            )}

            {/* Time Under Tension */}
            {s.timeUnderTension !== undefined && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                TST {s.timeUnderTension}s
              </Badge>
            )}
          </div>
        ))}
      </div>

      {/* Final rest */}
      {restSeconds !== undefined && restSeconds > 0 && (
        <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/50">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Repos final: {formatTime(restSeconds)}</span>
        </div>
      )}
    </div>
  );
};

export default ReadOnlySeriesDisplay;
