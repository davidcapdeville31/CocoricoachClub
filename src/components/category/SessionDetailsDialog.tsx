import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useState, useRef, useMemo } from "react";
import { getObjectiveLabel } from "@/lib/constants/sessionBlockOptions";
import { getDisplayNotes, parsePrecisionExerciseFromNotes, parseV2BlockTag, parseMentalFromNotes } from "@/lib/utils/sessionNotes";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { format } from "date-fns";
import { Dumbbell, Users, Activity, Clock, Calendar, Printer, Calculator, Info, Bell, Target, Video } from "lucide-react";
import { getCategoryLabel } from "@/lib/constants/exerciseCategories";
import { printElement, exportSessionToPdf, preparePdfWithSettings } from "@/lib/pdfExport";
import { TEST_CATEGORIES } from "@/lib/constants/testCategories";
import { getTrainingStyleConfig, isLinkableMethod, isCardioBlockMethod } from "@/lib/constants/trainingStyles";
import { cn } from "@/lib/utils";
import { calculateWeightedRpe, formatDuration } from "@/lib/weightedRpeCalculations";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getTrainingTypeLabel } from "@/lib/constants/trainingTypes";
import { NotifyAthletesDialog } from "@/components/notifications/NotifyAthletesDialog";
import { BowlingSessionContent } from "@/components/bowling/BowlingSessionContent";
import { TennisDrillTraining } from "@/components/tennis/TennisDrillTraining";
import { PrecisionFieldTracker } from "@/components/rugby/PrecisionFieldTracker";
import { BasketballPrecisionTracker } from "@/components/basketball/BasketballPrecisionTracker";
import { isBasketballPrecisionSport } from "@/lib/constants/basketballPrecisionExercises";
import { RUGBY_PRECISION_EXERCISES, EXERCISE_CATEGORIES } from "@/lib/constants/rugbyPrecisionExercises";
import { isRugbyType } from "@/lib/constants/sportTypes";
import { LinkedMethodSlots, type LinkedMethodType } from "@/components/program-builder-v2/LinkedMethodSlots";
import { FartlekCard } from "@/components/program-builder-v2/FartlekCard";
import { ParticipantsAttendanceList } from "@/components/category/attendance/ParticipantsAttendanceList";
import { ReadOnlyMethodCard } from "@/components/program-builder-v2/ReadOnlyMethodCard";
import { parseV2MethodConfig, stripV2MethodTags } from "@/lib/program-builder-v2/parseV2MethodConfig";
import { SessionAthleteEntriesPanel } from "./SessionAthleteEntriesPanel";
import { useCustomTestLabels, labelizeTestType } from "@/hooks/useCustomTestLabels";
import { formatCategoryLabel } from "@/components/category/tests/customTestCatalog";

interface SessionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  sessionId: string;
  sessionDate: string;
}

const trainingTypeLabels: Record<string, string> = {
  collectif: "Collectif",
  technique_individuelle: "Technique Individuelle",
  physique: "Physique",
  musculation: "Musculation",
  repos: "Repos",
  test: "Test",
  reathlétisation: "Réathlétisation",
  bowling_game: "Parties d'Entraînement",
  bowling_spare: "Entraînement Précision",
  bowling_technique: "Travail Technique",
  bowling_approche: "Travail d'Approche",
  bowling_release: "Travail de Lâcher",
  bowling_practice: "Pratique Libre",
};

const setTypeLabels: Record<string, string> = {
  normal: "Normal",
  superset: "Superset",
  biset: "Biset",
  triset: "Triset",
  giant_set: "Giant Set",
  circuit: "Circuit",
  drop_set: "Drop Set",
  pyramid: "Pyramide",
  cluster: "Cluster",
  emom: "EMOM",
  amrap: "AMRAP",
  for_time: "For Time",
  tabata: "Tabata",
  bulgarian: "Méthode Bulgare",
};

interface ExerciseGroup {
  groupId: string | null;
  exercises: { exercise: any; index: number }[];
  method: string;
}

