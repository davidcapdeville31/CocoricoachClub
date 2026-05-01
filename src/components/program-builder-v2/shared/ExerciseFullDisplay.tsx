/**
 * ExerciseFullDisplay — Renderer universel d'exercice
 * 
 * Source UNIQUE de rendu pour TOUTES les vues :
 * - Création de programme (read-only)
 * - Vue athlète exécution (prescription coach)
 * - Vue partage (WorkoutDetailSheet)
 * - Vue retour de séance (CoachSessionFeedback)
 * 
 * Gère :
 * - Badge méthode visible (Drop Set, Rest-Pause, Cluster…)
 * - Exercices normaux : badges plats (séries, reps, charge, tempo, RPE, etc.)
 * - Méthodes avancées : badges contexte (séries, repos) + MethodDetailRenderer
 * - Variables cardio et running
 */

import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Hash,
  RotateCcw,
  Weight,
  Timer,
  TrendingUp,
  Gauge,
  Target,
  Clock,
  MapPin,
  Zap,
  Flame,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTrainingStyleConfig } from "@/lib/program-builder-v2/trainingStyles";
import { MethodDetailRenderer } from "./MethodDetailRenderer";

// ── Helpers (exported for reuse) ──

export const getExerciseType = (exercise: any): 'strength' | 'cardio' | 'running' => {
  if (exercise.paceSecondsPerKm || exercise.runDistanceMeters || exercise.runDurationSeconds) {
    return 'running';
  }
  if (exercise.durationSeconds || exercise.watts || exercise.calories || (exercise.distanceMeters && !exercise.sets)) {
    return 'cardio';
  }
  return 'strength';
};

export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h${remainingMins.toString().padStart(2, '0')}`;
  }
  return secs > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${mins}'`;
};

export const formatPace = (secondsPerKm: number): string => {
  const mins = Math.floor(secondsPerKm / 60);
  const secs = Math.round(secondsPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}/km`;
};

export const formatDistance = (meters: number): string => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km`;
  }
  return `${meters}m`;
};

export const getInputLabelsForType = (type: 'strength' | 'cardio' | 'running') => {
  switch (type) {
    case 'cardio':
      return {
        primary: { key: 'duration', label: 'Durée (min)', placeholder: 'Minutes' },
        secondary: { key: 'distance', label: 'Distance (m)', placeholder: 'Mètres' },
        tertiary: { key: 'calories', label: 'Calories', placeholder: 'Cal' },
      };
    case 'running':
      return {
        primary: { key: 'distance', label: 'Distance (m)', placeholder: 'Mètres' },
        secondary: { key: 'duration', label: 'Durée (min)', placeholder: 'Minutes' },
        tertiary: { key: 'pace', label: 'Allure (/km)', placeholder: '5:30' },
      };
    default:
      return {
        primary: { key: 'sets', label: 'Séries', placeholder: '-' },
        secondary: { key: 'reps', label: 'Reps', placeholder: '-' },
        tertiary: { key: 'weight', label: 'Charge (kg)', placeholder: '-' },
      };
  }
};

// ── Variable Badge ──

const VarBadge = ({
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  highlight?: boolean;
}) => (
  <div className={cn(
    "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
    highlight
      ? "bg-primary/10 text-primary border border-primary/20"
      : "bg-secondary/80 text-secondary-foreground"
  )}>
    <Icon className="h-2.5 w-2.5 opacity-70" />
    <span className="text-muted-foreground">{label}:</span>
    <span className="font-semibold">{value}</span>
  </div>
);

// ── Method Type Badge ──

const MethodTypeBadge = ({ trainingStyle }: { trainingStyle: string }) => {
  if (!trainingStyle || trainingStyle === "normal") return null;
  const styleConfig = getTrainingStyleConfig(trainingStyle);
  
  return (
    <div className="mb-1.5">
      <Badge className={cn(
        "text-xs px-2 py-0.5 font-semibold text-white border-0",
        styleConfig.color || "bg-primary"
      )}>
        <Zap className="h-3 w-3 mr-1" />
        {styleConfig.label}
      </Badge>
    </div>
  );
};

// ── Flat Variables Display (normal exercises only) ──

