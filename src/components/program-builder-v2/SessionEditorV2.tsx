import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SessionEditorSheet } from "./SessionEditorSheet";
import { WorkoutExerciseBuilder, type WorkoutExerciseData } from "./WorkoutExerciseBuilder";

interface SessionEditorV2Props {
  open: boolean;
  onClose: () => void;
  categoryId: string;
}

interface LibraryRow {
  id: string;
  name: string;
  category: string;
  youtube_url: string | null;
  image_url: string | null;
  muscle_groups: string[] | null;
  equipment: string[] | null;
}

const todayIso = () => format(new Date(), "yyyy-MM-dd");

/**
 * V2 session editor wrapper — full DB persistence.
 *
 * Creates a `training_sessions` row (training_type='musculation') and inserts
 * one `gym_session_exercises` row per athlete × exercise. Method-specific
 * configs (cluster, restPause, fartlek, …) live on the dedicated jsonb columns
 * added in step 2 — they are populated when the V2 builder exposes them.
 */
export function SessionEditorV2({ open, onClose, categoryId }: SessionEditorV2Props) {
  const queryClient = useQueryClient();

  const [weekNumber] = useState(1);
  const [dayName, setDayName] = useState("Séance 1");
  const [dayOfWeek, setDayOfWeek] = useState<string>("");
  const [sessionDate, setSessionDate] = useState<string>(todayIso());
  const [exercises, setExercises] = useState<WorkoutExerciseData[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);

  // Reset state every time the editor is reopened
  useEffect(() => {
    if (open) {
      setDayName("Séance 1");
      setDayOfWeek("");
      setSessionDate(todayIso());
      setExercises([]);
      setSavedSnapshot(null);
    }
  }, [open]);

  // Load exercise library, mapping cocoricoach-club schema to V2 builder shape.
  const { data: libraryRows = [] } = useQuery({
    queryKey: ["exercise-library-v2-builder"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_library")
        .select("id, name, category, youtube_url, image_url, muscle_groups, equipment")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LibraryRow[];
    },
    enabled: open,
  });

  const builderExercises = useMemo(
    () =>
      libraryRows.map((row) => ({
        id: row.id,
        exercise_name: row.name,
        station_name: row.category,
        video_url: row.youtube_url,
        image_url: row.image_url,
        muscles: row.muscle_groups,
        equipment: row.equipment,
        joint_movements: null,
      })),
    [libraryRows],
  );

  const currentSnapshot = JSON.stringify({ dayName, dayOfWeek, sessionDate, exercises });
  const isSavedUpToDate = savedSnapshot !== null && savedSnapshot === currentSnapshot;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (exercises.length === 0) throw new Error("Ajoute au moins un exercice avant d'enregistrer.");
      if (!sessionDate) throw new Error("Choisis une date pour la séance.");

      // 1. Load every player of this category — V2 sessions are team-wide
      //    (one gym_session_exercises row per athlete, like the legacy editor).
      const { data: players, error: pErr } = await supabase
        .from("players")
        .select("id")
        .eq("category_id", categoryId);
      if (pErr) throw pErr;
      if (!players || players.length === 0) throw new Error("Aucun athlète dans cette catégorie.");

      // 2. Create the training session shell.
      const sessionNotes = JSON.stringify({
        v2: true,
        dayName,
        dayOfWeek: dayOfWeek || null,
        weekNumber,
      });
      const { data: session, error: sErr } = await supabase
        .from("training_sessions")
        .insert({
          category_id: categoryId,
          session_date: sessionDate,
          training_type: "musculation",
          notes: `<!--v2-meta:${sessionNotes}-->${dayName}`,
        })
        .select("id")
        .single();
      if (sErr) throw sErr;

      // 3. Build one row per (player × exercise) and insert in bulk.
      const rows = players.flatMap((player) =>
        exercises.map((ex, idx) => ({
          training_session_id: session.id,
          player_id: player.id,
          category_id: categoryId,
          library_exercise_id: ex.exerciseId || null,
          exercise_name: ex.exerciseName,
          exercise_category: ex.stationName || null,
          sets: ex.sets ?? 1,
          reps: ex.reps ?? null,
          weight_kg: ex.weightKg ?? null,
          rest_seconds: ex.restSeconds ?? null,
          rpe: ex.targetRpe ?? null,
          notes: ex.coachNote || null,
          order_index: idx,
          method: ex.trainingStyle || null,
          weightlifting_position: ex.startingPosition || null,
        })),
      );

      const { error: eErr } = await supabase.from("gym_session_exercises").insert(rows);
      if (eErr) throw eErr;

      return session.id;
    },
    onSuccess: () => {
      setSavedSnapshot(currentSnapshot);
      toast.success("Séance enregistrée ✅");
      queryClient.invalidateQueries({ queryKey: ["training-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["gym-session-exercises"] });
    },
    onError: (e: Error) => {
      toast.error(e.message ?? "Erreur lors de l'enregistrement");
    },
  });

  return (
    <SessionEditorSheet
      open={open}
      onClose={onClose}
      weekNumber={weekNumber}
      dayName={dayName}
      dayOfWeek={dayOfWeek}
      dayId="v2-day-1"
      weekId="v2-week-1"
      onUpdateDayName={(_w, _d, name) => setDayName(name)}
      onUpdateDayOfWeek={(_w, _d, dow) => setDayOfWeek(dow)}
      onSave={() => saveMutation.mutate()}
      saving={saveMutation.isPending}
      isSavedUpToDate={isSavedUpToDate}
      renderSessionContent={() => (
        <div className="space-y-4">
          <div className="flex items-end gap-3 rounded-2xl border bg-muted/40 p-3">
            <div className="space-y-1">
              <Label htmlFor="v2-session-date" className="text-xs">Date de la séance</Label>
              <Input
                id="v2-session-date"
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="h-9 w-44"
              />
            </div>
            <p className="text-xs text-muted-foreground pb-2">
              La séance sera créée pour tous les athlètes de la catégorie.
            </p>
          </div>
          <WorkoutExerciseBuilder
            exercises={builderExercises}
            selectedExercises={exercises}
            onExercisesChange={setExercises}
            showRestTime
          />
        </div>
      )}
      renderExerciseLibrary={() => (
        <div className="p-4 text-xs text-muted-foreground">
          Bibliothèque intégrée à l'éditeur (panneau gauche).
        </div>
      )}
    />
  );
}
