import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { RUGBY_INJURY_TYPES, DEFAULT_REHAB_PHASES, INJURY_CATEGORIES } from "@/lib/constants/rugbyInjuries";
import { Badge } from "@/components/ui/badge";
import { Clock, Dumbbell, FileText, Sparkles, Calendar } from "lucide-react";
import { addDays, format } from "date-fns";
import { copyProtocolExercisesToPlayer } from "@/lib/helpers/copyProtocolExercises";
import i18n from "@/i18n";
import { useTranslation } from "react-i18next";

interface AssignProtocolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId: string;
  injuryId: string;
  categoryId: string;
  injuryType: string;
}

// Helper function to create calendar events for a protocol
async function createCalendarEvents(
  playerRehabProtocolId: string,
  playerId: string,
  categoryId: string,
  phases: Array<{
    id: string;
    phase_number: number;
    name: string;
    description?: string;
    duration_days_min?: number;
    duration_days_max?: number;
  }>,
  startDate: Date = new Date()
) {
  const events = [];
  let currentDate = startDate;

  for (const phase of phases.sort((a, b) => a.phase_number - b.phase_number)) {
    // Create phase start event
    events.push({
      player_rehab_protocol_id: playerRehabProtocolId,
      player_id: playerId,
      category_id: categoryId,
      phase_id: phase.id,
      phase_number: phase.phase_number,
      phase_name: phase.name,
      event_date: format(currentDate, 'yyyy-MM-dd'),
      event_type: 'phase_start',
      title: i18n.t("health.assignProtocolDialog.calendarEvents.phaseStartTitle", { number: phase.phase_number, name: phase.name }),
      description: phase.description || null,
    });

    // Calculate phase end date (using average of min/max duration)
    const avgDuration = Math.round(
      ((phase.duration_days_min || 7) + (phase.duration_days_max || 14)) / 2
    );
    
    const phaseEndDate = addDays(currentDate, avgDuration);
    
    // Create phase end/checkpoint event
    events.push({
      player_rehab_protocol_id: playerRehabProtocolId,
      player_id: playerId,
      category_id: categoryId,
      phase_id: phase.id,
      phase_number: phase.phase_number,
      phase_name: phase.name,
      event_date: format(phaseEndDate, 'yyyy-MM-dd'),
      event_type: 'checkpoint',
      title: i18n.t("health.assignProtocolDialog.calendarEvents.checkpointTitle", { number: phase.phase_number, name: phase.name }),
      description: i18n.t("health.assignProtocolDialog.calendarEvents.checkpointDescription", { name: phase.name }),
    });

    // Move to next phase
    currentDate = addDays(phaseEndDate, 1);
  }

  // Insert all events
  if (events.length > 0) {
    const { error } = await supabase
      .from("rehab_calendar_events")
      .insert(events);
    
    if (error) {
      console.error("Error creating calendar events:", error);
      throw error;
    }
  }

  return events;
}

