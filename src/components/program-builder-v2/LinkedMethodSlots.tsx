import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Dumbbell, X, Plus, Clock, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MethodExerciseDisplay } from "./MethodExerciseDisplay";
import { WeightliftingPositionSelector } from "./WeightliftingPositionSelector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { VariableSetsTable } from "./VariableSetsTable";
import { SetData, createInitialSets, formatTempo, STRENGTH_SET_COLUMNS } from "@/lib/program-builder-v2/variableSetsTypes";
import { createSyncedParamsUpdate } from "@/lib/program-builder-v2/variableSetsSync";
import { TimeInput } from "@/components/ui/time-input";
import { MethodActionButtons } from "./shared/MethodActionButtons";
import { generateMethodNote } from "@/lib/program-builder-v2/athleteNoteGenerator";
import { AthleteNoteDisplay } from "./AthleteNoteDisplay";

// Map visible variable keys to table column keys
const PARAM_TO_COLUMN_MAP: Record<string, string> = {
  reps: 'reps',
  load: 'weight_kg',
  percentage: 'percentage',
  rpe: 'rpe',
  rir: 'rir',
  tempo: 'tempo',
  rest: 'rest_seconds',
};

// Convert visible params to visible column keys for the table
const mapParamsToColumns = (visibleParams: string[]): string[] => {
  const columnKeys = new Set<string>();
  for (const paramKey of visibleParams) {
    const columnKey = PARAM_TO_COLUMN_MAP[paramKey];
    if (columnKey) {
      columnKeys.add(columnKey);
    }
  }
  return Array.from(columnKeys);
};

interface Exercise {
  id: string;
  exercise_name: string;
  station_name: string;
  video_url: string | null;
}

export interface SlottedExerciseParams {
  sets?: number;
  reps?: string;
  load?: number;
  percentage?: number;
  tempo?: string;
  rpe?: number;
  rir?: number;
  rest?: number;
  visibleParams?: string[];
  // Variable sets support
  variableSets?: SetData[];
  useVariableSets?: boolean;
  // Weightlifting starting position
  startingPosition?: string;
  // Coach-specific note for this exercise inside the linked method
  coachNotes?: string;
}

export interface SlottedExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  stationName?: string;
  slotIndex: number;
  params?: SlottedExerciseParams;
}

export type LinkedMethodType = "superset" | "biset" | "triset" | "giant_set" | "bulgarian" | "combine_haltero";

interface LinkedMethodSlotsProps {
  method: LinkedMethodType;
  slottedExercises: SlottedExercise[];
  onRemoveFromSlot: (slotIndex: number) => void;
  onUpdateParams: (slotIndex: number, params: SlottedExerciseParams) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  dayId: string;
  defaultEditing?: boolean;
  // Strict read-only: hide all edit/validate actions
  readOnly?: boolean;
  // Method-level rest (between exercises in the method)
  methodRestSeconds?: number;
  onMethodRestChange?: (seconds: number | undefined) => void;
}

// All available linked method parameters
const ALL_LINKED_PARAMS = [
  { key: 'sets', label: 'Séries', placeholder: '4', type: 'number' },
  { key: 'reps', label: 'Reps', placeholder: '8-10', type: 'text' },
  { key: 'percentage', label: '% 1RM', placeholder: '75', type: 'number' },
  { key: 'load', label: 'Poids (kg)', placeholder: '80', type: 'number' },
  { key: 'tempo', label: 'Tempo', placeholder: '3-0-1-0', type: 'text' },
  { key: 'rpe', label: 'RPE', placeholder: '8', type: 'number' },
  { key: 'rir', label: 'RIR', placeholder: '2', type: 'number' },
  { key: 'rest', label: 'Repos (s)', placeholder: '90', type: 'number' },
];

// Default visible params per method type
const getDefaultVisibleParams = (method: LinkedMethodType, slotIndex: number): string[] => {
  if (method === 'bulgarian') {
    // Both slots expose %1RM AND Kg by default so the coach can pick either
    return slotIndex === 0
      ? ['sets', 'reps', 'percentage', 'load', 'tempo', 'rpe']
      : ['sets', 'reps', 'percentage', 'load', 'tempo'];
  }
  // Default for all other linked methods
  return ['sets', 'reps', 'percentage', 'tempo'];
};

