import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Badge } from "@/components/ui/badge";
import { Activity, ClipboardCheck, Dumbbell, Pencil, Plus, Target, X } from "lucide-react";
import { SessionWeightLogTab } from "./SessionWeightLogTab";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getTrainingTypeLabel } from "@/lib/constants/trainingTypes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getTestCategoriesForSport, TestCategory } from "@/lib/constants/testCategories";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { isRugbyType } from "@/lib/constants/sportTypes";
import { PrecisionFieldTracker } from "@/components/rugby/PrecisionFieldTracker";
import { BowlingSessionContent } from "@/components/bowling/BowlingSessionContent";

interface SessionFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  sessionType: string;
  categoryId: string;
}

interface SessionTest {
  id: string;
  test_category: string;
  test_type: string;
  result_unit: string;
  player_results: Record<string, string>;
  /** Which player results are already saved in DB (read-only) */
  savedPlayerIds?: Set<string>;
  /** Whether the entire test row was loaded from existing data */
  isExisting?: boolean;
  /** Test was pre-selected at session creation (lock category/type) */
  isPreselected?: boolean;
}

export function SessionFeedbackDialog({
  open,
  onOpenChange,
  sessionId,
  sessionType,
  categoryId,
}: SessionFeedbackDialogProps) {
  const [rpeValues, setRpeValues] = useState<Record<string, { rpe: string; duration: string }>>({});
  const [editingRpe, setEditingRpe] = useState<Set<string>>(new Set());
  const [sessionTests, setSessionTests] = useState<SessionTest[]>([]);
  const [weightLogs, setWeightLogs] = useState<Record<string, Record<string, { weight: string; sets: string; reps: string }>>>({});
  const [activeTab, setActiveTab] = useState(sessionType === "precision" ? "precision" : "rpe");
  const queryClient = useQueryClient();

  // Fetch category to get sport type
  const { data: category } = useQuery({
    queryKey: ["category-for-feedback", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("rugby_type")
        .eq("id", categoryId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const sportType = category?.rugby_type || "";
  const isRugby = isRugbyType(sportType);
  const isPrecisionSession = sessionType === "precision" && isRugby;
  const testCategories = getTestCategoriesForSport(sportType);

  // Fetch session details to get default duration and notes (for test config)
  const { data: session } = useQuery({
    queryKey: ["session-for-rpe", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("session_start_time, session_end_time, session_date, notes")
        .eq("id", sessionId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Calculate default duration from session times
  const defaultDuration = useMemo(() => {
    // For test sessions, duration has no meaning — use 1 so trainingLoad = rpe
    if (sessionType === "test") return 1;
    if (session?.session_start_time && session?.session_end_time) {
      const start = session.session_start_time.split(":");
      const end = session.session_end_time.split(":");
      const startMinutes = parseInt(start[0]) * 60 + parseInt(start[1]);
      const endMinutes = parseInt(end[0]) * 60 + parseInt(end[1]);
      return Math.max(0, endMinutes - startMinutes);
    }
    return 60; // Default 60 minutes if no times set
  }, [session, sessionType]);

  // Fetch players
  const { data: players } = useQuery({
    queryKey: ["players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name, avatar_url")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch existing RPE data
  const { data: existingRpe } = useQuery({
    queryKey: ["awcr_tracking", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("awcr_tracking")
        .select("*")
        .eq("training_session_id", sessionId);
      if (error) throw error;
      return data;
    },
    enabled: open && !!sessionId,
  });

  // Fetch attendance - only players marked as present or late
  const { data: attendance } = useQuery({
    queryKey: ["session-attendance", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_attendance")
        .select("player_id, status")
        .eq("training_session_id", sessionId);
      if (error) throw error;
      return data;
    },
    enabled: open && !!sessionId,
  });

  // Fetch invited participants (athletes assigned to this test session)
  const { data: invitedParticipants } = useQuery({
    queryKey: ["session-event-participants", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_participants")
        .select("player_id")
        .eq("training_session_id", sessionId);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!sessionId,
  });

  // Fetch session blocks to detect bowling content (parties / précision)
  const { data: sessionBlocks = [] } = useQuery({
    queryKey: ["session-blocks-feedback", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_session_blocks")
        .select("training_type")
        .eq("training_session_id", sessionId);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!sessionId,
  });

  const bowlingBlockType: "bowling_game" | "bowling_spare" | null = useMemo(() => {
    if (sessionBlocks.some((b: any) => b.training_type === "bowling_game")) return "bowling_game";
    if (sessionBlocks.some((b: any) => b.training_type === "bowling_spare")) return "bowling_spare";
    return null;
  }, [sessionBlocks]);
  const hasBowlingContent = !!bowlingBlockType;

  // Initialize RPE values with default duration when players load
  useEffect(() => {
    if (players && open) {
      const durationStr = defaultDuration.toString();
      setRpeValues((prev) => {
        const updated = { ...prev };
        let changed = false;
        players.forEach((player) => {
          if (!updated[player.id]) {
            updated[player.id] = { rpe: "", duration: durationStr };
            changed = true;
          } else if (updated[player.id].rpe === "" && updated[player.id].duration !== durationStr) {
            // Update duration if RPE hasn't been filled yet (user hasn't started editing)
            updated[player.id] = { ...updated[player.id], duration: durationStr };
            changed = true;
          }
        });
        return changed ? updated : prev;
      });
    }
  }, [players, defaultDuration, open]);

  // Parse test config from session notes
  const parsedTestConfig = useMemo(() => {
    if (!session?.notes) return [];
    const match = session.notes.match(/<!--TESTS:(.*?)-->/);
    if (!match) return [];
    try {
      return JSON.parse(match[1]) as { test_category: string; test_type: string; result_unit: string }[];
    } catch {
      return [];
    }
  }, [session?.notes]);

  // Also check for existing test results in generic_tests (for already saved results)
  const { data: existingTestResults } = useQuery({
    queryKey: ["session-existing-test-results", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generic_tests")
        .select("*")
        .ilike("notes", `%Session ID: ${sessionId}%`);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!sessionId,
  });

  // Pre-populate tests from session config or existing results when dialog opens
  useEffect(() => {
    if (sessionTests.length > 0 || !open) return;
    
    // First try to load from existing results
    if (existingTestResults && existingTestResults.length > 0) {
      const testGroups = new Map<string, SessionTest>();
      existingTestResults.forEach(t => {
        const key = `${t.test_category}_${t.test_type}`;
        if (!testGroups.has(key)) {
          testGroups.set(key, {
            id: crypto.randomUUID(),
            test_category: t.test_category,
            test_type: t.test_type,
            result_unit: t.result_unit || "",
            player_results: {},
            savedPlayerIds: new Set<string>(),
            isExisting: true,
            isPreselected: true,
          });
        }
        const group = testGroups.get(key)!;
        if (t.player_id && t.result_value != null) {
          group.player_results[t.player_id] = t.result_value.toString();
          group.savedPlayerIds!.add(t.player_id);
        }
      });
      setSessionTests(Array.from(testGroups.values()));
      return;
    }
    
    // Otherwise use config from session notes
    if (parsedTestConfig.length > 0) {
      const entries: SessionTest[] = parsedTestConfig.map(t => ({
        id: crypto.randomUUID(),
        test_category: t.test_category,
        test_type: t.test_type,
        result_unit: t.result_unit || "",
        player_results: {},
        isPreselected: true,
      }));
      setSessionTests(entries);
    }
  }, [parsedTestConfig, existingTestResults, open]);

  // Reset values when dialog closes
  useEffect(() => {
    if (!open) {
      setRpeValues({});
      setSessionTests([]);
      setWeightLogs({});
      setActiveTab(sessionType === "precision" ? "precision" : "rpe");
    }
  }, [open, sessionType]);

  const handleWeightLogChange = (playerId: string, exerciseName: string, field: "weight" | "sets" | "reps", value: string) => {
    setWeightLogs((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [exerciseName]: {
          ...(prev[playerId]?.[exerciseName] || { weight: "", sets: "", reps: "" }),
          [field]: value,
        },
      },
    }));
  };

  // Calculate AWCR for a player
  const calculateAWCR = async (playerId: string, sessionDateStr: string, newLoad: number) => {
    const sevenDaysAgo = new Date(sessionDateStr);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const twentyEightDaysAgo = new Date(sessionDateStr);
    twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);

    const { data: recentSessions } = await supabase
      .from("awcr_tracking")
      .select("training_load")
      .eq("player_id", playerId)
      .gte("session_date", sevenDaysAgo.toISOString().split("T")[0])
      .lt("session_date", sessionDateStr);

    const { data: chronicSessions } = await supabase
      .from("awcr_tracking")
      .select("training_load")
      .eq("player_id", playerId)
      .gte("session_date", twentyEightDaysAgo.toISOString().split("T")[0])
      .lt("session_date", sessionDateStr);

    const acuteTotal = (recentSessions?.reduce((sum, s) => sum + (s.training_load || 0), 0) || 0) + newLoad;
    const chronicTotal = chronicSessions?.reduce((sum, s) => sum + (s.training_load || 0), 0) || 0;

    const acuteAvg = acuteTotal / 7;
    const chronicAvg = chronicTotal / 28;

    const awcr = chronicAvg > 0 ? acuteAvg / chronicAvg : 0;

    return { acuteLoad: acuteAvg, chronicLoad: chronicAvg, awcr };
  };

  const saveData = useMutation({
    mutationFn: async () => {
      if (!session?.session_date) throw new Error("Date de séance manquante");
      
      // Save RPE data
      const playersToSave = players?.filter((p) => rpeValues[p.id]?.rpe && rpeValues[p.id]?.duration) || [];

      for (const player of playersToSave) {
        const existingEntry = existingRpe?.find((r) => r.player_id === player.id);
        const isEditing = editingRpe.has(player.id);
        if (existingEntry && !isEditing) continue; // Skip already saved unless editing

        const rpe = parseInt(rpeValues[player.id].rpe);
        const duration = parseInt(rpeValues[player.id].duration);
        const trainingLoad = rpe * duration;

        const { acuteLoad, chronicLoad, awcr } = await calculateAWCR(
          player.id,
          session.session_date,
          trainingLoad
        );

        if (existingEntry && isEditing) {
          const { error } = await supabase
            .from("awcr_tracking")
            .update({
              rpe,
              duration_minutes: duration,
              acute_load: acuteLoad,
              chronic_load: chronicLoad,
              awcr: awcr,
            })
            .eq("id", existingEntry.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("awcr_tracking").insert({
            player_id: player.id,
            category_id: categoryId,
            training_session_id: sessionId,
            session_date: session.session_date,
            rpe,
            duration_minutes: duration,
            acute_load: acuteLoad,
            chronic_load: chronicLoad,
            awcr: awcr,
          });
          if (error) throw error;
        }
      }

      // Save test results
      const testRecords: any[] = [];
      sessionTests.forEach(test => {
        if (!test.test_type) return;
        
        Object.entries(test.player_results).forEach(([playerId, resultValue]) => {
          // Skip already-saved results
          if (test.savedPlayerIds?.has(playerId)) return;
          if (!resultValue || resultValue.trim() === "") return;
          
          testRecords.push({
            player_id: playerId,
            category_id: categoryId,
            test_date: session.session_date,
            test_category: test.test_category,
            test_type: test.test_type,
            result_value: parseFloat(resultValue),
            result_unit: test.result_unit || null,
            notes: `Séance du ${session.session_date} (Session ID: ${sessionId})`,
          });
        });
      });
      
      if (testRecords.length > 0) {
        const { error } = await supabase.from("generic_tests").insert(testRecords);
        if (error) throw error;
      }

      // Save weight logs
      const weightLogRecords: any[] = [];
      Object.entries(weightLogs).forEach(([playerId, exercises]) => {
        Object.entries(exercises).forEach(([exerciseName, vals]) => {
          if (!vals.weight || parseFloat(vals.weight) <= 0) return;
          weightLogRecords.push({
            training_session_id: sessionId,
            player_id: playerId,
            category_id: categoryId,
            exercise_name: exerciseName,
            actual_weight_kg: parseFloat(vals.weight),
            actual_sets: vals.sets ? parseInt(vals.sets) : null,
            actual_reps: vals.reps ? parseInt(vals.reps) : null,
          });
        });
      });

      if (weightLogRecords.length > 0) {
        const { error } = await supabase.from("athlete_exercise_logs").upsert(weightLogRecords, {
          onConflict: "training_session_id,player_id,exercise_name",
        });
        if (error) throw error;
      }

      return { rpeCount: playersToSave.length, testCount: testRecords.length, weightCount: weightLogRecords.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["awcr_tracking"] });
      queryClient.invalidateQueries({ queryKey: ["awcr-data"] });
      queryClient.invalidateQueries({ queryKey: ["training_sessions"] });
      queryClient.invalidateQueries({ queryKey: ["generic_tests", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["generic_tests_discovery", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["today_session_tests"] });
      queryClient.invalidateQueries({ queryKey: ["generic-tests-evolution", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["generic-tests-multi-comparison", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["athlete-exercise-logs"] });
      queryClient.invalidateQueries({ queryKey: ["athlete-exercise-logs-dashboard"] });
      
      const parts: string[] = [];
      if (result.rpeCount > 0) parts.push(`${result.rpeCount} RPE`);
      if (result.testCount > 0) parts.push(`${result.testCount} test(s)`);
      if (result.weightCount > 0) parts.push(`${result.weightCount} charge(s)`);
      
      if (parts.length > 0) {
        toast.success(`Enregistré: ${parts.join(", ")}`);
      } else {
        toast.info("Aucune donnée à enregistrer");
      }
      
      setRpeValues({});
      setSessionTests([]);
      setWeightLogs({});
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erreur lors de l'enregistrement");
    },
  });

  const handleRpeChange = (playerId: string, field: "rpe" | "duration", value: string) => {
    setRpeValues((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [field]: value,
      },
    }));
  };

  // Test management functions
  const addTest = () => {
    const newTest: SessionTest = {
      id: crypto.randomUUID(),
      test_category: "",
      test_type: "",
      result_unit: "",
      player_results: {},
    };
    setSessionTests([...sessionTests, newTest]);
  };

  const updateTest = (testId: string, field: keyof SessionTest, value: any) => {
    setSessionTests(tests => tests.map(t => t.id === testId ? { ...t, [field]: value } : t));
  };

  const removeTest = (testId: string) => {
    setSessionTests(tests => tests.filter(t => t.id !== testId));
  };

  const handleTestCategoryChange = (testId: string, categoryValue: string) => {
    setSessionTests(tests => tests.map(t => t.id === testId ? {
      ...t,
      test_category: categoryValue,
      test_type: "",
      result_unit: "",
      player_results: {},
    } : t));
  };

  const handleTestTypeChange = (testId: string, testTypeValue: string) => {
    const test = sessionTests.find(t => t.id === testId);
    if (!test) return;
    
    const category = testCategories.find(c => c.value === test.test_category);
    const testOption = category?.tests.find(t => t.value === testTypeValue);
    
    setSessionTests(tests => tests.map(t => t.id === testId ? {
      ...t,
      test_type: testTypeValue,
      result_unit: testOption?.unit || "",
      player_results: {},
    } : t));
  };

  const updatePlayerTestResult = (testId: string, playerId: string, value: string) => {
    setSessionTests(tests => tests.map(t => {
      if (t.id !== testId) return t;
      return {
        ...t,
        player_results: { ...t.player_results, [playerId]: value },
      };
    }));
  };

  /**
   * Autosave a single test result on blur. Persists immediately into `generic_tests`,
   * marks the cell as saved (read-only badge), and refreshes related queries so the
   * value is preserved if the user closes/reopens the dialog without clicking "Enregistrer".
   */
  const autosaveTestResult = async (testId: string, playerId: string, rawValue: string) => {
    const value = (rawValue || "").trim();
    if (!value) return;
    const numeric = parseFloat(value);
    if (isNaN(numeric)) return;

    const test = sessionTests.find(t => t.id === testId);
    if (!test || !test.test_type) return;
    if (test.savedPlayerIds?.has(playerId)) return;
    if (!session?.session_date) return;

    try {
      const { error } = await supabase.from("generic_tests").insert({
        player_id: playerId,
        category_id: categoryId,
        test_date: session.session_date,
        test_category: test.test_category,
        test_type: test.test_type,
        result_value: numeric,
        result_unit: test.result_unit || null,
        notes: `Séance du ${session.session_date} (Session ID: ${sessionId})`,
      });
      if (error) throw error;

      // Mark as saved locally so the UI shows the read-only badge immediately
      setSessionTests(tests => tests.map(t => {
        if (t.id !== testId) return t;
        const next = new Set(t.savedPlayerIds || []);
        next.add(playerId);
        return { ...t, savedPlayerIds: next };
      }));

      queryClient.invalidateQueries({ queryKey: ["generic_tests", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["today_session_tests"] });
      queryClient.invalidateQueries({ queryKey: ["generic-tests-evolution", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["generic-tests-multi-comparison", categoryId] });
    } catch (e: any) {
      console.error("Autosave test result failed:", e);
      toast.error("Échec de l'enregistrement automatique du résultat");
    }
  };

  const presentPlayerIds = new Set(
    attendance?.filter((a) => a.status === "present" || a.status === "late").map((a) => a.player_id) || []
  );
  const attendedPlayerIds = presentPlayerIds;
  const playersWithRpe = new Set(existingRpe?.map((r) => r.player_id) || []);
  
  // Filter to only show players who attended (present/late), or all if no attendance recorded
  const playersToShow = useMemo(() => {
    if (!players) return [];
    if (!attendance || attendance.length === 0) return players;
    return players.filter((p) => presentPlayerIds.has(p.id));
  }, [players, attendance, presentPlayerIds]);

  // For tests: restrict to athletes explicitly invited to this test session.
  // Falls back to playersToShow if no participants were recorded (legacy sessions).
  const invitedPlayerIds = useMemo(
    () => new Set((invitedParticipants || []).map((p) => p.player_id)),
    [invitedParticipants],
  );
  const playersForTests = useMemo(() => {
    if (!players) return [];
    if (invitedPlayerIds.size === 0) return playersToShow;
    return players.filter((p) => invitedPlayerIds.has(p.id));
  }, [players, invitedPlayerIds, playersToShow]);

  const hasNewRpeValues = Object.entries(rpeValues).some(
    ([id, val]) => val.rpe && val.duration && (!playersWithRpe.has(id) || editingRpe.has(id))
  );

  const hasTestResults = sessionTests.some(t => 
    t.test_type && Object.entries(t.player_results).some(([pid, v]) => v && v.trim() !== "" && !t.savedPlayerIds?.has(pid))
  );

  const testResultsCount = sessionTests.reduce((acc, t) => 
    acc + Object.entries(t.player_results).filter(([pid, v]) => v && v.trim() !== "" && !t.savedPlayerIds?.has(pid)).length, 0
  );

  const savedTestResultsCount = sessionTests.reduce((acc, t) => 
    acc + (t.savedPlayerIds?.size || 0), 0
  );

  const hasWeightLogs = Object.values(weightLogs).some((exercises) =>
    Object.values(exercises).some((v) => v.weight && parseFloat(v.weight) > 0)
  );
  const weightLogCount = Object.values(weightLogs).reduce(
    (acc, exercises) => acc + Object.values(exercises).filter((v) => v.weight && parseFloat(v.weight) > 0).length,
    0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[95vh] flex flex-col", (isPrecisionSession || hasBowlingContent) ? "max-w-5xl w-[95vw]" : "max-w-lg")}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Saisie post-séance - {getTrainingTypeLabel(sessionType)}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full">
            {isPrecisionSession && (
              <TabsTrigger value="precision" className="flex-1 gap-2">
                <Target className="h-4 w-4" />
                🎯 Précision
              </TabsTrigger>
            )}
            {hasBowlingContent && (
              <TabsTrigger value="bowling" className="flex-1 gap-2">
                <Target className="h-4 w-4" />
                🎳 {bowlingBlockType === "bowling_game" ? "Parties" : "Précision"}
              </TabsTrigger>
            )}
            <TabsTrigger value="rpe" className="flex-1 gap-2">
              <Activity className="h-4 w-4" />
              RPE
              {hasNewRpeValues && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs" title="Joueurs renseignés">
                  {Object.entries(rpeValues).filter(([id, v]) => v.rpe && !playersWithRpe.has(id)).length} joueur(s)
                </Badge>
              )}
            </TabsTrigger>
            {sessionType === "musculation" && (
              <TabsTrigger value="weights" className="flex-1 gap-2">
                <Dumbbell className="h-4 w-4" />
                Charges
                {hasWeightLogs && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {weightLogCount}
                  </Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          {/* Precision tab */}
          {isPrecisionSession && (
            <TabsContent value="precision" className="flex-1 flex flex-col min-h-0 mt-4">
              <div className="flex-1 min-h-0 overflow-y-auto pr-1" style={{ maxHeight: "calc(95vh - 180px)" }}>
                <PrecisionFieldTracker
                  categoryId={categoryId}
                  sessionId={sessionId}
                  sessionDate={session?.session_date}
                />
              </div>
            </TabsContent>
          )}

          {/* Bowling tab (parties d'entraînement / précision spare) */}
          {hasBowlingContent && session?.session_date && (
            <TabsContent value="bowling" className="flex-1 flex flex-col min-h-0 mt-4">
              <div className="flex-1 min-h-0 overflow-y-auto pr-1" style={{ maxHeight: "calc(95vh - 180px)" }}>
                <BowlingSessionContent
                  sessionId={sessionId}
                  categoryId={categoryId}
                  blockType={bowlingBlockType!}
                  sessionDate={session.session_date}
                />
                <p className="text-xs text-muted-foreground mt-3 italic">
                  ✅ Les données bowling sont enregistrées immédiatement et alimentent <b>Datas → Datas d'entraînement</b>.
                </p>
              </div>
            </TabsContent>
          )}

          <TabsContent value="rpe" className="flex-1 flex flex-col min-h-0 mt-4">
            <p className="text-sm text-muted-foreground mb-3">
              RPE: Rate of Perceived Exertion (0-10). La durée est pré-remplie depuis les horaires de la séance.
            </p>

            <div className="flex-1 min-h-0 overflow-y-auto pr-2" style={{ maxHeight: "calc(90vh - 240px)" }}>
              <div className="space-y-2">
                {playersForTests.map((player) => {
                  const existing = existingRpe?.find((r) => r.player_id === player.id);

                  return (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={player.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {(player.first_name || player.name).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <Label className="flex-1 min-w-0 font-medium text-sm break-words">{player.first_name ? `${player.first_name} ${player.name}` : player.name}</Label>
                      {existing && !editingRpe.has(player.id) ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            ✓ RPE {existing.rpe}
                            {sessionType !== "test" && ` - ${existing.duration_minutes}min`}
                            <span className="text-xs ml-1">(charge: {existing.training_load})</span>
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Modifier"
                            onClick={() => {
                              setRpeValues((prev) => ({
                                ...prev,
                                [player.id]: {
                                  rpe: String(existing.rpe ?? ""),
                                  duration: String(existing.duration_minutes ?? defaultDuration),
                                },
                              }));
                              setEditingRpe((prev) => {
                                const next = new Set(prev);
                                next.add(player.id);
                                return next;
                              });
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1">
                            <Label className="text-xs text-muted-foreground">RPE</Label>
                            <Input
                              type="number"
                              min="0"
                              max="10"
                              placeholder="0-10"
                              className="w-16 h-8"
                              value={rpeValues[player.id]?.rpe || ""}
                              onChange={(e) => handleRpeChange(player.id, "rpe", e.target.value)}
                            />
                          </div>
                          {sessionType !== "test" && (
                            <div className="flex items-center gap-1">
                              <Label className="text-xs text-muted-foreground">Min</Label>
                              <Input
                                type="number"
                                min="0"
                                placeholder="Min"
                                className="w-20 h-8"
                                value={rpeValues[player.id]?.duration || ""}
                                onChange={(e) => handleRpeChange(player.id, "duration", e.target.value)}
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {sessionType === "musculation" && (
            <TabsContent value="weights" className="flex-1 flex flex-col min-h-0 mt-4">
              <div className="flex-1 min-h-0 overflow-y-auto pr-2" style={{ maxHeight: "calc(90vh - 240px)" }}>
                <SessionWeightLogTab
                  sessionId={sessionId}
                  categoryId={categoryId}
                  playersToShow={players ?? []}
                  weightLogs={weightLogs}
                  onWeightLogChange={handleWeightLogChange}
                />
              </div>
            </TabsContent>
          )}

        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {(activeTab === "precision" || activeTab === "bowling") ? "Fermer" : "Annuler"}
          </Button>
          {activeTab !== "precision" && activeTab !== "bowling" && (
            <Button
              onClick={() => saveData.mutate()}
              disabled={saveData.isPending || (!hasNewRpeValues && !hasTestResults && !hasWeightLogs)}
            >
              {saveData.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          )}
          {(activeTab === "precision" || activeTab === "bowling") && (
            <p className="text-xs text-muted-foreground self-center">
              ✅ Données sauvegardées automatiquement à chaque saisie.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
