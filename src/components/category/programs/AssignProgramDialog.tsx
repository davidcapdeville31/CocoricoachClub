import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Users, Calendar, Search, CalendarPlus } from "lucide-react";
import { format, addDays, startOfWeek, addWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";

interface AssignProgramDialogProps {
  categoryId: string;
  programId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProgramSession {
  id: string;
  session_number: number;
  name: string;
  scheduled_day?: number;
}

interface ProgramWeek {
  id: string;
  week_number: number;
  program_sessions: ProgramSession[];
}

export function AssignProgramDialog({
  categoryId,
  programId,
  open,
  onOpenChange,
}: AssignProgramDialogProps) {
  const queryClient = useQueryClient();
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [addToCalendar, setAddToCalendar] = useState(true);

  // Fetch players
  const { data: players } = useQuery({
    queryKey: ["players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, position")
        .eq("category_id", categoryId)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // Fetch program structure for calendar creation
  const { data: programStructure } = useQuery({
    queryKey: ["program-structure", programId],
    queryFn: async () => {
      const { data: program, error: programError } = await supabase
        .from("training_programs")
        .select("name, theme")
        .eq("id", programId)
        .single();

      if (programError) throw programError;

      const { data: weeks, error: weeksError } = await supabase
        .from("program_weeks")
        .select(`
          id,
          week_number,
          program_sessions (
            id,
            session_number,
            name,
            scheduled_day
          )
        `)
        .eq("program_id", programId)
        .order("week_number");

      if (weeksError) throw weeksError;

      return { program, weeks: weeks as ProgramWeek[] };
    },
    enabled: open,
  });

  // Fetch existing assignments
  const { data: existingAssignments } = useQuery({
    queryKey: ["program-assignments", programId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_assignments")
        .select("player_id, is_active")
        .eq("program_id", programId);

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existingAssignments) {
      const activePlayerIds = existingAssignments
        .filter((a) => a.is_active)
        .map((a) => a.player_id);
      setSelectedPlayers(new Set(activePlayerIds));
    }
  }, [existingAssignments]);

  const filteredPlayers = players?.filter((player) =>
    player.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const togglePlayer = (playerId: string) => {
    const newSelected = new Set(selectedPlayers);
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId);
    } else {
      newSelected.add(playerId);
    }
    setSelectedPlayers(newSelected);
  };

  const selectAll = () => {
    if (filteredPlayers) {
      setSelectedPlayers(new Set(filteredPlayers.map((p) => p.id)));
    }
  };

  const selectNone = () => {
    setSelectedPlayers(new Set());
  };

  // Calculate dates for calendar based on program structure
  const calculateSessionDates = () => {
    if (!programStructure?.weeks) return [];

    const dates: { weekNumber: number; session: ProgramSession; date: Date }[] = [];
    const programStartDate = new Date(startDate);
    const weekStart = startOfWeek(programStartDate, { weekStartsOn: 1 }); // Monday

    programStructure.weeks.forEach((week) => {
      const weekOffset = week.week_number - 1;
      const currentWeekStart = addWeeks(weekStart, weekOffset);

      week.program_sessions?.forEach((session) => {
        let sessionDate: Date;
        
        if (session.scheduled_day) {
          // Use the scheduled day (1 = Monday, 7 = Sunday)
          sessionDate = addDays(currentWeekStart, session.scheduled_day - 1);
        } else {
          // Default: space sessions evenly across the week
          const sessionIndex = session.session_number - 1;
          const daysPerSession = Math.floor(7 / (week.program_sessions?.length || 1));
          sessionDate = addDays(currentWeekStart, sessionIndex * daysPerSession);
        }

        dates.push({
          weekNumber: week.week_number,
          session,
          date: sessionDate,
        });
      });
    });

    return dates;
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      // Remove existing assignments
      await supabase
        .from("program_assignments")
        .delete()
        .eq("program_id", programId);

      // Add new assignments
      if (selectedPlayers.size > 0) {
        const assignments = Array.from(selectedPlayers).map((playerId) => ({
          program_id: programId,
          player_id: playerId,
          start_date: startDate,
          is_active: true,
        }));

        const { error } = await supabase
          .from("program_assignments")
          .insert(assignments);

        if (error) throw error;

        // Add sessions to calendar if enabled
        if (addToCalendar && programStructure) {
          const sessionDates = calculateSessionDates();
          
          // Determine training type based on program theme
          const trainingType = programStructure.program?.theme === "terrain" 
            ? "collectif" 
            : "musculation";

          for (const { session, date } of sessionDates) {
            const sessionDate = format(date, "yyyy-MM-dd");

            // Create training session
            const { data: trainingSession, error: sessionError } = await supabase
              .from("training_sessions")
              .insert({
                category_id: categoryId,
                session_date: sessionDate,
                training_type: trainingType,
                notes: `Programme: ${programStructure.program?.name} - ${session.name}`,
              })
              .select()
              .single();

            if (sessionError) {
              console.error("Error creating training session:", sessionError);
              continue;
            }

            // Create attendance records for selected players
            const attendanceRecords = Array.from(selectedPlayers).map((playerId) => ({
              player_id: playerId,
              category_id: categoryId,
              attendance_date: sessionDate,
              training_session_id: trainingSession.id,
              status: "present" as const,
            }));

            await supabase.from("training_attendance").insert(attendanceRecords);
          }
        }
      }

      toast.success(
        selectedPlayers.size > 0
          ? `Programme assigné à ${selectedPlayers.size} joueur(s)${addToCalendar ? " et ajouté au calendrier" : ""}`
          : "Assignations supprimées"
      );

      queryClient.invalidateQueries({ queryKey: ["training-programs"] });
      queryClient.invalidateQueries({ queryKey: ["program-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["training-sessions"] });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error("Erreur lors de l'assignation");
    } finally {
      setSaving(false);
    }
  };

  const sessionDates = calculateSessionDates();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Assigner le programme
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Start date */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Date de début
            </Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* Add to calendar toggle */}
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <CalendarPlus className="h-4 w-4 text-primary" />
              <div>
                <Label className="text-sm font-medium">Ajouter au calendrier</Label>
                <p className="text-xs text-muted-foreground">
                  Crée automatiquement les séances dans le calendrier
                </p>
              </div>
            </div>
            <Switch checked={addToCalendar} onCheckedChange={setAddToCalendar} />
          </div>

          {/* Preview calendar dates */}
          {addToCalendar && sessionDates.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Aperçu des séances ({sessionDates.length})
              </Label>
              <ScrollArea className="h-32 border rounded-md">
                <div className="p-2 space-y-1">
                  {sessionDates.slice(0, 10).map(({ weekNumber, session, date }, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-1 bg-muted/30 rounded">
                      <span className="font-medium">
                        S{weekNumber} - {session.name}
                      </span>
                      <span className="text-muted-foreground">
                        {format(date, "EEEE d MMM", { locale: fr })}
                      </span>
                    </div>
                  ))}
                  {sessionDates.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center py-1">
                      +{sessionDates.length - 10} autres séances...
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Player selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Joueurs ({selectedPlayers.size} sélectionnés)</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  Tous
                </Button>
                <Button variant="ghost" size="sm" onClick={selectNone}>
                  Aucun
                </Button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un joueur..."
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-48 border rounded-md">
              <div className="p-2 space-y-1">
                {filteredPlayers?.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 p-2 hover:bg-muted rounded-md cursor-pointer"
                    onClick={() => togglePlayer(player.id)}
                  >
                    <Checkbox
                      checked={selectedPlayers.has(player.id)}
                      onCheckedChange={() => togglePlayer(player.id)}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{player.name}</p>
                      {player.position && (
                        <p className="text-xs text-muted-foreground">{player.position}</p>
                      )}
                    </div>
                  </div>
                ))}

                {filteredPlayers?.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    Aucun joueur trouvé
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
