import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Plus,
  Swords,
  Dumbbell,
  CheckCircle2,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  HeartPulse,
  Play,
  Trash2,
  Pencil,
  Brain,
} from "lucide-react";
import { format, isWithinInterval, parseISO, eachDayOfInterval, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { NAV_COLORS } from "@/components/ui/colored-nav-tabs";
import { cn } from "@/lib/utils";
import { getTrainingTypeLabel } from "@/lib/constants/trainingTypes";
import { getTestLabel } from "@/lib/constants/testCategories";
import { parseTestsFromNotes } from "@/lib/utils/sessionNotes";
import { labelizeTestType, useCustomTestLabels } from "@/hooks/useCustomTestLabels";
import { GroupedExerciseList } from "@/components/category/GroupedExerciseList";
import { SessionEditorV2 } from "@/components/program-builder-v2/SessionEditorV2";
import { resolveSessionExerciseRows } from "@/lib/utils/sessionExercises";
import { BowlingTrainingEntryDialog } from "@/components/bowling/BowlingTrainingEntryDialog";
import { BowlingSimplifiedDialog } from "@/components/bowling/BowlingSimplifiedDialog";
import { BowlingAdvancedDialog } from "@/components/bowling/BowlingAdvancedDialog";
import { BasketballTrainingEntryDialog } from "@/components/basketball/BasketballTrainingEntryDialog";
import { isBasketballPrecisionSport } from "@/lib/constants/basketballPrecisionExercises";
import { CreateEventDialog } from "@/components/category/calendar/CreateEventDialog";
import { FieldSessionDialog } from "@/components/category/calendar/FieldSessionDialog";
import { AddMatchCalendarDialog } from "@/components/category/matches/AddMatchCalendarDialog";
import { AthleteBowlingCompetitionDialog } from "@/components/category/matches/AthleteBowlingCompetitionDialog";
import { SessionValidationDialog } from "@/components/athlete-space/SessionValidationDialog";
import { SimplifiedSessionDialog } from "@/components/athlete-space/SimplifiedSessionDialog";
import { SessionDetailDialog } from "@/components/athlete-space/SessionDetailDialog";
import { SessionAttendanceResponse } from "@/components/athlete-space/SessionAttendanceResponse";
import { MatchAttendanceResponse } from "@/components/athlete-space/MatchAttendanceResponse";
import { Eye } from "lucide-react";
import { useTranslation } from "react-i18next";


interface Props {
  playerId: string;
  categoryId: string;
  sportType?: string;
}

const ATHLETE_SESSION_COLOR = "#8B5CF6"; // Mes séances (violet)
const PROPHYLAXIS_COLOR = "#10b981"; // Prophylaxie (vert)
const REHAB_COLOR = "#f59e0b"; // Réhab (orange)
const TRAINING_COLOR = "#3b82f6"; // Entraînement (bleu)
const TEST_COLOR = "#06b6d4"; // Test (cyan)
const MATCH_COLOR = "#ef4444"; // Match/Compétition (rouge)

export function AthleteSpaceCalendar({ playerId, categoryId, sportType }: Props) {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBowlingTrainingOpen, setIsBowlingTrainingOpen] = useState(false);
  const [isBasketTrainingOpen, setIsBasketTrainingOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [fieldSessionDate, setFieldSessionDate] = useState<Date | null>(null);
  const [matchDialogDate, setMatchDialogDate] = useState<Date | null>(null);
  const [isBowlingSimplifiedOpen, setIsBowlingSimplifiedOpen] = useState(false);
  const [bowlingSimplifiedSessionId, setBowlingSimplifiedSessionId] = useState<string | null>(null);
  const [isBowlingAdvancedOpen, setIsBowlingAdvancedOpen] = useState(false);
  const [bowlingAdvancedSessionId, setBowlingAdvancedSessionId] = useState<string | null>(null);
  const [isSessionSimplifiedOpen, setIsSessionSimplifiedOpen] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<any | null>(null);
  const [sessionToEdit, setSessionToEdit] = useState<any | null>(null);
  const [matchToDelete, setMatchToDelete] = useState<any | null>(null);
  const [bowlingMatchEntry, setBowlingMatchEntry] = useState<any | null>(null);
  const [editingMentalSession, setEditingMentalSession] = useState<{ id: string; title: string; durationMin: number; theme: string; notes: string; date: Date } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [validationSession, setValidationSession] = useState<any | null>(null);
  const [detailSession, setDetailSession] = useState<{ session: any; exercises: any[] } | null>(null);
  const queryClient = useQueryClient();

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("athlete-delete-session", {
        body: { session_id: sessionToDelete.id, player_id: playerId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || t("athleteSpace.calendar.deleteFailed"));
      toast.success(data?.unassigned ? t("athleteSpace.calendar.sessionRemoved") : t("athleteSpace.calendar.sessionDeleted"));
      setSessionToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["athlete-calendar-sessions", categoryId, playerId] });
    } catch (e: any) {
      toast.error(e?.message || t("athleteSpace.calendar.deleteError"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteMatch = async () => {
    if (!matchToDelete) return;
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("athlete-delete-match", {
        body: { match_id: matchToDelete.id, player_id: playerId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || t("athleteSpace.calendar.deleteFailed"));
      toast.success(t("athleteSpace.calendar.matchDeleted"));
      setMatchToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["athlete-calendar-matches", categoryId, playerId] });
    } catch (e: any) {
      toast.error(e?.message || t("athleteSpace.calendar.deleteError"));
    } finally {
      setIsDeleting(false);
    }
  };

  const isBowling = (sportType || "").toLowerCase().includes("bowling");
  const isBasket = isBasketballPrecisionSport(sportType);


  // Realtime sync: invalidate caches when sessions/blocks/exercises change
  useEffect(() => {
    if (!categoryId) return;
    const channel = supabase
      .channel(`athlete-calendar-${categoryId}-${playerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "training_sessions", filter: `category_id=eq.${categoryId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["athlete-calendar-sessions", categoryId, playerId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "training_session_blocks" }, () => {
        queryClient.invalidateQueries({ queryKey: ["athlete-calendar-blocks"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "gym_session_exercises" }, () => {
        queryClient.invalidateQueries({ queryKey: ["athlete-calendar-exercises-v3"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [categoryId, playerId, queryClient]);

  const { data: sessions = [] } = useQuery({
    queryKey: ["athlete-calendar-sessions", categoryId, playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("id, session_date, training_type, session_start_time, session_end_time, intensity, notes, created_by_player_id, test_reminder_id, created_at, event_participants(player_id)")
        .eq("category_id", categoryId)
        .order("session_date", { ascending: false });
      if (error) throw error;
      // Un athlète ne voit une séance que si (a) il l'a créée lui-même,
      // ou (b) il figure explicitement dans les participants convoqués.
      return (data || []).filter((s: any) => {
        if (s.created_by_player_id && s.created_by_player_id === playerId) return true;
        const parts = (s as any).event_participants || [];
        return parts.some((p: any) => p.player_id === playerId);
      });
    },
  });

  // Deep-link depuis une notification cloche : ?session=<id> ouvre la séance
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkSessionId = searchParams.get("session");
  useEffect(() => {
    if (!deepLinkSessionId) return;
    const target = (sessions as any[]).find((s) => s.id === deepLinkSessionId);
    const dateParam = searchParams.get("date");
    const targetDate = target?.session_date || dateParam;
    if (!targetDate) return;
    setSelectedDate(parseISO(String(targetDate)));
    if (target) setExpandedItemId(`session-${target.id}`);
    const next = new URLSearchParams(searchParams);
    next.delete("session");
    next.delete("date");
    setSearchParams(next, { replace: true });
  }, [deepLinkSessionId, sessions, searchParams, setSearchParams]);


  const testReminderIds = useMemo(
    () => Array.from(new Set(sessions.map((s: any) => s.test_reminder_id).filter(Boolean))) as string[],
    [sessions],
  );

  const { data: testReminders = [] } = useQuery({
    queryKey: ["athlete-calendar-test-reminders", testReminderIds],
    queryFn: async () => {
      if (testReminderIds.length === 0) return [];
      const { data, error } = await supabase
        .from("test_reminders")
        .select("id, test_type")
        .in("id", testReminderIds);
      if (error) throw error;
      return data || [];
    },
    enabled: testReminderIds.length > 0,
  });

  const testTypeByReminderId = useMemo(() => {
    const map: Record<string, string> = {};
    testReminders.forEach((r: any) => { map[r.id] = r.test_type; });
    return map;
  }, [testReminders]);

  const customTestTypes = useMemo(() => {
    const types: string[] = [];
    Object.values(testTypeByReminderId).forEach((type) => type && types.push(type));
    sessions.forEach((session: any) => {
      parseTestsFromNotes(session.notes).forEach((test) => test.test_type && types.push(test.test_type));
      const noteCustomCodes = String(session.notes || "").match(/custom:[0-9a-f-]{32,36}/gi) || [];
      noteCustomCodes.forEach((code) => types.push(code));
    });
    return types;
  }, [sessions, testTypeByReminderId]);
  const customTestMap = useCustomTestLabels(customTestTypes);

  const { data: matches = [] } = useQuery({
    queryKey: ["athlete-calendar-matches", categoryId, playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("id, match_date, end_date, match_time, opponent, location, is_home, competition, competition_stage, notes, score_home, score_away, is_personal, created_by_player_id, event_type")
        .eq("category_id", categoryId)
        .or(`is_personal.eq.false,created_by_player_id.eq.${playerId}`)
        .order("match_date", { ascending: false });
      if (error) throw error;
      // Exclude technical "training" matches (used as containers for bowling training stats)
      const rows = (data || []).filter((m: any) => m.event_type !== "training");
      if (!playerId || rows.length === 0) return rows;

      // Only keep competitions the athlete is actually assigned to (or personal ones)
      const { data: participations, error: participationError } = await supabase
        .from("match_participants")
        .select("match_id")
        .eq("player_id", playerId)
        .in("match_id", rows.map((m: any) => m.id));
      if (participationError) throw participationError;
      const assignedIds = new Set((participations || []).map((p: any) => p.match_id));
      return rows.filter((m: any) => assignedIds.has(m.id) || m.created_by_player_id === playerId);
    },
    enabled: !!categoryId,
  });


  const { data: periodizationCycles = [] } = useQuery({
    queryKey: ["athlete-calendar-periodization-cycles", categoryId, playerId],
    queryFn: async () => {
      const { data: cycleRows, error } = await supabase
        .from("periodization_cycles")
        .select("id, name, color, start_date, end_date, cycle_type, intensity, objective")
        .eq("category_id", categoryId)
        .order("start_date", { ascending: true });
      if (error) throw error;
      if (!cycleRows?.length) return [];

      const { data: assignments, error: assignmentError } = await supabase
        .from("periodization_cycle_players")
        .select("cycle_id")
        .eq("player_id", playerId);
      if (assignmentError) throw assignmentError;
      const assignedCycleIds = new Set((assignments || []).map((assignment: any) => assignment.cycle_id));
      return cycleRows.filter((cycle: any) => assignedCycleIds.has(cycle.id));
    },
    enabled: !!categoryId && !!playerId,
  });

  const { data: submittedRpes = [] } = useQuery({
    queryKey: ["athlete-calendar-rpes", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("awcr_tracking")
        .select("training_session_id, session_date")
        .eq("player_id", playerId);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch prophylaxis programs assigned to this player
  const { data: prophylaxisPrograms = [] } = useQuery({
    queryKey: ["athlete-prophylaxis", playerId, categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prophylaxis_assignments")
        .select(`
          id, is_active, start_date, end_date,
          prophylaxis_programs(
            id, name, body_zone, frequency, description, is_active,
            prophylaxis_exercises(*)
          )
        `)
        .eq("player_id", playerId)
        .eq("category_id", categoryId)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch rehab protocols for this player
  const { data: rehabProtocols = [] } = useQuery({
    queryKey: ["athlete-calendar-rehab", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_rehab_protocols")
        .select(`
          *,
          injury_protocols(id, name, injury_category),
          player_rehab_exercises(*)
        `)
        .eq("player_id", playerId)
        .eq("status", "in_progress")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const completedSessionIds = new Set(submittedRpes.map(r => r.training_session_id));

  // Classify sessions by type
  const testSessions = sessions.filter((s: any) => !!s.test_reminder_id);
  // Séances créées par un athlète (moi ou un coéquipier qui m'a ajouté)
  const athleteSessionList = sessions.filter((s: any) => !!s.created_by_player_id && !s.test_reminder_id);
  const trainingSessions = sessions.filter((s: any) => !s.test_reminder_id && !s.created_by_player_id);

  const trainingDates = trainingSessions.map(s => new Date(s.session_date));
  const testDates = testSessions.map(s => new Date(s.session_date));
  const matchDates = matches.flatMap(m => {
    try {
      const start = parseISO(m.match_date);
      const end = m.end_date ? parseISO(m.end_date) : start;
      return eachDayOfInterval({ start, end: end < start ? start : end });
    } catch {
      return [new Date(m.match_date)];
    }
  });
  const athleteSessionDates = athleteSessionList.map(s => new Date(s.session_date));
  const cycleDates = useMemo(() => {
    const dates: Date[] = [];
    periodizationCycles.forEach((cycle: any) => {
      try {
        dates.push(...eachDayOfInterval({ start: parseISO(cycle.start_date), end: parseISO(cycle.end_date) }));
      } catch { /* ignore invalid cycle dates */ }
    });
    return dates;
  }, [periodizationCycles]);

  // Compute prophylaxis dates for calendar modifiers
  const prophylaxisDates = useMemo(() => {
    const dates: Date[] = [];
    const rangeStart = subMonths(new Date(), 2);
    const rangeEnd = addMonths(new Date(), 2);
    
    prophylaxisPrograms.forEach((assignment: any) => {
      const prog = assignment.prophylaxis_programs;
      if (!prog || !prog.is_active) return;
      const start = assignment.start_date ? parseISO(assignment.start_date) : rangeStart;
      const end = assignment.end_date ? parseISO(assignment.end_date) : rangeEnd;
      const freq = prog.frequency || "quotidien";
      
      try {
        const days = eachDayOfInterval({
          start: start < rangeStart ? rangeStart : start,
          end: end > rangeEnd ? rangeEnd : end,
        });
        
        days.forEach((d, i) => {
          if (freq === "quotidien" || freq === "daily") {
            dates.push(d);
          } else if (freq === "3x/semaine" || freq === "3x") {
            if (i % 2 === 0) dates.push(d); // every other day ~3x/week
          } else if (freq === "2x/semaine" || freq === "2x") {
            if (i % 3 === 0) dates.push(d);
          } else if (freq === "hebdomadaire" || freq === "weekly") {
            if (d.getDay() === 1) dates.push(d); // Mondays
          } else {
            dates.push(d); // default: daily
          }
        });
      } catch { /* ignore invalid intervals */ }
    });
    return dates;
  }, [prophylaxisPrograms]);

  // Rehab dates: every day while protocol is in_progress
  const rehabDates = useMemo(() => {
    const dates: Date[] = [];
    const rangeStart = subMonths(new Date(), 2);
    const rangeEnd = addMonths(new Date(), 2);
    
    rehabProtocols.forEach((protocol: any) => {
      const start = protocol.started_at ? parseISO(protocol.started_at) : parseISO(protocol.created_at);
      try {
        const days = eachDayOfInterval({
          start: start < rangeStart ? rangeStart : start,
          end: rangeEnd,
        });
        dates.push(...days);
      } catch { /* ignore */ }
    });
    return dates;
  }, [rehabProtocols]);

  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const daySessions = sessions.filter(s => s.session_date === selectedDateStr);
  const dayCycles = periodizationCycles.filter((cycle: any) =>
    !!selectedDateStr && selectedDateStr >= cycle.start_date && selectedDateStr <= cycle.end_date,
  );
  const dayMatches = matches.filter(m => {
    if (!selectedDateStr) return false;
    if (!m.end_date || m.end_date === m.match_date) return m.match_date === selectedDateStr;
    return selectedDateStr >= m.match_date && selectedDateStr <= m.end_date;
  });

  // Check if prophylaxis programs apply to selected date
  const dayProphylaxis = useMemo(() => {
    if (!selectedDate) return [];
    return prophylaxisPrograms.filter((assignment: any) => {
      const prog = assignment.prophylaxis_programs;
      if (!prog || !prog.is_active) return false;
      const start = assignment.start_date ? parseISO(assignment.start_date) : new Date(0);
      const end = assignment.end_date ? parseISO(assignment.end_date) : new Date(2100, 0);
      return isWithinInterval(selectedDate, { start, end });
    });
  }, [selectedDate, prophylaxisPrograms]);

  // Check if rehab protocols apply to selected date
  const dayRehab = useMemo(() => {
    if (!selectedDate) return [];
    return rehabProtocols.filter((protocol: any) => {
      const start = protocol.started_at ? parseISO(protocol.started_at) : parseISO(protocol.created_at);
      return selectedDate >= start && protocol.status === "in_progress";
    });
  }, [selectedDate, rehabProtocols]);

  // Fetch blocks for day sessions
  const daySessionIds = daySessions.map(s => s.id);
  const { data: sessionBlocks = [] } = useQuery({
    queryKey: ["athlete-calendar-blocks", daySessionIds],
    queryFn: async () => {
      if (daySessionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("training_session_blocks")
        .select("training_session_id, training_type, block_order")
        .in("training_session_id", daySessionIds)
        .order("block_order");
      if (error) throw error;
      return data || [];
    },
    enabled: daySessionIds.length > 0,
  });

  const blocksBySession = useMemo(() => {
    return sessionBlocks.reduce((acc, block) => {
      if (!acc[block.training_session_id]) acc[block.training_session_id] = [];
      if (!acc[block.training_session_id].some((b: { training_type: string }) => b.training_type === block.training_type)) {
        acc[block.training_session_id].push(block);
      }
      return acc;
    }, {} as Record<string, typeof sessionBlocks>);
  }, [sessionBlocks]);

  const { data: rawSessionExercises = [] } = useQuery({
    queryKey: ["athlete-calendar-exercises-v3", daySessionIds, playerId],
    queryFn: async () => {
      if (daySessionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("gym_session_exercises")
        .select("*")
        .in("training_session_id", daySessionIds)
        .or(`player_id.eq.${playerId},player_id.is.null`)
        .order("order_index");
      if (error) throw error;

      return data || [];
    },
    enabled: daySessionIds.length > 0 && !!playerId,
  });

  const sessionExercises = useMemo(
    () => resolveSessionExerciseRows(rawSessionExercises, playerId),
    [rawSessionExercises, playerId],
  );

  const exercisesBySession = useMemo(() => {
    return sessionExercises.reduce((acc, ex) => {
      if (!acc[ex.training_session_id]) acc[ex.training_session_id] = [];
      acc[ex.training_session_id].push(ex);
      return acc;
    }, {} as Record<string, typeof sessionExercises>);
  }, [sessionExercises]);

  const hasDayEvents = daySessions.length > 0 || dayMatches.length > 0 || dayCycles.length > 0 || dayProphylaxis.length > 0 || dayRehab.length > 0;

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-card shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" style={{ color: NAV_COLORS.planification.base }} />
              {t("athleteSpace.calendar.title")}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => setIsPickerOpen(true)}
                className="gap-1.5"
                style={{ backgroundColor: ATHLETE_SESSION_COLOR }}
              >
                <Plus className="h-3.5 w-3.5" />
                {t("athleteSpace.calendar.addSession")}
              </Button>
            </div>

          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            const todayStr = format(new Date(), "yyyy-MM-dd");
            const upcoming = sessions
              .filter((s: any) => {
                if (s.created_by_player_id === playerId) return false;
                if (s.session_date >= todayStr) return true;
                // Séance passée ajoutée a posteriori par le staff : réponse encore attendue
                if (!s.created_at) return false;
                const start = new Date(`${s.session_date}T${(s.session_start_time || "00:00").slice(0, 5)}:00`);
                return new Date(s.created_at).getTime() > start.getTime();
              })
              .sort((a: any, b: any) => a.session_date.localeCompare(b.session_date))
              .slice(0, 5);
            if (upcoming.length === 0) return null;
            return (
              <div className="mb-4 rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {t("athleteSpace.calendar.upcomingConfirm")}
                </p>
                <div className="space-y-2">
                  {upcoming.map((s: any) => (
                    <div key={s.id} className="rounded-md border border-border/60 bg-background p-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <button
                          type="button"
                          className="text-left text-sm font-medium hover:underline"
                          onClick={() => setSelectedDate(parseISO(s.session_date))}
                        >
                          {format(parseISO(s.session_date), "EEE d MMM", { locale: getDateLocale() })}
                          {s.session_start_time && ` · ${s.session_start_time.slice(0, 5)}`}
                          {" · "}
                          {getTrainingTypeLabel(s.training_type)}
                        </button>
                      </div>
                      <SessionAttendanceResponse
                        sessionId={s.id}
                        playerId={playerId}
                        sessionDate={s.session_date}
                        sessionStartTime={s.session_start_time}
                        sessionCreatedAt={(s as any).created_at}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Calendar */}
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                modifiers={{
                  training: trainingDates,
                  test: testDates,
                  match: matchDates,
                  athleteSession: athleteSessionDates,
                  cycle: cycleDates,
                  prophylaxis: prophylaxisDates,
                  rehab: rehabDates,
                }}
                modifiersStyles={{
                  training: { backgroundColor: `${TRAINING_COLOR}25`, borderRadius: "6px", fontWeight: 600, color: TRAINING_COLOR, outline: `2px solid ${TRAINING_COLOR}`, outlineOffset: "-2px" },
                  test: { backgroundColor: `${TEST_COLOR}25`, borderRadius: "6px", fontWeight: 700, color: TEST_COLOR, outline: `2px dashed ${TEST_COLOR}`, outlineOffset: "-2px" },
                  match: { backgroundColor: `${MATCH_COLOR}25`, borderRadius: "6px", fontWeight: 700, color: MATCH_COLOR, outline: `2px solid ${MATCH_COLOR}`, outlineOffset: "-2px" },
                  athleteSession: { borderRadius: "6px", outline: `2px solid ${ATHLETE_SESSION_COLOR}`, outlineOffset: "-2px", color: ATHLETE_SESSION_COLOR, fontWeight: 600 },
                  cycle: { backgroundColor: "hsl(var(--brand-500) / 0.12)", borderRadius: "6px", fontWeight: 600, color: "hsl(var(--brand-500))", outline: "1px solid hsl(var(--brand-500) / 0.45)", outlineOffset: "-2px" },
                  prophylaxis: { boxShadow: `inset 0 -3px 0 0 ${PROPHYLAXIS_COLOR}` },
                  rehab: { boxShadow: `inset 3px 0 0 0 ${REHAB_COLOR}` },
                }}
                locale={getDateLocale()}
                weekStartsOn={1}
                className="rounded-md border pointer-events-auto"
              />
            </div>

            {/* Day details */}
            <div className="space-y-3">
              {/* Legend */}
              <div className="flex flex-wrap gap-2 text-xs p-2 rounded-lg bg-muted/40">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: `${TRAINING_COLOR}40`, border: `1px solid ${TRAINING_COLOR}` }} />
                  <span>{t("athleteSpace.calendar.legend.training")}</span>
                </div>
                {!isBowling && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: `${TEST_COLOR}40`, border: `1px dashed ${TEST_COLOR}` }} />
                    <span>{t("athleteSpace.calendar.legend.test")}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: `${MATCH_COLOR}40`, border: `1px solid ${MATCH_COLOR}` }} />
                  <span>{t("athleteSpace.calendar.legend.match")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ border: `2px solid ${ATHLETE_SESSION_COLOR}` }} />
                  <span>{t("athleteSpace.calendar.legend.mySessions")}</span>
                </div>
                {!isBowling && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1 h-3 rounded-full" style={{ backgroundColor: REHAB_COLOR }} />
                    <span>{t("athleteSpace.calendar.legend.rehab")}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(var(--brand-500) / 0.12)", border: "1px solid hsl(var(--brand-500) / 0.45)" }} />
                  <span>{t("athleteSpace.calendar.legend.cycle", "Cycle de travail")}</span>
                </div>
                {!isBowling && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-1 rounded-full" style={{ backgroundColor: PROPHYLAXIS_COLOR }} />
                    <span>{t("athleteSpace.calendar.legend.prophylaxis")}</span>
                  </div>
                )}
              </div>

              {selectedDate ? (
                <div>
                  <h3 className="font-semibold text-sm mb-2">
                    {format(selectedDate, "EEEE d MMMM yyyy", { locale: getDateLocale() })}
                  </h3>

                  {!hasDayEvents ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-muted-foreground">{t("athleteSpace.calendar.noEvent")}</p>
                    </div>

                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {/* Assigned work cycles */}
                      {dayCycles.map((cycle: any) => (
                        <div
                          key={cycle.id}
                          className="rounded-lg border-l-4 p-3"
                          style={{ borderLeftColor: cycle.color || "hsl(var(--brand-500))", backgroundColor: "hsl(var(--brand-500) / 0.08)" }}
                        >
                          <div className="flex items-start gap-2">
                            <Activity className="h-4 w-4 mt-0.5 shrink-0" style={{ color: cycle.color || "hsl(var(--brand-500))" }} />
                            <div className="min-w-0">
                              <p className="font-medium text-sm">{cycle.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(parseISO(cycle.start_date), "d MMM", { locale: getDateLocale() })} → {format(parseISO(cycle.end_date), "d MMM yyyy", { locale: getDateLocale() })}
                              </p>
                              {cycle.objective && <p className="text-xs text-muted-foreground mt-1">{cycle.objective}</p>}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Matches */}
                      {dayMatches.map(match => {
                        const isPersonalMine = match.is_personal && match.created_by_player_id === playerId;
                        const title = match.competition
                          ? match.competition
                          : match.opponent && match.opponent !== t("athleteSpace.calendar.competitionFallback")
                            ? `vs ${match.opponent}`
                            : t("athleteSpace.calendar.competitionFallback");
                        const hasScore = match.score_home != null || match.score_away != null;
                        return (
                          <div key={match.id} className="p-3 rounded-lg border-l-4 border-rose-500 bg-rose-50 dark:bg-rose-950/20">
                            <div className="flex items-start gap-2">
                              <Swords className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-sm">{title}</p>
                                  <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5", isPersonalMine ? "border-cyan-500 text-cyan-600" : "border-rose-500 text-rose-600")}>
                                    {isPersonalMine ? t("athleteSpace.calendar.personal") : t("athleteSpace.calendar.club")}
                                  </Badge>
                                  {match.competition_stage && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">{match.competition_stage}</Badge>
                                  )}
                                </div>
                                {match.competition && match.opponent && match.opponent !== t("athleteSpace.calendar.competitionFallback") && (
                                  <p className="text-xs text-muted-foreground">vs {match.opponent}</p>
                                )}
                                {match.match_time && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />{match.match_time.slice(0, 5)}
                                  </p>
                                )}
                                {match.location && <p className="text-xs text-muted-foreground">{match.location}</p>}
                                {hasScore && (
                                  <p className="text-xs text-muted-foreground">{t("athleteSpace.calendar.scoreLabel")}{match.score_home ?? "-"} - {match.score_away ?? "-"}</p>
                                )}
                                {match.notes && (
                                  <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{match.notes}</p>
                                )}
                                {isBowling && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-2 gap-1.5"
                                    onClick={(e) => { e.stopPropagation(); setBowlingMatchEntry(match); }}
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    {t("athleteSpace.calendar.enterData")}
                                  </Button>
                                )}
                              </div>
                              {isPersonalMine && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/30 shrink-0"
                                  onClick={(e) => { e.stopPropagation(); setMatchToDelete(match); }}
                                  aria-label={t("athleteSpace.calendar.deleteCompetitionAria")}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            {!isPersonalMine && (
                              <MatchAttendanceResponse
                                matchId={match.id}
                                playerId={playerId}
                                matchDate={match.match_date}
                                matchTime={match.match_time}
                              />
                            )}
                          </div>
                        );
                      })}

                      {/* Sessions */}
                      {daySessions.map(session => {
                        const isAthleteSession = session.created_by_player_id === playerId;
                        const isCompleted = completedSessionIds.has(session.id);
                        const exercises = exercisesBySession[session.id] || [];
                        const blocks = blocksBySession[session.id] || [];
                        const isExpanded = expandedItemId === `session-${session.id}`;

                        return (
                          <div
                            key={session.id}
                            className={cn("rounded-lg border transition-colors", isAthleteSession ? "border-l-4" : "border-border")}
                            style={isAthleteSession ? { borderLeftColor: ATHLETE_SESSION_COLOR, backgroundColor: `${ATHLETE_SESSION_COLOR}08` } : {}}
                          >
                            <button
                              className="w-full text-left p-3"
                              onClick={() => setExpandedItemId(isExpanded ? null : `session-${session.id}`)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-medium text-sm">
                                        {(() => {
                                          if (session.training_type !== "test") {
                                            return getTrainingTypeLabel(session.training_type);
                                          }
                                          const reminderId = (session as any).test_reminder_id;
                                          if (reminderId && testTypeByReminderId[reminderId]) {
                                            return t("athleteSpace.calendar.testLabel", { label: labelizeTestType(testTypeByReminderId[reminderId], customTestMap) });
                                          }
                                          // Fallback: parse <!--TESTS:[...]--> metadata from notes
                                          const tests = parseTestsFromNotes((session as any).notes);
                                          if (tests.length > 0) {
                                            const labels = tests.map(tst => /^custom[:_]/i.test(tst.test_type || "") ? labelizeTestType(tst.test_type, customTestMap) : getTestLabel(tst.test_type) || tst.test_type).join(", ");
                                            return t("athleteSpace.calendar.testLabel", { label: labels });
                                          }
                                          // Fallback 2: legacy "Test auto-planifié: <label>" in notes
                                          const legacy = ((session as any).notes || "").match(/Test auto-planifi[ée]\s*:\s*([^\n<]+)/i);
                                          if (legacy) return t("athleteSpace.calendar.testLabel", { label: legacy[1].trim() });
                                          return getTrainingTypeLabel(session.training_type);
                                        })()}
                                      </p>
                                      {blocks.length > 0 && blocks.some(b => b.training_type !== session.training_type) && (
                                        <div className="flex gap-1 flex-wrap">
                                          {blocks.filter(b => b.training_type !== session.training_type).map((b, i) => (
                                            <Badge key={i} variant="outline" className="text-[10px] h-4 px-1.5">
                                              {getTrainingTypeLabel(b.training_type)}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                      {isAthleteSession && (
                                        <Badge className="text-[10px] h-4 px-1.5 border" style={{ backgroundColor: `${ATHLETE_SESSION_COLOR}15`, color: ATHLETE_SESSION_COLOR, borderColor: `${ATHLETE_SESSION_COLOR}40` }}>
                                          <User className="h-2.5 w-2.5 mr-0.5" />{t("athleteSpace.calendar.mySessionBadge")}
                                        </Badge>
                                      )}
                                    </div>
                                    {session.session_start_time && (
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {session.session_start_time.slice(0, 5)}
                                        {session.session_end_time && ` - ${session.session_end_time.slice(0, 5)}`}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {exercises.length > 0 && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                      <Dumbbell className="h-2.5 w-2.5 mr-0.5" />{exercises.length}
                                    </Badge>
                                  )}
                                  {isCompleted && <CheckCircle2 className="h-4 w-4 text-status-optimal" />}
                                  {isAthleteSession && !session.test_reminder_id && (
                                    <>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => { e.stopPropagation(); setSessionToEdit(session); }}
                                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                                        title="Modifier ma séance"
                                        aria-label="Modifier ma séance"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setSessionToDelete(session); }}
                                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                        title={t("athleteSpace.calendar.deleteSessionTitle")}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </>
                                  )}
                                  {(exercises.length > 0 || ((session as any).notes || "").replace(/<!--[\s\S]*?-->/g, "").trim() || isBowling || isBasket) && (isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />)}
                                </div>
                              </div>
                            </button>
                            {!isAthleteSession && (
                              <div className="px-3 pb-2">
                                <SessionAttendanceResponse
                                  sessionId={session.id}
                                  playerId={playerId}
                                  sessionDate={session.session_date}
                                  sessionStartTime={session.session_start_time}
                                  sessionCreatedAt={(session as any).created_at}
                                />
                              </div>
                            )}
                            {(isExpanded && (exercises.length > 0 || (session as any).notes || isBowling || isBasket)) && (
                              <div className="px-3 pb-3 border-t border-border/50 pt-2 space-y-2">
                                {(() => {
                                  const rawNotes = ((session as any).notes || "").replace(/<!--[\s\S]*?-->/g, "").trim();
                                  if (!rawNotes) return null;
                                  return (
                                    <div className="rounded-md border border-primary/20 bg-primary/5 p-2">
                                      <p className="text-[10px] uppercase tracking-wide font-semibold text-primary mb-1">
                                        {t("athleteSpace.calendar.coachInstructions")}
                                      </p>
                                      <p className="text-xs whitespace-pre-line text-foreground/90">{rawNotes}</p>
                                    </div>
                                  );
                                })()}
                                {exercises.length > 0 && (
                                  <div className="overflow-x-auto -mx-3 px-3">
                                    <GroupedExerciseList exercises={exercises} maxHeight="500px" />
                                  </div>
                                )}
                                {session.training_type !== "mental" && session.training_type !== "test" && (
                                   <div className="flex flex-col sm:flex-row gap-2">
                                     <Button
                                       size="sm"
                                       variant="outline"
                                       className="w-full gap-1.5"
                                       onClick={() => setDetailSession({ session, exercises })}
                                     >
                                       <Eye className="h-3.5 w-3.5" />
                                       {t("athleteSpace.calendar.viewSession")}
                                     </Button>
                                     <Button
                                       size="sm"
                                       className="w-full gap-1.5"
                                       style={{ backgroundColor: TRAINING_COLOR }}
                                       onClick={() => {
                                         setSelectedDate(parseISO(session.session_date));
                                         const tt = (session.training_type || "").toLowerCase();
                                         const isBowlingSessionType = tt.startsWith("bowling_") || tt === "bowling";
                                         if (isBowling && isBowlingSessionType) {
                                           if (tt === "bowling_simplified") {
                                             setBowlingSimplifiedSessionId(session.id);
                                             setIsBowlingSimplifiedOpen(true);
                                           } else if (tt === "bowling_advanced") {
                                             setBowlingAdvancedSessionId(session.id);
                                             setIsBowlingAdvancedOpen(true);
                                           } else {
                                             setIsBowlingTrainingOpen(true);
                                           }
                                         } else {
                                           // Séance générique (prépa physique, musculation, cardio, terrain, etc.)
                                           setValidationSession(session);
                                         }
                                       }}
                                     >
                                       <Plus className="h-3.5 w-3.5" />
                                       {t("athleteSpace.calendar.fillData")}
                                     </Button>
                                   </div>
                                 )}
                                {session.training_type === "mental" && isAthleteSession && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full gap-1.5"
                                    onClick={() => {
                                      const rawNotes: string = (session as any).notes || "";
                                      const metaMatch = rawNotes.match(/<!--MENTAL:(\{[\s\S]*?\})-->/);
                                      let durationMin = 30;
                                      let theme = "";
                                      if (metaMatch) {
                                        try {
                                          const meta = JSON.parse(metaMatch[1]);
                                          durationMin = Number(meta.duration_min) || 30;
                                          theme = String(meta.theme || "");
                                        } catch {}
                                      }
                                      const cleaned = rawNotes.replace(/<!--[\s\S]*?-->\n?/g, "");
                                      const lines = cleaned.split("\n");
                                      const firstLine = (lines[0] || t("athleteSpace.calendar.defaultMentalSessionTitle")).trim();
                                      const title = theme && firstLine.endsWith(` - ${theme}`)
                                        ? firstLine.slice(0, -(` - ${theme}`).length)
                                        : firstLine;
                                      const extraNotes = lines.slice(1).join("\n").trim();
                                      setEditingMentalSession({
                                        id: session.id,
                                        title,
                                        durationMin,
                                        theme,
                                        notes: extraNotes,
                                        date: parseISO(session.session_date),
                                      });
                                      setIsPickerOpen(true);
                                    }}
                                  >
                                    <Brain className="h-3.5 w-3.5" />
                                    {t("athleteSpace.calendar.editMentalSession")}
                                  </Button>
                                )}
                                {isBasket && (
                                  <Button
                                    size="sm"
                                    className="w-full gap-1.5"
                                    style={{ backgroundColor: TRAINING_COLOR }}
                                    onClick={() => {
                                      setSelectedDate(parseISO(session.session_date));
                                      setIsBasketTrainingOpen(true);
                                    }}
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    {t("athleteSpace.calendar.fillData")}
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Prophylaxis routines for this day */}
                      {dayProphylaxis.map((assignment: any) => {
                        const prog = assignment.prophylaxis_programs;
                        if (!prog) return null;
                        const exercises = (prog.prophylaxis_exercises || []).sort((a: any, b: any) => a.order_index - b.order_index);
                        const isExpanded = expandedItemId === `prophy-${assignment.id}`;

                        return (
                          <div key={`prophy-${assignment.id}`} className="rounded-lg border-l-4 border transition-colors" style={{ borderLeftColor: PROPHYLAXIS_COLOR, backgroundColor: `${PROPHYLAXIS_COLOR}08` }}>
                            <button className="w-full text-left p-3" onClick={() => setExpandedItemId(isExpanded ? null : `prophy-${assignment.id}`)}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <ShieldCheck className="h-4 w-4" style={{ color: PROPHYLAXIS_COLOR }} />
                                  <div>
                                    <p className="font-medium text-sm">{prog.name}</p>
                                    <p className="text-xs text-muted-foreground">🎯 {prog.body_zone} • 📅 {prog.frequency || t("athleteSpace.calendar.daily")}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="outline" className="text-[10px] h-4 px-1.5" style={{ borderColor: `${PROPHYLAXIS_COLOR}40`, color: PROPHYLAXIS_COLOR }}>
                                    <Dumbbell className="h-2.5 w-2.5 mr-0.5" />{exercises.length}
                                  </Badge>
                                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                                </div>
                              </div>
                            </button>
                            {isExpanded && exercises.length > 0 && (
                              <div className="px-3 pb-3 border-t border-border/50 pt-2 space-y-1.5">
                                {prog.description && <p className="text-xs text-muted-foreground italic mb-2">{prog.description}</p>}
                                {exercises.map((ex: any, i: number) => (
                                  <div key={ex.id} className="flex items-start gap-2 text-xs p-2 bg-background/60 rounded-md">
                                    <span className="font-semibold text-muted-foreground min-w-[18px]">{i + 1}.</span>
                                    <div className="flex-1">
                                      <p className="font-medium">{ex.exercise_name}</p>
                                      <p className="text-muted-foreground">
                                        {ex.sets && t("athleteSpace.calendar.sets", { n: ex.sets })}
                                        {ex.reps && ` × ${ex.reps}`}
                                        {ex.duration_seconds ? ` • ${ex.duration_seconds}s` : ""}
                                        {ex.rest_seconds ? ` • ${t("athleteSpace.calendar.rest", { n: ex.rest_seconds })}` : ""}
                                      </p>
                                      {ex.notes && <p className="text-muted-foreground italic mt-0.5">{ex.notes}</p>}
                                    </div>
                                    {ex.video_url && (
                                      <a href={ex.video_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                        <Play className="h-3.5 w-3.5 text-primary" />
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Rehab protocols for this day */}
                      {dayRehab.map((protocol: any) => {
                        const protocolName = protocol.injury_protocols?.name || t("athleteSpace.calendar.rehabilitationFallback");
                        const currentPhase = protocol.current_phase || 1;
                        const exercises = (protocol.player_rehab_exercises || [])
                          .filter((ex: any) => ex.phase_number <= currentPhase)
                          .sort((a: any, b: any) => a.phase_number - b.phase_number || a.exercise_order - b.exercise_order);
                        const isExpanded = expandedItemId === `rehab-${protocol.id}`;

                        return (
                          <div key={`rehab-${protocol.id}`} className="rounded-lg border-l-4 border transition-colors" style={{ borderLeftColor: REHAB_COLOR, backgroundColor: `${REHAB_COLOR}08` }}>
                            <button className="w-full text-left p-3" onClick={() => setExpandedItemId(isExpanded ? null : `rehab-${protocol.id}`)}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <HeartPulse className="h-4 w-4" style={{ color: REHAB_COLOR }} />
                                  <div>
                                    <p className="font-medium text-sm">{protocolName}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {t("athleteSpace.calendar.phase", { n: currentPhase })} • {protocol.injury_protocols?.injury_category || ""}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="outline" className="text-[10px] h-4 px-1.5" style={{ borderColor: `${REHAB_COLOR}40`, color: REHAB_COLOR }}>
                                    <Dumbbell className="h-2.5 w-2.5 mr-0.5" />{exercises.length}
                                  </Badge>
                                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                                </div>
                              </div>
                            </button>
                            {isExpanded && exercises.length > 0 && (
                              <div className="px-3 pb-3 border-t border-border/50 pt-2 space-y-1.5">
                                {protocol.notes && <p className="text-xs text-muted-foreground italic mb-2">{protocol.notes}</p>}
                                {exercises.map((ex: any, i: number) => (
                                  <div key={ex.id} className="flex items-start gap-2 text-xs p-2 bg-background/60 rounded-md">
                                    <span className="font-semibold text-muted-foreground min-w-[18px]">{i + 1}.</span>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <p className="font-medium">{ex.name}</p>
                                        <Badge variant="outline" className="text-[9px] h-3.5 px-1">P{ex.phase_number}</Badge>
                                      </div>
                                      <p className="text-muted-foreground">
                                        {ex.sets && t("athleteSpace.calendar.sets", { n: ex.sets })}
                                        {ex.reps && ` × ${ex.reps}`}
                                        {ex.duration && ` • ${ex.duration}`}
                                        {ex.frequency && ` • ${ex.frequency}`}
                                      </p>
                                      {ex.description && <p className="text-muted-foreground italic mt-0.5">{ex.description}</p>}
                                      {ex.notes && <p className="text-muted-foreground italic mt-0.5">💡 {ex.notes}</p>}
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      {ex.video_url && (
                                        <a href={ex.video_url} target="_blank" rel="noopener noreferrer">
                                          <Play className="h-3.5 w-3.5 text-primary" />
                                        </a>
                                      )}
                                      {ex.is_completed && <CheckCircle2 className="h-3.5 w-3.5 text-status-optimal" />}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsPickerOpen(true)} className="flex-1 gap-1.5 text-muted-foreground">
                          <Plus className="h-3.5 w-3.5" />
                          {t("athleteSpace.calendar.addSession")}
                        </Button>
                      </div>

                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    {t("athleteSpace.calendar.selectDatePrompt")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <CreateEventDialog
        open={isPickerOpen}
        onOpenChange={(o) => {
          setIsPickerOpen(o);
          if (!o) setEditingMentalSession(null);
        }}
        date={editingMentalSession?.date || selectedDate || new Date()}
        categoryId={categoryId}
        allowedTypeIds={["session", "field_session", "match", "mental"]}
        athletePlayerId={playerId}
        editingMentalSession={editingMentalSession}
        onAddSession={() => {
          setIsPickerOpen(false);
          setIsCreateOpen(true);
        }}
        onAddMatch={() => {
          setIsPickerOpen(false);
          setMatchDialogDate(selectedDate || new Date());
        }}
        onSelectExternalType={(type) => {
          setIsPickerOpen(false);
          if (type === "session") {
            setIsCreateOpen(true);
          } else if (type === "field_session") {
            setFieldSessionDate(selectedDate || new Date());
          } else if (type === "match") {
            setMatchDialogDate(selectedDate || new Date());
          }
        }}
        onSelectBowlingSimplified={() => {
          setIsPickerOpen(false);
          setIsBowlingSimplifiedOpen(true);
        }}
        onSelectBowlingAdvanced={() => {
          setIsPickerOpen(false);
          setIsBowlingAdvancedOpen(true);
        }}
        onSelectSessionSimplified={() => {
          setIsPickerOpen(false);
          setIsSessionSimplifiedOpen(true);
        }}
      />

      <SessionEditorV2
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        categoryId={categoryId}
        athletePlayerId={playerId}
        defaultDate={selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined}
      />

      <SimplifiedSessionDialog
        open={isSessionSimplifiedOpen || !!sessionToEdit}
        onOpenChange={(open) => {
          if (!open) {
            setIsSessionSimplifiedOpen(false);
            setSessionToEdit(null);
          }
        }}
        date={sessionToEdit ? parseISO(sessionToEdit.session_date) : selectedDate || new Date()}
        categoryId={categoryId}
        athletePlayerId={playerId}
        sportType={sportType}
        lockedTrainingType="musculation"
        session={sessionToEdit}
      />

      <FieldSessionDialog
        open={!!fieldSessionDate}
        onOpenChange={(open) => !open && setFieldSessionDate(null)}
        date={fieldSessionDate || new Date()}
        categoryId={categoryId}
        sportType={sportType}
        athletePlayerId={playerId}
      />

      <BowlingSimplifiedDialog
        open={isBowlingSimplifiedOpen}
        onOpenChange={(o) => {
          setIsBowlingSimplifiedOpen(o);
          if (!o) setBowlingSimplifiedSessionId(null);
        }}
        date={selectedDate || new Date()}
        categoryId={categoryId}
        athletePlayerId={playerId}
        existingSessionId={bowlingSimplifiedSessionId || undefined}
      />

      <BowlingAdvancedDialog
        open={isBowlingAdvancedOpen}
        onOpenChange={(o) => {
          setIsBowlingAdvancedOpen(o);
          if (!o) setBowlingAdvancedSessionId(null);
        }}
        date={selectedDate || new Date()}
        categoryId={categoryId}
        athletePlayerId={playerId}
        existingSessionId={bowlingAdvancedSessionId || undefined}
      />

      {isBowling && bowlingMatchEntry && (
        <AthleteBowlingCompetitionDialog
          open={!!bowlingMatchEntry}
          onOpenChange={(o) => { if (!o) setBowlingMatchEntry(null); }}
          matchId={bowlingMatchEntry.id}
          categoryId={categoryId}
          playerId={playerId}
          competitionLabel={bowlingMatchEntry.competition || bowlingMatchEntry.opponent}
        />
      )}





      <AddMatchCalendarDialog
        open={!!matchDialogDate}
        onOpenChange={(open) => !open && setMatchDialogDate(null)}
        categoryId={categoryId}
        sportType={sportType}
        defaultDate={matchDialogDate || undefined}
        athletePlayerId={playerId}
      />



      {isBowling && (
        <BowlingTrainingEntryDialog
          open={isBowlingTrainingOpen}
          onClose={() => setIsBowlingTrainingOpen(false)}
          playerId={playerId}
          categoryId={categoryId}
          defaultDate={selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined}
        />
      )}
      {isBasket && (
        <BasketballTrainingEntryDialog
          open={isBasketTrainingOpen}
          onClose={() => setIsBasketTrainingOpen(false)}
          playerId={playerId}
          categoryId={categoryId}
          defaultDate={selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined}
        />
      )}
      <SessionValidationDialog
        open={!!validationSession}
        onOpenChange={(o) => { if (!o) setValidationSession(null); }}
        session={validationSession}
        playerId={playerId}
        categoryId={categoryId}
      />

      <SessionDetailDialog
        open={!!detailSession}
        onOpenChange={(o) => { if (!o) setDetailSession(null); }}
        session={detailSession?.session ?? null}
        exercises={detailSession?.exercises ?? []}
        playerId={playerId}
      />


      <AlertDialog open={!!sessionToDelete} onOpenChange={(open) => !open && setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("athleteSpace.calendar.confirmDeleteSessionTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {sessionToDelete?.created_by_player_id === playerId
                ? t("athleteSpace.calendar.confirmDeleteSessionOwnDesc")
                : t("athleteSpace.calendar.confirmDeleteSessionAssignedDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("athleteSpace.calendar.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSession} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? t("athleteSpace.calendar.deleting") : t("athleteSpace.calendar.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!matchToDelete} onOpenChange={(open) => !open && setMatchToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("athleteSpace.calendar.confirmDeleteMatchTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("athleteSpace.calendar.confirmDeleteMatchDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("athleteSpace.calendar.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMatch} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? t("athleteSpace.calendar.deleting") : t("athleteSpace.calendar.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
