import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Check, Clock, Mountain, Zap, Wind, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { InteractiveZone } from "@/components/athlete/DraggableContent";
import { TimeInput } from "@/components/ui/time-input";
import { useMethodEditing } from "@/hooks/useMethodEditing";
import { MethodActionButtons } from "./shared/MethodActionButtons";
import { generateMethodNote } from "@/lib/athleteNoteGenerator";
import { AthleteNoteDisplay } from "./AthleteNoteDisplay";
import {
  FartlekConfig,
  FartlekStructureType,
  FartlekTerrain,
  FartlekIntensityType,
  FartlekRecoveryType,
  FARTLEK_TERRAINS,
  FARTLEK_STRUCTURES,
  INTENSITY_TYPES,
  RECOVERY_TYPES,
  getDefaultFartlekConfig,
  formatFartlekSummary,
  calculateFartlekVolume,
} from "@/lib/fartlekTypes";

// Custom number input that disables scroll wheel, selects all on click, and prevents drag
const NumberInput = ({ 
  value, 
  onChange, 
  disabled,
  ...props 
}: React.ComponentProps<typeof Input> & { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; disabled?: boolean }) => {
  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    (e.target as HTMLInputElement).blur();
    e.preventDefault();
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  // Prevent drag when interacting with input
  const handlePointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
    e.stopPropagation();
  };

  return (
    <Input
      {...props}
      type="number"
      value={value}
      onChange={onChange}
      onWheel={handleWheel}
      onFocus={handleFocus}
      onPointerDown={handlePointerDown}
      disabled={disabled}
    />
  );
};

interface FartlekConfigSlotsProps {
  onValidate: (config: FartlekConfig) => void;
  onCancel: () => void;
  initialConfig?: FartlekConfig;
}

