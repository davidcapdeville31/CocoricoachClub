import { 
  Dumbbell, 
  Bike, 
  Timer, 
  Zap, 
  Target, 
  Heart, 
  Wind, 
  Footprints,
  Activity,
  Flame,
  RotateCcw,
  Gauge,
  PersonStanding,
  Waves,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

// Map categories to icons and colors
const CATEGORY_CONFIG: Record<string, { icon: LucideIcon; bgClass: string; iconClass: string }> = {
  "HYROX": { icon: Flame, bgClass: "bg-orange-500/15", iconClass: "text-orange-500" },
  "CrossFit": { icon: Zap, bgClass: "bg-yellow-500/15", iconClass: "text-yellow-500" },
  "Musculation": { icon: Dumbbell, bgClass: "bg-blue-500/15", iconClass: "text-blue-500" },
  "Haltérophilie": { icon: Activity, bgClass: "bg-purple-500/15", iconClass: "text-purple-500" },
  "Cardio/Endurance": { icon: Heart, bgClass: "bg-red-500/15", iconClass: "text-red-500" },
  "Vitesse/Plyométrie": { icon: Zap, bgClass: "bg-amber-500/15", iconClass: "text-amber-500" },
  "Gainage/Core": { icon: Target, bgClass: "bg-emerald-500/15", iconClass: "text-emerald-500" },
  "Poids de corps/Calisthenics": { icon: PersonStanding, bgClass: "bg-cyan-500/15", iconClass: "text-cyan-500" },
  "Athlétisme/Running drills": { icon: Footprints, bgClass: "bg-lime-500/15", iconClass: "text-lime-500" },
  "Mobilité/Stretching": { icon: Waves, bgClass: "bg-teal-500/15", iconClass: "text-teal-500" },
  "Prévention/Renforcement": { icon: RotateCcw, bgClass: "bg-indigo-500/15", iconClass: "text-indigo-500" },
  "Respiration": { icon: Wind, bgClass: "bg-sky-500/15", iconClass: "text-sky-500" },
  "Réathlétisation": { icon: Activity, bgClass: "bg-rose-500/15", iconClass: "text-rose-500" },
  "Tests & Évaluations": { icon: Gauge, bgClass: "bg-violet-500/15", iconClass: "text-violet-500" },
};

const DEFAULT_CONFIG = { icon: Dumbbell, bgClass: "bg-muted", iconClass: "text-muted-foreground" };

interface ExerciseCardIconProps {
  category: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

export const ExerciseCardIcon = ({ category, size = "md", className }: ExerciseCardIconProps) => {
  const config = CATEGORY_CONFIG[category] || DEFAULT_CONFIG;
  const Icon = config.icon;
  
  const sizeClasses = {
    xs: "h-5 w-5",
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16"
  };
  
  const iconSizes = {
    xs: "h-2.5 w-2.5",
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8"
  };
  
  return (
    <div 
      className={cn(
        "rounded-xl flex items-center justify-center flex-shrink-0",
        config.bgClass,
        sizeClasses[size],
        className
      )}
    >
      <Icon className={cn(iconSizes[size], config.iconClass)} />
    </div>
  );
};

export const getCategoryColor = (category: string): string => {
  const config = CATEGORY_CONFIG[category];
  return config?.iconClass || "text-muted-foreground";
};

export const getCategoryBgColor = (category: string): string => {
  const config = CATEGORY_CONFIG[category];
  return config?.bgClass || "bg-muted";
};

export default ExerciseCardIcon;
