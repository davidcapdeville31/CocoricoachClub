import React, { useState, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTrainingStyleConfig, TRAINING_STYLES } from "@/lib/program-builder-v2/trainingStyles";
import { ChainArrow } from "../ChainArrow";
import { getTooltipColors, MethodTooltipContent } from "../TrainingMethodButtons";

// Method color mapping
export const getMethodColors = (trainingStyle?: string) => {
  const colorMap: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
    superset: { 
      bg: "bg-gradient-to-r from-blue-500/10 to-blue-400/5", 
      border: "border-blue-500", 
      text: "text-blue-700 dark:text-blue-300",
      iconBg: "bg-blue-500"
    },
    biset: { 
      bg: "bg-gradient-to-r from-cyan-600/10 to-cyan-500/5", 
      border: "border-cyan-600", 
      text: "text-cyan-700 dark:text-cyan-300",
      iconBg: "bg-cyan-600"
    },
    triset: { 
      bg: "bg-gradient-to-r from-purple-500/10 to-purple-400/5", 
      border: "border-purple-500", 
      text: "text-purple-700 dark:text-purple-300",
      iconBg: "bg-purple-500"
    },
    giant_set: { 
      bg: "bg-gradient-to-r from-pink-500/10 to-pink-400/5", 
      border: "border-pink-500", 
      text: "text-pink-700 dark:text-pink-300",
      iconBg: "bg-pink-500"
    },
    drop_set: { 
      bg: "bg-gradient-to-r from-red-500/10 to-red-400/5", 
      border: "border-red-500", 
      text: "text-red-700 dark:text-red-300",
      iconBg: "bg-red-500"
    },
    rest_pause: { 
      bg: "bg-gradient-to-r from-amber-500/10 to-amber-400/5", 
      border: "border-amber-500", 
      text: "text-amber-700 dark:text-amber-300",
      iconBg: "bg-amber-500"
    },
    emom: { 
      bg: "bg-gradient-to-r from-indigo-500/10 to-indigo-400/5", 
      border: "border-indigo-500", 
      text: "text-indigo-700 dark:text-indigo-300",
      iconBg: "bg-indigo-500"
    },
    amrap: { 
      bg: "bg-gradient-to-r from-rose-500/10 to-rose-400/5", 
      border: "border-rose-500", 
      text: "text-rose-700 dark:text-rose-300",
      iconBg: "bg-rose-500"
    },
    for_time: { 
      bg: "bg-gradient-to-r from-orange-500/10 to-orange-400/5", 
      border: "border-orange-500", 
      text: "text-orange-700 dark:text-orange-300",
      iconBg: "bg-orange-500"
    },
    circuit: { 
      bg: "bg-gradient-to-r from-lime-500/10 to-lime-400/5", 
      border: "border-lime-500", 
      text: "text-lime-700 dark:text-lime-300",
      iconBg: "bg-lime-500"
    },
    cluster: { 
      bg: "bg-gradient-to-r from-orange-500/10 to-orange-400/5", 
      border: "border-orange-500", 
      text: "text-orange-700 dark:text-orange-300",
      iconBg: "bg-orange-500"
    },
    isometric_overcoming: { 
      bg: "bg-gradient-to-r from-rose-500/10 to-rose-400/5", 
      border: "border-rose-500", 
      text: "text-rose-700 dark:text-rose-300",
      iconBg: "bg-rose-500"
    },
    isometric_yielding: { 
      bg: "bg-gradient-to-r from-emerald-500/10 to-emerald-400/5", 
      border: "border-emerald-500", 
      text: "text-emerald-700 dark:text-emerald-300",
      iconBg: "bg-emerald-500"
    },
    tabata: { 
      bg: "bg-gradient-to-r from-yellow-500/10 to-yellow-400/5", 
      border: "border-yellow-500", 
      text: "text-yellow-700 dark:text-yellow-300",
      iconBg: "bg-yellow-500"
    },
    death_by: { 
      bg: "bg-gradient-to-r from-red-600/10 to-red-500/5", 
      border: "border-red-600", 
      text: "text-red-700 dark:text-red-300",
      iconBg: "bg-red-600"
    },
    combine_haltero: { 
      bg: "bg-gradient-to-r from-fuchsia-600/10 to-fuchsia-500/5", 
      border: "border-fuchsia-600", 
      text: "text-fuchsia-700 dark:text-fuchsia-300",
      iconBg: "bg-fuchsia-600"
    },
    pyramid_up: {
      bg: "bg-gradient-to-r from-emerald-500/10 to-emerald-400/5",
      border: "border-emerald-500",
      text: "text-emerald-700 dark:text-emerald-300",
      iconBg: "bg-emerald-500",
    },
    pyramid_down: {
      bg: "bg-gradient-to-r from-teal-500/10 to-teal-400/5",
      border: "border-teal-500",
      text: "text-teal-700 dark:text-teal-300",
      iconBg: "bg-teal-500",
    },
    pyramid_full: {
      bg: "bg-gradient-to-r from-cyan-500/10 to-cyan-400/5",
      border: "border-cyan-500",
      text: "text-cyan-700 dark:text-cyan-300",
      iconBg: "bg-cyan-500",
    },
    five_by_five: {
      bg: "bg-gradient-to-r from-sky-500/10 to-sky-400/5",
      border: "border-sky-500",
      text: "text-sky-700 dark:text-sky-300",
      iconBg: "bg-sky-500",
    },
    fartlek: {
      bg: "bg-gradient-to-r from-green-500/10 to-green-400/5",
      border: "border-green-500",
      text: "text-green-700 dark:text-green-300",
      iconBg: "bg-green-500",
    },
    stato_dynamique: {
      bg: "bg-gradient-to-r from-violet-500/10 to-violet-400/5",
      border: "border-violet-500",
      text: "text-violet-700 dark:text-violet-300",
      iconBg: "bg-violet-500",
    },
    intermittent_cardio: {
      bg: "bg-gradient-to-r from-sky-500/10 to-sky-400/5",
      border: "border-sky-500",
      text: "text-sky-700 dark:text-sky-300",
      iconBg: "bg-sky-500",
    },
    bulgarian: {
      bg: "bg-gradient-to-r from-fuchsia-500/10 to-fuchsia-400/5",
      border: "border-fuchsia-500",
      text: "text-fuchsia-700 dark:text-fuchsia-300",
      iconBg: "bg-fuchsia-500",
    },
  };

  return colorMap[trainingStyle || ""] || { 
    bg: "bg-gradient-to-r from-gray-500/10 to-gray-400/5", 
    border: "border-gray-400", 
    text: "text-gray-700 dark:text-gray-300",
    iconBg: "bg-gray-500"
  };
};

