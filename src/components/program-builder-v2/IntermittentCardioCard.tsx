import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X, Bike, Waves, PersonStanding, Timer, MapPin, Repeat, Hash, Heart, Gauge, Zap, Activity, Clock, Edit2,
} from "lucide-react";
import {
  IntermittentCardioConfig,
  SUPPORT_CONFIG,
  formatPace,
  calculateIntermittentVolume,
  INTENSITY_OPTIONS_BY_SUPPORT,
} from "./lib/intermittentCardioTypes";

interface IntermittentCardioCardProps {
  config: IntermittentCardioConfig;
  onEdit?: () => void;
  onRemove?: () => void;
  compact?: boolean;
  className?: string;
}

const SUPPORT_ICONS: Record<string, React.ReactNode> = {
  running: <PersonStanding className="h-4 w-4" />,
  cycling: <Bike className="h-4 w-4" />,
  swimming: <Waves className="h-4 w-4" />,
};

export const IntermittentCardioCard = ({
  config, onEdit, onRemove, compact = false, className,
}: IntermittentCardioCardProps) => {
  const supportConfig = SUPPORT_CONFIG[config.support];
  const volume = calculateIntermittentVolume(config);
  const intensityOption = INTENSITY_OPTIONS_BY_SUPPORT[config.support].find(i => i.type === config.intensityType);

  const formatEffortRecovery = () => {
    const effort = config.effortMode === 'duration'
      ? formatPace(config.effortDurationSeconds || 0)
      : `${config.effortDistanceMeters}${supportConfig.distanceUnitShort}`;
    const recovery = config.recoveryMode === 'duration'
      ? formatPace(config.recoveryDurationSeconds || 0)
      : `${config.recoveryDistanceMeters}${supportConfig.distanceUnitShort}`;
    return { effort, recovery };
  };

  const { effort, recovery } = formatEffortRecovery();

  const formatIntensity = () => {
    if (!config.intensityValue) return null;
    if (config.intensityType === 'pace') return `${formatPace(config.intensityValue)} ${intensityOption?.unit || ''}`;
    return `${config.intensityValue}${intensityOption?.unit || ''}`;
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 p-2 rounded-lg bg-sky-500/10 border border-sky-500/30", className)}>
        <div className="p-1.5 rounded-md bg-sky-500/20">{SUPPORT_ICONS[config.support]}</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">
            {config.series > 1
              ? `${config.series}×${config.repetitions}×(${effort}/${recovery})`
              : `${config.repetitions}×(${effort}/${recovery})`}
          </div>
          <div className="text-xs text-muted-foreground">
            {supportConfig.label}{formatIntensity() && ` • ${formatIntensity()}`}
          </div>
        </div>
        {onRemove && (
          <Button variant="ghost" size="icon" onClick={onRemove} className="h-6 w-6 shrink-0">
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border-2 border-sky-500/40 bg-gradient-to-br from-sky-500/5 to-sky-500/10 overflow-hidden", className)}>
      <div className="flex items-center justify-between px-3 py-2 bg-sky-500/20 border-b border-sky-500/20">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-sky-500/30">
            <Activity className="h-4 w-4 text-sky-600" />
          </div>
          <span className="font-semibold text-sm text-sky-700 dark:text-sky-300">Intermittent Cardio</span>
          <Badge variant="secondary" className="text-xs gap-1">
            {SUPPORT_ICONS[config.support]}{supportConfig.label}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {onEdit && <Button variant="ghost" size="icon" onClick={onEdit} className="h-7 w-7"><Edit2 className="h-3.5 w-3.5" /></Button>}
          {onRemove && <Button variant="ghost" size="icon" onClick={onRemove} className="h-7 w-7 hover:bg-destructive/20"><X className="h-3.5 w-3.5" /></Button>}
        </div>
      </div>
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Repeat className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Répétitions:</span>
            <span className="font-medium">{config.repetitions}</span>
          </div>
          {config.series > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Séries:</span>
              <span className="font-medium">{config.series}</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-1.5 text-xs text-red-600 mb-1"><Zap className="h-3 w-3" />Effort</div>
            <div className="font-medium text-sm">{effort}</div>
          </div>
          <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-1.5 text-xs text-green-600 mb-1"><Clock className="h-3 w-3" />Récupération</div>
            <div className="font-medium text-sm">{recovery}</div>
          </div>
        </div>
        {config.series > 1 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Timer className="h-4 w-4" />
            Repos inter-séries: <span className="font-medium text-foreground">{formatPace(config.interSeriesRecoverySeconds)}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {formatIntensity() && (
            <Badge variant="outline" className="gap-1 bg-amber-500/10 border-amber-500/30">
              <Gauge className="h-3 w-3" />{intensityOption?.label}: {formatIntensity()}
            </Badge>
          )}
          {config.targetRpe && <Badge variant="outline" className="gap-1"><Gauge className="h-3 w-3" />RPE cible: {config.targetRpe}</Badge>}
          {config.targetHr && <Badge variant="outline" className="gap-1"><Heart className="h-3 w-3" />FC: {config.targetHr} bpm</Badge>}
        </div>
        <div className="pt-2 border-t text-xs text-muted-foreground flex items-center gap-4">
          <span className="flex items-center gap-1"><Timer className="h-3 w-3" />≈ {Math.ceil(volume.totalDurationSeconds / 60)} min</span>
          {volume.totalDistanceMeters > 0 && (
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />≈ {volume.totalDistanceMeters}{supportConfig.distanceUnitShort}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntermittentCardioCard;
