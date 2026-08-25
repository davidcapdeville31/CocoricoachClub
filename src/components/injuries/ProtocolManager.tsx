import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  GripVertical, 
  FileText,
  ChevronUp,
  ChevronDown,
  Copy,
  Settings2
} from "lucide-react";
import { INJURY_CATEGORIES, RUGBY_INJURY_TYPES, DEFAULT_REHAB_PHASES } from "@/lib/constants/rugbyInjuries";
import { ProtocolPhaseExercises, ProtocolExercise } from "./ProtocolPhaseExercises";
import { TapingDetailEditor } from "./TapingDetailEditor";
import { ProtocolPhaseProgramLink } from "./ProtocolPhaseProgramLink";
import i18n from "@/i18n";

interface ProtocolManagerProps {
  categoryId: string;
}

interface Phase {
  id?: string;
  phase_number: number;
  name: string;
  description: string;
  duration_days_min: number;
  duration_days_max: number;
  objectives: string[];
  exit_criteria: string[];
  care_instructions: string[];
  taping_instructions: string[];
  taping_diagram_url?: string | null;
  linked_program_id?: string | null;
  exercises: ProtocolExercise[];
}

function getDefaultPhases(): Phase[] {
  return [
    { phase_number: 1, name: i18n.t("health.protocolManager.defaultPhases.phase1.name"), description: i18n.t("health.protocolManager.defaultPhases.phase1.description"), duration_days_min: 7, duration_days_max: 14, objectives: [], exit_criteria: [], care_instructions: i18n.t("health.protocolManager.defaultPhases.phase1.care", { returnObjects: true }) as string[], taping_instructions: [], taping_diagram_url: null, linked_program_id: null, exercises: [] },
    { phase_number: 2, name: i18n.t("health.protocolManager.defaultPhases.phase2.name"), description: i18n.t("health.protocolManager.defaultPhases.phase2.description"), duration_days_min: 7, duration_days_max: 14, objectives: [], exit_criteria: [], care_instructions: i18n.t("health.protocolManager.defaultPhases.phase2.care", { returnObjects: true }) as string[], taping_instructions: i18n.t("health.protocolManager.defaultPhases.phase2.taping", { returnObjects: true }) as string[], taping_diagram_url: null, linked_program_id: null, exercises: [] },
    { phase_number: 3, name: i18n.t("health.protocolManager.defaultPhases.phase3.name"), description: i18n.t("health.protocolManager.defaultPhases.phase3.description"), duration_days_min: 7, duration_days_max: 14, objectives: [], exit_criteria: [], care_instructions: i18n.t("health.protocolManager.defaultPhases.phase3.care", { returnObjects: true }) as string[], taping_instructions: i18n.t("health.protocolManager.defaultPhases.phase3.taping", { returnObjects: true }) as string[], taping_diagram_url: null, linked_program_id: null, exercises: [] },
    { phase_number: 4, name: i18n.t("health.protocolManager.defaultPhases.phase4.name"), description: i18n.t("health.protocolManager.defaultPhases.phase4.description"), duration_days_min: 7, duration_days_max: 14, objectives: [], exit_criteria: [], care_instructions: [], taping_instructions: [], taping_diagram_url: null, linked_program_id: null, exercises: [] },
  ];
}

/**
 * Convert DEFAULT_REHAB_PHASES for a given category into Phase[] with exercises
 */
function getPhasesForInjuryCategory(category: string): Phase[] {
  const rehabPhases = DEFAULT_REHAB_PHASES[category as keyof typeof DEFAULT_REHAB_PHASES];
  if (!rehabPhases) return getDefaultPhases();
  
  return rehabPhases.map((p: any) => ({
    phase_number: p.phase_number,
    name: p.name,
    description: p.description,
    duration_days_min: p.duration_days_min,
    duration_days_max: p.duration_days_max,
    objectives: p.objectives || [],
    exit_criteria: p.exit_criteria || [],
    care_instructions: [],
    taping_instructions: [],
    taping_diagram_url: null,
    linked_program_id: null,
    exercises: (p.exercises || []).map((ex: any, i: number) => ({
      name: ex.name,
      description: ex.description || "",
      sets: ex.sets,
      reps: ex.reps || "",
      frequency: ex.frequency || "",
      exercise_order: i,
      image_url: null,
      video_url: null,
      notes: null,
    })),
  }));
}

