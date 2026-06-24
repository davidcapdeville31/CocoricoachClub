import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Send, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  AthleteWeightLogInput,
  buildWeightLogRecords,
  type WeightLogState,
} from "./AthleteWeightLogInput";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: { id: string; session_date: string; training_type?: string | null; notes?: string | null } | null;
  playerId: string;
  categoryId: string;
}

const FEELINGS = [
  { value: 1, label: "Super forme", emoji: "💪" },
  { value: 2, label: "Bien", emoji: "🙂" },
  { value: 3, label: "Moyen", emoji: "😐" },
  { value: 4, label: "Fatigué", emoji: "😓" },
  { value: 5, label: "Épuisé", emoji: "🥵" },
];

const getRpeColor = (val: number) => {
  if (val <= 3) return "text-status-optimal";
  if (val <= 5) return "text-accent";
  if (val <= 7) return "text-warning";
  return "text-destructive";
};

export function SessionValidationDialog({ open, onOpenChange, session, playerId, categoryId }: Props) {
  const qc = useQueryClient();
  const [feeling, setFeeling] = useState<number>(2);
  const [rpe, setRpe] = useState<number>(5);
  const [duration, setDuration] = useState<number>(60);
  const [comment, setComment] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [weightLogs, setWeightLogs] = useState<WeightLogState>({});

  const { data: blocks = [] } = useQuery({
    queryKey: ["validate-session-blocks", session?.id],
    queryFn: async () => {
      if (!session?.id) return [];
      const { data, error } = await supabase
        .from("training_session_blocks")
        .select("id, duration_minutes, theme, training_type, block_order")
        .eq("training_session_id", session.id)
        .order("block_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!session?.id && open,
  });

  const plannedDuration = useMemo(
    () => blocks.reduce((s, b) => s + (b.duration_minutes || 0), 0),
    [blocks],
  );

  useEffect(() => {
    if (open) {
      setFeeling(2);
      setRpe(5);
      setComment("");
      setDuration(plannedDuration > 0 ? plannedDuration : 60);
      setWeightLogs({});
    }
  }, [open, plannedDuration]);

  const totalLoad = rpe * (duration || 0);

  const handleSubmit = async () => {
    if (!session || !playerId || !categoryId) return;
    if (!duration || duration <= 0) {
      toast.error("Indique la durée de ta séance");
      return;
    }
    setSubmitting(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const sessionDate = session.session_date || today;

      // 1) Per-block RPE (when coach provided blocks)
      if (blocks.length > 0) {
        // Distribute duration proportionally to planned durations if any
        const sumPlanned = blocks.reduce((s, b) => s + (b.duration_minutes || 0), 0);
        const rows = blocks.map((b) => {
          let blockDur = b.duration_minutes ?? null;
          if (sumPlanned > 0 && b.duration_minutes) {
            blockDur = Math.round((b.duration_minutes / sumPlanned) * duration);
          } else if (sumPlanned === 0) {
            blockDur = Math.round(duration / blocks.length);
          }
          return {
            block_id: b.id,
            training_session_id: session.id,
            player_id: playerId,
            category_id: categoryId,
            rpe,
            duration_minutes: blockDur,
          };
        });
        const { error: rpeErr } = await supabase
          .from("session_block_athlete_rpe")
          .upsert(rows, { onConflict: "block_id,player_id" });
        if (rpeErr) throw rpeErr;
      }

      // 2) AWCR tracking (one entry for the session) — used by charge d'entraînement.
      // Update every existing row for this athlete/session first: older validations may have
      // created duplicate RPE rows without the post-session feedback, and the coach view reads
      // these rows by session.
      const awcrPayload = {
        player_id: playerId,
        category_id: categoryId,
        session_date: sessionDate,
        rpe,
        duration_minutes: duration,
        training_session_id: session.id,
        post_session_feeling: feeling,
        post_session_notes: comment || null,
      };
      const { data: updatedAwcrRows, error: updateAwcrErr } = await supabase
        .from("awcr_tracking")
        .update(awcrPayload)
        .eq("player_id", playerId)
        .eq("training_session_id", session.id)
        .select("id, post_session_feeling");
      if (updateAwcrErr) throw updateAwcrErr;

      const { error: awcrErr } = (updatedAwcrRows || []).length > 0
        ? { error: null }
        : await supabase.from("awcr_tracking").insert(awcrPayload);
      if (awcrErr) throw awcrErr;

      // Safety net: older duplicate rows may exist and the coach panel reads all rows for the session.
      // Force the selected post-session feeling onto every athlete/session row.
      const { error: feelingPatchErr } = await supabase
        .from("awcr_tracking")
        .update({ post_session_feeling: feeling, post_session_notes: comment || null })
        .eq("player_id", playerId)
        .eq("training_session_id", session.id);
      if (feelingPatchErr) throw feelingPatchErr;

      // 3) Also update the day's wellness row when it already exists.
      const { data: existingW } = await supabase
        .from("wellness_tracking")
        .select("id")
        .eq("player_id", playerId)
        .eq("tracking_date", sessionDate)
        .maybeSingle();
      if (existingW?.id) {
        await supabase
          .from("wellness_tracking")
          .update({ general_fatigue: feeling, notes: comment || null })
          .eq("id", existingW.id);
      }

      // 4) Persist actual weights into athlete_exercise_logs (feeds Tonnage & training load)
      const weightRecords = buildWeightLogRecords(weightLogs, {
        playerId,
        categoryId,
        trainingSessionId: session.id,
      });
      if (weightRecords.length > 0) {
        const stamped = weightRecords.map((r) => ({
          ...r,
          submitted_by: playerId,
          submitted_via: "athlete" as const,
          validation_status: "pending" as const,
        }));
        const { error: weightError } = await supabase
          .from("athlete_exercise_logs")
          .upsert(stamped, {
            onConflict: "training_session_id,player_id,exercise_name",
          });
        if (weightError) {
          console.error("Weight log insert error:", weightError);
          toast.error("Séance validée mais erreur sur les charges");
        }
      }

      toast.success("Séance validée ✅");
      qc.invalidateQueries({ queryKey: ["athlete-space-rpes"] });
      qc.invalidateQueries({ queryKey: ["athlete-space-awcr"] });
      qc.invalidateQueries({ queryKey: ["athlete-space-sessions"] });
      qc.invalidateQueries({ queryKey: ["athlete-calendar-sessions", categoryId, playerId] });
      qc.invalidateQueries({ queryKey: ["awcr-tracking"] });
      qc.invalidateQueries({ queryKey: ["wellness-tracking"] });
      qc.invalidateQueries({ queryKey: ["athlete-weight-log-existing"] });
      qc.invalidateQueries({ queryKey: ["athlete-weight-log-exercises"] });
      qc.invalidateQueries({ queryKey: ["tonnage"] });
      qc.invalidateQueries({ queryKey: ["pending-weight-logs"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-status-optimal" />
            Valider ma séance
          </DialogTitle>
          <DialogDescription>
            Renseigne tes charges réalisées puis tes sensations pour finaliser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Exercise logs (reps / sets / weight) — feeds tonnage & training load */}
          {session && playerId && (
            <AthleteWeightLogInput
              sessionId={session.id}
              playerId={playerId}
              value={weightLogs}
              onChange={setWeightLogs}
              trainingType={session.training_type ?? null}
            />
          )}

          {/* Feeling */}
          <div>
            <Label className="text-sm mb-2 block">Comment vous êtes-vous senti ?</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {FEELINGS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFeeling(f.value)}
                  className={`rounded-lg border px-1 py-2 text-[10px] sm:text-xs font-medium transition ${
                    feeling === f.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface hover:bg-muted"
                  }`}
                >
                  <div className="text-base sm:text-lg">{f.emoji}</div>
                  <div className="leading-tight">{f.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <Label className="text-sm mb-1.5 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" /> Durée de la séance (minutes)
            </Label>
            <Input
              type="number"
              min={1}
              max={600}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value || "0", 10))}
            />
            {plannedDuration > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Prévu par le coach : {plannedDuration} min
              </p>
            )}
          </div>

          {/* RPE */}
          <div className="rounded-lg border p-3 bg-muted/10">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm">RPE (Effort perçu)</Label>
              <span className={`text-lg font-bold ${getRpeColor(rpe)}`}>{rpe}/10</span>
            </div>
            <Slider value={[rpe]} onValueChange={([v]) => setRpe(v)} min={1} max={10} step={1} />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>Facile</span>
              <span>Modéré</span>
              <span>Max</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Charge estimée : <span className="font-semibold text-foreground">{totalLoad} UA</span>
            </p>
          </div>

          {/* Comment */}
          <div>
            <Label className="text-sm mb-1.5 block">Commentaire global (optionnel)</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ressenti, points forts, difficultés..."
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button className="flex-1 gap-1.5" onClick={handleSubmit} disabled={submitting}>
              <Send className="h-4 w-4" /> Valider et envoyer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
