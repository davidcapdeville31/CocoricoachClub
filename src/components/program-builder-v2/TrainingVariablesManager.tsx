import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimeInput } from "@/components/ui/time-input";
import { 
  X, 
  Plus, 
  Dumbbell, 
  Repeat, 
  Percent, 
  Timer, 
  Gauge, 
  Hash,
  Clock,
  Flame,
  Zap,
  MapPin,
  Play,
  Target,
  ArrowUp,
  TrendingUp,
  Activity,
  CheckCircle,
  FileText
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  ExerciseType, 
  getVariablesForType, 
  getDefaultVisibleVariables,
  VariableConfig 
} from "@/lib/exerciseTypes";
import { VariableSetsTable } from "./VariableSetsTable";
import { SetData, createInitialSets, STRENGTH_SET_COLUMNS, formatTempo, SetsTableColumn } from "@/lib/variableSetsTypes";
import { getSetFieldFromParam, syncFieldToSets, syncSetsCount } from "@/lib/variableSetsSync";

// Map visible variable keys to table column keys
const VARIABLE_TO_COLUMN_MAP: Record<string, string> = {
  reps: 'reps',
  load: 'weight_kg',
  weight: 'weight_kg',
  weight_kg: 'weight_kg',
  charge: 'weight_kg',
  percentage: 'percentage',
  rpe: 'rpe',
  rir: 'rir',
  tempo: 'tempo',
  restSeconds: 'rest_seconds',
  rest: 'rest_seconds',
};

// Convert visible variables to visible column keys for the table
const mapVariablesToColumns = (visibleVariables: string[]): string[] => {
  const columnKeys = new Set<string>();
  for (const varKey of visibleVariables) {
    const columnKey = VARIABLE_TO_COLUMN_MAP[varKey];
    if (columnKey) {
      columnKeys.add(columnKey);
    }
  }
  return Array.from(columnKeys);
};

// Icon mapping for dynamic rendering
const ICON_MAP: Record<string, React.ReactNode> = {
  Hash: <Hash className="h-3 w-3" />,
  Repeat: <Repeat className="h-3 w-3" />,
  Percent: <Percent className="h-3 w-3" />,
  Dumbbell: <Dumbbell className="h-3 w-3" />,
  Timer: <Timer className="h-3 w-3" />,
  Gauge: <Gauge className="h-3 w-3" />,
  Target: <Target className="h-3 w-3" />,
  Clock: <Clock className="h-3 w-3" />,
  Flame: <Flame className="h-3 w-3" />,
  Zap: <Zap className="h-3 w-3" />,
  MapPin: <MapPin className="h-3 w-3" />,
  Play: <Play className="h-3 w-3" />,
  ArrowUp: <ArrowUp className="h-3 w-3" />,
  TrendingUp: <TrendingUp className="h-3 w-3" />,
  Activity: <Activity className="h-3 w-3" />,
  CheckCircle: <CheckCircle className="h-3 w-3" />,
  FileText: <FileText className="h-3 w-3" />,
};

// Export for backward compatibility
export type { ExerciseType };

export interface TrainingVariableConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  type: 'number' | 'text' | 'time';
  min?: number;
  max?: number;
  step?: number;
}

// Convert VariableConfig to TrainingVariableConfig with React icon
const toTrainingVariableConfig = (config: VariableConfig): TrainingVariableConfig => ({
  ...config,
  icon: ICON_MAP[config.icon] || <Hash className="h-3 w-3" />,
});

// Get all variables for an exercise type (with React icons)
export const getVariablesForExerciseType = (exerciseType: ExerciseType): TrainingVariableConfig[] => {
  return getVariablesForType(exerciseType).map(toTrainingVariableConfig);
};

// Default visible variables per exercise type (legacy exports for backward compatibility)
export const DEFAULT_STRENGTH_VISIBLE = getDefaultVisibleVariables('strength');
export const DEFAULT_CARDIO_VISIBLE = getDefaultVisibleVariables('cardio_machine');
export const DEFAULT_RUNNING_VISIBLE = getDefaultVisibleVariables('cardio_locomotion');
export const DEFAULT_BODYWEIGHT_VISIBLE = getDefaultVisibleVariables('bodyweight');
export const DEFAULT_SKILL_VISIBLE = getDefaultVisibleVariables('skill');