function ProtocolFormFields({
  protocolName, setProtocolName, protocolDescription,
  durationMin, setDurationMin, durationMax, setDurationMax,
  phases, setPhases, protocolCategory, categoryId,
  updatePhase, addPhase, removePhase, movePhase,
  hideNameField = false,
}: {
  protocolName: string; setProtocolName: (v: string) => void;
  protocolDescription: string;
  durationMin: number; setDurationMin: (v: number) => void;
  durationMax: number; setDurationMax: (v: number) => void;
  phases: Phase[]; setPhases: (v: Phase[]) => void;
  protocolCategory: string; categoryId: string;
  updatePhase: (index: number, field: keyof Phase, value: any) => void;
  addPhase: () => void; removePhase: (index: number) => void;
  movePhase: (index: number, direction: 'up' | 'down') => void;
  hideNameField?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="p-3 rounded-lg bg-muted/50 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{protocolName || "Nouveau protocole"}</p>
            <p className="text-sm text-muted-foreground">{protocolDescription}</p>
          </div>
          <Badge variant="secondary">
            {durationMin}-{durationMax} jours
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {!hideNameField && (
            <div className="space-y-1">
              <Label className="text-xs">Nom du protocole</Label>
              <Input
                value={protocolName}
                onChange={(e) => setProtocolName(e.target.value)}
                className="h-8"
              />
            </div>
          )}
          <div className={`grid grid-cols-2 gap-2 ${hideNameField ? "col-span-2" : ""}`}>
            <div className="space-y-1">
              <Label className="text-xs">Durée totale min</Label>
              <Input
                type="number"
                value={durationMin}
                onChange={(e) => setDurationMin(parseInt(e.target.value) || 0)}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Durée totale max</Label>
              <Input
                type="number"
                value={durationMax}
                onChange={(e) => setDurationMax(parseInt(e.target.value) || 0)}
                className="h-8"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Blocs de réathlétisation ({phases.length} phases)</Label>
          <Button variant="outline" size="sm" onClick={addPhase}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter phase
          </Button>
        </div>
        
        {phases.map((phase, index) => (
          <div key={index} className="p-3 border rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline">{phase.phase_number}</Badge>
              <Input
                value={phase.name}
                onChange={(e) => updatePhase(index, 'name', e.target.value)}
                placeholder={t("health.protocolManager.phaseNamePlaceholder")}
                className="flex-1"
              />
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => movePhase(index, 'up')} disabled={index === 0}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => movePhase(index, 'down')} disabled={index === phases.length - 1}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => removePhase(index)} disabled={phases.length <= 1}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
            <Input
              value={phase.description}
              onChange={(e) => updatePhase(index, 'description', e.target.value)}
              placeholder={t("health.protocolManager.phaseDescriptionPlaceholder")}
              className="text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Min:</Label>
                <Input type="number" value={phase.duration_days_min} onChange={(e) => updatePhase(index, 'duration_days_min', parseInt(e.target.value) || 0)} className="h-8" />
                <span className="text-xs text-muted-foreground">jours</span>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Max:</Label>
                <Input type="number" value={phase.duration_days_max} onChange={(e) => updatePhase(index, 'duration_days_max', parseInt(e.target.value) || 0)} className="h-8" />
                <span className="text-xs text-muted-foreground">jours</span>
              </div>
            </div>
            
            {phase.objectives.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">🎯 Objectifs</Label>
                <Textarea
                  value={(phase.objectives || []).join('\n')}
                  onChange={(e) => updatePhase(index, 'objectives', e.target.value.split('\n').filter((o: string) => o.trim()))}
                  placeholder={t("health.protocolManager.objectivesPlaceholder")}
                  rows={2}
                  className="text-sm"
                />
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">🩹 Soins</Label>
              <Textarea
                value={(phase.care_instructions || []).join('\n')}
                onChange={(e) => updatePhase(index, 'care_instructions', e.target.value.split('\n').filter((c: string) => c.trim()))}
                placeholder={t("health.protocolManager.carePlaceholder")}
                rows={2}
                className="text-sm"
              />
            </div>
            <TapingDetailEditor
              tapingInstructions={phase.taping_instructions || []}
              tapingDiagramUrl={phase.taping_diagram_url}
              onInstructionsChange={(instructions) => updatePhase(index, 'taping_instructions', instructions)}
              onDiagramUrlChange={(url) => updatePhase(index, 'taping_diagram_url', url)}
              injuryType={protocolCategory}
              phaseDescription={phase.description}
            />
            <ProtocolPhaseProgramLink
              categoryId={categoryId}
              linkedProgramId={phase.linked_program_id}
              phaseName={phase.name}
              onProgramLinked={(programId) => updatePhase(index, 'linked_program_id', programId)}
            />
            <ProtocolPhaseExercises
              exercises={phase.exercises || []}
              onChange={(exercises) => updatePhase(index, 'exercises', exercises)}
            />
          </div>
        ))}
      </div>
    </>
  );
}