export function AssignProtocolDialog({
  open,
  onOpenChange,
  playerId,
  injuryId,
  categoryId,
  injuryType,
}: AssignProtocolDialogProps) {
  const { t } = useTranslation();
  const [selectedMode, setSelectedMode] = useState<"existing" | "template">("existing");
  const [selectedProtocolId, setSelectedProtocolId] = useState("");
  const [selectedInjuryType, setSelectedInjuryType] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  // Find matching injury type from constants
  const matchingInjury = RUGBY_INJURY_TYPES.find(
    i => i.name.toLowerCase() === injuryType.toLowerCase()
  );

  // Fetch existing protocols for this category (with phases)
  const { data: existingProtocols } = useQuery({
    queryKey: ["injury-protocols-with-phases", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("injury_protocols")
        .select(`
          *,
          protocol_phases (
            id,
            phase_number,
            name,
            description,
            duration_days_min,
            duration_days_max
          )
        `)
        .or(`is_system_default.eq.true,category_id.eq.${categoryId}`)
        .order("name");
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const assignExistingProtocol = useMutation({
    mutationFn: async () => {
      if (!selectedProtocolId) throw new Error(t("health.assignProtocolDialog.toastNoProtocolSelected"));

      // Get protocol phases
      const selectedProtocol = existingProtocols?.find(p => p.id === selectedProtocolId);
      const phases = selectedProtocol?.protocol_phases || [];

      // Assign protocol to player's injury
      const { data: rehabProtocol, error: assignError } = await supabase
        .from("player_rehab_protocols")
        .insert({
          player_id: playerId,
          injury_id: injuryId,
          protocol_id: selectedProtocolId,
          category_id: categoryId,
          current_phase: 1,
          status: "in_progress",
          notes: notes || null,
        })
        .select()
        .single();

      if (assignError) throw assignError;

      // Copy exercises from protocol template to player-specific table
      await copyProtocolExercisesToPlayer(rehabProtocol.id, selectedProtocolId);

      // Create calendar events for each phase
      if (phases.length > 0) {
        await createCalendarEvents(
          rehabProtocol.id,
          playerId,
          categoryId,
          phases
        );
      }

      return rehabProtocol;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-rehab-protocol", injuryId] });
      queryClient.invalidateQueries({ queryKey: ["rehab-calendar-events", playerId] });
      toast.success(t("health.assignProtocolDialog.toastAssignSuccess"));
      handleClose();
    },
    onError: (error) => {
      console.error("Error assigning protocol:", error);
      toast.error(t("health.assignProtocolDialog.toastAssignError"));
    },
  });

  const assignFromTemplate = useMutation({
    mutationFn: async () => {
      const selectedType = RUGBY_INJURY_TYPES.find(i => i.name === selectedInjuryType);
      if (!selectedType) throw new Error(t("health.assignProtocolDialog.toastInjuryTypeNotFound"));

      // Check if protocol already exists
      let protocolId: string;
      let phases: Array<{ id: string; phase_number: number; name: string; description?: string; duration_days_min?: number; duration_days_max?: number }> = [];
      
      const existingProtocol = existingProtocols?.find(
        p => p.name === selectedType.name && (p.is_system_default || p.category_id === categoryId)
      );

      if (existingProtocol) {
        protocolId = existingProtocol.id;
        phases = existingProtocol.protocol_phases || [];
      } else {
        // Create new protocol for this category
        const { data: newProtocol, error: protocolError } = await supabase
          .from("injury_protocols")
          .insert({
            name: selectedType.name,
            injury_category: selectedType.category,
            typical_duration_days_min: selectedType.durationMin,
            typical_duration_days_max: selectedType.durationMax,
            description: selectedType.description,
            category_id: categoryId,
            is_system_default: false,
          })
          .select()
          .single();

        if (protocolError) throw protocolError;
        protocolId = newProtocol.id;

        // Create default phases based on injury category
        const defaultPhases = DEFAULT_REHAB_PHASES[selectedType.category as keyof typeof DEFAULT_REHAB_PHASES] 
          || DEFAULT_REHAB_PHASES.musculaire;

        for (const phase of defaultPhases) {
          const { data: newPhase, error: phaseError } = await supabase
            .from("protocol_phases")
            .insert({
              protocol_id: protocolId,
              phase_number: phase.phase_number,
              name: phase.name,
              description: phase.description,
              duration_days_min: phase.duration_days_min,
              duration_days_max: phase.duration_days_max,
              objectives: phase.objectives,
              exit_criteria: phase.exit_criteria,
            })
            .select()
            .single();

          if (phaseError) throw phaseError;

          // Add to phases array for calendar events
          phases.push({
            id: newPhase.id,
            phase_number: phase.phase_number,
            name: phase.name,
            description: phase.description,
            duration_days_min: phase.duration_days_min,
            duration_days_max: phase.duration_days_max,
          });

          // Create default exercises for this phase
          for (let i = 0; i < phase.exercises.length; i++) {
            const exercise = phase.exercises[i];
            const { error: exerciseError } = await supabase
              .from("protocol_exercises")
              .insert({
                phase_id: newPhase.id,
                name: exercise.name,
                description: exercise.description,
                sets: exercise.sets,
                reps: exercise.reps,
                frequency: exercise.frequency,
                exercise_order: i,
              });

            if (exerciseError) throw exerciseError;
          }
        }
      }

      // Assign protocol to player's injury
      const { data: rehabProtocol, error: assignError } = await supabase
        .from("player_rehab_protocols")
        .insert({
          player_id: playerId,
          injury_id: injuryId,
          protocol_id: protocolId,
          category_id: categoryId,
          current_phase: 1,
          status: "in_progress",
          notes: notes || null,
        })
        .select()
        .single();

      if (assignError) throw assignError;

      // Copy exercises from protocol template to player-specific table
      await copyProtocolExercisesToPlayer(rehabProtocol.id, protocolId);

      // Create calendar events for each phase
      if (phases.length > 0) {
        await createCalendarEvents(
          rehabProtocol.id,
          playerId,
          categoryId,
          phases
        );
      }

      return rehabProtocol;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-rehab-protocol", injuryId] });
      queryClient.invalidateQueries({ queryKey: ["injury-protocols-with-phases", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["rehab-calendar-events", playerId] });
      toast.success(t("health.assignProtocolDialog.toastCreateSuccess"));
      handleClose();
    },
    onError: (error) => {
      console.error("Error creating protocol:", error);
      toast.error(t("health.assignProtocolDialog.toastCreateError"));
    },
  });

  const handleClose = () => {
    setSelectedProtocolId("");
    setSelectedInjuryType("");
    setNotes("");
    setSelectedMode("existing");
    onOpenChange(false);
  };

  const selectedProtocol = existingProtocols?.find(p => p.id === selectedProtocolId);
  const selectedType = RUGBY_INJURY_TYPES.find(i => i.name === selectedInjuryType);
  
  const getCategoryLabel = (value: string) => {
    return INJURY_CATEGORIES.find(c => c.value === value)?.label || value;
  };

  // Group protocols by category for better display
  const protocolsByCategory = existingProtocols?.reduce((acc, protocol) => {
    const cat = protocol.injury_category || "autre";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(protocol);
    return acc;
  }, {} as Record<string, typeof existingProtocols>);

  const hasExistingProtocols = existingProtocols && existingProtocols.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            {t("health.assignProtocolDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("health.assignProtocolDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 text-sm">
          <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-blue-700 dark:text-blue-300">
            {t("health.assignProtocolDialog.calendarNotice")}
          </span>
        </div>

        <Tabs value={selectedMode} onValueChange={(v) => setSelectedMode(v as any)} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t("health.assignProtocolDialog.tabs.existing")}
            </TabsTrigger>
            <TabsTrigger value="template" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {t("health.assignProtocolDialog.tabs.template")}
            </TabsTrigger>
          </TabsList>

          {/* Existing Protocol Tab */}
          <TabsContent value="existing" className="space-y-4 mt-4">
            {!hasExistingProtocols ? (
              <div className="p-6 text-center bg-muted/50 rounded-lg">
                <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground mb-2">{t("health.assignProtocolDialog.noProtocolsTitle")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("health.assignProtocolDialog.noProtocolsDescription")}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>{t("health.assignProtocolDialog.selectProtocol")}</Label>
                  <Select value={selectedProtocolId} onValueChange={setSelectedProtocolId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("health.assignProtocolDialog.choosePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {Object.entries(protocolsByCategory || {}).map(([category, protocols]) => (
                        <div key={category}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                            {getCategoryLabel(category)}
                          </div>
                          {protocols?.map((protocol) => (
                            <SelectItem key={protocol.id} value={protocol.id}>
                              <div className="flex items-center gap-2">
                                <span>{protocol.name}</span>
                                {protocol.is_system_default && (
                                  <Badge variant="outline" className="text-xs">{t("health.assignProtocolDialog.systemBadge")}</Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {t("health.assignProtocolDialog.phasesCount", { count: protocol.protocol_phases?.length || 0 })}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProtocol && (
                  <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{selectedProtocol.name}</span>
                      <Badge>{getCategoryLabel(selectedProtocol.injury_category)}</Badge>
                    </div>
                    {selectedProtocol.description && (
                      <p className="text-sm text-muted-foreground">
                        {selectedProtocol.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>
                        {t("health.assignProtocolDialog.duration", { min: selectedProtocol.typical_duration_days_min, max: selectedProtocol.typical_duration_days_max })}
                      </span>
                    </div>
                    {selectedProtocol.protocol_phases && selectedProtocol.protocol_phases.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">{t("health.assignProtocolDialog.phasesWillBeAdded")}</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedProtocol.protocol_phases
                            .sort((a: any, b: any) => a.phase_number - b.phase_number)
                            .map((phase: any) => (
                              <Badge key={phase.id} variant="secondary" className="text-xs">
                                {phase.phase_number}. {phase.name}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes-existing">{t("health.assignProtocolDialog.notesLabel")}</Label>
              <Textarea
                id="notes-existing"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("health.assignProtocolDialog.notesPlaceholder")}
                rows={2}
              />
            </div>
          </TabsContent>

          {/* Template Tab */}
          <TabsContent value="template" className="space-y-4 mt-4">
            {matchingInjury && (
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm">
                  <span className="font-medium">{t("health.assignProtocolDialog.suggestionBasedOnInjury")}</span> {matchingInjury.name}
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 h-auto"
                  onClick={() => setSelectedInjuryType(matchingInjury.name)}
                >
                  {t("health.assignProtocolDialog.useSuggestion")}
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t("health.assignProtocolDialog.injuryTypeTemplate")}</Label>
              <Select value={selectedInjuryType} onValueChange={setSelectedInjuryType}>
                <SelectTrigger>
                  <SelectValue placeholder={t("health.assignProtocolDialog.selectInjuryTypePlaceholder")} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {RUGBY_INJURY_TYPES.map((injury) => (
                    <SelectItem key={injury.name} value={injury.name}>
                      <div className="flex items-center gap-2">
                        <span>{injury.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {injury.category}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedType && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{selectedType.name}</span>
                  <Badge>{selectedType.category}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedType.description}
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    {t("health.addInjuryDialog.typicalDuration", { min: selectedType.durationMin, max: selectedType.durationMax })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("health.assignProtocolDialog.templateHint")}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes-template">{t("health.assignProtocolDialog.notesLabel")}</Label>
              <Textarea
                id="notes-template"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("health.assignProtocolDialog.notesPlaceholder")}
                rows={2}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose}>
            {t("health.assignProtocolDialog.cancel")}
          </Button>
          {selectedMode === "existing" ? (
            <Button
              onClick={() => assignExistingProtocol.mutate()}
              disabled={!selectedProtocolId || assignExistingProtocol.isPending}
            >
              {assignExistingProtocol.isPending ? t("health.assignProtocolDialog.assigning") : t("health.assignProtocolDialog.assignProtocol")}
            </Button>
          ) : (
            <Button
              onClick={() => assignFromTemplate.mutate()}
              disabled={!selectedInjuryType || assignFromTemplate.isPending}
            >
              {assignFromTemplate.isPending ? t("health.assignProtocolDialog.creating") : t("health.assignProtocolDialog.createAndAssign")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
