import { ArrowDown, ArrowRight, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChainArrowProps {
  /** CSS color class for the arrow icon, e.g. "text-blue-500" */
  colorClass?: string;
  /** Size variant */
  size?: "sm" | "md";
  /** Direction of the arrow */
  direction?: "vertical" | "horizontal";
}

/**
 * Visual connector between chained exercises (superset, circuit, AMRAP, etc.)
 * Communicates "perform next exercise immediately" to the athlete.
 */
export const ChainArrow = ({ colorClass = "text-primary", size = "md", direction = "vertical" }: ChainArrowProps) => {
  if (direction === "horizontal") {
    return (
      <div className="flex flex-col items-center justify-center px-1.5 self-center">
        <div className={cn(
          "flex items-center justify-center rounded-full shadow-lg ring-2 ring-white/50",
          colorClass.replace("text-", "bg-").replace(/dark:text-\S+/, ""),
          size === "sm" ? "w-7 h-7" : "w-8 h-8"
        )}>
          <ChevronsRight className={cn(
            "text-white drop-shadow-sm",
            size === "sm" ? "h-4 w-4 stroke-[2.5]" : "h-4.5 w-4.5 stroke-[2.5]"
          )} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-2 gap-1">
      <div className={cn(
        "flex items-center justify-center rounded-full shadow-lg ring-2 ring-white/50",
        colorClass.replace("text-", "bg-").replace(/dark:text-\S+/, ""),
        size === "sm" ? "w-8 h-8" : "w-10 h-10"
      )}>
        <ArrowDown className={cn(
          "text-white drop-shadow-sm",
          size === "sm" ? "h-4 w-4 stroke-[2.5]" : "h-5 w-5 stroke-[2.5]"
        )} />
      </div>
      <span className={cn(
        "font-bold tracking-wide uppercase",
        colorClass,
        size === "sm" ? "text-[9px]" : "text-[10px]"
      )}>
        Enchaîner ↓
      </span>
    </div>
  );
};

export default ChainArrow;
