import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, Lock, Loader2, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { athletePortalHeaders, buildAthletePortalFunctionUrl } from "@/lib/athletePortalClient";

interface Props {
  token?: string;
  sessionId: string;
  onSubmitted?: () => void;
}

interface Exercise {
  id: string;
  exercise_name: string;
  exercise_category: string | null;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  method: string | null;
}

interface Existing {
  exercise_name: string;
  actual_weight_kg: number;
  actual_sets: number | null;
  actual_reps: number | null;
  validation_status: "pending" | "validated" | "rejected";
}

type Entry = { weight: string; sets: string; reps: string };

export function AthletePortalWeightLog({ token, sessionId, onSubmitted }: Props) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [existing, setExisting] = useState<Existing[]>([]);
  const [entries, setEntries] = useState<Record<string, Entry>>({});

  useEffect(() => {
    setLoading(true);
    const baseUrl = buildAthletePortalFunctionUrl("session-exercises", token);
    fetch(`${baseUrl}&session_id=${encodeURIComponent(sessionId)}`, {
      headers: athletePortalHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          // Deduplicate by name
          const seen = new Set<string>();
          const uniq: Exercise[] = [];
          for (const e of data.exercises || []) {
            if (!e.exercise_name || seen.has(e.exercise_name)) continue;
            seen.add(e.exercise_name);
            uniq.push(e);
          }
          setExercises(uniq);
          setExisting(data.existing || []);
          // Pre-fill entries with prescribed values
          const init: Record<string, Entry> = {};
          uniq.forEach((ex) => {
            if ((data.existing || []).some((x: Existing) => x.exercise_name === ex.exercise_name)) return;
            init[ex.exercise_name] = {
              weight: ex.weight_kg ? String(ex.weight_kg) : "",
              sets: ex.sets ? String(ex.sets) : "3",
              reps: ex.reps ? String(ex.reps) : "10",
            };
          });
          setEntries(init);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionId, token]);

  const update = (name: string, field: keyof Entry, value: string) =>
    setEntries((prev) => ({ ...prev, [name]: { ...prev[name], [field]: value } }));

  const handleSubmit = async () => {
    const logs = Object.entries(entries)
      .map(([exercise_name, e]) => ({
        exercise_name,
        actual_weight_kg: parseFloat(e.weight),
        actual_sets: parseInt(e.sets),
        actual_reps: parseInt(e.reps),
      }))
      .filter((l) => l.actual_weight_kg > 0 && l.actual_sets > 0 && l.actual_reps > 0);

    if (logs.length === 0) {
      toast.error("Renseigne au moins une charge complète (kg × séries × reps)");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(buildAthletePortalFunctionUrl("submit-weight-logs", token), {
        method: "POST",
        headers: athletePortalHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ session_id: sessionId, logs }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Charges envoyées au staff pour validation");
        onSubmitted?.();
      } else {
        toast.error(data.error || "Erreur");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (exercises.length === 0) return null;

  const existingByName = new Map(existing.map((e) => [e.exercise_name, e]));

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Dumbbell className="h-4 w-4 text-primary" />
          Mes charges soulevées
        </CardTitle>
        <CardDescription className="text-xs">
          Renseigne ce que tu as réellement soulevé. Le staff validera tes saisies pour alimenter ton tonnage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {exercises.map((ex) => {
          const ex0 = existingByName.get(ex.exercise_name);
          if (ex0) {
            return (
              <div
                key={ex.exercise_name}
                className="flex items-center gap-2 rounded-md border border-muted bg-muted/40 p-2"
              >
                {ex0.validation_status === "pending" ? (
                  <Clock className="h-3.5 w-3.5 text-warning shrink-0" />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="text-xs font-medium flex-1 truncate">{ex.exercise_name}</span>
                <Badge variant={ex0.validation_status === "pending" ? "outline" : "secondary"} className="text-[10px]">
                  {ex0.validation_status === "pending" ? "En attente" : "✓"} {ex0.actual_weight_kg}kg{" "}
                  {ex0.actual_sets ?? "–"}×{ex0.actual_reps ?? "–"}
                </Badge>
              </div>
            );
          }
          const e = entries[ex.exercise_name];
          if (!e) return null;
          return (
            <div key={ex.exercise_name} className="rounded-md border bg-card p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium truncate">{ex.exercise_name}</span>
                {ex.sets && ex.reps && (
                  <span className="text-[10px] text-muted-foreground">
                    Prescrit : {ex.sets}×{ex.reps}
                    {ex.weight_kg ? ` @${ex.weight_kg}kg` : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Input
                  type="number"
                  step="0.5"
                  placeholder="kg"
                  className="h-8 w-16 text-xs"
                  value={e.weight}
                  onChange={(ev) => update(ex.exercise_name, "weight", ev.target.value)}
                />
                <span className="text-xs text-muted-foreground">kg</span>
                <Input
                  type="number"
                  placeholder="Séries"
                  className="h-8 w-16 text-xs ml-2"
                  value={e.sets}
                  onChange={(ev) => update(ex.exercise_name, "sets", ev.target.value)}
                />
                <span className="text-xs text-muted-foreground">×</span>
                <Input
                  type="number"
                  placeholder="Reps"
                  className="h-8 w-16 text-xs"
                  value={e.reps}
                  onChange={(ev) => update(ex.exercise_name, "reps", ev.target.value)}
                />
                <span className="text-xs text-muted-foreground">reps</span>
              </div>
            </div>
          );
        })}

        {Object.keys(entries).length > 0 && (
          <Button onClick={handleSubmit} disabled={submitting} size="sm" className="w-full mt-2">
            {submitting ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3 w-3 mr-1" />
            )}
            Envoyer mes charges
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
