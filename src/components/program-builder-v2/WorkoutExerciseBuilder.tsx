import { useState, useMemo, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TimeInput } from "@/components/ui/time-input";
import { 
  GripVertical, 
  X, 
  Video, 
  Search, 
  Plus,
  Dumbbell,
  Timer,
  Image as ImageIcon,
  HelpCircle,
  Star
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WORKOUT_BUILDER_STYLES, getTrainingStyleConfig } from "@/lib/program-builder-v2/trainingStyles";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrainingStyleCharacteristicsDisplay } from "./TrainingStyleCharacteristicsDisplay";
import { 
  ExerciseFilters, 
  ExerciseFiltersState, 
  EXERCISE_CATEGORIES, 
  filterExercises,
  useExerciseFavorites
} from "./ExerciseFilters";
 import { WeightliftingPositionSelector, WeightliftingPositionBadge } from "./WeightliftingPositionSelector";
 import { isWeightliftingExercise } from "@/lib/program-builder-v2/weightliftingConfig";

interface Exercise {
  id: string;
  exercise_name: string;
  station_name: string;
  video_url: string | null;
  image_url?: string | null;
  muscles?: string[] | null;
  equipment?: string[] | null;
  joint_movements?: string[] | null;
}

export interface WorkoutExerciseData {
  id: string;
  exerciseId: string;
  exerciseName: string;
  stationName: string;
  sets: number;
  reps: number;
  weightKg: number;
  restSeconds: number;
  videoUrl: string;
  imageUrl?: string;
  trainingStyle?: string;
  targetRpe?: number;
  targetRir?: number;
  coachNote?: string;
   startingPosition?: string;
}

interface WorkoutExerciseBuilderProps {
  exercises: Exercise[];
  selectedExercises: WorkoutExerciseData[];
  onExercisesChange: (exercises: WorkoutExerciseData[]) => void;
  onExerciseCreated?: (exercise: Exercise) => void;
  showRestTime?: boolean;
}

