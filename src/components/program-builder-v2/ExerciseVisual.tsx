import { ExerciseCardIcon } from "./ExerciseCardIcon";
import { cn } from "@/lib/utils";

interface ExerciseVisualProps {
  imageUrl?: string | null;
  category: string;
  exerciseName?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  xs: "h-5 w-5",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
};

/**
 * Displays an exercise image if available, otherwise falls back to the category icon.
 * Use this component instead of ExerciseCardIcon when you have access to the image_url.
 */
export const ExerciseVisual = ({
  imageUrl,
  category,
  exerciseName,
  size = "sm",
  className,
}: ExerciseVisualProps) => {
  const sizeClass = sizeClasses[size];

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={exerciseName || category}
        className={cn(sizeClass, "rounded object-cover border border-border flex-shrink-0", className)}
      />
    );
  }

  return (
    <ExerciseCardIcon 
      category={category} 
      size={size} 
      className={cn(sizeClass, "flex-shrink-0", className)} 
    />
  );
};

export default ExerciseVisual;
