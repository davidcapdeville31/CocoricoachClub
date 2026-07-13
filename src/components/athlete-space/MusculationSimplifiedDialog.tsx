import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Dumbbell, Loader2, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  categoryId: string;
  athletePlayerId: string;
}

/**
 * Mode simplifié de création d'une séance musculation côté athlète.
 * Saisie rapide : notes libres, durée (min), RPE (1-10).
 * À la validation, on crée une séance `training_type = "musculation"` via
 * l'edge function `athlete-create-session` — la séance apparaît dans le
 * calendrier ET alimente les stats d'entraînement (volume musculation)
 * grâce à la durée renseignée.
 */
export function MusculationSimplifiedDialog({
  open,
  onOpenChange,
  date,
  categoryId,
  athletePlayerId,
}: Props) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [durationMin, setDurationMin] = useState<number>(60);
  const [rpe, setRpe] = useState<number>(6);

  useEffect(() => {
    if (!open) {
      setNotes("");
      setDurationMin(60);
      setRpe(6);
    }
  }, [open]);

  const computeEndTime = (start: string, mins: number) => {
    const [h, m] = start.split(":").map(Number);
    const total = h * 60 + m + Math.max(0, mins || 0);
    const eh = String(Math.floor(total / 60) % 24).padStart(2, "0");
    const em = String(total % 60).padStart(2, "0");
    return `${eh}:${em}`;
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!durationMin || durationMin <= 0) {
        throw new Error("Renseignez une durée > 0");
      }
      if (!rpe || rpe < 1 || rpe > 10) {
        throw new Error("Le RPE doit être entre 1 et 10");
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error("Session expirée. Reconnectez-vous puis réessayez.");
      }
      const start = "09:00";
      const end = computeEndTime(start, durationMin);
      const notesPayload = [
        "<!--MUSCU_SIMPLIFIED-->",
        notes.trim() || "Séance musculation (mode simplifié)",
        `Durée : ${durationMin} min · RPE : ${rpe}/10`,
      ].join("\n");

      const { data, error } = await supabase.functions.invoke(
        "athlete-create-session",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          body: {
            category_id: categoryId,
            player_id: athletePlayerId,
            session_date: format(date, "yyyy-MM-dd"),
            session_start_time: start,
            session_end_time: end,
            training_type: "musculation",
            intensity: rpe,
            notes: notesPayload,
          },
        },
      );
      if (error) throw error;
      if (!data?.success || !data?.session_id) {
        throw new Error(data?.error || "Erreur lors de la création");
      }
      return data.session_id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["today_sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["training-stats"] });
      toast.success("Séance musculation ajoutée");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Impossible d'enregistrer"),
  });

  const rpeColors = [
    "bg-emerald-500",
    "bg-emerald-500",
    "bg-emerald-500",
    "bg-lime-500",
    "bg-lime-500",
    "bg-amber-500",
    "bg-amber-500",
    "bg-orange-500",
    "bg-orange-500",
    "bg-rose-500",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            <Dumbbell className="h-5 w-5 text-emerald-600" />
            Séance musculation — mode simplifié
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {format(date, "EEEE d MMMM yyyy", { locale: fr })}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="muscu-notes">Description de la séance</Label>
            <Textarea
              id="muscu-notes"
              placeholder="Ex : Haut du corps — 4x8 développé couché, tractions, rowing…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="muscu-duration">Durée (minutes)</Label>
              <Input
                id="muscu-duration"
                type="number"
                min={1}
                max={600}
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="muscu-rpe">RPE ressenti (1-10)</Label>
              <Input
                id="muscu-rpe"
                type="number"
                min={1}
                max={10}
                value={rpe}
                onChange={(e) =>
                  setRpe(Math.min(10, Math.max(1, Number(e.target.value) || 0)))
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-1">
            {Array.from({ length: 10 }).map((_, i) => {
              const value = i + 1;
              const active = value <= rpe;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRpe(value)}
                  className={cn(
                    "h-8 flex-1 rounded-md text-xs font-semibold text-white transition-opacity",
                    rpeColors[i],
                    active ? "opacity-100" : "opacity-25",
                  )}
                  aria-label={`RPE ${value}`}
                >
                  {value}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            La durée renseignée sera comptabilisée dans tes stats d'entraînement
            "Musculation".
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {submitMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Valider la séance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
