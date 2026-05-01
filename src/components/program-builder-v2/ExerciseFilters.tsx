import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Star, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// Muscles list (sorted alphabetically)
export const MUSCLES = [
  "Abdominaux",
  "Adducteurs",
  "Avant-bras",
  "Biceps",
  "Cuisses (Quadriceps)",
  "Deltoïdes (Épaules)",
  "Dorsaux (Grand dorsal)",
  "Érecteurs du rachis",
  "Fessiers",
  "Ischio-jambiers",
  "Mollets",
  "Obliques",
  "Pectoraux",
  "Rhomboïdes",
  "Trapèzes",
  "Triceps"
].sort((a, b) => a.localeCompare(b, 'fr'));

// Equipment list (sorted alphabetically)
export const EQUIPMENT = [
  "Abmat",
  "Anneaux",
  "Ballo",
  "Banc",
  "Barre",
  "Barre de traction",
  "Bosu",
  "Box",
  "Câbles",
  "Chaînes",
  "Corde",
  "Corde à sauter",
  "Echo Bike",
  "Élastiques",
  "GHD",
  "Haltères",
  "Kettlebell",
  "Machine",
  "Medball",
  "Parallettes",
  "Poids de corps",
  "Rameur",
  "Sac bulgare",
  "Sac de frappe",
  "Sandbag",
  "Serviette",
  "Ski Erg",
  "Sled",
  "Step",
  "Swiss ball",
  "TRX",
  "Wall ball"
].sort((a, b) => a.localeCompare(b, 'fr'));


// Exercise categories
export const EXERCISE_CATEGORIES = [
  "HYROX",
  "CrossFit",
  "Musculation",
  "Haltérophilie",
  "Cardio/Endurance",
  "Vitesse/Plyométrie",
  "Gainage/Core",
  "Poids de corps/Calisthenics",
  "Athlétisme/Running drills",
  "Mobilité/Stretching",
  "Prévention/Renforcement",
  "Respiration",
  "Réathlétisation",
  "Tests & Évaluations"
];

interface FilterCheckboxListProps {
  items: string[];
  selected: string[];
  onToggle: (item: string) => void;
}

const FilterCheckboxList = ({ items, selected, onToggle }: FilterCheckboxListProps) => (
  <ScrollArea className="h-40">
    <div className="grid grid-cols-2 gap-1 p-2">
      {items.map(item => (
        <label 
          key={item} 
          className={cn(
            "flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition-colors text-xs",
            selected.includes(item) 
              ? "bg-primary/10 text-primary" 
              : "hover:bg-muted"
          )}
        >
          <Checkbox
            checked={selected.includes(item)}
            onCheckedChange={() => onToggle(item)}
            className="h-3 w-3"
          />
          <span className="truncate">{item}</span>
        </label>
      ))}
    </div>
  </ScrollArea>
);

export interface ExerciseFiltersState {
  showFavoritesOnly: boolean;
  selectedCategory: string;
  selectedMuscles: string[];
  selectedEquipment: string[];
}

interface ExerciseFiltersProps {
  filters: ExerciseFiltersState;
  onFiltersChange: (filters: ExerciseFiltersState) => void;
  favorites: Set<string>;
  onToggleFavorite?: (exerciseId: string) => void;
  compact?: boolean;
  showCategoryFilter?: boolean;
  categories?: string[];
}

