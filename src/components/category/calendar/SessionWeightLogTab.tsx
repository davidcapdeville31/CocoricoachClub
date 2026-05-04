import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMethodColors } from "@/components/program-builder-v2/shared/MethodGroupWrapper";
import { getTrainingStyleConfig } from "@/lib/program-builder-v2/trainingStyles";

interface SessionWeightLogTabProps {
  sessionId: string;
  categoryId: string;
  playersToShow: Array<{ id: string; name: string; first_name: string | null; avatar_url: string | null }>;
  weightLogs: Record<string, Record<string, { weight: string; sets: string; reps: string }>>;
  onWeightLogChange: (playerId: string, exerciseName: string, field: "weight" | "sets" | "reps", value: string) => void;
}

interface UniqueExercise {
  name: string;
  category: string | null;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  method: string | null;
  linked_group_id: string | null;
  group_order: number | null;
  order_index: number | null;
}

export function SessionWeightLogTab({
  sessionId,
  categoryId,
  playersToShow,
  weightLogs,
  onWeightLogChange,
}: SessionWeightLogTabProps) {
  const { data: exercises } = useQuery({
    queryKey: ["session-exercises-for-weight", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gym_session_exercises")
        .select("*")
        .eq("training_session_id", sessionId)
        .order("order_index");
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });

  const { data: existingLogs } = useQuery({
    queryKey: ["athlete-exercise-logs", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("athlete_exercise_logs")
        .select("*")
        .eq("training_session_id", sessionId);
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });

  // Dedupe by exercise_name, keep first occurrence (preserves order_index)
  const uniqueExercises: UniqueExercise[] = exercises
    ? Array.from(
        new Map(
          exercises.map((e: any) => [
            e.exercise_name,
            {
              name: e.exercise_name,
              category: e.exercise_category,
              sets: e.sets,
              reps: e.reps,
              weight_kg: e.weight_kg,
              method: e.method ?? null,
              linked_group_id: e.linked_group_id ?? null,
              group_order: e.group_order ?? null,
              order_index: e.order_index ?? 0,
            } as UniqueExercise,
          ])
        ).values()
      )
    : [];

  const existingLogMap = new Map<string, any>();
  existingLogs?.forEach((log: any) => {
    existingLogMap.set(`${log.player_id}_${log.exercise_name}`, log);
  });

  // Group exercises: linked methods (biset/superset/...) share linked_group_id → render together
  type Group =
    | { kind: "single"; exercise: UniqueExercise }
    | { kind: "linked"; linkedGroupId: string; method: string; exercises: UniqueExercise[] };

  const groups: Group[] = [];
  const seenLinked = new Set<string>();
  for (const ex of uniqueExercises) {
    if (ex.linked_group_id) {
      if (seenLinked.has(ex.linked_group_id)) continue;
      seenLinked.add(ex.linked_group_id);
      const members = uniqueExercises
        .filter((e) => e.linked_group_id === ex.linked_group_id)
        .sort((a, b) => (a.group_order ?? 0) - (b.group_order ?? 0));
      groups.push({
        kind: "linked",
        linkedGroupId: ex.linked_group_id,
        method: ex.method || "superset",
        exercises: members,
      });
    } else {
      groups.push({ kind: "single", exercise: ex });
    }
  }

  if (uniqueExercises.length === 0) {
    return (
      <div className="border-2 border-dashed border-primary/30 rounded-xl p-6 bg-primary/5 text-center">
        <Dumbbell className="h-8 w-8 text-primary mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Aucun exercice de musculation dans cette séance.
        </p>
      </div>
    );
  }

  const renderExerciseCard = (exercise: UniqueExercise, methodOverride?: string) => {
    const method = methodOverride || exercise.method || undefined;
    const colors = method ? getMethodColors(method) : null;
    const styleConfig = method ? getTrainingStyleConfig(method) : null;

    return (
      <div
        key={exercise.name}
        className={cn(
          "border-l-4 rounded-xl p-3 space-y-2 bg-card",
          colors ? colors.border : "border-l-border border",
          colors?.bg
        )}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Dumbbell className={cn("h-4 w-4", colors ? colors.text : "text-primary")} />
          <span className="font-medium text-sm">{exercise.name}</span>
          {styleConfig && (
            <Badge variant="outline" className={cn("text-[10px] py-0", colors?.text)}>
              {styleConfig.label}
            </Badge>
          )}
          {exercise.category && (
            <Badge variant="outline" className="text-xs">
              {exercise.category}
            </Badge>
          )}
          {exercise.sets && exercise.reps && (
            <span className="text-xs text-muted-foreground ml-auto">
              Prescrit: {exercise.sets}×{exercise.reps}
              {exercise.weight_kg ? ` @${exercise.weight_kg}kg` : ""}
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          {playersToShow.map((player) => {
            const existing = existingLogMap.get(`${player.id}_${exercise.name}`);
            const logValues = weightLogs[player.id]?.[exercise.name];

            return (
              <div
                key={player.id}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border",
                  existing
                    ? "border-muted bg-muted/60 opacity-70"
                    : logValues?.weight
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-background"
                )}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={player.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {(player.first_name || player.name).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs truncate flex-1 min-w-0">
                  {player.first_name ? `${player.first_name} ${player.name}` : player.name}
                </span>

                {existing ? (
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    ✓ {existing.actual_weight_kg}kg {existing.actual_sets}×{existing.actual_reps}
                  </span>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    <Input
                      type="number"
                      step="0.5"
                      placeholder="kg"
                      className="h-8 w-20 text-sm px-2"
                      value={logValues?.weight || ""}
                      onChange={(e) =>
                        onWeightLogChange(player.id, exercise.name, "weight", e.target.value)
                      }
                    />
                    <Input
                      type="number"
                      placeholder="S"
                      className="h-8 w-14 text-sm px-2"
                      value={logValues?.sets ?? exercise.sets?.toString() ?? ""}
                      onChange={(e) =>
                        onWeightLogChange(player.id, exercise.name, "sets", e.target.value)
                      }
                    />
                    <span className="text-xs text-muted-foreground">×</span>
                    <Input
                      type="number"
                      placeholder="R"
                      className="h-8 w-14 text-sm px-2"
                      value={logValues?.reps ?? exercise.reps?.toString() ?? ""}
                      onChange={(e) =>
                        onWeightLogChange(player.id, exercise.name, "reps", e.target.value)
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Saisissez les charges réelles utilisées par chaque athlète.
      </p>

      <div className="flex-1 min-h-0 overflow-y-auto pr-2" style={{ maxHeight: "calc(90vh - 280px)" }}>
        <div className="space-y-4">
          {groups.map((g, idx) => {
            if (g.kind === "single") return renderExerciseCard(g.exercise);
            const colors = getMethodColors(g.method);
            const styleConfig = getTrainingStyleConfig(g.method);
            return (
              <div
                key={g.linkedGroupId}
                className={cn(
                  "rounded-xl border-2 p-3 space-y-3",
                  colors.border,
                  colors.bg
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn("rounded p-1", colors.iconBg)}>
                    <Link2 className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className={cn("font-semibold text-sm", colors.text)}>
                    {styleConfig?.label || g.method}
                  </span>
                  <Badge variant="outline" className={cn("text-[10px]", colors.text)}>
                    {g.exercises.length} exercices liés
                  </Badge>
                </div>
                <div className="space-y-3">
                  {g.exercises.map((ex) => renderExerciseCard(ex, g.method))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