const FlatVariables = ({ exercise }: { exercise: any }) => {
  const type = getExerciseType(exercise);

  return (
    <div className="flex flex-wrap gap-1">
      {type === 'strength' && (
        <>
          {exercise.sets && <VarBadge icon={Hash} label="Séries" value={exercise.sets} highlight />}
          {exercise.reps && <VarBadge icon={RotateCcw} label="Reps" value={exercise.reps} highlight />}
          {exercise.percentage && <VarBadge icon={Weight} label="Charge" value={exercise.percentage} />}
          {exercise.weight_kg && <VarBadge icon={Weight} label="Poids" value={`${exercise.weight_kg}kg`} />}
          {(exercise.restSeconds || exercise.rest) && (
            <VarBadge
              icon={Timer}
              label="Repos"
              value={exercise.restSeconds ? formatDuration(exercise.restSeconds) : exercise.rest!}
            />
          )}
          {exercise.tempo && <VarBadge icon={TrendingUp} label="Tempo" value={exercise.tempo} />}
          {exercise.rpe && <VarBadge icon={Gauge} label="RPE" value={exercise.rpe} />}
          {exercise.rir !== undefined && exercise.rir !== null && (
            <VarBadge icon={Target} label="RIR" value={exercise.rir} />
          )}
        </>
      )}

      {type === 'cardio' && (
        <>
          {exercise.durationSeconds && <VarBadge icon={Clock} label="Durée" value={formatDuration(exercise.durationSeconds)} highlight />}
          {exercise.distanceMeters && (
            <VarBadge icon={MapPin} label="Distance" value={formatDistance(exercise.distanceMeters)} highlight />
          )}
          {exercise.watts && <VarBadge icon={Zap} label="Puissance" value={`${exercise.watts}W`} />}
          {exercise.calories && <VarBadge icon={Flame} label="Calories" value={`${exercise.calories} cal`} />}
          {exercise.rpe && <VarBadge icon={Gauge} label="RPE" value={exercise.rpe} />}
        </>
      )}

      {type === 'running' && (
        <>
          {exercise.paceSecondsPerKm && <VarBadge icon={Activity} label="Allure" value={formatPace(exercise.paceSecondsPerKm)} highlight />}
          {exercise.runDistanceMeters && (
            <VarBadge icon={MapPin} label="Distance" value={formatDistance(exercise.runDistanceMeters)} highlight />
          )}
          {exercise.runDurationSeconds && <VarBadge icon={Clock} label="Durée" value={formatDuration(exercise.runDurationSeconds)} highlight />}
          {exercise.rpe && <VarBadge icon={Gauge} label="RPE" value={exercise.rpe} />}
        </>
      )}
    </div>
  );
};

// ── Advanced Method Context Badges (sets count + rest only) ──

const AdvancedMethodContext = ({ exercise }: { exercise: any }) => (
  <div className="flex flex-wrap gap-1 mb-1.5">
    {exercise.sets && (
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 font-medium">
        {exercise.sets} séries
      </Badge>
    )}
    {(exercise.restSeconds || exercise.rest) && (
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 font-medium">
        <Timer className="h-2.5 w-2.5 mr-0.5" />
        Repos: {exercise.restSeconds
          ? `${Math.floor(exercise.restSeconds / 60)}:${(exercise.restSeconds % 60).toString().padStart(2, '0')}`
          : exercise.rest}
      </Badge>
    )}
  </div>
);

// ── Main Export ──

interface ExerciseFullDisplayProps {
  exercise: any;
  /** Show the auto-generated athlete note */
  showAthleteNote?: boolean;
  /** Compact mode */
  compact?: boolean;
}

/**
 * Renderer universel : affiche les variables d'un exercice
 * de manière structurée (méthodes avancées) ou plate (normal).
 * 
 * Inclut automatiquement :
 * - Le badge de méthode (Drop Set, Rest-Pause, etc.)
 * - La structure détaillée (phases, séries, configs)
 * - Les notes pédagogiques et coach
 */
export const ExerciseFullDisplay: React.FC<ExerciseFullDisplayProps> = ({
  exercise,
  showAthleteNote = true,
  compact = true,
}) => {
  const isAdvanced = exercise.trainingStyle && exercise.trainingStyle !== "normal";

  return (
    <div>
      {/* Normal exercises: flat variable badges */}
      {!isAdvanced && <FlatVariables exercise={exercise} />}

      {/* MethodDetailRenderer handles ALL method-specific structures (no duplicate badge/context) */}
      <MethodDetailRenderer
        exercise={exercise}
        showAthleteNote={showAthleteNote}
        compact={compact}
      />
    </div>
  );
};

export default ExerciseFullDisplay;
