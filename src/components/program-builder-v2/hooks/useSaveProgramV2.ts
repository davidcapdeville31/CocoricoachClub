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
import { encodeVariableSetsTag } from "@/lib/program-builder-v2/variableSetsNotes";
import { encodeExtraVariablesTag } from "@/lib/program-builder-v2/extraVariablesNotes";
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
  // Cardio / ergo / locomotion / skill variables (no dedicated DB column)
  durationSeconds?: number;
  distanceMeters?: number;
  calories?: number;
  watts?: number;
  cadence?: number;
  runDistanceMeters?: number;
  runDurationSeconds?: number;
  paceSecondsPerKm?: number;
  elevationMeters?: number;
  assistance_kg?: number;
  attempts?: number;
  successRate?: number;
  [key: string]: any;
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

      // Garde-fou : ne jamais écraser un programme existant avec un contenu vide
      const totalExercises = draft.weeks.reduce(
        (acc, w) =>
          acc +
          w.days.reduce(
            (a, d) =>
              a +
              ((d.blocks as V2BlockWithExercises[]) ?? []).reduce(
                (x, b) => x + (b.exercises?.length ?? 0),
                0,
              ),
            0,
          ),
        0,
      );
      if (programId && totalExercises === 0) {
        throw new Error(
          "Aucun exercice à enregistrer — sauvegarde annulée pour ne pas effacer le programme existant.",
        );
      }

      // Construction du payload complet (semaines → séances → exercices)
      const weeksPayload = draft.weeks.map((w) => ({
        week_number: w.weekNumber,
        name: w.name,
        block_order: w.weekNumber - 1,
        sessions: w.days.map((d, idx) => {
          const blocks = (d.blocks as V2BlockWithExercises[]) ?? [];
          let order = 0;
          const groupOrderTracker = new Map<string, number>();
          // group_id en base = UUID : on attribue un UUID stable par groupe d'écran ("grp-…")
          const groupUuidMap = new Map<string, string>();
          const exercises: any[] = [];
          blocks.forEach((block) => {
            const blockHeader = `<!-- v2-block:${block.type}:${block.name} -->`;
            (block.exercises ?? []).forEach((ex) => {
              const groupOrder = ex.groupId
                ? (groupOrderTracker.get(ex.groupId) ?? 0)
                : null;
              if (ex.groupId) groupOrderTracker.set(ex.groupId, (groupOrder ?? 0) + 1);
              const CONFIG_RE = /<!--\s*v2-(fartlek|cluster|stato|intermittent|drop_set|rest_pause|pyramid_up|pyramid_down|pyramid_full|five_by_five|isometric_overcoming|isometric_yielding|amrap|for_time|death_by|circuit|tabata|emom):[\s\S]*?-->/gi;
              // Re-serialise the method config (incl. custom instructions) from ex.config,
              // which is the source of truth after edits; drop any stale tag in notes.
              const baseNotes = (ex.notes ?? "").replace(CONFIG_RE, "").trim();
              let configTag = "";
              if (ex.method && ex.config && ex.method !== "normal") {
                const tagKey =
                  ex.method === "stato_dynamique" ? "stato"
                  : ex.method === "intermittent_cardio" ? "intermittent"
                  : ex.method;
                if (new RegExp(`^(${CONFIG_RE.source.match(/\(([^)]+)\)/)![1]})$`).test(tagKey)) {
                  try { configTag = `<!--v2-${tagKey}:${JSON.stringify(ex.config)}-->`; } catch { configTag = ""; }
                }
              }
              const isTestRef =
                typeof ex.exerciseId === "string" && ex.exerciseId.startsWith("test:");
              const testTag = isTestRef ? `<!-- v2-test:${ex.exerciseId!.slice(5)} -->` : "";
              const setsTag = encodeVariableSetsTag(ex.variableSets as any);
              const xvarsTag = encodeExtraVariablesTag(ex as any);
              const notes = `${blockHeader}${testTag}${setsTag}${xvarsTag}${configTag}\n${baseNotes}`.trim();

              exercises.push({
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
                group_id: ex.groupId
                  ? (groupUuidMap.get(ex.groupId) ??
                      groupUuidMap.set(ex.groupId, crypto.randomUUID()).get(ex.groupId))
                  : null,
                group_order: groupOrder,
                cluster_sets: ex.config && ex.method === "cluster" ? ex.config : null,
                drop_sets: ex.config && ex.method === "drop_set" ? ex.config : null,
              });
            });
          });
          return {
            session_number: idx + 1,
            name: d.name,
            scheduled_day: dayOfWeekIndex(d.dayOfWeek),
            start_time: (d as any).startTime || null,
            end_time: (d as any).endTime || null,
            exercises,
          };
        }),
      }));

      let targetProgramId = programId;

      if (!targetProgramId) {
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
        targetProgramId = inserted.id;
      }

      // Écriture atomique : l'ancien contenu n'est effacé que si le nouveau
      // s'insère intégralement (tout ou rien, côté base).
      const { error: rpcErr } = await (supabase as any).rpc("save_program_v2", {
        p_program_id: targetProgramId,
        p_payload: {
          name: draft.name,
          description: draft.description || "",
          level: draft.difficultyLevel,
          theme_id: draft.themeId ?? "",
          weeks: weeksPayload,
        },
      });
      if (rpcErr) throw rpcErr;

      return { programId: targetProgramId! };
    },
    onSuccess: ({ programId }) => {
      toast.success("Programme enregistré ✅");
      qc.invalidateQueries({ queryKey: ["training-programs"] });
      qc.invalidateQueries({ queryKey: ["program", programId] });
      qc.invalidateQueries({ queryKey: ["program-v2-edit", programId] });
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