const getMethodConfig = (method: string) => {
  switch (method) {
    case "superset":
      return {
        label: "Superset",
        color: "bg-blue-500",
        borderColor: "border-blue-500",
        bgActive: "bg-blue-500/20",
        textColor: "text-blue-500",
        slots: 2,
        minSlots: 2,
        slotLabels: ["Exercice 1 (agoniste)", "Exercice 2 (antagoniste)"],
      };
    case "biset":
      return {
        label: "Biset",
        color: "bg-cyan-600",
        borderColor: "border-cyan-600",
        bgActive: "bg-cyan-600/20",
        textColor: "text-cyan-600",
        slots: 2,
        minSlots: 2,
        slotLabels: ["Exercice 1 (même groupe)", "Exercice 2 (même groupe)"],
      };
    case "triset":
      return {
        label: "Triset",
        color: "bg-purple-500",
        borderColor: "border-purple-500",
        bgActive: "bg-purple-500/20",
        textColor: "text-purple-500",
        slots: 3,
        minSlots: 3,
        slotLabels: ["Exercice 1", "Exercice 2", "Exercice 3"],
      };
    case "giant_set":
      return {
        label: "Giant Set",
        color: "bg-pink-500",
        borderColor: "border-pink-500",
        bgActive: "bg-pink-500/20",
        textColor: "text-pink-500",
        slots: 10, // Dynamic - starts at 4, expands as needed
        minSlots: 4,
        slotLabels: Array.from({ length: 10 }, (_, i) => `Exercice ${i + 1}`),
      };
    case "bulgarian":
      return {
        label: "Méthode Bulgare",
        color: "bg-fuchsia-500",
        borderColor: "border-fuchsia-500",
        bgActive: "bg-fuchsia-500/20",
        textColor: "text-fuchsia-500",
        slots: 2,
        minSlots: 2,
        slotLabels: ["Exercice lourd (85-95% 1RM)", "Exercice léger (explosif)"],
      };
    case "combine_haltero":
      return {
        label: "Combiné Haltéro",
        color: "bg-fuchsia-600",
        borderColor: "border-fuchsia-600",
        bgActive: "bg-fuchsia-600/20",
        textColor: "text-fuchsia-600",
        slots: 99, // No practical limit — dynamic expansion
        minSlots: 2,
        slotLabels: Array.from({ length: 99 }, (_, i) => `Mouvement ${i + 1}`),
      };
    default:
      return {
        label: "Bloc",
        color: "bg-gray-500",
        borderColor: "border-gray-500",
        bgActive: "bg-gray-500/20",
        textColor: "text-gray-500",
        slots: 2,
        minSlots: 2,
        slotLabels: ["Exercice 1", "Exercice 2"],
      };
  }
};

// Editable coach notes block (collapsible) for a single slotted exercise
const CoachNotesEditor = ({
  value,
  onChange,
}: {
  value?: string;
  onChange: (val: string) => void;
}) => {
  const [open, setOpen] = useState(Boolean(value && value.length > 0));

  return (
    <div className="mt-2">
      {!open ? (
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
      ) : (
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
      )}
    </div>
  );
};

