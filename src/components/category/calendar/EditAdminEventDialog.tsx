import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, MapPin, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface EditAdminEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: any | null;
}

const TYPE_LABEL: Record<string, string> = {
  medical: "Rendez-vous médical",
  video_analyse: "Analyse vidéo",
  reunion: "Réunion d'équipe",
};

function parseNotes(raw: string | null) {
  const safe = raw || "";
  // Format produced by CreateEventDialog: `${title}${location ? ` - ${location}` : ""}${notes ? `\n${notes}` : ""}`
  const [firstLine = "", ...rest] = safe.split("\n");
  let title = firstLine;
  let location = "";
  const dashIdx = firstLine.lastIndexOf(" - ");
  if (dashIdx > 0) {
    title = firstLine.slice(0, dashIdx);
    location = firstLine.slice(dashIdx + 3);
  }
  const notes = rest.join("\n");
  return { title, location, notes };
}

export function EditAdminEventDialog({ open, onOpenChange, session }: EditAdminEventDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const dialogTitle = useMemo(
    () => TYPE_LABEL[session?.training_type] || "Événement",
    [session?.training_type]
  );

  useEffect(() => {
    if (!session) return;
    const parsed = parseNotes(session.notes);
    setTitle(parsed.title || dialogTitle);
    setLocation(parsed.location);
    setNotes(parsed.notes);
    setStartTime((session.session_start_time || "09:00:00").substring(0, 5));
    setEndTime((session.session_end_time || "10:00:00").substring(0, 5));
  }, [session, dialogTitle]);

  const updateEvent = useMutation({
    mutationFn: async () => {
      if (!session) return;
      const composedNotes = `${title}${location ? ` - ${location}` : ""}${notes ? `\n${notes}` : ""}`;
      const { error } = await supabase
        .from("training_sessions")
        .update({
          session_start_time: startTime,
          session_end_time: endTime,
          notes: composedNotes,
        })
        .eq("id", session.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_sessions"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["today_sessions"] });
      toast.success("Événement mis à jour");
      onOpenChange(false);
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  if (!session) return null;
  const date = new Date(session.session_date);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden border-border/70 bg-background/95 p-0 shadow-2xl backdrop-blur-md">
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 mr-1"
              onClick={() => onOpenChange(false)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Calendar className="h-5 w-5 text-primary" />
            {dialogTitle}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {format(date, "EEEE d MMMM yyyy", { locale: fr })}
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Titre</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-start" className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> Début
              </Label>
              <Input
                id="edit-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-end" className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> Fin
              </Label>
              <Input
                id="edit-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-location" className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Lieu (optionnel)
            </Label>
            <Input
              id="edit-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Salle de réunion, cabinet..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes (optionnel)</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informations complémentaires..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => updateEvent.mutate()} disabled={updateEvent.isPending}>
            {updateEvent.isPending ? "Mise à jour..." : "Mettre à jour"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const ADMIN_EVENT_TYPES = ["medical", "video_analyse", "reunion"];
