import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X, Dumbbell } from "lucide-react";

interface MethodExerciseDisplayProps {
  exerciseName: string;
  onRemove?: () => void;
  className?: string;
  showRemove?: boolean;
  // Method color props - use these to match the method's color scheme
  methodBgColor?: string;    // e.g., "bg-purple-500/20"
  methodBorderColor?: string; // e.g., "border-purple-500"
  methodTextColor?: string;   // e.g., "text-purple-500"
  methodIconColor?: string;   // e.g., "bg-purple-500"
}

/**
 * Unified exercise display component for all training methods
 * Shows exercise with icon, name, and colored border matching the method's color
 */
export const MethodExerciseDisplay = ({
  exerciseName,
  onRemove,
  className,
  showRemove = true,
  methodBgColor = "bg-primary/15",
  methodBorderColor = "border-primary",
  methodTextColor = "text-primary",
  methodIconColor = "bg-primary",
}: MethodExerciseDisplayProps) => {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all",
        methodBgColor,
        methodBorderColor,
        className
      )}
    >
      {/* Method-colored icon */}
      <div className={cn(
        "flex items-center justify-center w-5 h-5 rounded flex-shrink-0",
        methodIconColor
      )}>
        <Dumbbell className="h-3 w-3 text-white" />
      </div>
      <span className={cn("font-semibold text-xs flex-1 truncate", methodTextColor)}>
        {exerciseName}
      </span>
      {showRemove && onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default MethodExerciseDisplay;
