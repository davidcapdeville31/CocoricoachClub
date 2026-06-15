// V2 namespace - copied from Remix project (src/components/athlete/ProgramGridView.tsx)
// Adapted: imports point to program-builder-v2 namespace.
import { useState } from "react";
import { useCoachTheme } from "./contexts/CoachThemeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus,
  Trash2,
  Copy,
  Dumbbell,
  ChevronDown,
  ChevronUp,
  Layers,
  ClipboardPaste,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTrainingStyleConfig } from "./lib/trainingStyles";
import { DAYS_OF_WEEK } from "./lib/trainingProgramsData";
import { getBlockTypeConfig, type TrainingBlock as TrainingBlockData } from "./TrainingBlockSection";

// Local types (originally re-exported from CreateTrainingProgram)
export interface UnifiedOrderItem {
  type: "exercise" | "block";
  id: string;
}

interface ProgramExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: string;
  percentage?: number;
  tempo?: string;
  rpe?: number;
  restSeconds: number;
  trainingStyle: string;
  groupId?: string;
  blockId?: string;
  [key: string]: any;
}

interface ProgramDay {
  id: string;
  name: string;
  dayOfWeek?: string;
  exercises: ProgramExercise[];
  blocks: TrainingBlockData[];
  unifiedOrder?: UnifiedOrderItem[];
}

interface ProgramWeek {
  id: string;
  weekNumber: number;
  name?: string;
  days: ProgramDay[];
  isOpen: boolean;
}

interface ProgramGridViewProps {
  weeks: ProgramWeek[];
  onAddWeek: () => void;
  onDuplicateWeek: (weekId: string) => void;
  onRemoveWeek: (weekId: string) => void;
  onAddDay: (weekId: string) => void;
  onRemoveDay: (weekId: string, dayId: string) => void;
  onUpdateDayName: (weekId: string, dayId: string, name: string) => void;
  onUpdateDayOfWeek: (weekId: string, dayId: string, dayOfWeek: string) => void;
  onOpenSession: (weekId: string, dayId: string) => void;
  onCopySession: (weekId: string, dayId: string) => void;
  onPasteSession: (weekId: string, dayId: string) => void;
  hasClipboard: boolean;
  activeSessionId?: string | null;
}

