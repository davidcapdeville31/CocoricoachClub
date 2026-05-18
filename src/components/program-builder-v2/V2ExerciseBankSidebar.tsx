// V2 Exercise Bank Sidebar — strict replica of the "Bibliothèque d'exercices"
// panel from the Remix (CreateTrainingProgram) editor.
//
// - Search input + advanced ExerciseFilters (muscles / equipment / favorites)
// - Tabs of categories (sortedCategories with favorites first, top 4 visible,
//   the rest in an overflow Select)
// - Exercise count + favorite-current-category toggle
// - Click-to-insert via the parent callback (drag-and-drop is not wired here:
//   the V2 editor uses click-to-insert into the active block, mirroring the
//   Remix's `handleClickInsertExercise`).

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Dumbbell, Star, Video, Info, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ExerciseFilters,
  type ExerciseFiltersState,
  useExerciseFavorites,
  filterExercises,
} from "./ExerciseFilters";
import { ExerciseVisual } from "./ExerciseVisual";
import { ExerciseFocusPanel } from "./ExerciseFocusPanel";
import { ExerciseVideoModal } from "./ExerciseVideoModal";

export interface PickedExerciseRich {
  id: string;
  exercise_name: string;
  station_name: string;
  image_url?: string | null;
  video_url?: string | null;
  general_description?: string | null;
  positioning_criteria?: any;
  execution_criteria?: any;
  safety_prevention?: any;
  muscles?: string[] | null;
  equipment?: string[] | null;
}

interface Props {
  onClickInsert: (exercise: PickedExerciseRich) => void;
  /** When set to "tests", lists category custom tests instead of the exercise library. */
  mode?: "exercises" | "tests";
  /** Required when mode === "tests" — the current category id to fetch tests for. */
  categoryId?: string;
}

