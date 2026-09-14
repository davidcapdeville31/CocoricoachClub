import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Leaf } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  categoryId: string;
  playerId: string;
}

/** Activités de récupération — génériques, valables pour toutes les disciplines. */
const RECOVERY_ACTIVITIES = [
  { key: "footing", label: "Footing léger", rpe: 3 },
  { key: "mobilite", label: "Mobilité / étirements", rpe: 2 },
  { key: "piscine", label: "Piscine", rpe: 3 },
  { key: "velo", label: "Vélo souple", rpe: 3 },
  { key: "soins", label: "Soins / massage", rpe: 1 },
  { key: "autre", label: "Autre", rpe: 2 },
];

const DURATIONS = [15, 20, 30, 45, 60, 90];

/**
 * Saisie express d'une journée de récupération.
 * Elle crée une vraie séance légère (RPE 1-4) qui compte dans la charge
 * d'entraînement, au lieu d'être comptabilisée comme un repos total.
 */
export function RecoverySessionDialog({ open, onOpenChange, date, categoryId, playerId }: Props) {
  const qc = useQueryClient();
  const [activity, setActivity] = useState(RECOVERY_ACTIVITIES[0]);
  const [duration, setDuration] = useState(30);
  const [rpe, setRpe] = useState(3);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setActivity(RECOVERY_ACTIVITIES[0]);
      setDuration(30);
      setRpe(RECOVERY_ACTIVITIES[0].rpe);
      setNotes("");
    }
  }, [open]);

  const submit = useMutation({
    mutationFn: async () => {
      const sessionDate = format(date, "yyyy-MM-dd");
      // Créneau fictif cohérent : la durée sert au calcul de la charge (RPE × minutes).
      const startMinutes = 18 * 60;
      const endMinutes = startMinutes + duration;
      const pad = (n: number) => String(n).padStart(2, "0");
      const toTime = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

      const { data, error } = await supabase.functions.invoke("athlete-create-session", {
        body: {
          category_id: categoryId,
          player_id: playerId,
          session_date: sessionDate,
          training_type: "récupération",
          session_start_time: toTime(startMinutes),
          session_end_time: toTime(endMinutes),
          intensity: rpe,
          notes: [activity.label, notes.trim()].filter(Boolean).join(" — "),
        },
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error || "Échec de l'enregistrement");
      return data;
    },
    onSuccess: () => {
      toast.success("Séance de récupération enregistrée");
      qc.invalidateQueries({ queryKey: ["athlete-calendar-sessions", categoryId, playerId] });
      qc.invalidateQueries({ queryKey: ["athlete-space-sessions"] });
      qc.invalidateQueries({ queryKey: ["athlete-space-rpe-history", playerId] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erreur lors de l'enregistrement"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto overscroll-contain touch-pan-y">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Leaf className="h-4 w-4 text-emerald-500" />
            Récupération — {format(date, "dd/MM/yyyy")}
          </DialogTitle>
          <DialogDescription>
            Une activité de récupération compte comme une charge légère, et non comme un jour de repos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Activité</Label>
            <div className="flex flex-wrap gap-2">
              {RECOVERY_ACTIVITIES.map((a) => (
                <Button
                  key={a.key}
                  type="button"
                  variant={activity.key === a.key ? "default" : "outline"}
                  size="sm"
                  className="rounded-xl"
                  onClick={() => {
                    setActivity(a);
                    setRpe(a.rpe);
                  }}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Durée</Label>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant={duration === d ? "default" : "outline"}
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setDuration(d)}
                >
                  {d} min
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ressenti (RPE)</Label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4].map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant={rpe === v ? "default" : "outline"}
                  size="sm"
                  className={cn("rounded-xl w-12", rpe === v && "bg-emerald-600 hover:bg-emerald-700")}
                  onClick={() => setRpe(v)}
                >
                  {v}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Charge estimée : {rpe * duration} (RPE {rpe} × {duration} min)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Note (optionnel)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex : 20 min de footing + étirements"
              className="min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => submit.mutate()} className="gap-2">
            {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
