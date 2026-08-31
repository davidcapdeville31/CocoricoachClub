import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useMemo, useState } from "react";
import { AthleteSpaceRpeHistory } from "./AthleteSpaceRpeHistory";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, CheckCircle2, Clock, Calendar, Lock, Target, Heart, Dumbbell, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, addDays } from "date-fns";
import { getTrainingTypeLabel } from "@/lib/constants/trainingTypes";
import { getTestLabel } from "@/lib/constants/testCategories";
import { useCustomTestLabels, labelizeTestType } from "@/hooks/useCustomTestLabels";
import { getDisplayNotes, isSimplifiedSession, parsePrecisionExerciseFromNotes, parseTestsFromNotes, parseTestWindowFromNotes } from "@/lib/utils/sessionNotes";
import { SPARE_EXERCISE_TYPES } from "@/lib/constants/bowlingBallBrands";
import { cn } from "@/lib/utils";
import { GroupedExerciseList } from "@/components/category/GroupedExerciseList";
import { displayUnit } from "@/lib/constants/testUnits";
import { PrecisionExerciseSelector } from "@/components/precision/PrecisionExerciseSelector";
import { AthletePrecisionFieldInput } from "./AthletePrecisionFieldInput";
import { AthleteFieldBlocksRpe } from "./AthleteFieldBlocksRpe";
import { isRugbyType } from "@/lib/constants/sportTypes";
import { RUGBY_PRECISION_EXERCISES, EXERCISE_CATEGORIES } from "@/lib/constants/rugbyPrecisionExercises";
import { resolveSessionExerciseRows } from "@/lib/utils/sessionExercises";
import { BowlingScoreSheet } from "@/components/athlete-portal/BowlingScoreSheet";
import {
  AthleteWeightLogInput,
  buildWeightLogRecords,
  countIncompleteWeightLogs,
  type WeightLogState,
} from "./AthleteWeightLogInput";
import {
  AthleteTestResultsInput,
  buildPendingTestRecords,
  filterTestRecordsAgainstWindow,
  type TestResultsState,
} from "./AthleteTestResultsInput";
import { AthleteAbsentLockNotice } from "./AthleteAbsentLockNotice";
import { useAthleteAttendanceLock } from "@/hooks/useAthleteAttendanceLock";


import { latestWeightsByPlayer } from "@/lib/weight/weightHistory";
import { useWeightHistory } from "@/lib/hooks/useWeightData";

interface Props {
  playerId: string;
  categoryId: string;
  hideHistory?: boolean;
}

/**
 * A "test campaign" session = a test session planned over a period (TESTWINDOW).
 * It stays visible until every test of the period has a result, so the athlete can
 * submit some tests one day and the rest another day.
 */
function isTestCampaignSession(s: { training_type?: string | null; notes?: string | null }) {
  return s?.training_type === "test" && !!parseTestWindowFromNotes(s?.notes) && parseTestsFromNotes(s?.notes).length > 0;
}

type SessionRow = {
  id: string;
  session_date: string;
  training_type: string;
  session_start_time: string | null;
  session_end_time: string | null;
  notes: string | null;
  bowling_exercise_type?: string | null;
};

const BLOCK_TO_SPARE_MAP: Record<string, string> = {
  quille_7: "spare_pin_7",
  quille_10: "spare_pin_10",
  spares: "spare_general",
  poche: "spare_poche",
};

const BOWLING_EXERCISE_LABELS: Record<string, string> = {
  quille_7: "Quille 7",
  quille_10: "Quille 10",
  spares: "Spares",
  poche: "Poche",
};

const isBodyWeightRatioUnit = (unit?: string | null) => {
  const normalized = String(unit || "").toLowerCase();
  return /pdc|poids\s*de\s*corps|body\s*weight|bodyweight|ratio/.test(normalized);
};

const formatFrNumber = (value: number, digits = 2) => {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(digits).replace(/\.0+$/, "").replace(".", ",");
};

const formatBodyWeightRatioResult = (rawValue: unknown, playerWeight?: number | null) => {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return String(rawValue ?? "");
  if (!playerWeight || playerWeight <= 0) return `ratio ${formatFrNumber(value, 2)} (${i18n.t("athleteSpace.rpe.missingWeight")})`;

  const loadKg = value >= 5 ? value : value * playerWeight;
  const ratio = value >= 5 ? loadKg / playerWeight : value;
  return `ratio ${formatFrNumber(ratio, 2)} (${formatFrNumber(loadKg, 1)}/${formatFrNumber(playerWeight, 1)} kg)`;
};

