import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  X, 
  Bike, 
  Waves, 
  PersonStanding,
  Timer,
  MapPin,
  Repeat,
  Hash,
  Heart,
  Gauge,
  Zap,
  Activity,
  Clock,
  Check,
  ChevronDown,
  Pencil
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  IntermittentCardioSupport,
  IntermittentCardioConfig,
  EffortMode,
  INTENSITY_OPTIONS_BY_SUPPORT,
  SUPPORT_CONFIG,
  getDefaultIntermittentConfig,
  formatPace,
  parsePace,
  calculateIntermittentVolume,
  formatIntermittentSummary,
} from "@/lib/program-builder-v2/intermittentCardioTypes";
import { TimeInput } from "@/components/ui/time-input";
import { useMethodEditing } from "@/hooks/program-builder-v2/useMethodEditing";
import { MethodActionButtons } from "./shared/MethodActionButtons";
import { generateMethodNote } from "@/lib/program-builder-v2/athleteNoteGenerator";
import { AthleteNoteDisplay } from "./AthleteNoteDisplay";

interface IntermittentCardioConfigSlotsProps {
  onConfirm: (config: IntermittentCardioConfig) => void;
  onCancel: () => void;
  initialConfig?: Partial<IntermittentCardioConfig>;
}

// Icon mapping for supports
const SUPPORT_ICONS: Record<IntermittentCardioSupport, React.ReactNode> = {
  running: <PersonStanding className="h-5 w-5" />,
  cycling: <Bike className="h-5 w-5" />,
  swimming: <Waves className="h-5 w-5" />,
};

