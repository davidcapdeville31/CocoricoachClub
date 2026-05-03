// V2 Orchestrator — A7.1
// Step 1 of the main "Remix" CreateTrainingProgram migration.
//
// Scope of A7.1:
//   - Top-level state machine: list → editor → session
//   - Local-only program state (persistence comes in A7.3)
//   - Program metadata form (name, weeks, days/week, difficulty)
//   - Week navigator + day navigator
//   - Delegates day editing to ProgramGridView (already migrated)
//
// Out of scope (A7.2/A7.3):
//   - Coloured training blocks editor inside a session
//   - Method buttons / linked methods
//   - Save/load via coach_session_templates

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Calendar,
  CalendarPlus,
  Sparkles,
  Settings,
} from "lucide-react";
import { AssignProgramDialog } from "@/components/category/programs/AssignProgramDialog";
import { ProgramThemeSelector } from "./ProgramThemeSelector";
import { cn } from "@/lib/utils";
import { type UnifiedOrderItem } from "./ProgramGridView";
import { DAYS_OF_WEEK } from "./lib/trainingProgramsData";
import { SessionDayEditor, type SessionDayEditorHandle } from "./SessionDayEditor";
import { V2ExerciseBankSidebar, type PickedExerciseRich } from "./V2ExerciseBankSidebar";

import { useSaveProgramV2, type V2BlockWithExercises } from "./hooks/useSaveProgramV2";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

// -- Local types ---------------------------------------------------------------

export interface V2ProgramExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: string;
  percentage?: number;
  tempo?: string;
  rpe?: number;
  restSeconds: number;
  trainingStyle: string;
  notes?: string;
}

export interface V2ProgramDay {
  id: string;
  dayOfWeek: string;
  name: string;
  exercises: V2ProgramExercise[];
  blocks: V2BlockWithExercises[];
  unifiedOrder: UnifiedOrderItem[];
}

export interface V2ProgramWeek {
  weekNumber: number;
  name: string;
  days: V2ProgramDay[];
}

export interface V2ProgramDraft {
  name: string;
  description: string;
  difficultyLevel: "beginner" | "intermediate" | "advanced";
  daysPerWeek: number;
  weeks: V2ProgramWeek[];
  themeId?: string | null;
}

interface CreateTrainingProgramV2Props {
  categoryId: string;
  onClose?: () => void;
  programId?: string;
}

// -- Helpers -------------------------------------------------------------------

const DIFFICULTY_OPTIONS = [
  { value: "beginner", label: "Débutant" },
  { value: "intermediate", label: "Intermédiaire" },
  { value: "advanced", label: "Avancé" },
] as const;

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildEmptyWeek(weekNumber: number, daysPerWeek: number): V2ProgramWeek {
  const days = DAYS_OF_WEEK.slice(0, daysPerWeek).map((d, idx) => ({
    id: makeId(),
    dayOfWeek: d.id,
    name: `Jour ${idx + 1}`,
    exercises: [],
    blocks: [],
    unifiedOrder: [],
  }));
  return {
    weekNumber,
    name: `Semaine ${weekNumber}`,
    days,
  };
}

function buildInitialDraft(): V2ProgramDraft {
  return {
    name: "",
    description: "",
    difficultyLevel: "intermediate",
    daysPerWeek: 3,
    weeks: [buildEmptyWeek(1, 3)],
    themeId: null,
  };
}

// -- Component -----------------------------------------------------------------

