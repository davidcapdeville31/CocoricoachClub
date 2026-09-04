import { useState, useEffect, useMemo } from "react";
import { inferExerciseTypeFromName } from "@/lib/program-builder-v2/exerciseTypes";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Dumbbell, X, Plus, SlidersHorizontal, Copy, CheckCheck, Trash2, Pencil, Hash, Clock, Search, Library, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MethodActionButtons } from "./shared/MethodActionButtons";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TimeInput } from "@/components/ui/time-input";
import { MethodExerciseDisplay } from "./MethodExerciseDisplay";
import { InlineVariablePicker } from "./shared/InlineVariablePicker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { RestPauseConfig } from "./RestPauseTypes";
import { RestPauseCreationUI } from "./RestPauseCreationUI";
import { generateMethodNote } from "@/lib/program-builder-v2/athleteNoteGenerator";
import { AthleteNoteDisplay } from "./AthleteNoteDisplay";

// Available dynamic variables for methods
interface DynamicVariable {
  key: string;
  label: string;
  field: keyof DropSetSeries;
  placeholder: string;
  unit?: string;
  type: 'number' | 'text';
  min?: number;
  max?: number;
}

const DYNAMIC_VARIABLES: DynamicVariable[] = [
  { key: 'percentage', label: '%1RM', field: 'percentage', placeholder: '75', type: 'number' },
  { key: 'load', label: 'Charge', field: 'load', placeholder: '50', unit: 'kg', type: 'number' },
  { key: 'tempo', label: 'Tempo', field: 'tempo', placeholder: '2-0-1-0', type: 'text' },
  { key: 'rpe', label: 'RPE', field: 'rpe', placeholder: '8', type: 'number', min: 1, max: 10 },
  { key: 'rir', label: 'RIR', field: 'rir' as keyof DropSetSeries, placeholder: '2', type: 'number', min: 0, max: 10 },
  { key: 'angle', label: 'Angle', field: 'angle', placeholder: '90', unit: '°', type: 'number' },
  { key: 'timeUnderTension', label: 'TST', field: 'timeUnderTension', placeholder: '6', unit: 's', type: 'number' },
  // Cardio machines (rameur, skierg, assault bike, vélo...)
  { key: 'durationSeconds', label: 'Durée', field: 'durationSeconds' as keyof DropSetSeries, placeholder: '300', unit: 's', type: 'number' },
  { key: 'distanceMeters', label: 'Distance', field: 'distanceMeters' as keyof DropSetSeries, placeholder: '1000', unit: 'm', type: 'number' },
  { key: 'calories', label: 'Calories', field: 'calories' as keyof DropSetSeries, placeholder: '50', unit: 'cal', type: 'number' },
  { key: 'watts', label: 'Watts', field: 'watts' as keyof DropSetSeries, placeholder: '150', unit: 'W', type: 'number' },
  { key: 'cadence', label: 'Cadence', field: 'cadence' as keyof DropSetSeries, placeholder: '80', unit: 'rpm', type: 'number' },
  // Course / locomotion
  { key: 'runDistanceMeters', label: 'Distance course', field: 'runDistanceMeters' as keyof DropSetSeries, placeholder: '400', unit: 'm', type: 'number' },
  { key: 'runDurationSeconds', label: 'Durée course', field: 'runDurationSeconds' as keyof DropSetSeries, placeholder: '600', unit: 's', type: 'number' },
  { key: 'paceSecondsPerKm', label: 'Allure', field: 'paceSecondsPerKm' as keyof DropSetSeries, placeholder: '330', unit: '/km', type: 'number' },
  { key: 'elevationMeters', label: 'Dénivelé', field: 'elevationMeters' as keyof DropSetSeries, placeholder: '100', unit: 'm', type: 'number' },
];

/** Variables cardio / course, affichées automatiquement selon le type d'exercice. */
const CARDIO_VARIABLE_KEYS = [
  'durationSeconds', 'distanceMeters', 'calories', 'watts', 'cadence',
  'runDistanceMeters', 'runDurationSeconds', 'paceSecondsPerKm', 'elevationMeters',
] as const;

interface DropSetSeries {
  reps: string;
  percentage?: number;
  rpe?: number;
  rir?: number;
  pauseSeconds?: number;
  tempo?: string;
  targetRpe?: number;
  angle?: number;
  timeUnderTension?: number;
  load?: number;
  // Cardio machines / course (génériques, toutes disciplines)
  durationSeconds?: number;
  distanceMeters?: number;
  calories?: number;
  watts?: number;
  cadence?: number;
  runDistanceMeters?: number;
  runDurationSeconds?: number;
  paceSecondsPerKm?: number;
  elevationMeters?: number;
  contractionType?: 'eccentric' | 'concentric' | 'isometric' | 'explosive' | 'plyometric';
  reductionType?: 'percentage' | 'kg';
  reductionValue?: number;
  phaseExerciseId?: string;
  phaseExerciseName?: string;
  isActive?: boolean;
  // For CrossFit methods
  exerciseId?: string;
  exerciseName?: string;
  // Consignes spécifiques (coach notes) pour cet exercice
  notes?: string;
}


// Death By configuration
interface DeathByConfig {
  startReps: number;
  incrementReps: number;
}

export type MethodConfigType = 
  | "drop_set" 
  | "rest_pause" 
  | "pyramid_up" 
  | "pyramid_down" 
  | "pyramid_full"
  | "five_by_five"
  | "isometric_overcoming"
  | "isometric_overcoming"
  | "isometric_yielding"
  // CrossFit methods
  | "amrap"
  | "for_time"
  | "death_by"
  | "circuit"
  | "tabata"
  | "emom"
  // Cardio methods
  | "intermittent_cardio";

// Interface for Tabata config
interface TabataConfig {
  workSeconds: number;
  restSeconds: number;
  rounds: number;
}

// Interface for EMOM config
export interface EmomConfig {
  intervalMinutes: number; // 1 = EMOM, 2 = E2MOM, 3 = E3MOM, etc.
  totalMinutes: number;
  mode: 'single' | 'circuit'; // single exercise per interval or circuit of exercises per interval
  exercisesPerInterval: number; // how many exercises in circuit mode
}

// Circuit recovery strategy
export type CircuitRecoveryStrategy = 'after_circuit' | 'between_exercises';

export interface CircuitRecoveryConfig {
  strategy: CircuitRecoveryStrategy;
  // "after_circuit": global rest time in seconds after all exercises
  globalRestSeconds?: number;
  // "between_exercises": per-exercise rest in seconds (indexed by exercise slot)
  perExerciseRestSeconds?: Record<number, number>;
}

// Initial data for restoring state on edit (strict deserialization)
export interface MethodConfigInitialData {
  series?: DropSetSeries[];
  tabataConfig?: TabataConfig;
  emomConfig?: EmomConfig;
  deathByConfig?: DeathByConfig;
  circuitRecovery?: CircuitRecoveryConfig;
  timeCap?: number;
  totalMinutes?: number;
  repsPerRound?: number;
  visibleVariables?: string[];
  methodExercises?: Array<{
    exerciseId: string;
    exerciseName: string;
    reps?: string;
    percentage?: number;
    load?: number;
    tempo?: string;
    rpe?: number;
    rir?: number;
    angle?: number;
    timeUnderTension?: number;
    notes?: string;
  }>;
  // Rest-Pause dedicated config
  restPauseConfig?: RestPauseConfig;
  // Rest between series (for non-crossfit methods)
  restSeconds?: number;
}

interface MethodConfigSlotsProps {
  method: MethodConfigType;
  dayId: string;
  onConfirm: (config: { 
    series: DropSetSeries[]; 
    tempo?: string; 
    targetRpe?: number;
    setsCount?: number;
    // CrossFit specific
    timeCap?: number;
    tabataConfig?: TabataConfig;
    totalMinutes?: number;
    repsPerRound?: number;
    // EMOM specific
    emomConfig?: EmomConfig;
    // Death By specific
    deathByConfig?: DeathByConfig;
    // Circuit recovery
    circuitRecovery?: CircuitRecoveryConfig;
    // CRITICAL: visible variables to preserve after validation
    visibleVariables?: string[];
    // Rest-Pause dedicated config
    restPauseConfig?: RestPauseConfig;
    // Rest between series for non-crossfit methods
    restSeconds?: number;
  }) => void;
  onCancel: () => void;
  droppedExercise?: { exerciseId: string; exerciseName: string } | null;
  onExerciseRemove: () => void;
  droppedPhaseExercises?: Record<number, { exerciseId: string; exerciseName: string } | null>;
  onPhaseExerciseRemove?: (phaseIndex: number) => void;
  onPhaseExerciseAdd?: (phaseIndex: number, picked: { id: string; name: string }) => void;
  // New: callback to apply exercises to all intervals (EMOM)
  onApplyToAllIntervals?: (exercises: Record<number, { exerciseId: string; exerciseName: string } | null>, seriesData: DropSetSeries[], exercisesPerInterval: number) => void;
  // New: callback to clear all phase exercises at once
  onClearAllPhaseExercises?: () => void;
  // Initial data for restoring state on edit (strict deserialization)
  initialData?: MethodConfigInitialData;
}

const CONTRACTION_TYPES = [
  { value: 'eccentric', label: 'Excentrique', description: 'Résistance à l\'étirement' },
  { value: 'explosive', label: 'Explosif', description: 'Vitesse maximale' },
  { value: 'isometric', label: 'Isométrique', description: 'Maintien statique' },
  { value: 'concentric', label: 'Concentrique', description: 'Phase de contraction' },
  { value: 'plyometric', label: 'Pliométrique', description: 'Cycle étirement-détente' },
];