export function SessionDetailsDialog({
  open,
  onOpenChange,
  categoryId,
  sessionId,
  sessionDate,
}: SessionDetailsDialogProps) {
  const queryClient = useQueryClient();
  const [rpeValues, setRpeValues] = useState<Record<string, { rpe: string; duration: string }>>({});
  const [isNotifyOpen, setIsNotifyOpen] = useState(false);
  const [selectedTestDetail, setSelectedTestDetail] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch category to determine sport type
  const { data: category } = useQuery({
    queryKey: ["category-sport", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("rugby_type, club_id, clubs(sport)")
        .eq("id", categoryId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const sportType = (category as any)?.clubs?.sport || "rugby";
  const isRugby = isRugbyType(sportType);

  const handlePrint = async () => {
    if (!session) return;
    try {
      const { settings: pdfSettings, logoBase64, seasonName } = await preparePdfWithSettings(categoryId);
      await exportSessionToPdf(session, exercises || [], session.training_type || "Séance", {
        customSettings: pdfSettings,
        logoBase64,
        blocks: sessionBlocks || [],
        testCategories: TEST_CATEGORIES,
        seasonName,
      });
    } catch {
      if (printRef.current) {
        printElement(printRef.current, `Séance du ${format(new Date(sessionDate), "PPP", { locale: getDateLocale() })}`);
      }
    }
  };
  
  // Fetch session details
  const { data: session } = useQuery({
    queryKey: ["session-detail", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!sessionId,
  });

  // Fetch session blocks
  const { data: sessionBlocks } = useQuery({
    queryKey: ["session-blocks", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_session_blocks")
        .select("*")
        .eq("training_session_id", sessionId)
        .order("block_order");
      if (error) throw error;
      return data;
    },
    enabled: open && !!sessionId,
  });

  // Fetch exercises for this session (deduplicated)
  const { data: exercises } = useQuery({
    queryKey: ["session-exercises-detail", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gym_session_exercises")
        .select("*")
        .eq("training_session_id", sessionId)
        .order("order_index");
      if (error) throw error;
      
      // Deduplicate by exercise name + order index
      const seen = new Map<string, any>();
      data?.forEach((ex) => {
        const key = `${ex.exercise_name}-${ex.order_index}`;
        if (!seen.has(key)) {
          seen.set(key, ex);
        }
      });
      return Array.from(seen.values());
    },
    enabled: open && !!sessionId,
  });

  // Organize exercises into groups for visual grouping
  const exerciseGroups = useMemo(() => {
    if (!exercises) return [];
    
    const groups: ExerciseGroup[] = [];
    const processedGroupIds = new Set<string>();

    exercises.forEach((exercise, index) => {
      const resolvedMethod =
        (exercise.method && exercise.method !== "normal" ? exercise.method : null) ||
        (exercise.set_type && !["normal", "standard"].includes(exercise.set_type) ? exercise.set_type : null);
      if (exercise.group_id) {
        if (!processedGroupIds.has(exercise.group_id)) {
          processedGroupIds.add(exercise.group_id);
          const groupExercises = exercises
            .map((ex, idx) => ({ exercise: ex, index: idx }))
            .filter(({ exercise: ex }) => ex.group_id === exercise.group_id)
            .sort((a, b) => (a.exercise.group_order || 0) - (b.exercise.group_order || 0));

          groups.push({
            groupId: exercise.group_id,
            exercises: groupExercises,
            method: resolvedMethod || "superset",
          });
        }
      } else {
        groups.push({
          groupId: null,
          exercises: [{ exercise, index }],
          method: resolvedMethod || "normal",
        });
      }
    });

    return groups;
  }, [exercises]);

  // Group exercise groups by V2 builder block (echauffement, musculation, course, etc.)
  const blocksGrouped = useMemo(() => {
    if (!exerciseGroups.length) return [] as Array<{ key: string; type: string; name: string; groups: ExerciseGroup[] }>;
    const order: string[] = [];
    const map = new Map<string, { key: string; type: string; name: string; groups: ExerciseGroup[] }>();
    exerciseGroups.forEach((g) => {
      const firstEx = g.exercises[0]?.exercise;
      const tag = parseV2BlockTag(firstEx?.notes);
      const key = tag ? `${tag.type}|${tag.name}` : "__none__";
      if (!map.has(key)) {
        order.push(key);
        map.set(key, { key, type: tag?.type || "", name: tag?.name || "", groups: [] });
      }
      map.get(key)!.groups.push(g);
    });
    return order.map((k) => map.get(k)!);
  }, [exerciseGroups]);

  // Fetch players
  const { data: players } = useQuery({
    queryKey: ["players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("*")
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

  // Fetch attendance
  const { data: attendance } = useQuery({
    queryKey: ["session-attendance", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_attendance")
        .select("*, player:players(name)")
        .eq("training_session_id", sessionId);
      if (error) throw error;
      return data;
    },
    enabled: open && !!sessionId,
  });

  // Fetch event participants (used for tests / scheduled events)
  const { data: eventParticipants } = useQuery({
    queryKey: ["session-event-participants", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_participants")
        .select("player_id, attendance_status, absence_comment, responded_at, players(id, name, first_name, avatar_url)")
        .eq("training_session_id", sessionId);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!sessionId,
  });

  // Parse tests metadata embedded in notes (<!--TESTS:[...]-->)
  const testsMeta = useMemo(() => {
    if (!session?.notes) return [] as Array<{
      test_category: string;
      test_type: string;
      result_unit?: string;
    }>;
    const m = session.notes.match(/<!--TESTS:(.*?)-->/);
    if (!m) return [];
    try {
      const parsed = JSON.parse(m[1]);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [session?.notes]);

  // Fetch all custom_tests of the club to enrich test cards (image / description / objectives)
  const clubId = (category as any)?.club_id;
  const { data: customTestsDetails } = useQuery({
    queryKey: ["session-custom-tests-club", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from("custom_tests")
        .select("id, name, description, objectives, image_url, video_url, unit, test_category")
        .eq("club_id", clubId);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!clubId,
  });

  const normalizeSlug = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const getCustomTest = (cat: string, testType: string) => {
    if (!customTestsDetails || !testType) return null;
    // 1) Legacy support: test:<uuid> / custom:<uuid>
    if (testType.startsWith("test:") || testType.startsWith("custom:")) {
      const id = testType.split(":")[1];
      return customTestsDetails.find((c) => c.id === id) || null;
    }

    // 2) Standard: test_type stored as `custom_<slug>` and category matches custom_tests.test_category
    if (testType.startsWith("custom_")) {
      const slug = testType.slice(7);
      return (
        customTestsDetails.find(
          (c) => c.test_category === cat && normalizeSlug(c.name) === slug,
        ) || null
      );
    }
    return null;
  };

  const isTestSession = session?.training_type === "test";
  const isInfoOnlySession = session?.training_type === "medical" || session?.training_type === "video_analyse";

  const getTestLabel = (cat: string, type: string) => {
    const c = TEST_CATEGORIES.find((x: any) => x.value === cat);
    const t = c?.tests.find((x: any) => x.value === type);
    return {
      categoryLabel: c?.label || cat,
      testLabel: t?.label || type,
    };
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

  const saveRpe = useMutation({
    mutationFn: async () => {
      const playersToSave = players?.filter((p) => rpeValues[p.id]?.rpe && rpeValues[p.id]?.duration) || [];

      if (playersToSave.length === 0) {
        throw new Error("Aucun RPE à enregistrer");
      }

      // Calculate AWCR for each player and save
      for (const player of playersToSave) {
        const rpe = parseInt(rpeValues[player.id].rpe);
        const duration = parseInt(rpeValues[player.id].duration);
        const trainingLoad = rpe * duration;

        const { acuteLoad, chronicLoad, awcr } = await calculateAWCR(
          player.id,
          sessionDate,
          trainingLoad
        );

        const { error } = await supabase.from("awcr_tracking").insert({
          player_id: player.id,
          category_id: categoryId,
          training_session_id: sessionId,
          session_date: sessionDate,
          rpe,
          duration_minutes: duration,
          acute_load: acuteLoad,
          chronic_load: chronicLoad,
          awcr: awcr,
        });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["awcr_tracking"] });
      queryClient.invalidateQueries({ queryKey: ["awcr-data"] });
      toast.success(`RPE enregistrés avec calcul AWCR automatique`);
      setRpeValues({});
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de l'enregistrement");
    },
  });

  const handleChange = (playerId: string, field: "rpe" | "duration", value: string) => {
    setRpeValues((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [field]: value,
      },
    }));
  };

  const attendedPlayerIds = new Set(attendance?.map(a => a.player_id) || []);
  const playersWithRpe = new Set(existingRpe?.map(r => r.player_id) || []);

  // Render a single exercise card
  const renderExerciseCard = (ex: any, idx: number, isGrouped: boolean, exerciseNumber?: number) => {
    const styleConfig = getTrainingStyleConfig(ex.set_type || ex.method || "normal");

    // If the exercise was built with a V2 method-config (Drop Set, Pyramide,
    // Rest-Pause, AMRAP, EMOM, Tabata, Cluster, Fartlek, etc.), render the
    // exact same colored card as in the session builder.
    const v2Card = <ReadOnlyMethodCard exercise={ex} />;
    const parsedV2 = parseV2MethodConfig(ex.notes);
    if (parsedV2) {
      return (
        <div key={ex.id || idx} className="space-y-1">
          {!isGrouped && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium w-5">{idx + 1}.</span>
            </div>
          )}
          {v2Card}
        </div>
      );
    }

    return (
      <div key={ex.id || idx} className={cn(
        "p-3 border rounded-lg",
        isGrouped ? "bg-background/50" : "bg-card"
      )}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {isGrouped && exerciseNumber && (
              <Badge className={cn("text-white text-xs", styleConfig.color || "bg-primary")}>
                {exerciseNumber}
              </Badge>
            )}
            {!isGrouped && (
              <span className="text-sm font-medium text-muted-foreground w-6">
                {idx + 1}.
              </span>
            )}
            <span className="font-medium">{ex.exercise_name}</span>
          </div>
          <div className="flex gap-1">
            {!isGrouped && ex.set_type && ex.set_type !== "normal" && (
              <Badge variant="secondary" className="text-xs">
                {setTypeLabels[ex.set_type] || ex.set_type}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {getCategoryLabel(ex.exercise_category)}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span>{ex.sets} séries</span>
          {ex.reps && <span>× {ex.reps} reps</span>}
          {ex.weight_kg && <span>@ {ex.weight_kg} kg</span>}
          {ex.rest_seconds && <span>- {ex.rest_seconds}s repos</span>}
          {ex.tempo && <span>Tempo: {ex.tempo}</span>}
        </div>
        {ex.notes && (() => {
          const cleanNotes = stripV2MethodTags(ex.notes).replace(/<!--[\s\S]*?-->/g, "").trim();
          if (!cleanNotes) return null;
          return (
            <p className="text-xs text-muted-foreground mt-2 italic">
              {cleanNotes}
            </p>
          );
        })()}
      </div>
    );
  };

  // Render a grouped block of exercises
  const renderExerciseGroup = (group: ExerciseGroup, groupIdx: number) => {
    if (!group.groupId) {
      // Single exercise, not grouped
      const { exercise, index } = group.exercises[0];
      return renderExerciseCard(exercise, index, false);
    }

    // Grouped linked methods (Superset, Biset, Triset, Giant Set, Bulgarian, Combiné Haltéro)
    // → reuse the same visual as the session builder, in read-only mode.
    const linkedMethods = ["superset", "biset", "triset", "giant_set", "bulgarian", "combine_haltero"];
    if (linkedMethods.includes(group.method)) {
      const slotted = group.exercises.map(({ exercise: ex }, idx) => ({
        id: ex.id || `ro-${groupIdx}-${idx}`,
        exerciseId: ex.library_exercise_id || ex.id || `ro-${groupIdx}-${idx}`,
        exerciseName: ex.exercise_name,
        stationName: ex.exercise_name,
        slotIndex: idx,
        params: {
          sets: ex.sets,
          reps: ex.reps,
          percentage: ex.percentage_1rm,
          tempo: ex.tempo,
          rest: ex.rest_seconds,
        },
      }));
      const restSeconds = group.exercises[0]?.exercise?.rest_seconds ?? undefined;
      return (
        <LinkedMethodSlots
          key={group.groupId}
          method={group.method as LinkedMethodType}
          slottedExercises={slotted}
          onRemoveFromSlot={() => undefined}
          onUpdateParams={() => undefined}
          dayId={`preview-${group.groupId}`}
          defaultEditing={false}
          readOnly
          methodRestSeconds={restSeconds}
        />
      );
    }

    // Other grouped exercises (circuit, drop_set, etc.) → keep the previous compact card.
    const styleConfig = getTrainingStyleConfig(group.method);
    return (
      <div
        key={group.groupId}
        className={cn(
          "border-2 rounded-lg p-3 space-y-2",
          styleConfig.borderColor,
          styleConfig.bgColor
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          <Badge className={cn("text-white", styleConfig.color || "bg-primary")}>
            {setTypeLabels[group.method] || styleConfig.label || group.method}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {group.exercises.length} exercices liés
          </span>
        </div>
        <div className="space-y-2">
          {group.exercises.map(({ exercise, index }, exIdx) =>
            renderExerciseCard(exercise, index, true, exIdx + 1)
          )}
        </div>
      </div>
    );
  };

  // Get block and week info from session notes or title
  const getBlockWeekInfo = () => {
    if (!session) return null;
    // Try to extract from notes or training_type
    const blockName = session.notes?.match(/Bloc\s+(\w+)/i)?.[1] || 
                      trainingTypeLabels[session.training_type] || 
                      session.training_type;
    
    // Calculate week number from session date
    const sessionStart = new Date(sessionDate);
    const yearStart = new Date(sessionStart.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((sessionStart.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
    
    return { blockName, weekNumber };
  };

  const blockWeekInfo = getBlockWeekInfo();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between shrink-0">
          <div>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Séance du {format(new Date(sessionDate), "PPP", { locale: getDateLocale() })}
            </DialogTitle>
            {blockWeekInfo && (
              <p className="text-sm text-muted-foreground mt-1">
                {blockWeekInfo.blockName} - Semaine {blockWeekInfo.weekNumber}
              </p>
            )}
          </div>
          <Button variant="outline" size="icon" onClick={handlePrint} title="Imprimer">
            <Printer className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
        {/* Printable content - includes exercises */}
        <div ref={printRef} className="print-content">
          {session && (
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                {trainingTypeLabels[session.training_type] || session.training_type}
              </Badge>
              {session.intensity && !isTestSession && (
                <Badge variant="outline">Intensité: {session.intensity}/10</Badge>
              )}
              {session.session_start_time && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {session.session_start_time}
                  {session.session_end_time && ` - ${session.session_end_time}`}
                </Badge>
              )}
              {(() => {
                const count = (attendance?.length || 0) + (eventParticipants?.length || 0);
                if (count === 0) return null;
                return (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {count} joueur(s)
                  </Badge>
                );
              })()}
              {session.created_by_player_id && (() => {
                const creator = players?.find(p => p.id === session.created_by_player_id);
                return creator ? (
                  <Badge variant="outline" className="flex items-center gap-1 border-violet-300 text-violet-600 bg-violet-50 dark:bg-violet-950/20 dark:text-violet-400">
                    <Users className="h-3 w-3" />
                    Créée par {creator.first_name ? `${creator.first_name} ${creator.name}` : creator.name}
                  </Badge>
                ) : null;
              })()}
              {/* Precision exercise theme badge */}
              {session.training_type === "precision" && (() => {
                const precisionEx = parsePrecisionExerciseFromNotes(session.notes);
                if (!precisionEx) return null;
                const exerciseConfig = RUGBY_PRECISION_EXERCISES.find(e => e.value === precisionEx.id);
                const categoryConfig = exerciseConfig 
                  ? EXERCISE_CATEGORIES.find(c => c.exercises.some(e => e.value === exerciseConfig.value))
                  : null;
                return (
                  <>
                    {categoryConfig && (
                      <Badge variant="outline" className="flex items-center gap-1 border-accent text-accent">
                        <Target className="h-3 w-3" />
                        {categoryConfig.label}
                      </Badge>
                    )}
                    <Badge className="flex items-center gap-1" style={{ backgroundColor: exerciseConfig?.color || 'hsl(var(--accent))' }}>
                      {exerciseConfig?.shape === "square" ? "■" : exerciseConfig?.shape === "diamond" ? "◆" : "●"}{" "}
                      {precisionEx.label}
                    </Badge>
                  </>
                );
              })()}
            </div>
          )}

          {/* Session Blocks - Thematic segments with weighted RPE */}
          {sessionBlocks && sessionBlocks.length > 0 && (
            <div className="mb-4 space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Blocs thématiques
              </h4>
              <div className="grid gap-2">
                {sessionBlocks.map((block: any, idx: number) => {
                  // Fallback to session-level times when block-level times are missing
                  // (typically for single-block sessions where the user only filled session start/end)
                  const isOnlyBlock = sessionBlocks.length === 1;
                  const startTime = block.start_time || (isOnlyBlock ? session?.session_start_time : null);
                  const endTime = block.end_time || (isOnlyBlock ? session?.session_end_time : null);
                  return (
                  <div
                    key={block.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border-l-4"
                    style={{
                      borderLeftColor: block.intensity 
                        ? `hsl(${Math.max(0, 120 - (block.intensity - 1) * 13)}, 70%, 50%)`
                        : "hsl(var(--muted))"
                    }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {(startTime || endTime) && (
                          <Badge variant="outline" className="font-mono text-xs">
                            {startTime?.slice(0,5) || "?"} - {endTime?.slice(0,5) || "?"}
                          </Badge>
                        )}
                        <span className="font-medium text-sm">
                          {getTrainingTypeLabel(block.training_type)}
                        </span>
                        {block.intensity && (
                          <Badge variant="secondary" className="text-xs">
                            RPE {block.intensity}
                          </Badge>
                        )}
                        {block.session_type && (
                          <Badge variant="outline" className="text-xs">
                            {block.session_type === "technique" ? "Technique" : block.session_type === "physique" ? "Physique" : block.session_type === "mixte" ? "Mixte" : block.session_type === "vitesse" ? "Vitesse" : block.session_type === "contact" ? "Contact" : block.session_type === "jeu_reduit" ? "Jeu réduit" : block.session_type === "simulation_match" ? "Simulation match" : block.session_type}
                          </Badge>
                        )}
                        {block.objective && (
                          <Badge variant="outline" className="text-xs bg-primary/5">
                            {getObjectiveLabel(block.objective)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {block.target_intensity && (
                          <Badge variant="secondary" className="text-xs">
                            Intensité: {block.target_intensity === "faible" ? "Faible" : block.target_intensity === "moderee" ? "Modérée" : block.target_intensity === "elevee" ? "Élevée" : "Très élevée"}
                          </Badge>
                        )}
                        {block.volume && (
                          <Badge variant="secondary" className="text-xs">
                            Vol: {block.volume === "court" ? "Court" : block.volume === "moyen" ? "Moyen" : "Long"}
                          </Badge>
                        )}
                        {block.contact_charge && block.contact_charge !== "aucun" && (
                          <Badge variant="secondary" className="text-xs">
                            Contact: {block.contact_charge === "faible" ? "Faible" : block.contact_charge === "modere" ? "Modéré" : "Élevé"}
                          </Badge>
                        )}
                      </div>
                      {block.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{block.notes}</p>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
              
              {/* Weighted RPE Summary */}
              {(() => {
                const weightedResult = calculateWeightedRpe(sessionBlocks as any);
                if (weightedResult.hasValidData) {
                  return (
                    <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Calculator className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">RPE moyen pondéré</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">
                                Calculé selon la formule : Σ(durée × intensité) / Σ(durée)
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-primary">
                          {weightedResult.weightedRpe.toFixed(1)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          / 10
                        </span>
                        <Badge variant="outline" className="ml-auto">
                          {formatDuration(weightedResult.totalDuration)} au total
                        </Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground space-y-1">
                        {weightedResult.blockDetails.map((detail, i) => (
                          <div key={i} className="flex justify-between">
                            <span>{getTrainingTypeLabel(detail.training_type)}</span>
                            <span>
                              {formatDuration(detail.duration)} × RPE {detail.intensity} = {detail.contribution}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}

          {/* Saisie des scores bowling déplacée dans "Retour/Commentaire" */}


          {/* Tennis-specific drill training for tennis blocks */}
          {sessionBlocks?.some((b: any) => typeof b.training_type === "string" && b.training_type.startsWith("tennis_") && b.training_type !== "tennis_match") && (
            <div className="mb-4 space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                🎾 Exercices spécifiques Tennis
              </h4>
              {players && players.length > 0 ? (
                <div className="space-y-3">
                  {players.map((player) => (
                    <div key={player.id}>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        {player.first_name ? `${player.first_name} ${player.name}` : player.name}
                      </p>
                      <TennisDrillTraining
                        playerId={player.id}
                        categoryId={categoryId}
                        trainingSessionId={sessionId}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Aucun athlète dans cette catégorie.</p>
              )}
            </div>
          )}

          {(() => {
            const mental = parseMentalFromNotes(session?.notes);
            const displayNotes = getDisplayNotes(session?.notes);
            if (!mental && !displayNotes) return null;
            return (
              <div className="mb-4 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-surface to-surface-elevated shadow-sm">
                <div className="flex items-center gap-2 border-b border-border/50 bg-surface-sunken/60 px-4 py-2.5">
                  <Info className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Détails de la séance
                  </span>
                </div>
                <div className="space-y-3 px-4 py-3">
                  {mental && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-violet-500/15 text-violet-600 hover:bg-violet-500/20 dark:text-violet-300">
                        🧠 Mental
                      </Badge>
                      {mental.theme && (
                        <Badge variant="outline" className="border-violet-300/60 text-violet-700 dark:text-violet-300">
                          {mental.theme}
                        </Badge>
                      )}
                      {typeof mental.duration_min === "number" && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {mental.duration_min} min
                        </Badge>
                      )}
                    </div>
                  )}
                  {displayNotes && (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                      {displayNotes}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Exercises section for print */}
          {exerciseGroups.length > 0 && (
            <div className="space-y-3 mt-4 print-exercises hidden print:block">
              <h3 className="font-semibold flex items-center gap-2">
                <Dumbbell className="h-4 w-4" />
                Exercices ({exercises?.length || 0})
              </h3>
              {exerciseGroups.map((group, idx) => (
                <div key={group.groupId || idx}>
                  {renderExerciseGroup(group, idx)}
                </div>
              ))}
            </div>
          )}

          {/* Print footer with block/week info */}
          {blockWeekInfo && (
            <div className="print-only mt-4 pt-4 border-t text-sm text-muted-foreground hidden print:block">
              <p className="font-medium">{blockWeekInfo.blockName} - Semaine {blockWeekInfo.weekNumber}</p>
              <p>Exporté le {format(new Date(), "PPP", { locale: getDateLocale() })}</p>
            </div>
          )}
        </div>

        <Tabs defaultValue={session?.training_type === "precision" && isRugby ? "precision_stats" : "exercises"} className="flex-1 flex flex-col min-h-0">
          <TabsList className={cn(
            "shrink-0",
            session?.training_type === "precision" && isRugby
              ? "grid w-full grid-cols-2"
              : "inline-flex w-auto self-start",
          )}>
            <TabsTrigger value="exercises" className="flex items-center gap-1">
              {isTestSession ? (
                <>
                  <Target className="h-4 w-4" />
                  Tests
                  {testsMeta.length > 0 && (
                    <Badge variant="secondary" className="ml-1">{testsMeta.length}</Badge>
                  )}
                </>
              ) : isInfoOnlySession ? (
                <>
                  <Users className="h-4 w-4" />
                  Participants
                  {(eventParticipants?.length || 0) > 0 && (
                    <Badge variant="secondary" className="ml-1">{eventParticipants!.length}</Badge>
                  )}
                </>
              ) : (
                <>
                  <Dumbbell className="h-4 w-4" />
                  Exercices
                  {exercises && exercises.length > 0 && (
                    <Badge variant="secondary" className="ml-1">{exercises.length}</Badge>
                  )}
                </>
              )}
            </TabsTrigger>
            {session?.training_type === "precision" && isRugby && (
              <TabsTrigger value="precision_stats" className="flex items-center gap-1">
                <Target className="h-4 w-4" />
                Saisie stats
              </TabsTrigger>
            )}
          </TabsList>

          <div className="flex-1 min-h-0 mt-4">
            <TabsContent value="exercises" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col">
              <ScrollArea className="flex-1 h-[60vh]">
                {!isTestSession && !isInfoOnlySession && (
                  <div className="pr-4 space-y-4">
                    {(eventParticipants?.length || 0) > 0 && (
                      <ParticipantsAttendanceList
                        participants={(eventParticipants || []) as any}
                        title="Réponses des athlètes"
                      />
                    )}
                    <SessionAthleteEntriesPanel
                      sessionId={sessionId}
                      categoryId={categoryId}
                      trainingType={session?.training_type}
                      attendance={attendance}
                      eventParticipants={eventParticipants}
                    />
                  </div>
                )}
                {isTestSession ? (
                  <div className="space-y-4 pr-4">
                    {/* Tests list */}
                    {testsMeta.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>Aucun test associé à cette séance</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <Target className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          Tests planifiés ({testsMeta.length})
                        </h4>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {testsMeta.map((t, i) => {
                            const { categoryLabel, testLabel } = getTestLabel(
                              t.test_category,
                              t.test_type,
                            );
                            const customTest = getCustomTest(t.test_category, t.test_type);
                            const displayName = customTest?.name || testLabel;
                            const imageUrl = customTest?.image_url || null;
                            const hasDetails = !!customTest;
                            return (
                              <button
                                type="button"
                                key={`${t.test_category}-${t.test_type}-${i}`}
                                onClick={() => hasDetails && setSelectedTestDetail({ ...customTest, _categoryLabel: categoryLabel, _resultUnit: t.result_unit })}
                                disabled={!hasDetails}
                                className={cn(
                                  "rounded-xl border bg-muted/30 p-3 text-left flex items-center gap-3 transition-colors",
                                  hasDetails && "hover:bg-muted/60 cursor-pointer",
                                )}
                              >
                                <div className="h-12 w-12 shrink-0 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                                  {imageUrl ? (
                                    <img src={imageUrl} alt={displayName} className="h-full w-full object-cover" />
                                  ) : (
                                    <Target className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium truncate flex items-center gap-1.5">
                                    <span className="truncate">{displayName}</span>
                                    {(customTest?.unit || t.result_unit) && (
                                      <span className="text-xs text-muted-foreground">
                                        ({customTest?.unit || t.result_unit})
                                      </span>
                                    )}
                                    {customTest?.video_url && (
                                      <span
                                        className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary shrink-0"
                                        title="Vidéo de démonstration disponible"
                                      >
                                        <Video className="h-3 w-3" />
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                                    {categoryLabel}
                                    {hasDetails && <span className="ml-1 text-primary">· Détails</span>}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Participants list */}
                    <div className="space-y-2">
                      <ParticipantsAttendanceList
                        participants={(eventParticipants || []) as any}
                        title="Athlètes concernés"
                        emptyLabel="Aucun athlète attribué à cette séance."
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Les résultats sont à saisir dans <strong>Programmation → Tests</strong> pour chaque athlète.
                      </p>
                    </div>
                  </div>
                ) : isInfoOnlySession ? (
                  <div className="space-y-2 pr-4">
                    <ParticipantsAttendanceList
                      participants={(eventParticipants || []) as any}
                      title="Participants"
                      emptyLabel="Aucun participant attribué (séance collective)."
                    />
                  </div>
                ) : !exercises || exercises.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Dumbbell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Aucun exercice détaillé pour cette séance</p>
                  </div>
                ) : blocksGrouped.length > 1 || (blocksGrouped[0]?.name) ? (
                  <div className="space-y-5 pr-4">
                    {blocksGrouped.map((blk, bIdx) => (
                      <div key={blk.key} className="space-y-2">
                        {blk.name && (
                          <div className="flex items-center gap-2 pb-1 border-b">
                            <Badge className="bg-primary/10 text-primary border border-primary/30 capitalize">
                              {blk.name}
                            </Badge>
                            {blk.type && blk.type !== blk.name && (
                              <span className="text-xs text-muted-foreground capitalize">
                                {blk.type.replace(/_/g, " ")}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">
                              {blk.groups.reduce((sum, g) => sum + g.exercises.length, 0)} exercice(s)
                            </span>
                          </div>
                        )}
                        <div className="space-y-3">
                          {blk.groups.map((group, idx) => (
                            <div key={group.groupId || `${bIdx}-${idx}`}>
                              {renderExerciseGroup(group, idx)}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 pr-4">
                    {exerciseGroups.map((group, idx) => (
                      <div key={group.groupId || idx}>
                        {renderExerciseGroup(group, idx)}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Precision stats tab with field cartography */}
            {session?.training_type === "precision" && (isRugby || isBasketballPrecisionSport(sportType)) && (
              <TabsContent value="precision_stats" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col">
                <ScrollArea className="flex-1 h-[60vh]">
                  <div className="pr-4">
                    {isBasketballPrecisionSport(sportType) ? (
                      <BasketballPrecisionTracker categoryId={categoryId} />
                    ) : (
                      <PrecisionFieldTracker categoryId={categoryId} />
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            )}

          </div>
        </Tabs>

        </div>

        {/* Notify Button in Header */}
        <div className="absolute top-4 right-12">
          <Button variant="outline" size="sm" onClick={() => setIsNotifyOpen(true)}>
            <Bell className="h-4 w-4 mr-2" />
            Notifier
          </Button>
        </div>
      </DialogContent>

      {/* Notify Athletes Dialog */}
      <NotifyAthletesDialog
        open={isNotifyOpen}
        onOpenChange={setIsNotifyOpen}
        athletes={players || []}
        eventType="session"
        defaultSubject={`Séance du ${format(new Date(sessionDate), "EEEE d MMMM", { locale: getDateLocale() })}`}
        eventDetails={{
          date: format(new Date(sessionDate), "EEEE d MMMM yyyy", { locale: getDateLocale() }),
          time: session?.session_start_time ? session.session_start_time.slice(0, 5) : undefined,
        }}
      />

      {/* Test details dialog */}
      <Dialog open={!!selectedTestDetail} onOpenChange={(o) => !o && setSelectedTestDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              {selectedTestDetail?.name}
              {(selectedTestDetail?.unit || selectedTestDetail?._resultUnit) && (
                <span className="text-sm text-muted-foreground font-normal">
                  ({selectedTestDetail?.unit || selectedTestDetail?._resultUnit})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTestDetail?.image_url && (
              <div className="w-full rounded-xl overflow-hidden bg-muted">
                <img
                  src={selectedTestDetail.image_url}
                  alt={selectedTestDetail.name}
                  className="w-full max-h-72 object-contain"
                />
              </div>
            )}
            {selectedTestDetail?._categoryLabel && (
              <div>
                <Badge variant="secondary">{selectedTestDetail._categoryLabel}</Badge>
              </div>
            )}
            {selectedTestDetail?.description && (
              <div>
                <h5 className="text-sm font-semibold mb-1">Description</h5>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedTestDetail.description}
                </p>
              </div>
            )}
            {selectedTestDetail?.objectives && (
              <div>
                <h5 className="text-sm font-semibold mb-1">Objectifs</h5>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedTestDetail.objectives}
                </p>
              </div>
            )}
            {selectedTestDetail?.video_url && (() => {
              const url: string = selectedTestDetail.video_url;
              const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
              const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
              const embedSrc = ytMatch
                ? `https://www.youtube.com/embed/${ytMatch[1]}`
                : vimeoMatch
                ? `https://player.vimeo.com/video/${vimeoMatch[1]}`
                : null;
              return (
                <div>
                  <h5 className="text-sm font-semibold mb-2">Vidéo de démonstration</h5>
                  {embedSrc ? (
                    <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ paddingBottom: "56.25%" }}>
                      <iframe
                        src={embedSrc}
                        title={selectedTestDetail.name}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="absolute inset-0 w-full h-full border-0"
                      />
                    </div>
                  ) : (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline break-all">
                      {url}
                    </a>
                  )}
                </div>
              );
            })()}
            {!selectedTestDetail?.description && !selectedTestDetail?.objectives && !selectedTestDetail?.image_url && !selectedTestDetail?.video_url && (
              <p className="text-sm text-muted-foreground italic">
                Aucune information complémentaire pour ce test.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
