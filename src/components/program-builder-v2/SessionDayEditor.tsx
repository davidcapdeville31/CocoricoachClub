// V2 — A7.3: SessionDayEditor branché sur les vrais composants de méthodes
//
// Au clic sur une méthode (Biset, Superset, Triset, etc.), on affiche la carte
// de configuration correspondante (LinkedMethodSlots) à l'identique du Remix.
// Les autres ConfigMethod (Drop Set, EMOM, AMRAP, Tabata, etc.) déclenchent
// MethodConfigSlots.

import { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  TrainingBlockWrapper,
  AddTrainingBlockButton,
  type TrainingBlockType,
  type CustomBlockType,
} from "./TrainingBlockSection";
import {
  TrainingMethodButtons,
  type ConfigMethod,
  type LinkedMethod,
} from "./TrainingMethodButtons";
import {
  LinkedMethodSlots,
  type LinkedMethodType,
  type SlottedExercise,
  type SlottedExerciseParams,
} from "./LinkedMethodSlots";
import { FartlekConfigSlots } from "./FartlekConfigSlots";
import type { FartlekConfig } from "@/lib/program-builder-v2/fartlekTypes";
import { formatFartlekSummary } from "@/lib/program-builder-v2/fartlekTypes";
import { ClusterConfigSlots } from "./ClusterConfigSlots";
import type { ClusterConfig } from "@/lib/program-builder-v2/clusterTypes";
import { formatClusterSummary } from "@/lib/program-builder-v2/clusterTypes";
import { StatoDynamiqueConfigSlots } from "./StatoDynamiqueConfigSlots";
import type { StatoDynamiqueConfig } from "@/lib/program-builder-v2/statoDynamiqueTypes";
import { formatStatoDynamiqueSummary } from "@/lib/program-builder-v2/statoDynamiqueTypes";
import { IntermittentCardioConfigSlots } from "./IntermittentCardioConfigSlots";
import type { IntermittentCardioConfig } from "@/lib/program-builder-v2/intermittentCardioTypes";
import { formatIntermittentSummary } from "@/lib/program-builder-v2/intermittentCardioTypes";
import { Trash2 } from "lucide-react";
import { ExercisePicker, type PickedExercise } from "./ExercisePicker";
import type { V2BlockExercise, V2BlockWithExercises } from "./hooks/useSaveProgramV2";

export interface SessionDayEditorProps {
  blocks: V2BlockWithExercises[];
  onChange: (blocks: V2BlockWithExercises[]) => void;
}

export interface SessionDayEditorHandle {
  /** Insère un exercice depuis la bibliothèque externe.
   *  - Si une méthode liée (Biset/Superset/...) est en cours d'édition sur le bloc cible,
   *    l'exercice est placé dans le prochain slot vide de la carte de configuration.
   *  - Sinon, il est ajouté comme exercice normal au bloc.
   *  Retourne true si l'insertion a eu lieu. */
  insertExternalExercise: (
    blockId: string,
    picked: { id: string; name: string },
  ) => boolean;
  /** Insère un exercice dans un slot spécifique d'une méthode liée active.
   *  Utilisé par le drag & drop pour cibler exactement le slot visé. */
  insertExternalExerciseAtSlot: (
    blockId: string,
    slotIndex: number,
    picked: { id: string; name: string },
  ) => boolean;
  /** Indique s'il existe un draft de méthode liée actif pour le bloc donné */
  hasActiveLinkedDraft: (blockId: string) => boolean;
}

type LinkedDraft = {
  blockId: string;
  method: LinkedMethodType;
  slottedExercises: SlottedExercise[];
  methodRestSeconds?: number;
};

type BlockRenderItem =
  | {
      type: "group";
      groupId: string;
      method: LinkedMethodType;
      exercises: V2BlockExercise[];
    }
  | {
      type: "single";
      exercise: V2BlockExercise;
    };

