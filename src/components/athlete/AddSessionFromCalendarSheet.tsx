import { useState, useEffect, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TimeInput } from "@/components/ui/time-input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  Save,
  Search,
  Dumbbell,
  Star,
  Calendar,
  Link as LinkIcon,
  ArrowUp,
  ArrowDown,
  BookOpen,
  Info,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExerciseCardIcon } from "./ExerciseCardIcon";
import { ExerciseVisual } from "./ExerciseVisual";
import { getTrainingStyleConfig } from "@/lib/trainingStyles";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AddTrainingBlockButton,
  getBlockTypeConfig,
  TrainingBlockType,
  TrainingBlockWrapper,
} from "./TrainingBlockSection";
import { TrainingVariablesManager, DEFAULT_STRENGTH_VISIBLE, DEFAULT_CARDIO_VISIBLE, DEFAULT_RUNNING_VISIBLE } from "./TrainingVariablesManager";
import { TrainingMethodButtons, LinkedMethod, ConfigMethod, BlockType } from "./TrainingMethodButtons";
import { MethodConfigSlots, MethodConfigType, EmomConfig } from "./MethodConfigSlots";
import { DraggableContent } from "./DraggableContent";
import { ExerciseFocusPanel } from "./ExerciseFocusPanel";
import { ExerciseDescriptionCard, ExerciseDescriptionData } from "./ExerciseDescriptionCard";
import { LinkedMethodSlots, LinkedMethodType as LinkedMethodSlotsType } from "./LinkedMethodSlots";
import { WeightliftingPositionSelector } from "./WeightliftingPositionSelector";
import { SetData } from "@/lib/variableSetsTypes";

// ExerciseType is imported below with the helper functions

interface Exercise {
  id: string;
  exercise_name: string;
  station_name: string;
  video_url: string | null;
  image_url?: string | null;
  muscles?: string[] | null;
  equipment?: string[] | null;
  general_description?: string | null;
  exercise_type?: string; // From DB, cast to ExerciseType when used
  positioning_criteria?: any;
  execution_criteria?: any;
  safety_prevention?: any;
}

interface ProgramExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: string;
  percentage?: number;
  tempo?: string;
  rpe?: number;
  rir?: number;
  restSeconds: number;
  notes?: string;
  trainingStyle: string;
  groupId?: string;
  blockId?: string;
  dropSetSeries?: any[];
  useVariableSeries?: boolean;
  // Load in kg - for exercises with explicit weight
  load?: number;
  // Variable sets for per-set customization
  variableSets?: SetData[];
  durationSeconds?: number;
  calories?: number;
  watts?: number;
  distanceMeters?: number;
  paceSecondsPerKm?: number;
  runDistanceMeters?: number;
  runDurationSeconds?: number;
  visibleVariables?: string[];
  startingPosition?: string;
  // CrossFit method specific parameters
  timeCap?: number; // In minutes for AMRAP, For Time
  totalMinutes?: number; // Total duration for EMOM
  repsPerRound?: number; // For circuit methods
  tabataConfig?: {
    workSeconds: number;
    restSeconds: number;
    rounds: number;
  };
  emomConfig?: EmomConfig;
  deathByConfig?: {
    startReps: number;
    incrementReps: number;
  };
  // All exercises in the method block (for CrossFit methods with multiple exercises)
  methodExercises?: Array<{
    exerciseId: string;
    exerciseName: string;
    reps?: string;
    percentage?: number;
    load?: number;
    tempo?: string;
    rpe?: number;
  }>;
}

interface TrainingBlockData {
  id: string;
  type: TrainingBlockType;
  name: string;
  isOpen: boolean;
}

interface UnifiedOrderItem {
  type: "exercise" | "group" | "training-block";
  id: string;
}

interface SessionData {
  exercises: ProgramExercise[];
  blocks: TrainingBlockData[];
  unifiedOrder: UnifiedOrderItem[];
}

interface AppliedProgram {
  id: string;
  program_name: string;
  program_category: string | null;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  total_workouts?: number;
}

interface AddSessionFromCalendarSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  athleteId: string;
  selectedDate: Date;
  program?: AppliedProgram; // Made optional - selection at save time
  onSessionCreated: () => void;
}

// Helper functions - import centralized type detection
import { 
  ExerciseType, 
  inferExerciseTypeFromName,
  getDefaultVisibleVariables 
} from "@/lib/exerciseTypes";

// Get exercise type from DB field or infer from name
const getExerciseType = (exerciseName: string, stationName?: string, dbType?: string): ExerciseType => {
  // Use DB type if valid
  if (dbType) {
    const validTypes: ExerciseType[] = ['strength', 'bodyweight', 'cardio_machine', 'cardio_locomotion', 'skill'];
    if (validTypes.includes(dbType as ExerciseType)) {
      return dbType as ExerciseType;
    }
  }
  // Fallback to inference
  return inferExerciseTypeFromName(exerciseName, stationName);
};

const getExerciseCategory = (exerciseId: string, exercises: Exercise[]): string => {
  const exercise = exercises.find(e => e.id === exerciseId);
  return exercise?.station_name || "Musculation";
};

const getExerciseImageUrl = (exerciseId: string, exercises: Exercise[]): string | null | undefined => {
  const exercise = exercises.find(e => e.id === exerciseId);
  return exercise?.image_url;
};

// Linked method types
type LinkedMethodType = "superset" | "biset" | "triset" | "giant_set" | "bulgarian" | "combine_haltero";

// Get method color configuration
const getMethodColors = (method: string) => {
  switch (method) {
    case "superset": 
      return {
        border: "border-l-blue-500",
        bg: "bg-blue-500/10",
        headerBg: "bg-gradient-to-r from-blue-500 to-blue-600",
        headerText: "text-white",
        badge: "bg-blue-500 text-white",
        icon: "text-blue-500"
      };
    case "biset": 
      return {
        border: "border-l-cyan-600",
        bg: "bg-cyan-600/10",
        headerBg: "bg-gradient-to-r from-cyan-600 to-cyan-700",
        headerText: "text-white",
        badge: "bg-cyan-600 text-white",
        icon: "text-cyan-600"
      };
    case "triset": 
      return {
        border: "border-l-purple-500",
        bg: "bg-purple-500/10",
        headerBg: "bg-gradient-to-r from-purple-500 to-purple-600",
        headerText: "text-white",
        badge: "bg-purple-500 text-white",
        icon: "text-purple-500"
      };
    case "giant_set": 
      return {
        border: "border-l-pink-500",
        bg: "bg-pink-500/10",
        headerBg: "bg-gradient-to-r from-pink-500 to-pink-600",
        headerText: "text-white",
        badge: "bg-pink-500 text-white",
        icon: "text-pink-500"
      };
    case "bulgarian": 
      return {
        border: "border-l-fuchsia-500",
        bg: "bg-fuchsia-500/10",
        headerBg: "bg-gradient-to-r from-fuchsia-500 to-fuchsia-600",
        headerText: "text-white",
        badge: "bg-fuchsia-500 text-white",
        icon: "text-fuchsia-500"
      };
    default: 
      return {
        border: "border-l-gray-500",
        bg: "bg-gray-500/5",
        headerBg: "bg-gray-500",
        headerText: "text-white",
        badge: "bg-gray-500 text-white",
        icon: "text-gray-500"
      };
  }
};

// Get required slots for method (minimum required)
const getRequiredSlots = (method: LinkedMethodType): number => {
  switch (method) {
    case "triset": return 3;
    case "giant_set": return 4; // min 4, but can expand
    case "combine_haltero": return 2; // min 2, dynamic expansion
    default: return 2;
  }
};

// Check if method is dynamic (can expand beyond minimum)
const isDynamicMethod = (method: LinkedMethodType): boolean => {
  return method === "giant_set" || method === "combine_haltero";
};

// Get method label
const getMethodLabel = (method: string): string => {
  switch (method) {
    case "superset": return "Superset";
    case "biset": return "Biset";
    case "triset": return "Triset";
    case "giant_set": return "Giant Set";
    case "bulgarian": return "Méthode Bulgare";
    case "combine_haltero": return "Combiné Haltéro";
    default: return "Méthode";
  }
};