export function AthleteSpaceRpe({ playerId, categoryId, hideHistory }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const endDate = addDays(new Date(), 14).toISOString().split("T")[0];

  // Fetch category sport type for precision exercises
  const { data: categoryData } = useQuery({
    queryKey: ["category-sport-for-precision", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("rugby_type")
        .eq("id", categoryId)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const sportType = categoryData?.rugby_type;

  const enrichSessionsWithBowlingExercise = async (sessions: SessionRow[]): Promise<SessionRow[]> => {
    if (sessions.length === 0) return [];

    const sessionIds = sessions.map((s) => s.id);
    const { data: blocks, error } = await supabase
      .from("training_session_blocks")
      .select("training_session_id, training_type, bowling_exercise_type")
      .in("training_session_id", sessionIds);

    if (error) throw error;

    const exerciseBySession = new Map<string, string>();
    for (const block of blocks || []) {
      if (
        block.training_type === "bowling_spare" &&
        block.bowling_exercise_type &&
        !exerciseBySession.has(block.training_session_id)
      ) {
        exerciseBySession.set(block.training_session_id, block.bowling_exercise_type);
      }
    }

    return sessions.map((session) => ({
      ...session,
      bowling_exercise_type: exerciseBySession.get(session.id) ?? null,
    }));
  };

  // Fetch sessions assigned to this player: today + upcoming (next 14 days)
  const { data: allSessions = [] } = useQuery({
    queryKey: ["athlete-space-sessions", categoryId, playerId, today, endDate],
    queryFn: async () => {
      const { data: attendance, error: attError } = await supabase
        .from("training_attendance")
        .select("training_session_id")
        .eq("player_id", playerId)
        .gte("attendance_date", today)
        .lte("attendance_date", endDate);
      if (attError) throw attError;

      const assignedSessionIds = attendance?.map((a) => a.training_session_id).filter(Boolean) as string[];

      if (assignedSessionIds.length === 0) {
        const { data: sessions, error } = await supabase
          .from("training_sessions")
          .select("id, session_date, training_type, session_start_time, session_end_time, notes, created_by_player_id, event_participants(player_id)")
          .eq("category_id", categoryId)
          .gte("session_date", today)
          .lte("session_date", endDate)
          .order("session_date")
          .order("session_start_time");
        if (error) throw error;

        // Filter out sessions created by other athletes (séance athlète)
        // AND filter by participants if explicitly assigned
        const filteredSessions = (sessions || []).filter((s: any) => {
          // Séance créée par un autre athlète : visible uniquement si je suis
          // déclaré comme participant (séance partagée).
          if (
            s.created_by_player_id &&
            s.created_by_player_id !== playerId &&
            !(s.event_participants || []).some((p: any) => p.player_id === playerId)
          )
            return false;
          const parts = s.event_participants || [];
          if (parts.length > 0) {
            return parts.some((p: any) => p.player_id === playerId);
          }
          return true;
        });

        const sessionIds = filteredSessions.map((s) => s.id);
        if (sessionIds.length === 0) return [];

        const { data: anyAttendance } = await supabase
          .from("training_attendance")
          .select("training_session_id")
          .eq("player_id", playerId)
          .in("training_session_id", sessionIds)
          .limit(1000);

        const sessionsWithAttendance = new Set(anyAttendance?.map((a) => a.training_session_id));
        const visible = filteredSessions.filter(
          (s) => !sessionsWithAttendance.has(s.id) || isTestCampaignSession(s),
        );
        return enrichSessionsWithBowlingExercise(visible as SessionRow[]);
      }

      const { data, error } = await supabase
        .from("training_sessions")
        .select("id, session_date, training_type, session_start_time, session_end_time, notes, created_by_player_id")
        .in("id", assignedSessionIds)
        .order("session_date")
        .order("session_start_time");
      if (error) throw error;

      const { data: allCatSessions } = await supabase
        .from("training_sessions")
        .select("id, session_date, training_type, session_start_time, session_end_time, notes, created_by_player_id, event_participants(player_id)")
        .eq("category_id", categoryId)
        .gte("session_date", today)
        .lte("session_date", endDate);

      const existingIds = new Set((data || []).map((s) => s.id));
      const allCatSessionIds = (allCatSessions || []).map((s) => s.id);

      if (allCatSessionIds.length > 0) {
        const { data: allAttendance } = await supabase
          .from("training_attendance")
          .select("training_session_id")
          .eq("player_id", playerId)
          .in("training_session_id", allCatSessionIds)
          .limit(1000);

        const sessionsWithAttendance = new Set(allAttendance?.map((a) => a.training_session_id));
        const noAttendanceSessions = (allCatSessions || []).filter((s: any) => {
          if (existingIds.has(s.id)) return false;
          if (sessionsWithAttendance.has(s.id) && !isTestCampaignSession(s)) return false;
          // Séance créée par un autre athlète : visible uniquement si je suis
          // déclaré comme participant (séance partagée).
          if (
            s.created_by_player_id &&
            s.created_by_player_id !== playerId &&
            !(s.event_participants || []).some((p: any) => p.player_id === playerId)
          )
            return false;
          const parts = s.event_participants || [];
          if (parts.length > 0) {
            return parts.some((p: any) => p.player_id === playerId);
          }
          return true;
        });
        const merged = [...(data || []), ...noAttendanceSessions].sort(
          (a, b) =>
            a.session_date.localeCompare(b.session_date) ||
            (a.session_start_time || "").localeCompare(b.session_start_time || "")
        );
        return enrichSessionsWithBowlingExercise(merged as SessionRow[]);
      }

      return enrichSessionsWithBowlingExercise((data || []) as SessionRow[]);
    },
  });

  // Past test-campaign sessions whose period still covers today (e.g. batch planned on
  // day 1 of a 2-week window): they must stay reachable to finish the remaining tests.
  const { data: pastCampaignSessions = [] } = useQuery({
    queryKey: ["athlete-space-past-campaigns", categoryId, playerId, today],
    queryFn: async () => {
      const from = format(addDays(new Date(), -120), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("training_sessions")
        .select("id, session_date, training_type, session_start_time, session_end_time, notes, created_by_player_id, event_participants(player_id)")
        .eq("category_id", categoryId)
        .eq("training_type", "test")
        .gte("session_date", from)
        .lt("session_date", today)
        .order("session_date");
      if (error) throw error;
      return (data || []).filter((s: any) => {
        if (!isTestCampaignSession(s)) return false;
        const win = parseTestWindowFromNotes(s.notes)!;
        if (today < win.start || today > win.end) return false;
        // Séance créée par un autre athlète : visible uniquement si je suis
          // déclaré comme participant (séance partagée).
          if (
            s.created_by_player_id &&
            s.created_by_player_id !== playerId &&
            !(s.event_participants || []).some((p: any) => p.player_id === playerId)
          )
            return false;
        const parts = s.event_participants || [];
        if (parts.length > 0) return parts.some((p: any) => p.player_id === playerId);
        return true;
      }) as SessionRow[];
    },
    enabled: !!playerId && !!categoryId,
  });

  // ---- Test campaigns (tests planned over a period) --------------------------------
  // A campaign session stays visible until every planned test has a result inside the
  // window: the athlete can submit part of the tests one day and the rest later.
  const allSessionsWithCampaigns = useMemo(() => {
    const ids = new Set(allSessions.map((s) => s.id));
    return [...allSessions, ...pastCampaignSessions.filter((s) => !ids.has(s.id))];
  }, [allSessions, pastCampaignSessions]);

  const campaignSessions = useMemo(
    () => allSessionsWithCampaigns.filter((s) => isTestCampaignSession(s)),
    [allSessionsWithCampaigns],
  );
  const campaignSignature = useMemo(
    () => campaignSessions.map((s) => s.id).sort().join(","),
    [campaignSessions],
  );

  const { data: campaignRemaining = {} } = useQuery({
    queryKey: ["athlete-space-test-campaigns", playerId, campaignSignature, today],
    queryFn: async () => {
      const result: Record<string, number> = {};
      const windows = campaignSessions
        .map((s) => parseTestWindowFromNotes(s.notes))
        .filter(Boolean) as Array<{ start: string; end: string }>;
      if (windows.length === 0) return result;
      const minStart = windows.map((w) => w.start).sort()[0];
      const maxEnd = windows.map((w) => w.end).sort().slice(-1)[0];

      const [{ data: pendingData }, { data: savedData }] = await Promise.all([
        supabase
          .from("pending_test_results")
          .select("test_category, test_type, test_date, validation_status")
          .eq("player_id", playerId)
          .gte("test_date", minStart)
          .lte("test_date", maxEnd),
        supabase
          .from("generic_tests")
          .select("test_category, test_type, test_date")
          .eq("player_id", playerId)
          .gte("test_date", minStart)
          .lte("test_date", maxEnd),
      ]);

      for (const s of campaignSessions) {
        const win = parseTestWindowFromNotes(s.notes)!;
        const tests = parseTestsFromNotes(s.notes);
        const taken = new Set<string>();
        (pendingData || []).forEach((p: any) => {
          if (p.validation_status === "rejected") return;
          if (p.test_date >= win.start && p.test_date <= win.end) taken.add(`${p.test_category}::${p.test_type}`);
        });
        (savedData || []).forEach((p: any) => {
          if (p.test_date >= win.start && p.test_date <= win.end) taken.add(`${p.test_category}::${p.test_type}`);
        });
        result[s.id] = tests.filter((tst: any) => !taken.has(`${tst.test_category}::${tst.test_type}`)).length;
      }
      return result;
    },
    enabled: !!playerId && campaignSessions.length > 0,
  });

  // Hide a campaign session only once all its tests are filled in
  const visibleSessions = useMemo(
    () =>
      allSessionsWithCampaigns.filter((s) => {
        if (!isTestCampaignSession(s)) return true;
        const remaining = campaignRemaining[s.id];
        return remaining === undefined || remaining > 0;
      }),
    [allSessionsWithCampaigns, campaignRemaining],
  );

  const isOpenCampaign = (s: { id: string; training_type?: string | null; notes?: string | null }) =>
    isTestCampaignSession(s) && (campaignRemaining[s.id] ?? 1) > 0;

  const todaySessions = visibleSessions.filter(s => {
    if (s.session_date === today) return true;
    // A campaign still open stays on the home screen during the whole window
    if (!isOpenCampaign(s)) return false;
    const win = parseTestWindowFromNotes(s.notes)!;
    return today >= win.start && today <= win.end;
  });
  const upcomingSessions = visibleSessions.filter(s => s.session_date > today && !todaySessions.includes(s));


  // Fetch test results for today
  const testSessionIds = todaySessions.filter(s => s.training_type === "test").map(s => s.id);
  const { data: testResults = [] } = useQuery({
    queryKey: ["athlete-space-test-results", playerId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generic_tests")
        .select("id, test_type, test_category, result_value, result_unit, notes")
        .eq("player_id", playerId)
        .eq("test_date", today);
      if (error) throw error;
      return data || [];
    },
    enabled: testSessionIds.length > 0,
  });

  // Fetch the latest valid weight from wellness, anthropometry and measurements.
  const { entries: weightHistoryEntries } = useWeightHistory({ categoryId, playerId });
  const playerBodyWeight = useMemo(
    () => latestWeightsByPlayer(weightHistoryEntries).get(playerId) || null,
    [weightHistoryEntries, playerId],
  );

  // Collect all custom test_types used, to resolve labels
  // (includes campaign sessions coming from pastCampaignSessions)
  const allCustomTestTypes = useMemo(() => {
    const types: string[] = [];
    allSessionsWithCampaigns.forEach((s: any) => {
      parseTestsFromNotes(s.notes).forEach((t: any) => t?.test_type && types.push(t.test_type));
      const noteCustomCodes = String(s.notes || "").match(/custom:[0-9a-f-]{32,36}/gi) || [];
      noteCustomCodes.forEach((code) => types.push(code));
    });
    (testResults || []).forEach((r: any) => r.test_type && types.push(r.test_type));
    return types;
  }, [allSessionsWithCampaigns, testResults]);
  const customTestMap = useCustomTestLabels(allCustomTestTypes);

  const getTestResultsForSession = (sessionId: string) => {
    const session = allSessionsWithCampaigns.find((s) => s.id === sessionId);
    const planned = session ? parseTestsFromNotes(session.notes) : [];
    const plannedKeys = new Set(
      planned.map((t: any) => `${t.test_category || ""}::${t.test_type || ""}`),
    );
    const plannedTypes = new Set(planned.map((t: any) => String(t.test_type || "")));
    return testResults.filter((t) => {
      // Résultat saisi par l'athlète depuis cette séance
      if (t.notes?.includes(`Session ID: ${sessionId}`)) return true;
      // Résultat saisi côté staff (aucun lien de séance) : on le rattache au test planifié
      if (/Session ID:/i.test(t.notes || "")) return false;
      return (
        plannedKeys.has(`${t.test_category || ""}::${t.test_type || ""}`) ||
        plannedTypes.has(String(t.test_type || ""))
      );
    });
  };

  const getTestNamesForSession = (notes: string | null): string[] => {
    if (!notes) return [];
    const tests = parseTestsFromNotes(notes);
    return tests.map((t: any) => {
      const type = t.test_type || t.test_category;
      if (/^custom[:_]/i.test(type || "")) return labelizeTestType(type, customTestMap);
      return getTestLabel(type) || labelizeTestType(type || "", customTestMap);
    }).filter(Boolean);
  };

  // Fetch already submitted RPEs
  const { data: submittedRpes = [] } = useQuery({
    queryKey: ["athlete-space-rpes", playerId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("awcr_tracking")
        .select("training_session_id")
        .eq("player_id", playerId)
        .eq("session_date", today);
      if (error) throw error;
      return data || [];
    },
  });

  const completedSessionIds = new Set(submittedRpes.map((r) => r.training_session_id));

  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [expandedExerciseSessionId, setExpandedExerciseSessionId] = useState<string | null>(null);
  const [rpe, setRpe] = useState(5);
  const [feeling, setFeeling] = useState<number>(2);
  const [comment, setComment] = useState<string>("");
  const [duration, setDuration] = useState("");
  const [durationLocked, setDurationLocked] = useState(false);
  const [spareExerciseType, setSpareExerciseType] = useState<string>("spare_pin_7");
  const [spareAttempts, setSpareAttempts] = useState("");
  const [spareSuccesses, setSpareSuccesses] = useState("");
  const [showHrv, setShowHrv] = useState(false);
  const [hrvMs, setHrvMs] = useState("");
  const [restingHr, setRestingHr] = useState("");
  const [avgHr, setAvgHr] = useState("");
  const [maxHr, setMaxHr] = useState("");
  const [showZones, setShowZones] = useState(false);
  const [zone1, setZone1] = useState("");
  const [zone2, setZone2] = useState("");
  const [zone3, setZone3] = useState("");
  const [zone4, setZone4] = useState("");
  const [zone5, setZone5] = useState("");
  const [weightLogs, setWeightLogs] = useState<WeightLogState>({});
  const [testResultsInput, setTestResultsInput] = useState<TestResultsState>({});

  // Fetch exercises for all visible sessions
  const allSessionIds = useMemo(() => allSessions.map(s => s.id), [allSessions]);
  const { data: rawSessionExercises = [] } = useQuery({
    queryKey: ["athlete-rpe-exercises-v3", allSessionIds, playerId],
    queryFn: async () => {
      if (allSessionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("gym_session_exercises")
        .select("*")
        .in("training_session_id", allSessionIds)
        .or(`player_id.eq.${playerId},player_id.is.null`)
        .order("order_index");
      if (error) throw error;

      return data || [];
    },
    enabled: allSessionIds.length > 0 && !!playerId,
  });

  const allSessionExercises = useMemo(
    () => resolveSessionExerciseRows(rawSessionExercises, playerId),
    [rawSessionExercises, playerId],
  );

  const exercisesBySession = useMemo(() => {
    return allSessionExercises.reduce((acc, ex) => {
      if (!acc[ex.training_session_id]) acc[ex.training_session_id] = [];
      acc[ex.training_session_id].push(ex);
      return acc;
    }, {} as Record<string, typeof allSessionExercises>);
  }, [allSessionExercises]);

  const selectedSessionData = useMemo(
    () => todaySessions.find((s) => s.id === selectedSession),
    [todaySessions, selectedSession]
  );
  const selectedPrecisionExercise = useMemo(
    () => parsePrecisionExerciseFromNotes(selectedSessionData?.notes),
    [selectedSessionData?.notes]
  );
  const { isAbsent: attendanceAbsent } = useAthleteAttendanceLock(selectedSession, playerId);

  const isBowlingPrecision = selectedSessionData?.training_type === "bowling_spare";
  const isBowlingGame = selectedSessionData?.training_type === "bowling_game" || selectedSessionData?.training_type === "bowling_practice";
  const isGenericPrecision = selectedSessionData?.training_type === "precision";
  const isRugbyPrecision = isGenericPrecision && sportType && isRugbyType(sportType);
  const isPrecisionSession = isBowlingPrecision || isGenericPrecision;
  const [showBowlingSheet, setShowBowlingSheet] = useState(false);
  const [savedGameScores, setSavedGameScores] = useState<number[]>([]);
  const [submittingGame, setSubmittingGame] = useState(false);

  // State for generic precision exercises
  const [precisionExerciseId, setPrecisionExerciseId] = useState<string | null>(null);
  const [precisionExerciseLabel, setPrecisionExerciseLabel] = useState("");

  const getSpareExerciseLabel = (value: string | null | undefined): string | null => {
    if (!value) return null;
    return BOWLING_EXERCISE_LABELS[value] || SPARE_EXERCISE_TYPES.find((t) => t.value === value)?.label || value;
  };

  const getSessionDuration = (session: { session_start_time?: string | null; session_end_time?: string | null }) => {
    if (!session.session_start_time || !session.session_end_time) return null;
    const [sh, sm] = session.session_start_time.split(":").map(Number);
    const [eh, em] = session.session_end_time.split(":").map(Number);
    const diff = eh * 60 + em - (sh * 60 + sm);
    return diff > 0 ? diff : null;
  };

  const attemptsValue = Number(spareAttempts);
  const successesValue = Number(spareSuccesses);
  const isSpareStatsValid =
    !isPrecisionSession ||
    isRugbyPrecision ||
    (Number.isInteger(attemptsValue) &&
      Number.isInteger(successesValue) &&
      attemptsValue > 0 &&
      successesValue >= 0 &&
      successesValue <= attemptsValue);

  const getSessionTrainingLabel = (session: SessionRow) => {
    const baseLabel = getTrainingTypeLabel(session.training_type);
    
    // Show precision exercise theme for rugby precision sessions
    if (session.training_type === "precision") {
      const precisionEx = parsePrecisionExerciseFromNotes(session.notes);
      if (precisionEx) {
        const exerciseConfig = RUGBY_PRECISION_EXERCISES.find(e => e.value === precisionEx.id);
        const categoryConfig = exerciseConfig 
          ? EXERCISE_CATEGORIES.find(c => c.exercises.some(e => e.value === exerciseConfig.value))
          : null;
        const symbol = exerciseConfig?.shape === "square" ? "■" : exerciseConfig?.shape === "diamond" ? "◆" : "●";
        return `${baseLabel} — ${categoryConfig ? categoryConfig.label + " " : ""}${symbol} ${precisionEx.label}`;
      }
      return baseLabel;
    }
    
    if (session.training_type !== "bowling_spare") return baseLabel;

    const selectedExerciseLabel =
      selectedSession === session.id ? getSpareExerciseLabel(spareExerciseType) : null;
    const configuredExerciseLabel = getSpareExerciseLabel(session.bowling_exercise_type);

    return `${baseLabel} — ${configuredExerciseLabel || selectedExerciseLabel || t("athleteSpace.rpe.exerciseToDefine")}`;
  };

  const handleSelectSession = (sessionId: string) => {
    if (sessionId === selectedSession) {
      setSelectedSession(null);
      return;
    }

    setSelectedSession(sessionId);
    setRpe(5);
    setSpareAttempts("");
    setSpareSuccesses("");
    setShowHrv(false);
    setHrvMs("");
    setRestingHr("");
    setAvgHr("");
    setMaxHr("");
    setShowZones(false);
    setZone1(""); setZone2(""); setZone3(""); setZone4(""); setZone5("");
    setPrecisionExerciseId(null);
    setPrecisionExerciseLabel("");
    setWeightLogs({});
    setShowBowlingSheet(false);
    setSavedGameScores([]);

    const session = todaySessions.find((s) => s.id === sessionId);
    if (session) {
      const mappedExercise = session.bowling_exercise_type
        ? BLOCK_TO_SPARE_MAP[session.bowling_exercise_type] || "spare_pin_7"
        : "spare_pin_7";
      setSpareExerciseType(mappedExercise);

      const calcDuration = getSessionDuration(session);
      if (calcDuration) {
        setDuration(calcDuration.toString());
        setDurationLocked(true);
      } else {
        setDuration("");
        setDurationLocked(false);
      }
    }
  };

  const submitRpe = useMutation({
    mutationFn: async () => {
      if (!selectedSession || !duration) throw new Error(t("athleteSpace.rpe.missingData"));

      const durationMin = parseInt(duration, 10);
      if (Number.isNaN(durationMin) || durationMin <= 0) {
        throw new Error(t("athleteSpace.rpe.invalidDuration"));
      }

      if (isPrecisionSession && !isRugbyPrecision && !isSpareStatsValid) {
        throw new Error(t("athleteSpace.rpe.invalidStats"));
      }

      const sessionDate = selectedSessionData?.session_date || today;
      const awcrPayload = {
        player_id: playerId,
        category_id: categoryId,
        session_date: sessionDate,
        rpe,
        duration_minutes: durationMin,
        training_session_id: selectedSession,
        post_session_feeling: feeling,
        post_session_notes: comment || null,
      };
      const { data: updatedAwcrRows, error: updateAwcrError } = await supabase
        .from("awcr_tracking")
        .update(awcrPayload)
        .eq("player_id", playerId)
        .eq("training_session_id", selectedSession)
        .select("id, post_session_feeling");
      if (updateAwcrError) throw updateAwcrError;

      const hadExistingAwcr = (updatedAwcrRows || []).length > 0;
      const { data: awcrRow, error: awcrError } = hadExistingAwcr
        ? { data: updatedAwcrRows?.[0] ?? null, error: null }
        : await supabase.from("awcr_tracking").insert(awcrPayload).select("id, post_session_feeling").single();

      if (awcrError || !awcrRow) throw awcrError || new Error(t("athleteSpace.rpe.awcrError"));

      // Safety net for duplicate/legacy rows: all rows for this athlete/session must carry
      // the selected post-session feeling used by the coach detail panel.
      const { error: feelingPatchError } = await supabase
        .from("awcr_tracking")
        .update({ post_session_feeling: feeling, post_session_notes: comment || null })
        .eq("player_id", playerId)
        .eq("training_session_id", selectedSession);
      if (feelingPatchError) throw feelingPatchError;

      // Persist feeling + global session comment into wellness_tracking (post-séance)
      try {
        const { data: existingW } = await supabase
          .from("wellness_tracking")
          .select("id")
          .eq("player_id", playerId)
          .eq("tracking_date", sessionDate)
          .maybeSingle();
        if (existingW?.id) {
          await supabase
            .from("wellness_tracking")
            .update({ general_fatigue: feeling, notes: comment || null })
            .eq("id", existingW.id);
        }
      } catch (e) {
        console.error("Wellness post-session save error:", e);
      }

      if (isBowlingPrecision) {
        const successRate = Math.round((successesValue / attemptsValue) * 10000) / 100;
        const { error: spareError } = await supabase.from("bowling_spare_training").insert({
          player_id: playerId,
          category_id: categoryId,
          session_date: today,
          training_session_id: selectedSession,
          exercise_type: spareExerciseType,
          attempts: attemptsValue,
          successes: successesValue,
          success_rate: successRate,
        });

        if (spareError) {
          if (!hadExistingAwcr) await supabase.from("awcr_tracking").delete().eq("id", awcrRow.id);
          throw spareError;
        }
      } else if (isGenericPrecision && !isRugbyPrecision && attemptsValue > 0) {
        // Insert into precision_training table (non-rugby sports)
        const { error: precisionError } = await supabase.from("precision_training").insert({
          player_id: playerId,
          category_id: categoryId,
          session_date: today,
          training_session_id: selectedSession,
          exercise_type_id: precisionExerciseId || null,
          exercise_label: precisionExerciseLabel || t("athleteSpace.rpe.precision"),
          attempts: attemptsValue,
          successes: successesValue,
        });

        if (precisionError) {
          if (!hadExistingAwcr) await supabase.from("awcr_tracking").delete().eq("id", awcrRow.id);
          throw precisionError;
        }
      }
      // Insert HRV data if provided
      if (showHrv && (hrvMs || restingHr || avgHr || maxHr || zone1 || zone2 || zone3 || zone4 || zone5)) {
        const sessionType = selectedSessionData?.training_type;
        const hrvRecordType = sessionType === "test" ? "test" : sessionType === "competition" ? "competition" : "session";
        const { error: hrvError } = await supabase.from("hrv_records").insert({
          player_id: playerId,
          category_id: categoryId,
          record_date: today,
          record_type: hrvRecordType,
          training_session_id: selectedSession,
          hrv_ms: hrvMs ? parseFloat(hrvMs) : null,
          resting_hr_bpm: restingHr ? parseFloat(restingHr) : null,
          avg_hr_bpm: avgHr ? parseFloat(avgHr) : null,
          max_hr_bpm: maxHr ? parseFloat(maxHr) : null,
          zone1_minutes: zone1 ? parseFloat(zone1) : null,
          zone2_minutes: zone2 ? parseFloat(zone2) : null,
          zone3_minutes: zone3 ? parseFloat(zone3) : null,
          zone4_minutes: zone4 ? parseFloat(zone4) : null,
          zone5_minutes: zone5 ? parseFloat(zone5) : null,
        });
        if (hrvError) {
          console.error("HRV insert error:", hrvError);
          toast.error(t("athleteSpace.rpe.savedButHrvError"));
        }
      }

      // Persist actual weights into athlete_exercise_logs (feeds the Tonnage dashboard)
      const weightRecords = buildWeightLogRecords(weightLogs, {
        playerId,
        categoryId,
        trainingSessionId: selectedSession,
      });
      if (weightRecords.length > 0) {
        // Athlete-submitted logs are flagged pending until staff validation.
        const stamped = weightRecords.map((r) => ({
          ...r,
          submitted_by: playerId,
          submitted_via: "athlete" as const,
          validation_status: "pending" as const,
        }));
        const { error: weightError } = await supabase
          .from("athlete_exercise_logs")
          .upsert(stamped, {
            onConflict: "training_session_id,player_id,exercise_name",
          });
        if (weightError) {
          console.error("Weight log insert error:", weightError);
          toast.error(t("athleteSpace.rpe.savedButWeightError"));
        }
      }

      // Persist test results into pending_test_results (staff must validate)
      const testRecords = await filterTestRecordsAgainstWindow(
        buildPendingTestRecords(testResultsInput, selectedSessionData?.notes || null),
        selectedSessionData?.notes || null,
        playerId,
      );
      if (testRecords.length > 0 && selectedSession) {
        const stamped = testRecords.map((r) => ({
          player_id: playerId,
          category_id: categoryId,
          training_session_id: selectedSession,
          test_date: selectedSessionData?.session_date || new Date().toISOString().slice(0, 10),
          test_category: r.test_category,
          test_type: r.test_type,
          result_value: r.result_value,
          result_unit: r.result_unit || null,
          submitted_via: "athlete" as const,
          validation_status: "pending" as const,
        }));
        const { error: testErr } = await supabase.from("pending_test_results").insert(stamped);
        if (testErr) {
          console.error("Pending test results error:", testErr);
          toast.error(t("athleteSpace.rpe.savedButTestError"));
        }
      }
    },
    onSuccess: () => {
      toast.success(isPrecisionSession ? t("athleteSpace.rpe.savedWithStats") : t("athleteSpace.rpe.saved"));
      queryClient.invalidateQueries({ queryKey: ["athlete-space-rpes"] });
      queryClient.invalidateQueries({ queryKey: ["athlete-space-awcr"] });
      queryClient.invalidateQueries({ queryKey: ["athlete-space-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["athlete-space-test-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["athlete-space-past-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["precision-training-stats"] });
      queryClient.invalidateQueries({ queryKey: ["precision-field-entries"] });
      if (showHrv) {
        queryClient.invalidateQueries({ queryKey: ["hrv_records"] });
      }
      setSelectedSession(null);
      setRpe(5);
      setFeeling(2);
      setComment("");
      setDuration("");
      setSpareAttempts("");
      setSpareSuccesses("");
      setSpareExerciseType("spare_pin_7");
      setShowHrv(false);
      setHrvMs("");
      setRestingHr("");
      setAvgHr("");
      setMaxHr("");
      setShowZones(false);
      setZone1(""); setZone2(""); setZone3(""); setZone4(""); setZone5("");
      setPrecisionExerciseId(null);
      setPrecisionExerciseLabel("");
      setWeightLogs({});
      setTestResultsInput({});
      queryClient.invalidateQueries({ queryKey: ["athlete-weight-log-existing"] });
      queryClient.invalidateQueries({ queryKey: ["athlete-exercise-logs"] });
      queryClient.invalidateQueries({ queryKey: ["athlete-exercise-logs-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: any) => toast.error(error?.message || t("athleteSpace.rpe.saveError")),
  });

  const getRpeColor = (val: number) => {
    if (val <= 3) return "text-status-optimal";
    if (val <= 5) return "text-accent";
    if (val <= 7) return "text-warning";
    return "text-destructive";
  };

  const getRpeLabel = (val: number) => {
    if (val <= 2) return t("athleteSpace.rpe.level.veryEasy");
    if (val <= 4) return t("athleteSpace.rpe.level.easy");
    if (val <= 6) return t("athleteSpace.rpe.level.moderate");
    if (val <= 8) return t("athleteSpace.rpe.level.hard");
    return t("athleteSpace.rpe.level.maximal");
  };

  // Types informatifs : pas de RPE
  const NON_RPE_TYPES = new Set(["medical", "video", "video_analyse", "reunion", "surf_video"]);
  const isNonRpe = (s: typeof todaySessions[0]) => NON_RPE_TYPES.has(s.training_type);
  // An open test campaign stays in the "to do" list until every test of the period is filled,
  // even if the RPE has already been submitted.
  const pendingSessions = todaySessions.filter(
    s => (!completedSessionIds.has(s.id) || isOpenCampaign(s)) && !isNonRpe(s),
  );
  const doneSessions = todaySessions.filter(
    s => completedSessionIds.has(s.id) && !isOpenCampaign(s) && !isNonRpe(s),
  );
  const infoTodaySessions = todaySessions.filter(s => isNonRpe(s));

  // Group upcoming sessions by date
  const upcomingByDate = upcomingSessions.reduce<Record<string, typeof upcomingSessions>>((acc, s) => {
    if (!acc[s.session_date]) acc[s.session_date] = [];
    acc[s.session_date].push(s);
    return acc;
  }, {});

  const renderCampaignNotice = (session: { id: string; training_type?: string | null; notes?: string | null }) => {
    if (!isOpenCampaign(session)) return null;
    const win = parseTestWindowFromNotes(session.notes)!;
    const remaining = campaignRemaining[session.id] ?? parseTestsFromNotes(session.notes).length;
    return (
      <div className="text-[11px] mt-1 rounded-md bg-primary/10 border border-primary/20 px-2 py-1 text-primary">
        ⏳ {t("athleteSpace.rpe.campaignRemaining", {
          count: remaining,
          end: format(parseISO(win.end), "dd/MM/yyyy"),
        })}
      </div>
    );
  };

  const renderTestInfo = (session: typeof todaySessions[0]) => {
    if (session.training_type !== "test") return null;
    const testNames = getTestNamesForSession(session.notes);
    const results = session.session_date === today ? getTestResultsForSession(session.id) : [];
    if (testNames.length === 0 && results.length === 0) {
      return (
        <div className="text-xs text-muted-foreground mt-0.5 italic">
          {t("athleteSpace.rpe.testPlanned")}
          {renderCampaignNotice(session)}
        </div>
      );
    }
    return (
      <div className="text-xs text-muted-foreground mt-0.5">
        {testNames.map((name, idx) => <div key={idx}>📋 {name}</div>)}
        {renderCampaignNotice(session)}
        {results.map((r, idx) => {
          const unit = r.result_unit || "";
          const customUnit = /^custom:/i.test(r.test_type || "") ? customTestMap[`custom:${r.test_type.slice(7).toLowerCase()}`]?.unit : null;
          const isRatio = isBodyWeightRatioUnit(unit) || isBodyWeightRatioUnit(customUnit);
          const value = Number(r.result_value);
          let display = `${r.result_value} ${displayUnit(unit)}`;
          if (isRatio && Number.isFinite(value)) {
            display = formatBodyWeightRatioResult(value, playerBodyWeight);
          }
          return <div key={`r-${idx}`}>✅ {labelizeTestType(r.test_type, customTestMap)}: {display}</div>;
        })}
      </div>
    );
  };

  const renderSessionNotes = (notes: string | null) => {
    if (isSimplifiedSession(notes)) {
      return <p className="text-xs text-muted-foreground mt-0.5 italic">{t("athleteSpace.rpe.simplifiedSessionLabel")}</p>;
    }
    const display = getDisplayNotes(notes);
    if (!display) return null;
    const hasStructuredTestLabel = getTestNamesForSession(notes).length > 0;
    const cleaned = display
      .split("\n")
      .map((line) =>
        line.replace(/custom:[0-9a-f-]{32,36}/gi, (code) => labelizeTestType(code, customTestMap)),
      )
      .filter((line, index) => {
        const original = display.split("\n")[index]?.trim() || "";
        return !(hasStructuredTestLabel && /^test\s*:\s*custom:/i.test(original));
      })
      .join("\n")
      .trim();
    if (!cleaned) return null;
    return <p className="text-xs text-muted-foreground mt-0.5 italic whitespace-pre-line">{cleaned}</p>;
  };

  const renderExerciseToggle = (sessionId: string) => {
    const exercises = exercisesBySession[sessionId] || [];
    if (exercises.length === 0) return null;
    const isExpanded = expandedExerciseSessionId === sessionId;
    return (
      <>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpandedExerciseSessionId(isExpanded ? null : sessionId);
          }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1.5"
        >
          <Dumbbell className="h-3 w-3" />
          <span>{exercises.length} exercice{exercises.length > 1 ? "s" : ""}</span>
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {isExpanded && (
          <div className="mt-2 border-t border-border/50 pt-2">
            <GroupedExerciseList exercises={exercises} maxHeight="500px" />
          </div>
        )}
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Today: agenda + sessions to fill — side by side on md+ */}
      {(infoTodaySessions.length > 0 || pendingSessions.length > 0) && (
        <div className={cn(
          "grid gap-4",
          infoTodaySessions.length > 0 && pendingSessions.length > 0 ? "md:grid-cols-2" : "grid-cols-1"
        )}>
          {/* Informational sessions (no RPE possible) */}
          {infoTodaySessions.length > 0 && (
            <Card className="bg-sky-50/50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900/40 h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-sky-800 dark:text-sky-300">
                  <Activity className="h-4 w-4" />
                  {t("athleteSpace.rpe.agendaToday")}
                </CardTitle>
                <CardDescription>{t("athleteSpace.rpe.agendaDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {infoTodaySessions.map((s) => (
                    <div key={s.id} className="p-3 rounded-lg border bg-background/60 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{getTrainingTypeLabel(s.training_type)}</span>
                        {s.session_start_time && (
                          <span className="text-xs text-muted-foreground">
                            • {s.session_start_time.slice(0,5)}{s.session_end_time ? ` – ${s.session_end_time.slice(0,5)}` : ""}
                          </span>
                        )}
                      </div>
                      {renderSessionNotes(s.notes)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Today: Pending sessions */}
          {pendingSessions.length > 0 && (
            <Card className="bg-gradient-card shadow-md border-accent/30 h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-accent" />
                  {t("athleteSpace.rpe.sessionsToFill")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
            {pendingSessions.map(session => (
              <div key={session.id}>
                <div
                  onClick={() => handleSelectSession(session.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                    selectedSession === session.id
                      ? "border-accent bg-accent/5"
                      : "border-border hover:border-accent/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{getSessionTrainingLabel(session)}</p>
                      {renderTestInfo(session)}
                      {renderSessionNotes(session.notes)}
                      {session.session_start_time && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {session.session_start_time?.slice(0, 5)}
                          {session.session_end_time && ` - ${session.session_end_time.slice(0, 5)}`}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">{t("athleteSpace.rpe.toFill")}</Badge>
                  </div>
                  {renderExerciseToggle(session.id)}
                </div>

                {selectedSession === session.id && (
                  <div className="mt-3 p-4 rounded-lg bg-muted/30 space-y-4">
                    {attendanceAbsent && isOpenCampaign(session) ? (
                      <div className="space-y-3">
                        <AthleteAbsentLockNotice />
                        <AthleteTestResultsInput
                          sessionId={session.id}
                          notes={session.notes || null}
                          playerId={playerId}
                          value={testResultsInput}
                          onChange={setTestResultsInput}
                          categoryId={categoryId}
                          sessionDate={today}
                        />
                      </div>
                    ) : attendanceAbsent ? (
                      <AthleteAbsentLockNotice />
                    ) : session.training_type === "terrain" ? (

                      <AthleteFieldBlocksRpe
                        sessionId={session.id}
                        playerId={playerId}
                        categoryId={categoryId}
                        onAllSubmitted={() => setSelectedSession(null)}
                      />
                    ) : (
                    <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm">{t("athleteSpace.rpe.feelingRpe")}</Label>
                        <div className="mt-2">
                          <Slider
                            value={[rpe]}
                            onValueChange={([v]) => setRpe(v)}
                            min={1}
                            max={10}
                            step={1}
                          />
                          <div className="flex justify-between mt-1">
                            <span className={`text-2xl font-bold ${getRpeColor(rpe)}`}>{rpe}/10</span>
                            <span className="text-sm text-muted-foreground self-end">{getRpeLabel(rpe)}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm">{t("athleteSpace.rpe.durationMinutes")}</Label>
                        {durationLocked ? (
                          <div className="mt-1 flex items-center gap-2">
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={duration}
                              readOnly
                              className="bg-muted/50 cursor-not-allowed"
                            />
                            <Badge variant="secondary" className="text-xs whitespace-nowrap shrink-0">
                              {duration}'
                            </Badge>
                          </div>
                        ) : (
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={duration}
                            onChange={e => setDuration(e.target.value)}
                            placeholder={t("athleteSpace.rpe.ex90")}
                            className="mt-1"
                          />
                        )}
                      </div>
                    </div>

                    {/* Ressenti global de la séance */}
                    <div>
                      <Label className="text-sm">{t("athleteSpace.rpe.overallFeeling")}</Label>
                      <div className="mt-2 grid grid-cols-5 gap-2">
                        {[
                          { value: 1, label: t("athleteSpace.rpe.mood.great"), emoji: "💪" },
                          { value: 2, label: t("athleteSpace.rpe.mood.good"), emoji: "🙂" },
                          { value: 3, label: t("athleteSpace.rpe.mood.average"), emoji: "😐" },
                          { value: 4, label: t("athleteSpace.rpe.mood.tired"), emoji: "😓" },
                          { value: 5, label: t("athleteSpace.rpe.mood.exhausted"), emoji: "🥵" },
                        ].map((f) => (
                          <button
                            key={f.value}
                            type="button"
                            onClick={() => setFeeling(f.value)}
                            className={`rounded-lg border p-2 text-center text-xs transition-colors ${
                              feeling === f.value
                                ? "border-accent bg-accent/10 ring-2 ring-accent"
                                : "border-border hover:border-accent/50"
                            }`}
                          >
                            <div className="text-xl leading-none">{f.emoji}</div>
                            <div className="mt-1 text-[10px] text-muted-foreground">{f.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm">{t("athleteSpace.rpe.commentOptional")}</Label>
                      <Input
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={t("athleteSpace.rpe.commentPlaceholder")}
                        className="mt-1"
                      />
                    </div>


                    {/* Bowling precision */}
                    {isBowlingPrecision && (
                      <div className="space-y-3 rounded-lg border border-border p-3">
                        <div>
                          <Label className="text-sm">{t("athleteSpace.rpe.precisionExercise")}</Label>
                          <Select value={spareExerciseType} onValueChange={setSpareExerciseType}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder={t("athleteSpace.rpe.chooseExercise")} />
                            </SelectTrigger>
                            <SelectContent>
                              {SPARE_EXERCISE_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-sm">{t("athleteSpace.rpe.attempts")}</Label>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              value={spareAttempts}
                              onChange={(e) => setSpareAttempts(e.target.value)}
                              placeholder={t("athleteSpace.rpe.ex20")}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">{t("athleteSpace.rpe.successes")}</Label>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              value={spareSuccesses}
                              onChange={(e) => setSpareSuccesses(e.target.value)}
                              placeholder={t("athleteSpace.rpe.ex14")}
                              className="mt-1"
                            />
                          </div>
                        </div>

                        {attemptsValue > 0 && successesValue >= 0 && successesValue <= attemptsValue && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            {t("athleteSpace.rpe.successRate")} : {Math.round((successesValue / attemptsValue) * 10000) / 100}%
                          </p>
                        )}
                      </div>
                    )}

                    {/* Rugby precision with interactive field map */}
                    {isRugbyPrecision && selectedSession && (
                      <AthletePrecisionFieldInput
                        playerId={playerId}
                        categoryId={categoryId}
                        sessionId={selectedSession}
                        initialExerciseType={selectedPrecisionExercise?.id ?? selectedPrecisionExercise?.label}
                      />
                    )}

                    {/* Generic precision (non-rugby sports) */}
                    {isGenericPrecision && !isRugbyPrecision && (
                      <div className="space-y-3 rounded-lg border border-accent/30 p-3">
                        <PrecisionExerciseSelector
                          categoryId={categoryId}
                          sportType={sportType}
                          selectedExerciseId={precisionExerciseId}
                          onExerciseChange={(id, label) => {
                            setPrecisionExerciseId(id);
                            setPrecisionExerciseLabel(label);
                          }}
                          allowCreate
                          compact
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-sm">{t("athleteSpace.rpe.attempts")}</Label>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              value={spareAttempts}
                              onChange={(e) => setSpareAttempts(e.target.value)}
                              placeholder={t("athleteSpace.rpe.ex20")}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">{t("athleteSpace.rpe.successes")}</Label>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              value={spareSuccesses}
                              onChange={(e) => setSpareSuccesses(e.target.value)}
                              placeholder={t("athleteSpace.rpe.ex14")}
                              className="mt-1"
                            />
                          </div>
                        </div>

                        {attemptsValue > 0 && successesValue >= 0 && successesValue <= attemptsValue && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            {t("athleteSpace.rpe.successRate")} : {Math.round((successesValue / attemptsValue) * 10000) / 100}%
                          </p>
                        )}
                      </div>
                    )}

                    {/* Bowling parties d'entraînement (feuille de score multi-parties) */}
                    {isBowlingGame && selectedSession && (
                      <div className="space-y-3 rounded-lg border border-blue-300 dark:border-blue-700 p-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm flex items-center gap-1.5">
                            <Target className="h-3.5 w-3.5 text-blue-600" />
                            {t("athleteSpace.rpe.trainingGames")}
                          </Label>
                          {savedGameScores.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {savedGameScores.length} partie{savedGameScores.length > 1 ? "s" : ""} : {savedGameScores.join(" / ")}
                            </Badge>
                          )}
                        </div>
                        {!showBowlingSheet ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => setShowBowlingSheet(true)}
                            disabled={submittingGame}
                          >
                            {t("athleteSpace.rpe.addGame")}
                          </Button>
                        ) : (
                          <BowlingScoreSheet
                            playerId={playerId}
                            categoryId={categoryId}
                            onCancel={() => setShowBowlingSheet(false)}
                            onSave={async (stats, frames, ballData) => {
                              setSubmittingGame(true);
                              try {
                                const { data, error } = await supabase.functions.invoke(
                                  "athlete-bowling-training",
                                  {
                                    body: {
                                      action: "save_game",
                                      category_id: categoryId,
                                      player_id: playerId,
                                      session_date: today,
                                      training_session_id: selectedSession,
                                      stats,
                                      frames,
                                      ballData,
                                    },
                                  },
                                );
                                if (error || !(data as any)?.success) {
                                  throw new Error((data as any)?.error || error?.message || t("athleteSpace.rpe.error"));
                                }
                                toast.success(t("athleteSpace.rpe.gameSaved", { score: stats.totalScore }));
                                setSavedGameScores((prev) => [...prev, stats.totalScore]);
                                setShowBowlingSheet(false);
                                queryClient.invalidateQueries({ queryKey: ["bowling-training-rounds"] });
                                queryClient.invalidateQueries({ queryKey: ["bowling_training_stats"] });
                              } catch (e: any) {
                                toast.error(e?.message || t("athleteSpace.rpe.gameSaveError"));
                              } finally {
                                setSubmittingGame(false);
                              }
                            }}
                          />
                        )}
                        <p className="text-[11px] text-muted-foreground italic">
                          {t("athleteSpace.rpe.multipleGamesHint")} <b>{t("athleteSpace.rpe.statsTrainingPath")}</b>.
                        </p>
                      </div>
                    )}

                    {/* Actual weights logged by the athlete (feeds Tonnage) */}
                    {selectedSession && (
                      <AthleteWeightLogInput
                        sessionId={selectedSession}
                        playerId={playerId}
                        value={weightLogs}
                        onChange={setWeightLogs}
                        trainingType={selectedSessionData?.training_type ?? null}
                      />
                    )}

                    {/* Test results logged by athlete (pending staff validation) */}
                    {selectedSession && selectedSessionData?.training_type === "test" && (
                      <AthleteTestResultsInput
                        sessionId={selectedSession}
                        notes={selectedSessionData?.notes || null}
                        playerId={playerId}
                        value={testResultsInput}
                        onChange={setTestResultsInput}
                        categoryId={categoryId}
                        sessionDate={
                          selectedSessionData && isOpenCampaign(selectedSessionData)
                            ? today
                            : selectedSessionData?.session_date
                        }
                      />
                    )}

                    {/* Optional HRV section */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={showHrv} onCheckedChange={(v) => {
                          setShowHrv(!!v);
                          if (!v) { setHrvMs(""); setRestingHr(""); setAvgHr(""); setMaxHr(""); setShowZones(false); setZone1(""); setZone2(""); setZone3(""); setZone4(""); setZone5(""); }
                        }} />
                        <Label className="text-sm flex items-center gap-1.5">
                          <Heart className="h-3.5 w-3.5 text-destructive" />
                          {selectedSessionData?.training_type === "test"
                            ? t("athleteSpace.rpe.hrvAddTest")
                            : selectedSessionData?.training_type === "competition"
                            ? t("athleteSpace.rpe.hrvAddCompetition")
                            : t("athleteSpace.rpe.hrvAddSession")}
                        </Label>
                      </div>

                      {showHrv && (
                        <div className="space-y-3 pl-6">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">{t("athleteSpace.rpe.hrvMs")}</Label>
                              <Input
                                type="number"
                                min="0"
                                max="300"
                                placeholder={t("athleteSpace.rpe.ex65")}
                                value={hrvMs}
                                onChange={(e) => setHrvMs(e.target.value)}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">{t("athleteSpace.rpe.restingHr")}</Label>
                              <Input
                                type="number"
                                min="30"
                                max="120"
                                placeholder={t("athleteSpace.rpe.ex55")}
                                value={restingHr}
                                onChange={(e) => setRestingHr(e.target.value)}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">{t("athleteSpace.rpe.avgHr")}</Label>
                              <Input
                                type="number"
                                min="40"
                                max="220"
                                placeholder={t("athleteSpace.rpe.ex145")}
                                value={avgHr}
                                onChange={(e) => setAvgHr(e.target.value)}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">{t("athleteSpace.rpe.maxHr")}</Label>
                              <Input
                                type="number"
                                min="60"
                                max="230"
                                placeholder={t("athleteSpace.rpe.ex185")}
                                value={maxHr}
                                onChange={(e) => setMaxHr(e.target.value)}
                                className="h-9"
                              />
                            </div>
                          </div>

                          {/* Optional zone times */}
                          <div className="flex items-center gap-2">
                            <Checkbox checked={showZones} onCheckedChange={(v) => {
                              setShowZones(!!v);
                              if (!v) { setZone1(""); setZone2(""); setZone3(""); setZone4(""); setZone5(""); }
                            }} />
                            <Label className="text-xs">{t("athleteSpace.rpe.addZoneTime")}</Label>
                          </div>

                          {showZones && (
                            <div className="space-y-2 rounded-lg border border-border p-3">
                              <Label className="text-xs font-medium text-muted-foreground">{t("athleteSpace.rpe.timePerZone")}</Label>
                              {[
                                { label: t("athleteSpace.rpe.zone.z1"), color: "bg-sky-500", state: zone1, setter: setZone1 },
                                { label: t("athleteSpace.rpe.zone.z2"), color: "bg-emerald-500", state: zone2, setter: setZone2 },
                                { label: t("athleteSpace.rpe.zone.z3"), color: "bg-amber-500", state: zone3, setter: setZone3 },
                                { label: t("athleteSpace.rpe.zone.z4"), color: "bg-orange-500", state: zone4, setter: setZone4 },
                                { label: t("athleteSpace.rpe.zone.z5"), color: "bg-red-500", state: zone5, setter: setZone5 },
                              ].map((z) => (
                                <div key={z.label} className="flex items-center gap-2">
                                  <div className={`w-2.5 h-2.5 rounded-full ${z.color} shrink-0`} />
                                  <span className="text-xs w-28 shrink-0">{z.label}</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    placeholder="min"
                                    value={z.state}
                                    onChange={(e) => z.setter(e.target.value)}
                                    className="h-7 w-20 text-sm text-right"
                                  />
                                </div>
                              ))}
                              {(() => {
                                const total = [zone1, zone2, zone3, zone4, zone5]
                                  .filter(Boolean)
                                  .reduce((s, v) => s + (parseFloat(v) || 0), 0);
                                return total > 0 ? (
                                  <p className="text-xs text-muted-foreground text-right">{t("athleteSpace.rpe.total")} : {total} min</p>
                                ) : null;
                              })()}
                            </div>
                          )}

                          <p className="text-[10px] text-muted-foreground">
                            {t("athleteSpace.rpe.hrvVisibleHint")}
                          </p>
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => {
                        if (attendanceAbsent) {
                          toast.error(t("athleteSpace.calendar.attendance.absentLockTitle"));
                          return;
                        }
                        const incomplete = countIncompleteWeightLogs(weightLogs);
                        if (incomplete > 0) {
                          const ok = window.confirm(
                            t("athleteSpace.rpe.incompleteWeightsConfirm", { count: incomplete })
                          );
                          if (!ok) return;
                        }
                        submitRpe.mutate();
                      }}
                      disabled={!duration || !isSpareStatsValid || submitRpe.isPending}
                      className="w-full"
                    >

                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      {isPrecisionSession ? t("athleteSpace.rpe.validateRpeStats") : t("athleteSpace.rpe.validateRpe")}
                    </Button>
                    </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
            </Card>
          )}
        </div>
      )}

      {pendingSessions.length === 0 && (

        <div className={cn(
          "grid gap-4",
          Object.keys(upcomingByDate).length > 0 ? "md:grid-cols-2" : "grid-cols-1"
        )}>
          <Card className="bg-gradient-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                {t("athleteSpace.rpe.todaySession")}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-status-optimal mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {todaySessions.length === 0
                  ? t("athleteSpace.rpe.noSessionToday")
                  : t("athleteSpace.rpe.allRpeSubmitted")}
              </p>
            </CardContent>
          </Card>

          {/* Upcoming sessions (read-only) */}
          {Object.keys(upcomingByDate).length > 0 && (
            <Card className="bg-gradient-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {t("athleteSpace.rpe.upcomingSessions")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(upcomingByDate).map(([date, dateSessions]) => (
                  <div key={date}>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                      📅 {format(parseISO(date), "EEEE d MMMM", { locale: getDateLocale() })}
                    </p>
                    <div className="space-y-2">
                      {dateSessions.map(session => (
                        <div
                          key={session.id}
                          className="p-3 rounded-lg border border-border bg-muted/20 opacity-80"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{getSessionTrainingLabel(session)}</p>
                              {renderTestInfo(session)}
                              {renderSessionNotes(session.notes)}
                              {session.session_start_time && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Clock className="h-3 w-3" />
                                  {session.session_start_time?.slice(0, 5)}
                                  {session.session_end_time && ` - ${session.session_end_time.slice(0, 5)}`}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Lock className="h-3 w-3" />
                              <span className="text-xs">{t("athleteSpace.rpe.dDay")}</span>
                            </div>
                          </div>
                          {renderExerciseToggle(session.id)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* RPE History Charts */}
      {!hideHistory && <AthleteSpaceRpeHistory playerId={playerId} categoryId={categoryId} />}
    </div>
  );
}
