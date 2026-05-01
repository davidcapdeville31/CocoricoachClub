import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Layers, Timer, Target, Trash2, ChevronDown, ChevronUp, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ClusterConfig, formatClusterSummary, calculateClusterVolume } from "./lib/clusterTypes";

interface ClusterCardProps {
  config: ClusterConfig;
  exerciseName: string;
  exerciseCategory?: string;
  onRemove?: () => void;
  isReadOnly?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  className?: string;
}

export const ClusterCard = ({
  config, exerciseName, exerciseCategory = "Musculation",
  onRemove, isReadOnly = false, onExpandedChange, className,
}: ClusterCardProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const handleToggleExpand = () => {
    const newVal = !isExpanded;
    setIsExpanded(newVal);
    onExpandedChange?.(newVal);
  };

  const volume = calculateClusterVolume(config);

  const getLoadDisplay = () => {
    if (!config.loadValue) return null;
    switch (config.loadType) {
      case 'percentage': return `${config.loadValue}% 1RM`;
      case 'weight_kg': return `${config.loadValue}kg`;
      case 'rpe': return `RPE ${config.loadValue}`;
      default: return null;
    }
  };

  return (
    <Card className={cn("border-l-4 border-l-orange-500 bg-orange-500/5 dark:bg-orange-500/10 overflow-hidden", className)}>
      <div
        className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 cursor-pointer"
        onClick={handleToggleExpand}
      >
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-white" />
          <span className="font-bold text-sm text-white uppercase tracking-wide">Cluster Set</span>
        </div>
        <div className="flex items-center gap-2">
          {!isReadOnly && onRemove && (
            <Button
              variant="ghost" size="sm"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="h-7 px-2 text-white/80 hover:text-white hover:bg-white/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/80 hover:text-white hover:bg-white/20">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-medium text-sm">{exerciseName}</p>
              <p className="text-xs text-muted-foreground">{exerciseCategory}</p>
            </div>
            {getLoadDisplay() && (
              <Badge variant="secondary" className="text-xs">{getLoadDisplay()}</Badge>
            )}
          </div>

          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <Target className="h-3 w-3" />Structure du cluster:
            </p>
            <div className="flex items-center gap-1 flex-wrap">
              {config.clusterSteps.map((step, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Badge className={cn("text-xs", step.reps === 'max' ? "bg-orange-600 text-white" : "bg-orange-500 text-white")}>
                    {step.reps === 'max' ? 'MAX' : `${step.reps} rep${(step.reps as number) > 1 ? 's' : ''}`}
                  </Badge>
                  {i < config.clusterSteps.length - 1 && step.restAfterSeconds && (
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                      <Timer className="h-3 w-3" />{step.restAfterSeconds}s
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2 rounded-md bg-background border">
              <p className="text-lg font-bold text-orange-600">{config.sets}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Séries</p>
            </div>
            <div className="p-2 rounded-md bg-background border">
              <p className="text-lg font-bold text-orange-600">{volume.repsPerSet === 'variable' ? '~' : volume.repsPerSet}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Reps/série</p>
            </div>
            <div className="p-2 rounded-md bg-background border">
              <p className="text-lg font-bold text-orange-600">{volume.totalReps === 'variable' ? '~' : volume.totalReps}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Total reps</p>
            </div>
            <div className="p-2 rounded-md bg-background border">
              <p className="text-lg font-bold text-orange-600">{Math.round(config.interSetRestSeconds / 60)}min</p>
              <p className="text-[10px] text-muted-foreground uppercase">Repos</p>
            </div>
          </div>

          {config.targetRpe && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="text-xs">RPE cible: {config.targetRpe}/10</Badge>
            </div>
          )}

          {config.coachNotes && (
            <div className="p-2 rounded-md bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-blue-700 dark:text-blue-400">💡 {config.coachNotes}</p>
            </div>
          )}
        </CardContent>
      )}

      {!isExpanded && (
        <div className="px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Dumbbell className="h-3 w-3" />
          <span>{exerciseName}</span>
          <span className="mx-1">•</span>
          <span>{formatClusterSummary(config)}</span>
        </div>
      )}
    </Card>
  );
};
