import { getCardioBadges } from "@/lib/program-builder-v2/cardioBadges";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExerciseCardIcon } from "./ExerciseCardIcon";
import { ExerciseVisual } from "./ExerciseVisual";
import type { CircuitRecoveryConfig } from "./MethodConfigSlots";

export const CROSSFIT_METHODS = ['amrap', 'for_time', 'circuit', 'emom', 'tabata', 'death_by'] as const;
export type CrossFitMethodType = typeof CROSSFIT_METHODS[number];

export const isCrossFitMethod = (trainingStyle: string): trainingStyle is CrossFitMethodType => {
  return CROSSFIT_METHODS.includes(trainingStyle as CrossFitMethodType);
};

export interface MethodExercise {
  exerciseId: string;
  exerciseName: string;
  reps?: string | number;
  percentage?: number;
  load?: number;
  tempo?: string;
  rpe?: number;
  notes?: string;
}

interface CrossFitMethodCardProps {
  trainingStyle: string;
  exerciseName: string;
  exerciseId: string;
  timeCap?: number;
  totalMinutes?: number;
  repsPerRound?: number;
  emomConfig?: { intervalMinutes: number; totalMinutes: number };
  tabataConfig?: { workSeconds: number; restSeconds: number; rounds: number };
  deathByConfig?: { startReps: number; incrementReps: number };
  circuitRecovery?: CircuitRecoveryConfig;
  methodExercises?: MethodExercise[];
  dropSetSeries?: Array<{ reps?: string | number; percentage?: number; load?: number }>;
  onRemove: () => void;
  onEdit?: () => void;
  onExpandedChange?: (expanded: boolean) => void;
  libraryExercises: Array<{ id: string; station_name?: string; image_url?: string | null }>;
}

const CROSSFIT_METHOD_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: string; gradientColors: string }> = {
  amrap: { label: "AMRAP", color: "text-rose-600", bgColor: "bg-rose-500/10", borderColor: "border-l-rose-500", icon: "⏱️", gradientColors: "from-rose-500 to-rose-600" },
  for_time: { label: "For Time", color: "text-orange-600", bgColor: "bg-orange-500/10", borderColor: "border-l-orange-500", icon: "⚡", gradientColors: "from-orange-500 to-orange-600" },
  emom: { label: "EMOM", color: "text-indigo-600", bgColor: "bg-indigo-500/10", borderColor: "border-l-indigo-500", icon: "🔄", gradientColors: "from-indigo-500 to-indigo-600" },
  tabata: { label: "Tabata", color: "text-yellow-600", bgColor: "bg-yellow-500/10", borderColor: "border-l-yellow-500", icon: "💪", gradientColors: "from-yellow-500 to-yellow-600" },
  circuit: { label: "Circuit", color: "text-lime-600", bgColor: "bg-lime-500/10", borderColor: "border-l-lime-500", icon: "🔁", gradientColors: "from-lime-500 to-lime-600" },
  death_by: { label: "Death By", color: "text-red-600", bgColor: "bg-red-600/10", borderColor: "border-l-red-600", icon: "💀", gradientColors: "from-red-600 to-red-700" },
};

const getExerciseCategory = (exerciseId: string, lib: Array<{ id: string; station_name?: string }>): string =>
  lib.find(ex => ex.id === exerciseId)?.station_name || "Musculation";

const getExerciseImageUrl = (exerciseId: string, lib: Array<{ id: string; image_url?: string | null }>): string | null | undefined =>
  lib.find(ex => ex.id === exerciseId)?.image_url;

const formatTime = (m?: number) => {
  if (!m) return null;
  if (m >= 60) { const h = Math.floor(m / 60); const r = m % 60; return `${h}h${r > 0 ? r + "'" : ""}`; }
  return `${m}'`;
};
const formatRestSeconds = (s: number) => {
  const m = Math.floor(s / 60); const r = s % 60;
  if (m === 0) return `${r}s`;
  if (r === 0) return `${m}min`;
  return `${m}:${r.toString().padStart(2, '0')}`;
};