const getMethodConfig = (method: string) => {
  switch (method) {
    case "drop_set":
      return {
        label: "Drop Set",
        color: "bg-red-500",
        borderColor: "border-red-500",
        bgActive: "bg-red-500/20",
        textColor: "text-red-600",
        description: "Séries dégressives sans repos entre les drops",
        defaultSeries: [
          { reps: "8", percentage: 80, load: undefined, tempo: "2-0-1-0", rpe: 8, isActive: true },
          { reps: "6", rpe: 9, reductionType: 'percentage' as const, reductionValue: 10, isActive: true },
          { reps: "4", rpe: 10, reductionType: 'percentage' as const, reductionValue: 10, isActive: true },
        ],
        showRpe: true,
        showPercentage: true,
        showPause: false,
        showAngle: false,
        showTimeUnderTension: false,
        showLoad: true,
        showContractionType: false,
        showTempo: true,
        showDropReduction: true,
        seriesLabel: "Drop",
        seriesLabelFn: (idx: number) => idx === 0 ? "Départ" : `Drop ${idx}`,
        hasPhaseExercises: false,
        hasDynamicVars: true,
      };
    case "rest_pause":
      return {
        label: "Rest-Pause",
        color: "bg-amber-500",
        borderColor: "border-amber-500",
        bgActive: "bg-amber-500/20",
        textColor: "text-amber-600",
        description: "Courtes pauses entre les mini-séries",
        defaultSeries: [
          { reps: "", isActive: true },
        ],
        showRpe: true,
        showPercentage: true,
        showPause: true,
        showAngle: false,
        showTimeUnderTension: false,
        showLoad: true,
        showContractionType: false,
        showTempo: true,
        seriesLabel: "Bloc",
        hasPhaseExercises: false,
        hasDynamicVars: true,
      };
    case "pyramid_up":
      return {
        label: "Pyramide Montante ↑",
        color: "bg-emerald-500",
        borderColor: "border-emerald-500",
        bgActive: "bg-emerald-500/20",
        textColor: "text-emerald-600",
        description: "Augmentation progressive de la charge",
        defaultSeries: [
          { reps: "12", percentage: 60, isActive: true },
          { reps: "10", percentage: 70, isActive: true },
          { reps: "8", percentage: 80, isActive: true },
        ],
        showRpe: true,
        showPercentage: true,
        showPause: false,
        showAngle: false,
        showTimeUnderTension: false,
        showLoad: true,
        showContractionType: false,
        showTempo: true,
        seriesLabel: "Série",
        hasPhaseExercises: false,
        hasDynamicVars: true,
      };
    case "pyramid_down":
      return {
        label: "Pyramide Descendante ↓",
        color: "bg-teal-500",
        borderColor: "border-teal-500",
        bgActive: "bg-teal-500/20",
        textColor: "text-teal-600",
        description: "Diminution progressive de la charge",
        defaultSeries: [
          { reps: "6", percentage: 85, isActive: true },
          { reps: "8", percentage: 75, isActive: true },
          { reps: "12", percentage: 65, isActive: true },
        ],
        showRpe: true,
        showPercentage: true,
        showPause: false,
        showAngle: false,
        showTimeUnderTension: false,
        showLoad: true,
        showContractionType: false,
        showTempo: true,
        seriesLabel: "Série",
        hasPhaseExercises: false,
        hasDynamicVars: true,
      };
    case "pyramid_full":
      return {
        label: "Pyramide Complète ↑↓",
        color: "bg-cyan-500",
        borderColor: "border-cyan-500",
        bgActive: "bg-cyan-500/20",
        textColor: "text-cyan-600",
        description: "Montée puis descente de la charge",
        defaultSeries: [
          { reps: "12", percentage: 60, isActive: true },
          { reps: "8", percentage: 70, isActive: true },
          { reps: "5", percentage: 80, isActive: true },
          { reps: "8", percentage: 70, isActive: true },
          { reps: "12", percentage: 60, isActive: true },
        ],
        showRpe: true,
        showPercentage: true,
        showPause: false,
        showAngle: false,
        showTimeUnderTension: false,
        showLoad: true,
        showContractionType: false,
        showTempo: true,
        seriesLabel: "Série",
        hasPhaseExercises: false,
        hasDynamicVars: true,
      };
    case "five_by_five":
      return {
        label: "5x5",
        color: "bg-sky-500",
        borderColor: "border-sky-500",
        bgActive: "bg-sky-500/20",
        textColor: "text-sky-600",
        description: "5 séries de 5 répétitions pour la force",
        defaultSeries: [
          { reps: "5", percentage: 80, isActive: true },
          { reps: "5", percentage: 80, isActive: true },
          { reps: "5", percentage: 80, isActive: true },
          { reps: "5", percentage: 80, isActive: true },
          { reps: "5", percentage: 80, isActive: true },
        ],
        showRpe: true,
        showPercentage: true,
        showPause: false,
        showAngle: false,
        showTimeUnderTension: false,
        showLoad: true,
        showContractionType: false,
        showTempo: true,
        seriesLabel: "Série",
        hasPhaseExercises: false,
        hasDynamicVars: true,
      };
    case "isometric_overcoming":
      return {
        label: "Isométrie Overcoming",
        color: "bg-stone-500",
        borderColor: "border-stone-500",
        bgActive: "bg-stone-500/20",
        textColor: "text-stone-600",
        description: "Contraction maximale contre résistance fixe",
        defaultSeries: [
          { reps: "1", angle: 90, timeUnderTension: 6, rpe: 10, isActive: true },
          { reps: "1", angle: 90, timeUnderTension: 6, rpe: 10, isActive: true },
          { reps: "1", angle: 90, timeUnderTension: 6, rpe: 10, isActive: true },
        ],
        showRpe: true,
        showPercentage: false,
        showPause: false,
        showAngle: true,
        showTimeUnderTension: true,
        showLoad: false,
        showContractionType: false,
        seriesLabel: "Série",
        hasPhaseExercises: false,
        hasDynamicVars: true,
      };
    case "isometric_yielding":
      return {
        label: "Isométrie Yielding",
        color: "bg-slate-500",
        borderColor: "border-slate-500",
        bgActive: "bg-slate-500/20",
        textColor: "text-slate-600",
        description: "Maintien de charge à un angle spécifique",
        defaultSeries: [
          { reps: "1", angle: 90, timeUnderTension: 20, load: 50, rpe: 8, isActive: true },
          { reps: "1", angle: 90, timeUnderTension: 20, load: 50, rpe: 8, isActive: true },
          { reps: "1", angle: 90, timeUnderTension: 20, load: 50, rpe: 8, isActive: true },
        ],
        showRpe: true,
        showPercentage: false,
        showPause: false,
        showAngle: true,
        showTimeUnderTension: true,
        showLoad: true,
        showContractionType: false,
        seriesLabel: "Série",
        hasPhaseExercises: false,
        hasDynamicVars: true,
      };
    // CrossFit methods
    case "amrap":
      return {
        label: "AMRAP",
        color: "bg-rose-500",
        borderColor: "border-rose-500",
        bgActive: "bg-rose-500/20",
        textColor: "text-rose-600",
        description: "Maximum de tours/reps en temps limité",
        defaultSeries: [
          { reps: "10", isActive: true },
          { reps: "10", isActive: true },
          { reps: "10", isActive: true },
        ],
        showRpe: false,
        showPercentage: false,
        showPause: false,
        showAngle: false,
        showTimeUnderTension: false,
        showLoad: false,
        showContractionType: false,
        seriesLabel: "Exercice",
        hasPhaseExercises: true,
        isCircuitMethod: true,
        showTimeCap: true,
      };
    case "for_time":
      return {
        label: "For Time",
        color: "bg-orange-500",
        borderColor: "border-orange-500",
        bgActive: "bg-orange-500/20",
        textColor: "text-orange-600",
        description: "Complétez le circuit le plus vite possible",
        defaultSeries: [
          { reps: "21", isActive: true },
          { reps: "15", isActive: true },
          { reps: "9", isActive: true },
        ],
        showRpe: false,
        showPercentage: false,
        showPause: false,
        showAngle: false,
        showTimeUnderTension: false,
        showLoad: false,
        showContractionType: false,
        seriesLabel: "Exercice",
        hasPhaseExercises: true,
        isCircuitMethod: true,
        showTimeCap: true,
      };
    case "death_by":
      return {
        label: "Death By",
        color: "bg-red-600",
        borderColor: "border-red-600",
        bgActive: "bg-red-600/20",
        textColor: "text-red-600",
        description: "Progression de reps configurables jusqu'à l'échec",
        defaultSeries: [
          { reps: "1", isActive: true },
        ],
        showRpe: true,
        showPercentage: true,
        showPause: false,
        showAngle: false,
        showTimeUnderTension: false,
        showLoad: true,
        showContractionType: false,
        showTempo: true,
        seriesLabel: "Exercice",
        hasPhaseExercises: true,
        isCircuitMethod: false,
        isDeathBy: true,
      };
    case "circuit":
      return {
        label: "Circuit",
        color: "bg-lime-500",
        borderColor: "border-lime-500",
        bgActive: "bg-lime-500/20",
        textColor: "text-lime-600",
        description: "Enchaînement d'exercices avec peu de repos",
        defaultSeries: [
          { reps: "10", isActive: true },
          { reps: "10", isActive: true },
          { reps: "10", isActive: true },
        ],
        showRpe: false,
        showPercentage: false,
        showPause: false,
        showAngle: false,
        showTimeUnderTension: false,
        showLoad: false,
        showContractionType: false,
        seriesLabel: "Exercice",
        hasPhaseExercises: true,
        isCircuitMethod: true,
        showRounds: true,
      };
    case "tabata":
      return {
        label: "Tabata",
        color: "bg-yellow-500",
        borderColor: "border-yellow-500",
        bgActive: "bg-yellow-500/20",
        textColor: "text-yellow-600",
        description: "Intervalles travail/repos personnalisables",
        defaultSeries: [
          { reps: "max", isActive: true },
        ],
        showRpe: false,
        showPercentage: false,
        showPause: false,
        showAngle: false,
        showTimeUnderTension: false,
        showLoad: false,
        showContractionType: false,
        seriesLabel: "Exercice",
        hasPhaseExercises: true,
        isCircuitMethod: false,
        isTabata: true,
      };
    case "emom":
      return {
        label: "EMOM",
        color: "bg-indigo-500",
        borderColor: "border-indigo-500",
        bgActive: "bg-indigo-500/20",
        textColor: "text-indigo-600",
        description: "Exercices à intervalles réguliers (toutes les X minutes)",
        defaultSeries: [
          { reps: "10", isActive: true },
          { reps: "10", isActive: true },
        ],
        showRpe: false,
        showPercentage: false,
        showPause: false,
        showAngle: false,
        showTimeUnderTension: false,
        showLoad: false,
        showContractionType: false,
        seriesLabel: "Intervalle",
        hasPhaseExercises: true,
        isCircuitMethod: true,
        showTotalMinutes: true,
        isEmom: true,
      };
    case "intermittent_cardio":
      return {
        label: "Intermittent Cardio",
        color: "bg-sky-500",
        borderColor: "border-sky-500",
        bgActive: "bg-sky-500/20",
        textColor: "text-sky-600",
        description: "Alternance effort/récupération pour le développement cardio",
        defaultSeries: [],
        showRpe: false,
        showPercentage: false,
        showPause: false,
        showAngle: false,
        showTimeUnderTension: false,
        showLoad: false,
        showContractionType: false,
        seriesLabel: "Intervalle",
        hasPhaseExercises: false,
        isIntermittentCardio: true,
      };
    default:
      return {
        label: "Méthode",
        color: "bg-gray-500",
        borderColor: "border-gray-500",
        bgActive: "bg-gray-500/20",
        textColor: "text-gray-600",
        description: "",
        defaultSeries: [{ reps: "10", isActive: true }],
        showRpe: false,
        showPercentage: false,
        showPause: false,
        showAngle: false,
        showTimeUnderTension: false,
        showLoad: false,
        showContractionType: false,
        seriesLabel: "Série",
        hasPhaseExercises: false,
      };
  }
};

// Exercise drop slot
const ExerciseDropSlot = ({
  slotId,
  exercise,
  config,
  onRemove,
  label,
  isPhaseSlot = false,
}: {
  slotId: string;
  exercise?: { exerciseId: string; exerciseName: string } | null;
  config: ReturnType<typeof getMethodConfig>;
  onRemove: () => void;
  label?: string;
  isPhaseSlot?: boolean;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: slotId,
    data: { type: isPhaseSlot ? "method-phase-slot" : "method-config-slot" },
  });

  const isFilled = !!exercise;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative transition-all min-h-[44px]",
        !isFilled && "p-2 rounded-lg border-2 border-dashed",
        !isFilled && (isOver
          ? `${config.borderColor} bg-primary/10`
          : "border-muted-foreground/30 bg-muted/20")
      )}
    >
      {isFilled ? (
        <MethodExerciseDisplay
          exerciseName={exercise.exerciseName}
          onRemove={onRemove}
          methodBgColor={config.bgActive}
          methodBorderColor={config.borderColor}
          methodTextColor={config.textColor}
          methodIconColor={config.color}
        />
      ) : (
        <div className="flex items-center justify-center w-full text-muted-foreground">
          <Dumbbell className="h-4 w-4 mr-2 opacity-50 flex-shrink-0" />
          <span className="text-sm truncate">{label || "Glissez un exercice ici"}</span>
        </div>
      )}
    </div>
  );
};

