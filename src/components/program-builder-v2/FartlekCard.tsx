import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  X, 
  Wind,
  Timer,
  Target,
  Mountain,
  User,
  Zap,
  Clock,
  Edit2,
  Activity
} from "lucide-react";
import {
  FartlekConfig,
  FARTLEK_OBJECTIVES,
  FARTLEK_TERRAINS,
  FARTLEK_STRUCTURES,
  ATHLETE_LEVELS,
  INTENSITY_TYPES,
  RECOVERY_TYPES,
  formatDuration,
  formatFartlekSummary,
  calculateFartlekVolume,
} from "@/lib/program-builder-v2/fartlekTypes";

interface FartlekCardProps {
  config: FartlekConfig;
  onEdit?: () => void;
  onRemove?: () => void;
  compact?: boolean;
  className?: string;
}

export const FartlekCard = ({
  config,
  onEdit,
  onRemove,
  compact = false,
  className,
}: FartlekCardProps) => {
  const volume = calculateFartlekVolume(config);
  
  // Format intensity display for effort phase
  const formatIntensity = () => {
    const phase = config.effortPhases[0];
    if (!phase) return null;
    
    if (phase.intensityType === 'qualitative') {
      return phase.intensityLabel || 'Variable';
    }
    
    const typeInfo = INTENSITY_TYPES[phase.intensityType];
    return phase.intensityValue 
      ? `${phase.intensityValue}${typeInfo.unit}` 
      : null;
  };
  
  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/30",
        className
      )}>
        <div className="p-1.5 rounded-md bg-green-500/20">
          <Wind className="h-4 w-4 text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">
            {formatFartlekSummary(config)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {FARTLEK_OBJECTIVES[config.objective].label}
          </div>
        </div>
        {onEdit && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 hover:bg-green-500/20"
            onClick={onEdit}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        )}
        {onRemove && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 hover:bg-destructive/20"
            onClick={onRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }
  
  return (
    <div className={cn(
      "rounded-lg bg-green-500/5 border-2 border-green-500/30 overflow-hidden",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-500/20 to-green-600/20 border-b border-green-500/20">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-green-500/30">
            <Wind className="h-5 w-5 text-green-700 dark:text-green-400" />
          </div>
          <div>
            <div className="font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
              Fartlek
              <Badge variant="outline" className="text-xs border-green-500/50">
                {FARTLEK_STRUCTURES[config.structureType].label}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {FARTLEK_OBJECTIVES[config.objective].label}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {onEdit && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-green-500/20"
              onClick={onEdit}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
          {onRemove && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-destructive/20"
              onClick={onRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Main structure display */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{config.totalDurationMinutes} min</span>
          </div>
          
          {config.structureType === 'structure' && config.cycles && (
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{config.cycles} cycles</span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <Mountain className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{FARTLEK_TERRAINS[config.terrain]}</span>
          </div>
        </div>
        
        {/* Phases for structured fartlek */}
        {config.structureType === 'structure' && (
          <div className="grid grid-cols-2 gap-2">
            {/* Effort phase */}
            <div className="p-2 rounded-md bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-1 mb-1">
                <Zap className="h-3 w-3 text-red-600" />
                <span className="text-xs font-medium text-red-700 dark:text-red-400">
                  Effort
                </span>
              </div>
              <div className="text-sm font-semibold">
                {formatDuration(config.effortPhases[0]?.durationSeconds || 0)}
              </div>
              {formatIntensity() && (
                <div className="text-xs text-muted-foreground">
                  @ {formatIntensity()}
                </div>
              )}
            </div>
            
            {/* Recovery phase */}
            <div className="p-2 rounded-md bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-1 mb-1">
                <Timer className="h-3 w-3 text-blue-600" />
                <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                  Récup.
                </span>
              </div>
              <div className="text-sm font-semibold">
                {formatDuration(config.recoveryPhases[0]?.durationSeconds || 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                {RECOVERY_TYPES[config.recoveryType]}
              </div>
            </div>
          </div>
        )}
        
        {/* Libre fartlek note */}
        {config.structureType === 'libre' && (
          <div className="p-2 rounded-md bg-muted/50 border border-border/50">
            <p className="text-xs text-muted-foreground italic">
              Variations d'allure selon les sensations, sans structure prédéfinie
            </p>
          </div>
        )}
        
        {/* Volume summary */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
          <span>Travail estimé: ~{Math.round(volume.totalWorkSeconds / 60)} min</span>
          <span>Récup. estimée: ~{Math.round(volume.totalRestSeconds / 60)} min</span>
        </div>
        
        {/* Athlete level if set */}
        {config.athleteLevel && (
          <div className="flex items-center gap-2 text-xs">
            <User className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">
              Niveau: {ATHLETE_LEVELS[config.athleteLevel].label}
            </span>
          </div>
        )}
        
        {/* Coach notes if present */}
        {config.coachNotes && (
          <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
            <div className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
              Consignes coach
            </div>
            <p className="text-xs text-muted-foreground">{config.coachNotes}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FartlekCard;
