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

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Plus,
  Calendar,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type UnifiedOrderItem } from "./ProgramGridView";
import { DAYS_OF_WEEK } from "./lib/trainingProgramsData";
import { SessionDayEditor } from "./SessionDayEditor";
import type { TrainingBlock } from "./TrainingBlockSection";
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
}

interface CreateTrainingProgramV2Props {
  categoryId: string;
  onClose?: () => void;
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
  };
}

// -- Component -----------------------------------------------------------------

type ScreenMode = "metadata" | "editor";

export function CreateTrainingProgramV2({
  categoryId,
  onClose,
}: CreateTrainingProgramV2Props) {
  const [draft, setDraft] = useState<V2ProgramDraft>(buildInitialDraft);
  const [mode, setMode] = useState<ScreenMode>("metadata");
  const [activeWeek, setActiveWeek] = useState(1);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const saveProgram = useSaveProgramV2();

  const handleSave = useCallback(() => {
    if (!draft.name.trim()) {
      toast.error("Donne un nom au programme avant d'enregistrer.");
      return;
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
      return;
    }
    saveProgram.mutate(
      { draft, categoryId },
      { onSuccess: () => onClose?.() },
    );
  }, [draft, categoryId, saveProgram, onClose]);

  const currentWeek = useMemo(
    () => draft.weeks.find((w) => w.weekNumber === activeWeek) ?? draft.weeks[0],
    [draft.weeks, activeWeek],
  );
  const currentDay = useMemo(
    () => currentWeek?.days.find((d) => d.id === activeDayId) ?? currentWeek?.days[0] ?? null,
    [currentWeek, activeDayId],
  );

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

  // -- Navigation --------------------------------------------------------------

  const goToEditor = useCallback(() => {
    if (!draft.name.trim()) {
      toast.error("Donne un nom à ton programme avant de continuer.");
      return;
    }
    const firstDay = draft.weeks[0]?.days[0];
    setActiveWeek(1);
    setActiveDayId(firstDay?.id ?? null);
    setMode("editor");
  }, [draft]);

  const goBackToMetadata = useCallback(() => setMode("metadata"), []);

  // -- Render: Metadata --------------------------------------------------------

  if (mode === "metadata") {
    return (
      <div className="space-y-6 p-4 md:p-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-2xl">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Nouveau programme d'entraînement</h1>
          </div>
        </div>

        <Card className="rounded-2xl shadow-lg border-border/60 bg-card/95 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base">Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="prog-name">Nom du programme *</Label>
              <Input
                id="prog-name"
                value={draft.name}
                onChange={(e) => updateMeta("name", e.target.value)}
                placeholder="Ex : Préparation hivernale — Force"
                className="rounded-2xl bg-muted/40 border-border/60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prog-desc">Description</Label>
              <Input
                id="prog-desc"
                value={draft.description}
                onChange={(e) => updateMeta("description", e.target.value)}
                placeholder="Objectif, public visé, prérequis…"
                className="rounded-2xl bg-muted/40 border-border/60"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Niveau</Label>
                <Select
                  value={draft.difficultyLevel}
                  onValueChange={(v) => updateMeta("difficultyLevel", v as V2ProgramDraft["difficultyLevel"])}
                >
                  <SelectTrigger className="rounded-2xl bg-muted/40 border-border/60">
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

              <div className="space-y-2">
                <Label>Jours / semaine</Label>
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

              <div className="space-y-2">
                <Label>Semaines</Label>
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
        </Card>

        <div className="flex justify-end gap-2">
          {onClose && (
            <Button variant="outline" onClick={onClose} className="rounded-2xl">
              Annuler
            </Button>
          )}
          <Button onClick={goToEditor} className="rounded-2xl shadow-md">
            Continuer vers l'éditeur
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // -- Render: Editor ----------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="sticky top-0 z-20 backdrop-blur bg-background/80 border-b border-border/60">
        <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={goBackToMetadata}
              className="rounded-2xl shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Programme</p>
              <h2 className="font-semibold truncate">{draft.name || "Sans titre"}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="rounded-2xl">
              <Calendar className="h-3 w-3 mr-1" />
              {draft.weeks.length} sem · {draft.daysPerWeek} j/sem
            </Badge>
            <Button
              size="sm"
              onClick={handleSave}
              className="rounded-2xl shadow-md"
            >
              {saveProgram.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1" />
              )}
              Enregistrer
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

        {/* Day tabs */}
        {currentWeek && (
          <div className="flex items-center gap-1 px-4 md:px-6 pb-3 overflow-x-auto">
            {currentWeek.days.map((d, idx) => {
              const isActive = currentDay?.id === d.id;
              return (
                <Button
                  key={d.id}
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  onClick={() => setActiveDayId(d.id)}
                  className={cn(
                    "rounded-2xl shrink-0 h-8",
                    isActive && "shadow-md",
                  )}
                >
                  J{idx + 1}
                  <span className="ml-1.5 text-[10px] opacity-70 uppercase">
                    {DAYS_OF_WEEK.find((dd) => dd.id === d.dayOfWeek)?.shortLabel}
                  </span>
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {/* Day editor */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {currentDay ? (
          <Card className="rounded-2xl shadow-lg border-border/60 bg-card/95 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  Semaine {activeWeek} ·{" "}
                  {DAYS_OF_WEEK.find((d) => d.id === currentDay.dayOfWeek)?.label}
                </p>
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
    </div>
  );
}

export default CreateTrainingProgramV2;
