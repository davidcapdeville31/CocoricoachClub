import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, Dumbbell } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  categoryId: string;
}

export function PendingWeightLogsValidation({ categoryId }: Props) {
  const qc = useQueryClient();

  const { data: pending } = useQuery({
    queryKey: ["pending-weight-logs", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("athlete_exercise_logs")
        .select("id, exercise_name, actual_weight_kg, actual_sets, actual_reps, player_id, training_session_id, players(name, first_name), training_sessions(session_date)")
        .eq("category_id", categoryId)
        .eq("validation_status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "validated" | "rejected" }) => {
      const { error } = await supabase
        .from("athlete_exercise_logs")
        .update({ validation_status: status, validated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      toast.success(v.status === "validated" ? "Validé" : "Rejeté");
      qc.invalidateQueries({ queryKey: ["pending-weight-logs", categoryId] });
      qc.invalidateQueries({ queryKey: ["athlete-exercise-logs-dashboard"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  if (!pending || pending.length === 0) return null;

  return (
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
            <div key={log.id} className="flex items-center gap-2 p-2 rounded-md border bg-card text-sm">
              <Dumbbell className="h-3.5 w-3.5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate text-xs">{playerName}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {log.exercise_name} • {log.actual_weight_kg}kg × {log.actual_sets}×{log.actual_reps}
                  {date && ` • ${format(new Date(date), "d MMM", { locale: fr })}`}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-success hover:text-success"
                onClick={() => decide.mutate({ id: log.id, status: "validated" })}
                disabled={decide.isPending}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={() => decide.mutate({ id: log.id, status: "rejected" })}
                disabled={decide.isPending}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
