import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronsUpDown, 
  ChevronDown, 
  ChevronUp,
  Eye,
  EyeOff,
  Minimize2,
  Maximize2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionViewControlsProps {
  totalExercises: number;
  expandedCount: number;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  className?: string;
}

export const SessionViewControls = ({
  totalExercises,
  expandedCount,
  onExpandAll,
  onCollapseAll,
  className,
}: SessionViewControlsProps) => {
  const allExpanded = expandedCount === totalExercises && totalExercises > 0;
  const allCollapsed = expandedCount === 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Stats Badge */}
      <Badge variant="outline" className="text-xs gap-1.5 px-2 py-0.5">
        <Eye className="h-3 w-3" />
        {expandedCount}/{totalExercises} dépliés
      </Badge>

      {/* Collapse All */}
      <Button
        variant="outline"
        size="sm"
        onClick={onCollapseAll}
        disabled={allCollapsed}
        className="h-7 text-xs gap-1.5 px-2"
      >
        <Minimize2 className="h-3.5 w-3.5" />
        Tout replier
      </Button>

      {/* Expand All */}
      <Button
        variant="outline"
        size="sm"
        onClick={onExpandAll}
        disabled={allExpanded}
        className="h-7 text-xs gap-1.5 px-2"
      >
        <Maximize2 className="h-3.5 w-3.5" />
        Tout déplier
      </Button>
    </div>
  );
};

export default SessionViewControls;