export function CreateTrainingProgramV2({
  categoryId,
  onClose,
  programId,
}: CreateTrainingProgramV2Props) {
  const isEditMode = !!programId;
  const [draft, setDraft] = useState<V2ProgramDraft>(buildInitialDraft);
  const [activeWeek, setActiveWeek] = useState(1);
  const [activeDayId, setActiveDayId] = useState<string | null>(
    () => buildInitialDraft().weeks[0]?.days[0]?.id ?? null,
  );
  const [infoOpen, setInfoOpen] = useState(true);
  const [assignProgramId, setAssignProgramId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"save" | "assign" | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const saveProgram = useSaveProgramV2();
  const dayEditorRef = useRef<SessionDayEditorHandle | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Load existing program for edit mode
  const { data: existingProgram } = useQuery({
    queryKey: ["program-v2-edit", programId],
    queryFn: async () => {
      if (!programId) return null;
      const { data: prog, error: pErr } = await supabase
        .from("training_programs")
        .select("*")
        .eq("id", programId)
        .single();
      if (pErr) throw pErr;
      const { data: weeks, error: wErr } = await supabase
        .from("program_weeks")
        .select("*, program_sessions(*, program_exercises(*))")
        .eq("program_id", programId)
        .order("week_number");
      if (wErr) throw wErr;
      return { ...prog, weeks };
    },
    enabled: !!programId,
  });

  // Hydrate draft from existing program (once)
  useEffect(() => {
    if (!existingProgram || hydrated) return;

    const DAY_INDEX_TO_ID: Record<number, string> = {
      1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday",
      5: "friday", 6: "saturday", 0: "sunday",
    };

    const v2Weeks: V2ProgramWeek[] = (existingProgram.weeks ?? [])
      .sort((a: any, b: any) => a.week_number - b.week_number)
      .map((w: any): V2ProgramWeek => {
        const days: V2ProgramDay[] = (w.program_sessions ?? [])
          .sort((a: any, b: any) => a.session_number - b.session_number)
          .map((s: any, idx: number): V2ProgramDay => {
            // Group exercises by block (parsed from notes header)
            const blocksMap = new Map<string, V2BlockWithExercises>();
            const orderedExercises = (s.program_exercises ?? []).sort(
              (a: any, b: any) => a.order_index - b.order_index,
            );
            for (const ex of orderedExercises) {
              const notes: string = ex.notes ?? "";
              const blockMatch = notes.match(/<!-- v2-block:([^:]+):([^>]+?) -->/);
              const blockType = (blockMatch?.[1] ?? "musculation") as V2BlockWithExercises["type"];
              const blockName = blockMatch?.[2]?.trim() ?? "Bloc";
              const blockKey = `${blockType}::${blockName}`;
              if (!blocksMap.has(blockKey)) {
                blocksMap.set(blockKey, {
                  id: makeId(),
                  type: blockType,
                  name: blockName,
                  isOpen: true,
                  exercises: [],
                });
              }
              const block = blocksMap.get(blockKey)!;
              const testMatch = notes.match(/<!-- v2-test:([^>]+?) -->/);
              const cleanNotes = notes
                .replace(/<!-- v2-block:[^>]+ -->/g, "")
                .replace(/<!-- v2-test:[^>]+ -->/g, "")
                .trim();
              block.exercises!.push({
                id: ex.id,
                exerciseId: testMatch ? `test:${testMatch[1]}` : (ex.library_exercise_id ?? undefined),
                exerciseName: ex.exercise_name,
                sets: ex.sets ?? 3,
                reps: ex.reps ?? "10",
                percentage: ex.percentage_1rm ?? undefined,
                tempo: ex.tempo ?? undefined,
                restSeconds: ex.rest_seconds ?? 90,
                method: ex.method ?? "normal",
                notes: cleanNotes,
                config:
                  ex.method === "cluster" ? ex.cluster_sets :
                  ex.method === "drop_set" ? ex.drop_sets : undefined,
              });
            }
            return {
              id: makeId(),
              dayOfWeek: DAY_INDEX_TO_ID[s.scheduled_day ?? (idx + 1)] ?? "monday",
              name: s.name || `Jour ${idx + 1}`,
              exercises: [],
              blocks: Array.from(blocksMap.values()),
              unifiedOrder: [],
            };
          });
        return {
          weekNumber: w.week_number,
          name: w.name || `Semaine ${w.week_number}`,
          days,
        };
      });

    const maxDays = Math.max(1, ...v2Weeks.map((w) => w.days.length));
    const hydratedDraft: V2ProgramDraft = {
      name: existingProgram.name ?? "",
      description: existingProgram.description ?? "",
      difficultyLevel: (existingProgram.level as V2ProgramDraft["difficultyLevel"]) ?? "intermediate",
      daysPerWeek: maxDays,
      weeks: v2Weeks.length > 0 ? v2Weeks : [buildEmptyWeek(1, 3)],
      themeId: (existingProgram as any).theme_id ?? null,
    };
    setDraft(hydratedDraft);
    setActiveWeek(hydratedDraft.weeks[0]?.weekNumber ?? 1);
    setActiveDayId(hydratedDraft.weeks[0]?.days[0]?.id ?? null);
    setHydrated(true);
  }, [existingProgram, hydrated]);


  const handleProgramDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const data = active.data.current as { type?: string; exercise?: PickedExerciseRich } | undefined;
    if (data?.type !== "library-exercise" || !data.exercise) return;
    const overData = over.data.current as { type?: string; slotIndex?: number } | undefined;
    const overId = String(over.id);
    const handle = dayEditorRef.current;
    if (!handle) return;
    if (overData?.type === "linked-slot" && typeof overData.slotIndex === "number") {
      const m = overId.match(/^linked-slot-(.+)-(\d+)$/);
      const blockId = m?.[1];
      if (!blockId) return;
      handle.insertExternalExerciseAtSlot(blockId, overData.slotIndex, {
        id: data.exercise.id,
        name: data.exercise.exercise_name,
      });
      toast.success(`« ${data.exercise.exercise_name} » ajouté au slot`);
      return;
    }
    if (overId.startsWith("drop-")) {
      const blockId = overId.replace(/^drop-/, "");
      handle.insertExternalExercise(blockId, {
        id: data.exercise.id,
        name: data.exercise.exercise_name,
      });
      toast.success(`« ${data.exercise.exercise_name} » ajouté`);
    }
  }, []);

  const handleProgramClickInsert = useCallback((picked: PickedExerciseRich) => {
    const handle = dayEditorRef.current;
    if (!handle) {
      toast.error("Sélectionne d'abord un jour, puis ajoute un bloc.");
      return;
    }
    const day = currentDayRef.current;
    const targetId = day?.blocks?.[day.blocks.length - 1]?.id;
    if (!targetId) {
      toast.error("Ajoute d'abord un bloc de travail.");
      return;
    }
    handle.insertExternalExercise(targetId, { id: picked.id, name: picked.exercise_name });
    toast.success(`« ${picked.exercise_name} » ajouté`);
  }, []);

  const currentDayRef = useRef<V2ProgramDay | null>(null);

  const validate = useCallback((): boolean => {
    if (!draft.name.trim()) {
      toast.error("Donne un nom au programme avant d'enregistrer.");
      return false;
    }
    const totalExercises = draft.weeks.reduce(
      (acc, w) =>
        acc +
        w.days.reduce(
          (a, d) =>
            a + d.blocks.reduce((x, b) => x + (b.exercises?.length ?? 0), 0),
          0,
        ),
      0,
    );
    if (totalExercises === 0) {
      toast.error("Ajoute au moins un exercice avant d'enregistrer.");
      return false;
    }
    return true;
  }, [draft]);

  const handleSave = useCallback(() => {
    if (!validate()) return;
    setPendingAction("save");
    saveProgram.mutate(
      { draft, categoryId, programId },
      {
        onSuccess: () => {
          setPendingAction(null);
          onClose?.();
        },
        onError: () => setPendingAction(null),
      },
    );
  }, [draft, categoryId, programId, saveProgram, onClose, validate]);

  const handleSaveAndAssign = useCallback(() => {
    if (!validate()) return;
    setPendingAction("assign");
    saveProgram.mutate(
      { draft, categoryId, programId },
      {
        onSuccess: ({ programId: savedId }) => {
          setPendingAction(null);
          setAssignProgramId(savedId);
        },
        onError: () => setPendingAction(null),
      },
    );
  }, [draft, categoryId, programId, saveProgram, validate]);

  const currentWeek = useMemo(
    () => draft.weeks.find((w) => w.weekNumber === activeWeek) ?? draft.weeks[0],
    [draft.weeks, activeWeek],
  );
  const currentDay = useMemo(
    () => currentWeek?.days.find((d) => d.id === activeDayId) ?? currentWeek?.days[0] ?? null,
    [currentWeek, activeDayId],
  );
  currentDayRef.current = currentDay;

  // -- Metadata mutations ------------------------------------------------------

  const updateMeta = useCallback(<K extends keyof V2ProgramDraft>(key: K, value: V2ProgramDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setDaysPerWeek = useCallback((n: number) => {
    setDraft((prev) => ({
      ...prev,
      daysPerWeek: n,
      weeks: prev.weeks.map((w) => {
        if (w.days.length === n) return w;
        if (w.days.length < n) {
          const extra = DAYS_OF_WEEK.slice(w.days.length, n).map((d, i) => ({
            id: makeId(),
            dayOfWeek: d.id,
            name: `Jour ${w.days.length + i + 1}`,
            exercises: [],
            blocks: [],
            unifiedOrder: [],
          }));
          return { ...w, days: [...w.days, ...extra] };
        }
        return { ...w, days: w.days.slice(0, n) };
      }),
    }));
  }, []);

  const addWeek = useCallback(() => {
    setDraft((prev) => {
      const next = prev.weeks.length + 1;
      return { ...prev, weeks: [...prev.weeks, buildEmptyWeek(next, prev.daysPerWeek)] };
    });
  }, []);

  const setDayOfWeek = useCallback(
    (weekNumber: number, dayId: string, newDow: string) => {
      setDraft((prev) => ({
        ...prev,
        weeks: prev.weeks.map((w) =>
          w.weekNumber !== weekNumber
            ? w
            : {
                ...w,
                days: w.days.map((d) =>
                  d.id === dayId ? { ...d, dayOfWeek: newDow } : d,
                ),
              },
        ),
      }));
    },
    [],
  );

  const setDayBlocks = useCallback(
    (weekNumber: number, dayId: string, blocks: V2BlockWithExercises[]) => {
      setDraft((prev) => ({
        ...prev,
        weeks: prev.weeks.map((w) =>
          w.weekNumber !== weekNumber
            ? w
            : {
                ...w,
                days: w.days.map((d) => (d.id === dayId ? { ...d, blocks } : d)),
              },
        ),
      }));
    },
    [],
  );

  // -- Render: Single-screen editor (style Remix) ------------------------------

  const isSavingOnly = pendingAction === "save" && saveProgram.isPending;
  const isSavingAndAssigning = pendingAction === "assign" && saveProgram.isPending;

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleProgramDragEnd}>
        <div className="flex flex-col h-full">
          {/* Header bar — style Remix */}
          <div className="sticky top-0 z-20 backdrop-blur bg-background/80 border-b border-border/60">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-3">
              <div className="flex items-center gap-2 min-w-0">
                {onClose && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="rounded-2xl shrink-0"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Retour
                  </Button>
                )}
                <div className="min-w-0 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary shrink-0" />
                  <h2 className="font-semibold truncate">
                    {draft.name || (isEditMode ? "Modifier le programme" : "Nouveau programme d'entraînement")}
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <Badge variant="outline" className="rounded-2xl">
                  <Calendar className="h-3 w-3 mr-1" />
                  {draft.weeks.length} sem · {draft.daysPerWeek} j/sem
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  disabled={saveProgram.isPending}
                  className="rounded-2xl gap-2"
                >
                  {isSavingOnly ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Enregistrer
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveAndAssign}
                  disabled={saveProgram.isPending}
                  className="rounded-2xl shadow-md gap-2"
                >
                  {isSavingAndAssigning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CalendarPlus className="h-3.5 w-3.5" />
                  )}
                  Appliquer au calendrier
                </Button>
              </div>
            </div>

            {/* Week tabs */}
            <div className="flex items-center gap-1 px-4 md:px-6 pb-2 overflow-x-auto">
              {draft.weeks.map((w) => (
                <Button
                  key={w.weekNumber}
                  size="sm"
                  variant={activeWeek === w.weekNumber ? "default" : "ghost"}
                  onClick={() => {
                    setActiveWeek(w.weekNumber);
                    setActiveDayId(w.days[0]?.id ?? null);
                  }}
                  className={cn(
                    "rounded-2xl shrink-0 h-8",
                    activeWeek === w.weekNumber && "shadow-md",
                  )}
                >
                  S{w.weekNumber}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={addWeek}
                className="rounded-2xl shrink-0 h-8"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Day tabs — chaque onglet a un sélecteur de jour de la semaine */}
            {currentWeek && (
              <div className="flex items-center gap-1.5 px-4 md:px-6 pb-3 overflow-x-auto">
                {currentWeek.days.map((d, idx) => {
                  const isActive = currentDay?.id === d.id;
                  return (
                    <div
                      key={d.id}
                      className={cn(
                        "flex items-center gap-0.5 rounded-2xl border shrink-0 h-8 pr-1",
                        isActive
                          ? "bg-primary text-primary-foreground border-primary shadow-md"
                          : "bg-background border-input",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveDayId(d.id)}
                        className="px-3 h-full text-xs font-semibold"
                      >
                        J{idx + 1}
                      </button>
                      <Select
                        value={d.dayOfWeek}
                        onValueChange={(val) => {
                          setDayOfWeek(activeWeek, d.id, val);
                          setActiveDayId(d.id);
                        }}
                      >
                        <SelectTrigger
                          className={cn(
                            "h-6 min-h-6 w-[68px] rounded-xl border-0 bg-transparent px-1.5 text-[10px] uppercase opacity-80 hover:opacity-100 focus:ring-0",
                            isActive && "text-primary-foreground",
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS_OF_WEEK.map((dd) => (
                            <SelectItem key={dd.id} value={dd.id} className="text-xs">
                              {dd.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Day editor + Library sidebar */}
          <div className="flex-1 overflow-hidden flex">
            <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
              {/* Inline metadata card (collapsible) */}
              <Collapsible open={infoOpen} onOpenChange={setInfoOpen}>
                <Card className="rounded-2xl shadow-lg border-border/60 bg-card/95 backdrop-blur">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-6 py-3 hover:bg-muted/30 rounded-t-2xl"
                    >
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm">Informations du programme</span>
                        {!infoOpen && draft.name && (
                          <span className="text-xs text-muted-foreground truncate">
                            — {draft.name}
                          </span>
                        )}
                      </div>
                      {infoOpen ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 pt-2">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="prog-name" className="text-xs">
                            Nom du programme *
                          </Label>
                          <Input
                            id="prog-name"
                            value={draft.name}
                            onChange={(e) => updateMeta("name", e.target.value)}
                            placeholder="Ex : Préparation hivernale — Force"
                            className="rounded-2xl bg-muted/40 border-border/60 h-9"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Niveau</Label>
                          <Select
                            value={draft.difficultyLevel}
                            onValueChange={(v) =>
                              updateMeta(
                                "difficultyLevel",
                                v as V2ProgramDraft["difficultyLevel"],
                              )
                            }
                          >
                            <SelectTrigger className="rounded-2xl bg-muted/40 border-border/60 h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DIFFICULTY_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Thématique</Label>
                        <ProgramThemeSelector
                          categoryId={categoryId}
                          value={draft.themeId ?? null}
                          onChange={(id) => updateMeta("themeId", id)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="prog-desc" className="text-xs">
                          Description
                        </Label>
                        <Textarea
                          id="prog-desc"
                          value={draft.description}
                          onChange={(e) => updateMeta("description", e.target.value)}
                          placeholder="Objectif, public visé, prérequis…"
                          className="rounded-2xl bg-muted/40 border-border/60 min-h-[60px]"
                        />
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Jours / semaine</Label>
                          <div className="flex flex-wrap gap-1.5">
                            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                              <Button
                                key={n}
                                type="button"
                                size="sm"
                                variant={draft.daysPerWeek === n ? "default" : "outline"}
                                onClick={() => setDaysPerWeek(n)}
                                className={cn(
                                  "rounded-2xl h-9 w-9 p-0",
                                  draft.daysPerWeek === n && "shadow-md",
                                )}
                              >
                                {n}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Semaines</Label>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="rounded-2xl text-sm px-3 py-1">
                              {draft.weeks.length} semaine{draft.weeks.length > 1 ? "s" : ""}
                            </Badge>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={addWeek}
                              className="rounded-2xl"
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {currentDay ? (
                <Card className="rounded-2xl shadow-lg border-border/60 bg-card/95 backdrop-blur">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Semaine {activeWeek} ·</span>
                        <Select
                          value={currentDay.dayOfWeek}
                          onValueChange={(val) => setDayOfWeek(activeWeek, currentDay.id, val)}
                        >
                          <SelectTrigger className="h-7 w-auto min-w-[110px] rounded-xl text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DAYS_OF_WEEK.map((d) => (
                              <SelectItem key={d.id} value={d.id} className="text-xs">
                                {d.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <CardTitle className="text-base mt-0.5">{currentDay.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="rounded-2xl h-8 w-8">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="rounded-2xl h-8 w-8">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <SessionDayEditor
                      ref={dayEditorRef}
                      blocks={currentDay.blocks}
                      onChange={(blocks) => setDayBlocks(activeWeek, currentDay.id, blocks)}
                    />
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  Sélectionne un jour pour commencer.
                </div>
              )}
            </div>
            <aside className="hidden md:flex flex-col w-[340px] border-l border-border/60 bg-muted/20">
              <V2ExerciseBankSidebar
                onClickInsert={handleProgramClickInsert}
                mode={
                  currentDay?.blocks?.[currentDay.blocks.length - 1]?.type === "tests"
                    ? "tests"
                    : "exercises"
                }
                categoryId={categoryId}
              />
            </aside>
          </div>
        </div>
      </DndContext>

      {/* Assign to calendar dialog (chooses athletes + start date) */}
      {assignProgramId && (
        <AssignProgramDialog
          categoryId={categoryId}
          programId={assignProgramId}
          open={!!assignProgramId}
          onOpenChange={(open) => {
            if (!open) {
              setAssignProgramId(null);
              onClose?.();
            }
          }}
        />
      )}
    </>
  );
}

export default CreateTrainingProgramV2;