export const CrossFitMethodCard = ({
  trainingStyle, exerciseName, exerciseId, timeCap, totalMinutes, repsPerRound,
  emomConfig, tabataConfig, deathByConfig, circuitRecovery,
  methodExercises = [], dropSetSeries, onRemove, onEdit, onExpandedChange, libraryExercises,
}: CrossFitMethodCardProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const config = CROSSFIT_METHOD_CONFIG[trainingStyle] || CROSSFIT_METHOD_CONFIG.circuit;

  const handleToggleExpand = () => { const v = !isExpanded; setIsExpanded(v); onExpandedChange?.(v); };

  const getMethodInfo = () => {
    const info: { label: string; value: string }[] = [];
    switch (trainingStyle) {
      case 'amrap': if (timeCap) info.push({ label: "Durée", value: formatTime(timeCap) || `${timeCap}min` }); break;
      case 'for_time':
        if (timeCap) info.push({ label: "Time Cap", value: formatTime(timeCap) || `${timeCap}min` });
        if (repsPerRound) info.push({ label: "Rounds", value: String(repsPerRound) });
        break;
      case 'emom':
        if (emomConfig) {
          info.push({ label: "Intervalle", value: emomConfig.intervalMinutes === 1 ? "EMOM" : `E${emomConfig.intervalMinutes}MOM` });
          info.push({ label: "Durée totale", value: `${emomConfig.totalMinutes || totalMinutes}'` });
        } else if (totalMinutes) info.push({ label: "Durée totale", value: `${totalMinutes}'` });
        break;
      case 'tabata':
        if (tabataConfig) {
          info.push({ label: "Travail", value: `${tabataConfig.workSeconds}s` });
          info.push({ label: "Repos", value: `${tabataConfig.restSeconds}s` });
          info.push({ label: "Rounds", value: String(tabataConfig.rounds) });
        }
        break;
      case 'circuit': if (repsPerRound) info.push({ label: "Tours", value: String(repsPerRound) }); break;
      case 'death_by':
        if (deathByConfig) {
          info.push({ label: "Départ", value: `${deathByConfig.startReps} rep${deathByConfig.startReps > 1 ? 's' : ''}` });
          info.push({ label: "Incrément", value: `+${deathByConfig.incrementReps}/min` });
        }
        break;
    }
    return info;
  };

  const methodInfo = getMethodInfo();
  const displayExercises: MethodExercise[] = methodExercises.length > 0
    ? methodExercises
    : [{ exerciseId, exerciseName, reps: dropSetSeries?.[0]?.reps }];

  return (
    <div className={cn("rounded-xl overflow-hidden border-l-[5px] shadow-sm", config.borderColor, config.bgColor)}>
      <div className={cn("flex items-center justify-between px-4 py-2.5 bg-gradient-to-r", config.gradientColors)}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg">{config.icon}</span>
          <span className="font-bold text-sm text-white tracking-wide uppercase">{config.label}</span>
          {methodInfo.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {methodInfo.map((item, idx) => (
                <Badge key={idx} className="bg-white/20 text-white text-xs px-2 py-0.5">{item.label}: {item.value}</Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 w-7 p-0 text-white/80 hover:text-white hover:bg-white/20">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleToggleExpand} className="h-7 w-7 p-0 text-white/80 hover:text-white hover:bg-white/20">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={onRemove} className="h-7 w-7 p-0 text-white/80 hover:text-white hover:bg-white/20">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {isExpanded && (
        <div className="divide-y divide-border/50">
          {displayExercises.map((ex, idx) => (
            <div key={`${ex.exerciseId}-${idx}`}>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <Badge variant="outline" className={cn("text-xs font-bold", config.color)}>{idx + 1}</Badge>
                <ExerciseVisual imageUrl={getExerciseImageUrl(ex.exerciseId, libraryExercises)} category={getExerciseCategory(ex.exerciseId, libraryExercises)} exerciseName={ex.exerciseName} size="sm" />
                <span className="font-medium text-sm flex-1">{ex.exerciseName}</span>
                {ex.reps && String(ex.reps).trim() !== '' && (
                  <Badge variant="secondary" className="text-xs">{String(ex.reps) === 'max' ? 'max reps' : `${ex.reps} reps`}</Badge>
                )}
                {ex.percentage && <Badge variant="secondary" className="text-xs">{ex.percentage}%</Badge>}
                {ex.load && <Badge variant="secondary" className="text-xs">{ex.load}kg</Badge>}
                {ex.rpe && <Badge variant="secondary" className="text-xs">RPE {ex.rpe}</Badge>}
              </div>
              {ex.notes && String(ex.notes).trim() !== '' && (
                <div className="px-4 pb-2 ml-8">
                  <p className="text-xs italic text-muted-foreground whitespace-pre-line">💬 {ex.notes}</p>
                </div>
              )}
              {circuitRecovery?.strategy === 'between_exercises' && circuitRecovery.perExerciseRestSeconds?.[idx] != null && (
                <div className="px-4 pb-2 ml-8">
                  <span className="text-xs text-muted-foreground italic">↳ Repos : {formatRestSeconds(circuitRecovery.perExerciseRestSeconds[idx])}</span>
                </div>
              )}
            </div>
          ))}
          {displayExercises.length === 0 && (
            <div className="px-4 py-3 text-sm text-muted-foreground italic">Aucun exercice configuré</div>
          )}
          {trainingStyle === 'circuit' && circuitRecovery && (
            <div className="px-4 py-2.5">
              {circuitRecovery.strategy === 'after_circuit' ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">🔄 Repos après le circuit</Badge>
                  {circuitRecovery.globalRestSeconds != null && (
                    <span className="text-xs text-muted-foreground font-medium">{formatRestSeconds(circuitRecovery.globalRestSeconds)}</span>
                  )}
                </div>
              ) : (
                <Badge variant="outline" className="text-xs">⏱️ Repos entre les exercices</Badge>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CrossFitMethodCard;
