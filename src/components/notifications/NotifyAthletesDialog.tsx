import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Send, Loader2, Users, Bell } from "lucide-react";

interface Athlete {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  user_id?: string | null;
}

interface NotifyAthletesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  athletes: Athlete[];
  eventType: "session" | "match" | "event" | "custom";
  defaultSubject?: string;
  defaultMessage?: string;
  categoryId?: string;
  eventDetails?: {
    date?: string;
    time?: string;
    location?: string;
  };
}

export function NotifyAthletesDialog({
  open,
  onOpenChange,
  athletes,
  eventType,
  defaultSubject = "",
  defaultMessage = "",
  categoryId,
  eventDetails,
}: NotifyAthletesDialogProps) {
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(defaultMessage);
  const [sendPush, setSendPush] = useState(true);

  const linkedAthletes = athletes.filter((a) => a.user_id);

  const sendNotification = useMutation({
    mutationFn: async () => {
      if (!sendPush) {
        throw new Error("Veuillez sélectionner les notifications push");
      }

      if (linkedAthletes.length === 0) {
        throw new Error("Aucun athlète sélectionné n'a de compte lié");
      }

      const { data, error } = await supabase.functions.invoke("notify-athletes", {
        body: {
          athletes: linkedAthletes.map((a) => ({
            name: a.name,
            user_id: a.user_id,
          })),
          subject,
          message,
          channels: ["push"],
          eventType,
          eventDetails,
          category_id: categoryId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      if (data.errors?.length) {
        toast.warning("Envoi partiel : certaines notifications n'ont pas pu être envoyées");
      } else {
        toast.success("Notifications transmises au service push et à la cloche de l'application");
      }
      onOpenChange(false);
      setMessage("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de l'envoi des notifications");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sendNotification.isPending) return;
    if (!subject.trim() || !message.trim()) {
      toast.error("Veuillez remplir le sujet et le message");
      return;
    }
    sendNotification.mutate();
  };

  useEffect(() => {
    if (open) {
      setSubject(defaultSubject);
      setMessage(defaultMessage);
      setSendPush(true);
    }
  }, [open, defaultSubject, defaultMessage]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Notifier les athlètes
          </DialogTitle>
          <DialogDescription>
            Envoyez une notification aux {athletes.length} athlète(s) sélectionné(s)
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Athletes summary */}
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
               <strong>{athletes.length}</strong> athlète(s) • 
               <span className="text-muted-foreground"> {linkedAthletes.length} avec un compte lié</span>
            </span>
          </div>

          {/* Notification channels */}
          <div className="space-y-3">
            <Label>Canaux de notification</Label>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sendPush"
                  checked={sendPush}
                  onCheckedChange={(checked) => setSendPush(checked as boolean)}
                />
                <label
                  htmlFor="sendPush"
                  className="flex items-center gap-2 text-sm font-medium cursor-pointer"
                >
                  <Bell className="h-4 w-4" />
                  Push
                </label>
              </div>
            </div>
            {!sendPush && (
              <p className="text-sm text-destructive">
                Sélectionnez au moins un canal
              </p>
            )}
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Sujet *</Label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Rappel entraînement demain"
              className="w-full px-3 py-2 border rounded-md bg-background"
              required
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Votre message aux athlètes..."
              rows={4}
              required
            />
          </div>

          {/* Event details preview */}
          {eventDetails && (eventDetails.date || eventDetails.time || eventDetails.location) && (
            <div className="p-3 bg-accent/20 rounded-lg text-sm space-y-1">
              <p className="font-medium text-muted-foreground">Détails inclus automatiquement :</p>
              {eventDetails.date && <p>📅 {eventDetails.date}</p>}
              {eventDetails.time && <p>🕐 {eventDetails.time}</p>}
              {eventDetails.location && <p>📍 {eventDetails.location}</p>}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
            >
              {sendNotification.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Envoyer
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