// Draggable exercise item in the workout list
const SortableExerciseItem = ({ 
  exercise, 
  index, 
  onUpdate, 
  onRemove,
  showRestTime 
}: { 
  exercise: WorkoutExerciseData; 
  index: number;
  onUpdate: (id: string, field: keyof WorkoutExerciseData, value: number | string) => void;
  onRemove: (id: string) => void;
  showRestTime: boolean;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const tonnage = exercise.sets * exercise.reps * exercise.weightKg;

  const getStyleColor = (style?: string) => {
    const styles: Record<string, string> = {
      superset: "bg-primary text-primary-foreground",
      triset: "bg-accent text-accent-foreground",
      giant_set: "bg-secondary text-secondary-foreground",
      drop_set: "bg-muted text-foreground",
      rest_pause: "bg-secondary text-secondary-foreground",
      pyramid: "bg-accent text-accent-foreground",
      cluster: "bg-primary text-primary-foreground",
      emom: "bg-primary text-primary-foreground",
      amrap: "bg-accent text-accent-foreground",
      circuit: "bg-secondary text-secondary-foreground",
    };
    return styles[style || ""] || "bg-muted text-foreground";
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-3 bg-secondary/50 rounded-lg border border-border",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-secondary rounded"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <span className="text-xs font-medium text-muted-foreground bg-primary/10 px-2 py-0.5 rounded">
          {index + 1}
        </span>
        <span className="font-medium text-sm flex-1">{exercise.exerciseName}</span>
        {exercise.trainingStyle && exercise.trainingStyle !== "normal" && (
          <Badge className={cn("text-xs", getStyleColor(exercise.trainingStyle))}>
            {getTrainingStyleConfig(exercise.trainingStyle).label}
          </Badge>
        )}
         <WeightliftingPositionBadge positionKey={exercise.startingPosition} compact />
        <Badge variant="outline" className="text-xs">{exercise.stationName}</Badge>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive/80"
          onClick={() => onRemove(exercise.id)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Training Style Selector */}
      <div className="mb-3">
        <div className="flex items-center gap-1 mb-1">
          <Label className="text-xs text-muted-foreground">Style d'entraînement</Label>
          {exercise.trainingStyle && exercise.trainingStyle !== "normal" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm bg-popover text-popover-foreground border p-0">
                  <div className="p-2 border-b">
                    <p className="text-sm font-medium">{getTrainingStyleConfig(exercise.trainingStyle).label}</p>
                    <p className="text-xs text-muted-foreground">{getTrainingStyleConfig(exercise.trainingStyle).description}</p>
                  </div>
                  {getTrainingStyleConfig(exercise.trainingStyle).characteristics && (
                    <TrainingStyleCharacteristicsDisplay 
                      characteristics={getTrainingStyleConfig(exercise.trainingStyle).characteristics!} 
                      compact 
                    />
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <Select
          value={exercise.trainingStyle || "normal"}
          onValueChange={(value) => onUpdate(exercise.id, 'trainingStyle', value)}
        >
          <SelectTrigger className="h-8 bg-background">
            <SelectValue placeholder="Normal" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border z-50">
            {WORKOUT_BUILDER_STYLES.map((style) => (
              <SelectItem key={style.value} value={style.value}>
                <div className="flex items-center gap-2">
                  {style.color && <div className={cn("w-2 h-2 rounded-full", style.color)} />}
                  <span>{style.label}</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-muted-foreground ml-1" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-sm bg-popover text-popover-foreground border p-0">
                        <div className="p-2 border-b">
                          <p className="text-xs font-medium">{style.label}</p>
                          <p className="text-[10px] text-muted-foreground">{style.description}</p>
                        </div>
                        {style.characteristics && (
                          <TrainingStyleCharacteristicsDisplay 
                            characteristics={style.characteristics} 
                            compact 
                          />
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

       {/* Weightlifting Starting Position (only for Olympic lifts) */}
       <WeightliftingPositionSelector
         exerciseName={exercise.exerciseName}
         stationName={exercise.stationName}
         value={exercise.startingPosition}
         onChange={(value) => onUpdate(exercise.id, 'startingPosition', value)}
         compact
       />
 
      {/* Row 1: Sets, Reps, Weight, Rest, Tonnage */}
      <div className={cn("grid gap-2", showRestTime ? "grid-cols-5" : "grid-cols-4")}>
        <div>
          <Label className="text-xs text-muted-foreground">Séries</Label>
          <Input
            type="number"
            min={1}
            value={exercise.sets}
            onChange={(e) => onUpdate(exercise.id, 'sets', parseInt(e.target.value) || 0)}
            className="h-8 bg-background text-center"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Reps</Label>
          <Input
            type="number"
            min={1}
            value={exercise.reps}
            onChange={(e) => onUpdate(exercise.id, 'reps', parseInt(e.target.value) || 0)}
            className="h-8 bg-background text-center"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Charge (kg)</Label>
          <Input
            type="number"
            min={0}
            step={0.5}
            value={exercise.weightKg}
            onChange={(e) => onUpdate(exercise.id, 'weightKg', parseFloat(e.target.value) || 0)}
            className="h-8 bg-background text-center"
          />
        </div>
        {showRestTime && (
          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Timer className="h-3 w-3" />
              Repos
            </Label>
            <TimeInput
              value={exercise.restSeconds}
              onChange={(seconds) => onUpdate(exercise.id, 'restSeconds', seconds)}
              className="h-8 bg-background"
              placeholder="01:30"
            />
          </div>
        )}
        <div>
          <Label className="text-xs text-muted-foreground">Tonnage</Label>
          <div className="h-8 flex items-center justify-center px-2 bg-primary/10 rounded-md text-sm font-medium text-primary">
            {tonnage > 0 ? `${tonnage.toLocaleString()} kg` : "-"}
          </div>
        </div>
      </div>

      {/* Row 2: RPE, RIR */}
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div>
          <Label className="text-xs text-muted-foreground">RPE cible (1-10)</Label>
          <Input
            type="number"
            min={1}
            max={10}
            step={0.5}
            value={exercise.targetRpe || ""}
            onChange={(e) => onUpdate(exercise.id, 'targetRpe', e.target.value ? parseFloat(e.target.value) : 0)}
            placeholder="Ex: 8"
            className="h-8 bg-background text-center"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">RIR cible (0-5)</Label>
          <Input
            type="number"
            min={0}
            max={5}
            value={exercise.targetRir || ""}
            onChange={(e) => onUpdate(exercise.id, 'targetRir', e.target.value ? parseInt(e.target.value) : 0)}
            placeholder="Ex: 2"
            className="h-8 bg-background text-center"
          />
        </div>
      </div>

      {/* Row 3: Coach Note */}
      <div className="mt-2">
        <Label className="text-xs text-muted-foreground">Note pour l'athlète</Label>
        <Textarea
          value={exercise.coachNote || ""}
          onChange={(e) => onUpdate(exercise.id, 'coachNote', e.target.value)}
          placeholder="Consignes, points d'attention..."
          rows={2}
          className="bg-background text-sm resize-none"
        />
      </div>
    </div>
  );
};

// Exercise item in the library (draggable source)
const LibraryExerciseItem = ({ 
  exercise, 
  isSelected,
  isFavorite,
  onAdd,
  onToggleFavorite
}: { 
  exercise: Exercise;
  isSelected: boolean;
  isFavorite: boolean;
  onAdd: () => void;
  onToggleFavorite: () => void;
}) => {
  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded-md transition-colors cursor-pointer group",
        isSelected 
          ? "bg-primary/10 border border-primary/30" 
          : "hover:bg-secondary border border-transparent"
      )}
      onClick={onAdd}
    >
      {/* Illustration */}
      {exercise.image_url ? (
        <img 
          src={exercise.image_url} 
          alt={exercise.exercise_name}
          className="w-10 h-10 rounded object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center flex-shrink-0">
          <Dumbbell className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground truncate max-w-[100px]">
            {exercise.station_name}
          </span>
          {exercise.video_url && (
            <Video className="h-3 w-3 text-primary flex-shrink-0" />
          )}
        </div>
        <p className="text-sm font-medium truncate">{exercise.exercise_name}</p>
      </div>
      
      {/* Favorite star */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
      >
        <Star className={cn(
          "h-4 w-4 transition-colors",
          isFavorite 
            ? "fill-yellow-500 text-yellow-500" 
            : "text-muted-foreground hover:text-yellow-500"
        )} />
      </Button>
      
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity",
          isSelected && "opacity-100 text-primary"
        )}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
};

export const WorkoutExerciseBuilder = ({
  exercises,
  selectedExercises,
  onExercisesChange,
  onExerciseCreated,
  showRestTime = true,
}: WorkoutExerciseBuilderProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Filter state
  const [filters, setFilters] = useState<ExerciseFiltersState>({
    showFavoritesOnly: false,
    selectedCategory: "all",
    selectedMuscles: [],
    selectedEquipment: []
  });
  
  // New exercise form state
  const [showNewExerciseDialog, setShowNewExerciseDialog] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseCategory, setNewExerciseCategory] = useState("Musculation");
  const [newExerciseDescription, setNewExerciseDescription] = useState("");
  const [newExerciseImageUrl, setNewExerciseImageUrl] = useState("");
  const [newExerciseVideoUrl, setNewExerciseVideoUrl] = useState("");
  const [isCreatingExercise, setIsCreatingExercise] = useState(false);

  // Fetch user for favorites
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    fetchUser();
  }, []);

  // Favorites hook
  const { favorites, toggleFavorite } = useExerciseFavorites(userId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Get unique categories from exercises
  const categories = useMemo(() => {
    const cats = new Set(exercises.map(e => e.station_name));
    return Array.from(cats).sort();
  }, [exercises]);

  // Filter exercises using shared logic
  const filteredExercises = useMemo(() => {
    return filterExercises(exercises, filters, favorites, searchTerm);
  }, [exercises, filters, favorites, searchTerm]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = selectedExercises.findIndex(e => e.id === active.id);
      const newIndex = selectedExercises.findIndex(e => e.id === over.id);
      onExercisesChange(arrayMove(selectedExercises, oldIndex, newIndex));
    }
  };

  const addExercise = (exercise: Exercise) => {
    const isAlreadySelected = selectedExercises.some(e => e.exerciseId === exercise.id);
    
    if (isAlreadySelected) {
      // Remove if already selected
      onExercisesChange(selectedExercises.filter(e => e.exerciseId !== exercise.id));
    } else {
      // Add new exercise
      const newExercise: WorkoutExerciseData = {
        id: `${exercise.id}-${Date.now()}`,
        exerciseId: exercise.id,
        exerciseName: exercise.exercise_name,
        stationName: exercise.station_name,
        sets: 3,
        reps: 10,
        weightKg: 0,
        restSeconds: 60,
        videoUrl: exercise.video_url || "",
        imageUrl: exercise.image_url || "",
        trainingStyle: "normal",
      };
      onExercisesChange([...selectedExercises, newExercise]);
    }
  };

  const handleCreateExercise = async () => {
    if (!newExerciseName.trim()) {
      toast.error("Le nom de l'exercice est requis");
      return;
    }

    setIsCreatingExercise(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vous devez être connecté");
        return;
      }

      // V2 adapter: cocoricoach-club exercise_library uses { name, category, image_url, youtube_url, user_id, is_system }
      const { data, error } = await supabase
        .from("exercise_library")
        .insert({
          name: newExerciseName.trim(),
          category: newExerciseCategory,
          description: newExerciseDescription.trim() || null,
          image_url: newExerciseImageUrl.trim() || null,
          youtube_url: newExerciseVideoUrl.trim() || null,
          user_id: user.id,
          is_system: false,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Exercice créé et ajouté à la séance");
      
      // Add the newly created exercise directly to the workout
      if (data) {
        const createdExercise = data as unknown as {
          id: string;
          name: string;
          category: string | null;
          youtube_url: string | null;
          image_url: string | null;
        };
        const newWorkoutExercise: WorkoutExerciseData = {
          id: `${createdExercise.id}-${Date.now()}`,
          exerciseId: createdExercise.id,
          exerciseName: createdExercise.name,
          stationName: createdExercise.category ?? "",
          sets: 3,
          reps: 10,
          weightKg: 0,
          restSeconds: 60,
          videoUrl: createdExercise.youtube_url || "",
          imageUrl: createdExercise.image_url || "",
          trainingStyle: "normal",
        };
        onExercisesChange([...selectedExercises, newWorkoutExercise]);
        
        // Notify parent to refresh exercises list — adapt cocoricoach-club row to expected Exercise shape
        if (onExerciseCreated) {
          onExerciseCreated({
            id: createdExercise.id,
            exercise_name: createdExercise.name,
            station_name: createdExercise.category ?? "",
            description: null,
            image_url: createdExercise.image_url,
            video_url: createdExercise.youtube_url,
            coach_id: null,
            is_default: false,
          } as unknown as Exercise);
        }
      }
      
      // Reset form and search
      setNewExerciseName("");
      setNewExerciseDescription("");
      setNewExerciseImageUrl("");
      setNewExerciseVideoUrl("");
      setSearchTerm("");
      setShowNewExerciseDialog(false);
    } catch (error) {
      console.error("Error creating exercise:", error);
      toast.error("Erreur lors de la création de l'exercice");
    } finally {
      setIsCreatingExercise(false);
    }
  };

  const handleToggleFavorite = async (exerciseId: string) => {
    if (!userId) {
      toast.error("Vous devez être connecté pour ajouter des favoris");
      return;
    }
    await toggleFavorite(exerciseId);
    toast.success(favorites.has(exerciseId) ? "Retiré des favoris" : "Ajouté aux favoris");
  };

  const updateExercise = (id: string, field: keyof WorkoutExerciseData, value: number | string) => {
    onExercisesChange(
      selectedExercises.map(ex => 
        ex.id === id ? { ...ex, [field]: value } : ex
      )
    );
  };

  const removeExercise = (id: string) => {
    onExercisesChange(selectedExercises.filter(e => e.id !== id));
  };

  const totalTonnage = selectedExercises.reduce((sum, ex) => {
    return sum + (ex.sets * ex.reps * ex.weightKg);
  }, 0);

  const activeExercise = activeId 
    ? selectedExercises.find(e => e.id === activeId) 
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-base font-semibold">
          <Dumbbell className="h-5 w-5 text-primary" />
          Exercices de la séance
        </Label>
        {totalTonnage > 0 && (
          <Badge variant="default" className="bg-primary">
            Tonnage total: {totalTonnage.toLocaleString()} kg
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Exercise Library Panel */}
        <div className="border border-border rounded-lg p-3 bg-card">
          <div className="space-y-3">
            {/* Search bar */}
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un exercice..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 bg-background flex-1"
              />
              <Dialog open={showNewExerciseDialog} onOpenChange={setShowNewExerciseDialog}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="h-8">
                    <Plus className="h-4 w-4 mr-1" />
                    Créer
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card max-w-md">
                  <DialogHeader>
                    <DialogTitle>Créer un nouvel exercice</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nom de l'exercice *</Label>
                      <Input
                        value={newExerciseName}
                        onChange={(e) => setNewExerciseName(e.target.value)}
                        placeholder="Ex: Bulgarian Split Squat"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Catégorie</Label>
                      <Select value={newExerciseCategory} onValueChange={setNewExerciseCategory}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EXERCISE_CATEGORIES.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={newExerciseDescription}
                        onChange={(e) => setNewExerciseDescription(e.target.value)}
                        placeholder="Description de l'exercice..."
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        URL de l'illustration
                      </Label>
                      <Input
                        value={newExerciseImageUrl}
                        onChange={(e) => setNewExerciseImageUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Video className="h-4 w-4" />
                        URL de la vidéo (YouTube)
                      </Label>
                      <Input
                        value={newExerciseVideoUrl}
                        onChange={(e) => setNewExerciseVideoUrl(e.target.value)}
                        placeholder="https://youtube.com/..."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowNewExerciseDialog(false)}
                    >
                      Annuler
                    </Button>
                    <Button 
                      type="button" 
                      onClick={handleCreateExercise}
                      disabled={isCreatingExercise || !newExerciseName.trim()}
                    >
                      {isCreatingExercise ? "Création..." : "Créer l'exercice"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            
            {/* Advanced filters */}
            <ExerciseFilters
              filters={filters}
              onFiltersChange={setFilters}
              favorites={favorites}
              compact={true}
              showCategoryFilter={true}
              categories={categories}
            />

            <ScrollArea className="h-[300px]">
              <div className="space-y-1 pr-2">
                {filteredExercises.map(exercise => (
                  <LibraryExerciseItem
                    key={exercise.id}
                    exercise={exercise}
                    isSelected={selectedExercises.some(e => e.exerciseId === exercise.id)}
                    isFavorite={favorites.has(exercise.id)}
                    onAdd={() => addExercise(exercise)}
                    onToggleFavorite={() => handleToggleFavorite(exercise.id)}
                  />
                ))}
                {filteredExercises.length === 0 && searchTerm.trim() && (
                  <div className="text-center py-6 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Aucun exercice trouvé pour "{searchTerm}"
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewExerciseName(searchTerm.trim());
                        setShowNewExerciseDialog(true);
                      }}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Créer "{searchTerm.trim()}"
                    </Button>
                  </div>
                )}
                {filteredExercises.length === 0 && !searchTerm.trim() && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Aucun exercice avec ces filtres
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Selected Exercises Panel - Sortable */}
        <div className="border border-border rounded-lg p-3 bg-card min-h-[400px]">
          <p className="text-sm text-muted-foreground mb-3">
            {selectedExercises.length === 0 
              ? "Cliquez sur les exercices à gauche pour les ajouter" 
              : `${selectedExercises.length} exercice(s) • Glissez pour réorganiser`}
          </p>
          
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={selectedExercises.map(e => e.id)}
              strategy={verticalListSortingStrategy}
            >
              <ScrollArea className="h-[350px]">
                <div className="space-y-2 pr-2">
                  {selectedExercises.map((exercise, index) => (
                    <SortableExerciseItem
                      key={exercise.id}
                      exercise={exercise}
                      index={index}
                      onUpdate={updateExercise}
                      onRemove={removeExercise}
                      showRestTime={showRestTime}
                    />
                  ))}
                </div>
              </ScrollArea>
            </SortableContext>

            <DragOverlay>
              {activeExercise && (
                <div className="p-3 bg-card rounded-lg border-2 border-primary shadow-xl">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{activeExercise.exerciseName}</span>
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </div>
  );
};
