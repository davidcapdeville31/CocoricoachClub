import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/ui/numeric-input";
import { Table, Plus, Minus, Copy, ChevronDown, ChevronUp, Rows3 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  SetData,
  SetsTableColumn,
  STRENGTH_SET_COLUMNS,
  createDefaultSet,
  hasVariableValues,
  formatTempo,
} from "@/lib/variableSetsTypes";
import { TimeInput } from "@/components/ui/time-input";

interface VariableSetsTableProps {
  sets: SetData[];
  onChange: (sets: SetData[]) => void;
  columns?: SetsTableColumn[];
  visibleColumns?: string[];
  onVisibleColumnsChange?: (columns: string[]) => void;
  compact?: boolean;
  className?: string;
  disabled?: boolean;
}

export const VariableSetsTable = ({
  sets,
  onChange,
  columns = STRENGTH_SET_COLUMNS,
  visibleColumns,
  onVisibleColumnsChange,
  compact = false,
  className,
  disabled = false,
}: VariableSetsTableProps) => {
  const [isOpen, setIsOpen] = useState(sets.length > 0 && hasVariableValues(sets));
  
  // Default to showing reps, weight, percentage, rpe, tempo
  const activeColumns = visibleColumns 
    ? columns.filter(c => visibleColumns.includes(c.key))
    : columns.filter(c => ['reps', 'weight_kg', 'percentage', 'rpe', 'tempo'].includes(c.key));

  // Helper to safely get set value for input
  const getSetValue = (set: SetData, key: keyof SetData): string | number => {
    const value = set[key];
    if (value === undefined || value === null || typeof value === 'boolean' || Array.isArray(value)) {
      return '';
    }
    return value;
  };

  const handleCellChange = (setIndex: number, key: keyof SetData, value: string) => {
    const newSets = [...sets];
    const column = columns.find(c => c.key === key);
    
    if (column?.type === 'number') {
      const numValue = value === '' ? undefined : parseFloat(value);
      newSets[setIndex] = { ...newSets[setIndex], [key]: numValue };
    } else if (key === 'tempo') {
      // Auto-format tempo
      const formattedTempo = formatTempo(value);
      newSets[setIndex] = { ...newSets[setIndex], [key]: formattedTempo || undefined };
    } else {
      newSets[setIndex] = { ...newSets[setIndex], [key]: value || undefined };
    }
    
    // MAX reps rule: auto-lock RPE=10, RIR=0 for this set
    if (key === 'reps' && value === 'MAX') {
      newSets[setIndex] = { ...newSets[setIndex], rpe: 10, rir: 0 };
    }
    // Deactivating MAX: clear forced RPE/RIR (user can re-enter)
    if (key === 'reps' && sets[setIndex].reps === 'MAX' && value !== 'MAX') {
      newSets[setIndex] = { ...newSets[setIndex], rpe: undefined, rir: undefined };
    }
    
    onChange(newSets);
  };

  const handleAddSet = () => {
    const lastSet = sets[sets.length - 1];
    const newSet = lastSet 
      ? { ...lastSet, setNumber: sets.length + 1 }
      : createDefaultSet(sets.length + 1);
    onChange([...sets, newSet]);
  };

  const handleRemoveSet = (index: number) => {
    const newSets = sets.filter((_, i) => i !== index).map((s, i) => ({
      ...s,
      setNumber: i + 1,
    }));
    onChange(newSets);
  };

  const handleDuplicateSet = (index: number) => {
    const setToCopy = sets[index];
    const newSet = { ...setToCopy, setNumber: sets.length + 1 };
    const newSets = [
      ...sets.slice(0, index + 1),
      newSet,
      ...sets.slice(index + 1),
    ].map((s, i) => ({ ...s, setNumber: i + 1 }));
    onChange(newSets);
  };

  const handleApplyToAll = (sourceIndex: number) => {
    const sourceSet = sets[sourceIndex];
    const newSets = sets.map((s, i) => ({
      ...sourceSet,
      setNumber: i + 1,
    }));
    onChange(newSets);
  };

  // Toggle column visibility
  const toggleColumn = (columnKey: string) => {
    if (!onVisibleColumnsChange) return;
    const current = visibleColumns || activeColumns.map(c => c.key);
    if (current.includes(columnKey)) {
      onVisibleColumnsChange(current.filter(k => k !== columnKey));
    } else {
      onVisibleColumnsChange([...current, columnKey]);
    }
  };

  const hiddenColumns = columns.filter(c => !activeColumns.some(ac => ac.key === c.key));

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <div className="flex items-center gap-2 mb-2">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-7 text-xs gap-1.5 transition-colors",
              isOpen && "bg-primary/10 border-primary/50"
            )}
            disabled={disabled}
          >
            <Rows3 className="h-3.5 w-3.5" />
            <span>Séries variables</span>
            {isOpen ? (
              <ChevronUp className="h-3 w-3 ml-1" />
            ) : (
              <ChevronDown className="h-3 w-3 ml-1" />
            )}
          </Button>
        </CollapsibleTrigger>
        
        {!isOpen && hasVariableValues(sets) && (
          <span className="text-xs text-muted-foreground italic">
            (valeurs différentes par série)
          </span>
        )}
      </div>

      <CollapsibleContent>
        <div className="border rounded-lg overflow-x-auto bg-background/50">
          {/* Header */}
          <div className="flex items-center bg-muted/50 border-b">
            <div className="w-10 px-2 py-1.5 text-[10px] font-medium text-muted-foreground text-center border-r">
              #
            </div>
            {activeColumns.map((col, idx) => (
              <div
                key={col.key}
                className={cn(
                  "px-2 py-1.5 text-[10px] font-medium text-muted-foreground text-center",
                  idx < activeColumns.length - 1 && "border-r"
                )}
                style={{ width: col.width || '70px', minWidth: col.width || '70px' }}
              >
                {col.label}
              </div>
            ))}
            <div className="flex-1 px-2 py-1.5 flex items-center justify-end gap-1">
              {hiddenColumns.length > 0 && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => hiddenColumns[0] && toggleColumn(hiddenColumns[0].key)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <div className="space-y-1">
                        <p className="font-medium">Ajouter une colonne</p>
                        {hiddenColumns.map(col => (
                          <button
                            key={col.key}
                            type="button"
                            className="block w-full text-left px-2 py-1 hover:bg-accent rounded text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleColumn(col.key);
                            }}
                          >
                            {col.label}
                          </button>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* Rows */}
          {sets.map((set, setIndex) => (
            <div
              key={setIndex}
              className={cn(
                "flex items-center group",
                setIndex < sets.length - 1 && "border-b"
              )}
            >
              {/* Set number */}
              <div className="w-10 px-2 py-1 text-xs font-medium text-center text-muted-foreground border-r bg-muted/30">
                {set.setNumber}
              </div>
              
              {/* Value cells */}
              {activeColumns.map((col, idx) => {
                const isSetMaxReps = set.reps === 'MAX';
                const isLockedByMax = isSetMaxReps && (col.key === 'rpe' || col.key === 'rir');
                
                return (
                <div
                  key={col.key}
                  className={cn(
                    "px-1 py-0.5",
                    idx < activeColumns.length - 1 && "border-r"
                  )}
                  style={{ width: col.width || '70px', minWidth: col.width || '70px' }}
                >
                  {isLockedByMax ? (
                    // Locked cell: red, non-editable, physiologically imposed
                    <div className="h-7 flex items-center justify-center rounded-md bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800">
                      <span className="text-xs font-bold text-red-600 dark:text-red-400">
                        {col.key === 'rpe' ? '10' : '0'}
                      </span>
                    </div>
                  ) : col.key === 'rest_seconds' ? (
                    <TimeInput
                      value={typeof set.rest_seconds === 'number' ? set.rest_seconds : undefined}
                      onChange={(seconds) => handleCellChange(setIndex, 'rest_seconds', String(seconds))}
                      disabled={disabled}
                      compact
                    />
                  ) : col.key === 'reps' ? (
                    // Reps with MAX toggle
                    <div className="flex items-center gap-0.5 justify-center">
                      {getSetValue(set, 'reps') === 'MAX' ? (
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={() => handleCellChange(setIndex, 'reps', '')}
                          disabled={disabled}
                          className="h-7 px-2 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold"
                          title="Échec technique (cliquer pour modifier)"
                        >
                          MAX
                        </Button>
                      ) : (
                        <>
                          <NumericInput
                            value={getSetValue(set, 'reps')}
                            onChange={(val) => handleCellChange(setIndex, 'reps', val)}
                            placeholder={col.placeholder}
                            disabled={disabled}
                            minChars={4}
                            maxChars={6}
                            className="text-center"
                          />
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={() => handleCellChange(setIndex, 'reps', 'MAX')}
                            disabled={disabled}
                            className="h-7 px-1.5 text-[9px] font-bold shrink-0 bg-red-600 hover:bg-red-700 text-white"
                            title="Échec technique (MAX)"
                          >
                            MAX
                          </Button>
                        </>
                      )}
                    </div>
                  ) : (
                    <NumericInput
                      value={getSetValue(set, col.key)}
                      onChange={(val) => handleCellChange(setIndex, col.key, val)}
                      placeholder={col.placeholder}
                      disabled={disabled}
                      minChars={col.key === 'tempo' ? 8 : 5}
                      maxChars={col.key === 'tempo' ? 11 : 8}
                      className="text-center"
                    />
                  )}
                </div>
                );
              })}
              
              {/* Row actions */}
              <div className="flex-1 px-1 py-0.5 flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => handleDuplicateSet(setIndex)}
                        disabled={disabled}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Dupliquer cette série
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveSet(setIndex)}
                        disabled={disabled}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Supprimer cette série
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          ))}

          {/* Footer - Add set */}
          <div className="flex items-center justify-between px-2 py-1.5 border-t bg-muted/30">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={handleAddSet}
              disabled={disabled}
            >
              <Plus className="h-3 w-3" />
              Ajouter une série
            </Button>
            
            <span className="text-[10px] text-muted-foreground">
              {sets.length} série{sets.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default VariableSetsTable;
