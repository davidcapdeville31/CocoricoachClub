// V2 — A7.3: persistence layer
//
// Serialises a V2ProgramDraft into the existing native tables:
//   training_programs → program_weeks → program_sessions → program_exercises
//
// All inserts go through the user's RLS policies. No edge function needed
// (staff write path). Method-specific configs (cluster, drop set, …) are
// stored on the dedicated jsonb columns when present, with a fallback to the
// hidden HTML-comment pattern in `notes` for richer V2-only configs.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { V2ProgramDraft } from "../CreateTrainingProgramV2";
import type { TrainingBlock } from "../TrainingBlockSection";

export interface V2BlockExercise {
  id: string;
  exerciseId?: string;
  exerciseName: string;
  sets: number;
  reps: string;
  percentage?: number;
  tempo?: string;
  restSeconds?: number;
  weight_kg?: number;
  rpe?: number;
  rir?: number;
  visibleVariables?: string[];
  variableSets?: any[];
  method?: string; // ConfigMethod | LinkedMethod | "normal"
  groupId?: string;
  notes?: string;
  config?: Record<string, unknown>; // serialised method-specific config
}

export interface V2BlockWithExercises extends TrainingBlock {
  exercises?: V2BlockExercise[];
}

interface SaveArgs {
  draft: V2ProgramDraft;
  categoryId: string;
  programId?: string;
}

export function useSaveProgramV2() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ draft, categoryId, programId }: SaveArgs) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié.");

      let program: { id: string };

      if (programId) {
        // UPDATE existing program
        const { data: updated, error: uErr } = await supabase
          .from("training_programs")
          .update({
            name: draft.name,
            description: draft.description || null,
            level: draft.difficultyLevel,
            theme_id: draft.themeId ?? null,
          })
          .eq("id", programId)
          .select("id")
          .single();
        if (uErr) throw uErr;
        program = updated;

        // Wipe existing weeks (cascade deletes sessions + exercises)
        const { error: dErr } = await supabase
          .from("program_weeks")
          .delete()
          .eq("program_id", programId);
        if (dErr) throw dErr;
      } else {
        // INSERT new program
        const { data: inserted, error: pErr } = await supabase
          .from("training_programs")
          .insert({
            category_id: categoryId,
            name: draft.name,
            description: draft.description || null,
            level: draft.difficultyLevel,
            program_kind: "training",
            created_by: user.id,
            is_active: false,
            theme_id: draft.themeId ?? null,
          })
          .select("id")
          .single();
        if (pErr) throw pErr;
        program = inserted;
      }

      // 2) program_weeks (one per draft week)
      const weekRows = draft.weeks.map((w) => ({
        program_id: program.id,
        week_number: w.weekNumber,
        name: w.name,
        block_order: w.weekNumber - 1,
      }));
      const { data: weeks, error: wErr } = await supabase
        .from("program_weeks")
        .insert(weekRows)
        .select("id, week_number");
      if (wErr) throw wErr;

      const weekIdByNumber = new Map(weeks.map((w) => [w.week_number, w.id]));

      // 3) program_sessions (one per draft day)
      const sessionRowsToInsert: Array<{
        week_id: string;
        session_number: number;
        name: string;
        scheduled_day: number | null;
        _draftDayId: string;
        _blocks: V2BlockWithExercises[];
      }> = [];

      draft.weeks.forEach((w) => {
        const weekId = weekIdByNumber.get(w.weekNumber);
        if (!weekId) return;
        w.days.forEach((d, idx) => {
          sessionRowsToInsert.push({
            week_id: weekId,
            session_number: idx + 1,
            name: d.name,
            scheduled_day: dayOfWeekIndex(d.dayOfWeek),
            _draftDayId: d.id,
            _blocks: (d.blocks as V2BlockWithExercises[]) ?? [],
          });
        });
      });

      const { data: sessions, error: sErr } = await supabase
        .from("program_sessions")
        .insert(
          sessionRowsToInsert.map(({ _draftDayId, _blocks, ...row }) => row),
        )
        .select("id, week_id, session_number, name");
      if (sErr) throw sErr;

      // 4) program_exercises (flatten blocks → exercises with block context in notes)
      type ExerciseInsert = {
        session_id: string;
        library_exercise_id: string | null;
        exercise_name: string;
        order_index: number;
        method: string;
        sets: number;
        reps: string;
        percentage_1rm: number | null;
        tempo: string | null;
        rest_seconds: number;
        notes: string;
        cluster_sets?: any;
        drop_sets?: any;
      };
      const exerciseRows: ExerciseInsert[] = [];
      sessionRowsToInsert.forEach((sRow, sIdx) => {
        const session = sessions[sIdx];
        if (!session) return;
        let order = 0;
        sRow._blocks.forEach((block) => {
          const blockHeader = `<!-- v2-block:${block.type}:${block.name} -->`;
          (block.exercises ?? []).forEach((ex) => {
            const baseNotes = ex.notes ?? "";
            const isTestRef = typeof ex.exerciseId === "string" && ex.exerciseId.startsWith("test:");
            const testTag = isTestRef ? `<!-- v2-test:${ex.exerciseId.slice(5)} -->` : "";
            const notes = `${blockHeader}${testTag}\n${baseNotes}`.trim();

            const row: ExerciseInsert = {
              session_id: session.id,
              library_exercise_id: isTestRef ? null : (ex.exerciseId ?? null),
              exercise_name: ex.exerciseName,
              order_index: order++,
              method: ex.method ?? "normal",
              sets: ex.sets ?? 3,
              reps: ex.reps ?? "10",
              percentage_1rm: ex.percentage ?? null,
              tempo: ex.tempo ?? null,
              rest_seconds: ex.restSeconds ?? 90,
              notes,
            };

            if (ex.config) {
              if (ex.method === "cluster") row.cluster_sets = ex.config;
              if (ex.method === "drop_set") row.drop_sets = ex.config;
            }
            exerciseRows.push(row);
          });
        });
      });

      if (exerciseRows.length > 0) {
        const { error: exErr } = await supabase
          .from("program_exercises")
          .insert(exerciseRows);
        if (exErr) throw exErr;
      }

      return { programId: program.id };
    },
    onSuccess: ({ programId }) => {
      toast.success("Programme enregistré ✅");
      qc.invalidateQueries({ queryKey: ["training-programs"] });
      qc.invalidateQueries({ queryKey: ["program", programId] });
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Échec de l'enregistrement du programme");
    },
  });
}

function dayOfWeekIndex(id: string): number | null {
  const map: Record<string, number> = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 0,
  };
  return id in map ? map[id] : null;
}
