import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Brain, CalendarDays, ArrowRight } from "lucide-react";
import { MentalSessionContent } from "./MentalSessionContent";
import { SessionAuthor } from "@/components/shared/SessionAuthor";
import { getDisplayNotes, getSessionTitleFromNotes, parseMentalFromNotes } from "@/lib/utils/sessionNotes";

export function MentalSessionDialog({ session, onClose, onRespond }: {
  session: { id: string; notes: string | null; session_date: string } | null;
  onClose: () => void;
  onRespond?: () => void;
}) {
  const meta = parseMentalFromNotes(session?.notes);
  return <Dialog open={!!session} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] max-w-2xl flex-col overflow-hidden p-0 sm:h-auto sm:max-h-[90dvh]">
      <DialogHeader className="shrink-0 border-b border-border p-5 pr-12 text-left">
        <div className="flex items-center gap-2 text-xs font-semibold text-accent"><Brain className="h-4 w-4" />Préparation mentale</div>
        <DialogTitle className="break-words text-xl leading-snug">{getSessionTitleFromNotes(session?.notes)?.replace(/^#+\s*|\*\*/g, "") || "Ma séance mentale"}</DialogTitle>
        <SessionAuthor sessionId={session?.id} />
        <DialogDescription className="flex flex-wrap items-center gap-2"><CalendarDays className="h-4 w-4" />{session?.session_date.split("-").reverse().join("/")}{meta?.duration_min ? ` · ${meta.duration_min} min` : ""}{meta?.theme ? ` · ${meta.theme}` : ""}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6"><MentalSessionContent text={getDisplayNotes(session?.notes)} /></div>
      {onRespond && <div className="shrink-0 border-t border-border bg-card p-4"><Button className="h-12 w-full" onClick={onRespond}>Mes observations et mon bilan<ArrowRight className="ml-2 h-4 w-4" /></Button></div>}
    </DialogContent>
  </Dialog>;
}