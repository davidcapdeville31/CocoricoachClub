import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Layers, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  sessionId: string;
  playerId: string;
  categoryId: string;
  onAllSubmitted?: () => void;
}

const getRpeColor = (val: number) => {
  if (val <= 3) return "text-status-optimal";
  if (val <= 5) return "text-accent";
  if (val <= 7) return "text-warning";
  return "text-destructive";
};

export function AthleteFieldBlocksRpe({ sessionId, playerId, categoryId, onAllSubmitted }: Props) {
  const qc = useQueryClient();

  const { data: blocks = [] } = useQuery({
    queryKey: ["field-blocks", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_session_blocks")
        .select("id, block_order, theme, training_type, duration_minutes, notes")
        .eq("training_session_id", sessionId)
        .order("block_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!sessionId,
  });

  const { data: existing = [] } = useQuery({
    queryKey: ["field-blocks-rpe", sessionId, playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_block_athlete_rpe")
        .select("block_id, rpe, duration_minutes")
        .eq("training_session_id", sessionId)
        .eq("player_id", playerId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!sessionId && !!playerId,
  });

  const [rpe, setRpe] = useState<number>(5);

  const totalDuration = useMemo(
    () => blocks.reduce((s, b) => s + (b.duration_minutes || 0), 0),
    [blocks],
  );

  const alreadySubmitted = existing.length > 0 && existing.length >= blocks.length;

  // Pre-fill with average if already submitted
  useEffect(() => {
    if (existing.length > 0) {
      const totalDur = existing.reduce((s, e) => s + (e.duration_minutes || 0), 0);
      const weighted = existing.reduce((s, e) => s + (e.rpe || 0) * (e.duration_minutes || 0), 0);
      const avg = totalDur > 0 ? Math.round(weighted / totalDur) : existing[0].rpe;
      setRpe(avg);
    }
  }, [existing]);

  const totalLoad = rpe * (totalDuration || 0);

  const submit = useMutation({
    mutationFn: async () => {
      // Apply same RPE (session average) to every block
      const rows = blocks.map((b) => ({
        block_id: b.id,
        training_session_id: sessionId,
        player_id: playerId,
        category_id: categoryId,
        rpe,
        duration_minutes: b.duration_minutes ?? null,
      }));
      if (rows.length === 0) return;
      const { error } = await supabase.from("session_block_athlete_rpe").upsert(rows, {
        onConflict: "block_id,player_id",
      });
      if (error) throw error;

      await supabase.from("awcr_tracking").insert({
        player_id: playerId,
        category_id: categoryId,
        session_date: new Date().toISOString().split("T")[0],
        rpe,
        duration_minutes: totalDuration || null,
        training_session_id: sessionId,
      });
    },
    onSuccess: () => {
      toast.success("RPE de la séance enregistré ✅");
      qc.invalidateQueries({ queryKey: ["field-blocks-rpe", sessionId, playerId] });
      qc.invalidateQueries({ queryKey: ["athlete-space-rpes"] });
      qc.invalidateQueries({ queryKey: ["athlete-space-awcr"] });
      qc.invalidateQueries({ queryKey: ["athlete-space-sessions"] });
      onAllSubmitted?.();
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  if (blocks.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">Aucun bloc défini pour cette séance.</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm flex items-center gap-1.5">
          <Layers className="h-4 w-4 text-primary" /> RPE de la séance
        </Label>
        {totalDuration > 0 && (
          <Badge variant="secondary">{totalDuration} min · {blocks.length} bloc{blocks.length > 1 ? "s" : ""}</Badge>
        )}
      </div>

      {/* Block summary (read-only) */}
      <div className="rounded-lg border bg-muted/20 p-2 space-y-1">
        {blocks.map((b, idx) => (
          <div key={b.id} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">B{idx + 1}</Badge>
              <span>{b.theme || b.training_type}</span>
            </div>
            {b.duration_minutes && (
              <span className="text-muted-foreground">{b.duration_minutes} min</span>
            )}
          </div>
        ))}
      </div>

      {/* Single RPE slider */}
      <div className={`rounded-lg border p-3 ${alreadySubmitted ? "bg-status-optimal/5 border-status-optimal/40" : "bg-muted/10"}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">
            Note ton ressenti global pour l'ensemble de la séance
          </span>
          {alreadySubmitted && <CheckCircle2 className="h-4 w-4 text-status-optimal" />}
        </div>
        <Slider
          value={[rpe]}
          onValueChange={([v]) => setRpe(v)}
          min={1}
          max={10}
          step={1}
          disabled={alreadySubmitted}
        />
        <div className="flex justify-between mt-1">
          <span className={`text-lg font-bold ${getRpeColor(rpe)}`}>{rpe}/10</span>
          {totalDuration > 0 && (
            <span className="text-xs text-muted-foreground self-end">
              Charge totale : {totalLoad} UA
            </span>
          )}
        </div>
      </div>

      {!alreadySubmitted && (
        <Button onClick={() => submit.mutate()} disabled={submit.isPending} className="w-full">
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Valider mon RPE
        </Button>
      )}
    </div>
  );
}
