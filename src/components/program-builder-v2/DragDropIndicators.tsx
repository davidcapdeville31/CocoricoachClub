import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, ArrowUp, ArrowDown, Plus } from "lucide-react";

// Reorder arrows that appear on hover of exercises/blocks
interface ReorderArrowsProps {
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isVisible: boolean;
  compact?: boolean;
}

export const ReorderArrows = ({ 
  onMoveUp, 
  onMoveDown, 
  canMoveUp, 
  canMoveDown,
  isVisible,
  compact = false
}: ReorderArrowsProps) => {
  if (!isVisible) return null;
  
  return (
    <div className={cn(
      "absolute flex flex-col items-center gap-0.5 z-30",
      "transition-all duration-200",
      compact 
        ? "-left-8 top-1/2 -translate-y-1/2" 
        : "left-1/2 -translate-x-1/2 -top-5"
    )}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onMoveUp?.();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        disabled={!canMoveUp}
        className={cn(
          "p-1 rounded-md transition-all shadow-md",
          canMoveUp 
            ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-110 cursor-pointer" 
            : "bg-muted text-muted-foreground/40 cursor-not-allowed opacity-50"
        )}
        title="Monter"
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onMoveDown?.();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        disabled={!canMoveDown}
        className={cn(
          "p-1 rounded-md transition-all shadow-md",
          canMoveDown 
            ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-110 cursor-pointer" 
            : "bg-muted text-muted-foreground/40 cursor-not-allowed opacity-50"
        )}
        title="Descendre"
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

// Enhanced drop zone between items - shows clear insertion point
interface DropZoneBetweenProps {
  zoneId: string;
  position: number;
  label?: string;
  targetType?: "exercise" | "block" | "any";
  isInsideBlock?: boolean;
  dayId?: string;
  blockId?: string;
}

export const DropZoneBetween = ({
  zoneId,
  position,
  label,
  targetType = "any",
  isInsideBlock = false,
  dayId,
  blockId
}: DropZoneBetweenProps) => {
  const { setNodeRef, isOver, active } = useDroppable({
    id: zoneId,
    data: { type: "position", position, targetType, isInsideBlock, dayId, blockId },
  });

  // Determine if we're dragging something relevant
  const isDragging = !!active;
  
  // Check if we're dragging a linked block (triset, superset, etc.)
  const activeId = active?.id ? String(active.id) : "";
  const isDraggingLinkedBlock = activeId.startsWith("block-") && !activeId.startsWith("block-placeholder");
  
  // This is a prime target if we're dragging a linked block and this zone is outside blocks
  const isHighPriorityTarget = isDraggingLinkedBlock && !isInsideBlock;
  
  // Dynamic label based on context
  const displayLabel = label || (
    isInsideBlock 
      ? `Insérer dans le bloc` 
      : isDraggingLinkedBlock
        ? "Sortir du bloc"
        : targetType === "block" 
          ? "Insérer avant/après le bloc" 
          : "Insérer ici"
  );

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative transition-all duration-200 group",
        // Much larger zones when dragging to make drop easier
        // Even larger for high priority targets (linked block to outside)
        isDragging 
          ? isHighPriorityTarget 
            ? "h-12 my-2" 
            : "h-8 my-1" 
          : "h-1 -my-0.5",
        isOver && "h-14 my-2"
      )}
    >
      {/* Always visible indicator for high priority targets when dragging linked blocks */}
      {isHighPriorityTarget && !isOver && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <div className="flex-1 h-1 bg-emerald-500/50 rounded animate-pulse" />
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-1 bg-emerald-500/15 rounded-full whitespace-nowrap flex items-center gap-1 border border-emerald-500/30">
            <ChevronDown className="h-3 w-3" />
            {displayLabel}
          </span>
          <div className="flex-1 h-1 bg-emerald-500/50 rounded animate-pulse" />
        </div>
      )}
      
      {/* Hover indicator when dragging (for non-high-priority zones) */}
      {isDragging && !isOver && !isHighPriorityTarget && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex-1 h-0.5 bg-primary/40 rounded" />
          <span className="text-[9px] text-primary/60 font-medium px-1.5 py-0.5 bg-primary/5 rounded-full whitespace-nowrap flex items-center gap-0.5">
            <Plus className="h-2.5 w-2.5" />
            Déposer
          </span>
          <div className="flex-1 h-0.5 bg-primary/40 rounded" />
        </div>
      )}
      
      {/* Active drop indicator */}
      {isOver && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center gap-2 animate-pulse">
          <div className="flex items-center gap-1">
            <ChevronDown className="h-4 w-4 text-primary animate-bounce" />
          </div>
          <div className="flex-1 h-1 bg-primary rounded shadow-lg shadow-primary/30" />
          <span className={cn(
            "text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap border shadow-sm",
            isHighPriorityTarget 
              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/20 border-emerald-500/40"
              : "text-primary bg-primary/15 border-primary/30"
          )}>
            {displayLabel}
          </span>
          <div className="flex-1 h-1 bg-primary rounded shadow-lg shadow-primary/30" />
          <div className="flex items-center gap-1">
            <ChevronDown className="h-4 w-4 text-primary animate-bounce" />
          </div>
        </div>
      )}
    </div>
  );
};

