// V2 — A7.2: SessionDayEditor
//
// Plugs into CreateTrainingProgramV2 to render the editor of a single training
// day: coloured blocks (warm-up, strength, weightlifting, crossfit, cardio,
// mobility, custom) + per-block method buttons (superset, drop set, AMRAP, …).
//
// Scope of A7.2:
//   - Block CRUD (add / rename / toggle / remove / change type)
//   - Render TrainingMethodButtons inside each block
//   - Capture method clicks → local "pendingMethod" state per block (read-only
//     toast for now). Real method config UI (slots) is wired in A7.3.
//
// Out of scope:
//   - Exercise picker / drag-and-drop reordering across blocks
//   - Persistence to coach_session_templates

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrainingBlockWrapper,
  AddTrainingBlockButton,
  type TrainingBlock,
  type TrainingBlockType,
  type CustomBlockType,
} from "./TrainingBlockSection";
import {
  TrainingMethodButtons,
  type ConfigMethod,
  type LinkedMethod,
} from "./TrainingMethodButtons";
import { Sparkles, Trash2 } from "lucide-react";
import { ExercisePicker, type PickedExercise } from "./ExercisePicker";
import type { V2BlockExercise, V2BlockWithExercises } from "./hooks/useSaveProgramV2";

export interface SessionDayEditorProps {
  blocks: V2BlockWithExercises[];
  onChange: (blocks: V2BlockWithExercises[]) => void;
}

function makeBlockId() {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function SessionDayEditor({ blocks, onChange }: SessionDayEditorProps) {
  // pendingMethod : block.id → method label (purely visual placeholder for A7.2)
  const [pendingMethod, setPendingMethod] = useState<Record<string, string>>({});

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
      setPendingMethod((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [blocks, onChange],
  );

  const addExerciseToBlock = useCallback(
    (blockId: string, picked: PickedExercise) => {
      const exercise: V2BlockExercise = {
        id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        exerciseId: picked.id,
        exerciseName: picked.name,
        sets: 3,
        reps: "10",
        restSeconds: 90,
        method: pendingMethod[blockId] ?? "normal",
      };
      onChange(
        blocks.map((b) =>
          b.id === blockId
            ? { ...b, exercises: [...(b.exercises ?? []), exercise] }
            : b,
        ),
      );
      // consume pendingMethod so next exercise defaults to normal
      setPendingMethod((p) => {
        const next = { ...p };
        delete next[blockId];
        return next;
      });
    },
    [blocks, onChange, pendingMethod],
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

  const handleStartLinked = useCallback(
    (blockId: string, method: LinkedMethod) => {
      setPendingMethod((p) => ({ ...p, [blockId]: method }));
      toast.info(`Méthode liée « ${method} » — l'ajout d'exercice utilisera ce mode.`);
    },
    [],
  );
  const handleStartConfig = useCallback(
    (blockId: string, method: ConfigMethod) => {
      setPendingMethod((p) => ({ ...p, [blockId]: method }));
      toast.info(`Méthode « ${method} » — l'ajout d'exercice utilisera ce mode.`);
    },
    [],
  );

  const totalBlocks = blocks.length;
  const summary = useMemo(() => {
    if (!totalBlocks) return null;
    const counts: Record<string, number> = {};
    blocks.forEach((b) => {
      counts[b.type] = (counts[b.type] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([t, n]) => `${n} ${shortTypeLabel(t as TrainingBlockType)}`)
      .join(" · ");
  }, [blocks, totalBlocks]);

  return (
    <div className="space-y-3">
      {/* Header summary */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Blocs de la séance</span>
          {summary && (
            <Badge variant="secondary" className="rounded-2xl text-xs">
              {summary}
            </Badge>
          )}
        </div>
        <AddTrainingBlockButton onAddBlock={addBlock} variant="default" />
      </div>

      {/* Empty state */}
      {totalBlocks === 0 && (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun bloc pour l'instant.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Ajoute un bloc (échauffement, musculation, cardio…) pour commencer.
          </p>
          <div className="mt-4 inline-flex">
            <AddTrainingBlockButton onAddBlock={addBlock} variant="prominent" />
          </div>
        </div>
      )}

      {/* Blocks list */}
      <div className="space-y-2">
        {blocks.map((block) => (
          <TrainingBlockWrapper
            key={block.id}
            block={block}
            blockDropId={`drop-${block.id}`}
            exerciseCount={0}
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
            {/* Method buttons */}
            <TrainingMethodButtons
              isBuilding={false}
              blockType={block.type === "custom" ? "musculation" : block.type}
              onStartLinkedMethod={(m) => handleStartLinked(block.id, m)}
              onStartConfigMethod={(m) => handleStartConfig(block.id, m)}
            />

            {/* Pending method placeholder */}
            {pendingMethod[block.id] && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
                Méthode sélectionnée : <strong>{pendingMethod[block.id]}</strong>
                <span className="ml-2 text-muted-foreground">
                  (configuration détaillée — A7.3)
                </span>
              </div>
            )}

            {/* Exercise list placeholder */}
            <div className="rounded-xl border border-dashed border-border/60 bg-background/50 px-3 py-3 text-xs text-muted-foreground">
              Exercices — sélecteur disponible en A7.3.
            </div>
          </TrainingBlockWrapper>
        ))}
      </div>

      {/* Tail add button when blocks exist */}
      {totalBlocks > 0 && (
        <div className="flex justify-center pt-2">
          <AddTrainingBlockButton onAddBlock={addBlock} variant="default" />
        </div>
      )}
    </div>
  );
}

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

function shortTypeLabel(type: TrainingBlockType): string {
  const map: Record<TrainingBlockType, string> = {
    echauffement: "échauf.",
    musculation: "muscu",
    halterophilie: "haltéro",
    crossfit: "crossfit",
    cardio: "cardio",
    mobilite: "mobilité",
    custom: "perso",
  };
  return map[type] ?? type;
}