export const AddSessionFromCalendarSheet = ({
  open,
  onOpenChange,
  athleteId,
  selectedDate,
  program,
  onSessionCreated,
}: AddSessionFromCalendarSheetProps) => {
  // State
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessionData, setSessionData] = useState<SessionData>({
    exercises: [],
    blocks: [],
    unifiedOrder: [],
  });
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [linkedMethodBuild, setLinkedMethodBuild] = useState<{
    method: LinkedMethodType;
    blockId?: string;
    methodRestSeconds?: number;
    slottedExercises: { id: string; exerciseId: string; exerciseName: string; slotIndex: number; params?: any }[];
  } | null>(null);
  
  // State for config method building (drop_set, rest_pause, pyramids, AMRAP, EMOM, etc.)
  const [configMethodBuild, setConfigMethodBuild] = useState<{
    method: ConfigMethod;
    blockId?: string;
    droppedExercise: { exerciseId: string; exerciseName: string } | null;
    droppedPhaseExercises: Record<number, { exerciseId: string; exerciseName: string } | null>;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    selectedCategory: "all",
  });
  const [saving, setSaving] = useState(false);
  const [draggedItem, setDraggedItem] = useState<any>(null);
  const [exerciseFavorites] = useState<Set<string>>(new Set());
  
  // Program selection state for save
  const [activePrograms, setActivePrograms] = useState<AppliedProgram[]>([]);
  const [selectProgramDialogOpen, setSelectProgramDialogOpen] = useState(false);
  const [selectedProgramForSave, setSelectedProgramForSave] = useState<AppliedProgram | null>(null);

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  // Fetch active programs for this athlete
  useEffect(() => {
    const fetchActivePrograms = async () => {
      const { data, error } = await supabase
        .from("applied_programs")
        .select("id, program_name, program_category, start_date, end_date, is_active, total_workouts")
        .eq("athlete_id", athleteId)
        .eq("is_active", true)
        .order("start_date", { ascending: false });

      if (!error && data) {
        setActivePrograms(data);
        // If a program was passed as prop, pre-select it
        if (program) {
          setSelectedProgramForSave(program);
        }
      }
    };
    
    if (open) {
      fetchActivePrograms();
    }
  }, [open, athleteId, program]);

  // Fetch exercises
  useEffect(() => {
    const fetchExercises = async () => {
      const { data } = await supabase
        .from("exercise_library")
        .select("*")
        .order("station_name");
      if (data) setExercises(data);
    };
    fetchExercises();
  }, []);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setSessionData({ exercises: [], blocks: [], unifiedOrder: [] });
      setActiveBlockId(null);
      setLinkedMethodBuild(null);
      setConfigMethodBuild(null);
      setSearchTerm("");
    }
  }, [open]);

  // Filter exercises
  const filteredExercises = useMemo(() => {
    let filtered = exercises;
    if (filters.selectedCategory !== "all") {
      filtered = filtered.filter(ex => ex.station_name === filters.selectedCategory);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(ex => 
        ex.exercise_name.toLowerCase().includes(term) ||
        ex.station_name.toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [exercises, filters.selectedCategory, searchTerm]);

  // Categories for filter
  const categories = useMemo(() => {
    const cats = new Set(exercises.map(e => e.station_name));
    return Array.from(cats).sort();
  }, [exercises]);

  // Add training block
  const addTrainingBlock = (type: TrainingBlockType) => {
    const config = getBlockTypeConfig(type);
    const newBlock: TrainingBlockData = {
      id: crypto.randomUUID(),
      type,
      name: config.label,
      isOpen: true,
    };
    
    setSessionData(prev => ({
      ...prev,
      blocks: [...prev.blocks, newBlock],
      unifiedOrder: [...prev.unifiedOrder, { type: "training-block", id: newBlock.id }],
    }));
    setActiveBlockId(newBlock.id);
  };

  // Add exercise to session
  const addExerciseToSession = (exercise: Exercise, targetBlockId?: string) => {
    const blockId = targetBlockId || activeBlockId;
    
    if (sessionData.blocks.length === 0 || !blockId) {
      toast.error("Créez d'abord un bloc d'entraînement");
      return;
    }
    
    const exerciseType = getExerciseType(exercise.exercise_name, exercise.station_name, exercise.exercise_type);
    const defaultVars = getDefaultVisibleVariables(exerciseType);
    
    const newExercise: ProgramExercise = {
      id: crypto.randomUUID(),
      exerciseId: exercise.id,
      exerciseName: exercise.exercise_name,
      sets: 3,
      reps: "10",
      restSeconds: 90,
      trainingStyle: "normal",
      blockId,
      visibleVariables: defaultVars,
    };

    setSessionData(prev => ({
      ...prev,
      exercises: [...prev.exercises, newExercise],
    }));
  };

  // Update exercise
  const updateExercise = (id: string, field: keyof ProgramExercise, value: any) => {
    setSessionData(prev => {
      // Find the target exercise to check if it belongs to a group
      const targetExercise = prev.exercises.find(ex => ex.id === id);
      const targetGroupId = targetExercise?.groupId;
      
      // Check if we're updating visibleVariables and the exercise is in a linked method group
      const isLinkedMethodGroup = targetGroupId && 
        ['superset', 'biset', 'triset', 'giant_set', 'bulgarian', 'combine_haltero'].includes(targetExercise?.trainingStyle || '');
      
      // If adding variables (array is longer than before), sync to all exercises in the group
      if (field === 'visibleVariables' && isLinkedMethodGroup && Array.isArray(value)) {
        return {
          ...prev,
          exercises: prev.exercises.map(ex => {
            if (ex.id === id) {
              // Update the triggering exercise
              return { ...ex, [field]: value };
            }
            // Sync to other exercises in the same group (for ADDING only)
            if (ex.groupId === targetGroupId) {
              const currentVars = ex.visibleVariables || [];
              const newVars = value as string[];
              // Find newly added variables (not present before)
              const addedVars = newVars.filter(v => !currentVars.includes(v));
              if (addedVars.length > 0) {
                // Add the new variables to this exercise too
                const mergedVars = [...currentVars, ...addedVars];
                return { ...ex, visibleVariables: mergedVars };
              }
            }
            return ex;
          }),
        };
      }
      
      return {
        ...prev,
        exercises: prev.exercises.map(ex =>
          ex.id === id ? { ...ex, [field]: value } : ex
        ),
      };
    });
  };

  // Remove exercise
  const removeExercise = (id: string) => {
    setSessionData(prev => ({
      ...prev,
      exercises: prev.exercises.filter(ex => ex.id !== id),
      unifiedOrder: prev.unifiedOrder.filter(item => item.id !== id),
    }));
  };

  // Remove block
  const removeBlock = (blockId: string) => {
    setSessionData(prev => ({
      ...prev,
      blocks: prev.blocks.filter(b => b.id !== blockId),
      exercises: prev.exercises.filter(ex => ex.blockId !== blockId),
      unifiedOrder: prev.unifiedOrder.filter(item => item.id !== blockId),
    }));
    if (activeBlockId === blockId) {
      setActiveBlockId(sessionData.blocks.find(b => b.id !== blockId)?.id || null);
    }
  };

  // Toggle block open/closed
  const toggleBlock = (blockId: string) => {
    setSessionData(prev => ({
      ...prev,
      blocks: prev.blocks.map(b =>
        b.id === blockId ? { ...b, isOpen: !b.isOpen } : b
      ),
    }));
  };

  // Change block type
  const changeBlockType = (blockId: string, newType: TrainingBlockType) => {
    const config = getBlockTypeConfig(newType);
    setSessionData(prev => ({
      ...prev,
      blocks: prev.blocks.map(b =>
        b.id === blockId ? { ...b, type: newType, name: config.label } : b
      ),
    }));
  };

  // Start linked method (superset, triset, etc.)
  const startLinkedMethod = (method: LinkedMethodType, blockId?: string) => {
    const targetBlockId = blockId || activeBlockId;
    if (!targetBlockId) {
      toast.error("Sélectionnez d'abord un bloc d'entraînement");
      return;
    }

    const requiredSlots = getRequiredSlots(method);
    const blockExercises = sessionData.exercises.filter(
      ex => ex.blockId === targetBlockId && ex.trainingStyle === "normal" && !ex.groupId
    );
    
    const exercisesToSlot = blockExercises.slice(-requiredSlots);
    const groupId = crypto.randomUUID();
    
    if (exercisesToSlot.length >= 2) {
      // Auto-convert existing exercises
      setSessionData(prev => ({
        ...prev,
        exercises: prev.exercises.map(ex => {
          const isSlotted = exercisesToSlot.some(s => s.id === ex.id);
          if (isSlotted) {
            return { ...ex, groupId, trainingStyle: method };
          }
          return ex;
        }),
        unifiedOrder: [
          ...prev.unifiedOrder.filter(item => !exercisesToSlot.some(ex => ex.id === item.id)),
          { type: "group", id: groupId },
        ],
      }));
      
      toast.success(`${getMethodLabel(method)} créé avec ${exercisesToSlot.length} exercices`);
    } else {
      // Start building mode
      setLinkedMethodBuild({
        method,
        blockId: targetBlockId,
        slottedExercises: exercisesToSlot.map((ex, idx) => ({
          id: ex.id,
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          slotIndex: idx,
          params: { sets: ex.sets, reps: ex.reps, restSeconds: ex.restSeconds },
        })),
      });
    }
  };

  // Confirm linked method build
  // CRITICAL: This function MUST preserve EXACTLY the state visible in the UI
  const confirmLinkedMethodBuild = () => {
    if (!linkedMethodBuild || linkedMethodBuild.slottedExercises.length < 2) {
      toast.error("Ajoutez au moins 2 exercices");
      return;
    }

    const groupId = crypto.randomUUID();
    // Use method-level rest if defined, otherwise fall back to default
    const methodRest = linkedMethodBuild.methodRestSeconds ?? 90;
    
    // CRITICAL: Preserve ALL variables exactly as configured - no transformations
    const newExercises: ProgramExercise[] = linkedMethodBuild.slottedExercises.map(slot => {
      const params = slot.params || {};
      
      return {
        id: slot.id,
        exerciseId: slot.exerciseId,
        exerciseName: slot.exerciseName,
        // Core training variables - preserve exactly as configured
        sets: params.sets ?? 3,
        reps: params.reps ?? "10",
        percentage: params.percentage,
        tempo: params.tempo,
        rpe: params.rpe,
        load: params.load, // Charge in kg - CRITICAL
        restSeconds: methodRest, // Use method-level rest
        trainingStyle: linkedMethodBuild.method,
        groupId,
        blockId: linkedMethodBuild.blockId,
        // Variable sets support - CRITICAL: preserve per-set data
        variableSets: params.variableSets,
        useVariableSeries: params.useVariableSets,
        // Visible variables - CRITICAL: preserve user's column choices
        visibleVariables: params.visibleParams || [...DEFAULT_STRENGTH_VISIBLE],
      };
    });

    setSessionData(prev => ({
      ...prev,
      exercises: [...prev.exercises, ...newExercises],
      unifiedOrder: [...prev.unifiedOrder, { type: "group", id: groupId }],
    }));

    setLinkedMethodBuild(null);
    toast.success(`${getMethodLabel(linkedMethodBuild.method)} créé`);
  };

  // Cancel linked method build
  const cancelLinkedMethodBuild = () => {
    setLinkedMethodBuild(null);
  };

  // Add exercise to linked method build
  const addExerciseToLinkedMethod = (exercise: Exercise) => {
    if (!linkedMethodBuild) return;

    const maxSlots = isDynamicMethod(linkedMethodBuild.method) ? 10 : getRequiredSlots(linkedMethodBuild.method);
    
    if (linkedMethodBuild.slottedExercises.length >= maxSlots) {
      toast.error(`Maximum ${maxSlots} exercices pour ${getMethodLabel(linkedMethodBuild.method)}`);
      return;
    }

    setLinkedMethodBuild(prev => prev ? ({
      ...prev,
      slottedExercises: [
        ...prev.slottedExercises,
        {
          id: crypto.randomUUID(),
          exerciseId: exercise.id,
          exerciseName: exercise.exercise_name,
          slotIndex: prev.slottedExercises.length,
          params: { sets: 3, reps: "10", restSeconds: 90 },
        },
      ],
    }) : null);
  };

  // Remove exercise from linked method build
  const removeExerciseFromLinkedMethod = (slotIndex: number) => {
    setLinkedMethodBuild(prev => prev ? ({
      ...prev,
      slottedExercises: prev.slottedExercises
        .filter((_, idx) => idx !== slotIndex)
        .map((slot, idx) => ({ ...slot, slotIndex: idx })),
    }) : null);
  };

  // Unlink a method group
  const unlinkGroup = (groupId: string) => {
    setSessionData(prev => ({
      ...prev,
      exercises: prev.exercises.map(ex =>
        ex.groupId === groupId
          ? { ...ex, groupId: undefined, trainingStyle: "normal" }
          : ex
      ),
      unifiedOrder: prev.unifiedOrder.filter(item => item.id !== groupId),
    }));
    toast.success("Exercices déliés");
  };

  // CrossFit methods that use phase exercises instead of a single exercise
  const CROSSFIT_METHODS = ['amrap', 'for_time', 'circuit', 'emom', 'tabata', 'death_by'];

  // Start config method build (drop_set, rest_pause, pyramids, AMRAP, EMOM, etc.)
  const startConfigMethodBuild = (method: ConfigMethod, blockId?: string) => {
    const targetBlockId = blockId || activeBlockId;
    if (!targetBlockId) {
      toast.error("Sélectionnez d'abord un bloc d'entraînement");
      return;
    }

    // Find existing normal exercises in this block
    const blockExercises = sessionData.exercises.filter(
      ex => ex.blockId === targetBlockId && ex.trainingStyle === "normal" && !ex.groupId
    );
    
    const isCrossFitMethod = CROSSFIT_METHODS.includes(method);
    
    let droppedExercise: { exerciseId: string; exerciseName: string } | null = null;
    let droppedPhaseExercises: Record<number, { exerciseId: string; exerciseName: string } | null> = {};
    
    if (blockExercises.length > 0) {
      const lastExercise = blockExercises[blockExercises.length - 1];
      
      if (isCrossFitMethod) {
        // For CrossFit methods, add to first phase slot
        droppedPhaseExercises[0] = {
          exerciseId: lastExercise.exerciseId,
          exerciseName: lastExercise.exerciseName,
        };
      } else {
        // For other methods (drop_set, pyramid, etc.), set as dropped exercise
        droppedExercise = {
          exerciseId: lastExercise.exerciseId,
          exerciseName: lastExercise.exerciseName,
        };
      }
      
      // Remove this exercise (it will be re-added as part of the method)
      setSessionData(prev => ({
        ...prev,
        exercises: prev.exercises.filter(ex => ex.id !== lastExercise.id),
      }));
    }
    
    setConfigMethodBuild({
      method,
      blockId: targetBlockId,
      droppedExercise,
      droppedPhaseExercises,
    });
  };

  // Cancel config method build
  const cancelConfigMethodBuild = () => {
    setConfigMethodBuild(null);
  };

  // Remove exercise from config method slot
  const removeConfigMethodExercise = () => {
    if (!configMethodBuild) return;
    setConfigMethodBuild({
      ...configMethodBuild,
      droppedExercise: null,
    });
  };

  // Remove exercise from a specific phase slot (CrossFit methods)
  const removeConfigMethodPhaseExercise = (phaseIndex: number) => {
    if (!configMethodBuild) return;
    const newPhaseExercises = { ...configMethodBuild.droppedPhaseExercises };
    delete newPhaseExercises[phaseIndex];
    setConfigMethodBuild({
      ...configMethodBuild,
      droppedPhaseExercises: newPhaseExercises,
    });
  };

  // Apply exercises to all intervals (EMOM)
  const applyExercisesToAllIntervals = (
    exercises: Record<number, { exerciseId: string; exerciseName: string } | null>,
    seriesData: any[],
    exercisesPerInterval: number
  ) => {
    if (!configMethodBuild) return;
    setConfigMethodBuild({
      ...configMethodBuild,
      droppedPhaseExercises: exercises,
    });
    toast.success(`Exercices copiés vers tous les intervalles !`);
  };

  // Clear all phase exercises
  const clearAllPhaseExercises = () => {
    if (!configMethodBuild) return;
    setConfigMethodBuild({
      ...configMethodBuild,
      droppedPhaseExercises: {},
    });
  };

  // Confirm and add the config method exercise
  // CRITICAL: This function MUST preserve EXACTLY the state visible in the UI
  // No transformations, no default value injections, no recalculations
  const confirmConfigMethodBuild = (config: { 
    series: any[]; 
    tempo?: string; 
    targetRpe?: number;
    timeCap?: number;
    tabataConfig?: any;
    totalMinutes?: number;
    repsPerRound?: number;
    emomConfig?: EmomConfig;
    deathByConfig?: any;
    visibleVariables?: string[];
  }) => {
    if (!configMethodBuild) return;
    
    const { method, blockId, droppedExercise, droppedPhaseExercises } = configMethodBuild;
    const isCrossFitMethod = CROSSFIT_METHODS.includes(method);
    
    // For CrossFit methods, use the first phase exercise if no main exercise
    let exerciseToUse: { exerciseId: string; exerciseName: string } | null = droppedExercise;
    
    if (isCrossFitMethod && !exerciseToUse) {
      const phaseExerciseEntries = Object.entries(droppedPhaseExercises).filter(([_, e]) => e !== null);
      if (phaseExerciseEntries.length === 0) {
        toast.error("Ajoutez au moins un exercice");
        return;
      }
      exerciseToUse = phaseExerciseEntries[0][1];
    }
    
    if (!exerciseToUse) {
      toast.error("Ajoutez un exercice à la méthode");
      return;
    }
    
    const exercise = exercises.find(e => e.id === exerciseToUse!.exerciseId);
    if (!exercise) return;
    
    // Build methodExercises array for CrossFit methods - PRESERVE ALL VARIABLES
    const methodExercises: ProgramExercise['methodExercises'] = isCrossFitMethod
      ? Object.entries(droppedPhaseExercises)
          .filter(([_, ex]) => ex !== null)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([idx, ex], i) => ({
            exerciseId: ex!.exerciseId,
            exerciseName: ex!.exerciseName,
            // CRITICAL: Preserve ALL variables from the series exactly as configured
            reps: config.series[i]?.reps || config.series[0]?.reps || "10",
            percentage: config.series[i]?.percentage,
            load: config.series[i]?.load,
            tempo: config.series[i]?.tempo,
            rpe: config.series[i]?.rpe,
          }))
      : undefined;
    
    // CRITICAL: Extract individual variables from the first series for exercise-level fields
    const firstSeries = config.series[0];
    
    // Create the exercise with the method configuration
    // CRITICAL: Preserve ALL variables exactly as configured - NO TRANSFORMATIONS
    const newExercise: ProgramExercise = {
      id: crypto.randomUUID(),
      exerciseId: exercise.id,
      exerciseName: exercise.exercise_name,
      // For CrossFit methods, sets/reps are not relevant - use method-specific fields
      sets: isCrossFitMethod ? 0 : (config.series.length || 3),
      reps: isCrossFitMethod ? "" : (config.series[0]?.reps || "10"),
      restSeconds: isCrossFitMethod ? 0 : 90,
      trainingStyle: method,
      blockId,
      // CRITICAL: Pass series with ALL variables intact (load, tempo, rpe, percentage, pauseSeconds, etc.)
      dropSetSeries: config.series,
      // CrossFit specific parameters - PRESERVED
      timeCap: config.timeCap,
      totalMinutes: config.totalMinutes,
      repsPerRound: config.repsPerRound,
      tabataConfig: config.tabataConfig,
      emomConfig: config.emomConfig,
      deathByConfig: config.deathByConfig,
      methodExercises,
      // CRITICAL: Preserve which variables are visible in the UI
      visibleVariables: isCrossFitMethod ? [] : (config.visibleVariables || [...DEFAULT_STRENGTH_VISIBLE]),
      // CRITICAL: Also extract first series values for exercise-level display
      tempo: config.tempo || firstSeries?.tempo,
      rpe: config.targetRpe || firstSeries?.rpe,
      load: firstSeries?.load,
      percentage: firstSeries?.percentage,
    };

    setSessionData(prev => ({
      ...prev,
      exercises: [...prev.exercises, newExercise],
    }));

    setConfigMethodBuild(null);
    toast.success(`${getMethodLabel(method) || method} configuré`);
  };

  // Add exercise to config method (when building)
  const addExerciseToConfigMethod = (exercise: Exercise) => {
    if (!configMethodBuild) return;
    
    const isCrossFitMethod = CROSSFIT_METHODS.includes(configMethodBuild.method);
    
    if (isCrossFitMethod) {
      // Add to the next available phase slot
      const currentSlots = Object.keys(configMethodBuild.droppedPhaseExercises).length;
      setConfigMethodBuild({
        ...configMethodBuild,
        droppedPhaseExercises: {
          ...configMethodBuild.droppedPhaseExercises,
          [currentSlots]: {
            exerciseId: exercise.id,
            exerciseName: exercise.exercise_name,
          },
        },
      });
    } else {
      // Set as the main exercise
      setConfigMethodBuild({
        ...configMethodBuild,
        droppedExercise: {
          exerciseId: exercise.id,
          exerciseName: exercise.exercise_name,
        },
      });
    }
  };

  // Get exercises for a block
  const getBlockExercises = (blockId: string) => {
    return sessionData.exercises.filter(ex => ex.blockId === blockId);
  };

  // Get grouped exercises
  const getGroupedExercises = (groupId: string) => {
    return sessionData.exercises.filter(ex => ex.groupId === groupId);
  };

  // Get block order within session
  const getBlockOrderItems = () => {
    return sessionData.blocks.map(b => `training-block-${b.id}`);
  };

  // Reorder blocks
  const moveBlock = (blockId: string, direction: 'up' | 'down') => {
    setSessionData(prev => {
      const blockIdx = prev.blocks.findIndex(b => b.id === blockId);
      if (blockIdx === -1) return prev;
      
      const newIdx = direction === 'up' ? blockIdx - 1 : blockIdx + 1;
      if (newIdx < 0 || newIdx >= prev.blocks.length) return prev;
      
      const newBlocks = arrayMove(prev.blocks, blockIdx, newIdx);
      
      // Also update unified order
      const orderIdx = prev.unifiedOrder.findIndex(item => item.id === blockId);
      if (orderIdx !== -1) {
        const newOrderIdx = direction === 'up' ? orderIdx - 1 : orderIdx + 1;
        if (newOrderIdx >= 0 && newOrderIdx < prev.unifiedOrder.length) {
          return {
            ...prev,
            blocks: newBlocks,
            unifiedOrder: arrayMove(prev.unifiedOrder, orderIdx, newOrderIdx),
          };
        }
      }
      
      return { ...prev, blocks: newBlocks };
    });
  };

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeData = active.data.current as any;
    
    if (activeData?.type === "library") {
      setDraggedItem({ type: "library", exercise: activeData.exercise });
    } else if (activeData?.type === "training-block") {
      setDraggedItem({ type: "block", blockId: activeData.blockId });
    } else if (activeData?.type === "exercise") {
      setDraggedItem({ type: "exercise", exercise: activeData.exercise });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedItem(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current as any;
    const overData = over.data.current as any;

    // Library exercise dropped onto a block
    if (activeData?.type === "library" && overData?.blockId) {
      addExerciseToSession(activeData.exercise, overData.blockId);
    }
    
    // Block reordering
    if (activeData?.type === "training-block" && overData?.type === "training-block") {
      const activeIdx = sessionData.blocks.findIndex(b => b.id === activeData.blockId);
      const overIdx = sessionData.blocks.findIndex(b => b.id === overData.blockId);
      if (activeIdx !== -1 && overIdx !== -1 && activeIdx !== overIdx) {
        setSessionData(prev => ({
          ...prev,
          blocks: arrayMove(prev.blocks, activeIdx, overIdx),
        }));
      }
    }
  };

  // Handle save button click - may trigger program selection dialog
  const handleSaveClick = () => {
    if (sessionData.exercises.length === 0) {
      toast.error("Ajoutez au moins un exercice");
      return;
    }

    // If multiple active programs and none selected, show selection dialog
    if (activePrograms.length > 1 && !selectedProgramForSave) {
      setSelectProgramDialogOpen(true);
      return;
    }

    // If single program, auto-select it
    if (activePrograms.length === 1 && !selectedProgramForSave) {
      saveSessionToProgram(activePrograms[0]);
      return;
    }

    // If we have a selected program, save to it
    if (selectedProgramForSave) {
      saveSessionToProgram(selectedProgramForSave);
      return;
    }

    // No programs available
    toast.error("Aucun programme actif disponible");
  };

  // Handle program selection from dialog
  const handleProgramSelectedForSave = (selectedProgram: AppliedProgram) => {
    setSelectedProgramForSave(selectedProgram);
    setSelectProgramDialogOpen(false);
    saveSessionToProgram(selectedProgram);
  };

  // Save session to a specific program
  const saveSessionToProgram = async (targetProgram: AppliedProgram) => {
    setSaving(true);
    try {
      const sessionSnapshot = {
        exercises: sessionData.exercises,
        blocks: sessionData.blocks,
        unifiedOrder: sessionData.unifiedOrder,
      };

      const { error: workoutError } = await supabase
        .from("workouts")
        .insert([{
          athlete_id: athleteId,
          workout_date: format(selectedDate, "yyyy-MM-dd"),
          workout_type: sessionData.blocks[0]?.name || "Entraînement",
          program_id: targetProgram.id,
          session_data: sessionSnapshot as any,
          is_completed: false,
        }]);

      if (workoutError) throw workoutError;

      // Update applied_programs total_workouts count
      const { data: currentProgram } = await supabase
        .from("applied_programs")
        .select("total_workouts")
        .eq("id", targetProgram.id)
        .single();

      if (currentProgram) {
        await supabase
          .from("applied_programs")
          .update({ total_workouts: (currentProgram.total_workouts || 0) + 1 })
          .eq("id", targetProgram.id);
      }

      // Update training_programs structure if it's a custom program
      const { data: trainingProgram } = await supabase
        .from("training_programs")
        .select("*")
        .eq("name", targetProgram.program_name)
        .maybeSingle();

      if (trainingProgram && !trainingProgram.is_default) {
        const programStructure = Array.isArray(trainingProgram.program_structure) 
          ? trainingProgram.program_structure as any[]
          : [];

        // Find or create appropriate week
        let weekToUpdate = programStructure.find((week: any) => {
          return week.days?.some((day: any) => !day.exercises?.length);
        }) || programStructure[programStructure.length - 1];

        if (!weekToUpdate) {
          weekToUpdate = {
            id: crypto.randomUUID(),
            weekNumber: programStructure.length + 1,
            name: `Semaine ${programStructure.length + 1}`,
            isOpen: true,
            days: [],
          };
          programStructure.push(weekToUpdate);
        }

        const newDay = {
          id: crypto.randomUUID(),
          name: `Séance ${(weekToUpdate.days?.length || 0) + 1}`,
          exercises: sessionData.exercises,
          blocks: sessionData.blocks,
          unifiedOrder: sessionData.unifiedOrder,
        };

        weekToUpdate.days = [...(weekToUpdate.days || []), newDay];

        await supabase
          .from("training_programs")
          .update({ 
            program_structure: programStructure,
            updated_at: new Date().toISOString(),
          })
          .eq("id", trainingProgram.id);
      }

      // Notify athlete via chat when coach adds/modifies a session
      try {
        const sessionDateStr = format(selectedDate, "d MMMM yyyy", { locale: fr });
        await supabase.from("chat_messages").insert({
          athlete_id: athleteId,
          sender_type: "coach",
          message: `📝 Une nouvelle séance a été ajoutée à votre calendrier le ${sessionDateStr} dans le programme "${targetProgram.program_name}".`,
        });
      } catch (chatErr) {
        console.error("Error sending chat notification:", chatErr);
      }

      toast.success(`Séance ajoutée au programme "${targetProgram.program_name}"`);
      onSessionCreated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving session:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl p-0 flex flex-col">
        <SheetHeader className="p-4 border-b flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Nouvelle séance
          </SheetTitle>
          <SheetDescription>
            {format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })}
            {activePrograms.length > 1 
              ? " • Le programme sera sélectionné à l'enregistrement"
              : activePrograms.length === 1 
                ? ` • Programme: ${activePrograms[0].program_name}`
                : " • Aucun programme actif"
            }
          </SheetDescription>
        </SheetHeader>

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Session Builder */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">

                  {/* Training Blocks */}
                  {sessionData.blocks.length === 0 ? (
                    <Card className="border-2 border-dashed border-muted-foreground/30">
                      <CardContent className="p-6 text-center">
                        <Dumbbell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
                        <p className="text-sm font-medium text-muted-foreground mb-4">
                          Créez d'abord un bloc d'entraînement
                        </p>
                        <AddTrainingBlockButton onAddBlock={addTrainingBlock} variant="prominent" />
                      </CardContent>
                    </Card>
                  ) : (
                    <SortableContext items={getBlockOrderItems()} strategy={verticalListSortingStrategy}>
                      <div className="space-y-3">
                        {sessionData.blocks.map((block, blockIdx) => {
                          const blockExercises = getBlockExercises(block.id);
                          const config = getBlockTypeConfig(block.type);
                          const isActive = activeBlockId === block.id;
                          const Icon = config.icon;

                          return (
                            <SortableBlockWrapper
                              key={block.id}
                              block={block}
                              isActive={isActive}
                              config={config}
                              exerciseCount={blockExercises.length}
                              canMoveUp={blockIdx > 0}
                              canMoveDown={blockIdx < sessionData.blocks.length - 1}
                              onMoveUp={() => moveBlock(block.id, 'up')}
                              onMoveDown={() => moveBlock(block.id, 'down')}
                              onToggle={() => toggleBlock(block.id)}
                              onDelete={() => removeBlock(block.id)}
                              onActivate={() => setActiveBlockId(block.id)}
                              onChangeType={(type) => changeBlockType(block.id, type)}
                            >
                              {/* Method buttons - based on block type */}
                              <div className="p-2 bg-muted/30 border-b">
                                <TrainingMethodButtons
                                  onStartLinkedMethod={(method) => startLinkedMethod(method as LinkedMethodType, block.id)}
                                  onStartConfigMethod={(method) => startConfigMethodBuild(method, block.id)}
                                  isBuilding={!!linkedMethodBuild || !!configMethodBuild}
                                  blockType={block.type as BlockType}
                                />
                              </div>

                              {/* Config Method Slots - Show when building a config method inside this block */}
                              {configMethodBuild && configMethodBuild.blockId === block.id && (
                                <div className="p-2">
                                  <MethodConfigSlots
                                    method={configMethodBuild.method as MethodConfigType}
                                    dayId={block.id}
                                    droppedExercise={configMethodBuild.droppedExercise}
                                    droppedPhaseExercises={configMethodBuild.droppedPhaseExercises}
                                    onExerciseRemove={removeConfigMethodExercise}
                                    onPhaseExerciseRemove={removeConfigMethodPhaseExercise}
                                    onApplyToAllIntervals={applyExercisesToAllIntervals}
                                    onClearAllPhaseExercises={clearAllPhaseExercises}
                                    onConfirm={confirmConfigMethodBuild}
                                    onCancel={cancelConfigMethodBuild}
                                  />
                                </div>
                              )}

                              {/* Linked Method Slots - Show when building a linked method inside this block */}
                              {linkedMethodBuild && linkedMethodBuild.blockId === block.id && (
                                <div className="p-2">
                                  <LinkedMethodSlots
                                    method={linkedMethodBuild.method as LinkedMethodSlotsType}
                                    slottedExercises={linkedMethodBuild.slottedExercises}
                                    onRemoveFromSlot={removeExerciseFromLinkedMethod}
                                    onUpdateParams={(slotIndex, params) => {
                                      setLinkedMethodBuild(prev => {
                                        if (!prev) return null;
                                        return {
                                          ...prev,
                                          slottedExercises: prev.slottedExercises.map(e =>
                                            e.slotIndex === slotIndex
                                              ? { ...e, params: { ...e.params, ...params } }
                                              : e
                                          ),
                                        };
                                      });
                                    }}
                                    onConfirm={confirmLinkedMethodBuild}
                                    onCancel={cancelLinkedMethodBuild}
                                    dayId={block.id}
                                    methodRestSeconds={linkedMethodBuild.methodRestSeconds}
                                    onMethodRestChange={(seconds) => {
                                      setLinkedMethodBuild(prev => prev ? ({
                                        ...prev,
                                        methodRestSeconds: seconds,
                                      }) : null);
                                    }}
                                  />
                                </div>
                              )}

                              {/* Exercises in block */}
                              <div className="p-2 space-y-2">
                                {blockExercises.length === 0 && !(linkedMethodBuild && linkedMethodBuild.blockId === block.id) && (
                                  <DroppableBlockZone blockId={block.id} />
                                )}
                                {blockExercises.length > 0 && (
                                  <>
                                    {(() => {
                                      const seenGroups = new Set<string>();
                                      const items: React.ReactNode[] = [];

                                      blockExercises.forEach((exercise) => {
                                        // Check if it's a CrossFit method (not linked group)
                                        const isCrossFitMethod = CROSSFIT_METHODS.includes(exercise.trainingStyle);
                                        
                                        if (exercise.groupId) {
                                          if (!seenGroups.has(exercise.groupId)) {
                                            seenGroups.add(exercise.groupId);
                                            const groupExercises = getGroupedExercises(exercise.groupId);
                                            
                                            items.push(
                                              <LinkedBlockCard
                                                key={exercise.groupId}
                                                groupId={exercise.groupId}
                                                exercises={groupExercises}
                                                libraryExercises={exercises}
                                                trainingStyle={exercise.trainingStyle}
                                                onUpdateExercise={updateExercise}
                                                onRemoveExercise={removeExercise}
                                                onUnlink={() => unlinkGroup(exercise.groupId!)}
                                              />
                                            );
                                          }
                                        } else if (isCrossFitMethod) {
                                          // Render CrossFit method card instead of standard ExerciseCard
                                          items.push(
                                            <CrossFitMethodCard
                                              key={exercise.id}
                                              exercise={exercise}
                                              libraryExercises={exercises}
                                              onRemove={removeExercise}
                                            />
                                          );
                                        } else {
                                          items.push(
                                            <ExerciseCard
                                              key={exercise.id}
                                              exercise={exercise}
                                              libraryExercises={exercises}
                                              onUpdate={updateExercise}
                                              onRemove={removeExercise}
                                            />
                                          );
                                        }
                                      });

                                      return items;
                                    })()}

                                    <DroppableBlockZone blockId={block.id} />
                                  </>
                                )}
                              </div>
                            </SortableBlockWrapper>
                          );
                        })}

                        <AddTrainingBlockButton onAddBlock={addTrainingBlock} />
                      </div>
                    </SortableContext>
                  )}
                </div>
              </ScrollArea>

              {/* Save button */}
              <div className="p-4 border-t bg-background">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleSaveClick}
                  disabled={saving || sessionData.exercises.length === 0}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Enregistrement..." : "Enregistrer la séance"}
                </Button>
              </div>
            </div>

            {/* Right: Exercise Library */}
            <div className="w-72 border-l flex flex-col bg-muted/30">
              <div className="p-3 border-b space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Dumbbell className="h-4 w-4 text-primary" />
                  Bibliothèque
                </h3>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 h-8"
                  />
                </div>
                <Select
                  value={filters.selectedCategory}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, selectedCategory: value }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes catégories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {filteredExercises.map((exercise) => (
                    <DraggableLibraryExercise
                      key={exercise.id}
                      exercise={exercise}
                      onClickInsert={() => {
                        if (linkedMethodBuild) {
                          addExerciseToLinkedMethod(exercise);
                        } else if (configMethodBuild) {
                          addExerciseToConfigMethod(exercise);
                        } else if (activeBlockId) {
                          addExerciseToSession(exercise);
                        } else {
                          toast.error("Sélectionnez un bloc d'entraînement");
                        }
                      }}
                      isFavorite={exerciseFavorites.has(exercise.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DragOverlay>
            {draggedItem?.type === "library" && draggedItem.exercise && (
              <div className="flex items-center gap-2 p-2 rounded-md border border-primary bg-background shadow-lg">
                <Dumbbell className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{draggedItem.exercise.exercise_name}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {/* Program Selection Dialog for Save */}
        <Dialog open={selectProgramDialogOpen} onOpenChange={setSelectProgramDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Choisir le programme
              </DialogTitle>
            </DialogHeader>

            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Sélectionnez le programme auquel ajouter cette séance :
              </p>

              <div className="space-y-2">
                {activePrograms.map((prog) => (
                  <div
                    key={prog.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all",
                      "hover:border-primary/50 hover:bg-muted/50"
                    )}
                    onClick={() => handleProgramSelectedForSave(prog)}
                  >
                    <div className="space-y-1">
                      <div className="font-medium">{prog.program_name}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {prog.program_category && (
                          <Badge variant="secondary" className="text-xs">
                            {prog.program_category}
                          </Badge>
                        )}
                        <span>{prog.total_workouts || 0} séance(s)</span>
                      </div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectProgramDialogOpen(false)}>
                Annuler
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
};



// ============================================================================
// COMPONENT: Sortable Block Wrapper
// ============================================================================
const SortableBlockWrapper = ({
  block,
  isActive,
  config,
  exerciseCount,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onToggle,
  onDelete,
  onActivate,
  onChangeType,
  children,
}: {
  block: TrainingBlockData;
  isActive: boolean;
  config: ReturnType<typeof getBlockTypeConfig>;
  exerciseCount: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onActivate: () => void;
  onChangeType: (type: TrainingBlockType) => void;
  children: React.ReactNode;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `training-block-${block.id}`,
    data: { type: "training-block", blockId: block.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = config.icon;

  return (
    <div className={cn("relative flex items-start gap-2", isDragging && "opacity-50 scale-[0.98]")}>
      {/* Reorder arrows */}
      <div 
        className="flex-shrink-0 pt-2 flex flex-col items-center gap-1"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={!canMoveUp}
          className={cn(
            "p-1.5 rounded-lg transition-all shadow-md border",
            canMoveUp 
              ? "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer border-primary/50" 
              : "bg-muted text-muted-foreground/40 cursor-not-allowed opacity-40 border-muted"
          )}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={!canMoveDown}
          className={cn(
            "p-1.5 rounded-lg transition-all shadow-md border",
            canMoveDown 
              ? "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer border-primary/50" 
              : "bg-muted text-muted-foreground/40 cursor-not-allowed opacity-40 border-muted"
          )}
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      </div>

      {/* Block content */}
      <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="flex-1 min-w-0">
        <Card 
          className={cn(
            "border-2 transition-all cursor-pointer overflow-hidden",
            config.colors.border,
            config.colors.bg,
            isActive && "ring-2 ring-primary ring-offset-2"
          )}
          onClick={onActivate}
        >
          {/* Header */}
          <div className={cn("flex items-center gap-2 px-3 py-2", config.colors.header)}>
            <div className="p-1 rounded bg-white/20">
              <Icon className="h-4 w-4 text-white" />
            </div>
            
            {/* Type selector */}
            <Select
              value={block.type}
              onValueChange={(value) => onChangeType(value as TrainingBlockType)}
            >
              <SelectTrigger 
                className="h-7 w-auto bg-white/10 border-white/30 text-white text-sm font-medium hover:bg-white/20"
                onClick={(e) => e.stopPropagation()}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="echauffement">Échauffement</SelectItem>
                <SelectItem value="musculation">Musculation</SelectItem>
                <SelectItem value="crossfit">CrossFit</SelectItem>
                <SelectItem value="cardio">Cardio</SelectItem>
                <SelectItem value="mobilite">Mobilité</SelectItem>
              </SelectContent>
            </Select>
            
            <Badge variant="secondary" className="bg-white/20 text-white text-xs ml-auto">
              {exerciseCount} ex.
            </Badge>
            {isActive && (
              <Badge className="bg-white text-foreground text-xs font-semibold animate-pulse">
                ACTIF
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-white/20 text-white"
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
            >
              {block.isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-white/20 text-white/70 hover:text-white"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <Collapsible open={block.isOpen}>
            <CollapsibleContent>
              {children}
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENT: Droppable Block Zone
// ============================================================================
const DroppableBlockZone = ({ blockId }: { blockId: string }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `block-drop-${blockId}`,
    data: { blockId },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-2 border-dashed rounded-lg p-4 text-center transition-all",
        isOver
          ? "border-primary bg-primary/10"
          : "border-muted-foreground/30 hover:border-primary/50"
      )}
    >
      <p className="text-xs text-muted-foreground">
        {isOver ? "Déposer ici" : "Glissez un exercice ici ou cliquez dans la bibliothèque"}
      </p>
    </div>
  );
};

// ============================================================================
// COMPONENT: Draggable Library Exercise
// ============================================================================
const DraggableLibraryExercise = ({
  exercise,
  onClickInsert,
  isFavorite,
}: {
  exercise: Exercise;
  onClickInsert: () => void;
  isFavorite: boolean;
}) => {
  const [showFocusPanel, setShowFocusPanel] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library-${exercise.id}`,
    data: { type: "library", exercise },
  });

  const descriptionData = {
    general_description: exercise.general_description,
    positioning_criteria: exercise.positioning_criteria,
    execution_criteria: exercise.execution_criteria,
    safety_prevention: exercise.safety_prevention,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={onClickInsert}
        className={cn(
          "flex items-center gap-1 p-1.5 rounded-md border bg-background cursor-pointer transition-all",
          isDragging ? "opacity-50" : "hover:border-primary hover:bg-primary/5"
        )}
      >
        <ExerciseVisual 
          imageUrl={exercise.image_url} 
          category={exercise.station_name} 
          exerciseName={exercise.exercise_name}
          size="sm" 
        />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium truncate">{exercise.exercise_name}</p>
          <p className="text-[9px] text-muted-foreground truncate">{exercise.station_name}</p>
        </div>
        <div className="flex items-center flex-shrink-0">
          {exercise.video_url && <Video className="h-2.5 w-2.5 text-primary mr-1" />}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setShowFocusPanel(true);
            }}
            className="h-5 w-5 text-primary hover:bg-primary/10"
          >
            <Info className="h-3 w-3" />
          </Button>
          <Star className={cn(
            "h-3 w-3",
            isFavorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
          )} />
        </div>
      </div>

      <ExerciseFocusPanel
        isOpen={showFocusPanel}
        onClose={() => setShowFocusPanel(false)}
        exerciseName={exercise.exercise_name}
        category={exercise.station_name}
        videoUrl={exercise.video_url}
        data={descriptionData}
      />
    </>
  );
};

// ============================================================================
// COMPONENT: CrossFit Method Card (AMRAP, EMOM, Tabata, For Time, etc.)
// ============================================================================
const CROSSFIT_METHOD_CONFIG: Record<string, { 
  label: string; 
  color: string; 
  bgColor: string;
  borderColor: string;
  icon: string;
}> = {
  amrap: { label: "AMRAP", color: "text-rose-600", bgColor: "bg-rose-500/10", borderColor: "border-l-rose-500", icon: "⏱️" },
  for_time: { label: "For Time", color: "text-orange-600", bgColor: "bg-orange-500/10", borderColor: "border-l-orange-500", icon: "⚡" },
  emom: { label: "EMOM", color: "text-indigo-600", bgColor: "bg-indigo-500/10", borderColor: "border-l-indigo-500", icon: "🔄" },
  tabata: { label: "Tabata", color: "text-yellow-600", bgColor: "bg-yellow-500/10", borderColor: "border-l-yellow-500", icon: "💪" },
  circuit: { label: "Circuit", color: "text-lime-600", bgColor: "bg-lime-500/10", borderColor: "border-l-lime-500", icon: "🔁" },
  death_by: { label: "Death By", color: "text-red-600", bgColor: "bg-red-600/10", borderColor: "border-l-red-600", icon: "💀" },
};

const CrossFitMethodCard = ({
  exercise,
  libraryExercises,
  onRemove,
}: {
  exercise: ProgramExercise;
  libraryExercises: Exercise[];
  onRemove: (id: string) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const config = CROSSFIT_METHOD_CONFIG[exercise.trainingStyle] || CROSSFIT_METHOD_CONFIG.circuit;
  
  // Format time helper
  const formatTime = (minutes?: number) => {
    if (!minutes) return null;
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${h}h${m > 0 ? m + "'" : ""}`;
    }
    return `${minutes}'`;
  };

  // Get method-specific display info
  const getMethodInfo = () => {
    const info: { label: string; value: string }[] = [];
    
    switch (exercise.trainingStyle) {
      case 'amrap':
        if (exercise.timeCap) info.push({ label: "Durée", value: formatTime(exercise.timeCap) || `${exercise.timeCap}min` });
        break;
      case 'for_time':
        if (exercise.timeCap) info.push({ label: "Time Cap", value: formatTime(exercise.timeCap) || `${exercise.timeCap}min` });
        if (exercise.repsPerRound) info.push({ label: "Rounds", value: String(exercise.repsPerRound) });
        break;
      case 'emom':
        if (exercise.emomConfig) {
          info.push({ label: "Intervalle", value: exercise.emomConfig.intervalMinutes === 1 ? "EMOM" : `E${exercise.emomConfig.intervalMinutes}MOM` });
          info.push({ label: "Durée totale", value: `${exercise.emomConfig.totalMinutes || exercise.totalMinutes}'` });
        } else if (exercise.totalMinutes) {
          info.push({ label: "Durée totale", value: `${exercise.totalMinutes}'` });
        }
        break;
      case 'tabata':
        if (exercise.tabataConfig) {
          info.push({ label: "Travail", value: `${exercise.tabataConfig.workSeconds}s` });
          info.push({ label: "Repos", value: `${exercise.tabataConfig.restSeconds}s` });
          info.push({ label: "Rounds", value: String(exercise.tabataConfig.rounds) });
        }
        break;
      case 'circuit':
        if (exercise.repsPerRound) info.push({ label: "Tours", value: String(exercise.repsPerRound) });
        break;
      case 'death_by':
        if (exercise.deathByConfig) {
          info.push({ label: "Départ", value: `${exercise.deathByConfig.startReps} rep${exercise.deathByConfig.startReps > 1 ? 's' : ''}` });
          info.push({ label: "Incrément", value: `+${exercise.deathByConfig.incrementReps}/min` });
        }
        break;
    }
    
    return info;
  };

  const methodInfo = getMethodInfo();
  const methodExercises = exercise.methodExercises || [];
  
  // If no methodExercises, show the main exercise
  const displayExercises = methodExercises.length > 0 
    ? methodExercises 
    : [{ exerciseId: exercise.exerciseId, exerciseName: exercise.exerciseName, reps: exercise.dropSetSeries?.[0]?.reps }];

  return (
    <div className={cn(
      "rounded-xl overflow-hidden border-l-[5px] shadow-sm",
      config.borderColor,
      config.bgColor
    )}>
      {/* Header */}
      <div className={cn("flex items-center justify-between px-4 py-2.5 bg-gradient-to-r", 
        exercise.trainingStyle === 'amrap' ? "from-rose-500 to-rose-600" :
        exercise.trainingStyle === 'for_time' ? "from-orange-500 to-orange-600" :
        exercise.trainingStyle === 'emom' ? "from-indigo-500 to-indigo-600" :
        exercise.trainingStyle === 'tabata' ? "from-yellow-500 to-yellow-600" :
        exercise.trainingStyle === 'circuit' ? "from-lime-500 to-lime-600" :
        exercise.trainingStyle === 'death_by' ? "from-red-600 to-red-700" :
        "from-gray-500 to-gray-600"
      )}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.icon}</span>
          <span className="font-bold text-sm text-white tracking-wide uppercase">{config.label}</span>
          {methodInfo.length > 0 && (
            <div className="flex items-center gap-2">
              {methodInfo.map((item, idx) => (
                <Badge key={idx} className="bg-white/20 text-white text-xs px-2 py-0.5">
                  {item.label}: {item.value}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 w-7 p-0 text-white/80 hover:text-white hover:bg-white/20"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(exercise.id)}
            className="h-7 w-7 p-0 text-white/80 hover:text-white hover:bg-white/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content - list of exercises in the method */}
      {isExpanded && (
        <div className="divide-y divide-border/50">
          {displayExercises.map((ex, idx) => (
            <div key={`${ex.exerciseId}-${idx}`} className="flex items-center gap-3 px-4 py-2.5">
              <Badge variant="outline" className={cn("text-xs font-bold", config.color)}>
                {idx + 1}
              </Badge>
              <ExerciseVisual 
                imageUrl={getExerciseImageUrl(ex.exerciseId, libraryExercises)} 
                category={getExerciseCategory(ex.exerciseId, libraryExercises)} 
                exerciseName={ex.exerciseName}
                size="sm" 
              />
              <span className="font-medium text-sm flex-1">{ex.exerciseName}</span>
              {ex.reps && (
                <Badge variant="secondary" className="text-xs">
                  {ex.reps} reps
                </Badge>
              )}
              {ex.percentage && (
                <Badge variant="secondary" className="text-xs">
                  {ex.percentage}%
                </Badge>
              )}
              {ex.load && (
                <Badge variant="secondary" className="text-xs">
                  {ex.load}kg
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// COMPONENT: Exercise Card
// ============================================================================
const ExerciseCard = ({
  exercise,
  libraryExercises,
  onUpdate,
  onRemove,
}: {
  exercise: ProgramExercise;
  libraryExercises: Exercise[];
  onUpdate: (id: string, field: keyof ProgramExercise, value: any) => void;
  onRemove: (id: string) => void;
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const exerciseType = getExerciseType(exercise.exerciseName);
  const isCardio = exerciseType === 'cardio_machine';
  const isRunning = exerciseType === 'cardio_locomotion';

  const exerciseData = libraryExercises.find(e => e.id === exercise.exerciseId);
  const hasDescriptionData = exerciseData && (
    exerciseData.general_description ||
    exerciseData.positioning_criteria ||
    exerciseData.execution_criteria ||
    exerciseData.safety_prevention
  );

  return (
    <Card className="border">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <ExerciseVisual 
            imageUrl={getExerciseImageUrl(exercise.exerciseId, libraryExercises)} 
            category={getExerciseCategory(exercise.exerciseId, libraryExercises)} 
            exerciseName={exercise.exerciseName}
            size="sm" 
          />
          <span className="font-medium text-sm flex-1">{exercise.exerciseName}</span>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="h-6 px-2 text-xs"
          >
            <BookOpen className="h-3 w-3 mr-1" />
            {showDetails ? "Masquer" : "Détails"}
          </Button>
          
          <Button variant="ghost" size="sm" onClick={() => onRemove(exercise.id)} className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {showDetails && hasDescriptionData && exerciseData && (
          <ExerciseDescriptionCard
            exerciseName={exercise.exerciseName}
            data={{
              general_description: exerciseData.general_description,
              positioning_criteria: exerciseData.positioning_criteria,
              execution_criteria: exerciseData.execution_criteria,
              safety_prevention: exerciseData.safety_prevention,
            }}
            variant="compact"
            defaultOpen
          />
        )}
        
        {/* Weightlifting Position Selector */}
        <WeightliftingPositionSelector
          exerciseName={exercise.exerciseName}
          stationName={exerciseData?.station_name || ""}
          value={exercise.startingPosition}
          onChange={(value) => onUpdate(exercise.id, 'startingPosition', value)}
          compact
        />

        <TrainingVariablesManager
          exerciseType={exerciseType}
          values={{
            sets: exercise.sets,
            reps: exercise.reps,
            percentage: exercise.percentage,
            tempo: exercise.tempo,
            rpe: exercise.rpe,
            rir: exercise.rir,
            restSeconds: exercise.restSeconds,
            durationSeconds: exercise.durationSeconds,
            calories: exercise.calories,
            watts: exercise.watts,
            distanceMeters: exercise.distanceMeters,
            paceSecondsPerKm: exercise.paceSecondsPerKm,
            runDurationSeconds: exercise.runDurationSeconds,
            runDistanceMeters: exercise.runDistanceMeters,
          }}
          onUpdate={(key, value) => onUpdate(exercise.id, key as keyof ProgramExercise, value)}
          visibleVariables={
            exercise.visibleVariables ||
            (isCardio ? [...DEFAULT_CARDIO_VISIBLE] : isRunning ? [...DEFAULT_RUNNING_VISIBLE] : [...DEFAULT_STRENGTH_VISIBLE])
          }
          onVisibleVariablesChange={(vars) => onUpdate(exercise.id, "visibleVariables", vars)}
          compact
        />
      </CardContent>
    </Card>
  );
};

// ============================================================================
// COMPONENT: Linked Block Card (Superset, Triset, etc.)
// ============================================================================
const LinkedBlockCard = ({
  groupId,
  exercises,
  libraryExercises,
  trainingStyle,
  onUpdateExercise,
  onRemoveExercise,
  onUnlink,
}: {
  groupId: string;
  exercises: ProgramExercise[];
  libraryExercises: Exercise[];
  trainingStyle: string;
  onUpdateExercise: (id: string, field: keyof ProgramExercise, value: any) => void;
  onRemoveExercise: (id: string) => void;
  onUnlink: () => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const colors = getMethodColors(trainingStyle);
  const label = getMethodLabel(trainingStyle);
  const lastExercise = exercises[exercises.length - 1];

  return (
    <div className={cn(
      "rounded-xl overflow-hidden border-l-[5px] shadow-sm",
      colors.border,
      colors.bg
    )}>
      {/* Header */}
      <div className={cn("flex items-center justify-between px-4 py-2.5", colors.headerBg)}>
        <div className="flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-white/90" />
          <span className="font-bold text-sm text-white tracking-wide uppercase">{label}</span>
          <Badge className="bg-white/20 text-white text-xs px-2 py-0.5">
            {exercises.length} exercices liés
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 w-7 p-0 text-white/80 hover:text-white hover:bg-white/20"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onUnlink}
            className="h-7 px-2 text-white/80 hover:text-white hover:bg-white/20"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Délier
          </Button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <>
          <div className="divide-y divide-border/50">
            {exercises.map((exercise, idx) => {
              const isLast = idx === exercises.length - 1;
              const exerciseType = getExerciseType(exercise.exerciseName);
              const isCardioMachine = exerciseType === 'cardio_machine';
              const isRunning = exerciseType === 'cardio_locomotion';

              return (
                <div key={exercise.id} className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className={cn("text-xs font-bold", colors.badge)}>{idx + 1}</Badge>
                    <ExerciseVisual 
                      imageUrl={getExerciseImageUrl(exercise.exerciseId, libraryExercises)} 
                      category={getExerciseCategory(exercise.exerciseId, libraryExercises)} 
                      exerciseName={exercise.exerciseName}
                      size="sm" 
                    />
                    <span className="font-medium text-sm flex-1">{exercise.exerciseName}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveExercise(exercise.id)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Weightlifting Position Selector */}
                  <WeightliftingPositionSelector
                    exerciseName={exercise.exerciseName}
                    stationName={libraryExercises.find(e => e.id === exercise.exerciseId)?.station_name || ""}
                    value={exercise.startingPosition}
                    onChange={(value) => onUpdateExercise(exercise.id, 'startingPosition', value)}
                    compact
                  />

                  <TrainingVariablesManager
                    exerciseType={exerciseType}
                    values={{
                      sets: exercise.sets,
                      reps: exercise.reps,
                      percentage: exercise.percentage,
                      tempo: exercise.tempo,
                      rpe: exercise.rpe,
                      rir: exercise.rir,
                      restSeconds: exercise.restSeconds,
                      durationSeconds: exercise.durationSeconds,
                      calories: exercise.calories,
                      watts: exercise.watts,
                      distanceMeters: exercise.distanceMeters,
                      paceSecondsPerKm: exercise.paceSecondsPerKm,
                      runDurationSeconds: exercise.runDurationSeconds,
                      runDistanceMeters: exercise.runDistanceMeters,
                    }}
                    onUpdate={(key, value) => onUpdateExercise(exercise.id, key as keyof ProgramExercise, value)}
                    visibleVariables={
                      exercise.visibleVariables ||
                      (isCardioMachine 
                        ? [...DEFAULT_CARDIO_VISIBLE]
                        : isRunning 
                          ? [...DEFAULT_RUNNING_VISIBLE]
                          : [...DEFAULT_STRENGTH_VISIBLE])
                    }
                    onVisibleVariablesChange={(vars) => onUpdateExercise(exercise.id, "visibleVariables", vars)}
                    compact
                    showRestForGroup={isLast}
                    isGrouped
                  />

                  {!isLast && (
                    <div className="flex items-center justify-center py-1">
                      <div className={cn("flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium", colors.bg, colors.icon)}>
                        <div className="w-4 h-0.5 rounded bg-current opacity-50" />
                        <span className="opacity-75">Enchaîné sans repos</span>
                        <div className="w-4 h-0.5 rounded bg-current opacity-50" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer indicator */}
          <div className={cn("flex items-center px-4 py-2.5 border-t border-border/30", colors.bg)}>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <LinkIcon className={cn("h-3.5 w-3.5", colors.icon)} />
              <span>Bloc de {exercises.length} exercices enchaînés</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