// Permanent reorder arrows - always visible, larger and more accessible
interface PermanentReorderArrowsProps {
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export const PermanentReorderArrows = ({ 
  onMoveUp, 
  onMoveDown, 
  canMoveUp, 
  canMoveDown,
}: PermanentReorderArrowsProps) => {
  const handleMoveUp = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (canMoveUp && onMoveUp) {
      onMoveUp();
    }
  };

  const handleMoveDown = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (canMoveDown && onMoveDown) {
      onMoveDown();
    }
  };

  return (
    <div 
      className="flex flex-col items-center gap-0.5 z-30 flex-shrink-0"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={handleMoveUp}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        disabled={!canMoveUp}
        className={cn(
          "p-1 rounded-md transition-all shadow-sm border",
          canMoveUp 
            ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 cursor-pointer border-primary/50" 
            : "bg-muted text-muted-foreground/40 cursor-not-allowed opacity-40 border-muted"
        )}
        title="Monter"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={handleMoveDown}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        disabled={!canMoveDown}
        className={cn(
          "p-1 rounded-md transition-all shadow-sm border",
          canMoveDown 
            ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 cursor-pointer border-primary/50" 
            : "bg-muted text-muted-foreground/40 cursor-not-allowed opacity-40 border-muted"
        )}
        title="Descendre"
      >
        <ArrowDown className="h-4 w-4" />
      </button>
    </div>
  );
};

// Wrapper for sortable items - now with PERMANENT visible arrows
interface SortableItemWrapperProps {
  children: React.ReactNode;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isDragging?: boolean;
  showArrows?: boolean;
  className?: string;
}

export const SortableItemWrapper = ({
  children,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  isDragging = false,
  showArrows = true,
  className
}: SortableItemWrapperProps) => {
  return (
    <div 
      className={cn(
        "relative flex items-start gap-3",
        isDragging && "opacity-50 scale-[0.98]",
        className
      )}
    >
      {/* Left-side permanent reorder arrows - fixed width to prevent overlap */}
      {showArrows && (onMoveUp || onMoveDown) && (
        <div className="flex-shrink-0 w-8 pt-1">
          <PermanentReorderArrows
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
          />
        </div>
      )}
      
      <div className="flex-1 min-w-0 overflow-visible">
        {children}
      </div>
    </div>
  );
};

// Drop zone that appears at the start of a section (before first item or before all blocks)
interface DropZoneStartProps {
  zoneId: string;
  label?: string;
  isEmpty?: boolean;
}

