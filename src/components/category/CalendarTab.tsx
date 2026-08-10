import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ColoredSubTabsList, ColoredSubTabsTrigger, ColoredContentCard, ColoredCardHeader, ColoredTitle } from "@/components/ui/colored-subtabs";
import { Calendar as CalendarIcon, Target, BarChart3, Dumbbell, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { SessionFormDialog } from "./sessions/SessionFormDialog";
import { SessionEditorV2 } from "@/components/program-builder-v2/SessionEditorV2";
import { AddMatchCalendarDialog } from "./matches/AddMatchCalendarDialog";
import { ScheduleTestEventDialog } from "./calendar/ScheduleTestEventDialog";

import { SessionDetailsDialog } from "./SessionDetailsDialog";
import { MatchRpeDialog } from "./MatchRpeDialog";
import { MatchLineupDialog } from "./matches/MatchLineupDialog";
import { EditMatchDialog } from "./matches/EditMatchDialog";
import { DailySessionsDialog } from "./DailySessionsDialog";
import { format, isSameDay, startOfWeek, addDays } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SeasonObjectivesSection } from "@/components/planning/SeasonObjectivesSection";
import { BowlingTrainingStats } from "@/components/bowling/BowlingTrainingStats";
import { TennisTrainingStats } from "@/components/tennis/TennisTrainingStats";
import { PrecisionTrainingStats } from "@/components/training/PrecisionTrainingStats";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";
import { exportCalendarToPdf, printElement } from "@/lib/pdfExport";
import { getTrainingTypesForSport, TRAINING_TYPE_COLORS } from "@/lib/constants/trainingTypes";
import { DisabledTabTrigger } from "@/components/ui/disabled-tab-trigger";
import { useViewerSessions, useViewerMatches } from "@/hooks/use-viewer-data";
import { ImprovedCalendarView } from "./calendar/ImprovedCalendarView";
import { FieldSessionDialog } from "./calendar/FieldSessionDialog";
import { EditAdminEventDialog, ADMIN_EVENT_TYPES } from "./calendar/EditAdminEventDialog";
import { AnnualPlanningView } from "@/components/planning/AnnualPlanningView";
import { useUnreadAthleteSessionsCount } from "@/lib/hooks/useUnreadAthleteSessionsCount";
import { useSessionNotifications } from "@/lib/hooks/useSessionNotifications";
import { useSeasonRosterFilter } from "@/contexts/SeasonRosterFilterContext";
import { SeasonRosterFilterToggle } from "./SeasonRosterFilterToggle";
import { CreateEventDialog } from "./calendar/CreateEventDialog";
import { parseMentalFromNotes } from "@/lib/utils/sessionNotes";

interface CalendarTabProps {
  categoryId: string;
}

