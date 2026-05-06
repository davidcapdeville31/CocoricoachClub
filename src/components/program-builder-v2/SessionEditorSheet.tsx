import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Check, Dumbbell, ListTodo } from "lucide-react";
import { DAYS_OF_WEEK } from "@/lib/program-builder-v2/daysOfWeek";
import { useEffect, useState } from "react";
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
  onSave?: () => void;
  saving?: boolean;
  isSavedUpToDate?: boolean;
  renderSessionContent: () => React.ReactNode;
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
  const [mobileTab, setMobileTab] = useState<"session" | "library">("session");

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  // Auto-switch to Séance tab on mobile after inserting an exercise from the library
  useEffect(() => {
    if (!open) return;
    const handler = () => setMobileTab("session");
    window.addEventListener("v2-exercise-inserted", handler);
    return () => window.removeEventListener("v2-exercise-inserted", handler);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-background flex flex-col animate-in fade-in-0 duration-200">
      {/* Header */}
      <div className="px-2 sm:px-4 py-2 border-b bg-background shrink-0 sticky top-0 z-10 flex items-center gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
          <span className="text-xs sm:text-sm font-bold text-primary shrink-0">S{weekNumber}</span>
          <Input
            value={dayName}
            onChange={(e) => onUpdateDayName(weekId, dayId, e.target.value)}
            className="font-medium w-24 sm:w-40 h-8 text-xs sm:text-sm"
          />
          <Select value={dayOfWeek || ""} onValueChange={(v) => onUpdateDayOfWeek(weekId, dayId, v)}>
            <SelectTrigger className="w-24 sm:w-28 h-8 text-xs">
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
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {onSave && (
            <Button
              variant={isSavedUpToDate ? "outline" : "default"}
              size="sm"
              onClick={onSave}
              disabled={saving || isSavedUpToDate}
              className={`gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3 ${isSavedUpToDate
                ? "border-green-500 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 cursor-default"
                : "bg-primary text-primary-foreground hover:bg-primary/90"} opacity-100`}
            >
              {isSavedUpToDate ? (
                <>
                  <Check className="h-4 w-4" />
                  <span className="hidden sm:inline">Programme à jour</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span className="hidden sm:inline">{saving ? "Enregistrement..." : "Enregistrer la séance"}</span>
                </>
              )}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 sm:h-9 sm:w-9">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile tabs (md and below) */}
      <div className="md:hidden border-b bg-card shrink-0 flex">
        <button
          type="button"
          onClick={() => setMobileTab("session")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
            mobileTab === "session" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
          }`}
        >
          <ListTodo className="h-4 w-4" />
          Séance
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("library")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
            mobileTab === "library" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
          }`}
        >
          <Dumbbell className="h-4 w-4" />
          Bibliothèque
        </button>
      </div>

      {/* Two-panel layout: stacked on mobile (one shown), side-by-side on md+ */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Session editor */}
        <div className={`${mobileTab === "session" ? "flex" : "hidden"} md:flex flex-1 min-w-0 min-h-0 overflow-auto`}>
          <div className="w-full p-2 sm:p-3 pt-3 sm:pt-4 space-y-2 md:min-w-[600px]">{renderSessionContent()}</div>
        </div>

        {/* Exercise library */}
        <div className={`${mobileTab === "library" ? "flex" : "hidden"} md:flex w-full md:w-72 xl:w-80 md:border-l flex-shrink-0 min-h-0 overflow-hidden flex-col bg-background`}>
          {renderExerciseLibrary()}
        </div>
      </div>
    </div>,
    document.body,
  );
}
