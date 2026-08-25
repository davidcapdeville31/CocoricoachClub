import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dumbbell } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useSeasonGuard } from "@/hooks/use-season-guard";

interface QuickRpeEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  sessionId: string;
  sessionDate: string;
}

type WeightEntry = { weight: string; sets: string; reps: string };

export function QuickRpeEntryDialog({
  open,
  onOpenChange,
  categoryId,
  sessionId,
  sessionDate,
}: QuickRpeEntryDialogProps) {
  const queryClient = useQueryClient();
  const guard = useSeasonGuard(categoryId);
  const [rpeValues, setRpeValues] = useState<Record<string, { rpe: string; duration: string }>>({});
  const [weightLogs, setWeightLogs] = useState<Record<string, Record<string, WeightEntry>>>({});

  const { data: players } = useQuery({
    queryKey: ["players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: existingRpe } = useQuery({
    queryKey: ["awcr_tracking", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("awcr_tracking")
        .select("*")
        .eq("training_session_id", sessionId);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: gymExercises } = useQuery({
    queryKey: ["session-gym-exercises-quick", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gym_session_exercises")
        .select("exercise_name, sets, reps, weight_kg, order_index")
        .eq("training_session_id", sessionId)
        .order("order_index");
      if (error) throw error;
      const seen = new Set<string>();
      return (data || []).filter((e) => {
        if (!e.exercise_name || seen.has(e.exercise_name)) return false;
        seen.add(e.exercise_name);
        return true;
      });
    },
    enabled: open,
  });

  const { data: existingLogs } = useQuery({
    queryKey: ["session-weight-logs-quick", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("athlete_exercise_logs")
        .select("player_id, exercise_name, actual_weight_kg, actual_sets, actual_reps, validation_status")
        .eq("training_session_id", sessionId);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Pre-fill weight entries when exercises load
  useEffect(() => {
    if (!gymExercises || !players) return;
    setWeightLogs((prev) => {
      const next = { ...prev };
      players.forEach((p) => {
        if (!next[p.id]) next[p.id] = {};
        gymExercises.forEach((ex) => {
          if (next[p.id][ex.exercise_name]) return;
          next[p.id][ex.exercise_name] = {
            weight: ex.weight_kg ? String(ex.weight_kg) : "",
            sets: ex.sets ? String(ex.sets) : "3",
            reps: ex.reps ? String(ex.reps) : "10",
          };
        });
      });
      return next;
    });
  }, [gymExercises, players]);

  const save = useMutation({
    mutationFn: async () => {
      if (!guard.assertDate(sessionDate)) throw new Error("guard:date");
      // RPE
      const rpeEntries = players
        ?.filter((p) => rpeValues[p.id]?.rpe && rpeValues[p.id]?.duration)
        .map((p) => ({
          player_id: p.id,
          category_id: categoryId,
          training_session_id: sessionId,
          session_date: sessionDate,
          rpe: parseInt(rpeValues[p.id].rpe),
          duration_minutes: parseInt(rpeValues[p.id].duration),
        }));
      if (rpeEntries && rpeEntries.length > 0 && !guard.assertPlayers(rpeEntries.map((e) => e.player_id))) throw new Error("guard:players");

      if (rpeEntries && rpeEntries.length > 0) {
        const { error } = await supabase.from("awcr_tracking").insert(rpeEntries);
        if (error) throw error;
      }

      // Weight logs (staff-validated by default)
      const weightRecords: any[] = [];
      const weightPlayerIds = new Set<string>();
      Object.entries(weightLogs).forEach(([playerId, exMap]) => {
        Object.entries(exMap).forEach(([exerciseName, vals]) => {
          const w = parseFloat(vals.weight);
          const s = parseInt(vals.sets);
          const r = parseInt(vals.reps);
          if (!w || !s || !r) return;
          weightRecords.push({
            training_session_id: sessionId,
            player_id: playerId,
            category_id: categoryId,
            exercise_name: exerciseName,
            actual_weight_kg: w,
            actual_sets: s,
            actual_reps: r,
            submitted_via: "staff",
            validation_status: "validated",
          });
          weightPlayerIds.add(playerId);
        });
      });
      if (weightPlayerIds.size > 0 && !guard.assertPlayers(Array.from(weightPlayerIds))) throw new Error("guard:players");
      if (weightRecords.length > 0) {
        const { error } = await supabase
          .from("athlete_exercise_logs")
          .upsert(weightRecords, { onConflict: "training_session_id,player_id,exercise_name" });
        if (error) throw error;
      }

      if ((!rpeEntries || rpeEntries.length === 0) && weightRecords.length === 0) {
        throw new Error("Aucune donnée à enregistrer");
      }
      return { rpe: rpeEntries?.length || 0, weights: weightRecords.length };
    },
    onSuccess: ({ rpe, weights }) => {
      queryClient.invalidateQueries({ queryKey: ["awcr_tracking"] });
      queryClient.invalidateQueries({ queryKey: ["athlete-exercise-logs"] });
      queryClient.invalidateQueries({ queryKey: ["athlete-exercise-logs-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["session-weight-logs-quick", sessionId] });
      toast.success(`${rpe} RPE et ${weights} charge(s) enregistrés`);
      setRpeValues({});
      onOpenChange(false);
    },
    onError: (error: any) => {
      if (typeof error?.message === "string" && error.message.startsWith("guard:")) return;
      toast.error(error?.message || "Erreur lors de l'enregistrement");
    },
  });

  const handleRpeChange = (playerId: string, field: "rpe" | "duration", value: string) => {
    setRpeValues((prev) => ({ ...prev, [playerId]: { ...prev[playerId], [field]: value } }));
  };

  const handleWeightChange = (playerId: string, ex: string, field: keyof WeightEntry, value: string) => {
    setWeightLogs((prev) => ({
      ...prev,
      [playerId]: { ...(prev[playerId] || {}), [ex]: { ...(prev[playerId]?.[ex] || { weight: "", sets: "", reps: "" }), [field]: value } },
    }));
  };

  const hasGym = (gymExercises?.length || 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Saisie séance - {format(new Date(sessionDate), "PPP", { locale: getDateLocale() })}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="rpe">
          <TabsList>
            <TabsTrigger value="rpe">RPE</TabsTrigger>
            {hasGym && (
              <TabsTrigger value="charges" className="gap-1">
                <Dumbbell className="h-3.5 w-3.5" /> Charges
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="rpe" className="space-y-3">
            <p className="text-sm text-muted-foreground">RPE 0-10 — Durée en minutes.</p>
            {players?.map((player) => {
              const existing = existingRpe?.find((r) => r.player_id === player.id);
              return (
                <div key={player.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Label className="w-48 font-medium">{player.name}</Label>
                  {existing ? (
                    <span className="text-sm text-muted-foreground">
                      ✓ RPE {existing.rpe} - {existing.duration_minutes}min
                    </span>
                  ) : (
                    <>
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        placeholder="RPE"
                        className="w-20"
                        value={rpeValues[player.id]?.rpe || ""}
                        onChange={(e) => handleRpeChange(player.id, "rpe", e.target.value)}
                      />
                      <Input
                        type="number"
                        min="0"
                        placeholder="min"
                        className="w-24"
                        value={rpeValues[player.id]?.duration || ""}
                        onChange={(e) => handleRpeChange(player.id, "duration", e.target.value)}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </TabsContent>

          {hasGym && (
            <TabsContent value="charges" className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Saisis les charges réelles soulevées par chaque athlète. Alimente le tonnage.
              </p>
              {gymExercises!.map((ex) => (
                <div key={ex.exercise_name} className="border rounded-xl p-3 space-y-2 bg-card">
                  <div className="flex items-center gap-2">
                    <Dumbbell className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">{ex.exercise_name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      Prescrit : {ex.sets || "–"}×{ex.reps || "–"}
                      {ex.weight_kg ? ` @${ex.weight_kg}kg` : ""}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {players?.map((p) => {
                      const ex0 = existingLogs?.find(
                        (l) => l.player_id === p.id && l.exercise_name === ex.exercise_name,
                      );
                      const e = weightLogs[p.id]?.[ex.exercise_name];
                      return (
                        <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg border">
                          <span className="text-xs flex-1 truncate">{p.name}</span>
                          {ex0 ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {ex0.validation_status === "pending" ? "⏳" : "✓"} {ex0.actual_weight_kg}kg{" "}
                              {ex0.actual_sets}×{ex0.actual_reps}
                            </Badge>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                step="0.5"
                                placeholder="kg"
                                className="h-8 w-16 text-xs"
                                value={e?.weight || ""}
                                onChange={(ev) => handleWeightChange(p.id, ex.exercise_name, "weight", ev.target.value)}
                              />
                              <Input
                                type="number"
                                placeholder="S"
                                className="h-8 w-12 text-xs"
                                value={e?.sets || ""}
                                onChange={(ev) => handleWeightChange(p.id, ex.exercise_name, "sets", ev.target.value)}
                              />
                              <span className="text-[10px] text-muted-foreground">×</span>
                              <Input
                                type="number"
                                placeholder="R"
                                className="h-8 w-12 text-xs"
                                value={e?.reps || ""}
                                onChange={(ev) => handleWeightChange(p.id, ex.exercise_name, "reps", ev.target.value)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </TabsContent>
          )}
        </Tabs>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