export function CalendarTab({ categoryId }: CalendarTabProps) {
  const athleteSessionsBadge = useUnreadAthleteSessionsCount(categoryId);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addSessionDate, setAddSessionDate] = useState<string | undefined>();
  const [isAddMatchDialogOpen, setIsAddMatchDialogOpen] = useState(false);
  const [addMatchDate, setAddMatchDate] = useState<Date | undefined>();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<any | null>(null);
  const [editingAdminEvent, setEditingAdminEvent] = useState<any | null>(null);
  const [editingTestSession, setEditingTestSession] = useState<{ id: string; date: Date } | null>(null);
  const [editingMentalSession, setEditingMentalSession] = useState<{
    id: string;
    title: string;
    durationMin: number;
    theme: string;
    notes: string;
    date: Date;
  } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [isDailyDialogOpen, setIsDailyDialogOpen] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedSession, setSelectedSession] = useState<{
    id: string;
    date: string;
    type: "test" | "training";
  } | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<{
    id: string;
    date: string;
    opponent: string;
  } | null>(null);
  const [lineupMatchId, setLineupMatchId] = useState<string | null>(null);
  const [editingMatch, setEditingMatch] = useState<any | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isViewer } = useViewerModeContext();
  const { notify } = useSessionNotifications();
  const calendarContentRef = useRef<HTMLDivElement>(null);
  const isFieldSession = (session?: { training_type?: string | null } | null) =>
    session?.training_type === "terrain";
  const isV2EditableSession = (session?: { training_type?: string | null; notes?: string | null } | null) => {
    const trainingType = session?.training_type;
    const notes = session?.notes || "";
    if (trainingType === "musculation" || trainingType === "course") return true;
    // Any session built with the V2 builder (contains v2 markers in notes)
    if (/<!--\s*v2-(meta|fartlek|cluster|stato|intermittent)/i.test(notes)) return true;
    return false;
  };

  // Mental sessions are created with a dedicated form (titre, temps de travail,
  // thématique, notes, participants) — reopen that same form when editing.
  const openMentalEditor = (row: { id: string; session_date: string; notes?: string | null }) => {
    const rawNotes = row.notes || "";
    const meta = parseMentalFromNotes(rawNotes);
    const durationMin = Number(meta?.duration_min) || 30;
    const theme = meta?.theme || "";
    const cleaned = rawNotes.replace(/<!--[\s\S]*?-->\n?/g, "");
    const lines = cleaned.split("\n");
    const firstLine = (lines[0] || "Séance mental").trim();
    const title = theme && firstLine.endsWith(` - ${theme}`)
      ? firstLine.slice(0, -(` - ${theme}`).length)
      : firstLine;
    setEditingMentalSession({
      id: row.id,
      title,
      durationMin,
      theme,
      notes: lines.slice(1).join("\n").trim(),
      date: new Date(row.session_date),
    });
  };



  const handleExportPdf = async () => {
    if (sessions && matches) {
      await exportCalendarToPdf(
        sessions,
        matches,
        category?.name || "Catégorie",
        { from: currentWeek, to: currentWeek },
        {
          clubName: (category as any)?.clubs?.name ?? null,
          categoryName: category?.name ?? null,
          seasonName: activeSeasonName ?? null,
        }
      );
      toast.success("PDF exporté avec succès");
    }
  };


  const handlePrint = () => {
    // Use the calendar ref if available, otherwise fall back to PDF export
    if (calendarContentRef.current) {
      printElement(calendarContentRef.current, "Calendrier Global");
    } else {
      // Fallback: export PDF which works without ref
      handleExportPdf();
    }
  };

  // Handle day click to open daily dialog
  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setIsDailyDialogOpen(true);
  };

  // Get sessions for a specific date
  const getSessionsForDate = (date: Date) => {
    return sessions?.filter((session) =>
      isSameDay(new Date(session.session_date), date)
    ) || [];
  };

  // Get matches for a specific date
  const getMatchesForDate = (date: Date) => {
    return matches?.filter((match) => {
      const matchStart = new Date(match.match_date);
      if (match.end_date && match.end_date !== match.match_date) {
        const matchEnd = new Date(match.end_date);
        const dayOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const startOnly = new Date(matchStart.getFullYear(), matchStart.getMonth(), matchStart.getDate());
        const endOnly = new Date(matchEnd.getFullYear(), matchEnd.getMonth(), matchEnd.getDate());
        return dayOnly >= startOnly && dayOnly <= endOnly;
      }
      return isSameDay(matchStart, date);
    }) || [];
  };

  // Get planning items for a specific date
  const getPlanningForDate = (date: Date) => {
    return weeklyPlanning?.filter((item) =>
      isSameDay(getWeeklyPlanningDate(item), date)
    ) || [];
  };

  // Reschedule session mutation with optimistic update
  const rescheduleSession = useMutation({
    mutationFn: async ({ sessionId, newDate }: { sessionId: string; newDate: Date }) => {
      const { error } = await supabase
        .from("training_sessions")
        .update({ session_date: format(newDate, "yyyy-MM-dd") })
        .eq("id", sessionId);
      if (error) throw error;
      return { sessionId, newDate };
    },
    onMutate: async ({ sessionId, newDate }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["training_sessions", categoryId] });
      
      // Snapshot the previous value
      const previousSessions = queryClient.getQueryData(["training_sessions", categoryId]);
      
      // Optimistically update to the new value
      queryClient.setQueryData(["training_sessions", categoryId], (old: any[]) => {
        if (!old) return old;
        return old.map((session) => 
          session.id === sessionId 
            ? { ...session, session_date: format(newDate, "yyyy-MM-dd") }
            : session
        );
      });
      
      return { previousSessions };
    },
    onSuccess: async ({ sessionId, newDate }) => {
      toast.success("Séance décalée avec succès");
      setIsDailyDialogOpen(false);

      // 🔔 Notify athletes of schedule change
      try {
        const { data: info } = await supabase
          .from("training_sessions")
          .select("session_start_time, training_type, category_id")
          .eq("id", sessionId)
          .maybeSingle();
        notify({
          action: "updated",
          sessionId,
          categoryId: info?.category_id || categoryId,
          sessionDate: format(newDate, "yyyy-MM-dd"),
          sessionStartTime: info?.session_start_time || null,
          sessionType: info?.training_type,
        }).catch((e) => console.warn("[CalendarTab] reschedule notify failed:", e));
      } catch (e) {
        console.warn("[CalendarTab] reschedule notify lookup failed:", e);
      }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousSessions) {
        queryClient.setQueryData(["training_sessions", categoryId], context.previousSessions);
      }
      toast.error("Erreur lors du décalage de la séance");
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["today_sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["today_session_exercises"] });
    },
  });

  // Fetch category to get sport type + names for exports
  const { data: category } = useQuery({
    queryKey: ["category-sport-type", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("rugby_type, name, clubs(name)")
        .eq("id", categoryId)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  // Get training types based on sport type
  const sportType = category?.rugby_type;

  const trainingTypes = useMemo(() => getTrainingTypesForSport(sportType), [sportType]);
  
  // Create labels and colors maps from training types
  const trainingTypeLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    trainingTypes.forEach(t => {
      labels[t.value] = t.label;
    });
    return labels;
  }, [trainingTypes]);

  const { data: sessionsRaw, isLoading: isLoadingSessions } = useViewerSessions(categoryId);

  const { data: matchesRaw, isLoading: isLoadingMatches } = useViewerMatches(categoryId);

  const { data: weeklyPlanningRaw, isLoading: isLoadingPlanning } = useQuery({
    queryKey: ["weekly-planning-all", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_planning")
        .select(`
          *,
          template:session_templates(name, session_type, duration_minutes, intensity)
        `)
        .eq("category_id", categoryId);
      if (error) throw error;
      return data;
    },
  });

  // Filtre par saison active : ne garder que les éléments dans la fenêtre de dates de la saison.
  const { isDateInActiveSeason, activeSeasonOnly, activeSeasonName } = useSeasonRosterFilter();
  const sessions = useMemo(
    () => (sessionsRaw || []).filter((s: any) => isDateInActiveSeason(s.session_date)),
    [sessionsRaw, isDateInActiveSeason],
  );
  const matches = useMemo(
    () =>
      (matchesRaw || [])
        // Exclure les conteneurs techniques d'entraînement (scores frame par frame)
        .filter((m: any) => m.event_type !== "training")
        .filter((m: any) => isDateInActiveSeason(m.match_date)),
    [matchesRaw, isDateInActiveSeason],
  );
  const weeklyPlanning = useMemo(() => {
    return (weeklyPlanningRaw || []).filter((w: any) => {
      const ws = startOfWeek(new Date(w.week_start_date), { weekStartsOn: 1 });
      const d = addDays(ws, w.day_of_week ?? 0);
      return isDateInActiveSeason(d);
    });
  }, [weeklyPlanningRaw, isDateInActiveSeason]);

  // Deep-link depuis une notification : ?session=<id> ouvre directement la séance
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkSessionId = searchParams.get("session");
  const handledDeepLinkRef = useRef<string | null>(null);
  useEffect(() => {
    if (!deepLinkSessionId || handledDeepLinkRef.current === deepLinkSessionId) return;
    const target = (sessionsRaw || []).find((s: any) => s.id === deepLinkSessionId);
    if (!target) return;
    handledDeepLinkRef.current = deepLinkSessionId;
    setSelectedSession({
      id: target.id,
      date: target.session_date,
      type: "training",
    });
    setCurrentWeek(new Date(target.session_date));
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("session");
        return next;
      },
      { replace: true },
    );
  }, [deepLinkSessionId, sessionsRaw, setSearchParams]);


  const deleteSession = useMutation({
    mutationFn: async (sessionId: string) => {
      // Fetch session info + participants BEFORE delete so we can notify athletes
      // (event_participants / training_attendance are cascade-deleted with the session)
      const { data: sessionInfo } = await supabase
        .from("training_sessions")
        .select("id, category_id, session_date, session_start_time, training_type")
        .eq("id", sessionId)
        .maybeSingle();

      const [{ data: eventParts }, { data: attendance }] = await Promise.all([
        supabase.from("event_participants").select("player_id").eq("training_session_id", sessionId),
        supabase.from("training_attendance").select("player_id").eq("training_session_id", sessionId).neq("status", "absent"),
      ]);
      const participantIds = Array.from(new Set([
        ...(attendance ?? []).map((a: any) => a.player_id),
        ...(eventParts ?? []).map((p: any) => p.player_id),
      ].filter(Boolean))) as string[];

      const { error } = await supabase
        .from("training_sessions")
        .delete()
        .eq("id", sessionId);
      if (error) throw error;
      return { sessionId, sessionInfo, participantIds };
    },
    onMutate: async (sessionId) => {
      await queryClient.cancelQueries({ queryKey: ["sessions", categoryId] });
      const previousSessions = queryClient.getQueryData(["sessions", categoryId]);
      queryClient.setQueryData(["sessions", categoryId], (old: any[]) => {
        if (!old) return old;
        return old.filter((s) => s.id !== sessionId);
      });
      return { previousSessions };
    },
    onSuccess: ({ sessionId, sessionInfo, participantIds }) => {
      toast.success("Séance supprimée avec succès");

      // 🔔 Notify athletes of cancellation (participants captured before delete)
      if (sessionInfo && participantIds.length > 0) {
        notify({
          action: "cancelled",
          sessionId,
          categoryId: sessionInfo.category_id,
          sessionDate: sessionInfo.session_date,
          sessionStartTime: sessionInfo.session_start_time,
          sessionType: sessionInfo.training_type,
          participantPlayerIds: participantIds,
        }).catch((e) => console.warn("[CalendarTab] cancel notify failed:", e));
      }
    },

    onError: (error, variables, context) => {
      if (context?.previousSessions) {
        queryClient.setQueryData(["sessions", categoryId], context.previousSessions);
      }
      toast.error("Erreur lors de la suppression de la séance");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["today_sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["today_session_exercises"] });
    },
  });

  const deleteMatch = useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await supabase
        .from("matches")
        .delete()
        .eq("id", matchId);
      if (error) throw error;
      return matchId;
    },
    onMutate: async (matchId) => {
      await queryClient.cancelQueries({ queryKey: ["matches", categoryId] });
      const previousMatches = queryClient.getQueryData(["matches", categoryId]);
      queryClient.setQueryData(["matches", categoryId], (old: any[]) => {
        if (!old) return old;
        return old.filter((m) => m.id !== matchId);
      });
      return { previousMatches };
    },
    onSuccess: () => {
      toast.success("Match supprimé avec succès");
    },
    onError: (error, variables, context) => {
      if (context?.previousMatches) {
        queryClient.setQueryData(["matches", categoryId], context.previousMatches);
      }
      toast.error("Erreur lors de la suppression du match");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["matches", categoryId] });
    },
  });

  // Helper to get actual date from weekly planning item
  const getWeeklyPlanningDate = (item: { week_start_date: string; day_of_week: number }) => {
    const weekStart = startOfWeek(new Date(item.week_start_date), { weekStartsOn: 1 });
    return addDays(weekStart, item.day_of_week);
  };


  const isLoading = isLoadingSessions || isLoadingMatches || isLoadingPlanning;

  if (isLoading) {
    return <p className="text-muted-foreground">Chargement...</p>;
  }

  const isBowling = (sportType || "").toLowerCase().includes("bowling");
  const isTennis = (sportType || "").toLowerCase().includes("tennis");

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <SeasonRosterFilterToggle />
      </div>
      {activeSeasonOnly && activeSeasonName && (
        <p className="text-xs text-muted-foreground italic -mt-3">
          Calendrier filtré sur la saison active : {activeSeasonName}.
        </p>
      )}
      <Tabs defaultValue="annual" className="space-y-4">
        <div className="flex justify-center">
          <ColoredSubTabsList colorKey="planification" className="inline-flex w-max">
          <ColoredSubTabsTrigger value="annual" colorKey="planification" icon={<LayoutGrid className="h-4 w-4" />} tooltip="Planification annuelle : cycles de périodisation, macrocycles et calendrier des compétitions sur l'année">
            <span className="hidden sm:inline">Vue Annuelle</span>
            <span className="sm:hidden">Annuel</span>
          </ColoredSubTabsTrigger>
          <ColoredSubTabsTrigger value="global" colorKey="planification" icon={<CalendarIcon className="h-4 w-4" />} tooltip="Calendrier hebdomadaire interactif avec les séances, matchs et événements jour par jour">
            <span className="relative inline-flex items-center">
              <span className="hidden sm:inline">Calendrier Global</span>
              <span className="sm:hidden">Global</span>
              {athleteSessionsBadge > 0 && (
                <span className="absolute -top-1.5 -right-2 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background animate-pulse" />
              )}
            </span>
          </ColoredSubTabsTrigger>
          {!isViewer && (
            <ColoredSubTabsTrigger value="objectives" colorKey="planification" icon={<Target className="h-4 w-4" />} tooltip="Définir et suivre les objectifs de saison pour l'équipe et chaque athlète">
              <span className="hidden sm:inline">Objectifs</span>
              <span className="sm:hidden">Obj.</span>
            </ColoredSubTabsTrigger>
          )}
          </ColoredSubTabsList>
        </div>

        <TabsContent value="annual">
          <AnnualPlanningView categoryId={categoryId} />
        </TabsContent>

        <TabsContent value="global">
          <ImprovedCalendarView
            sessions={sessions || []}
            matches={matches || []}
            sportType={sportType}
            trainingTypeLabels={trainingTypeLabels}
            categoryId={categoryId}
            calendarRef={calendarContentRef}
            onDayClick={handleDayClick}
            onAddSession={(date) => {
              setAddSessionDate(date ? format(date, "yyyy-MM-dd") : undefined);
              setIsAddDialogOpen(true);
            }}
            onAddMatch={(date) => {
              setAddMatchDate(date);
              setIsAddMatchDialogOpen(true);
            }}
            onPrint={handlePrint}
            onExportPdf={handleExportPdf}
            isViewer={isViewer}
            onEditSession={(session) => {
              if (session.training_type === "test") {
                setEditingTestSession({
                  id: session.id,
                  date: new Date(session.session_date),
                });
                return;
              }
              supabase
                .from("training_sessions")
                .select("*")
                .eq("id", session.id)
                .single()
                .then(({ data }) => {
                  if (!data) return;
                  if (data.training_type === "mental") {
                    openMentalEditor(data);
                  } else if (ADMIN_EVENT_TYPES.includes(data.training_type)) {
                    setEditingAdminEvent(data);
                  } else {
                    setEditingSession(data);
                    setIsEditDialogOpen(true);
                  }
                });
            }}
            onViewSession={(session) => {
              setSelectedSession({
                id: session.id,
                date: session.session_date,
                type: session.training_type === "test" ? "test" : "training",
              });
            }}
            onViewMatch={(match) => {
              setSelectedMatch({
                id: match.id,
                date: match.match_date,
                opponent: match.opponent,
              });
            }}
            onDeleteSession={(sessionId) => deleteSession.mutate(sessionId)}
            onRescheduleSession={(sessionId, newDate) => {
              rescheduleSession.mutate({ sessionId, newDate });
            }}
            onDeleteMatch={(matchId) => deleteMatch.mutate(matchId)}
            onStatsMatch={(match) => {
              navigate(`/categories/${categoryId}?tab=competition`);
            }}
            onLineupMatch={(matchId) => setLineupMatchId(matchId)}
            onEditMatch={(match) => setEditingMatch(match)}
          />
        </TabsContent>


        {!isViewer && (
          <TabsContent value="objectives">
            <SeasonObjectivesSection categoryId={categoryId} />
          </TabsContent>
        )}
      </Tabs>

      {/* New Session Dialog (V2 builder) with optional default date */}
      <SessionEditorV2
        open={isAddDialogOpen}
        onClose={() => {
          setIsAddDialogOpen(false);
          setAddSessionDate(undefined);
        }}
        categoryId={categoryId}
        defaultDate={addSessionDate}
      />


      
      <AddMatchCalendarDialog
        open={isAddMatchDialogOpen}
        onOpenChange={(open) => {
          setIsAddMatchDialogOpen(open);
          if (!open) setAddMatchDate(undefined);
        }}
        categoryId={categoryId}
        sportType={sportType}
        defaultDate={addMatchDate}
      />

      {/* Edit Session Dialog */}
      <SessionEditorV2
        open={isEditDialogOpen && isV2EditableSession(editingSession) && !isFieldSession(editingSession)}
        onClose={() => {
          setIsEditDialogOpen(false);
          setEditingSession(null);
        }}
        categoryId={categoryId}
        editSession={editingSession}
      />

      <FieldSessionDialog
        open={isEditDialogOpen && isFieldSession(editingSession)}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setEditingSession(null);
        }}
        date={editingSession?.session_date ? new Date(editingSession.session_date) : new Date()}
        categoryId={categoryId}
        sportType={sportType}
        editSession={editingSession}
      />

      <SessionFormDialog
        open={isEditDialogOpen && !isV2EditableSession(editingSession) && !isFieldSession(editingSession)}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setEditingSession(null);
        }}
        categoryId={categoryId}
        editSession={editingSession}
      />

      {/* Edit Admin Event Dialog (medical, video, meeting) */}
      <EditAdminEventDialog
        open={!!editingAdminEvent}
        onOpenChange={(open) => !open && setEditingAdminEvent(null)}
        session={editingAdminEvent}
      />

      {/* Edit Test Session Dialog (uses the same UI as creation) */}
      {editingTestSession && (
        <ScheduleTestEventDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditingTestSession(null);
          }}
          date={editingTestSession.date}
          categoryId={categoryId}
          editSessionId={editingTestSession.id}
        />
      )}

      {/* Edit Mental Session Dialog (same form as creation) */}
      {editingMentalSession && (
        <CreateEventDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditingMentalSession(null);
          }}
          date={editingMentalSession.date}
          categoryId={categoryId}
          onAddSession={() => {}}
          onAddMatch={() => {}}
          editingMentalSession={editingMentalSession}
        />
      )}



      {selectedSession && (
        <SessionDetailsDialog
          open={true}
          onOpenChange={(open) => !open && setSelectedSession(null)}
          categoryId={categoryId}
          sessionId={selectedSession.id}
          sessionDate={selectedSession.date}
        />
      )}

      {selectedMatch && (
        <MatchRpeDialog
          open={true}
          onOpenChange={(open) => !open && setSelectedMatch(null)}
          categoryId={categoryId}
          matchId={selectedMatch.id}
          matchDate={selectedMatch.date}
          opponent={selectedMatch.opponent}
        />
      )}

      {selectedDate && (
        <DailySessionsDialog
          open={isDailyDialogOpen}
          onOpenChange={setIsDailyDialogOpen}
          date={selectedDate}
          sessions={getSessionsForDate(selectedDate)}
          matches={getMatchesForDate(selectedDate)}
          planning={getPlanningForDate(selectedDate)}
          onEditSession={(session) => {
            if (session.training_type === "test") {
              setEditingTestSession({
                id: session.id,
                date: new Date(session.session_date),
              });
              setIsDailyDialogOpen(false);
              return;
            }
            if (session.training_type === "mental") {
              openMentalEditor(session as any);
              setIsDailyDialogOpen(false);
              return;
            }
            setEditingSession(session);
            setIsEditDialogOpen(true);
            setIsDailyDialogOpen(false);
          }}
          onRescheduleSession={(sessionId, newDate) => {
            rescheduleSession.mutate({ sessionId, newDate });
          }}
          onViewMatch={(match) => {
            setSelectedMatch({
              id: match.id,
              date: match.match_date,
              opponent: match.opponent,
            });
            setIsDailyDialogOpen(false);
          }}
          onViewSession={(session) => {
            setSelectedSession({
              id: session.id,
              date: session.session_date,
              type: session.training_type === "test" ? "test" : "training",
            });
            setIsDailyDialogOpen(false);
          }}
          onDeleteMatch={(matchId) => deleteMatch.mutate(matchId)}
          onLineupMatch={(matchId) => {
            setLineupMatchId(matchId);
            setIsDailyDialogOpen(false);
          }}
          trainingTypeLabels={trainingTypeLabels}
          trainingTypeColors={TRAINING_TYPE_COLORS}
          isViewer={isViewer}
        />
      )}

      {editingMatch && (
        <EditMatchDialog
          open={true}
          onOpenChange={(open) => !open && setEditingMatch(null)}
          match={editingMatch}
          sportType={sportType}
        />
      )}

      {lineupMatchId && (
        <MatchLineupDialog
          open={true}
          onOpenChange={(open) => !open && setLineupMatchId(null)}
          matchId={lineupMatchId}
          categoryId={categoryId}
        />
      )}
    </div>
  );
}
