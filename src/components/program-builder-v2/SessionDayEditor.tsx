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
  /** Indique s'il existe un draft de méthode liée actif pour le bloc donné */
  hasActiveLinkedDraft: (blockId: string) => boolean;
}

type LinkedDraft = {
  blockId: string;
  method: LinkedMethodType;
  slottedExercises: SlottedExercise[];
  methodRestSeconds?: number;
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

  // Expose une API impérative pour insérer un exercice depuis la bibliothèque externe
  useImperativeHandle(
    ref,
    () => ({
      hasActiveLinkedDraft: (blockId: string) => !!linkedDrafts[blockId],
      insertExternalExercise: (blockId, picked) => {
        addExerciseToBlock(blockId, { id: picked.id, name: picked.name } as PickedExercise);
        return true;
      },
    }),
    [linkedDrafts],
  );

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
      setPendingConfig((p) => ({ ...p, [blockId]: method }));
      toast.info(`Méthode « ${method} » — appliquée au prochain exercice ajouté.`);
    },
    [],
  );

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
              <TrainingMethodButtons
                isBuilding={!!linkedDraft || !!pendingConfig[block.id]}
                blockType={block.type === "custom" ? "musculation" : block.type}
                onStartLinkedMethod={(m) => handleStartLinked(block.id, m)}
                onStartConfigMethod={(m) => handleStartConfig(block.id, m)}
              />

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
                {(block.exercises ?? []).map((ex) => (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 border border-border/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {ex.exerciseName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {ex.sets} × {ex.reps}
                        {ex.method && ex.method !== "normal" && (
                          <>
                            {" · "}
                            <span className="text-primary">{ex.method}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-2xl text-muted-foreground hover:text-destructive"
                      onClick={() => removeExerciseFromBlock(block.id, ex.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
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
    custom: "Personnalisé",
  };
  return map[type] ?? "Bloc";
}