export function V2ExerciseBankSidebar({ onClickInsert, mode = "exercises", categoryId }: Props) {
  if (mode === "tests") {
    return <TestsBankSidebar onClickInsert={onClickInsert} categoryId={categoryId} />;
  }
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<ExerciseFiltersState>({
    showFavoritesOnly: false,
    selectedCategory: "all",
    selectedMuscles: [],
    selectedEquipment: [],
  });

  // Category favorites (localStorage), strict replica of Remix
  const [favoriteCategories, setFavoriteCategories] = useState<Set<string>>(
    () => {
      try {
        const saved = localStorage.getItem("favorite-exercise-categories");
        return saved ? new Set(JSON.parse(saved)) : new Set();
      } catch {
        return new Set();
      }
    },
  );
  useEffect(() => {
    try {
      localStorage.setItem(
        "favorite-exercise-categories",
        JSON.stringify(Array.from(favoriteCategories)),
      );
    } catch {
      /* ignore */
    }
  }, [favoriteCategories]);

  const toggleCategoryFavorite = (categoryName: string) => {
    setFavoriteCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryName)) next.delete(categoryName);
      else next.add(categoryName);
      return next;
    });
  };

  // Current user (for exercise favorites)
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? null);
    });
    return () => {
      active = false;
    };
  }, []);
  const { favorites: exerciseFavorites, toggleFavorite: toggleExerciseFavorite } =
    useExerciseFavorites(userId);

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ["v2-bank-sidebar-exercises", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_library")
        .select(
          "id, exercise_name, station_name, image_url, video_url, general_description, positioning_criteria, execution_criteria, safety_prevention, muscles, equipment",
        )
        .order("exercise_name", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as PickedExerciseRich[];
    },
  });

  // Categories sorted with favorites first (Remix logic)
  const sortedCategories = useMemo(() => {
    const uniqueCats = Array.from(
      new Set(exercises.map((e) => e.station_name).filter(Boolean)),
    );
    const favCats = uniqueCats
      .filter((c) => favoriteCategories.has(c))
      .sort((a, b) => a.localeCompare(b, "fr"));
    const nonFavCats = uniqueCats
      .filter((c) => !favoriteCategories.has(c))
      .sort((a, b) => a.localeCompare(b, "fr"));
    return [...favCats, ...nonFavCats];
  }, [exercises, favoriteCategories]);

  const filteredExercises = useMemo(() => {
    return filterExercises(exercises, filters, exerciseFavorites, searchTerm);
  }, [exercises, filters, exerciseFavorites, searchTerm]);

  return (
    <>
      {/* ---------- Header: search + advanced filters ---------- */}
      <div className="p-3 border-b space-y-2 flex-shrink-0 w-full overflow-hidden">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-primary" />
          <span className="truncate">Bibliothèque d'exercices</span>
        </h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <ExerciseFilters
          filters={filters}
          onFiltersChange={setFilters}
          favorites={exerciseFavorites}
          compact
          showCategoryFilter={false}
        />
      </div>

      {/* ---------- Category tabs ---------- */}
      <div className="px-2 py-2 border-b bg-muted/50 flex-shrink-0">
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            size="sm"
            variant={filters.selectedCategory === "all" ? "default" : "outline"}
            className={cn(
              "h-7 text-xs font-medium",
              filters.selectedCategory === "all" &&
                "bg-primary text-primary-foreground shadow-sm",
            )}
            onClick={() =>
              setFilters((prev) => ({ ...prev, selectedCategory: "all" }))
            }
          >
            Toutes catégories
          </Button>
          {sortedCategories.slice(0, 4).map((cat) => (
            <Button
              key={cat}
              type="button"
              size="sm"
              variant={filters.selectedCategory === cat ? "default" : "outline"}
              className={cn(
                "h-7 text-xs font-medium gap-1",
                filters.selectedCategory === cat &&
                  "bg-primary text-primary-foreground shadow-sm",
              )}
              onClick={() =>
                setFilters((prev) => ({ ...prev, selectedCategory: cat }))
              }
            >
              {favoriteCategories.has(cat) && (
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              )}
              <span className="truncate max-w-[80px]">{cat}</span>
            </Button>
          ))}
        </div>
        {sortedCategories.length > 4 && (
          <div className="mt-1.5">
            <Select
              value={
                sortedCategories.slice(4).includes(filters.selectedCategory)
                  ? filters.selectedCategory
                  : ""
              }
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, selectedCategory: value }))
              }
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue
                  placeholder={`+ ${sortedCategories.length - 4} autres catégories`}
                />
              </SelectTrigger>
              <SelectContent>
                {sortedCategories.slice(4).map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    <div className="flex items-center gap-2">
                      {favoriteCategories.has(cat) && (
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      )}
                      {cat}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {filters.selectedCategory !== "all" ? (
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {filteredExercises.length} exercice
              {filteredExercises.length > 1 ? "s" : ""}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={() => toggleCategoryFavorite(filters.selectedCategory)}
            >
              <Star
                className={cn(
                  "h-3 w-3",
                  favoriteCategories.has(filters.selectedCategory)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground",
                )}
              />
              {favoriteCategories.has(filters.selectedCategory)
                ? "Retirer"
                : "Favoris"}
            </Button>
          </div>
        ) : (
          <div className="mt-1.5">
            <span className="text-xs text-muted-foreground">
              {filteredExercises.length} exercice
              {filteredExercises.length > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* ---------- Exercises list ---------- */}
      <ScrollArea
        className="flex-1 overflow-hidden min-h-[280px]"
        style={{ width: "100%" }}
      >
        <div className="p-2 space-y-1.5">
          {isLoading && (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Chargement...
            </p>
          )}
          {!isLoading &&
            filteredExercises.map((exercise) => (
              <LibraryExerciseRow
                key={exercise.id}
                exercise={exercise}
                isFavorite={exerciseFavorites.has(exercise.id)}
                onToggleFavorite={() => toggleExerciseFavorite(exercise.id)}
                onClickInsert={onClickInsert}
              />
            ))}
          {!isLoading && filteredExercises.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Aucun exercice trouvé
            </p>
          )}
        </div>
      </ScrollArea>
    </>
  );
}

