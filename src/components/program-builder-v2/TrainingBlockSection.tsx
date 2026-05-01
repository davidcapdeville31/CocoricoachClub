import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Dumbbell, 
  Flame, 
  Heart, 
  Bike, 
  Plus, 
  GripVertical, 
  ChevronDown, 
  ChevronUp,
  X,
  Pencil,
  Check,
  Trophy,
  Trash2,
  Palette
} from "lucide-react";
import { cn } from "@/lib/utils";

export type TrainingBlockType = "echauffement" | "musculation" | "halterophilie" | "crossfit" | "cardio" | "mobilite" | "custom";

export interface TrainingBlock {
  id: string;
  type: TrainingBlockType;
  name: string;
  isOpen: boolean;
  customColor?: string;
  customEmoji?: string;
}

// Custom block type stored in localStorage
export interface CustomBlockType {
  id: string;
  label: string;
  emoji: string;
  color: string; // hex color
}

const CUSTOM_BLOCKS_STORAGE_KEY = "custom-training-block-types";

export const getCustomBlockTypes = (): CustomBlockType[] => {
  try {
    const stored = localStorage.getItem(CUSTOM_BLOCKS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

export const saveCustomBlockTypes = (types: CustomBlockType[]) => {
  localStorage.setItem(CUSTOM_BLOCKS_STORAGE_KEY, JSON.stringify(types));
};

const BLOCK_EMOJI_OPTIONS = [
  "📋", "🏋️", "💪", "🏃", "🚴", "🏊", "⚡", "🔥", "🎯", "🏆",
  "⭐", "❤️", "🧘", "🥊", "🤸", "🏄", "⚽", "🎾", "🏀", "🏈",
  "🧗", "🤼", "🏌️", "🎿", "🏇", "🥋", "🤾", "🏐", "🏑", "🥅",
  "💎", "🌟", "🎖️", "🥇", "🛡️", "⚖️", "📈", "🔙", "👴", "👦",
];

const BLOCK_COLOR_OPTIONS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#78716c", "#64748b", "#0f172a",
];

export const getCustomBlockColors = (hexColor: string) => ({
  bg: `bg-[${hexColor}]/5`,
  border: `border-[${hexColor}]/30`,
  header: `bg-[${hexColor}]`,
  badge: `bg-[${hexColor}]`,
  iconBg: `bg-[${hexColor}]/20`,
});

// Block type configurations
export const TRAINING_BLOCK_TYPES: { 
  type: TrainingBlockType; 
  label: string; 
  icon: React.ElementType; 
  colors: {
    bg: string;
    border: string;
    header: string;
    badge: string;
    iconBg: string;
  };
}[] = [
  {
    type: "echauffement",
    label: "Échauffement",
    icon: Flame,
    colors: {
      bg: "bg-amber-500/5 dark:bg-amber-500/10",
      border: "border-amber-500/30",
      header: "bg-gradient-to-r from-amber-500 to-amber-600",
      badge: "bg-amber-500",
      iconBg: "bg-amber-500/20 text-amber-600 dark:text-amber-400"
    }
  },
  {
    type: "musculation",
    label: "Musculation",
    icon: Dumbbell,
    colors: {
      bg: "bg-blue-500/5 dark:bg-blue-500/10",
      border: "border-blue-500/30",
      header: "bg-gradient-to-r from-blue-600 to-blue-700",
      badge: "bg-blue-500",
      iconBg: "bg-blue-500/20 text-blue-600 dark:text-blue-400"
    }
  },
  {
    type: "halterophilie",
    label: "Haltérophilie",
    icon: Trophy,
    colors: {
      bg: "bg-purple-500/5 dark:bg-purple-500/10",
      border: "border-purple-500/30",
      header: "bg-gradient-to-r from-purple-600 to-purple-700",
      badge: "bg-purple-500",
      iconBg: "bg-purple-500/20 text-purple-600 dark:text-purple-400"
    }
  },
  {
    type: "crossfit",
    label: "CrossFit",
    icon: Flame,
    colors: {
      bg: "bg-orange-500/5 dark:bg-orange-500/10",
      border: "border-orange-500/30",
      header: "bg-gradient-to-r from-orange-600 to-orange-700",
      badge: "bg-orange-500",
      iconBg: "bg-orange-500/20 text-orange-600 dark:text-orange-400"
    }
  },
  {
    type: "cardio",
    label: "Cardio",
    icon: Heart,
    colors: {
      bg: "bg-rose-500/5 dark:bg-rose-500/10",
      border: "border-rose-500/30",
      header: "bg-gradient-to-r from-rose-600 to-rose-700",
      badge: "bg-rose-500",
      iconBg: "bg-rose-500/20 text-rose-600 dark:text-rose-400"
    }
  },
  {
    type: "mobilite",
    label: "Mobilité",
    icon: Bike,
    colors: {
      bg: "bg-emerald-500/5 dark:bg-emerald-500/10",
      border: "border-emerald-500/30",
      header: "bg-gradient-to-r from-emerald-600 to-emerald-700",
      badge: "bg-emerald-500",
      iconBg: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
    }
  },
];
export const getBlockTypeConfig = (type: TrainingBlockType, block?: TrainingBlock) => {
  // If custom block with custom color/emoji, generate config dynamically
  if (type === "custom" && block?.customColor) {
    return {
      type: "custom" as TrainingBlockType,
      label: block.name || "Personnalisé",
      icon: Dumbbell, // Will use emoji instead
      emoji: block.customEmoji || "🏋️",
      colors: {
        bg: "bg-muted/30",
        border: "border-muted-foreground/20",
        header: "",
        badge: "",
        iconBg: "",
      },
      customColor: block.customColor,
    };
  }
  return TRAINING_BLOCK_TYPES.find(t => t.type === type) || TRAINING_BLOCK_TYPES[0];
};

interface TrainingBlockHeaderProps {
  block: TrainingBlock;
  onToggle: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
  onChangeType?: (type: TrainingBlockType, customBlock?: CustomBlockType) => void;
  exerciseCount: number;
  isActive?: boolean;
  isDragging?: boolean;
  dragHandleProps?: any;
}

export const TrainingBlockHeader = ({
  block,
  onToggle,
  onRename,
  onRemove,
  onChangeType,
  exerciseCount,
  isActive,
  isDragging,
  dragHandleProps,
}: TrainingBlockHeaderProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(block.name);
  const config = getBlockTypeConfig(block.type, block);
  const IconComponent = config.icon;
  const isCustom = block.type === "custom" && block.customColor;
  const headerStyle = isCustom ? { backgroundColor: block.customColor } : {};

  const handleSave = () => {
    if (editName.trim()) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  };

  return (
    <div 
      className={cn(
        "flex items-center gap-1.5 px-2 py-1.5 rounded-t-lg text-white",
        !isCustom && config.colors.header,
      )}
      style={headerStyle}
    >
      {/* Drag Handle Indicator */}
      <div className="p-0.5 -ml-0.5 hover:bg-white/10 rounded transition-colors">
        <GripVertical className="h-3.5 w-3.5 opacity-70" />
      </div>
      
      {/* Icon with type changer dropdown */}
      {onChangeType ? (
        (() => {
          const customBlocks = getCustomBlockTypes();
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 rounded-md bg-white/20 hover:bg-white/30 transition-colors cursor-pointer">
                  {isCustom ? (
                    <span className="text-xs leading-none">{block.customEmoji || "🏋️"}</span>
                  ) : (
                    <IconComponent className="h-3.5 w-3.5" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52 bg-popover">
                {TRAINING_BLOCK_TYPES.map((blockType) => {
                  const Icon = blockType.icon;
                  const isSelected = blockType.type === block.type && !isCustom;
                  return (
                    <DropdownMenuItem
                      key={blockType.type}
                      onClick={() => onChangeType(blockType.type)}
                      className={cn("gap-2 cursor-pointer", isSelected && "bg-accent")}
                    >
                      <div className={cn("p-1 rounded", blockType.colors.iconBg)}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span>{blockType.label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 ml-auto" />}
                    </DropdownMenuItem>
                  );
                })}
                {customBlocks.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    {customBlocks.map((cb) => {
                      const isSelected = isCustom && block.customColor === cb.color && block.customEmoji === cb.emoji;
                      return (
                        <DropdownMenuItem
                          key={cb.id}
                          onClick={() => onChangeType("custom", cb)}
                          className={cn("gap-2 cursor-pointer", isSelected && "bg-accent")}
                        >
                          <div className="p-1 rounded text-sm leading-none" style={{ backgroundColor: cb.color + "33" }}>
                            {cb.emoji}
                          </div>
                          <span>{cb.label}</span>
                          {isSelected && <Check className="h-3.5 w-3.5 ml-auto" />}
                        </DropdownMenuItem>
                      );
                    })}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })()
      ) : (
        <div className="p-1 rounded-md bg-white/20">
          {isCustom ? (
            <span className="text-xs leading-none">{block.customEmoji || "🏋️"}</span>
          ) : (
            <IconComponent className="h-3.5 w-3.5" />
          )}
        </div>
      )}
      
      {/* Name */}
      {isEditing ? (
        <div className="flex items-center gap-1 flex-1">
           <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="h-6 text-xs bg-white/20 border-white/30 text-white placeholder:text-white/60"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setIsEditing(false);
            }}
          />
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0 hover:bg-white/20"
            onClick={handleSave}
          >
            <Check className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <button 
          onClick={() => {
            setEditName(block.name);
            setIsEditing(true);
          }}
          className="flex items-center gap-1 font-medium text-xs hover:underline group"
        >
          <span className="truncate max-w-[100px]">{block.name}</span>
          <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-70 transition-opacity flex-shrink-0" />
        </button>
      )}
      
      {/* Badge with exercise count */}
      <Badge variant="secondary" className="bg-white/20 text-white text-[10px] ml-auto px-1.5 py-0">
        {exerciseCount}
      </Badge>
      
      {/* Active indicator */}
      {isActive && (
        <Badge className="bg-white text-foreground text-[10px] font-semibold animate-pulse px-1.5 py-0">
          ACTIF
        </Badge>
      )}
      
      {/* Toggle */}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 hover:bg-white/20"
        onClick={onToggle}
      >
        {block.isOpen ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </Button>
      
      {/* Remove */}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 hover:bg-white/20 text-white/70 hover:text-white"
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

interface AddTrainingBlockButtonProps {
  onAddBlock: (type: TrainingBlockType, customBlock?: CustomBlockType) => void;
  variant?: "default" | "prominent";
}

export const AddTrainingBlockButton = ({ onAddBlock, variant = "default" }: AddTrainingBlockButtonProps) => {
  const isProminent = variant === "prominent";
  const [customBlocks, setCustomBlocks] = useState<CustomBlockType[]>(getCustomBlockTypes());
  const [showCreator, setShowCreator] = useState(false);
  const [editingBlock, setEditingBlock] = useState<CustomBlockType | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("🏋️");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const resetForm = () => {
    setNewName("");
    setNewEmoji("🏋️");
    setNewColor("#3b82f6");
    setShowCreator(false);
    setEditingBlock(null);
  };

  const handleCreateCustomBlock = () => {
    if (!newName.trim()) return;
    if (editingBlock) {
      // Update existing
      const updated = customBlocks.map(b => b.id === editingBlock.id 
        ? { ...b, label: newName.trim(), emoji: newEmoji, color: newColor } 
        : b
      );
      setCustomBlocks(updated);
      saveCustomBlockTypes(updated);
      resetForm();
    } else {
      // Create new
      const customBlock: CustomBlockType = {
        id: `custom-${Date.now()}`,
        label: newName.trim(),
        emoji: newEmoji,
        color: newColor,
      };
      const updated = [...customBlocks, customBlock];
      setCustomBlocks(updated);
      saveCustomBlockTypes(updated);
      onAddBlock("custom", customBlock);
      resetForm();
      setDropdownOpen(false);
    }
  };

  const handleEditCustomBlock = (e: React.MouseEvent, cb: CustomBlockType) => {
    e.stopPropagation();
    setEditingBlock(cb);
    setNewName(cb.label);
    setNewEmoji(cb.emoji);
    setNewColor(cb.color);
    setShowCreator(true);
  };

  const handleDeleteCustomBlock = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = customBlocks.filter(b => b.id !== id);
    setCustomBlocks(updated);
    saveCustomBlockTypes(updated);
  };

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="destructive"
          size="default"
          className="gap-1.5 w-full h-11 text-sm font-medium shadow-sm"
        >
          <Plus className={cn("h-4 w-4", isProminent && "h-5 w-5")} />
          Ajouter un bloc de travail
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56 z-[90]">
        {TRAINING_BLOCK_TYPES.map((blockType) => {
          const Icon = blockType.icon;
          return (
            <DropdownMenuItem
              key={blockType.type}
              onClick={() => { onAddBlock(blockType.type); setDropdownOpen(false); }}
              className="gap-2 cursor-pointer"
            >
              <div className={cn("p-1 rounded", blockType.colors.iconBg)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span>{blockType.label}</span>
            </DropdownMenuItem>
          );
        })}

        {/* Custom blocks saved */}
        {customBlocks.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {customBlocks.map((cb) => (
              <DropdownMenuItem
                key={cb.id}
                onClick={() => { onAddBlock("custom", cb); setDropdownOpen(false); }}
                className="gap-2 cursor-pointer group"
              >
                <div className="p-1 rounded text-sm leading-none" style={{ backgroundColor: cb.color + "33" }}>
                  {cb.emoji}
                </div>
                <span className="flex-1">{cb.label}</span>
                <button
                  onClick={(e) => handleEditCustomBlock(e, cb)}
                  className="p-0.5 hover:bg-accent rounded transition-colors"
                >
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
                <button
                  onClick={(e) => handleDeleteCustomBlock(e, cb.id)}
                  className="p-0.5 hover:bg-destructive/20 rounded transition-colors"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />

        {/* Create custom block inline */}
        {!showCreator ? (
          <DropdownMenuItem
            onClick={(e) => { e.preventDefault(); setShowCreator(true); }}
            className="gap-2 cursor-pointer text-primary font-medium"
          >
            <Palette className="h-4 w-4" />
            <span>Créer un bloc personnalisé</span>
          </DropdownMenuItem>
        ) : (
          <div className="p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-xs font-semibold text-muted-foreground">{editingBlock ? "Modifier le bloc" : "Nouveau bloc personnalisé"}</div>
            
            {/* Name */}
            <Input
              placeholder="Nom du bloc..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateCustomBlock(); }}
            />

            {/* Emoji picker */}
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">Icône</div>
              <div className="flex flex-wrap gap-1">
                {BLOCK_EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNewEmoji(emoji)}
                    className={cn(
                      "w-7 h-7 rounded text-sm flex items-center justify-center hover:bg-accent transition-colors",
                      newEmoji === emoji && "ring-2 ring-primary bg-accent"
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">Couleur</div>
              <div className="flex flex-wrap gap-1.5">
                {BLOCK_COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewColor(color)}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 transition-all",
                      newColor === color ? "border-foreground scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-2 p-2 rounded-md text-white text-sm font-medium" style={{ backgroundColor: newColor }}>
              <span>{newEmoji}</span>
              <span>{newName || "Aperçu"}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleCreateCustomBlock} disabled={!newName.trim()}>
                <Check className="h-3.5 w-3.5 mr-1" /> {editingBlock ? "Modifier" : "Créer"}
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={resetForm}>
                Annuler
              </Button>
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface TrainingBlockWrapperProps {
  block: TrainingBlock;
  blockDropId: string; // Unique droppable ID for the block
  children: React.ReactNode;
  onToggle: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
  onChangeType?: (type: TrainingBlockType, customBlock?: CustomBlockType) => void;
  onSelect?: () => void;
  exerciseCount: number;
  isActive?: boolean;
  dragHandleProps?: any;
}

export const TrainingBlockWrapper = ({
  block,
  blockDropId,
  children,
  onToggle,
  onRename,
  onRemove,
  onChangeType,
  onSelect,
  exerciseCount,
  isActive,
  dragHandleProps,
}: TrainingBlockWrapperProps) => {
  const config = getBlockTypeConfig(block.type, block);
  const isCustom = block.type === "custom" && block.customColor;
  const customBorderStyle = isCustom ? { borderColor: block.customColor + "4D" } : {};
  const customBgStyle = isCustom ? { backgroundColor: block.customColor + "0D" } : {};

  // Handler to stop propagation for interactive elements
  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, [role="button"]')) {
      e.stopPropagation();
    }
  };

  return (
    <div 
      {...dragHandleProps}
      onPointerDown={(e) => {
        handlePointerDown(e);
        dragHandleProps?.onPointerDown?.(e);
      }}
      onClick={(e) => {
        if (onSelect && e.target === e.currentTarget) {
          onSelect();
        }
      }}
      className={cn(
        "rounded-md border transition-all cursor-grab active:cursor-grabbing",
        !isCustom && config.colors.border,
        !isCustom && config.colors.bg,
        isActive && "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg"
      )}
      style={{ ...customBorderStyle, ...customBgStyle }}
    >
      <div onClick={() => onSelect?.()}>
        <TrainingBlockHeader
          block={block}
          onToggle={onToggle}
          onRename={onRename}
          onRemove={onRemove}
          onChangeType={onChangeType}
          exerciseCount={exerciseCount}
          dragHandleProps={dragHandleProps}
          isActive={isActive}
        />
      </div>
      
      {block.isOpen && (
        <div className="p-2 space-y-2" onClick={() => onSelect?.()}>
          {children}
        </div>
      )}
    </div>
  );
};
