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

  const [values, setValues] = useState<Record<string, number>>({});

  useEffect(() => {
    const next: Record<string, number> = {};
    for (const b of blocks) next[b.id] = 5;
    for (const e of existing) next[e.block_id] = e.rpe;
    setValues(next);
  }, [blocks, existing]);

  const submittedIds = new Set(existing.map((e) => e.block_id));
  const allDone = blocks.length > 0 && blocks.every((b) => submittedIds.has(b.id));

  const totalLoad = useMemo(
    () => existing.reduce((s, e) => s + (e.rpe || 0) * (e.duration_minutes || 0), 0),
    [existing],
  );

  const submit = useMutation({
    mutationFn: async () => {
      const rows = blocks
        .filter((b) => !submittedIds.has(b.id))
        .map((b) => ({
          block_id: b.id,
          training_session_id: sessionId,
          player_id: playerId,
          category_id: categoryId,
          rpe: values[b.id] ?? 5,
          duration_minutes: b.duration_minutes ?? null,
        }));
      if (rows.length === 0) return;
      const { error } = await supabase.from("session_block_athlete_rpe").upsert(rows, {
        onConflict: "block_id,player_id",
      });
      if (error) throw error;

      // Also write a session-level entry into awcr_tracking so charge is reflected globally
      const totalDuration = blocks.reduce((s, b) => s + (b.duration_minutes || 0), 0);
      const totalRpeWeighted = blocks.reduce(
        (s, b) => s + (values[b.id] ?? 5) * (b.duration_minutes || 0),
        0,
      );
      const avgRpe = totalDuration > 0 ? Math.round(totalRpeWeighted / totalDuration) : 5;

      await supabase.from("awcr_tracking").insert({
        player_id: playerId,
        category_id: categoryId,
        session_date: new Date().toISOString().split("T")[0],
        rpe: avgRpe,
        duration_minutes: totalDuration || null,
        training_session_id: sessionId,
      });
    },
    onSuccess: () => {
      toast.success("RPE par bloc enregistré ✅");
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
          <Layers className="h-4 w-4 text-primary" /> RPE par bloc
        </Label>
        {totalLoad > 0 && <Badge variant="secondary">Charge : {totalLoad} UA</Badge>}
      </div>

      <div className="space-y-3">
        {blocks.map((b, idx) => {
          const done = submittedIds.has(b.id);
          const val = values[b.id] ?? 5;
          return (
            <div
              key={b.id}
              className={`rounded-lg border p-3 ${done ? "bg-status-optimal/5 border-status-optimal/40" : "bg-muted/20"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Bloc {idx + 1}</Badge>
                  <span className="text-sm font-medium">{b.theme || b.training_type}</span>
                  {b.duration_minutes && (
                    <span className="text-xs text-muted-foreground">· {b.duration_minutes} min</span>
                  )}
                </div>
                {done && <CheckCircle2 className="h-4 w-4 text-status-optimal" />}
              </div>
              {b.notes && (
                <p className="text-xs text-muted-foreground italic mb-2">{b.notes}</p>
              )}
              {!done && (
                <>
                  <Slider
                    value={[val]}
                    onValueChange={([v]) => setValues((prev) => ({ ...prev, [b.id]: v }))}
                    min={1}
                    max={10}
                    step={1}
                  />
                  <div className="flex justify-between mt-1">
                    <span className={`text-lg font-bold ${getRpeColor(val)}`}>{val}/10</span>
                    {b.duration_minutes && (
                      <span className="text-xs text-muted-foreground self-end">
                        Charge bloc : {val * (b.duration_minutes || 0)} UA
                      </span>
                    )}
                  </div>
                </>
              )}
              {done && (
                <p className="text-xs text-muted-foreground">
                  RPE enregistré : <strong>{existing.find((e) => e.block_id === b.id)?.rpe}/10</strong>
                </p>
              )}
            </div>
          );
        })}
      </div>

      {!allDone && (
        <Button onClick={() => submit.mutate()} disabled={submit.isPending} className="w-full">
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Valider mes RPE par bloc
        </Button>
      )}
    </div>
  );
}
