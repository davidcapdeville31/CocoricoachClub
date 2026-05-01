import { Badge } from "@/components/ui/badge";
import { Shield, Edit2, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExerciseSourceBadgeProps {
  isDefault: boolean;
  isOverridden: boolean;
  isCustom: boolean;
  className?: string;
  showLabel?: boolean;
}

export const ExerciseSourceBadge = ({
  isDefault,
  isOverridden,
  isCustom,
  className,
  showLabel = true,
}: ExerciseSourceBadgeProps) => {
  if (isCustom) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
          className
        )}
      >
        <User className="h-3 w-3 mr-1" />
        {showLabel && "Personnalisé"}
      </Badge>
    );
  }

  if (isOverridden) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
          className
        )}
      >
        <Edit2 className="h-3 w-3 mr-1" />
        {showLabel && "Modifié"}
      </Badge>
    );
  }

  if (isDefault) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
          className
        )}
      >
        <Shield className="h-3 w-3 mr-1" />
        {showLabel && "Officiel"}
      </Badge>
    );
  }

  return null;
};

export const getExerciseSourceInfo = (
  isDefault: boolean,
  isOverridden: boolean,
  isCustom: boolean
) => {
  if (isCustom) {
    return {
      type: "custom" as const,
      label: "Exercice personnalisé",
      description: "Créé par vous, indépendant de la base admin",
      color: "purple",
    };
  }

  if (isOverridden) {
    return {
      type: "overridden" as const,
      label: "Exercice admin modifié",
      description: "Basé sur un exercice admin avec vos modifications",
      color: "amber",
    };
  }

  if (isDefault) {
    return {
      type: "admin" as const,
      label: "Exercice officiel",
      description: "Géré par l'administrateur, mis à jour automatiquement",
      color: "blue",
    };
  }

  return {
    type: "unknown" as const,
    label: "Source inconnue",
    description: "",
    color: "gray",
  };
};
