import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X, Dumbbell, Info } from "lucide-react";
import { ExerciseMediaViewer } from "@/components/library/ExerciseMediaViewer";
import { useExerciseMedia } from "@/lib/hooks/useExerciseMedia";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
 * Shows exercise with icon, name, colored border matching the method,
 * a clickable media viewer (image/video) and an info tooltip (consignes).
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
  const { getMedia } = useExerciseMedia();
  const media = getMedia(exerciseName);

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
      <ExerciseMediaViewer
        exerciseName={exerciseName}
        imageUrl={media?.image_url}
        youtubeUrl={media?.youtube_url}
      >
        <span className={cn("font-semibold text-xs flex-1 truncate cursor-pointer", methodTextColor)}>
          {exerciseName}
        </span>
      </ExerciseMediaViewer>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center rounded-full border h-4 w-4 shrink-0 transition-colors",
                "border-muted-foreground/40 text-muted-foreground hover:text-primary hover:border-primary"
              )}
              aria-label={`Consignes pour ${exerciseName}`}
              onClick={(e) => e.preventDefault()}
            >
              <Info className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            align="start"
            className="max-w-sm whitespace-pre-line text-xs leading-relaxed space-y-1"
          >
            <p className="font-semibold">{exerciseName}</p>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Consignes d'exécution
            </p>
            {media?.description ? (
              <p>{media.description}</p>
            ) : (
              <p className="italic text-muted-foreground">
                Aucune consigne renseignée pour cet exercice.
              </p>
            )}
            {(media?.youtube_url || media?.image_url) && (
              <p className="pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
                Clique sur le nom pour voir la vidéo / image.
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
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
