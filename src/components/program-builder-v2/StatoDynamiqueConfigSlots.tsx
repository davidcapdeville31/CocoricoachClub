import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { X, Check, Timer, Zap, RotateCcw, Dumbbell, Clock, Target, Plus, Trash2, Percent, Weight, Gauge, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { VariableSetsTable } from "./VariableSetsTable";
import { createInitialSets, SetData, STRENGTH_SET_COLUMNS } from "@/lib/variableSetsTypes";
import { syncFieldToSets, syncSetsCount } from "@/lib/variableSetsSync";
import { TimeInput, formatSecondsToTime } from "@/components/ui/time-input";
import { useMethodEditing } from "@/hooks/useMethodEditing";
import { MethodActionButtons } from "./shared/MethodActionButtons";
import { generateMethodNote } from "@/lib/athleteNoteGenerator";
import { AthleteNoteDisplay } from "./AthleteNoteDisplay";

// Stato-Dynamique uses specific columns: reps, weight_kg, rpe, rest_seconds
const STATO_VISIBLE_COLUMNS = ['reps', 'weight_kg', 'rpe', 'rest_seconds'];
import {
  StatoDynamiqueConfig,
  StaticAngleType,
  StaticPhaseTimingType,
  StaticPhaseConfig,
  StatoDynamiqueSequence,
  DynamicAmplitude,
  LoadType,
  AthleteLevel,
  STATIC_ANGLES,
  STATIC_PHASE_TIMING,
  SEQUENCE_TYPES,
  AMPLITUDE_TYPES,
  LOAD_TYPES,
  ATHLETE_LEVELS,
  STATO_PRESETS,
  getDefaultStatoDynamiqueConfig,
  createDefaultStaticPhase,
  formatStatoDynamiqueSummary,
  calculateStatoDynamiqueVolume,
  validateStatoDynamiqueConfig,
} from "@/lib/statoDynamiqueTypes";

interface StatoDynamiqueConfigSlotsProps {
  onValidate: (config: StatoDynamiqueConfig) => void;
  onCancel: () => void;
  initialConfig?: StatoDynamiqueConfig;
  exerciseName?: string;
}

export const StatoDynamiqueConfigSlots = ({
  onValidate,
  onCancel,
  initialConfig,
  exerciseName,
}: StatoDynamiqueConfigSlotsProps) => {
  // Hook centralisé pour gérer édition/lecture seule
  const {
    isEditing,
    enableEditing,
    handleValidate,
    handleCancel,
  } = useMethodEditing<StatoDynamiqueConfig>({
    onValidate,
    onCancel,
    initialConfig,
  });

  const [config, setConfig] = useState<StatoDynamiqueConfig>(
    initialConfig || getDefaultStatoDynamiqueConfig()
  );

  // Apply level preset
  const applyLevelPreset = (level: AthleteLevel) => {
    const preset = STATO_PRESETS[level];
    setConfig(prev => ({
      ...prev,
      athleteLevel: level,
      ...preset,
    }));
  };

  // Add a new static phase
  const addStaticPhase = () => {
    setConfig(prev => ({
      ...prev,
      staticPhases: [...(prev.staticPhases || []), createDefaultStaticPhase()],
    }));
  };

  // Remove a static phase
  const removeStaticPhase = (phaseId: string) => {
    setConfig(prev => ({
      ...prev,
      staticPhases: (prev.staticPhases || []).filter(p => p.id !== phaseId),
    }));
  };

  // Update a specific static phase
  const updateStaticPhase = (phaseId: string, updates: Partial<StaticPhaseConfig>) => {
    setConfig(prev => ({
      ...prev,
      staticPhases: (prev.staticPhases || []).map(p =>
        p.id === phaseId ? { ...p, ...updates } : p
      ),
    }));
  };

  // Helper to update config and sync to variable sets
  const updateConfigWithSync = (updates: Partial<StatoDynamiqueConfig>) => {
    setConfig(prev => {
      const newConfig = { ...prev, ...updates };
      
      // Sync sets count if changed
      if (updates.sets !== undefined && updates.sets !== prev.sets) {
        const defaultValues: Partial<SetData> = {
          reps: String(prev.dynamicReps),
          rpe: prev.targetRpe,
          percentage: prev.loadType === 'pourcentage_1rm' ? prev.loadValue : undefined,
          weight_kg: prev.loadType === 'charge_libre' ? prev.loadValue : undefined,
        };
        newConfig.variableSets = syncSetsCount(prev.variableSets, updates.sets, defaultValues);
      }
      
      // Sync percentage/weight if loadValue changed
      if (updates.loadValue !== undefined || updates.loadType !== undefined) {
        const loadType = updates.loadType ?? prev.loadType;
        const loadValue = updates.loadValue ?? prev.loadValue;
        if (prev.variableSets && prev.variableSets.length > 0) {
          if (loadType === 'pourcentage_1rm') {
            newConfig.variableSets = syncFieldToSets(prev.variableSets, 'percentage', loadValue);
          } else if (loadType === 'charge_libre') {
            newConfig.variableSets = syncFieldToSets(prev.variableSets, 'weight_kg', loadValue);
          }
        }
      }
      
      // Sync RPE if changed
      if (updates.targetRpe !== undefined && prev.variableSets && prev.variableSets.length > 0) {
        newConfig.variableSets = syncFieldToSets(
          newConfig.variableSets || prev.variableSets, 
          'rpe', 
          updates.targetRpe
        );
      }
      
      // Sync reps if dynamicReps changed
      if (updates.dynamicReps !== undefined && prev.variableSets && prev.variableSets.length > 0) {
        newConfig.variableSets = syncFieldToSets(
          newConfig.variableSets || prev.variableSets, 
          'reps', 
          String(updates.dynamicReps)
        );
      }
      
      return newConfig;
    });
  };

  const volume = calculateStatoDynamiqueVolume(config);
  const errors = validateStatoDynamiqueConfig(config);

  return (
    <Card className="border-violet-500/30 bg-violet-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-violet-600" />
            Configuration Stato-Dynamique
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Combinaison de contractions isométriques et dynamiques pour développer la force maximale et l'explosivité
        </p>
        
        {/* Exercise slot */}
        {exerciseName ? (
          <Badge variant="outline" className="w-fit border-violet-500/50 bg-violet-500/10">
            <Dumbbell className="h-3 w-3 mr-1" />
            {exerciseName}
          </Badge>
        ) : (
          <div className="p-3 rounded-lg border-2 border-dashed border-violet-500/30 bg-violet-500/5 text-center">
            <Dumbbell className="h-5 w-5 mx-auto mb-1 text-violet-500/50" />
            <p className="text-sm text-muted-foreground">
              Cliquez sur un exercice de musculation pour le sélectionner
            </p>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-6">
      <div className={cn(!isEditing && "pointer-events-none opacity-70 space-y-6")}>
        {/* Static Phases Configuration */}
        <div className="space-y-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center justify-between">
            <Label className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Phases Isométriques ({(config.staticPhases || []).length})
            </Label>
            <Button
              variant="outline"
              size="sm"
              onClick={addStaticPhase}
              className="h-7 text-xs border-amber-500/50 hover:bg-amber-500/20"
            >
              <Plus className="h-3 w-3 mr-1" />
              Ajouter
            </Button>
          </div>
          
          {/* List of static phases */}
          <div className="space-y-3">
            {(config.staticPhases || []).map((phase, index) => (
              <div 
                key={phase.id} 
                className="p-3 rounded-md bg-amber-500/5 border border-amber-500/30 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs border-amber-500/50">
                    Phase {index + 1}
                  </Badge>
                  {(config.staticPhases || []).length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-destructive/20"
                      onClick={() => removeStaticPhase(phase.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Durée (sec)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={phase.durationSeconds}
                      onChange={(e) => updateStaticPhase(phase.id, {
                        durationSeconds: parseInt(e.target.value) || 5
                      })}
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onFocus={(e) => e.target.select()}
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs">Angulation</Label>
                    <Select 
                      value={phase.angle}
                      onValueChange={(v) => updateStaticPhase(phase.id, {
                        angle: v as StaticAngleType
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATIC_ANGLES) as StaticAngleType[]).map((angle) => (
                          <SelectItem key={angle} value={angle}>
                            {STATIC_ANGLES[angle].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Phase timing selection */}
                <div className="space-y-1">
                  <Label className="text-xs">Moment du maintien</Label>
                  <TooltipProvider delayDuration={200}>
                    <div className="grid grid-cols-3 gap-1">
                      {(Object.keys(STATIC_PHASE_TIMING) as StaticPhaseTimingType[]).map((timing) => (
                        <Tooltip key={timing}>
                          <TooltipTrigger asChild>
                            <Button
                              variant={phase.timing === timing ? "default" : "outline"}
                              size="sm"
                              className={cn(
                                "h-7 text-[10px] px-1",
                                phase.timing === timing && "bg-amber-600 hover:bg-amber-700"
                              )}
                              onClick={() => updateStaticPhase(phase.id, { timing })}
                            >
                              {STATIC_PHASE_TIMING[timing].label.replace('Phase ', '')}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-[200px] text-center">
                            <p className="text-xs">{STATIC_PHASE_TIMING[timing].description}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </TooltipProvider>
                </div>
              </div>
            ))}
          </div>
          
          {(config.staticPhases || []).length === 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Aucune phase isométrique. Cliquez sur "Ajouter" pour en créer une.
            </div>
          )}
        </div>

        {/* Dynamic Phase Configuration */}
        <div className="space-y-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <Label className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Phase Dynamique
          </Label>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Répétitions</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={config.dynamicReps}
                onChange={(e) => updateConfigWithSync({
                  dynamicReps: parseInt(e.target.value) || 8
                })}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
              />
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs">Tempo</Label>
              <Input
                placeholder="2-0-2"
                value={config.dynamicTempo || ''}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  dynamicTempo: e.target.value
                }))}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
              />
            </div>
          </div>
        </div>

        {/* Variables de musculation */}
        <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border/50">
          <Label className="font-semibold flex items-center gap-2">
            <Dumbbell className="h-4 w-4" />
            Variables d'intensité
          </Label>
          
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Percent className="h-3 w-3" />
                % 1RM
              </Label>
              <Input
                type="number"
                min={40}
                max={100}
                placeholder="70"
                value={config.loadType === 'pourcentage_1rm' ? config.loadValue || '' : ''}
                onChange={(e) => updateConfigWithSync({
                  loadType: 'pourcentage_1rm',
                  loadValue: parseFloat(e.target.value) || undefined
                })}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
              />
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Weight className="h-3 w-3" />
                Charge (kg)
              </Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                placeholder="50"
                value={config.loadType === 'charge_libre' ? config.loadValue || '' : ''}
                onChange={(e) => updateConfigWithSync({
                  loadType: 'charge_libre',
                  loadValue: parseFloat(e.target.value) || undefined
                })}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
              />
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Gauge className="h-3 w-3" />
                RPE cible
              </Label>
              <Input
                type="number"
                min={1}
                max={10}
                placeholder="8"
                value={config.targetRpe || ''}
                onChange={(e) => updateConfigWithSync({
                  targetRpe: parseFloat(e.target.value) || undefined
                })}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
              />
            </div>
          </div>
        </div>

        {/* Sets and Recovery */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Nombre de séries
            </Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={config.sets}
              onChange={(e) => updateConfigWithSync({ 
                sets: parseInt(e.target.value) || 3 
              })}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              onWheel={(e) => e.currentTarget.blur()}
            />
          </div>
          
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Repos inter-séries
            </Label>
            <TimeInput
              value={config.restSeconds}
              onChange={(seconds) => setConfig(prev => ({ 
                ...prev, 
                restSeconds: seconds 
              }))}
              min={30}
              max={600}
            />
          </div>
        </div>

        {/* Variable Sets Table */}
        <div className="mt-4">
          <VariableSetsTable
            sets={config.variableSets || createInitialSets(config.sets)}
            onChange={(newSets) => {
              setConfig(prev => ({
                ...prev,
                variableSets: newSets,
                useVariableSets: true,
                sets: newSets.length,
              }));
            }}
            columns={STRENGTH_SET_COLUMNS}
            visibleColumns={STATO_VISIBLE_COLUMNS}
          />
        </div>

        {/* Coach Notes */}
        <div className="space-y-2">
          <Label>Consignes personnalisées (optionnel)</Label>
          <Textarea
            placeholder="Ajoutez des consignes spécifiques pour cette séance..."
            value={config.coachNotes || ''}
            onChange={(e) => setConfig(prev => ({ ...prev, coachNotes: e.target.value }))}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            rows={2}
          />
        </div>

        {/* Summary */}
        <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-violet-700 dark:text-violet-400">
              Résumé de l'exercice
            </span>
            <Badge variant="outline" className="border-violet-500/50 text-violet-700">
              Stato-Dynamique
            </Badge>
          </div>
          <p className="text-sm font-medium">{formatStatoDynamiqueSummary(config)}</p>
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <span>TUT/série: ~{Math.round(volume.totalTUT / config.sets)}s</span>
            <span>TUT total: ~{volume.totalTUT}s</span>
            <span>Reps totales: {volume.totalReps}</span>
          </div>
          {volume.estimatedTonnage && (
            <div className="mt-1 text-xs text-muted-foreground">
              Tonnage estimé: ~{volume.estimatedTonnage}kg
            </div>
          )}
        </div>

        {/* Validation errors */}
        {errors.length > 0 && (
          <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20">
            {errors.map((error, i) => (
              <p key={i} className="text-xs text-destructive">{error}</p>
            ))}
          </div>
        )}

        </div> {/* fin du wrapper pointer-events-none */}

        {/* Note auto-générée pour l'athlète — dynamique, toujours visible */}
        <AthleteNoteDisplay
          note={generateMethodNote({
            methodType: 'stato_dynamique',
            exerciseName,
            statoDynamiqueConfig: {
              sequence: config.sequence,
              sets: config.sets,
              dynamicReps: config.dynamicReps,
              dynamicAmplitude: config.dynamicAmplitude,
              dynamicTempo: config.dynamicTempo,
              loadType: config.loadType,
              loadValue: config.loadValue,
              restSeconds: config.restSeconds,
              staticPhases: (config.staticPhases || []).map(p => ({
                angle: p.angle,
                durationSeconds: p.durationSeconds,
                timing: p.timing,
              })),
              targetRpe: config.targetRpe,
              athleteLevel: config.athleteLevel,
            },
          })}
        />

        {/* Action buttons centralisés - HORS du wrapper pour rester cliquables */}
        <MethodActionButtons
          isEditing={isEditing}
          onValidate={() => handleValidate(config)}
          onEdit={enableEditing}
          onCancel={handleCancel}
          isValid={errors.length === 0 && !!exerciseName}
          methodColor="bg-violet-600 hover:bg-violet-700"
        />
      </CardContent>
    </Card>
  );
};
