import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  BASKETBALL_PRECISION_EXERCISES,
  getBasketballExerciseByValue,
  BASKETBALL_PRECISION_LABELS,
} from "@/lib/constants/basketballPrecisionExercises";
import {
  BasketballHalfCourtSVG,
  type BasketCourtPoint,
} from "@/components/basketball/BasketballHalfCourtSVG";
import { PrecisionTrainingStats } from "@/components/training/PrecisionTrainingStats";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";
import { useSeasonFilteredPlayerIds } from "@/hooks/use-season-filtered-players";

interface Props {
  categoryId: string;
  /** Lock to a single athlete (used in athlete portal). */
  lockedPlayerId?: string;
  /** Optional training session to attach entries to. */
  trainingSessionId?: string;
  sessionDate?: string;
}

export function BasketballPrecisionTracker({
  categoryId,
  lockedPlayerId,
  trainingSessionId,
  sessionDate,
}: Props) {
  const qc = useQueryClient();
  const { isViewer } = useViewerModeContext();
  const [exerciseValue, setExerciseValue] = useState(
    BASKETBALL_PRECISION_EXERCISES[0].value as string,
  );
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(
    lockedPlayerId || "",
  );
  const [pendingClick, setPendingClick] = useState<{
    x: number;
    y: number;
    zone: string;
  } | null>(null);
  const [attempts, setAttempts] = useState("");
  const [successes, setSuccesses] = useState("");
  const today = sessionDate || format(new Date(), "yyyy-MM-dd");

  const exercise = getBasketballExerciseByValue(exerciseValue)!;

  const { allowedIds } = useSeasonFilteredPlayerIds(categoryId);
  const { data: playersAll = [] } = useQuery({
    queryKey: ["basket-precision-players", categoryId],
    queryFn: async () => {
      const { data } = await supabase
        .from("players")
        .select("id, name, first_name")
        .eq("category_id", categoryId)
        .order("name");
      return data || [];
    },
    enabled: !lockedPlayerId,
  });
  const players = useMemo(
    () => (allowedIds ? playersAll.filter((p: any) => allowedIds.has(p.id)) : playersAll),
    [playersAll, allowedIds],
  );

  // Today's entries for the selected exercise
  const { data: todayEntries = [] } = useQuery({
    queryKey: [
      "basket-precision-today",
      categoryId,
      selectedPlayerId,
      today,
      exercise.label,
    ],
    enabled: !!selectedPlayerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("precision_training")
        .select("*")
        .eq("category_id", categoryId)
        .eq("player_id", selectedPlayerId)
        .eq("session_date", today)
        .eq("exercise_label", exercise.label)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const points: BasketCourtPoint[] = useMemo(
    () =>
      todayEntries
        .filter((e: any) => e.zone_x !== null && e.zone_y !== null)
        .map((e: any) => ({
          id: e.id,
          x: Number(e.zone_x),
          y: Number(e.zone_y),
          attempts: e.attempts,
          successes: e.successes,
        })),
    [todayEntries],
  );

  const insertMut = useMutation({
    mutationFn: async () => {
      if (!selectedPlayerId) throw new Error("Sélectionne un athlète");
      if (!pendingClick) throw new Error("Clique d'abord sur le terrain");
      const a = parseInt(attempts);
      const s = parseInt(successes);
      if (isNaN(a) || a <= 0) throw new Error("Tentatives invalides");
      if (isNaN(s) || s < 0 || s > a) throw new Error("Réussites invalides");
      if (lockedPlayerId) {
        // Athlete portal: use edge function (bypass RLS)
        const { data, error } = await supabase.functions.invoke(
          "athlete-precision-training",
          {
            body: {
              category_id: categoryId,
              player_id: selectedPlayerId,
              session_date: today,
              exercise_label: exercise.label,
              zone_x: pendingClick.x,
              zone_y: pendingClick.y,
              attempts: a,
              successes: s,
            },
          },
        );
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Enregistrement échoué");
        return;
      }
      const { error } = await supabase.from("precision_training").insert({
        category_id: categoryId,
        player_id: selectedPlayerId,
        session_date: today,
        exercise_label: exercise.label,
        zone_x: pendingClick.x,
        zone_y: pendingClick.y,
        attempts: a,
        successes: s,
        training_session_id: trainingSessionId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exercice enregistré");
      setPendingClick(null);
      setAttempts("");
      setSuccesses("");
      qc.invalidateQueries({ queryKey: ["basket-precision-today"] });
      qc.invalidateQueries({ queryKey: ["precision-training-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("precision_training")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Supprimé");
      qc.invalidateQueries({ queryKey: ["basket-precision-today"] });
      qc.invalidateQueries({ queryKey: ["precision-training-stats"] });
    },
  });

  const livePct = (() => {
    const a = parseInt(attempts);
    const s = parseInt(successes);
    if (a > 0 && s >= 0 && s <= a) return ((s / a) * 100).toFixed(1);
    return null;
  })();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            Cartographie - Exercices de précision basket
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!lockedPlayerId && (
              <div>
                <Label className="text-xs">Athlète</Label>
                <Select
                  value={selectedPlayerId}
                  onValueChange={setSelectedPlayerId}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sélectionner un athlète" />
                  </SelectTrigger>
                  <SelectContent>
                    {players.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {[p.first_name, p.name].filter(Boolean).join(" ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Thématique</Label>
              <Select value={exerciseValue} onValueChange={setExerciseValue}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BASKETBALL_PRECISION_EXERCISES.map((ex) => (
                    <SelectItem key={ex.value} value={ex.value}>
                      {ex.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!selectedPlayerId ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sélectionne un athlète pour commencer.
            </p>
          ) : (
            <>
              <BasketballHalfCourtSVG
                exercise={exercise}
                points={points}
                onClickZone={(x, y, zone) =>
                  !isViewer && setPendingClick({ x, y, zone })
                }
                readOnly={isViewer}
              />
              <p className="text-xs text-muted-foreground text-center">
                Clique dans la zone surlignée pour ajouter une saisie.
              </p>

              {todayEntries.length > 0 && (
                <Card className="bg-muted/30">
                  <CardContent className="pt-4 space-y-2">
                    <p className="text-sm font-medium">
                      Saisies du{" "}
                      {format(new Date(today), "d MMM yyyy", { locale: fr })}
                    </p>
                    {todayEntries.map((e: any) => {
                      const rate =
                        e.attempts > 0
                          ? ((e.successes / e.attempts) * 100).toFixed(1)
                          : "0";
                      return (
                        <div
                          key={e.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg border bg-background"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant="secondary" className="text-xs">
                              {e.exercise_label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {e.successes}/{e.attempts}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-primary">
                              {rate}%
                            </span>
                            {!isViewer && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteMut.mutate(e.id)}
                                className="h-7 w-7"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Cumulative stats with date range */}
      <PrecisionTrainingStats
        categoryId={categoryId}
        lockedPlayerId={lockedPlayerId}
      />

      {/* Click → entry dialog */}
      <Dialog
        open={!!pendingClick}
        onOpenChange={(o) => !o && setPendingClick(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{pendingClick?.zone}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Lancers</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={attempts}
                  onChange={(e) => setAttempts(e.target.value)}
                />
              </div>
              <div>
                <Label>Réussis</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={successes}
                  onChange={(e) => setSuccesses(e.target.value)}
                />
              </div>
            </div>
            {livePct && (
              <div className="text-center p-3 rounded-lg bg-primary/10">
                <p className="text-2xl font-bold text-primary">{livePct}%</p>
                <p className="text-xs text-muted-foreground">
                  Taux de réussite
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingClick(null)}
            >
              Annuler
            </Button>
            <Button
              onClick={() => insertMut.mutate()}
              disabled={insertMut.isPending}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Re-export label list for filters
export { BASKETBALL_PRECISION_LABELS };
