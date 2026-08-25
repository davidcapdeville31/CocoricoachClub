import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  BASKETBALL_PRECISION_EXERCISES,
  getBasketballExerciseByValue,
} from "@/lib/constants/basketballPrecisionExercises";
import {
  BasketballHalfCourtSVG,
  type BasketCourtPoint,
} from "@/components/basketball/BasketballHalfCourtSVG";

interface Props {
  open: boolean;
  onClose: () => void;
  playerId: string;
  categoryId: string;
  defaultDate?: string;
}

export function BasketballTrainingEntryDialog({
  open,
  onClose,
  playerId,
  categoryId,
  defaultDate,
}: Props) {
  const qc = useQueryClient();
  const [sessionDate, setSessionDate] = useState(
    defaultDate || format(new Date(), "yyyy-MM-dd"),
  );
  const [exerciseValue, setExerciseValue] = useState(
    BASKETBALL_PRECISION_EXERCISES[0].value as string,
  );
  const [pending, setPending] = useState<{ x: number; y: number; zone: string } | null>(null);
  const [pendingResult, setPendingResult] = useState<"success" | "miss" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Sync date when dialog reopens with a different default (e.g. another day clicked)
  useEffect(() => {
    if (open && defaultDate) setSessionDate(defaultDate);
  }, [open, defaultDate]);

  const exercise = getBasketballExerciseByValue(exerciseValue)!;

  const { data: entries = [] } = useQuery({
    queryKey: [
      "basket-athlete-precision",
      categoryId,
      playerId,
      sessionDate,
    ],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("precision_training")
        .select("*")
        .eq("category_id", categoryId)
        .eq("player_id", playerId)
        .eq("session_date", sessionDate)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const points: BasketCourtPoint[] = useMemo(
    () =>
      entries
        .filter(
          (e: any) =>
            e.exercise_label === exercise.label &&
            e.zone_x !== null &&
            e.zone_y !== null,
        )
        .map((e: any) => ({
          id: e.id,
          x: Number(e.zone_x),
          y: Number(e.zone_y),
          attempts: e.attempts,
          successes: e.successes,
        })),
    [entries, exercise.label],
  );

  const handleSave = async () => {
    if (!pending) return toast.error("Clique d'abord sur le terrain");
    if (!pendingResult) return toast.error("Indique si le tir est Réussi ou Manqué");

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke(
      "athlete-precision-training",
      {
        body: {
          category_id: categoryId,
          player_id: playerId,
          session_date: sessionDate,
          exercise_label: exercise.label,
          zone_x: pending.x,
          zone_y: pending.y,
          attempts: 1,
          successes: pendingResult === "success" ? 1 : 0,
        },
      },
    );
    setSubmitting(false);
    if (error || !(data as any)?.success) {
      toast.error((data as any)?.error || error?.message || "Erreur");
      return;
    }
    toast.success("Tir enregistré");
    setPending(null);
    setPendingResult(null);
    qc.invalidateQueries({ queryKey: ["basket-athlete-precision"] });
    qc.invalidateQueries({ queryKey: ["precision-training-stats"] });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl h-[92vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Entraînement basket - Précision
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="mt-1"
              />
            </div>
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

          <BasketballHalfCourtSVG
            exercise={exercise}
            points={points}
            pending={pending ? { x: pending.x, y: pending.y } : null}
            pendingResult={pendingResult}
            onClickZone={(x, y, zone) => {
              setPending({ x, y, zone });
              setPendingResult(null);
            }}
          />
          <p className="text-xs text-muted-foreground text-center">
            {pending
              ? "Sélectionne Réussi ou Manqué puis Enregistrer."
              : "Clique dans la zone surlignée pour placer ton tir."}
          </p>

          {pending && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm font-medium">{pending.zone}</p>

                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Résultat
                  </Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPendingResult("success")}
                      className={
                        pendingResult === "success"
                          ? "bg-green-500 hover:bg-green-500/90 text-white border-green-600"
                          : ""
                      }
                    >
                      ✓ Réussi
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPendingResult("miss")}
                      className={
                        pendingResult === "miss"
                          ? "bg-red-500 hover:bg-red-500/90 text-white border-red-600"
                          : ""
                      }
                    >
                      ✗ Manqué
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setPending(null);
                      setPendingResult(null);
                    }}
                  >
                    Annuler
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSave}
                    disabled={submitting || !pendingResult}
                  >
                    {submitting ? "..." : "Enregistrer"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {entries.length > 0 && (
            <Card>
              <CardContent className="pt-4 space-y-2">
                <p className="text-sm font-medium">Saisies du jour</p>
                {entries.map((e: any) => {
                  const rate =
                    e.attempts > 0
                      ? ((e.successes / e.attempts) * 100).toFixed(1)
                      : "0";
                  return (
                    <div
                      key={e.id}
                      className="flex items-center justify-between p-2 rounded-lg border"
                    >
                      <div>
                        <Badge variant="secondary" className="text-xs">
                          {e.exercise_label}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {e.successes}/{e.attempts}
                        </p>
                      </div>
                      <span className="font-bold text-primary">{rate}%</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