export function ProtocolManager({ categoryId }: ProtocolManagerProps) {
  const { t } = useTranslation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditPhasesOpen, setIsEditPhasesOpen] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<any>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [creationMode, setCreationMode] = useState<"predefined" | "custom">("predefined");
  
  // Form states
  const [selectedInjuryType, setSelectedInjuryType] = useState<string>("");
  const [protocolName, setProtocolName] = useState("");
  const [protocolCategory, setProtocolCategory] = useState("");
  const [protocolDescription, setProtocolDescription] = useState("");
  const [durationMin, setDurationMin] = useState(14);
  const [durationMax, setDurationMax] = useState(42);
  const [phases, setPhases] = useState<Phase[]>(getDefaultPhases());
  
  const queryClient = useQueryClient();

  // Fetch protocols (system defaults + category specific)
  const { data: protocols, isLoading } = useQuery({
    queryKey: ["injury-protocols-manager", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("injury_protocols")
        .select(`
          *,
          protocol_phases (*)
        `)
        .or(`is_system_default.eq.true,category_id.eq.${categoryId}`)
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  // Create protocol mutation
  const createProtocol = useMutation({
    mutationFn: async () => {
      // Create protocol
      const { data: newProtocol, error: protocolError } = await supabase
        .from("injury_protocols")
        .insert({
          name: protocolName,
          injury_category: protocolCategory,
          description: protocolDescription,
          typical_duration_days_min: durationMin,
          typical_duration_days_max: durationMax,
          category_id: categoryId,
          is_system_default: false,
        })
        .select()
        .single();

      if (protocolError) throw protocolError;

      // Create phases with exercises
      for (const phase of phases) {
        const { data: newPhase, error: phaseError } = await supabase
          .from("protocol_phases")
          .insert({
            protocol_id: newProtocol.id,
            phase_number: phase.phase_number,
            name: phase.name,
            description: phase.description,
            duration_days_min: phase.duration_days_min,
            duration_days_max: phase.duration_days_max,
            objectives: phase.objectives,
            exit_criteria: phase.exit_criteria,
            care_instructions: phase.care_instructions,
            taping_instructions: phase.taping_instructions,
            taping_diagram_url: phase.taping_diagram_url || null,
            linked_program_id: phase.linked_program_id || null,
          })
          .select()
          .single();

        if (phaseError) throw phaseError;

        // Create exercises for this phase
        if (phase.exercises.length > 0) {
          const exercisesToInsert = phase.exercises.map((ex, i) => ({
            phase_id: newPhase.id,
            name: ex.name,
            description: ex.description || null,
            sets: ex.sets,
            reps: ex.reps || null,
            frequency: ex.frequency || null,
            exercise_order: i,
            image_url: ex.image_url || null,
            video_url: ex.video_url || null,
            notes: ex.notes || null,
          }));
          const { error: exError } = await supabase
            .from("protocol_exercises")
            .insert(exercisesToInsert);
          if (exError) throw exError;
        }
      }

      return newProtocol;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["injury-protocols-manager", categoryId] });
      toast.success(t("health.protocolManager.toastCreateSuccess"));
      resetForm();
      setIsAddDialogOpen(false);
    },
    onError: () => {
      toast.error(t("health.protocolManager.toastCreateError"));
    },
  });

  // Update protocol mutation
  const updateProtocol = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("injury_protocols")
        .update({
          name: protocolName,
          injury_category: protocolCategory,
          description: protocolDescription,
          typical_duration_days_min: durationMin,
          typical_duration_days_max: durationMax,
        })
        .eq("id", selectedProtocol?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["injury-protocols-manager", categoryId] });
      toast.success(t("health.protocolManager.toastUpdateSuccess"));
      setIsEditDialogOpen(false);
    },
    onError: () => {
      toast.error(t("health.protocolManager.toastUpdateError"));
    },
  });

  // Update phases mutation
  const updatePhases = useMutation({
    mutationFn: async () => {
      // Delete existing phases
      const { error: deleteError } = await supabase
        .from("protocol_phases")
        .delete()
        .eq("protocol_id", selectedProtocol?.id);

      if (deleteError) throw deleteError;

      // Create new phases with exercises
      for (const phase of phases) {
        const { data: newPhase, error: phaseError } = await supabase
          .from("protocol_phases")
          .insert({
            protocol_id: selectedProtocol?.id,
            phase_number: phase.phase_number,
            name: phase.name,
            description: phase.description,
            duration_days_min: phase.duration_days_min,
            duration_days_max: phase.duration_days_max,
            objectives: phase.objectives,
            exit_criteria: phase.exit_criteria,
            care_instructions: phase.care_instructions,
            taping_instructions: phase.taping_instructions,
            taping_diagram_url: phase.taping_diagram_url || null,
            linked_program_id: phase.linked_program_id || null,
          })
          .select()
          .single();

        if (phaseError) throw phaseError;

        // Create exercises for this phase
        if (phase.exercises.length > 0) {
          const exercisesToInsert = phase.exercises.map((ex, i) => ({
            phase_id: newPhase.id,
            name: ex.name,
            description: ex.description || null,
            sets: ex.sets,
            reps: ex.reps || null,
            frequency: ex.frequency || null,
            exercise_order: i,
            image_url: ex.image_url || null,
            video_url: ex.video_url || null,
            notes: ex.notes || null,
          }));
          const { error: exError } = await supabase
            .from("protocol_exercises")
            .insert(exercisesToInsert);
          if (exError) throw exError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["injury-protocols-manager", categoryId] });
      toast.success(t("health.protocolManager.toastPhasesUpdateSuccess"));
      setIsEditPhasesOpen(false);
    },
    onError: () => {
      toast.error(t("health.protocolManager.toastPhasesUpdateError"));
    },
  });

  // Delete protocol mutation
  const deleteProtocol = useMutation({
    mutationFn: async (protocolId: string) => {
      const { error } = await supabase
        .from("injury_protocols")
        .delete()
        .eq("id", protocolId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["injury-protocols-manager", categoryId] });
      toast.success(t("health.protocolManager.toastDeleteSuccess"));
    },
    onError: () => {
      toast.error(t("health.protocolManager.toastDeleteError"));
    },
  });

  // Duplicate protocol mutation
  const duplicateProtocol = useMutation({
    mutationFn: async (protocol: any) => {
      // Create new protocol
      const { data: newProtocol, error: protocolError } = await supabase
        .from("injury_protocols")
        .insert({
          name: `${protocol.name}${t("health.protocolManager.duplicateSuffix")}`,
          injury_category: protocol.injury_category,
          description: protocol.description,
          typical_duration_days_min: protocol.typical_duration_days_min,
          typical_duration_days_max: protocol.typical_duration_days_max,
          category_id: categoryId,
          is_system_default: false,
        })
        .select()
        .single();

      if (protocolError) throw protocolError;

      // Copy phases with exercises
      if (protocol.protocol_phases) {
        for (const phase of protocol.protocol_phases) {
          const { data: newPhase, error: phaseError } = await supabase
            .from("protocol_phases")
            .insert({
              protocol_id: newProtocol.id,
              phase_number: phase.phase_number,
              name: phase.name,
              description: phase.description,
              duration_days_min: phase.duration_days_min,
              duration_days_max: phase.duration_days_max,
              objectives: phase.objectives,
              exit_criteria: phase.exit_criteria,
              care_instructions: phase.care_instructions,
              taping_instructions: phase.taping_instructions,
              taping_diagram_url: (phase as any).taping_diagram_url || null,
            })
            .select()
            .single();

          if (phaseError) throw phaseError;

          // Copy exercises from original phase
          const { data: originalExercises } = await supabase
            .from("protocol_exercises")
            .select("*")
            .eq("phase_id", phase.id)
            .order("exercise_order");

          if (originalExercises && originalExercises.length > 0) {
            const exercisesToInsert = originalExercises.map((ex: any) => ({
              phase_id: newPhase.id,
              name: ex.name,
              description: ex.description,
              sets: ex.sets,
              reps: ex.reps,
              frequency: ex.frequency,
              exercise_order: ex.exercise_order,
              image_url: ex.image_url,
              video_url: ex.video_url,
              notes: ex.notes,
            }));
            await supabase.from("protocol_exercises").insert(exercisesToInsert);
          }
        }
      }

      return newProtocol;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["injury-protocols-manager", categoryId] });
      toast.success(t("health.protocolManager.toastDuplicateSuccess"));
    },
    onError: () => {
      toast.error(t("health.protocolManager.toastDuplicateError"));
    },
  });

  const resetForm = () => {
    setSelectedInjuryType("");
    setProtocolName("");
    setProtocolCategory("");
    setProtocolDescription("");
    setDurationMin(14);
    setDurationMax(42);
    setPhases(getDefaultPhases());
    setSelectedProtocol(null);
  };

  const handleInjuryTypeSelect = (injuryName: string) => {
    setSelectedInjuryType(injuryName);
    const injury = RUGBY_INJURY_TYPES.find(i => i.name === injuryName);
    if (injury) {
      setProtocolName(`${t("health.protocolManager.protocolNamePlaceholder")} - ${injury.name}`);
      setProtocolCategory(injury.category);
      setProtocolDescription(injury.description);
      setDurationMin(injury.durationMin);
      setDurationMax(injury.durationMax);
      setPhases(getPhasesForInjuryCategory(injury.category));
    }
  };

  const handleEdit = (protocol: any) => {
    setSelectedProtocol(protocol);
    setProtocolName(protocol.name);
    setProtocolCategory(protocol.injury_category);
    setProtocolDescription(protocol.description || "");
    setDurationMin(protocol.typical_duration_days_min || 14);
    setDurationMax(protocol.typical_duration_days_max || 42);
    setIsEditDialogOpen(true);
  };

  const handleEditPhases = async (protocol: any) => {
    setSelectedProtocol(protocol);
    if (protocol.protocol_phases && protocol.protocol_phases.length > 0) {
      // Load exercises for each phase
      const sortedPhases = protocol.protocol_phases.sort((a: any, b: any) => a.phase_number - b.phase_number);
      const phasesWithExercises: Phase[] = [];
      
      for (const p of sortedPhases) {
        const { data: exercisesData } = await supabase
          .from("protocol_exercises")
          .select("*")
          .eq("phase_id", p.id)
          .order("exercise_order");
        
        phasesWithExercises.push({
          id: p.id,
          phase_number: p.phase_number,
          name: p.name,
          description: p.description || "",
          duration_days_min: p.duration_days_min || 7,
          duration_days_max: p.duration_days_max || 14,
          objectives: p.objectives || [],
          exit_criteria: p.exit_criteria || [],
          care_instructions: p.care_instructions || [],
          taping_instructions: p.taping_instructions || [],
          taping_diagram_url: (p as any).taping_diagram_url || null,
          linked_program_id: (p as any).linked_program_id || null,
          exercises: (exercisesData || []).map((e: any) => ({
            id: e.id,
            name: e.name,
            description: e.description || "",
            sets: e.sets,
            reps: e.reps || "",
            frequency: e.frequency || "",
            exercise_order: e.exercise_order || 0,
            image_url: e.image_url,
            video_url: e.video_url,
            notes: e.notes,
          })),
        });
      }
      setPhases(phasesWithExercises);
    } else {
      setPhases(getDefaultPhases());
    }
    setIsEditPhasesOpen(true);
  };

  const addPhase = () => {
    const newPhaseNumber = phases.length + 1;
    setPhases([...phases, {
      phase_number: newPhaseNumber,
      name: t("health.protocolManager.defaultPhaseName", { number: newPhaseNumber }),
      description: "",
      duration_days_min: 7,
      duration_days_max: 14,
      objectives: [],
      exit_criteria: [],
      care_instructions: [],
      taping_instructions: [],
      taping_diagram_url: null,
      linked_program_id: null,
      exercises: [],
    }]);
  };

  const removePhase = (index: number) => {
    const newPhases = phases.filter((_, i) => i !== index).map((p, i) => ({
      ...p,
      phase_number: i + 1,
    }));
    setPhases(newPhases);
  };

  const movePhase = (index: number, direction: 'up' | 'down') => {
    const newPhases = [...phases];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= phases.length) return;
    
    [newPhases[index], newPhases[newIndex]] = [newPhases[newIndex], newPhases[index]];
    setPhases(newPhases.map((p, i) => ({ ...p, phase_number: i + 1 })));
  };

  const updatePhase = (index: number, field: keyof Phase, value: any) => {
    const newPhases = [...phases];
    newPhases[index] = { ...newPhases[index], [field]: value };
    setPhases(newPhases);
  };

  const filteredProtocols = protocols?.filter(p => 
    filterCategory === "all" || p.injury_category === filterCategory
  );

  const getCategoryLabel = (value: string) => {
    return INJURY_CATEGORIES.find(c => c.value === value)?.label || value;
  };

  if (isLoading) {
    return <p className="text-muted-foreground">Chargement...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t("health.protocolManager.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("health.protocolManager.subtitle")}
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("health.protocolManager.newProtocol")}
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <Label>{t("health.protocolManager.filterByCategory")}</Label>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("health.protocolManager.allCategories")}</SelectItem>
            {INJURY_CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Protocols List */}
      <div className="grid gap-4">
        {filteredProtocols?.map((protocol) => (
          <Card key={protocol.id} className={protocol.is_system_default ? "border-dashed" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {protocol.name}
                      {protocol.is_system_default && (
                        <Badge variant="outline" className="text-xs">{t("health.protocolManager.systemBadge")}</Badge>
                      )}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{protocol.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{getCategoryLabel(protocol.injury_category)}</Badge>
                  <Badge variant="outline">
                    {protocol.typical_duration_days_min}-{protocol.typical_duration_days_max} jours
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  {protocol.protocol_phases?.sort((a: any, b: any) => a.phase_number - b.phase_number).map((phase: any) => (
                    <Badge 
                      key={phase.id} 
                      variant="secondary"
                      className="font-normal"
                    >
                      {phase.phase_number}. {phase.name}
                    </Badge>
                  ))}
                  {(!protocol.protocol_phases || protocol.protocol_phases.length === 0) && (
                    <span className="text-sm text-muted-foreground italic">{t("health.protocolManager.noPhasesDefined")}</span>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => duplicateProtocol.mutate(protocol)}
                    title={t("health.protocolManager.duplicate")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {!protocol.is_system_default && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditPhases(protocol)}
                        title={t("health.protocolManager.editPhases")}
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(protocol)}
                        title={t("health.protocolManager.edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(t("health.protocolManager.deleteConfirm"))) {
                            deleteProtocol.mutate(protocol.id);
                          }
                        }}
                        title={t("health.protocolManager.delete")}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredProtocols?.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">{t("health.protocolManager.noProtocolsFound")}</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setIsAddDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("health.protocolManager.createProtocol")}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Protocol Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsAddDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("health.protocolManager.newProtocolDialogTitle")}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Mode selection */}
            <div className="flex gap-2">
              <Button
                variant={creationMode === "predefined" ? "default" : "outline"}
                size="sm"
                onClick={() => { setCreationMode("predefined"); resetForm(); }}
              >
                {t("health.protocolManager.predefinedInjury")}
              </Button>
              <Button
                variant={creationMode === "custom" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setCreationMode("custom");
                  resetForm();
                  setPhases(getDefaultPhases());
                }}
              >
                {t("health.protocolManager.customProtocol")}
              </Button>
            </div>

            {creationMode === "predefined" && (
              <>
                <div className="space-y-2">
                  <Label className="text-base font-semibold">{t("health.protocolManager.selectInjuryStep")}</Label>
                  <Select value={selectedInjuryType} onValueChange={handleInjuryTypeSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("health.protocolManager.chooseInjuryTypePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {INJURY_CATEGORIES.map(cat => (
                        <div key={cat.value}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {cat.label}
                          </div>
                          {RUGBY_INJURY_TYPES.filter(i => i.category === cat.value).map(injury => (
                            <SelectItem key={injury.name} value={injury.name}>
                              {injury.name}
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedInjuryType && (
                  <ProtocolFormFields
                    protocolName={protocolName}
                    setProtocolName={setProtocolName}
                    protocolDescription={protocolDescription}
                    durationMin={durationMin}
                    setDurationMin={setDurationMin}
                    durationMax={durationMax}
                    setDurationMax={setDurationMax}
                    phases={phases}
                    setPhases={setPhases}
                    protocolCategory={protocolCategory}
                    categoryId={categoryId}
                    updatePhase={updatePhase}
                    addPhase={addPhase}
                    removePhase={removePhase}
                    movePhase={movePhase}
                  />
                )}
              </>
            )}

            {creationMode === "custom" && (
              <>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>{t("health.protocolManager.protocolNameRequired")}</Label>
                    <Input
                      value={protocolName}
                      onChange={(e) => setProtocolName(e.target.value)}
                      placeholder={t("health.protocolManager.protocolNamePlaceholder")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("health.protocolManager.injuryTypeRequired")}</Label>
                    <Select value={protocolCategory} onValueChange={(val) => {
                      setProtocolCategory(val);
                      setPhases(getPhasesForInjuryCategory(val));
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("health.protocolManager.chooseTypePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {INJURY_CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("health.protocolManager.description")}</Label>
                    <Textarea
                      value={protocolDescription}
                      onChange={(e) => setProtocolDescription(e.target.value)}
                      placeholder={t("health.protocolManager.descriptionPlaceholder")}
                      rows={2}
                    />
                  </div>
                </div>

                {protocolCategory && (
                  <ProtocolFormFields
                    protocolName={protocolName}
                    setProtocolName={setProtocolName}
                    protocolDescription={protocolDescription}
                    durationMin={durationMin}
                    setDurationMin={setDurationMin}
                    durationMax={durationMax}
                    setDurationMax={setDurationMax}
                    phases={phases}
                    setPhases={setPhases}
                    protocolCategory={protocolCategory}
                    categoryId={categoryId}
                    updatePhase={updatePhase}
                    addPhase={addPhase}
                    removePhase={removePhase}
                    movePhase={movePhase}
                    hideNameField
                  />
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              {t("health.protocolManager.cancel")}
            </Button>
            <Button 
              onClick={() => createProtocol.mutate()}
              disabled={
                !protocolName || !protocolCategory || createProtocol.isPending ||
                (creationMode === "predefined" && !selectedInjuryType)
              }
            >
              {t("health.protocolManager.createProtocolButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Protocol Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("health.protocolManager.editProtocolTitle")}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("health.protocolManager.protocolNameField")}</Label>
              <Input
                value={protocolName}
                onChange={(e) => setProtocolName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("health.protocolManager.categoryRequired")}</Label>
              <Select value={protocolCategory} onValueChange={setProtocolCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INJURY_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("health.protocolManager.description")}</Label>
              <Textarea
                value={protocolDescription}
                onChange={(e) => setProtocolDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("health.protocolManager.durationMin")}</Label>
                <Input
                  type="number"
                  value={durationMin}
                  onChange={(e) => setDurationMin(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("health.protocolManager.durationMax")}</Label>
                <Input
                  type="number"
                  value={durationMax}
                  onChange={(e) => setDurationMax(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {t("health.protocolManager.cancel")}
            </Button>
            <Button 
              onClick={() => updateProtocol.mutate()}
              disabled={!protocolName || !protocolCategory || updateProtocol.isPending}
            >
              {t("health.protocolManager.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Phases Dialog */}
      <Dialog open={isEditPhasesOpen} onOpenChange={setIsEditPhasesOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("health.protocolManager.editPhasesTitle", { name: selectedProtocol?.name })}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={addPhase}>
                <Plus className="h-4 w-4 mr-1" />
                {t("health.protocolManager.addPhaseButton")}
              </Button>
            </div>

            {phases.map((phase, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-lg px-3">{phase.phase_number}</Badge>
                  <Input
                    value={phase.name}
                    onChange={(e) => updatePhase(index, 'name', e.target.value)}
                    placeholder={t("health.protocolManager.phaseNamePlaceholder")}
                    className="flex-1 font-medium"
                  />
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => movePhase(index, 'up')}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => movePhase(index, 'down')}
                      disabled={index === phases.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePhase(index)}
                      disabled={phases.length <= 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                
                <Textarea
                  value={phase.description}
                  onChange={(e) => updatePhase(index, 'description', e.target.value)}
                  placeholder={t("health.protocolManager.phaseDescriptionPlaceholder")}
                  rows={2}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("health.protocolManager.totalDurationMin")}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={phase.duration_days_min}
                        onChange={(e) => updatePhase(index, 'duration_days_min', parseInt(e.target.value) || 0)}
                      />
                      <span className="text-sm text-muted-foreground">jours</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("health.protocolManager.totalDurationMax")}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={phase.duration_days_max}
                        onChange={(e) => updatePhase(index, 'duration_days_max', parseInt(e.target.value) || 0)}
                      />
                      <span className="text-sm text-muted-foreground">jours</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">{t("health.protocolManager.objectivesLabel")} (une par ligne)</Label>
                  <Textarea
                    value={(phase.objectives || []).join('\n')}
                    onChange={(e) => updatePhase(index, 'objectives', e.target.value.split('\n').filter(o => o.trim()))}
                    placeholder={t("health.protocolManager.objectivesLinesPlaceholder")}
                    rows={3}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">{t("health.protocolManager.exitCriteriaLabel")}</Label>
                  <Textarea
                    value={(phase.exit_criteria || []).join('\n')}
                    onChange={(e) => updatePhase(index, 'exit_criteria', e.target.value.split('\n').filter(c => c.trim()))}
                    placeholder={t("health.protocolManager.exitCriteriaPlaceholder")}
                    rows={3}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">{t("health.protocolManager.careLabel")} (un par ligne)</Label>
                  <Textarea
                    value={(phase.care_instructions || []).join('\n')}
                    onChange={(e) => updatePhase(index, 'care_instructions', e.target.value.split('\n').filter(c => c.trim()))}
                    placeholder={t("health.protocolManager.carePlaceholderMulti")}
                    rows={3}
                  />
                </div>

                <TapingDetailEditor
                  tapingInstructions={phase.taping_instructions || []}
                  tapingDiagramUrl={phase.taping_diagram_url}
                  onInstructionsChange={(instructions) => updatePhase(index, 'taping_instructions', instructions)}
                  onDiagramUrlChange={(url) => updatePhase(index, 'taping_diagram_url', url)}
                  injuryType={protocolCategory}
                  phaseDescription={phase.description}
                />

                <ProtocolPhaseProgramLink
                  categoryId={categoryId}
                  linkedProgramId={phase.linked_program_id}
                  phaseName={phase.name}
                  onProgramLinked={(programId) => updatePhase(index, 'linked_program_id', programId)}
                />

                <ProtocolPhaseExercises
                  exercises={phase.exercises || []}
                  onChange={(exercises) => updatePhase(index, 'exercises', exercises)}
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditPhasesOpen(false)}>
              {t("health.protocolManager.cancel")}
            </Button>
            <Button 
              onClick={() => updatePhases.mutate()}
              disabled={updatePhases.isPending}
            >
              {t("health.protocolManager.savePhases")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
