import { TrainingStyleCharacteristics } from "@/lib/program-builder-v2/trainingStyles";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle } from "lucide-react";

interface TrainingStyleCharacteristicsDisplayProps {
  characteristics: TrainingStyleCharacteristics;
  compact?: boolean;
}

const RatingDots = ({ value, maxValue = 5 }: { value: number; maxValue?: number }) => {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: maxValue }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-3 h-3 rounded-sm transition-colors",
            i < value 
              ? i < 2 ? "bg-orange-400" : i < 4 ? "bg-orange-500" : "bg-red-500"
              : "bg-muted"
          )}
        />
      ))}
    </div>
  );
};

const CharacteristicRow = ({ 
  label, 
  value, 
  compact 
}: { 
  label: string; 
  value: number;
  compact?: boolean;
}) => (
  <div className={cn("flex items-center justify-between", compact ? "py-0.5" : "py-1")}>
    <span className={cn("text-muted-foreground", compact ? "text-[10px]" : "text-xs")}>
      {label}
    </span>
    <RatingDots value={value} />
  </div>
);

const MethodCheckbox = ({ 
  label, 
  checked,
  compact 
}: { 
  label: string; 
  checked: boolean;
  compact?: boolean;
}) => (
  <div className="flex items-center gap-2">
    {checked ? (
      <CheckCircle2 className={cn("text-primary", compact ? "h-3 w-3" : "h-4 w-4")} />
    ) : (
      <Circle className={cn("text-muted-foreground", compact ? "h-3 w-3" : "h-4 w-4")} />
    )}
    <span className={cn(
      checked ? "text-foreground" : "text-muted-foreground",
      compact ? "text-[10px]" : "text-xs"
    )}>
      {label}
    </span>
  </div>
);

export const TrainingStyleCharacteristicsDisplay = ({ 
  characteristics,
  compact = false 
}: TrainingStyleCharacteristicsDisplayProps) => {
  return (
    <div className={cn("space-y-1", compact ? "p-2" : "p-3")}>
      <CharacteristicRow label="Effort perçu" value={characteristics.effortPercu} compact={compact} />
      <CharacteristicRow label="Effet sur l'hypertrophie" value={characteristics.hypertrophie} compact={compact} />
      <CharacteristicRow label="Effet sur la force et puissance" value={characteristics.forcePuissance} compact={compact} />
      <CharacteristicRow label="Effet sur l'endurance musculaire" value={characteristics.enduranceMusculaire} compact={compact} />
      <CharacteristicRow label="Effet sur la vitesse" value={characteristics.vitesse} compact={compact} />
      <CharacteristicRow label="Stress nerveux" value={characteristics.stressNerveux} compact={compact} />
      <CharacteristicRow label="Stress mécanique" value={characteristics.stressMecanique} compact={compact} />
      <CharacteristicRow label="Expérience requise" value={characteristics.experienceRequise} compact={compact} />
      
      <div className={cn("border-t pt-2 mt-2 space-y-1", compact ? "border-border/50" : "border-border")}>
        <MethodCheckbox 
          label="Méthode d'accumulation" 
          checked={characteristics.methodeAccumulation} 
          compact={compact}
        />
        <MethodCheckbox 
          label="Méthode d'intensification" 
          checked={characteristics.methodeIntensification} 
          compact={compact}
        />
      </div>
    </div>
  );
};

export default TrainingStyleCharacteristicsDisplay;