function makeBlockId() {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const LINKED_METHODS: LinkedMethodType[] = [
  "superset",
  "biset",
  "triset",
  "giant_set",
  "bulgarian",
  "combine_haltero",
];

export const SessionDayEditor = forwardRef<SessionDayEditorHandle, SessionDayEditorProps>(function SessionDayEditor({ blocks, onChange }, ref) {
  // Drafts en cours pour les méthodes liées (un par bloc max)
  const [linkedDrafts, setLinkedDrafts] = useState<Record<string, LinkedDraft>>({});
  // Mode actif pour méthode "config" (drop_set, emom, etc.) — toast informatif en attendant le wiring complet
  const [pendingConfig, setPendingConfig] = useState<Record<string, ConfigMethod>>({});
  // Draft Fartlek actif par bloc — affiche FartlekConfigSlots
  const [fartlekDrafts, setFartlekDrafts] = useState<Record<string, { editing: boolean; initial?: FartlekConfig }>>({});
  const [clusterDrafts, setClusterDrafts] = useState<Record<string, { editing: boolean; initial?: ClusterConfig }>>({});
  const [statoDrafts, setStatoDrafts] = useState<Record<string, { editing: boolean; initial?: StatoDynamiqueConfig }>>({});
  const [intermittentDrafts, setIntermittentDrafts] = useState<Record<string, { editing: boolean; initial?: IntermittentCardioConfig }>>({});

  // (useImperativeHandle is declared after addExerciseToBlock — see below)

  const addBlock = useCallback(
    (type: TrainingBlockType, customBlock?: CustomBlockType) => {
      const newBlock: V2BlockWithExercises = {
        id: makeBlockId(),
        type,
        name: customBlock?.label ?? defaultLabelFor(type),
        isOpen: true,
        exercises: [],
        ...(customBlock
          ? { customColor: customBlock.color, customEmoji: customBlock.emoji }
          : {}),
      };
      onChange([...blocks, newBlock]);
    },
    [blocks, onChange],
  );

  const updateBlock = useCallback(
    (id: string, patch: Partial<V2BlockWithExercises>) => {
      onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    },
    [blocks, onChange],
  );

  const removeBlock = useCallback(
    (id: string) => {
      onChange(blocks.filter((b) => b.id !== id));
      setLinkedDrafts((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
      setPendingConfig((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    },
    [blocks, onChange],
  );

  const addExerciseToBlock = useCallback(
    (blockId: string, picked: PickedExercise) => {
      // Si une méthode liée est en cours d'édition pour ce bloc → ajouter dans son prochain slot vide
      const draft = linkedDrafts[blockId];
      if (draft) {
        const nextSlotIndex = draft.slottedExercises.length;
        const newSlotted: SlottedExercise = {
          id: `slot-${Date.now()}`,
          exerciseId: picked.id,
          exerciseName: picked.name,
          stationName: picked.name,
          slotIndex: nextSlotIndex,
        };
        setLinkedDrafts((p) => ({
          ...p,
          [blockId]: {
            ...draft,
            slottedExercises: [...draft.slottedExercises, newSlotted],
          },
        }));
        return;
      }

      const exercise: V2BlockExercise = {
        id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        exerciseId: picked.id,
        exerciseName: picked.name,
        sets: 3,
        reps: "10",
        restSeconds: 90,
        method: pendingConfig[blockId] ?? "normal",
      };
      onChange(
        blocks.map((b) =>
          b.id === blockId
            ? { ...b, exercises: [...(b.exercises ?? []), exercise] }
            : b,
        ),
      );
      setPendingConfig((p) => {
        const next = { ...p };
        delete next[blockId];
        return next;
      });
    },
    [blocks, onChange, pendingConfig, linkedDrafts],
  );

  // Expose une API impérative pour insérer un exercice depuis la bibliothèque externe
  useImperativeHandle(
    ref,
    () => ({
      hasActiveLinkedDraft: (blockId: string) => !!linkedDrafts[blockId],
      insertExternalExercise: (blockId, picked) => {
        addExerciseToBlock(blockId, { id: picked.id, name: picked.name } as PickedExercise);
        return true;
      },
      insertExternalExerciseAtSlot: (blockId, slotIndex, picked) => {
        const draft = linkedDrafts[blockId];
        if (!draft) {
          addExerciseToBlock(blockId, { id: picked.id, name: picked.name } as PickedExercise);
          return true;
        }
        const existing = draft.slottedExercises.find((s) => s.slotIndex === slotIndex);
        const newSlotted: SlottedExercise = {
          id: existing?.id ?? `slot-${Date.now()}-${slotIndex}`,
          exerciseId: picked.id,
          exerciseName: picked.name,
          stationName: picked.name,
          slotIndex,
        };
        setLinkedDrafts((p) => {
          const current = p[blockId];
          if (!current) return p;
          const others = current.slottedExercises.filter((s) => s.slotIndex !== slotIndex);
          return {
            ...p,
            [blockId]: {
              ...current,
              slottedExercises: [...others, newSlotted].sort((a, b) => a.slotIndex - b.slotIndex),
            },
          };
        });
        return true;
      },
    }),
    [linkedDrafts, addExerciseToBlock],
  );

  const removeExerciseFromBlock = useCallback(
    (blockId: string, exerciseId: string) => {
      onChange(
        blocks.map((b) =>
          b.id === blockId
            ? { ...b, exercises: (b.exercises ?? []).filter((e) => e.id !== exerciseId) }
            : b,
        ),
      );
    },
    [blocks, onChange],
  );

  // Démarre une méthode liée (Biset/Superset/...) → affiche la carte LinkedMethodSlots
  const handleStartLinked = useCallback(
    (blockId: string, method: LinkedMethod) => {
      if (!LINKED_METHODS.includes(method as LinkedMethodType)) return;
      setLinkedDrafts((p) => ({
        ...p,
        [blockId]: {
          blockId,
          method: method as LinkedMethodType,
          slottedExercises: [],
        },
      }));
    },
    [],
  );

  const handleStartConfig = useCallback(
    (blockId: string, method: ConfigMethod) => {
      // Méthodes avec carte de configuration dédiée
      if (method === "fartlek") {
        setFartlekDrafts((p) => ({ ...p, [blockId]: { editing: true } }));
        return;
      }
      if (method === "cluster") {
        setClusterDrafts((p) => ({ ...p, [blockId]: { editing: true } }));
        return;
      }
      if (method === "stato_dynamique") {
        setStatoDrafts((p) => ({ ...p, [blockId]: { editing: true } }));
        return;
      }
      if (method === "intermittent_cardio") {
        setIntermittentDrafts((p) => ({ ...p, [blockId]: { editing: true } }));
        return;
      }
      setPendingConfig((p) => ({ ...p, [blockId]: method }));
      toast.info(`Méthode « ${method} » — appliquée au prochain exercice ajouté.`);
    },
    [],
  );

  const handleFartlekValidate = useCallback(
    (blockId: string, config: FartlekConfig) => {
      const summary = formatFartlekSummary(config);
      const serialized = `<!--v2-fartlek:${JSON.stringify(config)}-->`;
      const exercise: V2BlockExercise = {
        id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        exerciseId: undefined,
        exerciseName: `Fartlek — ${summary}`,
        sets: 1,
        reps: String(config.totalDurationMinutes || 1),
        restSeconds: 0,
        method: "fartlek",
        notes: serialized,
        config: config as unknown as Record<string, unknown>,
      };
      onChange(
        blocks.map((b) =>
          b.id === blockId
            ? { ...b, exercises: [...(b.exercises ?? []), exercise] }
            : b,
        ),
      );
      setFartlekDrafts((p) => {
        const n = { ...p };
        delete n[blockId];
        return n;
      });
      toast.success("Fartlek ajouté à la séance");
    },
    [blocks, onChange],
  );

  const handleFartlekCancel = useCallback((blockId: string) => {
    setFartlekDrafts((p) => {
      const n = { ...p };
      delete n[blockId];
      return n;
    });
  }, []);

  // Helper générique pour ajouter un exercice "méthode dédiée" au bloc
  const appendMethodExercise = useCallback(
    (
      blockId: string,
      params: {
        method: V2BlockExercise["method"];
        name: string;
        sets?: number;
        reps?: string;
        restSeconds?: number;
        notes?: string;
        config?: Record<string, unknown>;
      },
    ) => {
      const exercise: V2BlockExercise = {
        id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        exerciseId: undefined,
        exerciseName: params.name,
        sets: params.sets ?? 1,
        reps: params.reps ?? "1",
        restSeconds: params.restSeconds ?? 0,
        method: params.method,
        notes: params.notes,
        config: params.config,
      };
      onChange(
        blocks.map((b) =>
          b.id === blockId
            ? { ...b, exercises: [...(b.exercises ?? []), exercise] }
            : b,
        ),
      );
    },
    [blocks, onChange],
  );

  const handleClusterValidate = useCallback(
    (blockId: string, config: ClusterConfig) => {
      const summary = formatClusterSummary(config);
      appendMethodExercise(blockId, {
        method: "cluster",
        name: `Cluster — ${summary}`,
        sets: config.sets ?? 1,
        notes: `<!--v2-cluster:${JSON.stringify(config)}-->`,
        config: config as unknown as Record<string, unknown>,
      });
      setClusterDrafts((p) => {
        const n = { ...p };
        delete n[blockId];
        return n;
      });
      toast.success("Cluster ajouté à la séance");
    },
    [appendMethodExercise],
  );
  const handleClusterCancel = useCallback((blockId: string) => {
    setClusterDrafts((p) => {
      const n = { ...p };
      delete n[blockId];
      return n;
    });
  }, []);

  const handleStatoValidate = useCallback(
    (blockId: string, config: StatoDynamiqueConfig) => {
      const summary = formatStatoDynamiqueSummary(config);
      appendMethodExercise(blockId, {
        method: "stato_dynamique",
        name: `Stato-Dynamique — ${summary}`,
        notes: `<!--v2-stato:${JSON.stringify(config)}-->`,
        config: config as unknown as Record<string, unknown>,
      });
      setStatoDrafts((p) => {
        const n = { ...p };
        delete n[blockId];
        return n;
      });
      toast.success("Stato-Dynamique ajouté à la séance");
    },
    [appendMethodExercise],
  );
  const handleStatoCancel = useCallback((blockId: string) => {
    setStatoDrafts((p) => {
      const n = { ...p };
      delete n[blockId];
      return n;
    });
  }, []);

  const handleIntermittentValidate = useCallback(
    (blockId: string, config: IntermittentCardioConfig) => {
      const summary = formatIntermittentSummary(config);
      appendMethodExercise(blockId, {
        method: "intermittent_cardio",
        name: `Cardio intermittent — ${summary}`,
        notes: `<!--v2-intermittent:${JSON.stringify(config)}-->`,
        config: config as unknown as Record<string, unknown>,
      });
      setIntermittentDrafts((p) => {
        const n = { ...p };
        delete n[blockId];
        return n;
      });
      toast.success("Cardio intermittent ajouté à la séance");
    },
    [appendMethodExercise],
  );
  const handleIntermittentCancel = useCallback((blockId: string) => {
    setIntermittentDrafts((p) => {
      const n = { ...p };
      delete n[blockId];
      return n;
    });
  }, []);


  // Slot management pour LinkedMethodSlots
  const handleSlotRemove = useCallback((blockId: string, slotIndex: number) => {
    setLinkedDrafts((p) => {
      const draft = p[blockId];
      if (!draft) return p;
      return {
        ...p,
        [blockId]: {
          ...draft,
          slottedExercises: draft.slottedExercises
            .filter((s) => s.slotIndex !== slotIndex)
            .map((s, i) => ({ ...s, slotIndex: i })),
        },
      };
    });
  }, []);

  const handleSlotParamsUpdate = useCallback(
    (blockId: string, slotIndex: number, params: SlottedExerciseParams) => {
      setLinkedDrafts((p) => {
        const draft = p[blockId];
        if (!draft) return p;
        return {
          ...p,
          [blockId]: {
            ...draft,
            slottedExercises: draft.slottedExercises.map((s) =>
              s.slotIndex === slotIndex ? { ...s, params } : s,
            ),
          },
        };
      });
    },
    [],
  );

  const handleMethodRestChange = useCallback(
    (blockId: string, seconds: number | undefined) => {
      setLinkedDrafts((p) => {
        const draft = p[blockId];
        if (!draft) return p;
        return { ...p, [blockId]: { ...draft, methodRestSeconds: seconds } };
      });
    },
    [],
  );

  const handleLinkedConfirm = useCallback(
    (blockId: string) => {
      const draft = linkedDrafts[blockId];
      if (!draft) return;
      // On agrège la méthode liée comme un groupe d'exercices avec method = draft.method et un groupId commun
      const groupId = `grp-${Date.now()}`;
      const exercises: V2BlockExercise[] = draft.slottedExercises.map((s) => ({
        id: `ex-${Date.now()}-${s.slotIndex}-${Math.random().toString(36).slice(2, 6)}`,
        exerciseId: s.exerciseId,
        exerciseName: s.exerciseName,
        sets: Number(s.params?.sets) || 3,
        reps: s.params?.reps ?? "10",
        restSeconds: draft.methodRestSeconds ?? 90,
        tempo: s.params?.tempo,
        percentage: s.params?.percentage ? Number(s.params.percentage) : undefined,
        method: draft.method,
        groupId,
      }));
      onChange(
        blocks.map((b) =>
          b.id === blockId
            ? { ...b, exercises: [...(b.exercises ?? []), ...exercises] }
            : b,
        ),
      );
      setLinkedDrafts((p) => {
        const n = { ...p };
        delete n[blockId];
        return n;
      });
      toast.success(`Méthode « ${draft.method} » validée`);
    },
    [linkedDrafts, blocks, onChange],
  );

  const handleLinkedCancel = useCallback((blockId: string) => {
    setLinkedDrafts((p) => {
      const n = { ...p };
      delete n[blockId];
      return n;
    });
  }, []);

  const handlePersistedGroupParamsUpdate = useCallback(
    (blockId: string, groupId: string, slotIndex: number, params: SlottedExerciseParams) => {
      onChange(
        blocks.map((block) => {
          if (block.id !== blockId) return block;
          let groupCursor = 0;
          return {
            ...block,
            exercises: (block.exercises ?? []).map((exercise) => {
              if (exercise.groupId !== groupId) return exercise;
              const isTarget = groupCursor++ === slotIndex;
              if (!isTarget) return exercise;
              return {
                ...exercise,
                sets: Number(params.sets) || exercise.sets,
                reps: params.reps ?? exercise.reps,
                percentage: params.percentage,
                tempo: params.tempo,
                restSeconds: params.rest ?? exercise.restSeconds,
              };
            }),
          };
        }),
      );
    },
    [blocks, onChange],
  );

  const handlePersistedGroupRestChange = useCallback(
    (blockId: string, groupId: string, seconds: number | undefined) => {
      onChange(
        blocks.map((block) =>
          block.id === blockId
            ? {
                ...block,
                exercises: (block.exercises ?? []).map((exercise) =>
                  exercise.groupId === groupId
                    ? { ...exercise, restSeconds: seconds }
                    : exercise,
                ),
              }
            : block,
        ),
      );
    },
    [blocks, onChange],
  );

  const handlePersistedGroupRemove = useCallback(
    (blockId: string, groupId: string, slotIndex: number) => {
      onChange(
        blocks.map((block) => {
          if (block.id !== blockId) return block;
          let groupCursor = 0;
          const nextExercises = (block.exercises ?? []).filter((exercise) => {
            if (exercise.groupId !== groupId) return true;
            return groupCursor++ !== slotIndex;
          });
          return { ...block, exercises: nextExercises };
        }),
      );
    },
    [blocks, onChange],
  );

  const totalBlocks = blocks.length;

  return (
    <div className="space-y-3">
      {/* Top add button — primary entry point (matches reference editor) */}
      <AddTrainingBlockButton onAddBlock={addBlock} variant="prominent" />

      {/* Empty state */}
      {totalBlocks === 0 && (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun bloc pour l'instant.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Ajoute un bloc (échauffement, musculation, cardio…) pour commencer.
          </p>
        </div>
      )}

      {/* Blocks list */}
      <div className="space-y-2">
        {blocks.map((block) => {
          const linkedDraft = linkedDrafts[block.id];
          const fartlekDraft = fartlekDrafts[block.id];
          return (
            <TrainingBlockWrapper
              key={block.id}
              block={block}
              blockDropId={`drop-${block.id}`}
              exerciseCount={(block.exercises ?? []).length}
              onToggle={() => updateBlock(block.id, { isOpen: !block.isOpen })}
              onRename={(name) => updateBlock(block.id, { name })}
              onRemove={() => removeBlock(block.id)}
              onChangeType={(type, customBlock) =>
                updateBlock(block.id, {
                  type,
                  customColor: customBlock?.color,
                  customEmoji: customBlock?.emoji,
                })
              }
            >
              {block.type !== "tests" && (
                <TrainingMethodButtons
                  isBuilding={!!linkedDraft || !!pendingConfig[block.id] || !!fartlekDraft}
                  blockType={block.type === "custom" ? "musculation" : block.type}
                  onStartLinkedMethod={(m) => handleStartLinked(block.id, m)}
                  onStartConfigMethod={(m) => handleStartConfig(block.id, m)}
                />
              )}
              {/* Carte de configuration de la méthode liée (Biset/Superset/etc.) */}
              {linkedDraft && (
                <LinkedMethodSlots
                  method={linkedDraft.method}
                  slottedExercises={linkedDraft.slottedExercises}
                  onRemoveFromSlot={(idx) => handleSlotRemove(block.id, idx)}
                  onUpdateParams={(idx, params) =>
                    handleSlotParamsUpdate(block.id, idx, params)
                  }
                  onConfirm={() => handleLinkedConfirm(block.id)}
                  onCancel={() => handleLinkedCancel(block.id)}
                  dayId={block.id}
                  methodRestSeconds={linkedDraft.methodRestSeconds}
                  onMethodRestChange={(s) => handleMethodRestChange(block.id, s)}
                />
              )}

              {/* Carte de configuration Fartlek */}
              {fartlekDraft && (
                <FartlekConfigSlots
                  initialConfig={fartlekDraft.initial}
                  onValidate={(config) => handleFartlekValidate(block.id, config)}
                  onCancel={() => handleFartlekCancel(block.id)}
                />
              )}

              {pendingConfig[block.id] && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary flex items-center justify-between gap-2">
                  <span>
                    Mode actif : <strong>{pendingConfig[block.id]}</strong>{" "}
                    <span className="text-muted-foreground">
                      (appliqué au prochain exercice ajouté)
                    </span>
                  </span>
                </div>
              )}

              {/* Exercises list */}
              <div className="space-y-1.5">
                {groupBlockExercises(block.exercises ?? []).map((item) =>
                  item.type === "group" ? (
                    <LinkedMethodSlots
                      key={item.groupId}
                      method={item.method}
                      defaultEditing={false}
                      slottedExercises={item.exercises.map((ex, idx) => ({
                        id: ex.id,
                        exerciseId: ex.exerciseId ?? ex.id,
                        exerciseName: ex.exerciseName,
                        stationName: ex.exerciseName,
                        slotIndex: idx,
                        params: {
                          sets: ex.sets,
                          reps: ex.reps,
                          percentage: ex.percentage,
                          tempo: ex.tempo,
                          rest: ex.restSeconds,
                        },
                      }))}
                      onRemoveFromSlot={(idx) =>
                        handlePersistedGroupRemove(block.id, item.groupId, idx)
                      }
                      onUpdateParams={(idx, params) =>
                        handlePersistedGroupParamsUpdate(block.id, item.groupId, idx, params)
                      }
                      onConfirm={() => undefined}
                      onCancel={() => undefined}
                      dayId={`${block.id}-${item.groupId}`}
                      methodRestSeconds={item.exercises[0]?.restSeconds}
                      onMethodRestChange={(seconds) =>
                        handlePersistedGroupRestChange(block.id, item.groupId, seconds)
                      }
                    />
                  ) : (
                    <div
                      key={item.exercise.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 border border-border/60 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.exercise.exerciseName}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.exercise.sets} × {item.exercise.reps}
                          {item.exercise.method && item.exercise.method !== "normal" && (
                            <>
                              {" · "}
                              <span className="text-primary">{item.exercise.method}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-2xl text-muted-foreground hover:text-destructive"
                        onClick={() => removeExerciseFromBlock(block.id, item.exercise.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ),
                )}
                {!linkedDraft && (
                  <ExercisePicker
                    onPick={(picked) => addExerciseToBlock(block.id, picked)}
                  />
                )}
              </div>
            </TrainingBlockWrapper>
          );
        })}
      </div>

      {/* Tail add button when blocks exist */}
      {totalBlocks > 0 && (
        <div className="flex justify-center pt-2">
          <AddTrainingBlockButton onAddBlock={addBlock} variant="default" />
        </div>
      )}
    </div>
  );
});

// -- Helpers -------------------------------------------------------------------

function defaultLabelFor(type: TrainingBlockType): string {
  const map: Record<TrainingBlockType, string> = {
    echauffement: "Échauffement",
    musculation: "Musculation",
    halterophilie: "Haltérophilie",
    crossfit: "CrossFit / WOD",
    cardio: "Cardio",
    mobilite: "Mobilité",
    tests: "Tests",
    custom: "Personnalisé",
  };
  return map[type] ?? "Bloc";
}

function groupBlockExercises(exercises: V2BlockExercise[]): BlockRenderItem[] {
  const groups = new Map<string, V2BlockExercise[]>();
  const seen = new Set<string>();
  const items: BlockRenderItem[] = [];

  exercises.forEach((exercise) => {
    if (exercise.groupId && exercise.method && LINKED_METHODS.includes(exercise.method as LinkedMethodType)) {
      if (!groups.has(exercise.groupId)) groups.set(exercise.groupId, []);
      groups.get(exercise.groupId)!.push(exercise);
      if (!seen.has(exercise.groupId)) {
        seen.add(exercise.groupId);
        items.push({
          type: "group",
          groupId: exercise.groupId,
          method: exercise.method as LinkedMethodType,
          exercises: groups.get(exercise.groupId)!,
        });
      }
      return;
    }

    items.push({ type: "single", exercise });
  });

  return items.map((item) =>
    item.type === "group"
      ? { ...item, exercises: groups.get(item.groupId) ?? item.exercises }
      : item,
  );
}