export const IntermittentCardioConfigSlots = ({
  onConfirm,
  onCancel,
  initialConfig,
}: IntermittentCardioConfigSlotsProps) => {
  // Hook centralisé pour gérer édition/lecture seule
  const {
    isEditing,
    enableEditing,
    handleValidate,
    handleCancel,
  } = useMethodEditing<IntermittentCardioConfig>({
    onValidate: onConfirm,
    onCancel,
    initialConfig: initialConfig ? { ...getDefaultIntermittentConfig(), ...initialConfig } : undefined,
  });

  const [config, setConfig] = useState<IntermittentCardioConfig>(
    initialConfig ? { ...getDefaultIntermittentConfig(), ...initialConfig } : getDefaultIntermittentConfig()
  );
  
  const supportConfig = SUPPORT_CONFIG[config.support];
  const intensityOptions = INTENSITY_OPTIONS_BY_SUPPORT[config.support];
  const selectedIntensity = intensityOptions.find(i => i.type === config.intensityType) || intensityOptions[0];
  
  // Calculate volume preview
  const volumePreview = calculateIntermittentVolume(config);
  
  const handleSupportChange = (support: IntermittentCardioSupport) => {
    if (!isEditing) return;
    const defaultConfig = getDefaultIntermittentConfig(support);
    setConfig({
      ...config,
      support,
      intensityType: defaultConfig.intensityType,
      intensityValue: defaultConfig.intensityValue,
    });
  };
  
  const updateConfig = (updates: Partial<IntermittentCardioConfig>) => {
    if (!isEditing) return;
    setConfig(prev => ({ ...prev, ...updates }));
  };
  
  return (
    <div className="space-y-4 p-4 border rounded-xl bg-card shadow-lg border-sky-500/30">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-sky-500/20">
            <Activity className="h-5 w-5 text-sky-600" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Intermittent Cardio</h3>
            <p className="text-xs text-muted-foreground">Configuration de l'intervalle</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Contenu verrouillé après validation */}
      <div className={cn(!isEditing && "pointer-events-none opacity-70")}>
      {/* Support Selection */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Support (obligatoire)</Label>
        <div className="flex gap-2">
          {(Object.keys(SUPPORT_CONFIG) as IntermittentCardioSupport[]).map((support) => (
            <Button
              key={support}
              type="button"
              variant={config.support === support ? "default" : "outline"}
              size="sm"
              onClick={() => handleSupportChange(support)}
              className={cn(
                "flex-1 gap-2",
                config.support === support && "bg-sky-500 hover:bg-sky-600"
              )}
            >
              {SUPPORT_ICONS[support]}
              <span className="hidden sm:inline">{SUPPORT_CONFIG[support].label}</span>
            </Button>
          ))}
        </div>
      </div>
      
      {/* Structure: Reps & Series */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <Repeat className="h-3 w-3" />
            Répétitions
          </Label>
          <Input
            type="number"
            min={1}
            max={50}
            value={config.repetitions}
            onChange={(e) => updateConfig({ repetitions: parseInt(e.target.value) || 1 })}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onFocus={(e) => e.target.select()}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <Hash className="h-3 w-3" />
            Séries
          </Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={config.series}
            onChange={(e) => updateConfig({ series: parseInt(e.target.value) || 1 })}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onFocus={(e) => e.target.select()}
            className="h-9"
          />
        </div>
      </div>
      
      {/* Effort Configuration */}
      <div className="space-y-2 p-3 bg-red-500/5 rounded-lg border border-red-500/20">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-red-600 flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Effort
          </Label>
          <Tabs 
            value={config.effortMode} 
            onValueChange={(v) => updateConfig({ effortMode: v as EffortMode })}
            className="h-7"
          >
            <TabsList className="h-7 p-0.5">
              <TabsTrigger value="duration" className="h-6 text-xs px-2 gap-1">
                <Timer className="h-3 w-3" />
                Temps
              </TabsTrigger>
              <TabsTrigger value="distance" className="h-6 text-xs px-2 gap-1">
                <MapPin className="h-3 w-3" />
                Distance
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {config.effortMode === 'duration' ? (
          <TimeInput
            value={config.effortDurationSeconds || 0}
            onChange={(s) => updateConfig({ effortDurationSeconds: s })}
            label="Durée effort"
            compact
          />
        ) : (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Distance ({supportConfig.distanceUnitShort})</Label>
            <Input
              type="number"
              min={0}
              value={config.effortDistanceMeters || ''}
              onChange={(e) => updateConfig({ effortDistanceMeters: parseInt(e.target.value) || 0 })}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              placeholder={supportConfig.defaultEffortDistance.toString()}
              className="h-9"
            />
          </div>
        )}
      </div>
      
      {/* Recovery Configuration */}
      <div className="space-y-2 p-3 bg-green-500/5 rounded-lg border border-green-500/20">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-green-600 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Récupération
          </Label>
          <Tabs 
            value={config.recoveryMode} 
            onValueChange={(v) => updateConfig({ recoveryMode: v as EffortMode })}
            className="h-7"
          >
            <TabsList className="h-7 p-0.5">
              <TabsTrigger value="duration" className="h-6 text-xs px-2 gap-1">
                <Timer className="h-3 w-3" />
                Temps
              </TabsTrigger>
              <TabsTrigger value="distance" className="h-6 text-xs px-2 gap-1">
                <MapPin className="h-3 w-3" />
                Distance
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {config.recoveryMode === 'duration' ? (
          <TimeInput
            value={config.recoveryDurationSeconds || 0}
            onChange={(s) => updateConfig({ recoveryDurationSeconds: s })}
            label="Durée récupération"
            compact
          />
        ) : (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Distance ({supportConfig.distanceUnitShort})</Label>
            <Input
              type="number"
              min={0}
              value={config.recoveryDistanceMeters || ''}
              onChange={(e) => updateConfig({ recoveryDistanceMeters: parseInt(e.target.value) || 0 })}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              placeholder={supportConfig.defaultRecoveryDistance.toString()}
              className="h-9"
            />
          </div>
        )}
      </div>
      
      {/* Inter-series Recovery */}
      {config.series > 1 && (
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Récupération inter-séries
          </Label>
          <TimeInput
            value={config.interSeriesRecoverySeconds}
            onChange={(s) => updateConfig({ interSeriesRecoverySeconds: s })}
            compact
          />
        </div>
      )}
      
      {/* Intensity */}
      <div className="space-y-2 p-3 bg-amber-500/5 rounded-lg border border-amber-500/20">
        <Label className="text-xs font-medium text-amber-600 flex items-center gap-1">
          <Gauge className="h-3 w-3" />
          Intensité
        </Label>
        
        <div className="grid grid-cols-2 gap-2">
          <Select 
            value={config.intensityType} 
            onValueChange={(v) => updateConfig({ 
              intensityType: v as typeof config.intensityType,
              intensityValue: undefined 
            })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {intensityOptions.map((opt) => (
                <SelectItem key={opt.type} value={opt.type}>
                  {opt.label} ({opt.unit})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedIntensity.type === 'pace' ? (
            <TimeInput
              value={config.intensityValue || 0}
              onChange={(s) => updateConfig({ intensityValue: s })}
              compact
            />
          ) : (
            <Input
              type="number"
              min={selectedIntensity.min}
              max={selectedIntensity.max}
              step={selectedIntensity.step}
              value={config.intensityValue || ''}
              onChange={(e) => updateConfig({ intensityValue: parseFloat(e.target.value) || undefined })}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              placeholder={selectedIntensity.placeholder}
              className="h-9"
            />
          )}
        </div>
        
        {/* RPE and HR (optional, always available) */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-500/10">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Gauge className="h-3 w-3" />
              RPE cible
            </Label>
            <Input
              type="number"
              min={1}
              max={10}
              step={0.5}
              value={config.targetRpe || ''}
              onChange={(e) => updateConfig({ targetRpe: parseFloat(e.target.value) || undefined })}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              placeholder="8"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Heart className="h-3 w-3" />
              FC cible (bpm)
            </Label>
            <Input
              type="number"
              min={60}
              max={220}
              value={config.targetHr || ''}
              onChange={(e) => updateConfig({ targetHr: parseInt(e.target.value) || undefined })}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              placeholder="160"
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>
      
      {/* Preview Summary */}
      <div className="p-3 bg-muted/50 rounded-lg border">
        <div className="text-xs text-muted-foreground mb-1">Aperçu</div>
        <div className="text-sm font-medium">{formatIntermittentSummary(config)}</div>
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          <span>≈ {Math.ceil(volumePreview.totalDurationSeconds / 60)} min total</span>
          {volumePreview.totalDistanceMeters > 0 && (
            <span>≈ {volumePreview.totalDistanceMeters}{supportConfig.distanceUnitShort}</span>
          )}
        </div>
      </div>
      </div> {/* fin du wrapper pointer-events-none */}
      
      {/* Note auto-générée pour l'athlète — dynamique, toujours visible */}
      <AthleteNoteDisplay
        note={generateMethodNote({
          methodType: 'intermittent_cardio',
          intermittentCardioConfig: {
            support: config.support,
            totalSets: config.series * config.repetitions,
            effortDurationSeconds: config.effortDurationSeconds || 0,
            recoveryDurationSeconds: config.recoveryDurationSeconds || 0,
            effortMode: config.intensityType,
            effortValue: config.intensityValue,
            targetHeartRate: config.targetHr,
          },
        })}
      />
      {/* Actions centralisées */}
      <MethodActionButtons
        isEditing={isEditing}
        onValidate={() => handleValidate(config)}
        onEdit={enableEditing}
        onCancel={handleCancel}
        isValid={true}
        methodColor="bg-sky-500 hover:bg-sky-600"
      />
    </div>
  );
};

export default IntermittentCardioConfigSlots;
