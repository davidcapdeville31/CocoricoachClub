import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

/**
 * V2 session editor wrapper.
 *
 * Standalone preview of the new program builder copied from "Remix of cocoricoach".
 * Currently runs in **local state only** — no DB persistence yet (planned for step 5).
 * The legacy SessionFormDialog remains the source of truth for the existing flow.
 */
export function SessionEditorV2({ open, onClose, categoryId }: SessionEditorV2Props) {
  const [weekNumber] = useState(1);
  const [dayName, setDayName] = useState("Séance 1");
  const [dayOfWeek, setDayOfWeek] = useState<string>("");
  const [exercises, setExercises] = useState<WorkoutExerciseData[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);

  // Load exercise library, mapping cocoricoach-club schema to V2 builder's expected shape.
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
        station_name: row.category, // Used as a category/group label by the V2 builder
        video_url: row.youtube_url,
        image_url: row.image_url,
        muscles: row.muscle_groups,
        equipment: row.equipment,
        joint_movements: null,
      })),
    [libraryRows],
  );

  const currentSnapshot = JSON.stringify({ dayName, dayOfWeek, exercises });
  const isSavedUpToDate = savedSnapshot !== null && savedSnapshot === currentSnapshot;

  const handleSave = async () => {
    if (exercises.length === 0) {
      toast.error("Ajoute au moins un exercice avant d'enregistrer.");
      return;
    }
    setSaving(true);
    try {
      // Persistence intentionally not wired yet — see step 5.
      await new Promise((r) => setTimeout(r, 400));
      setSavedSnapshot(currentSnapshot);
      toast.success("Aperçu enregistré (persistance DB à venir — étape 5)");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

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
      onSave={handleSave}
      saving={saving}
      isSavedUpToDate={isSavedUpToDate}
      renderSessionContent={() => (
        <WorkoutExerciseBuilder
          exercises={builderExercises}
          selectedExercises={exercises}
          onExercisesChange={setExercises}
          showRestTime
        />
      )}
      renderExerciseLibrary={() => (
        <div className="p-4 text-xs text-muted-foreground">
          Bibliothèque intégrée à l'éditeur (panneau gauche).
          {/* The V2 builder embeds its own library + filters inside WorkoutExerciseBuilder. */}
        </div>
      )}
    />
  );
}
