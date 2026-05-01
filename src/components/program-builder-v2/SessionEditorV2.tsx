import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SessionEditorSheet } from "./SessionEditorSheet";
import { SessionDayEditor, type SessionDayEditorHandle } from "./SessionDayEditor";
import { V2ExerciseBankSidebar, type PickedExerciseRich } from "./V2ExerciseBankSidebar";
import type { V2BlockExercise, V2BlockWithExercises } from "./hooks/useSaveProgramV2";

interface SessionEditorV2Props {
  open: boolean;
  onClose: () => void;
  categoryId: string;
}

const todayIso = () => format(new Date(), "yyyy-MM-dd");

/**
 * V2 session editor — single-session creation with the new block + method UX.
 * Mirrors the program builder V2 experience but persists directly into
 * `training_sessions` + `gym_session_exercises` for one team-wide session.
 */
export function SessionEditorV2({ open, onClose, categoryId }: SessionEditorV2Props) {
  const queryClient = useQueryClient();

  const [weekNumber] = useState(1);
  const [dayName, setDayName] = useState("Séance 1");
  const [dayOfWeek, setDayOfWeek] = useState<string>("");
  const [sessionDate, setSessionDate] = useState<string>(todayIso());
  const [blocks, setBlocks] = useState<V2BlockWithExercises[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const activeBlockIdRef = useRef<string | null>(null);
  const dayEditorRef = useRef<SessionDayEditorHandle | null>(null);

  // Reset state every time the editor is reopened
  useEffect(() => {
    if (open) {
      setDayName("Séance 1");
      setDayOfWeek("");
      setSessionDate(todayIso());
      setBlocks([]);
      setSavedSnapshot(null);
      activeBlockIdRef.current = null;
    }
  }, [open]);

  // Keep activeBlock synced when blocks change externally
  useEffect(() => {
    if (!blocks.length) {
      activeBlockIdRef.current = null;
      return;
    }
    if (!activeBlockIdRef.current || !blocks.find((b) => b.id === activeBlockIdRef.current)) {
      activeBlockIdRef.current = blocks[blocks.length - 1].id;
    }
  }, [blocks]);

  const handlePickFromBank = (picked: PickedExerciseRich) => {
    const targetId = activeBlockIdRef.current ?? blocks[blocks.length - 1]?.id;
    if (!targetId) {
      toast.error("Ajoute d'abord un bloc de travail à gauche.");
      return;
    }
    // Délègue à SessionDayEditor : si une méthode liée (Biset/Superset/...) est en
    // cours d'édition sur ce bloc, l'exercice ira dans le prochain slot vide.
    // Sinon il sera ajouté comme exercice normal au bloc.
    const handle = dayEditorRef.current;
    if (handle) {
      const isLinked = handle.hasActiveLinkedDraft(targetId);
      handle.insertExternalExercise(targetId, { id: picked.id, name: picked.exercise_name });
      activeBlockIdRef.current = targetId;
      toast.success(
        isLinked
          ? `« ${picked.exercise_name} » ajouté au slot`
          : `« ${picked.exercise_name} » ajouté`,
      );
      return;
    }
    // Fallback (should not happen) : insertion directe en exercice normal
    const newExercise: V2BlockExercise = {
      id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      exerciseId: picked.id,
      exerciseName: picked.exercise_name,
      sets: 3,
      reps: "10",
      restSeconds: 90,
      method: "normal",
    };
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === targetId
          ? { ...b, exercises: [...(b.exercises ?? []), newExercise], isOpen: true }
          : b,
      ),
    );
    activeBlockIdRef.current = targetId;
    toast.success(`« ${picked.exercise_name} » ajouté`);
  };

  const handleBlocksChange = (next: V2BlockWithExercises[]) => {
    if (next.length > blocks.length) {
      activeBlockIdRef.current = next[next.length - 1].id;
    }
    setBlocks(next);
  };

  const currentSnapshot = JSON.stringify({ dayName, dayOfWeek, sessionDate, blocks });
  const isSavedUpToDate = savedSnapshot !== null && savedSnapshot === currentSnapshot;

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Flatten blocks → ordered exercises with hidden block context in notes
      const flat = blocks.flatMap((b) =>
        (b.exercises ?? []).map((ex) => ({ block: b, ex })),
      );

      if (flat.length === 0) {
        throw new Error("Ajoute au moins un exercice avant d'enregistrer.");
      }
      if (!sessionDate) throw new Error("Choisis une date pour la séance.");

      // 1. Load all athletes of this category
      const { data: players, error: pErr } = await supabase
        .from("players")
        .select("id")
        .eq("category_id", categoryId);
      if (pErr) throw pErr;
      if (!players || players.length === 0) {
        throw new Error("Aucun athlète dans cette catégorie.");
      }

      // 2. Create the training_sessions shell
      const sessionMeta = JSON.stringify({
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
          notes: `<!--v2-meta:${sessionMeta}-->${dayName}`,
        })
        .select("id")
        .single();
      if (sErr) throw sErr;

      // 3. Insert one gym_session_exercises row per (player × exercise),
      //    preserving block context inside `notes` via the agreed pattern.
      const rows = players.flatMap((player) =>
        flat.map(({ block, ex }, idx) => {
          const blockTag = `<!-- v2-block:${block.type}:${block.name} -->`;
          const userNote = ex.notes ? `\n${ex.notes}` : "";
          const repsNum = ex.reps ? Number(String(ex.reps).replace(/[^0-9]/g, "")) : null;
          return {
            training_session_id: session.id,
            player_id: player.id,
            category_id: categoryId,
            library_exercise_id: ex.exerciseId || null,
            exercise_name: ex.exerciseName,
            sets: ex.sets ?? 1,
            reps: repsNum && !Number.isNaN(repsNum) ? repsNum : null,
            rest_seconds: ex.restSeconds ?? null,
            tempo: ex.tempo ?? null,
            percentage_1rm: ex.percentage ?? null,
            order_index: idx,
            method: ex.method && ex.method !== "normal" ? ex.method : null,
            notes: `${blockTag}${userNote}`,
          };
        }),
      );

      const { error: eErr } = await supabase.from("gym_session_exercises").insert(rows);
      if (eErr) throw eErr;

      return session.id;
    },
    onSuccess: () => {
      setSavedSnapshot(currentSnapshot);
      toast.success("Séance enregistrée ✅");
      queryClient.invalidateQueries({ queryKey: ["training_sessions"] });
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

          <SessionDayEditor blocks={blocks} onChange={handleBlocksChange} />
        </div>
      )}
      renderExerciseLibrary={() => (
        <V2ExerciseBankSidebar onClickInsert={handlePickFromBank} />
      )}
    />
  );
}