export const FartlekConfigSlots = ({
  onValidate,
  onCancel,
  initialConfig,
}: FartlekConfigSlotsProps) => {
  // Hook centralisé pour gérer édition/lecture seule
  const {
    isEditing,
    enableEditing,
    handleValidate,
    handleCancel,
  } = useMethodEditing<FartlekConfig>({
    onValidate,
    onCancel,
    initialConfig,
  });

  const [config, setConfig] = useState<FartlekConfig>(() => {
    if (initialConfig) return initialConfig;
    const defaultConfig = getDefaultFartlekConfig();
    return {
      ...defaultConfig,
      effortPhases: [{ durationSeconds: 0, intensityType: 'rpe' as FartlekIntensityType }],
      recoveryPhases: [{ durationSeconds: 0, intensityType: 'rpe' as FartlekIntensityType }],
      cycles: undefined,
      totalDurationMinutes: 0,
    };
  });

  // Local input states to allow empty fields
  const [cyclesInput, setCyclesInput] = useState<string>(
    initialConfig?.cycles?.toString() || ''
  );

  // Update config when cycles changes
  useEffect(() => {
    const numValue = cyclesInput === '' ? undefined : parseInt(cyclesInput) || undefined;
    setConfig(prev => ({ ...prev, cycles: numValue }));
  }, [cyclesInput]);

  // Auto-calculate total duration when cycles or phase durations change
  useEffect(() => {
    if (config.structureType === 'structure' && config.cycles) {
      const effortDuration = config.effortPhases[0]?.durationSeconds || 0;
      const recoveryDuration = config.recoveryPhases[0]?.durationSeconds || 0;
      const totalSeconds = config.cycles * (effortDuration + recoveryDuration);
      const totalMinutes = Math.ceil(totalSeconds / 60);
      
      if (totalMinutes !== config.totalDurationMinutes) {
        setConfig(prev => ({ ...prev, totalDurationMinutes: totalMinutes }));
      }
    }
  }, [config.cycles, config.effortPhases, config.recoveryPhases, config.structureType]);

  const volume = calculateFartlekVolume(config);

  return (
    <Card className="border-green-500/30 bg-green-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wind className="h-5 w-5 text-green-600" />
            Configuration Fartlek
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Alternance libre ou structurée d'efforts variables et de récupérations actives
        </p>
      </CardHeader>
      
      <InteractiveZone>
        <CardContent className="space-y-6">
        <div className={cn(!isEditing && "pointer-events-none opacity-70 space-y-6")}>
        {/* Structure Type */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Type de structure
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(FARTLEK_STRUCTURES) as FartlekStructureType[]).map((type) => (
              <button
                key={type}
                type="button"
                className={cn(
                  "h-auto py-3 px-4 flex flex-col items-start rounded-lg border transition-colors text-left",
                  config.structureType === type 
                    ? "bg-green-600 text-white border-green-600" 
                    : "bg-background border-input hover:bg-accent hover:text-accent-foreground"
                )}
                onClick={() => setConfig(prev => ({ ...prev, structureType: type }))}
              >
                <span className="font-semibold text-sm">{FARTLEK_STRUCTURES[type].label}</span>
                <span className={cn(
                  "text-xs mt-1",
                  config.structureType === type ? "text-white/80" : "text-muted-foreground"
                )}>
                  {FARTLEK_STRUCTURES[type].description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Objective removed as requested */}

        {/* Duration and Cycles */}
        <div className="grid grid-cols-2 gap-4">
          {config.structureType === 'structure' ? (
            <>
              <div className="space-y-2">
                <Label>Nombre de cycles</Label>
                <NumberInput
                  min={1}
                  max={20}
                  value={cyclesInput}
                  onChange={(e) => setCyclesInput(e.target.value)}
                  placeholder="Ex: 6"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Durée totale (calculée)
                </Label>
                <div className="h-10 px-3 py-2 rounded-lg border bg-muted/50 flex items-center text-sm">
                  {config.totalDurationMinutes} min
                </div>
                <p className="text-xs text-muted-foreground">
                  Calculée automatiquement
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Durée totale (min)
                </Label>
                <Input
                  type="number"
                  min={15}
                  max={90}
                  value={config.totalDurationMinutes}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    totalDurationMinutes: parseInt(e.target.value) || 30 
                  }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Type de récupération</Label>
                <Select 
                  value={config.recoveryType}
                  onValueChange={(v) => setConfig(prev => ({
                    ...prev,
                    recoveryType: v as FartlekRecoveryType
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(RECOVERY_TYPES) as FartlekRecoveryType[]).map((type) => (
                      <SelectItem key={type} value={type}>
                        {RECOVERY_TYPES[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        {/* Structured phases - only show for structured type */}
        {config.structureType === 'structure' && (
          <>
            {/* Effort Phase */}
            <div className="space-y-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <Label className="font-semibold text-red-700 dark:text-red-400">
                Phase d'effort
              </Label>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Durée effort</Label>
                  <TimeInput
                    value={config.effortPhases[0]?.durationSeconds || 0}
                    onChange={(seconds) => setConfig(prev => ({
                      ...prev,
                      effortPhases: [{
                        ...prev.effortPhases[0],
                        durationSeconds: seconds
                      }]
                    }))}
                    min={0}
                    max={600}
                    compact
                  />
                </div>
                
                <div className="space-y-1">
                  <Label className="text-xs">Type d'intensité</Label>
                  <Select 
                    value={config.effortPhases[0]?.intensityType || 'rpe'}
                    onValueChange={(v) => setConfig(prev => ({
                      ...prev,
                      effortPhases: [{
                        ...prev.effortPhases[0],
                        intensityType: v as FartlekIntensityType
                      }]
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(INTENSITY_TYPES) as FartlekIntensityType[]).map((type) => (
                        <SelectItem key={type} value={type}>
                          {INTENSITY_TYPES[type].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Intensity value input */}
              {config.effortPhases[0]?.intensityType !== 'qualitative' ? (
                <div className="space-y-1">
                  <Label className="text-xs">
                    Intensité ({INTENSITY_TYPES[config.effortPhases[0]?.intensityType || 'rpe'].unit})
                  </Label>
                  <Input
                    type="number"
                    placeholder={INTENSITY_TYPES[config.effortPhases[0]?.intensityType || 'rpe'].placeholder}
                    value={config.effortPhases[0]?.intensityValue ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setConfig(prev => ({
                        ...prev,
                        effortPhases: [{
                          ...prev.effortPhases[0],
                          intensityValue: val === '' ? undefined : parseFloat(val) || undefined
                        }]
                      }));
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Consigne qualitative</Label>
                  <Input
                    placeholder="Ex: Sprint court, Allure rapide..."
                    value={config.effortPhases[0]?.intensityLabel || ''}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      effortPhases: [{
                        ...prev.effortPhases[0],
                        intensityLabel: e.target.value
                      }]
                    }))}
                  />
                </div>
              )}

              {/* Target Speed and Heart Rate for effort */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-red-500/20">
                <div className="space-y-1">
                  <Label className="text-xs">Vitesse cible (km/h)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min={0}
                    max={30}
                    value={config.effortPhases[0]?.targetSpeed ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setConfig(prev => ({
                        ...prev,
                        effortPhases: [{
                          ...prev.effortPhases[0],
                          targetSpeed: val === '' ? undefined : parseFloat(val) || undefined
                        }]
                      }));
                    }}
                    placeholder="Ex: 14.5"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">FC cible (bpm)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={220}
                    value={config.effortPhases[0]?.targetHeartRate ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setConfig(prev => ({
                        ...prev,
                        effortPhases: [{
                          ...prev.effortPhases[0],
                          targetHeartRate: val === '' ? undefined : parseInt(val) || undefined
                        }]
                      }));
                    }}
                    placeholder="Ex: 165"
                  />
                </div>
              </div>
            </div>

            {/* Recovery Phase */}
            <div className="space-y-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Label className="font-semibold text-blue-700 dark:text-blue-400">
                Phase de récupération
              </Label>
              
              <div className="space-y-1">
                <Label className="text-xs">Durée récupération</Label>
                <TimeInput
                  value={config.recoveryPhases[0]?.durationSeconds || 0}
                  onChange={(seconds) => setConfig(prev => ({
                    ...prev,
                    recoveryPhases: [{
                      ...prev.recoveryPhases[0],
                      durationSeconds: seconds
                    }]
                  }))}
                  min={0}
                  max={600}
                  compact
                />
              </div>

              {/* Target Speed and Heart Rate for recovery */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-blue-500/20">
                <div className="space-y-1">
                  <Label className="text-xs">Vitesse cible (km/h)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min={0}
                    max={20}
                    value={config.recoveryPhases[0]?.targetSpeed ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setConfig(prev => ({
                        ...prev,
                        recoveryPhases: [{
                          ...prev.recoveryPhases[0],
                          targetSpeed: val === '' ? undefined : parseFloat(val) || undefined
                        }]
                      }));
                    }}
                    placeholder="Ex: 8.0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">FC cible (bpm)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={200}
                    value={config.recoveryPhases[0]?.targetHeartRate ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setConfig(prev => ({
                        ...prev,
                        recoveryPhases: [{
                          ...prev.recoveryPhases[0],
                          targetHeartRate: val === '' ? undefined : parseInt(val) || undefined
                        }]
                      }));
                    }}
                    placeholder="Ex: 130"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Terrain */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Mountain className="h-4 w-4" />
            Terrain / Contexte
          </Label>
          <Select 
            value={config.terrain}
            onValueChange={(v) => setConfig(prev => ({ ...prev, terrain: v as FartlekTerrain }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FARTLEK_TERRAINS) as FartlekTerrain[]).map((terrain) => (
                <SelectItem key={terrain} value={terrain}>
                  {FARTLEK_TERRAINS[terrain]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>


        {/* Coach Notes */}
        <div className="space-y-2">
          <Label>Consignes personnalisées (optionnel)</Label>
          <Textarea
            placeholder="Ajoutez des consignes spécifiques pour cette séance..."
            value={config.coachNotes || ''}
            onChange={(e) => setConfig(prev => ({ ...prev, coachNotes: e.target.value }))}
            rows={2}
          />
        </div>

        {/* Summary */}
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
          <span className="text-sm font-medium text-green-700 dark:text-green-400">
            Résumé de la séance
          </span>
          <p className="text-sm font-medium mt-1">{formatFartlekSummary(config)}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span>Effort: {Math.round(volume.totalWorkSeconds / 60)} min</span>
            </div>
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Récup: {Math.round(volume.totalRestSeconds / 60)} min</span>
            </div>
          </div>
          
          {/* Target speed and heart rate details */}
          {config.structureType === 'structure' && (
            <div className="mt-3 pt-2 border-t border-green-500/20 grid grid-cols-2 gap-2 text-xs">
              {/* Effort targets */}
              <div className="space-y-1">
                <span className="font-medium text-red-600 dark:text-red-400">Effort:</span>
                {config.effortPhases[0]?.targetSpeed && (
                  <div className="text-muted-foreground">Vitesse: {config.effortPhases[0].targetSpeed} km/h</div>
                )}
                {config.effortPhases[0]?.targetHeartRate && (
                  <div className="text-muted-foreground">FC: {config.effortPhases[0].targetHeartRate} bpm</div>
                )}
                {!config.effortPhases[0]?.targetSpeed && !config.effortPhases[0]?.targetHeartRate && (
                  <div className="text-muted-foreground italic">Non défini</div>
                )}
              </div>
              
              {/* Recovery targets */}
              <div className="space-y-1">
                <span className="font-medium text-blue-600 dark:text-blue-400">Récup:</span>
                {config.recoveryPhases[0]?.targetSpeed && (
                  <div className="text-muted-foreground">Vitesse: {config.recoveryPhases[0].targetSpeed} km/h</div>
                )}
                {config.recoveryPhases[0]?.targetHeartRate && (
                  <div className="text-muted-foreground">FC: {config.recoveryPhases[0].targetHeartRate} bpm</div>
                )}
                {!config.recoveryPhases[0]?.targetSpeed && !config.recoveryPhases[0]?.targetHeartRate && (
                  <div className="text-muted-foreground italic">Non défini</div>
                )}
              </div>
            </div>
          )}
        </div>

        </div> {/* fin du wrapper pointer-events-none */}

        {/* Note auto-générée pour l'athlète — dynamique, toujours visible */}
        <AthleteNoteDisplay
          note={generateMethodNote({
            methodType: 'fartlek',
            fartlekConfig: {
              totalDurationMinutes: config.totalDurationMinutes,
              structureType: config.structureType,
              terrain: config.terrain,
              cycles: config.cycles,
              effortPhases: config.effortPhases,
              recoveryPhases: config.recoveryPhases,
              recoveryType: config.recoveryType,
            },
          })}
        />
        {/* Action buttons centralisés - HORS du wrapper pour rester cliquables */}
        <MethodActionButtons
          isEditing={isEditing}
          onValidate={() => handleValidate(config)}
          onEdit={enableEditing}
          onCancel={handleCancel}
          isValid={true}
          methodColor="bg-green-600 hover:bg-green-700"
        />
        </CardContent>
      </InteractiveZone>
    </Card>
  );
};
