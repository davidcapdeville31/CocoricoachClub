import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { TRAINING_STYLES } from "@/lib/constants/trainingStyles";
import { cn } from "@/lib/utils";

interface TrainingMethodSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  triggerClassName?: string;
  showColorDot?: boolean;
}

export function TrainingMethodSelect({
  value,
  onValueChange,
  className,
  triggerClassName,
  showColorDot = false,
}: TrainingMethodSelectProps) {
  const selectedStyle = TRAINING_STYLES.find(s => s.value === value);
  
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger className={cn("h-8 text-xs", triggerClassName)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={cn("max-h-80", className)}>
            {TRAINING_STYLES.map((style) => (
              <SelectItem key={style.value} value={style.value}>
                <div className="flex items-center gap-2">
                  {showColorDot && style.color && (
                    <div className={cn("w-2 h-2 rounded-full", style.color)} />
                  )}
                  <span>{style.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TooltipTrigger>
      {selectedStyle && (
        <TooltipContent
          side="right"
          className="max-w-sm text-xs"
          align="center"
        >
          <p className="font-medium mb-1">{selectedStyle.label}</p>
          <p className="text-muted-foreground">{selectedStyle.description}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
}