// Legacy exports for backward compatibility
export const STRENGTH_VARIABLES = getVariablesForExerciseType('strength');
export const CARDIO_VARIABLES = getVariablesForExerciseType('cardio_machine');
export const RUNNING_VARIABLES = getVariablesForExerciseType('cardio_locomotion');
export const BODYWEIGHT_VARIABLES = getVariablesForExerciseType('bodyweight');
export const SKILL_VARIABLES = getVariablesForExerciseType('skill');

// Time formatting helpers
const formatSecondsToMinSec = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const parseMinSecToSeconds = (value: string): number => {
  if (!value) return 0;
  if (value.includes(':')) {
    const [mins, secs] = value.split(':').map(Number);
    return (mins || 0) * 60 + (secs || 0);
  }
  return parseInt(value) || 0;
};

interface VariableInputProps {
  config: TrainingVariableConfig;
  value: any;
  onChange: (value: any) => void;
  onRemove: () => void;
  compact?: boolean;
  /** When true, field is locked (physiologically imposed) and displayed in red */
  locked?: boolean;
}

const VariableInput = ({ config, value, onChange, onRemove, compact = false, locked = false }: VariableInputProps) => {
  const displayValue = config.type === 'time' && typeof value === 'number' 
    ? formatSecondsToMinSec(value) 
    : value;
  
  const isRepsField = config.key === 'reps';
  const isMaxValue = isRepsField && value === 'MAX';
  
  const handleChange = (inputValue: string) => {
    if (config.type === 'time') {
      onChange(parseMinSecToSeconds(inputValue));
    } else if (config.type === 'number') {
      const parsed = config.step && config.step < 1 
        ? parseFloat(inputValue) 
        : parseInt(inputValue);
      onChange(isNaN(parsed) ? undefined : parsed);
    } else if (config.key === 'tempo') {
      // Auto-format tempo: "3030" → "3-0-3-0"
      onChange(formatTempo(inputValue) || undefined);
    } else {
      onChange(inputValue || undefined);
    }
  };

  const handleRemoveVariable = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('VariableInput handleRemoveVariable triggered for:', config.key);
    onRemove();
  };

  const toggleMax = () => {
    if (isMaxValue) {
      onChange(undefined);
    } else {
      onChange('MAX');
    }
  };

  return (
    <div className={cn("relative", compact ? "min-w-[50px]" : isRepsField ? "min-w-[90px]" : config.key === 'tempo' ? "min-w-[80px]" : "min-w-[65px]")}>
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-muted-foreground">{config.icon}</span>
        <Label className="text-[10px] text-muted-foreground font-normal truncate flex-1">{config.label}</Label>
        {!isRepsField && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleRemoveVariable}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            className="h-5 w-5 p-0 opacity-70 hover:opacity-100 hover:bg-destructive/20"
            title={`Supprimer ${config.label}`}
          >
            <X className="h-3 w-3 text-destructive" />
          </Button>
        )}
      </div>
      {config.type === 'time' ? (
        <TimeInput
          value={typeof value === 'number' ? value : 0}
          onChange={(seconds) => onChange(seconds)}
        />
      ) : isRepsField ? (
        // Reps field with MAX toggle
        <div className="flex items-center gap-1">
          {isMaxValue ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={toggleMax}
              className="h-7 flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
              title="Échec technique (cliquer pour modifier)"
            >
              MAX
            </Button>
          ) : (
            <>
              <Input
                type="text"
                value={displayValue ?? ""}
                onChange={(e) => handleChange(e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
                className="h-7 text-xs px-1.5 w-12"
                placeholder={config.placeholder}
              />
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  toggleMax();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="h-7 px-2 text-[10px] font-bold shrink-0 bg-red-600 hover:bg-red-700 text-white"
                title="Échec technique (MAX)"
              >
                MAX
              </Button>
            </>
          )}
        </div>
      ) : locked ? (
        // Locked field: show value in red, non-editable
        <div className={cn("h-7 flex items-center justify-center rounded-md border bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 px-1.5", config.key === 'tempo' ? "w-[72px]" : "w-16")}>
          <span className="text-xs font-bold text-red-600 dark:text-red-400">{displayValue ?? ""}</span>
        </div>
      ) : (
        <Input
          type={config.type === 'number' ? 'number' : 'text'}
          min={config.min}
          max={config.max}
          step={config.step}
          value={displayValue ?? ""}
          onChange={(e) => handleChange(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn("h-7 text-xs px-1.5", config.key === 'tempo' ? "w-[72px]" : "w-16")}
          placeholder={config.placeholder}
        />
      )}
    </div>
  );
};

