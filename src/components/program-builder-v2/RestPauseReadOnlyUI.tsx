/**
 * RestPauseReadOnlyUI — Projection FIDÈLE de l'objet RestPauseConfig
 * 
 * RÈGLES :
 * - Aucun champ éditable
 * - Aucune valeur fantôme
 * - Aucune interprétation
 * - Si une donnée n'existe pas dans l'objet, elle n'est PAS affichée
 */

import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import type { RestPauseConfig, RestPauseSeries } from "./RestPauseTypes";
import { REST_PAUSE_VARIABLES } from "./RestPauseTypes";

const formatTime = (seconds: number): string => {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

interface RestPauseReadOnlyUIProps {
  config: RestPauseConfig;
}

export const RestPauseReadOnlyUI: React.FC<RestPauseReadOnlyUIProps> = ({
  config,
}) => {
  if (!config.series.length) {
    return (
      <div className="text-xs text-muted-foreground italic p-2">
        Aucune série configurée.
      </div>
    );
  }

  const renderSeriesVariables = (s: RestPauseSeries) => {
    const badges: React.ReactNode[] = [];
    for (const v of REST_PAUSE_VARIABLES) {
      const val = (s as any)[v.key];
      if (val !== undefined && val !== null) {
        // Rest-Pause is always MAX → RPE and RIR are physiologically locked (red)
        const isLockedByMax = v.key === 'rpe' || v.key === 'rir';
        badges.push(
          <Badge key={v.key} variant="secondary" className={cn(
            "text-[10px] px-1.5 py-0.5",
            isLockedByMax && "bg-red-100 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 font-bold"
          )}>
            {v.label}: {val}{v.unit ? ` ${v.unit}` : ''}
          </Badge>
        );
      }
    }
    return badges.length > 0 ? (
      <div className="flex items-center gap-1 flex-wrap">{badges}</div>
    ) : null;
  };

  return (
    <div className="space-y-2 p-2 rounded-md border bg-amber-500/5 border-amber-500/30">
      <span className="text-xs font-medium text-amber-600">Rest-Pause</span>

      {config.series.map((s, sIdx) => (
        <div key={sIdx} className="space-y-1 p-1.5 rounded border border-amber-500/20 bg-background">
          <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0.5 bg-amber-500/10 border-amber-500/30">
            Série {sIdx + 1}
          </Badge>

          {/* Series-level variables */}
          {renderSeriesVariables(s)}

          <div className="space-y-1">
            {s.miniSets.map((ms, mIdx) => {
              const isLastMiniSet = mIdx === s.miniSets.length - 1;
              return (
                <div key={mIdx} className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                    MS {mIdx + 1}
                  </Badge>
                  <Badge className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5">
                    MAX
                  </Badge>
                  {!isLastMiniSet && ms.pauseSeconds > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                      {formatTime(ms.pauseSeconds)} pause
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          {/* Recovery */}
          {s.recoverySeconds !== undefined && s.recoverySeconds > 0 && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                Récupération: {formatTime(s.recoverySeconds)}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default RestPauseReadOnlyUI;