// ── Expanded block detail ──
const BlockDetail = ({ block, exercises }: { block: TrainingBlockData; exercises: ProgramExercise[] }) => {
  const blockExercises = exercises.filter((ex) => ex.blockId === block.id);
  const config = getBlockTypeConfig(block.type);
  const BlockIcon = config.icon;

  return (
    <div className={cn("rounded-md border overflow-hidden", config.colors.border, config.colors.bg)}>
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <div className={cn("rounded p-0.5", config.colors.iconBg)}>
          <BlockIcon className="h-3 w-3" />
        </div>
        <span className="text-[11px] font-semibold text-foreground truncate">{block.name}</span>
        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 ml-auto shrink-0">
          {blockExercises.length} ex.
        </Badge>
      </div>
      {blockExercises.length > 0 && (
        <div className="px-2 pb-1.5 space-y-0.5">
          {blockExercises.map((ex) => {
            const hasMethod = ex.trainingStyle && ex.trainingStyle !== "normal";
            const methodConfig = hasMethod ? getTrainingStyleConfig(ex.trainingStyle) : null;
            return (
              <div key={ex.id} className="flex items-center gap-1.5 text-[11px]">
                <span className="text-muted-foreground shrink-0">•</span>
                <span className="text-foreground/85 truncate flex-1">{ex.exerciseName}</span>
                {ex.sets && ex.reps && (
                  <span className="text-muted-foreground text-[10px] shrink-0">
                    {ex.sets}×{ex.reps}
                  </span>
                )}
                {hasMethod && methodConfig && (
                  <Badge
                    className={cn(
                      "text-[8px] px-1 py-0 h-3 border-0 text-white shrink-0",
                      methodConfig.color || "bg-primary"
                    )}
                  >
                    {methodConfig.label.split(" ")[0]}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Session card with expand/collapse ──
const SessionCard = ({
  day,
  isActive,
  onOpen,
  onCopy,
  onPaste,
  onRemove,
  hasClipboard,
}: {
  day: ProgramDay;
  weekId: string;
  isActive: boolean;
  onOpen: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onRemove: () => void;
  hasClipboard: boolean;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { branding } = useCoachTheme();
  const primaryColor = branding?.primary_color || "#2563eb";

  const exerciseCount = day.exercises.length;
  const blockCount = day.blocks.length;

  const methodStyles = new Map<string, { label: string; color: string }>();
  for (const ex of day.exercises) {
    if (ex.trainingStyle && ex.trainingStyle !== "normal") {
      if (!methodStyles.has(ex.trainingStyle)) {
        const config = getTrainingStyleConfig(ex.trainingStyle);
        methodStyles.set(ex.trainingStyle, { label: config.label, color: config.color });
      }
    }
  }

  const seenGroups = new Set<string>();
  const previewItems: string[] = [];
  for (const ex of day.exercises) {
    if (previewItems.length >= 3) break;
    if (ex.groupId) {
      if (seenGroups.has(ex.groupId)) continue;
      seenGroups.add(ex.groupId);
    }
    previewItems.push(ex.exerciseName);
  }
  const actualRemaining = exerciseCount - previewItems.length;

  const dayLabel = day.dayOfWeek
    ? DAYS_OF_WEEK.find((d) => d.id === day.dayOfWeek)?.shortLabel
    : null;

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const getContrastColor = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? "#1a1a2e" : "#ffffff";
  };

  const bannerTextColor = getContrastColor(primaryColor);

  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden transition-all duration-300 group",
        "border shadow-sm hover:shadow-lg hover:-translate-y-[1px]",
        isExpanded ? "min-w-[200px]" : "min-w-[170px]",
        isActive ? "ring-2 shadow-md" : "border-border/60 hover:border-opacity-60"
      )}
      style={{
        borderColor: isActive ? primaryColor : undefined,
        ...(isActive ? ({ "--tw-ring-color": primaryColor } as React.CSSProperties) : {}),
      }}
    >
      {/* ── Coach-colored header banner ── */}
      <div
        className="px-3 py-2.5 flex items-center justify-between gap-1"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
          color: bannerTextColor,
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {dayLabel && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
              style={{ backgroundColor: `${bannerTextColor}20` }}
            >
              {dayLabel}
            </span>
          )}
          <span className="text-sm font-bold truncate">{day.name}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-white/20"
                style={{ color: bannerTextColor }}
                onClick={onOpen}
                aria-label="Modifier la séance"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Modifier la séance</TooltipContent>
          </Tooltip>
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-white/20"
                  style={{ color: bannerTextColor }}
                  onClick={onCopy}
                  aria-label="Copier la séance"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Copier la séance</TooltipContent>
            </Tooltip>
            {hasClipboard && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-white/20"
                    style={{ color: bannerTextColor }}
                    onClick={onPaste}
                    aria-label="Coller la séance"
                  >
                    <ClipboardPaste className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Coller la séance</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-white/20"
                  style={{ color: `${bannerTextColor}aa` }}
                  onClick={onRemove}
                  aria-label="Supprimer la séance"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Supprimer la séance</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="bg-card">
        {exerciseCount > 0 ? (
          <div className="px-3 py-2.5 space-y-2">
            {!isExpanded && (
              <>
                <div className="space-y-1 border-l-2 pl-2" style={{ borderColor: `${primaryColor}30` }}>
                  {previewItems.map((name, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Dumbbell className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-xs text-foreground/85 truncate leading-tight">{name}</span>
                    </div>
                  ))}
                  {actualRemaining > 0 && (
                    <p className="text-[10px] text-muted-foreground pl-[18px]">
                      +{actualRemaining} exercice{actualRemaining > 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                {methodStyles.size > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Array.from(methodStyles.values()).map((method, i) => (
                      <Badge
                        key={i}
                        className={cn(
                          "text-[9px] px-1.5 py-0 h-4 font-semibold text-white border-0 shrink-0",
                          method.color || "bg-primary"
                        )}
                      >
                        {method.label.length > 18 ? method.label.slice(0, 16) + "…" : method.label}
                      </Badge>
                    ))}
                  </div>
                )}
              </>
            )}

            {isExpanded && (
              <div className="space-y-2">
                {day.blocks.length > 0 ? (
                  day.blocks.map((block) => (
                    <BlockDetail key={block.id} block={block} exercises={day.exercises} />
                  ))
                ) : (
                  <div className="space-y-1 border-l-2 pl-2" style={{ borderColor: `${primaryColor}30` }}>
                    {day.exercises.map((ex) => (
                      <div key={ex.id} className="flex items-center gap-1.5">
                        <Dumbbell className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-xs text-foreground/85 truncate flex-1">{ex.exerciseName}</span>
                        {ex.sets && ex.reps && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {ex.sets}×{ex.reps}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {methodStyles.size > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Array.from(methodStyles.values()).map((method, i) => (
                      <Badge
                        key={i}
                        className={cn(
                          "text-[9px] px-1.5 py-0 h-4 font-semibold text-white border-0 shrink-0",
                          method.color || "bg-primary"
                        )}
                      >
                        {method.label.length > 18 ? method.label.slice(0, 16) + "…" : method.label}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-1.5 border-t border-border/40">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {blockCount > 0 && (
                  <>
                    <Layers className="h-3 w-3" />
                    <span className="font-medium">
                      {blockCount} bloc{blockCount > 1 ? "s" : ""}
                    </span>
                    <span className="text-muted-foreground/60">·</span>
                  </>
                )}
                <span>{exerciseCount} ex.</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                onClick={handleToggleExpand}
              >
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-5 text-muted-foreground gap-1 px-3 pb-3">
            <Dumbbell className="h-4 w-4 opacity-40" />
            <span className="text-xs">Séance vide</span>
          </div>
        )}
      </div>
    </div>
  );
};

export function ProgramGridView({
  weeks,
  onAddWeek,
  onDuplicateWeek,
  onRemoveWeek,
  onAddDay,
  onRemoveDay,
  onOpenSession,
  onCopySession,
  onPasteSession,
  hasClipboard,
  activeSessionId,
}: ProgramGridViewProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="space-y-1">
        <div className="space-y-3">
          {weeks.map((week) => (
            <div key={week.id} className="border rounded-lg overflow-hidden bg-card/50">
              {/* Week header */}
              <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">Semaine {week.weekNumber}</span>
                  <Badge variant="secondary" className="text-xs">
                    {week.days.length} séance{week.days.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => onDuplicateWeek(week.id)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Dupliquer la semaine</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => onRemoveWeek(week.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Supprimer la semaine</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* Days as horizontal cards */}
              <div className="p-3">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {week.days.map((day) => (
                    <div key={day.id} className="shrink-0 w-[180px]">
                      <SessionCard
                        day={day}
                        weekId={week.id}
                        isActive={activeSessionId === day.id}
                        onOpen={() => onOpenSession(week.id, day.id)}
                        onCopy={() => onCopySession(week.id, day.id)}
                        onPaste={() => onPasteSession(week.id, day.id)}
                        onRemove={() => onRemoveDay(week.id, day.id)}
                        hasClipboard={hasClipboard}
                      />
                    </div>
                  ))}

                  {/* Add day button */}
                  <div className="shrink-0 w-[120px]">
                    <button
                      onClick={() => onAddDay(week.id)}
                      className={cn(
                        "w-full h-full min-h-[100px] rounded-lg border-2 border-dashed border-border",
                        "flex flex-col items-center justify-center gap-1.5 text-muted-foreground",
                        "hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-colors"
                      )}
                    >
                      <Plus className="h-5 w-5" />
                      <span className="text-xs font-medium">Ajouter une séance</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add week button */}
        <Button
          variant="outline"
          onClick={onAddWeek}
          className="w-full gap-2 h-10 border-dashed mt-3"
        >
          <Plus className="h-4 w-4" />
          Ajouter une semaine
        </Button>
      </div>
    </TooltipProvider>
  );
}