interface AddVariableButtonProps {
  availableVariables: TrainingVariableConfig[];
  onAdd: (key: string) => void;
}

const AddVariableButton = ({ availableVariables, onAdd }: AddVariableButtonProps) => {
  const [open, setOpen] = useState(false);

  if (availableVariables.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs border-dashed hover:border-primary hover:bg-primary/5"
        >
          <Plus className="h-3 w-3 mr-1" />
          Variable
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">Ajouter une variable</p>
          {availableVariables.map((variable) => (
            <button
              key={variable.key}
              type="button"
              onClick={() => {
                onAdd(variable.key);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors text-left"
            >
              {variable.icon}
              <span>{variable.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export interface TrainingVariablesManagerProps {
  exerciseType: ExerciseType;
  values: Record<string, any>;
  onUpdate: (key: string, value: any) => void;
  visibleVariables: string[];
  onVisibleVariablesChange: (variables: string[]) => void;
  compact?: boolean;
  showRestForGroup?: boolean;
  isGrouped?: boolean;
  // Variable sets support
  variableSets?: SetData[];
  onVariableSetsChange?: (sets: SetData[]) => void;
  showVariableSets?: boolean;
  /** Mode lecture seule : affiche les valeurs sans inputs */
  readOnly?: boolean;
}

export const TrainingVariablesManager = ({
  exerciseType,
  values,
  onUpdate,
  visibleVariables,
  onVisibleVariablesChange,
  compact = false,
  showRestForGroup = true,
  isGrouped = false,
  variableSets,
  onVariableSetsChange,
  showVariableSets = true,
  readOnly = false,
}: TrainingVariablesManagerProps) => {
  // Track previous RPE/RIR values before MAX lock
  const [savedRpe, setSavedRpe] = useState<number | undefined>(undefined);
  const [savedRir, setSavedRir] = useState<number | undefined>(undefined);
  
  // Detect if reps is MAX → lock RPE/RIR
  const isMaxReps = values.reps === 'MAX';

  // Get available variables based on exercise type from centralized config
  const allVariables = getVariablesForExerciseType(exerciseType);

  // Filter visible variables
  const visibleConfigs = allVariables.filter(v => visibleVariables.includes(v.key));
  
  // Filter for rest handling in grouped exercises
  const displayConfigs = visibleConfigs.filter(v => {
    if (v.key === 'restSeconds' && isGrouped && !showRestForGroup) return false;
    return true;
  });
  
  // Get available (hidden) variables
  const hiddenVariables = allVariables.filter(v => !visibleVariables.includes(v.key));

  const handleRemove = (key: string) => {
    console.log('TrainingVariablesManager handleRemove called:', key);
    console.log('Current visibleVariables:', visibleVariables);
    const newVars = visibleVariables.filter(k => k !== key);
    console.log('New visibleVariables:', newVars);
    onVisibleVariablesChange(newVars);
    onUpdate(key, undefined); // Clear the value
  };

  const handleAdd = (key: string) => {
    onVisibleVariablesChange([...visibleVariables, key]);
  };

  // Check if this is a strength-type exercise that supports variable sets
  const supportsVariableSets = exerciseType === 'strength' || exerciseType === 'bodyweight';

  // Enhanced update handler that also syncs to variableSets + MAX→RPE/RIR rule
  const handleUpdateWithSync = (key: string, value: any) => {
    // First update the main value
    onUpdate(key, value);
    
    // MAX reps rule: auto-lock RPE=10, RIR=0
    if (key === 'reps' && value === 'MAX') {
      // Save current values before overriding
      if (visibleVariables.includes('rpe') && values.rpe !== 10) {
        setSavedRpe(values.rpe);
      }
      if (visibleVariables.includes('rir') && values.rir !== 0) {
        setSavedRir(values.rir);
      }
      // Force RPE=10 and RIR=0
      if (visibleVariables.includes('rpe')) onUpdate('rpe', 10);
      if (visibleVariables.includes('rir')) onUpdate('rir', 0);
    }
    
    // Deactivating MAX: restore previous RPE/RIR
    if (key === 'reps' && values.reps === 'MAX' && value !== 'MAX') {
      if (visibleVariables.includes('rpe') && savedRpe !== undefined) {
        onUpdate('rpe', savedRpe);
        setSavedRpe(undefined);
      }
      if (visibleVariables.includes('rir') && savedRir !== undefined) {
        onUpdate('rir', savedRir);
        setSavedRir(undefined);
      }
    }
    
    // Then sync to variableSets if we have them and the field is syncable
    if (onVariableSetsChange && variableSets && variableSets.length > 0) {
      const setField = getSetFieldFromParam(key);
      if (setField) {
        const syncedSets = syncFieldToSets(variableSets, setField, value);
        onVariableSetsChange(syncedSets);
      }
      
      // Handle sets count change
      if (key === 'sets' && typeof value === 'number') {
        const defaultValues: Partial<SetData> = {};
        if (variableSets[0]) {
          const first = variableSets[0];
          defaultValues.reps = first.reps;
          defaultValues.weight_kg = first.weight_kg;
          defaultValues.percentage = first.percentage;
          defaultValues.rpe = first.rpe;
          defaultValues.tempo = first.tempo;
        }
        const newSets = syncSetsCount(variableSets, value, defaultValues);
        onVariableSetsChange(newSets);
      }
    }
  };

  // Mode lecture seule : afficher les valeurs en badges statiques
  if (readOnly) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {displayConfigs.map((config) => {
          const val = values[config.key];
          if (val === undefined || val === null || val === '') return null;
          const displayVal = config.type === 'time' && typeof val === 'number'
            ? formatSecondsToMinSec(val)
            : val;
          const isLockedByMax = isMaxReps && (config.key === 'rpe' || config.key === 'rir');
          return (
            <div key={config.key} className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md border text-xs",
              isLockedByMax ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800" : "bg-muted/60"
            )}>
              <span className="text-muted-foreground">{config.icon}</span>
              <span className="text-muted-foreground">{config.label}:</span>
              <span className={cn("font-medium", isLockedByMax && "text-red-600 dark:text-red-400 font-bold")}>{displayVal}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        {displayConfigs.map((config) => {
          const isLockedByMax = isMaxReps && (config.key === 'rpe' || config.key === 'rir');
          return (
            <VariableInput
              key={config.key}
              config={config}
              value={values[config.key]}
              onChange={(val) => handleUpdateWithSync(config.key, val)}
              onRemove={() => handleRemove(config.key)}
              compact={compact}
              locked={isLockedByMax}
            />
          );
        })}
        <AddVariableButton
          availableVariables={hiddenVariables}
          onAdd={handleAdd}
        />
      </div>
      
      {/* Variable Sets Table for strength exercises */}
      {supportsVariableSets && showVariableSets && onVariableSetsChange && (
        <VariableSetsTable
          sets={variableSets || createInitialSets(values.sets || 3)}
          onChange={(newSets) => {
            onVariableSetsChange(newSets);
            // Also update the sets count
            onUpdate('sets', newSets.length);
          }}
          columns={STRENGTH_SET_COLUMNS}
          visibleColumns={mapVariablesToColumns(visibleVariables)}
          onVisibleColumnsChange={(newColumns) => {
            // Sync table column changes back to visible variables
            const columnToVariableMap: Record<string, string> = {
              reps: 'reps',
              weight_kg: 'load',
              percentage: 'percentage',
              rpe: 'rpe',
              rir: 'rir',
              tempo: 'tempo',
              rest_seconds: 'restSeconds',
            };
            const newVisibleVars = visibleVariables.filter(v => {
              const colKey = VARIABLE_TO_COLUMN_MAP[v];
              return !colKey || newColumns.includes(colKey);
            });
            // Add any new columns as variables
            for (const col of newColumns) {
              const varKey = columnToVariableMap[col];
              if (varKey && !newVisibleVars.includes(varKey)) {
                newVisibleVars.push(varKey);
              }
            }
            onVisibleVariablesChange(newVisibleVars);
          }}
        />
      )}
    </div>
  );
};

// Hook to manage visible variables state
export const useVisibleVariables = (
  exerciseType: ExerciseType,
  initialVisible?: string[]
) => {
  const [visibleVariables, setVisibleVariables] = useState<string[]>(
    initialVisible ?? getDefaultVisibleVariables(exerciseType)
  );

  return { visibleVariables, setVisibleVariables };
};

export default TrainingVariablesManager;