// Inline picker (input + library popover) used inside empty CircuitExerciseSlot.
// Allows the athlete (and coach) to type the exercise name with autocomplete,
// or open the full library list, without relying on drag-and-drop.
const InlineSlotPicker = ({
  placeholder,
  onPick,
}: {
  placeholder?: string;
  onPick: (picked: { id: string; name: string }) => void;
}) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [libOpen, setLibOpen] = useState(false);

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ["circuit-slot-picker", search, libOpen],
    enabled: open || libOpen,
    queryFn: async () => {
      let q = supabase
        .from("exercise_library")
        .select("id, name, category")
        .order("name", { ascending: true })
        .limit(40);
      const s = search.trim();
      if (s) q = q.ilike("name", `%${s}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; category: string }[];
    },
  });

  const handlePick = (ex: { id: string; name: string }) => {
    onPick(ex);
    setSearch("");
    setOpen(false);
    setLibOpen(false);
  };

  return (
    <div className="flex items-center gap-1 w-full" onPointerDown={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="flex-1 relative">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder || "Tapez le nom de l'exercice…"}
              className="h-8 text-xs"
            />
          </div>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="p-1 w-[min(320px,90vw)] max-h-64 overflow-y-auto z-[200] bg-popover border shadow-lg"
        >
          {isLoading ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">Chargement…</div>
          ) : exercises.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              Aucun exercice trouvé.
            </div>
          ) : (
            exercises.slice(0, 20).map((ex) => (
              <button
                key={ex.id}
                type="button"
                className="w-full text-left px-2 py-1.5 hover:bg-muted rounded-sm text-xs flex items-center justify-between gap-2"
                onClick={() => handlePick({ id: ex.id, name: ex.name })}
              >
                <span className="truncate">{ex.name}</span>
                <span className="text-[10px] uppercase text-muted-foreground shrink-0">
                  {ex.category}
                </span>
              </button>
            ))
          )}
        </PopoverContent>
      </Popover>

      <Popover open={libOpen} onOpenChange={setLibOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            title="Parcourir la bibliothèque"
          >
            <Library className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={4}
          className="p-2 w-[min(360px,92vw)] z-[200] bg-popover border shadow-lg rounded-2xl"
        >
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="rounded-xl pl-8 h-9 text-sm"
            />
          </div>
          <div className="max-h-72 overflow-auto space-y-0.5">
            {isLoading && (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                Chargement…
              </div>
            )}
            {!isLoading && exercises.length === 0 && (
              <p className="text-xs text-center text-muted-foreground py-4">
                Aucun exercice trouvé.
              </p>
            )}
            {exercises.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => handlePick({ id: ex.id, name: ex.name })}
                className="w-full text-left px-2.5 py-1.5 rounded-xl text-sm hover:bg-muted/60 transition-colors flex items-center justify-between gap-2"
              >
                <span className="truncate">{ex.name}</span>
                <span className="text-[10px] uppercase text-muted-foreground shrink-0">
                  {ex.category}
                </span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};


// Consignes spécifiques (coach notes) éditables pour un exercice de méthode
const SlotNotesEditor = ({
  value,
  onChange,
}: {
  value?: string;
  onChange: (val: string) => void;
}) => {
  const [open, setOpen] = useState(Boolean(value && value.length > 0));

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="h-6 px-2 text-[11px] text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 gap-1"
      >
        <MessageSquare className="h-3 w-3" />
        + Consignes spécifiques
      </Button>
    );
  }

  return (
    <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
      <div className="flex items-center justify-between mb-1">
        <Label className="text-[10px] uppercase tracking-wide text-blue-700 dark:text-blue-400 font-semibold flex items-center gap-1">
          <MessageSquare className="h-3 w-3" /> Consignes spécifiques
        </Label>
        <button
          type="button"
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="p-0.5 hover:bg-destructive/20 rounded"
          title="Retirer la consigne"
        >
          <X className="h-3 w-3 text-destructive" />
        </button>
      </div>
      <Textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        placeholder="Ex: Garde le dos bien droit, contrôle la descente..."
        rows={2}
        className="text-xs resize-y min-h-[44px] bg-background/70"
      />
    </div>
  );
};

// Circuit exercise slot for AMRAP, For Time, etc. - with training variables
const CircuitExerciseSlot = ({
  slotId,
  exercise,
  config,
  onRemove,
  placeholder,
  seriesData,
  onUpdateSeries,
  showExpandedVars = false,
  visibleVariables,
  onAddVariable,
  onRemoveVariable,
  hiddenVariables,
  // Per-exercise rest (circuit "between_exercises" strategy)
  restSeconds,
  onRestChange,
  showPerExerciseRest = false,
  // Inline picker (text input + library popover) when the slot is empty
  onPick,
}: {
  slotId: string;
  exercise?: { exerciseId: string; exerciseName: string } | null;
  config: ReturnType<typeof getMethodConfig>;
  onRemove: () => void;
  placeholder?: string;
  seriesData?: DropSetSeries;
  onUpdateSeries?: (field: keyof DropSetSeries, value: string | number | undefined) => void;
  showExpandedVars?: boolean;
  visibleVariables?: string[];
  onAddVariable?: (key: string) => void;
  onRemoveVariable?: (key: string) => void;
  hiddenVariables?: DynamicVariable[];
  restSeconds?: number;
  onRestChange?: (seconds: number) => void;
  showPerExerciseRest?: boolean;
  onPick?: (picked: { id: string; name: string }) => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: slotId,
    data: { type: "method-phase-slot" },
  });

  const isFilled = !!exercise;
  const [showVars, setShowVars] = useState(true);

  const activeVars = visibleVariables || ['percentage', 'load', 'tempo', 'rpe'];

  // Auto-affichage des variables cardio / course selon le type d'exercice choisi
  // (rameur, skierg, assault bike, vélo, course, natation...) — toutes disciplines.
  const autoVars = useMemo(() => {
    if (!exercise?.exerciseName) return [] as string[];
    const type = inferExerciseTypeFromName(exercise.exerciseName);
    if (type === 'cardio_machine') return ['durationSeconds', 'distanceMeters', 'calories'];
    if (type === 'cardio_locomotion') return ['runDistanceMeters', 'runDurationSeconds', 'elevationMeters'];
    return [] as string[];
  }, [exercise?.exerciseName]);

  useEffect(() => {
    if (!onAddVariable || autoVars.length === 0) return;
    autoVars.forEach((key) => {
      if (!activeVars.includes(key)) onAddVariable(key);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoVars.join(","), activeVars.join(",")]);



  return (
    <div className="space-y-1.5">
      <div
        ref={setNodeRef}
        className={cn(
          "relative flex items-center gap-2 p-1.5 rounded-lg border-2 border-dashed transition-all min-h-[38px]",
          isFilled
            ? `${config.borderColor} ${config.bgActive} border-solid`
            : isOver
            ? `${config.borderColor} bg-primary/10`
            : "border-muted-foreground/30 bg-muted/20"
        )}
      >
        {isFilled ? (
          <>
            <div className={cn("w-6 h-6 rounded flex items-center justify-center flex-shrink-0", config.color)}>
              <Dumbbell className="h-3 w-3 text-white" />
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-sm font-medium truncate">{exercise.exerciseName}</p>
            </div>
            {onUpdateSeries && (
              <Button
                type="button"
                variant={showVars ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-6 px-2 text-xs gap-1 flex-shrink-0",
                  showVars ? config.textColor : "text-muted-foreground"
                )}
                onClick={() => setShowVars(!showVars)}
                title={showVars ? "Masquer les variables" : "Afficher les variables d'entraînement"}
              >
                <SlidersHorizontal className="h-3 w-3" />
                {showVars ? "Masquer" : "Variables"}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-destructive hover:text-destructive/80 flex-shrink-0"
              onClick={onRemove}
            >
              <X className="h-3 w-3" />
            </Button>
          </>
        ) : onPick ? (
          <InlineSlotPicker placeholder={placeholder} onPick={onPick} />
        ) : (
          <div className="flex items-center w-full text-muted-foreground">
            <Dumbbell className="h-3 w-3 mr-2 opacity-50 flex-shrink-0" />
            <span className="text-xs truncate">{placeholder || "Glissez un exercice"}</span>
          </div>
        )}
      </div>
      
      
      {/* Expanded training variables */}
      {isFilled && showVars && onUpdateSeries && seriesData && (
        <div className={cn("ml-4 p-2 rounded-lg border space-y-1.5", config.bgActive, config.borderColor)}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground font-medium">Variables</span>
            {onAddVariable && hiddenVariables && hiddenVariables.length > 0 && (
              <InlineVariablePicker
                items={hiddenVariables.map((v) => ({ key: v.key, label: v.label }))}
                onPick={onAddVariable}
                align="end"
                width="w-56"
                heading="Ajouter une variable"
                buttonLabel="Variable"
                buttonClassName="h-5 text-[10px] border-dashed px-1.5 gap-0.5"
                title="Ajouter une variable (Charge, %1RM, RPE, RIR, Tempo...)"
              />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Reps - always shown */}
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground font-medium">Reps</Label>
              <div className="flex items-center gap-1">
                {seriesData.reps === 'MAX' ? (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => onUpdateSeries("reps", "")}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="h-8 px-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold"
                    title="Échec technique (cliquer pour modifier)"
                  >
                    MAX
                  </Button>
                ) : (
                  <>
                    <NumericInput
                      value={seriesData.reps || ""}
                      onChange={(val) => onUpdateSeries("reps", val)}
                      className="h-8 text-sm"
                      placeholder="10"
                      minChars={4}
                      maxChars={6}
                    />
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => onUpdateSeries("reps", "MAX")}
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="h-8 px-2 text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white"
                      title="Échec technique (MAX)"
                    >
                      MAX
                    </Button>
                  </>
                )}
              </div>
            </div>
            {activeVars.includes('load') && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <Label className="text-[10px] text-muted-foreground font-medium">Charge (kg)</Label>
                  {onRemoveVariable && (
                    <button type="button" onClick={() => onRemoveVariable('load')} className="h-3 w-3 flex items-center justify-center text-destructive hover:text-destructive/80">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
                <NumericInput
                  value={seriesData.load}
                  onChange={(val) => onUpdateSeries("load", parseInt(val) || undefined)}
                  className="h-8"
                  placeholder="20"
                  minChars={3}
                  maxChars={6}
                />
              </div>
            )}
            {activeVars.includes('percentage') && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <Label className="text-[10px] text-muted-foreground font-medium">% 1RM</Label>
                  {onRemoveVariable && (
                    <button type="button" onClick={() => onRemoveVariable('percentage')} className="h-3 w-3 flex items-center justify-center text-destructive hover:text-destructive/80">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
                <NumericInput
                  value={seriesData.percentage}
                  onChange={(val) => onUpdateSeries("percentage", parseInt(val) || undefined)}
                  className="h-8"
                  placeholder="70"
                  minChars={3}
                  maxChars={5}
                />
              </div>
            )}
            {activeVars.includes('tempo') && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <Label className="text-[10px] text-muted-foreground font-medium">Tempo</Label>
                  {onRemoveVariable && (
                    <button type="button" onClick={() => onRemoveVariable('tempo')} className="h-3 w-3 flex items-center justify-center text-destructive hover:text-destructive/80">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
                <NumericInput
                  value={seriesData.tempo}
                  onChange={(val) => onUpdateSeries("tempo", val)}
                  className="h-8"
                  placeholder="3-1-2-0"
                  minChars={7}
                  maxChars={10}
                />
              </div>
            )}
            {activeVars.includes('rpe') && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <Label className="text-[10px] text-muted-foreground font-medium">RPE</Label>
                  {!(seriesData?.reps === 'MAX') && onRemoveVariable && (
                    <button type="button" onClick={() => onRemoveVariable('rpe')} className="h-3 w-3 flex items-center justify-center text-destructive hover:text-destructive/80">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
                {seriesData?.reps === 'MAX' ? (
                  <div className="h-8 flex items-center justify-center rounded-md border-2 bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 min-w-[60px]">
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">10</span>
                  </div>
                ) : (
                  <NumericInput
                    value={seriesData?.rpe}
                    onChange={(val) => onUpdateSeries("rpe", parseInt(val) || undefined)}
                    className="h-8"
                    placeholder="8"
                    minChars={2}
                    maxChars={4}
                  />
                )}
              </div>
            )}
            {activeVars.includes('rir') && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <Label className="text-[10px] text-muted-foreground font-medium">RIR</Label>
                  {!(seriesData?.reps === 'MAX') && onRemoveVariable && (
                    <button type="button" onClick={() => onRemoveVariable('rir')} className="h-3 w-3 flex items-center justify-center text-destructive hover:text-destructive/80">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
                {seriesData?.reps === 'MAX' ? (
                  <div className="h-8 flex items-center justify-center rounded-md border-2 bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 min-w-[60px]">
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">0</span>
                  </div>
                ) : (
                  <NumericInput
                    value={(seriesData as any)?.rir}
                    onChange={(val) => onUpdateSeries("rir" as any, parseInt(val) || undefined)}
                    className="h-8"
                    placeholder="2"
                    minChars={2}
                    maxChars={4}
                  />
                )}
              </div>
            )}
            {activeVars.includes('angle') && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <Label className="text-[10px] text-muted-foreground font-medium">Angle</Label>
                  {onRemoveVariable && (
                    <button type="button" onClick={() => onRemoveVariable('angle')} className="h-3 w-3 flex items-center justify-center text-destructive hover:text-destructive/80">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
                <NumericInput
                  value={seriesData?.angle}
                  onChange={(val) => onUpdateSeries("angle", parseInt(val) || undefined)}
                  className="h-8"
                  placeholder="90"
                  minChars={3}
                  maxChars={5}
                  suffix="°"
                />
              </div>
            )}
            {activeVars.includes('timeUnderTension') && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <Label className="text-[10px] text-muted-foreground font-medium">TST</Label>
                  {onRemoveVariable && (
                    <button type="button" onClick={() => onRemoveVariable('timeUnderTension')} className="h-3 w-3 flex items-center justify-center text-destructive hover:text-destructive/80">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
                <NumericInput
                  value={seriesData?.timeUnderTension}
                  onChange={(val) => onUpdateSeries("timeUnderTension", parseInt(val) || undefined)}
                  className="h-8"
                  placeholder="6"
                  minChars={2}
                  maxChars={4}
                  suffix="s"
                />
              </div>
            )}
            {/* Variables cardio / course (rameur, vélo, assault bike, run...) */}
            {CARDIO_VARIABLE_KEYS.filter((key) => activeVars.includes(key)).map((key) => {
              const meta = DYNAMIC_VARIABLES.find((v) => v.key === key)!;
              const isTime = key === 'durationSeconds' || key === 'runDurationSeconds' || key === 'paceSecondsPerKm';
              return (
                <div key={key} className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <Label className="text-[10px] text-muted-foreground font-medium">
                      {meta.label}{meta.unit && !isTime ? ` (${meta.unit})` : ''}
                    </Label>
                    {onRemoveVariable && (
                      <button type="button" onClick={() => onRemoveVariable(key)} className="h-3 w-3 flex items-center justify-center text-destructive hover:text-destructive/80">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                  {isTime ? (
                    <TimeInput
                      value={(seriesData as any)?.[key] || 0}
                      onChange={(seconds) => onUpdateSeries(key as keyof DropSetSeries, seconds || undefined)}
                    />
                  ) : (
                    <NumericInput
                      value={(seriesData as any)?.[key]}
                      onChange={(val) => onUpdateSeries(key as keyof DropSetSeries, parseInt(val) || undefined)}
                      className="h-8"
                      placeholder={meta.placeholder}
                      minChars={4}
                      maxChars={7}
                    />
                  )}
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* Consignes spécifiques pour cet exercice */}
      {isFilled && onUpdateSeries && (
        <div className="ml-4">
          <SlotNotesEditor
            value={seriesData?.notes}
            onChange={(val) => onUpdateSeries("notes", val)}
          />
        </div>
      )}

      {/* Per-exercise rest (circuit "between_exercises" strategy) */}
      {isFilled && showPerExerciseRest && onRestChange && (
        <div className={cn("ml-4 flex items-center gap-2 p-2 rounded-lg border", config.bgActive, config.borderColor)}>
          <Label className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">Repos</Label>
          <TimeInput
            value={restSeconds || 0}
            onChange={onRestChange}
          />
        </div>
      )}
    </div>
  );
};

// Phase exercise slot for Super Pletnev
const PhaseExerciseSlot = ({
  slotId,
  phaseIndex,
  exercise,
  generalExercise,
  config,
  contractionType,
  isActive,
  onRemove,
  onToggleActive,
}: {
  slotId: string;
  phaseIndex: number;
  exercise?: { exerciseId: string; exerciseName: string } | null;
  generalExercise?: { exerciseId: string; exerciseName: string } | null;
  config: ReturnType<typeof getMethodConfig>;
  contractionType: string;
  isActive: boolean;
  onRemove: () => void;
  onToggleActive: () => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: slotId,
    data: { type: "method-phase-slot", phaseIndex },
  });

  const displayExercise = exercise || generalExercise;
  const isFilled = !!displayExercise;
  const isOverridden = !!exercise;
  
  const getContractionLabel = (type: string) => {
    return CONTRACTION_TYPES.find(ct => ct.value === type)?.label || type;
  };

  if (!isActive) {
    return (
      <div className="relative flex items-center gap-2 p-1.5 rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/10 min-h-[38px] opacity-50">
        <div className={cn(
          "w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white/50",
          "bg-muted-foreground/30"
        )}>
          {phaseIndex + 1}
        </div>
        <span className="text-xs text-muted-foreground line-through">Phase désactivée</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5 ml-auto text-green-500 hover:text-green-600"
          onClick={onToggleActive}
          title="Réactiver la phase"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative flex items-center gap-2 p-1.5 rounded-lg border-2 border-dashed transition-all min-h-[38px]",
        isFilled
          ? isOverridden 
            ? `${config.borderColor} ${config.bgActive} border-solid`
            : `border-muted-foreground/40 bg-muted/30 border-solid`
          : isOver
          ? `${config.borderColor} bg-primary/10`
          : "border-muted-foreground/30 bg-muted/20"
      )}
    >
      {isFilled ? (
        <>
          <div className={cn(
            "w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white flex-shrink-0",
            config.color
          )}>
            {phaseIndex + 1}
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className={cn(
              "text-xs font-medium truncate",
              !isOverridden && "text-muted-foreground"
            )}>
              {displayExercise.exerciseName}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {getContractionLabel(contractionType)}
              {!isOverridden && " (général)"}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isOverridden && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-muted-foreground/80"
                onClick={onRemove}
                title="Retirer l'exercice spécifique"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-destructive hover:text-destructive/80"
              onClick={onToggleActive}
              title="Désactiver cette phase"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className={cn(
            "w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white flex-shrink-0",
            config.color
          )}>
            {phaseIndex + 1}
          </div>
          <span className="text-xs text-muted-foreground truncate flex-1">{getContractionLabel(contractionType)} - Glisser exercice</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-destructive hover:text-destructive/80 flex-shrink-0"
            onClick={onToggleActive}
            title="Désactiver cette phase"
          >
            <X className="h-3 w-3" />
          </Button>
        </>
      )}
    </div>
  );
};

export const MethodConfigSlots = ({
  method,
  dayId,
  onConfirm,
  onCancel,
  droppedExercise,
  onExerciseRemove,
  droppedPhaseExercises = {},
  onPhaseExerciseRemove,
  onPhaseExerciseAdd,
  onApplyToAllIntervals,
  onClearAllPhaseExercises,
  initialData,
}: MethodConfigSlotsProps) => {
  const config = getMethodConfig(method);
  
  // État édition/lecture seule - centralisé
  const [isEditing, setIsEditing] = useState(true);
  const [isValidated, setIsValidated] = useState(false);
  
  // CRITICAL: Use initialData (saved state) if provided, otherwise use defaults
  const [series, setSeries] = useState<DropSetSeries[]>(() => {
    if (initialData?.methodExercises && initialData.methodExercises.length > 0) {
      return initialData.methodExercises.map((ex) => {
        const s: DropSetSeries = { reps: ex.reps || "10", isActive: true };
        if (ex.percentage !== undefined) s.percentage = ex.percentage;
        if (ex.load !== undefined) s.load = ex.load;
        if (ex.tempo !== undefined) s.tempo = ex.tempo;
        if (ex.rpe !== undefined) s.rpe = ex.rpe;
        if (ex.rir !== undefined) s.rir = ex.rir;
        if (ex.angle !== undefined) s.angle = ex.angle;
        if (ex.timeUnderTension !== undefined) s.timeUnderTension = ex.timeUnderTension;
        if ((ex as any).notes !== undefined) s.notes = (ex as any).notes;
        s.exerciseId = ex.exerciseId;
        s.exerciseName = ex.exerciseName;
        s.phaseExerciseId = ex.exerciseId;
        s.phaseExerciseName = ex.exerciseName;
        return s;
      });
    }

    if (initialData?.series && initialData.series.length > 0) {
      return initialData.series;
    }

    return config.defaultSeries;
  });
  const [tempo, setTempo] = useState("");
  const [targetRpe, setTargetRpe] = useState<number | undefined>();
  // Drop Set: nombre de séries complètes (combien de fois répéter la séquence de drops)
  const [setsCount, setSetsCount] = useState<number>(method === "drop_set" ? 3 : 1);
  
  // Dynamic variables visibility state — ONLY show variables that were actually saved
  const getDefaultVisibleVars = () => {
    // Si au moins une série est en MAX, RPE/RIR sont forcés → toujours visibles
    const hasMax = (initialData?.series || initialData?.methodExercises || []).some(
      (s: any) => s?.reps === 'MAX'
    );
    const withMax = (vars: string[]) => {
      if (!hasMax) return vars;
      const next = [...vars];
      if (!next.includes('rpe')) next.push('rpe');
      if (!next.includes('rir')) next.push('rir');
      return next;
    };
    // If restoring from saved data, use ONLY the saved visible variables
    if (initialData?.visibleVariables) {
      return withMax(initialData.visibleVariables);
    }
    // For CrossFit methods with methodExercises, infer from actual data (no phantom vars)
    if (initialData?.methodExercises && initialData.methodExercises.length > 0) {
      const vars: string[] = [];
      const hasAny = (key: string) => initialData.methodExercises!.some(
        (ex: any) => ex[key] !== undefined && ex[key] !== null
      );
      if (hasAny('percentage')) vars.push('percentage');
      if (hasAny('load')) vars.push('load');
      if (hasAny('tempo')) vars.push('tempo');
      if (hasAny('rpe')) vars.push('rpe');
      if (hasAny('rir')) vars.push('rir');
      if (hasAny('angle')) vars.push('angle');
      if (hasAny('timeUnderTension')) vars.push('timeUnderTension');
      return withMax(vars);
    }
    // Default for fresh creation
    const vars: string[] = [];
    if (config.showPercentage) vars.push('percentage');
    if (config.showLoad) vars.push('load');
    if (config.showTempo) vars.push('tempo');
    if (config.showRpe) vars.push('rpe');
    if (config.showAngle) vars.push('angle');
    if (config.showTimeUnderTension) vars.push('timeUnderTension');
    return withMax(vars);
  };
  const [visibleVariables, setVisibleVariables] = useState<string[]>(getDefaultVisibleVars);

  
  // CrossFit specific states — restore from initialData if available
  const [timeCap, setTimeCap] = useState<number>(initialData?.timeCap ?? 10);
  const [totalMinutes, setTotalMinutes] = useState<number>(initialData?.totalMinutes ?? 10);
  const [rounds, setRounds] = useState<number>(initialData?.repsPerRound ?? 3);
  const [tabataConfig, setTabataConfig] = useState<TabataConfig>(
    initialData?.tabataConfig ?? { workSeconds: 20, restSeconds: 10, rounds: 8 }
  );
  
  // EMOM specific states
  const [emomConfig, setEmomConfig] = useState<EmomConfig>(
    initialData?.emomConfig ?? {
      intervalMinutes: 1,
      totalMinutes: 10,
      mode: 'single',
      exercisesPerInterval: 1,
    }
  );
  
  // Death By specific states
  const [deathByConfig, setDeathByConfig] = useState<DeathByConfig>(
    initialData?.deathByConfig ?? { startReps: 1, incrementReps: 1 }
  );

  // Circuit recovery strategy
  const [circuitRecovery, setCircuitRecovery] = useState<CircuitRecoveryConfig>(
    initialData?.circuitRecovery ?? {
      strategy: 'after_circuit',
      globalRestSeconds: 90,
      perExerciseRestSeconds: {},
    }
  );

  // Check if this is a CrossFit circuit method
  const isCircuitMethod = ['amrap', 'for_time', 'circuit'].includes(method);
  const isEmom = method === 'emom';
  const isTabata = method === 'tabata';
  const isDeathBy = method === 'death_by';
  const isRestPause = method === 'rest_pause';

  // Rest-Pause dedicated state — completely separate from generic series
  const [restPauseConfig, setRestPauseConfig] = useState<RestPauseConfig>(() => {
    if (isRestPause && initialData?.restPauseConfig) {
      return initialData.restPauseConfig;
    }
    return { series: [] };
  });

  // Rest between series (for classic methods: 5x5, drop set, pyramids, iso, etc.)
  const [restSeconds, setRestSeconds] = useState<number>(initialData?.restSeconds ?? 90);
  // Helper functions for dynamic variables
  const removeVariable = (varKey: string) => {
    setVisibleVariables(prev => prev.filter(v => v !== varKey));
    // Clear the value from all series
    const fieldToKey: Record<string, keyof DropSetSeries> = {
      percentage: 'percentage',
      load: 'load',
      tempo: 'tempo',
      rpe: 'rpe',
      rir: 'rir',
      angle: 'angle',
      timeUnderTension: 'timeUnderTension',
      ...Object.fromEntries(CARDIO_VARIABLE_KEYS.map((k) => [k, k])),
    };

    const field = fieldToKey[varKey];
    if (field) {
      setSeries(prev => prev.map(s => ({ ...s, [field]: undefined })));
    }
  };
  
  const addVariable = (varKey: string) => {
    setVisibleVariables(prev => [...prev, varKey]);
  };
  
  const hiddenVariables = DYNAMIC_VARIABLES.filter(v => !visibleVariables.includes(v.key));

  // Update series when phase exercises change (for circuit methods and Death By)
  useEffect(() => {
    if ((isCircuitMethod || isEmom || isTabata || isDeathBy) && droppedPhaseExercises) {
      setSeries(prev => prev.map((s, idx) => {
        const phaseExercise = droppedPhaseExercises[idx];
        if (phaseExercise) {
          return {
            ...s,
            phaseExerciseId: phaseExercise.exerciseId,
            phaseExerciseName: phaseExercise.exerciseName,
            exerciseId: phaseExercise.exerciseId,
            exerciseName: phaseExercise.exerciseName,
          };
        } else if (s.phaseExerciseId) {
          const { phaseExerciseId, phaseExerciseName, exerciseId, exerciseName, ...rest } = s;
          return rest;
        }
        return s;
      }));
    }
  }, [droppedPhaseExercises, method, isCircuitMethod, isEmom, isTabata, isDeathBy]);
  
  // Update EMOM series count when configuration changes
  useEffect(() => {
    if (isEmom) {
      const slotsNeeded = emomConfig.mode === 'circuit' 
        ? Math.floor(emomConfig.totalMinutes / emomConfig.intervalMinutes) * emomConfig.exercisesPerInterval
        : Math.floor(emomConfig.totalMinutes / emomConfig.intervalMinutes);
      
      // Adjust series array to match needed slots
      if (slotsNeeded > series.length) {
        const newSlots = Array(slotsNeeded - series.length).fill(null).map(() => ({ reps: "10", isActive: true }));
        setSeries(prev => [...prev, ...newSlots]);
      } else if (slotsNeeded < series.length && slotsNeeded > 0) {
        setSeries(prev => prev.slice(0, slotsNeeded));
      }
    }
  }, [isEmom, emomConfig.totalMinutes, emomConfig.intervalMinutes, emomConfig.mode, emomConfig.exercisesPerInterval]);

  const updateSeries = (idx: number, field: keyof DropSetSeries, value: string | number | boolean | undefined) => {
    // MAX reps auto-locks RPE=10 / RIR=0 → ces variables doivent être visibles
    // dans l'éditeur (sinon elles apparaissent sur la carte validée sans être
    // modifiables/consultables lors de la modification de l'exercice).
    if (field === 'reps' && value === 'MAX') {
      setVisibleVariables(prev => {
        const next = [...prev];
        if (!next.includes('rpe')) next.push('rpe');
        if (!next.includes('rir')) next.push('rir');
        return next;
      });
    }
    setSeries(prev => {
      const newSeries = [...prev];
      newSeries[idx] = { ...newSeries[idx], [field]: value } as DropSetSeries;
      
      // MAX reps rule: auto-lock RPE=10, RIR=0
      if (field === 'reps' && value === 'MAX') {
        newSeries[idx] = { ...newSeries[idx], rpe: 10, rir: 0 };
      }
      // Deactivating MAX: restore editable RPE/RIR (clear forced values)
      if (field === 'reps' && prev[idx].reps === 'MAX' && value !== 'MAX') {
        newSeries[idx] = { ...newSeries[idx], rpe: undefined, rir: undefined };
      }
      
      // Prevent manual RPE/RIR change when MAX is active
      if ((field === 'rpe' || field === 'rir') && newSeries[idx].reps === 'MAX') {
        newSeries[idx] = { ...newSeries[idx], rpe: 10, rir: 0 };
      }
      
      return newSeries;
    });
  };

  const togglePhaseActive = (idx: number) => {
    const newSeries = [...series];
    newSeries[idx] = { ...newSeries[idx], isActive: !newSeries[idx].isActive };
    setSeries(newSeries);
  };

  const addSeries = () => {
    let newItem: DropSetSeries;
    switch (method) {
      case "drop_set":
        newItem = { reps: "5", rpe: 9, reductionType: 'percentage', reductionValue: 10, isActive: true };
        break;
      case "rest_pause":
        newItem = { reps: "", isActive: true };
        break;
      case "five_by_five":
        newItem = { reps: "5", isActive: true };
        if (visibleVariables.includes('percentage')) newItem.percentage = 80;
        break;
      case "isometric_overcoming":
        newItem = { reps: "1", angle: 90, timeUnderTension: 6, rpe: 10, isActive: true };
        break;
      case "isometric_yielding":
        newItem = { reps: "1", angle: 90, timeUnderTension: 20, load: 50, rpe: 8, isActive: true };
        break;
      // CrossFit methods
      case "amrap":
      case "for_time":
      case "circuit":
        newItem = { reps: "10", isActive: true };
        break;
      case "emom":
        newItem = { reps: "10", isActive: true };
        break;
      default:
        // Ne jamais injecter de %1RM si la variable n'est pas affichée/souhaitée
        newItem = { reps: "5", isActive: true };
        if (visibleVariables.includes('percentage')) newItem.percentage = 75;
    }
    setSeries([...series, newItem]);
  };

  const removeSeries = (idx: number) => {
    if (series.length > 1) {
      setSeries(series.filter((_, i) => i !== idx));
    }
  };

  // Supprime des séries toute variable non visible dans l'éditeur, afin que la
  // carte validée n'affiche jamais une variable que le coach n'a pas voulue.
  const sanitizeSeries = (list: DropSetSeries[]): DropSetSeries[] => {
    const optionalKeys: Array<keyof DropSetSeries> = [
      'percentage', 'load', 'tempo', 'rpe', 'rir', 'angle', 'timeUnderTension',
      ...CARDIO_VARIABLE_KEYS,
    ] as Array<keyof DropSetSeries>;

    return list.map((s) => {
      const copy: any = { ...s };
      for (const key of optionalKeys) {
        if (!visibleVariables.includes(key as string)) delete copy[key];
      }
      return copy as DropSetSeries;
    });
  };

  const handleConfirm = () => {
    const activeSeries = sanitizeSeries(series);

    
    // CRITICAL: Preserve ALL variables exactly as configured in the UI
    // The series already contain: reps, percentage, load, tempo, rpe, pauseSeconds, etc.
    // We pass them through without any transformation or filtering
    onConfirm({
      series: activeSeries,
      tempo: tempo || undefined,
      targetRpe,
      setsCount: method === "drop_set" ? setsCount : undefined,
      // CrossFit specific
      timeCap: ['amrap', 'for_time'].includes(method) ? timeCap : undefined,
      tabataConfig: isTabata ? tabataConfig : undefined,
      totalMinutes: isEmom ? emomConfig.totalMinutes : undefined,
      repsPerRound: method === 'circuit' ? rounds : undefined,
      // EMOM specific
      emomConfig: isEmom ? emomConfig : undefined,
      // Death By specific
      deathByConfig: isDeathBy ? deathByConfig : undefined,
      // Circuit recovery strategy
      circuitRecovery: method === 'circuit' ? circuitRecovery : undefined,
      // CRITICAL: Pass which variables are visible so they can be preserved
      visibleVariables: visibleVariables,
      // Rest-Pause: pass the ACTUAL config built by the user
      restPauseConfig: isRestPause ? restPauseConfig : undefined,
      // Rest between series for classic strength methods
      restSeconds: (!isCircuitMethod && !isEmom && !isTabata && !isDeathBy) ? restSeconds : undefined,
    });
    
    // Passer en mode lecture seule après validation
    setIsEditing(false);
    setIsValidated(true);
  };

  const slotId = `method-config-slot-${dayId}`;
  const isSuperPletnev = false; // Method removed
  
  // For CrossFit methods, check if exercises are dropped in slots
  const hasCircuitExercises = isCircuitMethod && Object.values(droppedPhaseExercises).some(e => e !== null);
  
  // For EMOM, check if at least one exercise is dropped
  const hasEmomExercises = isEmom && Object.values(droppedPhaseExercises).some(e => e !== null);
  
  // For Tabata, check if at least one exercise is dropped
  const hasTabataExercises = isTabata && Object.values(droppedPhaseExercises).some(e => e !== null);
  
  // For Super Pletnev, consider complete if general exercise is dropped OR at least one active phase has exercise
  const activePhasesCount = series.filter(s => s.isActive !== false).length;
  // For Death By, check if at least one exercise is dropped
  const hasDeathByExercises = isDeathBy && Object.values(droppedPhaseExercises).some(e => e !== null);
  
  const isComplete = isSuperPletnev 
    ? (activePhasesCount >= 1 && (!!droppedExercise || Object.entries(droppedPhaseExercises).some(([idx, e]) => e !== null && series[parseInt(idx)]?.isActive !== false)))
    : isCircuitMethod
    ? hasCircuitExercises
    : isEmom
    ? hasEmomExercises
    : isTabata
    ? hasTabataExercises
    : isDeathBy
    ? hasDeathByExercises
    : !!droppedExercise;
  
  // Helper to get EMOM interval label
  const getEmomIntervalLabel = () => {
    if (emomConfig.intervalMinutes === 1) return "EMOM";
    return `E${emomConfig.intervalMinutes}MOM`;
  };
  
  // Helper to get slot label for EMOM
  const getEmomSlotLabel = (slotIndex: number) => {
    if (emomConfig.mode === 'single') {
      // Single exercise per interval
      const intervalNum = slotIndex + 1;
      if (emomConfig.intervalMinutes === 1) {
        return `Minute ${intervalNum}`;
      } else {
        const startMin = slotIndex * emomConfig.intervalMinutes + 1;
        const endMin = (slotIndex + 1) * emomConfig.intervalMinutes;
        return `Minutes ${startMin}-${endMin}`;
      }
    } else {
      // Circuit mode: multiple exercises per interval
      const intervalIndex = Math.floor(slotIndex / emomConfig.exercisesPerInterval);
      const exerciseInInterval = (slotIndex % emomConfig.exercisesPerInterval) + 1;
      
      if (emomConfig.intervalMinutes === 1) {
        return `Minute ${intervalIndex + 1} - Exercice ${exerciseInInterval}`;
      } else {
        const startMin = intervalIndex * emomConfig.intervalMinutes + 1;
        const endMin = (intervalIndex + 1) * emomConfig.intervalMinutes;
        return `Min. ${startMin}-${endMin} - Ex. ${exerciseInInterval}`;
      }
    }
  };

  return (
    <div className={cn(
      "p-2 rounded-lg border-2 bg-background/50 overflow-visible",
      config.borderColor
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn("text-white flex-shrink-0", config.color)}>{config.label}</Badge>
            <span className="text-xs text-muted-foreground">{config.description}</span>
          </div>
        </div>
        <MethodActionButtons
          isEditing={isEditing}
          onValidate={handleConfirm}
          onEdit={() => setIsEditing(true)}
          onCancel={onCancel}
          isValid={isComplete}
          methodColor={cn(config.color, "hover:opacity-90")}
          className="flex-shrink-0"
        />
      </div>

      {/* Contenu de la méthode - verrouillé en mode lecture seule */}
      <div className={cn(!isEditing && "pointer-events-none opacity-70")}>
      {/* Exercise drop slot(s) */}
      <div className="mb-1 space-y-1.5">
        {isSuperPletnev ? (
          <>
            {/* General exercise slot */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">
                Exercice général (appliqué à toutes les phases actives)
              </Label>
              <ExerciseDropSlot
                slotId={slotId}
                exercise={droppedExercise}
                config={config}
                onRemove={onExerciseRemove}
                label="Exercice pour toutes les phases"
              />
            </div>
            
            {/* Phase-specific exercise slots */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">
                Ou exercices spécifiques par phase (cliquez sur ✕ pour désactiver une phase)
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {series.map((s, idx) => (
                  <PhaseExerciseSlot
                    key={idx}
                    slotId={`method-phase-slot-${dayId}-${idx}`}
                    phaseIndex={idx}
                    exercise={droppedPhaseExercises[idx]}
                    generalExercise={droppedExercise}
                    config={config}
                    contractionType={s.contractionType || 'concentric'}
                    isActive={s.isActive !== false}
                    onRemove={() => onPhaseExerciseRemove?.(idx)}
                    onToggleActive={() => togglePhaseActive(idx)}
                  />
                ))}
              </div>
              {/* Add phase button for Super Pletnev */}
              {series.length < 6 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSeries}
                  className="mt-2 h-7 text-xs w-full"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Ajouter une phase
                </Button>
              )}
            </div>
          </>
        ) : isEmom ? (
          <>
            {/* EMOM Configuration Header */}
            <div className="space-y-1.5">
              {/* Interval Type Selection */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground block">Type d'intervalle</Label>
                <div className="flex flex-wrap gap-2 items-center">
                  {Array.from({ length: Math.max(5, emomConfig.intervalMinutes) }, (_, i) => i + 1).map(interval => (
                    <Button
                      key={interval}
                      type="button"
                      variant={emomConfig.intervalMinutes === interval ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        const newInterval = interval;
                        const currentIntervals = Math.floor(emomConfig.totalMinutes / emomConfig.intervalMinutes);
                        setEmomConfig(prev => ({ 
                          ...prev, 
                          intervalMinutes: newInterval,
                          totalMinutes: currentIntervals * newInterval
                        }));
                      }}
                      className={cn(
                        "h-8 text-xs",
                        emomConfig.intervalMinutes === interval && config.color
                      )}
                    >
                      {interval === 1 ? "EMOM" : `E${interval}MOM`}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newInterval = Math.max(5, emomConfig.intervalMinutes) + 1;
                      const currentIntervals = Math.floor(emomConfig.totalMinutes / emomConfig.intervalMinutes);
                      setEmomConfig(prev => ({ 
                        ...prev, 
                        intervalMinutes: newInterval,
                        totalMinutes: currentIntervals * newInterval
                      }));
                    }}
                    className="h-8 w-8 p-0 text-xs"
                    title="Ajouter un intervalle plus long"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {emomConfig.intervalMinutes === 1 
                    ? "Toutes les minutes" 
                    : `Toutes les ${emomConfig.intervalMinutes} minutes`}
                </p>
              </div>
              
              {/* Mode Selection */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground block">Mode</Label>
                <div className="flex flex-col sm:flex-row gap-2">

                  <Button
                    type="button"
                    variant={emomConfig.mode === 'single' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEmomConfig(prev => ({ ...prev, mode: 'single', exercisesPerInterval: 1 }))}
                    className={cn(
                      "h-auto min-h-8 py-1.5 text-xs flex-1 whitespace-normal text-center leading-tight",

                      emomConfig.mode === 'single' && config.color
                    )}
                  >
                    1 exercice / intervalle
                  </Button>
                  <Button
                    type="button"
                    variant={emomConfig.mode === 'circuit' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEmomConfig(prev => ({ ...prev, mode: 'circuit', exercisesPerInterval: 2 }))}
                    className={cn(
                      "h-auto min-h-8 py-1.5 text-xs flex-1 whitespace-normal text-center leading-tight",

                      emomConfig.mode === 'circuit' && config.color
                    )}
                  >
                    Plusieurs exercices enchaînés / intervalle
                  </Button>
                </div>
              </div>
              
               {/* Circuit mode: exercises per interval - dynamic add/remove */}
               {emomConfig.mode === 'circuit' && (
                 <div className="flex items-center gap-2">
                   <Label className="text-xs text-muted-foreground">
                     {emomConfig.exercisesPerInterval} exercice{emomConfig.exercisesPerInterval > 1 ? 's' : ''} / intervalle
                   </Label>
                   <div className="flex items-center gap-1">
                     <Button
                       type="button"
                       variant="outline"
                       size="sm"
                       className="h-7 w-7 p-0"
                       onClick={() => setEmomConfig(prev => ({ 
                         ...prev, 
                         exercisesPerInterval: Math.max(2, prev.exercisesPerInterval - 1)
                       }))}
                       disabled={emomConfig.exercisesPerInterval <= 2}
                     >
                       <X className="h-3 w-3" />
                     </Button>
                     <Button
                       type="button"
                       variant="outline"
                       size="sm"
                       className={cn("h-7 px-2 text-xs gap-1", config.textColor)}
                       onClick={() => setEmomConfig(prev => ({ 
                         ...prev, 
                         exercisesPerInterval: prev.exercisesPerInterval + 1
                       }))}
                     >
                       <Plus className="h-3 w-3" />
                       Ajouter un exercice
                     </Button>
                   </div>
                 </div>
               )}
              
              {/* Duration Settings - Linked inputs */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground block">Durée</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Total Duration */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Durée totale</Label>
                    <Input
                      type="number"
                      value={emomConfig.totalMinutes}
                      onChange={(e) => {
                        const newTotal = Math.max(emomConfig.intervalMinutes, parseInt(e.target.value) || emomConfig.intervalMinutes);
                        // Round to nearest valid interval
                        const roundedTotal = Math.round(newTotal / emomConfig.intervalMinutes) * emomConfig.intervalMinutes;
                        setEmomConfig(prev => ({ 
                          ...prev, 
                          totalMinutes: Math.max(emomConfig.intervalMinutes, roundedTotal)
                        }));
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onFocus={(e) => e.target.select()}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="h-8 w-20 text-sm"
                      min={emomConfig.intervalMinutes}
                      max={120}
                      step={emomConfig.intervalMinutes}
                    />
                    <span className="text-xs text-muted-foreground">min</span>
                  </div>
                  
                  <span className="text-xs text-muted-foreground">ou</span>
                  
                  {/* Number of Intervals */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Nb intervalles</Label>
                    <Input
                      type="number"
                      value={Math.floor(emomConfig.totalMinutes / emomConfig.intervalMinutes)}
                      onChange={(e) => {
                        const intervals = Math.max(1, parseInt(e.target.value) || 1);
                        setEmomConfig(prev => ({ 
                          ...prev, 
                          totalMinutes: intervals * prev.intervalMinutes
                        }));
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onFocus={(e) => e.target.select()}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="h-8 w-20 text-sm"
                      min={1}
                      max={30}
                    />
                  </div>
                </div>
              </div>
              
              {/* Summary */}
              <div className={cn("text-xs p-2 rounded", config.bgActive, config.textColor)}>
                {getEmomIntervalLabel()} • {Math.floor(emomConfig.totalMinutes / emomConfig.intervalMinutes)} intervalles × {emomConfig.intervalMinutes}min = {emomConfig.totalMinutes}min
                {emomConfig.mode === 'circuit' && ` • ${emomConfig.exercisesPerInterval} exercices/intervalle`}
              </div>
            </div>
            
            {/* Exercise Slots */}
            <div className="mt-2">
              {/* Apply to all intervals button - prominent position */}
              {(() => {
                const exercisesPerInterval = emomConfig.mode === 'circuit' ? emomConfig.exercisesPerInterval : 1;
                const totalIntervals = Math.floor(emomConfig.totalMinutes / emomConfig.intervalMinutes);
                const firstIntervalExercises = Array.from({ length: exercisesPerInterval }, (_, i) => droppedPhaseExercises[i]).filter(Boolean);
                const hasFirstIntervalComplete = firstIntervalExercises.length === exercisesPerInterval;
                
                if (hasFirstIntervalComplete && totalIntervals > 1 && onApplyToAllIntervals) {
                  return (
                    <div className={cn(
                      "mb-2 p-2 rounded-lg border-2 border-dashed",
                      config.borderColor,
                      config.bgActive
                    )}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <CheckCheck className={cn("h-5 w-5", config.textColor)} />
                          <span className={cn("text-sm font-medium", config.textColor)}>
                            Premier intervalle configuré !
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={() => {
                              const newExercises: Record<number, { exerciseId: string; exerciseName: string } | null> = { ...droppedPhaseExercises };
                              const newSeriesData = [...series];
                              
                              const totalSlots = totalIntervals * exercisesPerInterval;
                              while (newSeriesData.length < totalSlots) {
                                newSeriesData.push({ reps: "10", isActive: true });
                              }
                              
                              for (let intervalIdx = 1; intervalIdx < totalIntervals; intervalIdx++) {
                                for (let exIdx = 0; exIdx < exercisesPerInterval; exIdx++) {
                                  const sourceSlotIdx = exIdx;
                                  const targetSlotIdx = intervalIdx * exercisesPerInterval + exIdx;
                                  
                                  const sourceExercise = droppedPhaseExercises[sourceSlotIdx];
                                  if (sourceExercise) {
                                    newExercises[targetSlotIdx] = { ...sourceExercise };
                                  }
                                  
                                  if (series[sourceSlotIdx]) {
                                    newSeriesData[targetSlotIdx] = { 
                                      ...newSeriesData[targetSlotIdx],
                                      reps: series[sourceSlotIdx].reps,
                                      load: series[sourceSlotIdx].load,
                                      percentage: series[sourceSlotIdx].percentage,
                                      tempo: series[sourceSlotIdx].tempo,
                                      rpe: series[sourceSlotIdx].rpe,
                                      rir: series[sourceSlotIdx].rir,
                                      angle: series[sourceSlotIdx].angle,
                                      timeUnderTension: series[sourceSlotIdx].timeUnderTension,
                                      notes: series[sourceSlotIdx].notes,
                                    };
                                  }
                                }
                              }
                              
                              setSeries(newSeriesData);
                              onApplyToAllIntervals(newExercises, newSeriesData, exercisesPerInterval);
                            }}
                            className={cn("gap-2", config.color, "text-white hover:opacity-90")}
                          >
                            <Copy className="h-4 w-4" />
                            Appliquer aux {totalIntervals} intervalles
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newSeriesData = [...series];
                              
                              const totalSlots = totalIntervals * exercisesPerInterval;
                              while (newSeriesData.length < totalSlots) {
                                newSeriesData.push({ reps: "10", isActive: true });
                              }
                              
                              for (let intervalIdx = 1; intervalIdx < totalIntervals; intervalIdx++) {
                                for (let exIdx = 0; exIdx < exercisesPerInterval; exIdx++) {
                                  const sourceSlotIdx = exIdx;
                                  const targetSlotIdx = intervalIdx * exercisesPerInterval + exIdx;
                                  
                                  if (series[sourceSlotIdx]) {
                                    newSeriesData[targetSlotIdx] = { 
                                      ...newSeriesData[targetSlotIdx],
                                      reps: series[sourceSlotIdx].reps,
                                      load: series[sourceSlotIdx].load,
                                      percentage: series[sourceSlotIdx].percentage,
                                      tempo: series[sourceSlotIdx].tempo,
                                      rpe: series[sourceSlotIdx].rpe,
                                      rir: series[sourceSlotIdx].rir,
                                      angle: series[sourceSlotIdx].angle,
                                      timeUnderTension: series[sourceSlotIdx].timeUnderTension,
                                      notes: series[sourceSlotIdx].notes,
                                    };
                                  }
                                }
                              }
                              
                              setSeries(newSeriesData);
                              toast.success("Variables copiées vers toutes les intervalles !");
                            }}
                            className="gap-2 text-xs"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            Appliquer les variables aux {totalIntervals} intervalles
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Copiez les exercices et/ou les variables du premier intervalle vers tous les autres
                      </p>
                    </div>
                  );
                }
                return null;
              })()}
              
              {/* Clear all exercises button */}
              {(() => {
                const hasAnyExercise = Object.values(droppedPhaseExercises).some(e => e !== null);
                if (hasAnyExercise && onClearAllPhaseExercises) {
                  return (
                    <div className="mb-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onClearAllPhaseExercises}
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Supprimer tous les exercices
                      </Button>
                    </div>
                  );
                }
                return null;
              })()}
              
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-muted-foreground">
                  Glissez les exercices dans les slots correspondants
                </Label>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {series.map((s, idx) => {
                  // Calculate interval grouping for circuit mode
                  const isFirstInInterval = emomConfig.mode === 'circuit' 
                    ? idx % emomConfig.exercisesPerInterval === 0 
                    : true;
                  const intervalIndex = emomConfig.mode === 'circuit'
                    ? Math.floor(idx / emomConfig.exercisesPerInterval)
                    : idx;
                  
                  // Check if this slot is part of first interval
                  const isFirstInterval = intervalIndex === 0;
                  const exercisesPerInterval = emomConfig.mode === 'circuit' ? emomConfig.exercisesPerInterval : 1;
                  
                  // Check if all exercises in first interval are filled
                  const firstIntervalComplete = Array.from({ length: exercisesPerInterval }, (_, i) => droppedPhaseExercises[i]).filter(Boolean).length === exercisesPerInterval;
                  
                  return (
                    <div key={idx}>
                      {/* Interval separator for circuit mode */}
                      {emomConfig.mode === 'circuit' && isFirstInInterval && idx > 0 && (
                        <div className="flex items-center gap-2 my-3">
                          <div className="flex-1 h-px bg-border" />
                          <span className={cn("text-xs font-medium px-2", config.textColor)}>
                            {emomConfig.intervalMinutes === 1 
                              ? `Minute ${intervalIndex + 1}`
                              : `Minutes ${intervalIndex * emomConfig.intervalMinutes + 1}-${(intervalIndex + 1) * emomConfig.intervalMinutes}`}
                          </span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      )}
                      
                      {/* First interval header for circuit mode */}
                      {emomConfig.mode === 'circuit' && isFirstInInterval && idx === 0 && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className={cn("text-xs font-medium", config.textColor)}>
                            {emomConfig.intervalMinutes === 1 
                              ? "Minute 1"
                              : `Minutes 1-${emomConfig.intervalMinutes}`}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-start gap-2">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 mt-1",
                            config.color,
                            // Highlight first interval as the template
                            isFirstInterval && "ring-2 ring-offset-2 ring-offset-background ring-primary"
                          )}
                        >
                          {emomConfig.mode === 'single' ? intervalIndex + 1 : (idx % emomConfig.exercisesPerInterval) + 1}
                        </div>
                        <div className="flex-1">
                          <CircuitExerciseSlot
                            slotId={`method-phase-slot-${dayId}-${idx}`}
                            exercise={droppedPhaseExercises[idx]}
                            config={config}
                            onRemove={() => onPhaseExerciseRemove?.(idx)}
                          onPick={onPhaseExerciseAdd ? (p) => onPhaseExerciseAdd(idx, p) : undefined}
                            placeholder={getEmomSlotLabel(idx)}
                            seriesData={s}
                            onUpdateSeries={(field, value) => updateSeries(idx, field, value)}
                            showExpandedVars={true}
                            visibleVariables={visibleVariables}
                            onAddVariable={addVariable}
                            onRemoveVariable={removeVariable}
                            hiddenVariables={hiddenVariables}
                          />
                        </div>
                      </div>
                      
                      {/* Rest indicator - show after each interval's exercises */}
                      {(emomConfig.mode === 'single' || 
                        (emomConfig.mode === 'circuit' && (idx + 1) % emomConfig.exercisesPerInterval === 0)) && (
                        <div className="ml-10 mt-1 mb-2">
                          <span className="text-xs text-muted-foreground italic">
                            ↳ Repos jusqu'au prochain {getEmomIntervalLabel()} (temps restant de l'intervalle)
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : isCircuitMethod ? (
          <>
            {/* Circuit method: multiple exercise slots with training variables */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">
                Exercices du {method === 'amrap' ? 'AMRAP' : method === 'for_time' ? 'For Time' : 'circuit'}
              </Label>
              <div className="space-y-2">
                {series.map((s, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-start gap-2">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 mt-1",
                          config.color
                        )}
                      >
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <CircuitExerciseSlot
                          slotId={`method-phase-slot-${dayId}-${idx}`}
                          exercise={droppedPhaseExercises[idx]}
                          config={config}
                          onRemove={() => onPhaseExerciseRemove?.(idx)}
                          onPick={onPhaseExerciseAdd ? (p) => onPhaseExerciseAdd(idx, p) : undefined}
                          placeholder={`Exercice ${idx + 1}`}
                          seriesData={s}
                          onUpdateSeries={(field, value) => updateSeries(idx, field, value)}
                          showExpandedVars={true}
                          visibleVariables={visibleVariables}
                          onAddVariable={addVariable}
                          onRemoveVariable={removeVariable}
                          hiddenVariables={hiddenVariables}
                          showPerExerciseRest={method === 'circuit' && circuitRecovery.strategy === 'between_exercises'}
                          restSeconds={circuitRecovery.perExerciseRestSeconds?.[idx]}
                          onRestChange={(val) => setCircuitRecovery(prev => ({
                            ...prev,
                            perExerciseRestSeconds: { ...prev.perExerciseRestSeconds, [idx]: val },
                          }))}
                        />
                      </div>
                      {series.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive mt-1"
                          onClick={() => removeSeries(idx)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {series.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSeries}
                  className="mt-2 h-7 text-xs w-full"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Ajouter un exercice
                </Button>
              )}
            </div>

            {/* Time/rounds config for circuit methods */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/30">
              {method === 'amrap' && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Temps de l'AMRAP</Label>
                  <Input
                    type="number"
                    value={timeCap}
                    onChange={(e) => setTimeCap(parseInt(e.target.value) || 10)}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onFocus={(e) => e.target.select()}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="h-8 w-20 text-sm"
                    min={1}
                    max={60}
                  />
                  <span className="text-xs text-muted-foreground">min</span>
                </div>
              )}
              {method === 'for_time' && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Time Cap</Label>
                  <Input
                    type="number"
                    value={timeCap}
                    onChange={(e) => setTimeCap(parseInt(e.target.value) || 10)}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onFocus={(e) => e.target.select()}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="h-8 w-20 text-sm"
                    min={1}
                    max={60}
                  />
                  <span className="text-xs text-muted-foreground">min</span>
                </div>
              )}
              {method === 'circuit' && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Tours</Label>
                  <Input
                    type="number"
                    value={rounds}
                    onChange={(e) => setRounds(parseInt(e.target.value) || 3)}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onFocus={(e) => e.target.select()}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="h-8 w-20 text-sm"
                    min={1}
                    max={20}
                  />
                </div>
              )}
            </div>

            {/* Circuit Recovery Strategy - mutually exclusive */}
            {method === 'circuit' && (
              <div className="pt-2 border-t border-border/30 space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Stratégie de récupération</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={circuitRecovery.strategy === 'after_circuit' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCircuitRecovery(prev => ({ 
                      ...prev, 
                      strategy: 'after_circuit',
                      globalRestSeconds: prev.globalRestSeconds || 90,
                      perExerciseRestSeconds: {},
                    }))}
                    className={cn(
                      "h-8 text-xs flex-1",
                      circuitRecovery.strategy === 'after_circuit' && config.color
                    )}
                  >
                    Repos après le circuit
                  </Button>
                  <Button
                    type="button"
                    variant={circuitRecovery.strategy === 'between_exercises' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCircuitRecovery(prev => ({ 
                      ...prev, 
                      strategy: 'between_exercises',
                      globalRestSeconds: undefined,
                    }))}
                    className={cn(
                      "h-8 text-xs flex-1",
                      circuitRecovery.strategy === 'between_exercises' && config.color
                    )}
                  >
                    Repos entre les exercices
                  </Button>
                </div>

                {/* Strategy description */}
                <p className="text-[10px] text-muted-foreground italic">
                  {circuitRecovery.strategy === 'after_circuit'
                    ? "Les exercices s'enchaînent sans repos. Une récupération globale est appliquée après chaque tour."
                    : "Chaque exercice est suivi de sa propre récupération. Pas de repos global après le circuit."}
                </p>

                {/* Global rest field (after_circuit strategy) */}
                {circuitRecovery.strategy === 'after_circuit' && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Repos après le circuit</Label>
                    <TimeInput
                      value={circuitRecovery.globalRestSeconds || 0}
                      onChange={(val) => setCircuitRecovery(prev => ({ ...prev, globalRestSeconds: val }))}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        ) : isTabata ? (
          <>
            {/* Tabata: exercises with time config */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">
                Exercice(s) du Tabata
              </Label>
              <div className="space-y-2">
                {series.map((s, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 mt-1",
                        config.color
                      )}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <CircuitExerciseSlot
                        slotId={`method-phase-slot-${dayId}-${idx}`}
                        exercise={droppedPhaseExercises[idx]}
                        config={config}
                        onRemove={() => onPhaseExerciseRemove?.(idx)}
                          onPick={onPhaseExerciseAdd ? (p) => onPhaseExerciseAdd(idx, p) : undefined}
                        placeholder={`Exercice ${idx + 1}`}
                        seriesData={s}
                        onUpdateSeries={(field, value) => updateSeries(idx, field, value)}
                        showExpandedVars={true}
                        visibleVariables={visibleVariables}
                        onAddVariable={addVariable}
                        onRemoveVariable={removeVariable}
                        hiddenVariables={hiddenVariables}
                      />
                    </div>
                    {series.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive mt-1"
                        onClick={() => removeSeries(idx)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {series.length < 4 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSeries}
                  className="mt-2 h-7 text-xs w-full"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Ajouter un exercice
                </Button>
              )}
            </div>
            
            {/* Tabata timing — configurable */}
            <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-border/30">
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Travail</Label>
                <TimeInput
                  value={tabataConfig.workSeconds}
                  onChange={(sec) => setTabataConfig({ ...tabataConfig, workSeconds: Math.max(1, sec) })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Repos</Label>
                <TimeInput
                  value={tabataConfig.restSeconds}
                  onChange={(sec) => setTabataConfig({ ...tabataConfig, restSeconds: Math.max(0, sec) })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Rounds</Label>
                <NumericInput
                  value={tabataConfig.rounds}
                  onChange={(val) => setTabataConfig({ ...tabataConfig, rounds: Math.max(1, parseInt(val) || 1) })}
                  className="h-8"
                  placeholder="8"
                  minChars={2}
                  maxChars={3}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setTabataConfig({ workSeconds: 20, restSeconds: 10, rounds: 8 })}
                title="Revenir au protocole Tabata standard (20/10 × 8)"
              >
                Protocole standard 20/10 × 8
              </Button>
            </div>
            {(() => {
              const cycle = tabataConfig.workSeconds + tabataConfig.restSeconds;
              const total = cycle * tabataConfig.rounds;
              const fmt = (sec: number) => {
                const m = Math.floor(sec / 60);
                const r = sec % 60;
                return m > 0 ? `${m}min${r > 0 ? ` ${r}s` : ""}` : `${r}s`;
              };
              return (
                <div className={cn("text-xs p-2 rounded", config.bgActive, config.textColor)}>
                  {tabataConfig.workSeconds}s effort / {tabataConfig.restSeconds}s repos × {tabataConfig.rounds} rounds
                  {" = "}<span className="font-bold">{fmt(total)}</span> au total ({fmt(cycle)} par round)
                  {series.length > 1 && ` • ${series.length} exercices en alternance`}
                </div>
              );
            })()}
          </>
        ) : isDeathBy ? (
          <>
            {/* Death By: configuration and exercise slots with training variables */}
            <div className="space-y-2">
              {/* Configuration */}
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Reps de départ</Label>
                    <NumericInput
                      value={deathByConfig.startReps}
                      onChange={(val) => setDeathByConfig(prev => ({ ...prev, startReps: Math.max(1, parseInt(val) || 1) }))}
                      className="h-8 text-sm"
                      placeholder="Ex: 2"
                      minChars={3}
                      maxChars={4}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Incrément / min</Label>
                    <NumericInput
                      value={deathByConfig.incrementReps}
                      onChange={(val) => setDeathByConfig(prev => ({ ...prev, incrementReps: Math.max(1, parseInt(val) || 1) }))}
                      className="h-8 text-sm"
                      placeholder="Ex: 1"
                      minChars={3}
                      maxChars={4}
                    />
                  </div>
                </div>
                
                {/* Preview */}
                <div className={cn("text-xs p-2 rounded", config.bgActive, config.textColor)}>
                  Min 1: {deathByConfig.startReps} rep{deathByConfig.startReps > 1 ? 's' : ''} → 
                  Min 2: {deathByConfig.startReps + deathByConfig.incrementReps} reps → 
                  Min 3: {deathByConfig.startReps + deathByConfig.incrementReps * 2} reps... jusqu'à l'échec
                </div>
              </div>
              
              {/* Exercise slots */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">
                  Exercice(s) du Death By
                </Label>
                <div className="space-y-2">
                  {series.map((s, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 mt-1",
                          config.color
                        )}
                      >
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <CircuitExerciseSlot
                          slotId={`method-phase-slot-${dayId}-${idx}`}
                          exercise={droppedPhaseExercises[idx]}
                          config={config}
                          onRemove={() => onPhaseExerciseRemove?.(idx)}
                          onPick={onPhaseExerciseAdd ? (p) => onPhaseExerciseAdd(idx, p) : undefined}
                          placeholder={`Exercice ${idx + 1}`}
                          seriesData={s}
                          onUpdateSeries={(field, value) => updateSeries(idx, field, value)}
                          showExpandedVars={true}
                          visibleVariables={visibleVariables}
                          onAddVariable={addVariable}
                          onRemoveVariable={removeVariable}
                          hiddenVariables={hiddenVariables}
                        />
                      </div>
                      {series.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive mt-1"
                          onClick={() => removeSeries(idx)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {series.length < 4 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSeries}
                    className="mt-2 h-7 text-xs w-full"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Ajouter un exercice
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Exercice</Label>
            <ExerciseDropSlot
              slotId={slotId}
              exercise={droppedExercise}
              config={config}
              onRemove={onExerciseRemove}
            />
          </div>
        )}
      </div>

      {/* Drop Set: nombre de séries (combien de fois répéter la séquence de drops) */}
      {method === "drop_set" && (
        <div className="flex items-center gap-2">
          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="text-xs text-muted-foreground">Séries</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={setsCount}
            onChange={(e) => setSetsCount(parseInt(e.target.value) || 1)}
            className="h-7 w-16 text-xs px-1.5"
            placeholder="3"
          />
          <span className="text-[10px] text-muted-foreground">× la séquence de drops</span>
        </div>
      )}

      {/* Series configuration - hide for CrossFit methods that handle it differently */}
      {/* Rest-Pause: dedicated UI instead of generic series */}
      {isRestPause && (
        <RestPauseCreationUI
          config={restPauseConfig}
          onChange={setRestPauseConfig}
        />
      )}

      {!isCircuitMethod && !isEmom && !isTabata && !isDeathBy && !isRestPause && (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className={cn("text-sm font-medium", config.textColor)}>
            Configuration des {isSuperPletnev ? "phases" : "séries"}
          </Label>
          {!isSuperPletnev && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addSeries}
              className="h-7 text-xs"
              disabled={(method === "drop_set" && series.length >= 5)}
            >
              <Plus className="h-3 w-3 mr-1" />
              {config.seriesLabel}
            </Button>
          )}
        </div>

        {/* Series slots */}
        <div className="space-y-2">
          {series.map((s, idx) => {
            // Skip rendering inactive phases in config section for Super Pletnev
            if (isSuperPletnev && s.isActive === false) {
              return null;
            }
            
            const showPause = config.showPause && idx < series.length - 1;
            const isDropSet = method === "drop_set";
            const isFirstDrop = isDropSet && idx === 0;
            const showDropReduction = isDropSet && idx > 0;
            const isDropSetShowAllVars = isDropSet; // All drops show all variables
            
            const getContractionLabel = (type?: string) => {
              return CONTRACTION_TYPES.find(ct => ct.value === type)?.label || type || '';
            };
            
            const showTUTForPhase = isSuperPletnev && s.contractionType === 'isometric';
            const showAngleForPhase = isSuperPletnev && s.contractionType === 'isometric';
            
            // Active phase number for display (count only active phases)
            const activePhaseNumber = isSuperPletnev 
              ? series.slice(0, idx + 1).filter(ps => ps.isActive !== false).length
              : idx + 1;
            
            return (
              <div
                key={idx}
                className={cn(
                  "relative p-2 pt-4 rounded-md border transition-all overflow-visible",
                  config.bgActive,
                  "border-" + config.borderColor.replace("border-", "") + "/40"
                )}
              >
                {/* Series number badge - properly positioned */}
                <Badge 
                  className={cn(
                    "absolute top-2 left-2 text-xs font-bold text-white z-10",
                    config.color
                  )}
                >
                  {(config as any).seriesLabelFn ? (config as any).seriesLabelFn(idx) : `${config.seriesLabel} ${activePhaseNumber}`}
                </Badge>

                {/* Content with proper spacing for badge */}
                <div className="flex items-center gap-2 flex-wrap mt-3">
                  {/* Contraction Type Selector (Super Pletnev) */}
                  {config.showContractionType && (
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Type</Label>
                      <select
                        value={s.contractionType || 'concentric'}
                        onChange={(e) => updateSeries(idx, "contractionType", e.target.value as DropSetSeries['contractionType'])}
                        className={cn(
                          "h-8 px-2 text-xs rounded border border-input bg-background",
                          config.textColor
                        )}
                      >
                        {CONTRACTION_TYPES.map(ct => (
                          <option key={ct.value} value={ct.value}>{ct.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Reps with MAX option */}
                  <div className="flex items-center gap-1">
                    <Label className="text-xs text-muted-foreground">Reps</Label>
                    {s.reps === 'MAX' ? (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => updateSeries(idx, "reps", "")}
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="h-8 px-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold"
                        title="Échec technique (cliquer pour modifier)"
                      >
                        MAX
                      </Button>
                    ) : (
                      <>
                        <NumericInput
                          value={s.reps}
                          onChange={(val) => updateSeries(idx, "reps", val)}
                          className="h-8 text-sm"
                          placeholder="10"
                          minChars={3}
                          maxChars={6}
                        />
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={() => updateSeries(idx, "reps", "MAX")}
                          onPointerDown={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="h-8 px-2 text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white"
                          title="Échec technique (MAX)"
                        >
                          MAX
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Pause (Rest-Pause only) */}
                  {showPause && (
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Pause</Label>
                      <NumericInput
                        value={s.pauseSeconds}
                        onChange={(val) => updateSeries(idx, "pauseSeconds", parseInt(val) || undefined)}
                        className="h-8 text-sm"
                        placeholder="15"
                        minChars={3}
                        maxChars={5}
                        suffix="s"
                      />
                    </div>
                  )}

                  {/* Dynamic Variables with X buttons for hasDynamicVars methods */}
                  {config.hasDynamicVars ? (
                    <>
                      {/* Percentage - dynamic */}
                      {visibleVariables.includes('percentage') && (
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground">%1RM</Label>
                          <NumericInput
                            value={s.percentage}
                            onChange={(val) => updateSeries(idx, "percentage", parseInt(val) || undefined)}
                            className="h-8 text-sm"
                            placeholder="75"
                            minChars={3}
                            maxChars={5}
                            suffix="%"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); removeVariable('percentage'); }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="h-6 w-6 p-0 opacity-70 hover:opacity-100 hover:bg-destructive/20"
                            title="Supprimer %1RM"
                          >
                            <X className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      )}

                      {/* Load (kg) - dynamic */}
                      {visibleVariables.includes('load') && (
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground">Charge</Label>
                          <NumericInput
                            value={s.load}
                            onChange={(val) => updateSeries(idx, "load", parseInt(val) || undefined)}
                            className="h-8 text-sm"
                            placeholder="50"
                            minChars={3}
                            maxChars={6}
                            suffix="kg"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); removeVariable('load'); }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="h-6 w-6 p-0 opacity-70 hover:opacity-100 hover:bg-destructive/20"
                            title="Supprimer Charge"
                          >
                            <X className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      )}

                      {/* Drop Reduction - NOT dynamic, always shown for drops */}
                      {showDropReduction && (
                        <div className="flex items-center gap-1 bg-red-100 dark:bg-red-900/20 px-2 py-1 rounded">
                          <Label className="text-xs text-red-600 dark:text-red-400">Réduction</Label>
                          <span className="text-xs text-red-500">-</span>
                          <NumericInput
                            value={s.reductionValue}
                            onChange={(val) => updateSeries(idx, "reductionValue", parseInt(val) || undefined)}
                            className="h-7 text-sm"
                            placeholder="10"
                            minChars={3}
                            maxChars={5}
                          />
                          <select
                            value={s.reductionType || 'percentage'}
                            onChange={(e) => updateSeries(idx, "reductionType", e.target.value as 'percentage' | 'kg')}
                            onPointerDown={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="h-7 px-1 text-xs rounded border border-input bg-background"
                          >
                            <option value="percentage">%</option>
                            <option value="kg">kg</option>
                          </select>
                        </div>
                      )}

                      {/* Tempo - dynamic */}
                      {visibleVariables.includes('tempo') && (
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground">Tempo</Label>
                          <NumericInput
                            value={s.tempo}
                            onChange={(val) => updateSeries(idx, "tempo", val)}
                            className="h-8 text-sm"
                            placeholder="2-0-1-0"
                            minChars={7}
                            maxChars={10}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); removeVariable('tempo'); }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="h-6 w-6 p-0 opacity-70 hover:opacity-100 hover:bg-destructive/20"
                            title="Supprimer Tempo"
                          >
                            <X className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      )}

                      {/* RPE - dynamic, locked when MAX */}
                      {visibleVariables.includes('rpe') && (
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground">RPE</Label>
                          {s.reps === 'MAX' ? (
                            <div className="h-8 flex items-center justify-center rounded-md border-2 bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 min-w-[60px] px-2">
                              <span className="text-sm font-bold text-red-600 dark:text-red-400">10</span>
                            </div>
                          ) : (
                            <>
                              <NumericInput
                                value={s.rpe}
                                onChange={(val) => updateSeries(idx, "rpe", parseInt(val) || undefined)}
                                className="h-8 text-sm"
                                placeholder="8"
                                minChars={2}
                                maxChars={4}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); removeVariable('rpe'); }}
                                onPointerDown={(e) => e.stopPropagation()}
                                className="h-6 w-6 p-0 opacity-70 hover:opacity-100 hover:bg-destructive/20"
                                title="Supprimer RPE"
                              >
                                <X className="h-3 w-3 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      )}

                      {/* RIR - dynamic, locked when MAX */}
                      {visibleVariables.includes('rir') && (
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground">RIR</Label>
                          {s.reps === 'MAX' ? (
                            <div className="h-8 flex items-center justify-center rounded-md border-2 bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 min-w-[60px] px-2">
                              <span className="text-sm font-bold text-red-600 dark:text-red-400">0</span>
                            </div>
                          ) : (
                            <>
                              <NumericInput
                                value={s.rir}
                                onChange={(val) => updateSeries(idx, "rir", parseInt(val) || undefined)}
                                className="h-8 text-sm"
                                placeholder="2"
                                minChars={2}
                                maxChars={4}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); removeVariable('rir'); }}
                                onPointerDown={(e) => e.stopPropagation()}
                                className="h-6 w-6 p-0 opacity-70 hover:opacity-100 hover:bg-destructive/20"
                                title="Supprimer RIR"
                              >
                                <X className="h-3 w-3 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      )}

                      {/* Angle - dynamic */}
                      {visibleVariables.includes('angle') && (
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground">Angle</Label>
                          <NumericInput
                            value={s.angle}
                            onChange={(val) => updateSeries(idx, "angle", parseInt(val) || undefined)}
                            className="h-8 text-sm"
                            placeholder="90"
                            minChars={3}
                            maxChars={5}
                            suffix="°"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); removeVariable('angle'); }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="h-6 w-6 p-0 opacity-70 hover:opacity-100 hover:bg-destructive/20"
                            title="Supprimer Angle"
                          >
                            <X className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      )}

                      {/* TST (Time Under Tension) - dynamic */}
                      {visibleVariables.includes('timeUnderTension') && (
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground">TST</Label>
                          <NumericInput
                            value={s.timeUnderTension}
                            onChange={(val) => updateSeries(idx, "timeUnderTension", parseInt(val) || undefined)}
                            className="h-8 text-sm"
                            placeholder="6"
                            minChars={2}
                            maxChars={4}
                            suffix="s"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); removeVariable('timeUnderTension'); }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="h-6 w-6 p-0 opacity-70 hover:opacity-100 hover:bg-destructive/20"
                            title="Supprimer TST"
                          >
                            <X className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      )}

                      {/* Add Variable button - show only on first series to avoid duplicates */}
                      {idx === 0 && hiddenVariables.length > 0 && (
                        <InlineVariablePicker
                          items={hiddenVariables.map((variable) => ({
                            key: variable.key,
                            label: variable.unit ? `${variable.label} (${variable.unit})` : variable.label,
                          }))}
                          onPick={addVariable}
                          align="end"
                          width="w-56"
                          heading="Ajouter une variable"
                          buttonLabel="Variable"
                          buttonClassName="h-7 px-2 text-xs border-dashed hover:border-primary hover:bg-primary/5"
                          title="Ajouter une variable (Charge, %1RM, RPE, RIR, Tempo...)"
                        />
                      )}
                    </>
                  ) : (
                    <>
                      {/* Static variables for methods without hasDynamicVars */}
                      {/* Percentage */}
                      {config.showPercentage && (
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground">%1RM</Label>
                          <NumericInput
                            value={s.percentage}
                            onChange={(val) => updateSeries(idx, "percentage", parseInt(val) || undefined)}
                            className="h-8 text-sm"
                            placeholder="75"
                            minChars={3}
                            maxChars={5}
                            suffix="%"
                          />
                        </div>
                      )}

                      {/* Load (kg) */}
                      {config.showLoad && (
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground">Charge</Label>
                          <NumericInput
                            value={s.load}
                            onChange={(val) => updateSeries(idx, "load", parseInt(val) || undefined)}
                            className="h-8 text-sm"
                            placeholder="50"
                            minChars={3}
                            maxChars={6}
                            suffix="kg"
                          />
                        </div>
                      )}

                      {/* Drop Reduction */}
                      {showDropReduction && (
                        <div className="flex items-center gap-1 bg-red-100 dark:bg-red-900/20 px-2 py-1 rounded">
                          <Label className="text-xs text-red-600 dark:text-red-400">Réduction</Label>
                          <span className="text-xs text-red-500">-</span>
                          <NumericInput
                            value={s.reductionValue}
                            onChange={(val) => updateSeries(idx, "reductionValue", parseInt(val) || undefined)}
                            className="h-7 text-sm"
                            placeholder="10"
                            minChars={3}
                            maxChars={5}
                          />
                          <select
                            value={s.reductionType || 'percentage'}
                            onChange={(e) => updateSeries(idx, "reductionType", e.target.value as 'percentage' | 'kg')}
                            onPointerDown={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="h-7 px-1 text-xs rounded border border-input bg-background"
                          >
                            <option value="percentage">%</option>
                            <option value="kg">kg</option>
                          </select>
                        </div>
                      )}

                      {/* Tempo - Show per-series for methods with showTempo */}
                      {(isDropSet || config.showTempo) && (
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground">Tempo</Label>
                          <NumericInput
                            value={s.tempo}
                            onChange={(val) => updateSeries(idx, "tempo", val)}
                            className="h-8 text-sm"
                            placeholder="2-0-1-0"
                            minChars={7}
                            maxChars={10}
                          />
                        </div>
                      )}

                      {/* Angle */}
                      {((!isSuperPletnev && config.showAngle) || showAngleForPhase) && (
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground">Angle</Label>
                          <NumericInput
                            value={s.angle}
                            onChange={(val) => updateSeries(idx, "angle", parseInt(val) || undefined)}
                            className="h-8 text-sm"
                            placeholder="90"
                            minChars={3}
                            maxChars={5}
                            suffix="°"
                          />
                        </div>
                      )}

                      {/* Temps Sous Tension */}
                      {((!isSuperPletnev && config.showTimeUnderTension) || showTUTForPhase) && (
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground">TST</Label>
                          <NumericInput
                            value={s.timeUnderTension}
                            onChange={(val) => updateSeries(idx, "timeUnderTension", parseInt(val) || undefined)}
                            className="h-8 text-sm"
                            placeholder="6"
                            minChars={2}
                            maxChars={4}
                            suffix="s"
                          />
                        </div>
                      )}

                      {/* RPE - static, locked when MAX */}
                      {config.showRpe && (
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground">RPE</Label>
                          {s.reps === 'MAX' ? (
                            <div className="h-8 flex items-center justify-center rounded-md border-2 bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 min-w-[60px] px-2">
                              <span className="text-sm font-bold text-red-600 dark:text-red-400">10</span>
                            </div>
                          ) : (
                            <NumericInput
                              value={s.rpe}
                              onChange={(val) => updateSeries(idx, "rpe", parseInt(val) || undefined)}
                              className="h-8 text-sm"
                              placeholder="8"
                              minChars={2}
                              maxChars={4}
                            />
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Remove button - Allow for Super Pletnev too if more than 2 phases */}
                  {series.length > (isSuperPletnev ? 2 : 1) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSeries(idx)}
                      className="h-7 w-7 p-0 text-destructive ml-auto flex-shrink-0"
                      title="Supprimer cette série"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tempo & RPE cible - Only show for methods without per-series tempo/rpe */}
        {method !== "drop_set" && !config.showTempo && !config.showRpe && (
          <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Tempo</Label>
              <Input
                value={tempo}
                onChange={(e) => setTempo(e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
                className="h-8 w-24 text-sm"
                placeholder="3-1-2-0"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">RPE cible</Label>
              <Input
                type="number"
                value={targetRpe || ""}
                onChange={(e) => setTargetRpe(parseInt(e.target.value) || undefined)}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
                className="h-8 w-20 text-sm"
                placeholder="8"
                min={1}
                max={10}
              />
            </div>
          </div>
        )}
      </div>
      )}

      {/* Repos entre les séries — méthodes classiques (5x5, drop set, pyramides, iso, rest-pause) */}
      {!isCircuitMethod && !isEmom && !isTabata && !isDeathBy && (
        <div className="mt-2 p-2 rounded-lg bg-muted/30 border border-border/50">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Repos entre les séries
            </Label>
            <TimeInput
              value={restSeconds || 0}
              onChange={(seconds) => setRestSeconds(seconds)}
              min={0}
              max={600}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Temps de récupération à prendre entre chaque série
          </p>
        </div>
      )}

      </div> {/* fin du wrapper pointer-events-none */}

      {/* Note auto-générée pour l'athlète — dynamique, toujours visible */}
      <AthleteNoteDisplay
        note={generateMethodNote({
          methodType: method,
          exerciseName: droppedExercise?.exerciseName,
          series: series,
          visibleVariables,
          restPauseConfig: isRestPause ? restPauseConfig : undefined,
          methodExercises: (isCircuitMethod || isEmom || isTabata || isDeathBy) ? 
            Object.entries(droppedPhaseExercises)
              .filter(([_, e]) => e !== null)
              .map(([idx, e]) => ({
                exerciseName: e!.exerciseName,
                reps: series[parseInt(idx)]?.reps as string | number | undefined,
                percentage: series[parseInt(idx)]?.percentage,
                load: series[parseInt(idx)]?.load,
                tempo: series[parseInt(idx)]?.tempo,
                rpe: series[parseInt(idx)]?.rpe,
                rir: series[parseInt(idx)]?.rir,
                angle: series[parseInt(idx)]?.angle,
                timeUnderTension: series[parseInt(idx)]?.timeUnderTension,
              })) : undefined,
          timeCap: ['amrap', 'for_time'].includes(method) ? timeCap : undefined,
          emomConfig: isEmom ? { intervalMinutes: emomConfig.intervalMinutes, totalMinutes: emomConfig.totalMinutes } : undefined,
          tabataConfig: isTabata ? tabataConfig : undefined,
          deathByConfig: isDeathBy ? deathByConfig : undefined,
          repsPerRound: method === 'circuit' ? rounds : undefined,
          circuitRecovery: method === 'circuit' ? {
            strategy: circuitRecovery.strategy,
            globalRestSeconds: circuitRecovery.globalRestSeconds,
            perExerciseRestSeconds: circuitRecovery.perExerciseRestSeconds,
          } : undefined,
          methodRestSeconds: (!isCircuitMethod && !isEmom && !isTabata && !isDeathBy) ? restSeconds : undefined,
        })}
      />

      {/* Help text */}
      <p className="text-xs text-muted-foreground mt-3 text-center">
        {!isEditing && isValidated ? (
          <span className={config.textColor}>
            ✓ Méthode validée. Cliquez sur "Modifier la méthode" pour ajuster.
          </span>
        ) : isComplete ? (
          <span className={config.textColor}>
            ✓ {isSuperPletnev 
              ? `${activePhasesCount} phase(s) active(s)` 
              : isEmom
              ? `${getEmomIntervalLabel()} configuré`
              : isTabata
              ? "Tabata configuré"
              : isDeathBy
              ? "Death By configuré"
              : isCircuitMethod 
              ? "Circuit configuré" 
              : "Exercice ajouté"} ! Configurez puis cliquez sur "Valider la méthode".
          </span>
        ) : (
          <>{isSuperPletnev 
            ? "Glissez un exercice général ou des exercices spécifiques par phase (min. 1 phase active)"
            : isEmom
            ? "Configurez l'intervalle puis glissez les exercices"
            : isTabata
            ? "Glissez un ou plusieurs exercices en alternance"
            : isDeathBy
            ? "Configurez les reps puis glissez un ou plusieurs exercices"
            : isCircuitMethod
            ? "Glissez les exercices dans les slots"
            : `Glissez un exercice depuis la bibliothèque pour appliquer ${config.label}`
          }</>
        )}
      </p>
    </div>
  );
};
