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
import { Search, Dumbbell, Star, Video, Info } from "lucide-react";
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
}

export function V2ExerciseBankSidebar({ onClickInsert }: Props) {
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
      <ScrollArea className="flex-1 overflow-hidden" style={{ width: "100%" }}>
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

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onClickInsert(exercise)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClickInsert(exercise);
          }
        }}
        className={cn(
          "flex items-center gap-2 p-2 rounded-md border border-border bg-background",
          "cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors",
          "w-full overflow-hidden",
        )}
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