interface MethodGroupWrapperProps {
  trainingStyle?: string;
  exerciseCount: number;
  children: ReactNode;
  defaultOpen?: boolean;
  compact?: boolean;
  footer?: ReactNode;
}

export const MethodGroupWrapper = ({ 
  trainingStyle, 
  exerciseCount, 
  children,
  defaultOpen = true,
  compact = false,
  footer
}: MethodGroupWrapperProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const styleConfig = trainingStyle ? getTrainingStyleConfig(trainingStyle) : null;
  const groupLabel = styleConfig?.label || "Méthode combinée";
  const methodColors = getMethodColors(trainingStyle);
  const tooltipColors = trainingStyle ? getTooltipColors(trainingStyle) : null;
  const fullStyleObj = trainingStyle ? TRAINING_STYLES.find(s => s.value === trainingStyle) : null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="group">
      <div className={cn(
        "rounded-lg border overflow-hidden transition-all shadow-sm",
        methodColors.border
      )}>
        <div className={cn(
          "w-full flex items-center gap-2 text-left transition-all",
          methodColors.bg,
          compact ? "p-2" : "p-3"
        )}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 flex-1 hover:brightness-95 transition-all">
              <div className={cn("rounded", methodColors.iconBg, compact ? "p-1" : "p-1.5")}>
                <Link2 className={cn("text-white", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
              </div>
              <div className="flex-1 text-left">
                {fullStyleObj && tooltipColors ? (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn("font-semibold cursor-help underline decoration-dotted underline-offset-2", methodColors.text, compact ? "text-xs" : "text-sm")}>
                          {groupLabel}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="start" className="p-0 border-0 bg-transparent shadow-none max-w-[420px]" sideOffset={8}>
                        <MethodTooltipContent style={fullStyleObj} colors={tooltipColors} />
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <span className={cn("font-semibold", methodColors.text, compact ? "text-xs" : "text-sm")}>
                    {groupLabel}
                  </span>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {exerciseCount} exercices enchaînés
                </p>
              </div>
            </button>
          </CollapsibleTrigger>
          <Badge className={cn(
            "font-semibold text-white border-0", 
            methodColors.iconBg,
            compact ? "text-[10px] h-4 px-1.5" : "text-xs h-5 px-2"
          )}>
            {exerciseCount}
          </Badge>
          <CollapsibleTrigger asChild>
            <button className="p-1 hover:bg-black/5 rounded transition-colors">
              {isOpen ? (
                <ChevronDown className={cn("text-muted-foreground transition-transform", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
              ) : (
                <ChevronRight className={cn("text-muted-foreground", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
              )}
            </button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className={cn(
            methodColors.bg.replace("/10", "/5").replace("/5", "/3"),
            compact ? "p-2" : "p-3"
          )}>
            {/* Horizontal grid layout for linked exercises */}
            <div className="flex flex-wrap items-stretch gap-0">
              {React.Children.toArray(children).map((child, idx, arr) => (
                <React.Fragment key={idx}>
                  <div className="flex-1 min-w-[180px] max-w-full">
                    {child}
                  </div>
                  {idx < arr.length - 1 && (
                    <ChainArrow colorClass={methodColors.text} size={compact ? "sm" : "md"} direction="horizontal" />
                  )}
                </React.Fragment>
              ))}
            </div>
            {footer && <div className={compact ? "px-2 pb-2" : "px-3 pb-3"}>{footer}</div>}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

// Helper to group exercises by groupId
export interface GroupedExercise {
  type: 'group' | 'single';
  id: string;
  exercises: any[];
  trainingStyle?: string;
}

export const groupExercisesByMethod = (exercises: any[]): GroupedExercise[] => {
  const groups: Record<string, any[]> = {};
  const order: GroupedExercise[] = [];
  const seenGroups = new Set<string>();

  exercises.forEach((exercise) => {
    if (exercise.groupId && exercise.trainingStyle && exercise.trainingStyle !== 'normal') {
      if (!groups[exercise.groupId]) {
        groups[exercise.groupId] = [];
      }
      groups[exercise.groupId].push(exercise);
      
      if (!seenGroups.has(exercise.groupId)) {
        seenGroups.add(exercise.groupId);
        order.push({ 
          type: 'group', 
          id: exercise.groupId, 
          exercises: [],
          trainingStyle: exercise.trainingStyle
        });
      }
    } else {
      order.push({ 
        type: 'single', 
        id: exercise.id || exercise.exerciseId || `single-${order.length}`, 
        exercises: [exercise] 
      });
    }
  });

  // Fill in group exercises
  order.forEach(item => {
    if (item.type === 'group') {
      item.exercises = groups[item.id] || [];
    }
  });

  return order;
};

export default MethodGroupWrapper;
