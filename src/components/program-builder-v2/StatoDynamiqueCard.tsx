import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Zap, Timer, RotateCcw, Dumbbell, User, Clock, Edit2, Target } from "lucide-react";
import {
  StatoDynamiqueConfig, STATIC_ANGLES, STATIC_PHASE_TIMING, SEQUENCE_TYPES,
  AMPLITUDE_TYPES, LOAD_TYPES, ATHLETE_LEVELS, formatStatoDynamiqueSummary,
} from "./lib/statoDynamiqueTypes";

interface StatoDynamiqueCardProps {
  config: StatoDynamiqueConfig;
  exerciseName?: string;
  onEdit?: () => void;
  onRemove?: () => void;
  compact?: boolean;
  className?: string;
}

export const StatoDynamiqueCard = ({ config, exerciseName, onEdit, onRemove, compact = false, className }: StatoDynamiqueCardProps) => {
  const formatLoad = () => {
    if (!config.loadValue) return null;
    return `${config.loadValue}${LOAD_TYPES[config.loadType].unit}`;
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 p-2 rounded-lg bg-violet-500/10 border border-violet-500/30", className)}>
        <div className="p-1.5 rounded-md bg-violet-500/20"><Zap className="h-4 w-4 text-violet-600" /></div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{exerciseName || 'Stato-Dynamique'}</div>
          <div className="text-[10px] text-muted-foreground">{formatStatoDynamiqueSummary(config)}</div>
        </div>
        {onEdit && <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-violet-500/20" onClick={onEdit}><Edit2 className="h-3 w-3" /></Button>}
        {onRemove && <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-destructive/20" onClick={onRemove}><X className="h-3 w-3" /></Button>}
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg bg-violet-500/5 border-2 border-violet-500/30 overflow-hidden", className)}>
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-violet-500/20 to-violet-600/20 border-b border-violet-500/20">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-violet-500/30"><Zap className="h-5 w-5 text-violet-700 dark:text-violet-400" /></div>
          <div>
            <div className="font-semibold text-violet-700 dark:text-violet-400 flex items-center gap-2">
              Stato-Dynamique
              <Badge variant="outline" className="text-xs border-violet-500/50">{SEQUENCE_TYPES[config.sequence].label}</Badge>
            </div>
            {exerciseName && (
              <div className="text-xs text-muted-foreground flex items-center gap-1"><Dumbbell className="h-3 w-3" />{exerciseName}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onEdit && <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-violet-500/20" onClick={onEdit}><Edit2 className="h-4 w-4" /></Button>}
          {onRemove && <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/20" onClick={onRemove}><X className="h-4 w-4" /></Button>}
        </div>
      </div>
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2"><Target className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{config.sets} séries</span></div>
          <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{config.restSeconds}s repos</span></div>
          {formatLoad() && (
            <div className="flex items-center gap-2"><Dumbbell className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{formatLoad()}</span></div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-1 mb-1">
              <Timer className="h-3 w-3 text-amber-600" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Phases Isométriques</span>
              {(config.staticPhases || []).length > 1 && (
                <Badge variant="outline" className="text-[10px] h-4 px-1 border-amber-500/50">×{config.staticPhases?.length}</Badge>
              )}
            </div>
            {(config.staticPhases || []).map((phase) => (
              <div key={phase.id} className="text-xs mb-1 last:mb-0">
                <span className="font-semibold">{phase.durationSeconds}s</span>
                <span className="text-muted-foreground">
                  {' '}@ {STATIC_ANGLES[phase.angle]?.label || phase.angle}° · {STATIC_PHASE_TIMING[phase.timing]?.label.replace('Phase ', '') || phase.timing}
                </span>
              </div>
            ))}
            {(!config.staticPhases || config.staticPhases.length === 0) && config.staticDurationSeconds && (
              <div className="text-sm font-semibold">{config.staticDurationSeconds} sec</div>
            )}
          </div>
          <div className="p-2 rounded-md bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-1 mb-1"><RotateCcw className="h-3 w-3 text-blue-600" /><span className="text-xs font-medium text-blue-700 dark:text-blue-400">Phase Dynamique</span></div>
            <div className="text-sm font-semibold">{config.dynamicReps} reps</div>
            <div className="text-xs text-muted-foreground">
              {AMPLITUDE_TYPES[config.dynamicAmplitude]}
              {config.dynamicTempo && ` · Tempo ${config.dynamicTempo}`}
            </div>
          </div>
        </div>
        {config.athleteLevel && (
          <div className="flex items-center gap-2 text-xs"><User className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground">Niveau: {ATHLETE_LEVELS[config.athleteLevel].label}</span></div>
        )}
        {config.coachNotes && (
          <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
            <div className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Consignes coach</div>
            <p className="text-xs text-muted-foreground">{config.coachNotes}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatoDynamiqueCard;