export const ExerciseFilters = ({
  filters,
  onFiltersChange,
  favorites,
  compact = false,
  showCategoryFilter = true,
  categories = EXERCISE_CATEGORIES
}: ExerciseFiltersProps) => {
  const [musclesOpen, setMusclesOpen] = useState(false);
  const [equipmentOpen, setEquipmentOpen] = useState(false);

  const hasActiveFilters = filters.showFavoritesOnly || 
    filters.selectedMuscles.length > 0 || 
    filters.selectedEquipment.length > 0;

  const clearAllFilters = () => {
    onFiltersChange({
      ...filters,
      showFavoritesOnly: false,
      selectedMuscles: [],
      selectedEquipment: [],
      selectedCategory: "all"
    });
  };

  const updateFilter = <K extends keyof ExerciseFiltersState>(key: K, value: ExerciseFiltersState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = (key: 'selectedMuscles' | 'selectedEquipment', item: string) => {
    const current = filters[key];
    const updated = current.includes(item)
      ? current.filter(i => i !== item)
      : [...current, item];
    updateFilter(key, updated);
  };

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      {/* Favorites toggle + Clear filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant={filters.showFavoritesOnly ? "default" : "outline"}
          size="sm"
          onClick={() => updateFilter('showFavoritesOnly', !filters.showFavoritesOnly)}
          className={cn(
            "gap-1.5 h-7 text-xs",
            filters.showFavoritesOnly && "bg-yellow-500 hover:bg-yellow-600 text-white"
          )}
        >
          <Star className={cn("h-3 w-3", filters.showFavoritesOnly && "fill-current")} />
          Favoris
        </Button>
        
        {hasActiveFilters && (
          <Button 
            type="button"
            variant="ghost" 
            size="sm" 
            onClick={clearAllFilters} 
            className="text-muted-foreground h-7 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Effacer
          </Button>
        )}
      </div>

      {/* Category filter */}
      {showCategoryFilter && (
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            variant={filters.selectedCategory === "all" ? "default" : "outline"}
            size="sm"
            className="h-6 text-xs"
            onClick={() => updateFilter('selectedCategory', 'all')}
          >
            Tous
          </Button>
          {categories.slice(0, 5).map(cat => (
            <Button
              key={cat}
              type="button"
              variant={filters.selectedCategory === cat ? "default" : "outline"}
              size="sm"
              className="h-6 text-xs"
              onClick={() => updateFilter('selectedCategory', cat)}
            >
              {cat}
            </Button>
          ))}
          {categories.length > 5 && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="h-6 text-xs">
                  +{categories.length - 5}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-1">
                <div className="flex flex-wrap gap-1">
                  {categories.slice(5).map(cat => (
                    <Button
                      key={cat}
                      type="button"
                      variant={filters.selectedCategory === cat ? "default" : "outline"}
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => updateFilter('selectedCategory', cat)}
                    >
                      {cat}
                    </Button>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}

      {/* Filter collapsibles */}
      <div className={cn("grid gap-2", compact ? "grid-cols-1" : "grid-cols-2")}>
        {/* Muscles filter */}
        <Collapsible open={musclesOpen} onOpenChange={setMusclesOpen}>
          <CollapsibleTrigger asChild>
            <Button 
              type="button"
              variant="outline" 
              size="sm"
              className={cn(
                "w-full justify-between h-7 text-xs min-w-0",
                filters.selectedMuscles.length > 0 && "border-red-500/50 bg-red-500/10"
              )}
            >
              <span className="truncate">
                Muscles {filters.selectedMuscles.length > 0 && `(${filters.selectedMuscles.length})`}
              </span>
              {musclesOpen ? <ChevronUp className="h-3 w-3 flex-shrink-0" /> : <ChevronDown className="h-3 w-3 flex-shrink-0" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 border rounded-md bg-card">
            <FilterCheckboxList
              items={MUSCLES}
              selected={filters.selectedMuscles}
              onToggle={(item) => toggleArrayFilter('selectedMuscles', item)}
            />
          </CollapsibleContent>
        </Collapsible>

        {/* Equipment filter */}
        <Collapsible open={equipmentOpen} onOpenChange={setEquipmentOpen}>
          <CollapsibleTrigger asChild>
            <Button 
              type="button"
              variant="outline" 
              size="sm"
              className={cn(
                "w-full justify-between h-7 text-xs min-w-0",
                filters.selectedEquipment.length > 0 && "border-blue-500/50 bg-blue-500/10"
              )}
            >
              <span className="truncate">
                Équipement {filters.selectedEquipment.length > 0 && `(${filters.selectedEquipment.length})`}
              </span>
              {equipmentOpen ? <ChevronUp className="h-3 w-3 flex-shrink-0" /> : <ChevronDown className="h-3 w-3 flex-shrink-0" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 border rounded-md bg-card">
            <FilterCheckboxList
              items={EQUIPMENT}
              selected={filters.selectedEquipment}
              onToggle={(item) => toggleArrayFilter('selectedEquipment', item)}
            />
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1">
          {filters.showFavoritesOnly && (
            <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs">
              <Star className="h-2.5 w-2.5 mr-1 fill-current" />
              Favoris
              <X 
                className="h-2.5 w-2.5 ml-1 cursor-pointer hover:text-destructive" 
                onClick={() => updateFilter('showFavoritesOnly', false)}
              />
            </Badge>
          )}
          {filters.selectedMuscles.map(muscle => (
            <Badge key={muscle} variant="secondary" className="bg-red-500/20 text-red-700 dark:text-red-400 text-xs">
              {muscle}
              <X 
                className="h-2.5 w-2.5 ml-1 cursor-pointer hover:text-destructive" 
                onClick={() => toggleArrayFilter('selectedMuscles', muscle)}
              />
            </Badge>
          ))}
          {filters.selectedEquipment.map(eq => (
            <Badge key={eq} variant="secondary" className="bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs">
              {eq}
              <X 
                className="h-2.5 w-2.5 ml-1 cursor-pointer hover:text-destructive" 
                onClick={() => toggleArrayFilter('selectedEquipment', eq)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

// Hook to manage favorites — V2 stub: persisted only in localStorage for now.
// TODO(step-5): connect to a real `exercise_favorites` table when the V2 editor is wired in.
export const useExerciseFavorites = (userId: string | null) => {
  const storageKey = userId ? `pbv2:exerciseFavorites:${userId}` : null;
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window === "undefined" || !storageKey) return new Set();
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    if (typeof window === "undefined" || !storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(Array.from(favorites)));
    } catch {
      /* ignore */
    }
  }, [favorites, storageKey]);

  const toggleFavorite = async (exerciseId: string) => {
    if (!userId) return;
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  };

  return { favorites, toggleFavorite };
};

// Filter function for exercises
export interface ExerciseWithDetails {
  id: string;
  station_name: string;
  exercise_name: string;
  muscles?: string[] | null;
  equipment?: string[] | null;
  joint_movements?: string[] | null;
}

export const filterExercises = <T extends ExerciseWithDetails>(
  exercises: T[],
  filters: ExerciseFiltersState,
  favorites: Set<string>,
  searchTerm: string = ""
): T[] => {
  return exercises.filter(exercise => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!exercise.exercise_name.toLowerCase().includes(search) &&
          !exercise.station_name.toLowerCase().includes(search)) {
        return false;
      }
    }

    // Category filter
    if (filters.selectedCategory !== "all" && exercise.station_name !== filters.selectedCategory) {
      return false;
    }
    
    // Favorites filter
    if (filters.showFavoritesOnly && !favorites.has(exercise.id)) {
      return false;
    }
    
    // Muscles filter (OR logic within muscles)
    if (filters.selectedMuscles.length > 0) {
      const exerciseMuscles = exercise.muscles || [];
      if (!filters.selectedMuscles.some(muscle => exerciseMuscles.includes(muscle))) {
        return false;
      }
    }
    
    // Equipment filter (OR logic within equipment)
    if (filters.selectedEquipment.length > 0) {
      const exerciseEquipment = exercise.equipment || [];
      if (!filters.selectedEquipment.some(eq => exerciseEquipment.includes(eq))) {
        return false;
      }
    }
    
    
    return true;
  });
};
