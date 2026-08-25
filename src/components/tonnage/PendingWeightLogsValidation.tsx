import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X, Clock, Dumbbell, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSeasonGuard } from "@/hooks/use-season-guard";
import { useSeasonRosterFilter } from "@/contexts/SeasonRosterFilterContext";

interface Props {
  categoryId: string;
}

interface EditState {
  id: string;
  player_id: string;
  session_date: string | null;
  exercise_name: string;
  weight: number;
  sets: number;
  reps: number;
}

export function PendingWeightLogsValidation({ categoryId }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<EditState | null>(null);
  const guard = useSeasonGuard(categoryId);
  const { activeSeasonStart, activeSeasonEnd } = useSeasonRosterFilter();
  const scopeKey = guard.isFiltering ? `${activeSeasonStart}_${activeSeasonEnd}` : "all";

  const { data: pending } = useQuery({
    queryKey: ["pending-weight-logs", categoryId, scopeKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("athlete_exercise_logs")
        .select("id, exercise_name, actual_weight_kg, actual_sets, actual_reps, player_id, training_session_id, players(name, first_name), training_sessions(session_date)")
        .eq("category_id", categoryId)
        .eq("validation_status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data || [];
      if (!guard.isFiltering) return rows;
      return rows.filter((r: any) =>
        guard.isPlayerAllowed(r.player_id) &&
        guard.isDateAllowed(r.training_sessions?.session_date)
      );
    },
    refetchInterval: 30000,
  });

  const decide = useMutation({
    mutationFn: async ({ id, status, row }: { id: string; status: "validated" | "rejected"; row: any }) => {
      if (status === "validated") {
        if (!guard.assertPlayer(row.player_id)) throw new Error("blocked");
        if (!guard.assertDate(row.training_sessions?.session_date)) throw new Error("blocked");
      }
      const { error } = await supabase
        .from("athlete_exercise_logs")
        .update({ validation_status: status, validated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      toast.success(v.status === "validated" ? "Validé" : "Rejeté");
      qc.invalidateQueries({ queryKey: ["pending-weight-logs", categoryId] });
      qc.invalidateQueries({ queryKey: ["pending-weight-logs-count", categoryId] });
      qc.invalidateQueries({ queryKey: ["athlete-exercise-logs-dashboard"] });
    },
    onError: (e: any) => {
      if (e?.message !== "blocked") toast.error(e?.message || "Erreur");
    },
  });

  const saveEdit = useMutation({
    mutationFn: async (s: EditState) => {
      if (!guard.assertPlayer(s.player_id)) throw new Error("blocked");
      if (!guard.assertDate(s.session_date)) throw new Error("blocked");
      const { error } = await supabase
        .from("athlete_exercise_logs")
        .update({
          actual_weight_kg: s.weight,
          actual_sets: s.sets,
          actual_reps: s.reps,
          validation_status: "validated",
          validated_at: new Date().toISOString(),
        })
        .eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Charge modifiée et validée");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["pending-weight-logs", categoryId] });
      qc.invalidateQueries({ queryKey: ["pending-weight-logs-count", categoryId] });
      qc.invalidateQueries({ queryKey: ["athlete-exercise-logs-dashboard"] });
    },
    onError: (e: any) => {
      if (e?.message !== "blocked") toast.error(e?.message || "Erreur");
    },
  });

  if (!pending || pending.length === 0) return null;

  return (
    <>
      <Card className="border-warning/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-warning" />
            Charges à valider
            <Badge variant="outline" className="ml-2">{pending.length}</Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Charges saisies par les athlètes en attente de ta validation pour intégrer le tonnage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {pending.map((log: any) => {
            const player = log.players;
            const playerName = player ? `${player.first_name || ""} ${player.name}`.trim() : "—";
            const date = log.training_sessions?.session_date;
            return (
              <div key={log.id} className="flex items-center gap-1 p-2 rounded-md border bg-card text-sm">
                <Dumbbell className="h-3.5 w-3.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-xs">{playerName}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {log.exercise_name} • {log.actual_weight_kg}kg × {log.actual_sets}×{log.actual_reps}
                    {date && ` • ${format(new Date(date), "d MMM", { locale: getDateLocale() })}`}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  title="Modifier"
                  onClick={() => setEditing({
                    id: log.id,
                    player_id: log.player_id,
                    session_date: log.training_sessions?.session_date ?? null,
                    exercise_name: log.exercise_name,
                    weight: Number(log.actual_weight_kg) || 0,
                    sets: Number(log.actual_sets) || 0,
                    reps: Number(log.actual_reps) || 0,
                  })}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-success hover:text-success"
                  title="Valider"
                  onClick={() => decide.mutate({ id: log.id, status: "validated", row: log })}
                  disabled={decide.isPending}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  title="Rejeter"
                  onClick={() => decide.mutate({ id: log.id, status: "rejected", row: log })}
                  disabled={decide.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Modifier la charge</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Exercice</Label>
                <p className="text-sm font-medium">{editing.exercise_name}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Charge (kg)</Label>
                  <Input
                    type="number"
                    value={editing.weight}
                    onChange={(e) => setEditing({ ...editing, weight: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Séries</Label>
                  <Input
                    type="number"
                    value={editing.sets}
                    onChange={(e) => setEditing({ ...editing, sets: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Reps</Label>
                  <Input
                    type="number"
                    value={editing.reps}
                    onChange={(e) => setEditing({ ...editing, reps: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            <Button
              onClick={() => editing && saveEdit.mutate(editing)}
              disabled={saveEdit.isPending}
            >
              Enregistrer & valider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