// Single param input with remove button
const ParamInput = ({
  label,
  value,
  onChange,
  onRemove,
  placeholder,
  type = "text",
  paramKey,
  locked = false,
}: {
  label: string;
  value: string | number | undefined;
  onChange: (val: string) => void;
  onRemove: () => void;
  placeholder?: string;
  type?: string;
  paramKey?: string;
  /** When true, field is locked (physiologically imposed) and displayed in red */
  locked?: boolean;
}) => {
  const isRepsField = paramKey === 'reps';
  const isMaxValue = isRepsField && value === 'MAX';
  
  const toggleMax = () => {
    if (isMaxValue) {
      onChange('');
    } else {
      onChange('MAX');
    }
  };

  // Calculate dynamic width based on field type
  const getFieldWidth = () => {
    if (paramKey === 'tempo') return 'w-[80px]';
    if (paramKey === 'load' || paramKey === 'percentage') return 'w-[60px]';
    if (isRepsField) return 'w-[120px]';
    return 'w-[55px]';
  };

  return (
    <div className={cn("flex items-center gap-1 relative group")}>
      <Label className="text-[10px] text-muted-foreground font-medium shrink-0">{label}</Label>
      <div className={cn("flex items-center gap-0.5 relative", getFieldWidth())}>
        <button
          type="button"
          onClick={onRemove}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-destructive/20 rounded absolute -top-2 -right-1 z-10"
          title={`Supprimer ${label}`}
        >
          <X className="h-2.5 w-2.5 text-destructive" />
        </button>
        {isRepsField ? (
          <div className="flex items-center gap-0.5 w-full">
            {isMaxValue ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={toggleMax}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="h-7 flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm"
                title="Échec technique (cliquer pour modifier)"
              >
                MAX
              </Button>
            ) : (
              <>
                <Input
                  type="text"
                  value={value ?? ""}
                  onChange={(e) => onChange(e.target.value)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onFocus={(e) => e.target.select()}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder={placeholder}
                  className="h-7 text-xs px-1.5 flex-1 min-w-[3ch] font-medium shadow-sm"
                />
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={toggleMax}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="h-7 px-1.5 text-[9px] font-bold shrink-0 bg-red-600 hover:bg-red-700 text-white shadow-sm"
                  title="Échec technique (MAX)"
                >
                  MAX
                </Button>
              </>
            )}
          </div>
        ) : locked ? (
          <div className="h-7 flex items-center justify-center rounded-md border-2 bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 px-1.5 w-full">
            <span className="text-xs font-bold text-red-600 dark:text-red-400">{value ?? ""}</span>
          </div>
        ) : (
          <Input
            type={type}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onFocus={(e) => e.target.select()}
            onWheel={(e) => e.currentTarget.blur()}
            placeholder={placeholder}
            className="h-7 text-xs px-1.5 w-full font-medium shadow-sm"
          />
        )}
      </div>
    </div>
  );
};