export const DropZoneStart = ({
  zoneId,
  label = "Insérer au début",
  isEmpty = false
}: DropZoneStartProps) => {
  const { setNodeRef, isOver, active } = useDroppable({
    id: zoneId,
    data: { type: "position", position: 0, isStart: true },
  });

  const isDragging = !!active;

  if (isEmpty) {
    // Show a larger drop zone when the section is empty
    return (
      <div
        ref={setNodeRef}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 transition-all text-center",
          isOver 
            ? "border-primary bg-primary/10 scale-[1.02]" 
            : isDragging
              ? "border-primary/50 bg-primary/5"
              : "border-muted-foreground/30"
        )}
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          {isOver ? (
            <>
              <ChevronDown className="h-6 w-6 text-primary animate-bounce" />
              <span className="text-sm font-medium text-primary">Déposer ici</span>
            </>
          ) : (
            <>
              <Plus className="h-5 w-5 opacity-50" />
              <span className="text-xs">Glissez un exercice ou cliquez depuis la bibliothèque</span>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative transition-all duration-200",
        isDragging ? "h-8 my-1" : "h-1 -mb-0.5",
        isOver && "h-12 mb-2"
      )}
    >
      {isDragging && !isOver && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-60">
          <div className="flex-1 h-0.5 bg-primary/30 rounded" />
          <span className="text-[9px] text-primary/50 font-medium px-1.5 py-0.5 bg-primary/5 rounded-full whitespace-nowrap">
            {label}
          </span>
          <div className="flex-1 h-0.5 bg-primary/30 rounded" />
        </div>
      )}
      
      {isOver && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center gap-2 animate-pulse">
          <ChevronUp className="h-4 w-4 text-primary animate-bounce" />
          <div className="flex-1 h-1 bg-primary rounded shadow-lg shadow-primary/30" />
          <span className="text-xs text-primary font-semibold px-2.5 py-1 bg-primary/15 rounded-full whitespace-nowrap border border-primary/30">
            {label}
          </span>
          <div className="flex-1 h-1 bg-primary rounded shadow-lg shadow-primary/30" />
          <ChevronUp className="h-4 w-4 text-primary animate-bounce" />
        </div>
      )}
    </div>
  );
};

// Drop zone for inside training blocks (placeholder at bottom)
interface BlockDropPlaceholderProps {
  blockDropId: string;
  blockId: string;
  isActive?: boolean;
}

export const BlockDropPlaceholder = ({
  blockDropId,
  blockId,
  isActive = false
}: BlockDropPlaceholderProps) => {
  const { setNodeRef, isOver, active } = useDroppable({
    id: blockDropId,
    data: {
      type: "training-block-placeholder",
      blockId,
    },
  });

  const isDragging = !!active;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-2 border-dashed rounded-lg p-3 transition-all",
        "flex flex-col items-center justify-center gap-1.5 text-center",
        isOver 
          ? "border-primary bg-primary/10 scale-[1.02]" 
          : isDragging
            ? "border-primary/40 bg-primary/5"
            : isActive 
              ? "border-primary/40 bg-primary/5"
              : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50"
      )}
    >
      {isOver ? (
        <>
          <ChevronDown className="h-5 w-5 text-primary animate-bounce" />
          <span className="text-sm font-medium text-primary">Déposer dans ce bloc</span>
        </>
      ) : (
        <>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Plus className="h-3.5 w-3.5" />
            <span>Faire glisser un exercice ici</span>
          </div>
          <p className="text-xs text-muted-foreground/70">
            Ou cliquez sur un exercice dans la bibliothèque
          </p>
        </>
      )}
    </div>
  );
};

// Drag overlay for exercises/blocks during drag
interface DragOverlayContentProps {
  type: "exercise" | "block";
  name: string;
  count?: number; // For blocks, number of exercises
  color?: string;
}

export const DragOverlayContent = ({
  type,
  name,
  count,
  color
}: DragOverlayContentProps) => {
  return (
    <div 
      className={cn(
        "px-4 py-2 rounded-lg shadow-2xl border-2 border-primary bg-background",
        "flex items-center gap-2 min-w-[200px]",
        "opacity-90 backdrop-blur-sm"
      )}
      style={color ? { borderColor: color, boxShadow: `0 10px 40px -10px ${color}40` } : undefined}
    >
      <div className={cn(
        "w-2 h-8 rounded-full",
        color ? "" : "bg-primary"
      )} style={color ? { backgroundColor: color } : undefined} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{name}</p>
        {type === "block" && count !== undefined && (
          <p className="text-xs text-muted-foreground">{count} exercice{count !== 1 ? 's' : ''}</p>
        )}
      </div>
    </div>
  );
};
