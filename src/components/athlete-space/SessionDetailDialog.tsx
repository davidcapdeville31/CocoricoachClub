import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock, Calendar as CalendarIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { GroupedExerciseList } from "@/components/category/GroupedExerciseList";
import { getTrainingTypeLabel } from "@/lib/constants/trainingTypes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: any | null;
  exercises: any[];
}

export function SessionDetailDialog({ open, onOpenChange, session, exercises }: Props) {
  if (!session) return null;

  const rawNotes = String(session.notes || "").replace(/<!--[\s\S]*?-->/g, "").trim();
  const dateLabel = session.session_date
    ? format(parseISO(session.session_date), "EEEE d MMMM yyyy", { locale: fr })
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Activity className="h-5 w-5 text-primary" />
            {getTrainingTypeLabel(session.training_type)}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-3 pt-1">
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateLabel}
            </span>
            {session.session_start_time && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {String(session.session_start_time).slice(0, 5)}
                {session.session_end_time && ` - ${String(session.session_end_time).slice(0, 5)}`}
              </span>
            )}
            <Badge variant="outline">{getTrainingTypeLabel(session.training_type)}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {rawNotes && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs uppercase tracking-wide font-semibold text-primary mb-1.5">
                Consignes du coach
              </p>
              <p className="text-sm whitespace-pre-line text-foreground/90">{rawNotes}</p>
            </div>
          )}

          {exercises.length > 0 ? (
            <div>
              <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-2">
                Contenu de la séance ({exercises.length} exercice{exercises.length > 1 ? "s" : ""})
              </p>
              <GroupedExerciseList exercises={exercises} maxHeight="60vh" />
            </div>
          ) : !rawNotes ? (
            <p className="text-sm text-muted-foreground italic text-center py-6">
              Aucun détail fourni par le coach pour cette séance.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
