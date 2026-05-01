import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Check } from "lucide-react";
import { DAYS_OF_WEEK } from "@/lib/program-builder-v2/daysOfWeek";
import { useEffect } from "react";
import { createPortal } from "react-dom";

interface SessionEditorSheetProps {
  open: boolean;
  onClose: () => void;
  weekNumber: number;
  dayName: string;
  dayOfWeek?: string;
  dayId: string;
  weekId: string;
  onUpdateDayName: (weekId: string, dayId: string, name: string) => void;
  onUpdateDayOfWeek: (weekId: string, dayId: string, dayOfWeek: string) => void;
  /** Called when the user clicks "Enregistrer la séance" */
  onSave?: () => void;
  saving?: boolean;
  /** Indicates the program has been saved and is up to date */
  isSavedUpToDate?: boolean;
  /** Render prop for the full session content (blocks, exercises, method builders, etc.) */
  renderSessionContent: () => React.ReactNode;
  /** Render prop for the exercise library panel */
  renderExerciseLibrary: () => React.ReactNode;
}

export function SessionEditorSheet({
  open,
  onClose,
  weekNumber,
  dayName,
  dayOfWeek,
  dayId,
  weekId,
  onUpdateDayName,
  onUpdateDayOfWeek,
  onSave,
  saving,
  isSavedUpToDate,
  renderSessionContent,
  renderExerciseLibrary,
}: SessionEditorSheetProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-background flex flex-col animate-in fade-in-0 duration-200">
      {/* Header */}
      <div className="h-14 px-4 border-b bg-background shrink-0 flex items-center justify-between gap-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-primary">Semaine {weekNumber}</span>
          <div className="h-5 w-px bg-border" />
          <Input
            value={dayName}
            onChange={(e) => onUpdateDayName(weekId, dayId, e.target.value)}
            className="font-medium w-40 h-8 text-sm"
          />
          <Select value={dayOfWeek || ""} onValueChange={(v) => onUpdateDayOfWeek(weekId, dayId, v)}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue placeholder="Jour..." />
            </SelectTrigger>
            <SelectContent>
              {DAYS_OF_WEEK.map((dow) => (
                <SelectItem key={dow.id} value={dow.id}>
                  {dow.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          {onSave && (
            <Button
              variant={isSavedUpToDate ? "outline" : "default"}
              size="sm"
              onClick={onSave}
              disabled={saving || isSavedUpToDate}
              className={`gap-2 h-9 ${isSavedUpToDate
                ? "border-green-500 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 cursor-default"
                : "bg-primary text-primary-foreground hover:bg-primary/90"} opacity-100`}
            >
              {isSavedUpToDate ? (
                <>
                  <Check className="h-4 w-4" />
                  Programme à jour
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {saving ? "Enregistrement..." : "Enregistrer la séance"}
                </>
              )}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Two-panel layout: Session editor + Exercise library */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Session editor — full remaining width */}
        <div className="flex-1 min-w-0 min-h-0 overflow-auto">
          <div className="p-3 pt-4 space-y-2 min-w-[600px]">{renderSessionContent()}</div>
        </div>

        {/* Exercise library — fixed width */}
        <div className="w-72 xl:w-80 border-l flex-shrink-0 min-h-0 overflow-hidden flex flex-col bg-background">
          {renderExerciseLibrary()}
        </div>
      </div>
    </div>,
    document.body,
  );
}