// Add variable button for linked slots
const AddParamButton = ({
  availableParams,
  onAdd,
}: {
  availableParams: typeof ALL_LINKED_PARAMS;
  onAdd: (key: string) => void;
}) => {
  const [open, setOpen] = useState(false);

  if (availableParams.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          className="h-7 px-2 text-[10px] border-dashed hover:border-primary hover:bg-primary/5 self-end"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-36 p-2 z-[60]" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground px-1">Ajouter</p>
          {availableParams.map((param) => (
            <button
              key={param.key}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onAdd(param.key);
                setOpen(false);
              }}
              className="w-full text-left px-2 py-1 text-xs rounded hover:bg-accent transition-colors"
            >
              {param.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Individual droppable slot with inline editing
const DroppableSlot = ({
  slotId,
  slotIndex,
  slotLabel,
  exercise,
  config,
  onRemove,
  onUpdateParams,
  onSyncVisibleParam,
  method,
  isEditing = true,
}: {
  slotId: string;
  slotIndex: number;
  slotLabel: string;
  exercise?: SlottedExercise;
  config: ReturnType<typeof getMethodConfig>;
  onRemove: () => void;
  onUpdateParams: (params: SlottedExerciseParams) => void;
  onSyncVisibleParam: (action: 'add' | 'remove', key: string, triggerSlotIndex: number) => void;
  method: LinkedMethodType;
  isEditing?: boolean;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: slotId,
    data: { type: "linked-slot", slotIndex },
  });

  const isFilled = !!exercise;
  const params = exercise?.params || {};
  
  // Get current visible params or defaults
  const visibleParams = params.visibleParams || getDefaultVisibleParams(method, slotIndex);

  const handleParamChange = (field: keyof SlottedExerciseParams, value: string) => {
    const numFields = ['sets', 'load', 'percentage', 'rpe', 'rir', 'rest'];
    let newValue: string | number | undefined;
    
    if (numFields.includes(field)) {
      newValue = value === '' ? undefined : Number(value);
    } else if (field === 'tempo') {
      // Auto-format tempo
      newValue = formatTempo(value) || undefined;
    } else {
      newValue = value;
    }
    
    // Use sync helper to propagate changes to variableSets
    const updatedParams = createSyncedParamsUpdate(params, field, newValue);
    
    // MAX reps rule: auto-lock RPE=10, RIR=0
    if (field === 'reps' && newValue === 'MAX') {
      if (visibleParams.includes('rpe')) updatedParams.rpe = 10;
      if (visibleParams.includes('rir')) updatedParams.rir = 0;
    }
    // Deactivating MAX: clear forced RPE/RIR so they become editable
    if (field === 'reps' && params.reps === 'MAX' && newValue !== 'MAX') {
      updatedParams.rpe = undefined;
      updatedParams.rir = undefined;
    }
    // Prevent manual RPE/RIR change when MAX is active
    if ((field === 'rpe' || field === 'rir') && params.reps === 'MAX') {
      updatedParams.rpe = 10;
      updatedParams.rir = 0;
    }
    
    onUpdateParams(updatedParams);
  };

  const handleRemoveParam = (key: string) => {
    // Sync visibility removal across all exercises in the method
    onSyncVisibleParam('remove', key, slotIndex);
  };

  const handleAddParam = (key: string) => {
    // Sync visibility addition across all exercises in the method
    onSyncVisibleParam('add', key, slotIndex);
  };

  // Get available (hidden) params for the add button
  const hiddenParams = ALL_LINKED_PARAMS.filter(p => !visibleParams.includes(p.key));

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative rounded-lg border-2 border-dashed transition-all",
        isFilled
          ? `${config.borderColor} ${config.bgActive} border-solid`
          : isOver
          ? `${config.borderColor} bg-primary/10`
          : "border-muted-foreground/30 bg-muted/20"
      )}
    >
      {/* Slot label badge */}
      <div
        className={cn(
          "absolute top-1 left-1.5 px-1.5 py-0 rounded-full text-[9px] font-semibold z-10 leading-4",
          isFilled ? `${config.color} text-white` : "bg-muted text-muted-foreground"
        )}
      >
        {slotLabel}
      </div>

      {isFilled ? (
        <div className="pt-4 pb-1 px-1.5">
          {/* Exercise display with method's color scheme */}
          <MethodExerciseDisplay
            exerciseName={exercise.exerciseName}
            onRemove={isEditing ? onRemove : undefined}
            className="mb-1"
            methodBgColor={config.bgActive}
            methodBorderColor={config.borderColor}
            methodTextColor={config.textColor}
            methodIconColor={config.color}
          />

          {/* Weightlifting Position Selector - always available when exercise is filled */}
          <WeightliftingPositionSelector
            exerciseName={exercise.exerciseName}
            stationName={exercise.stationName || ""}
            value={params.startingPosition}
            onChange={(value) => onUpdateParams({ ...params, startingPosition: value })}
            compact
          />

          {/* Dynamic parameters - mode édition ou lecture seule */}
          {isEditing ? (
            <>
              <div className="flex flex-wrap gap-1 items-center">
                {visibleParams.map(key => {
                  const paramConfig = ALL_LINKED_PARAMS.find(p => p.key === key);
                  if (!paramConfig) return null;
                  type InputParamKey = 'sets' | 'reps' | 'load' | 'percentage' | 'tempo' | 'rpe' | 'rir' | 'rest';
                  const paramValue = ['visibleParams', 'variableSets', 'useVariableSets'].includes(key) 
                    ? undefined 
                    : params[key as InputParamKey];
                  const isMaxReps = params.reps === 'MAX';
                  const isLockedByMax = isMaxReps && (key === 'rpe' || key === 'rir');
                  // Force display value when MAX is active
                  const displayValue = isLockedByMax 
                    ? (key === 'rpe' ? 10 : 0)
                    : paramValue;
                  return (
                    <ParamInput
                      key={key}
                      label={paramConfig.label}
                      value={displayValue}
                      onChange={(v) => handleParamChange(key as keyof SlottedExerciseParams, v)}
                      onRemove={() => handleRemoveParam(key)}
                      placeholder={paramConfig.placeholder}
                      type={paramConfig.type}
                      paramKey={key}
                      locked={isLockedByMax}
                    />
                  );
                })}
                <AddParamButton
                  availableParams={hiddenParams}
                  onAdd={handleAddParam}
                />
              </div>
              
              {/* Variable Sets Table */}
              <div className="mt-1">
                <VariableSetsTable
                  sets={params.variableSets || createInitialSets(params.sets || 3)}
                  onChange={(newSets) => {
                    onUpdateParams({
                      ...params,
                      variableSets: newSets,
                      useVariableSets: true,
                      sets: newSets.length,
                    });
                  }}
                  columns={STRENGTH_SET_COLUMNS}
                  visibleColumns={mapParamsToColumns(visibleParams)}
                />
              </div>

              {/* Consignes spécifiques (coach notes) - éditable */}
              <CoachNotesEditor
                value={params.coachNotes}
                onChange={(val) =>
                  onUpdateParams({ ...params, coachNotes: val })
                }
              />
            </>
          ) : (
            /* Mode lecture seule: afficher les valeurs */
            <div className="flex flex-wrap gap-3 text-sm">
              {visibleParams.map(key => {
                const paramConfig = ALL_LINKED_PARAMS.find(p => p.key === key);
                if (!paramConfig) return null;
                type InputParamKey = 'sets' | 'reps' | 'load' | 'percentage' | 'tempo' | 'rpe' | 'rir' | 'rest';
                const paramValue = ['visibleParams', 'variableSets', 'useVariableSets'].includes(key) 
                  ? undefined 
                  : params[key as InputParamKey];
                if (paramValue === undefined) return null;
                const isMaxReps = params.reps === 'MAX';
                const isLockedByMax = isMaxReps && (key === 'rpe' || key === 'rir');
                const displayValue = isLockedByMax ? (key === 'rpe' ? 10 : 0) : paramValue;
                return (
                  <div key={key} className={cn(
                    "px-2 py-1 rounded-md border",
                    isLockedByMax 
                      ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800" 
                      : "bg-muted/50"
                  )}>
                    <span className="text-xs text-muted-foreground">{paramConfig.label}:</span>
                    <span className={cn(
                      "ml-1 font-medium",
                      isLockedByMax && "text-red-600 dark:text-red-400 font-bold"
                    )}>{displayValue}</span>
                  </div>
                );
              })}
              {params.coachNotes && (
                <div className="w-full mt-1 p-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                  <p className="text-[10px] uppercase tracking-wide text-blue-700 dark:text-blue-400 font-semibold mb-0.5 flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> Consignes spécifiques
                  </p>
                  <p className="text-xs text-blue-900 dark:text-blue-200 whitespace-pre-wrap">{params.coachNotes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-[40px] text-muted-foreground p-1.5 pt-5">
          <Dumbbell className="h-4 w-4 mr-2 opacity-50" />
          <span className="text-xs">
            {slotLabel.includes("lourd") 
              ? "Glissez un exercice lourd" 
              : slotLabel.includes("léger") 
              ? "Glissez un exercice léger" 
              : "Glissez un exercice ici"}
          </span>
        </div>
      )}
    </div>
  );
};

export const LinkedMethodSlots = ({
  method,
  slottedExercises,
  onRemoveFromSlot,
  onUpdateParams,
  onConfirm,
  onCancel,
  dayId,
  defaultEditing = true,
  readOnly = false,
  methodRestSeconds,
  onMethodRestChange,
}: LinkedMethodSlotsProps) => {
  return (
    <LinkedMethodSlotsContent
      method={method}
      slottedExercises={slottedExercises}
      onRemoveFromSlot={onRemoveFromSlot}
      onUpdateParams={onUpdateParams}
      onConfirm={onConfirm}
      onCancel={onCancel}
      dayId={dayId}
      defaultEditing={defaultEditing}
      readOnly={readOnly}
      methodRestSeconds={methodRestSeconds}
      onMethodRestChange={onMethodRestChange}
    />
  );
};

// Composant interne pour gérer l'état édition/lecture
const LinkedMethodSlotsContent = ({
  method,
  slottedExercises,
  onRemoveFromSlot,
  onUpdateParams,
  onConfirm,
  onCancel,
  dayId,
  defaultEditing = true,
  readOnly = false,
  methodRestSeconds,
  onMethodRestChange,
}: LinkedMethodSlotsProps) => {
  const [isValidated, setIsValidated] = useState(!defaultEditing);
  const [isEditing, setIsEditing] = useState(defaultEditing && !readOnly);
  
  const config = getMethodConfig(method);
  const isDynamic = config.slots > config.minSlots;
  const minRequired = config.minSlots;
  const filledCount = slottedExercises.length;
  const isComplete = filledCount >= minRequired;
  const slotsToShow = isDynamic 
    ? (isEditing
        ? Math.max(config.minSlots, Math.min(filledCount + 1, config.slots))
        : Math.max(config.minSlots, filledCount))
    : config.slots;

  // Handler de validation: passe en lecture seule
  const handleValidate = () => {
    setIsValidated(true);
    setIsEditing(false);
    onConfirm?.();
  };
  
  // Handler pour repasser en édition
  const enableEditing = () => {
    setIsEditing(true);
  };
  
  // Handler d'annulation
  const handleCancel = () => {
    if (isValidated) {
      setIsEditing(false);
      return;
    }
    onCancel?.();
  };

  // Sync visible params across all exercises
  const handleSyncVisibleParam = (
    action: 'add' | 'remove',
    key: string,
    triggerSlotIndex: number
  ) => {
    if (!isEditing) return;
    
    slottedExercises.forEach((exercise) => {
      const currentParams = exercise.params || {};
      const currentVisibleParams = currentParams.visibleParams || getDefaultVisibleParams(method, exercise.slotIndex);
      let newVisibleParams: string[];
      let newParams: SlottedExerciseParams;
      
      if (action === 'add') {
        newVisibleParams = currentVisibleParams.includes(key) 
          ? currentVisibleParams 
          : [...currentVisibleParams, key];
        newParams = { ...currentParams, visibleParams: newVisibleParams };
      } else {
        newVisibleParams = currentVisibleParams.filter(k => k !== key);
        newParams = { ...currentParams, visibleParams: newVisibleParams, [key]: undefined };
      }
      
      onUpdateParams(exercise.slotIndex, newParams);
    });
  };

  return (
    <div className={cn("p-2 rounded-lg border-2", config.borderColor, "bg-background/50")}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge className={cn("text-white", config.color)}>{config.label}</Badge>
          <span className="text-xs text-muted-foreground">
            {filledCount} exercice{filledCount > 1 ? "s" : ""}{isDynamic ? ` (min. ${minRequired})` : ` / ${config.slots}`}
          </span>
        </div>
        {/* Actions centralisées */}
        {!readOnly && (
          <MethodActionButtons
            isEditing={isEditing}
            onValidate={() => handleValidate()}
            onEdit={enableEditing}
            onCancel={handleCancel}
            isValid={isComplete}
            methodColor={cn(config.color, "hover:opacity-90")}
            className="flex-row-reverse gap-2"
          />
        )}
      </div>

      {/* Slots grid */}
      <div className="grid gap-2">
        {Array.from({ length: slotsToShow }).map((_, index) => {
          const exercise = slottedExercises.find((e) => e.slotIndex === index);
          const slotId = `linked-slot-${dayId}-${index}`;
          const slotLabel = config.slotLabels[index] || `Exercice ${index + 1}`;
          
          return (
            <DroppableSlot
              key={slotId}
              slotId={slotId}
              slotIndex={index}
              slotLabel={slotLabel}
              exercise={exercise}
              config={config}
              onRemove={() => isEditing && onRemoveFromSlot(index)}
              onUpdateParams={(params) => isEditing && onUpdateParams(index, params)}
              onSyncVisibleParam={handleSyncVisibleParam}
              method={method}
              isEditing={isEditing}
            />
          );
        })}
      </div>

      {/* Method-level rest configuration */}
      {(onMethodRestChange || (readOnly && methodRestSeconds)) && (
        <div className="mt-2 p-2 rounded-lg bg-muted/30 border border-border/50">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Repos entre séries
            </Label>
            {isEditing && onMethodRestChange ? (
              <TimeInput
                value={methodRestSeconds}
                onChange={(seconds) => onMethodRestChange(seconds)}
                min={0}
                max={600}
              />
            ) : (
              <span className="text-sm font-medium">
                {methodRestSeconds ? `${methodRestSeconds}s` : '-'}
              </span>
            )}
          </div>
          {!readOnly && (
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Temps de récupération après chaque tour de la méthode
            </p>
          )}
        </div>
      )}

      {/* Notes pour l'athlète supprimées ici — gérées au niveau parent via CreateTrainingProgram */}

      {/* Help text */}
      {!readOnly && (
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          {isComplete ? (
            <span className={cn("font-medium", config.textColor)}>
              ✓ Méthode complète ! {isEditing ? "Configurez les paramètres puis validez." : "Cliquez sur Modifier pour ajuster."}
            </span>
          ) : (
            isDynamic 
              ? <>Ajoutez au moins {minRequired} exercices (cliquez ou glissez)</>
              : <>Glissez {config.slots} exercices depuis la bibliothèque</>
          )}
        </p>
      )}
    </div>
  );
};