// ---------------------------------------------------------------------------
// LibraryExerciseRow — visual replica of Remix's DraggableLibraryExercise
// (without dnd-kit; clicking the card inserts it into the active block, the
// Info / Video / Star buttons mirror the original).
// ---------------------------------------------------------------------------

interface RowProps {
  exercise: PickedExerciseRich;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClickInsert: (exercise: PickedExerciseRich) => void;
}

function LibraryExerciseRow({
  exercise,
  isFavorite,
  onToggleFavorite,
  onClickInsert,
}: RowProps) {
  const [showFocusPanel, setShowFocusPanel] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);

  const descriptionData = {
    general_description: exercise.general_description,
    positioning_criteria: exercise.positioning_criteria,
    execution_criteria: exercise.execution_criteria,
    safety_prevention: exercise.safety_prevention,
  };

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library-exercise-${exercise.id}`,
    data: { type: "library-exercise", exercise },
  });

  const dragStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={dragStyle}
        className={cn(
          "flex items-center gap-2 p-2 rounded-md border border-border bg-background",
          "hover:border-primary/50 hover:bg-primary/5 transition-colors",
          "w-full overflow-hidden",
          isDragging && "ring-2 ring-primary shadow-lg cursor-grabbing",
        )}
      >
        {/* Drag handle — only this triggers dnd-kit, leaving the rest of the row clickable */}
        <button
          type="button"
          {...listeners}
          {...attributes}
          className={cn(
            "p-1 -ml-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10",
            "cursor-grab active:cursor-grabbing flex-shrink-0 touch-none",
          )}
          title="Glisser vers un slot ou un bloc"
          aria-label="Glisser cet exercice"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            onClickInsert(exercise);
            try { window.dispatchEvent(new CustomEvent("v2-exercise-inserted")); } catch {}
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClickInsert(exercise);
              try { window.dispatchEvent(new CustomEvent("v2-exercise-inserted")); } catch {}
            }
          }}
          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
        >
          <ExerciseVisual
            imageUrl={exercise.image_url}
            category={exercise.station_name}
            exerciseName={exercise.exercise_name}
            size="sm"
            className="flex-shrink-0"
          />

          <div className="flex-1 min-w-0">
            <p
              className="text-xs font-medium truncate"
              title={exercise.exercise_name}
            >
              {exercise.exercise_name}
            </p>
            <p
              className="text-[10px] text-muted-foreground truncate"
              title={exercise.station_name}
            >
              {exercise.station_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {exercise.video_url && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowVideoModal(true);
              }}
              className="p-1 text-primary hover:bg-primary/10 rounded"
              title="Voir la vidéo"
            >
              <Video className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowFocusPanel(true);
            }}
            className="p-1 text-primary hover:bg-primary/10 rounded"
            title="Voir les détails"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="p-1 rounded"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          >
            <Star
              className={cn(
                "h-3.5 w-3.5",
                isFavorite
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground hover:text-yellow-400",
              )}
            />
          </button>
        </div>
      </div>

      <ExerciseFocusPanel
        isOpen={showFocusPanel}
        onClose={() => setShowFocusPanel(false)}
        exerciseName={exercise.exercise_name}
        category={exercise.station_name}
        imageUrl={exercise.image_url}
        videoUrl={exercise.video_url}
        data={descriptionData}
      />

      <ExerciseVideoModal
        isOpen={showVideoModal}
        onClose={() => setShowVideoModal(false)}
        exerciseName={exercise.exercise_name}
        category={exercise.station_name}
        videoUrl={exercise.video_url}
        data={descriptionData}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// TestsBankSidebar — alternative panel listing the category custom tests
// (used when the active block is of type "tests"). Selecting a test inserts
// it into the active block as a "test exercise" via onClickInsert.
// ---------------------------------------------------------------------------

interface TestsBankProps {
  onClickInsert: (exercise: PickedExerciseRich) => void;
  categoryId?: string;
}

function TestsBankSidebar({ onClickInsert, categoryId }: TestsBankProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<string>("all");

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ["v2-bank-sidebar-tests", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_test_categories")
        .select(
          "custom_tests(id, name, test_category, unit, description, image_url)",
        )
        .eq("category_id", categoryId!);
      if (error) throw error;
      return ((data ?? []) as any[])
        .map((row) => row.custom_tests)
        .filter(Boolean) as Array<{
          id: string;
          name: string;
          test_category: string | null;
          unit: string | null;
          description: string | null;
          image_url: string | null;
        }>;
    },
  });

  const themes = useMemo(() => {
    const set = new Set<string>();
    tests.forEach((t) => {
      if (t.test_category) set.add(t.test_category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [tests]);

  const filteredTests = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return tests.filter((t) => {
      if (selectedTheme !== "all" && t.test_category !== selectedTheme) return false;
      if (q && !t.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tests, searchTerm, selectedTheme]);

  return (
    <>
      <div className="p-3 border-b space-y-2 flex-shrink-0 w-full overflow-hidden">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-cyan-600" />
          <span className="truncate">Tests & Profilages</span>
        </h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un test..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      <div className="px-2 py-2 border-b bg-muted/50 flex-shrink-0">
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            size="sm"
            variant={selectedTheme === "all" ? "default" : "outline"}
            className={cn(
              "h-7 text-xs font-medium",
              selectedTheme === "all" && "bg-primary text-primary-foreground shadow-sm",
            )}
            onClick={() => setSelectedTheme("all")}
          >
            Tous les thèmes
          </Button>
          {themes.slice(0, 5).map((theme) => (
            <Button
              key={theme}
              type="button"
              size="sm"
              variant={selectedTheme === theme ? "default" : "outline"}
              className={cn(
                "h-7 text-xs font-medium",
                selectedTheme === theme && "bg-primary text-primary-foreground shadow-sm",
              )}
              onClick={() => setSelectedTheme(theme)}
            >
              <span className="truncate max-w-[100px]">{theme}</span>
            </Button>
          ))}
        </div>
        {themes.length > 5 && (
          <div className="mt-1.5">
            <Select value={themes.slice(5).includes(selectedTheme) ? selectedTheme : ""} onValueChange={setSelectedTheme}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder={`+ ${themes.length - 5} autres thèmes`} />
              </SelectTrigger>
              <SelectContent>
                {themes.slice(5).map((theme) => (
                  <SelectItem key={theme} value={theme}>{theme}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="mt-1.5">
          <span className="text-xs text-muted-foreground">
            {filteredTests.length} test{filteredTests.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1 overflow-hidden min-h-[280px]" style={{ width: "100%" }}>
        <div className="p-2 space-y-1.5">
          {!categoryId && (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Catégorie non disponible.
            </p>
          )}
          {categoryId && isLoading && (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Chargement des tests...
            </p>
          )}
          {categoryId && !isLoading && filteredTests.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Aucun test n'a encore été créé pour cette catégorie.
            </p>
          )}
          {categoryId && !isLoading && filteredTests.map((test) => {
            const picked: PickedExerciseRich = {
              id: `test:${test.id}`,
              exercise_name: test.name,
              station_name: test.test_category || "Test",
              image_url: test.image_url,
              video_url: null,
              general_description: test.description,
              muscles: null,
              equipment: test.unit ? [`Unité : ${test.unit}`] : null,
            };
            return (
              <div
                key={test.id}
                role="button"
                tabIndex={0}
                onClick={() => onClickInsert(picked)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClickInsert(picked);
                  }
                }}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-md border border-border bg-background cursor-pointer",
                  "hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-colors",
                )}
              >
                <div className="p-1.5 rounded bg-cyan-500/15 text-cyan-600 flex-shrink-0">
                  <ClipboardList className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" title={test.name}>
                    {test.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {test.test_category}{test.unit ? ` · ${test.unit}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </>
  );
}
