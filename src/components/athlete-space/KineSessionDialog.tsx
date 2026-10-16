import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, HeartPulse } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  categoryId: string;
  playerId: string;
}

const DURATIONS = [15, 20, 30, 45, 60, 90];

/** Saisie express d'une séance kiné, sur le modèle de la récupération (RPE 1 à 10). */
export function KineSessionDialog({ open, onOpenChange, date, categoryId, playerId }: Props) {
  const qc = useQueryClient();
  const [duration, setDuration] = useState(30);
  const [rpe, setRpe] = useState(3);
  const [zones, setZones] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setDuration(30);
      setRpe(3);
      setZones("");
      setNotes("");
    }
  }, [open]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!zones.trim()) throw new Error("Indique la ou les zones travaillées");
      const pad = (n: number) => String(n).padStart(2, "0");
      const toTime = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
      const start = 18 * 60;
      const { data, error } = await supabase.functions.invoke("athlete-create-session", {
        body: {
          category_id: categoryId,
          player_id: playerId,
          session_date: format(date, "yyyy-MM-dd"),
          training_type: "kine",
          session_start_time: toTime(start),
          session_end_time: toTime(start + duration),
          intensity: rpe,
          notes: [`Zones travaillées : ${zones.trim()}`, notes.trim()].filter(Boolean).join(" — "),
        },
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error || "Échec de l'enregistrement");
      return data;
    },
    onSuccess: () => {
      toast.success("Séance kiné enregistrée");
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
            <HeartPulse className="h-4 w-4 text-primary" />
            Kiné — {format(date, "dd/MM/yyyy")}
          </DialogTitle>
          <DialogDescription>Ta séance de kiné compte dans ta charge d'entraînement.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kine-zones">Zone(s) travaillée(s)</Label>
            <Input id="kine-zones" value={zones} onChange={(e) => setZones(e.target.value)} placeholder="Ex : genou droit, ischios" className="rounded-xl" />
          </div>

          <div className="space-y-2">
            <Label>Durée</Label>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <Button key={d} type="button" variant={duration === d ? "default" : "outline"} size="sm" className="rounded-xl" onClick={() => setDuration(d)}>
                  {d} min
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="kine-custom-duration" className="text-xs text-muted-foreground whitespace-nowrap">Autre durée :</Label>
              <Input
                id="kine-custom-duration"
                type="number"
                inputMode="numeric"
                min={1}
                max={600}
                value={DURATIONS.includes(duration) ? "" : duration}
                placeholder="ex : 56"
                className="w-24 h-8 rounded-xl"
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 1 && v <= 600) setDuration(v);
                  else if (e.target.value === "") setDuration(30);
                }}
              />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ressenti (RPE)</Label>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                <Button key={v} type="button" variant="outline" data-rpe={v} aria-pressed={rpe === v} size="sm" className="min-h-11 rounded-xl" onClick={() => setRpe(v)}>
                  {v}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Charge estimée : {rpe * duration} (RPE {rpe} × {duration} min)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="kine-notes">Notes</Label>
            <Textarea id="kine-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Décris la séance : massages, renforcement, exercices…" className="min-h-[80px]" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => submit.mutate()} className="gap-2">
            {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
