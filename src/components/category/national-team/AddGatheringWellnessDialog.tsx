import { getLocaleTag } from "@/lib/i18n/dateLocale";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Building2, User, ClipboardList } from "lucide-react";

interface AddGatheringWellnessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  assessmentType: "pre_gathering" | "day_of";
  eventId?: string;
  linkedAssessmentId?: string;
  playerId?: string;
}

type ScoreType = "sleep_quality" | "fatigue" | "stress" | "soreness" | "motivation" | "mood" | "appetite" | "hydration";

const PAIN_LOCATION_KEYS = [
  "shoulderLeft", "shoulderRight",
  "elbowLeft", "elbowRight",
  "wristLeft", "wristRight",
  "upperBack", "lowerBack",
  "hipLeft", "hipRight",
  "kneeLeft", "kneeRight",
  "ankleLeft", "ankleRight",
  "hamstringLeft", "hamstringRight",
  "quadLeft", "quadRight",
  "calfLeft", "calfRight",
  "adductors", "abs",
  "neck", "other",
];

const RECOMMENDED_LOAD_VALUES = [
  { value: "full", color: "bg-green-500" },
  { value: "adapted", color: "bg-yellow-500" },
  { value: "light", color: "bg-orange-500" },
  { value: "rest", color: "bg-red-500" },
];

export function AddGatheringWellnessDialog({
  open,
  onOpenChange,
  categoryId,
  assessmentType,
  eventId,
  linkedAssessmentId,
  playerId: initialPlayerId,
}: AddGatheringWellnessDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const SCORE_LABELS = t("health.addGatheringWellnessDialog.scoreLabels", { returnObjects: true }) as Record<ScoreType, Record<number, string>>;
  const PAIN_LOCATIONS = PAIN_LOCATION_KEYS.map((key) => ({
    key,
    label: t(`health.addGatheringWellnessDialog.painLocations.${key}`),
  }));
  const RECOMMENDED_LOAD_OPTIONS = RECOMMENDED_LOAD_VALUES.map((opt) => ({
    ...opt,
    label: t(`health.addGatheringWellnessDialog.loadOptions.${opt.value}`),
  }));
  
  // Form state
  const [playerId, setPlayerId] = useState(initialPlayerId || "");
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split("T")[0]);
  const [filledBy, setFilledBy] = useState("");
  const [filledByRole, setFilledByRole] = useState<string>(
    assessmentType === "pre_gathering" ? "club_trainer" : "player"
  );
  
  // Load data
  const [trainingLoad7Days, setTrainingLoad7Days] = useState<number | undefined>();
  const [trainingLoad14Days, setTrainingLoad14Days] = useState<number | undefined>();
  const [matchesPlayed14Days, setMatchesPlayed14Days] = useState<number | undefined>();
  const [totalMinutes14Days, setTotalMinutes14Days] = useState<number | undefined>();
  
  // Wellness scores
  const [sleepQuality, setSleepQuality] = useState(3);
  const [sleepDuration, setSleepDuration] = useState<number | undefined>();
  const [fatigueLevel, setFatigueLevel] = useState(3);
  const [stressLevel, setStressLevel] = useState(3);
  const [muscleSoreness, setMuscleSoreness] = useState(3);
  const [motivationLevel, setMotivationLevel] = useState(3);
  const [moodLevel, setMoodLevel] = useState(3);
  const [appetiteLevel, setAppetiteLevel] = useState(3);
  const [hydrationLevel, setHydrationLevel] = useState(3);
  
  // Pain
  const [hasPain, setHasPain] = useState(false);
  const [painLocations, setPainLocations] = useState<string[]>([]);
  const [painIntensity, setPainIntensity] = useState(1);
  const [painDescription, setPainDescription] = useState("");
  
  // Injuries & limitations
  const [recentInjuries, setRecentInjuries] = useState("");
  const [currentLimitations, setCurrentLimitations] = useState("");
  const [currentAwcr, setCurrentAwcr] = useState<number | undefined>();
  
  // Comments
  const [clubStaffComments, setClubStaffComments] = useState("");
  const [playerComments, setPlayerComments] = useState("");
  const [nationalStaffComments, setNationalStaffComments] = useState("");
  
  // Recommendations
  const [recommendedLoad, setRecommendedLoad] = useState<string>("full");
  const [specificRecommendations, setSpecificRecommendations] = useState("");

  // Fetch players
  const { data: players } = useQuery({
    queryKey: ["players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch events
  const { data: events } = useQuery({
    queryKey: ["national_team_events", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("national_team_events")
        .select("*")
        .eq("category_id", categoryId)
        .in("event_type", ["stage", "rassemblement"])
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch linked assessment if available
  const { data: linkedAssessment } = useQuery({
    queryKey: ["linked_assessment", linkedAssessmentId],
    queryFn: async () => {
      if (!linkedAssessmentId) return null;
      const { data, error } = await supabase
        .from("gathering_wellness_assessments")
        .select("*")
        .eq("id", linkedAssessmentId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!linkedAssessmentId,
  });

  // Fetch player's latest AWCR
  const { data: latestAwcr } = useQuery({
    queryKey: ["player_awcr", playerId],
    queryFn: async () => {
      if (!playerId) return null;
      const { data, error } = await supabase
        .from("awcr_tracking")
        .select("awcr, training_load")
        .eq("player_id", playerId)
        .order("session_date", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0];
    },
    enabled: !!playerId,
  });

  useEffect(() => {
    if (latestAwcr?.awcr) {
      setCurrentAwcr(latestAwcr.awcr);
    }
  }, [latestAwcr]);

  const [selectedEventId, setSelectedEventId] = useState(eventId || "");

  const resetForm = () => {
    setPlayerId(initialPlayerId || "");
    setAssessmentDate(new Date().toISOString().split("T")[0]);
    setFilledBy("");
    setFilledByRole(assessmentType === "pre_gathering" ? "club_trainer" : "player");
    setTrainingLoad7Days(undefined);
    setTrainingLoad14Days(undefined);
    setMatchesPlayed14Days(undefined);
    setTotalMinutes14Days(undefined);
    setSleepQuality(3);
    setSleepDuration(undefined);
    setFatigueLevel(3);
    setStressLevel(3);
    setMuscleSoreness(3);
    setMotivationLevel(3);
    setMoodLevel(3);
    setAppetiteLevel(3);
    setHydrationLevel(3);
    setHasPain(false);
    setPainLocations([]);
    setPainIntensity(1);
    setPainDescription("");
    setRecentInjuries("");
    setCurrentLimitations("");
    setCurrentAwcr(undefined);
    setClubStaffComments("");
    setPlayerComments("");
    setNationalStaffComments("");
    setRecommendedLoad("full");
    setSpecificRecommendations("");
    setSelectedEventId(eventId || "");
  };

  const addAssessment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("gathering_wellness_assessments").insert({
        category_id: categoryId,
        player_id: playerId,
        event_id: selectedEventId || null,
        assessment_type: assessmentType,
        assessment_date: assessmentDate,
        linked_assessment_id: linkedAssessmentId || null,
        filled_by: filledBy || null,
        filled_by_role: filledByRole,
        training_load_last_7_days: trainingLoad7Days,
        training_load_last_14_days: trainingLoad14Days,
        matches_played_last_14_days: matchesPlayed14Days,
        total_minutes_last_14_days: totalMinutes14Days,
        sleep_quality: sleepQuality,
        sleep_duration_hours: sleepDuration,
        fatigue_level: fatigueLevel,
        stress_level: stressLevel,
        muscle_soreness: muscleSoreness,
        motivation_level: motivationLevel,
        mood_level: moodLevel,
        appetite_level: appetiteLevel,
        hydration_level: hydrationLevel,
        has_pain: hasPain,
        pain_locations: hasPain ? painLocations : null,
        pain_intensity: hasPain ? painIntensity : null,
        pain_description: hasPain ? painDescription : null,
        recent_injuries: recentInjuries || null,
        current_limitations: currentLimitations || null,
        current_awcr: currentAwcr,
        club_staff_comments: clubStaffComments || null,
        player_comments: playerComments || null,
        national_staff_comments: nationalStaffComments || null,
        recommended_load: recommendedLoad,
        specific_recommendations: specificRecommendations || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gathering_wellness"] });
      toast.success(t("health.addGatheringWellnessDialog.toastSuccess"));
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(t("health.addGatheringWellnessDialog.toastError"));
      console.error(error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerId) {
      toast.error(t("health.addGatheringWellnessDialog.toastPlayerRequired"));
      return;
    }
    addAssessment.mutate();
  };

  const togglePainLocation = (location: string) => {
    setPainLocations(prev =>
      prev.includes(location)
        ? prev.filter(l => l !== location)
        : [...prev, location]
    );
  };

  const ScoreSlider = ({
    label,
    value,
    onChange,
    type,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    type: keyof typeof SCORE_LABELS;
  }) => (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label>{label}</Label>
        <span className="text-sm text-muted-foreground">
          {value} - {SCORE_LABELS[type][value]}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        min={1}
        max={5}
        step={1}
        className="w-full"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {assessmentType === "pre_gathering" ? (
              <>
                <Building2 className="h-5 w-5" />
                {t("health.addGatheringWellnessDialog.titlePreGathering")}
              </>
            ) : (
              <>
                <User className="h-5 w-5" />
                {t("health.addGatheringWellnessDialog.titleDayOf")}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <ScrollArea className="h-[calc(90vh-180px)] pr-4">
            <Tabs defaultValue="general" className="space-y-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="general">{t("health.addGatheringWellnessDialog.tabs.general")}</TabsTrigger>
                <TabsTrigger value="load">{t("health.addGatheringWellnessDialog.tabs.load")}</TabsTrigger>
                <TabsTrigger value="wellness">{t("health.addGatheringWellnessDialog.tabs.wellness")}</TabsTrigger>
                <TabsTrigger value="pain">{t("health.addGatheringWellnessDialog.tabs.pain")}</TabsTrigger>
                <TabsTrigger value="comments">{t("health.addGatheringWellnessDialog.tabs.comments")}</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("health.addGatheringWellnessDialog.playerLabel")}</Label>
                    <Select value={playerId} onValueChange={setPlayerId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("health.addGatheringWellnessDialog.selectPlayerPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {players?.map((player) => (
                          <SelectItem key={player.id} value={player.id}>
                            {player.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("health.addGatheringWellnessDialog.linkedEventLabel")}</Label>
                    <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("health.addGatheringWellnessDialog.selectEventPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {events?.map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            {event.name} - {new Date(event.start_date).toLocaleDateString(getLocaleTag())}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("health.addGatheringWellnessDialog.assessmentDateLabel")}</Label>
                    <Input
                      type="date"
                      value={assessmentDate}
                      onChange={(e) => setAssessmentDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("health.addGatheringWellnessDialog.filledByLabel")}</Label>
                    <Input
                      value={filledBy}
                      onChange={(e) => setFilledBy(e.target.value)}
                      placeholder={assessmentType === "pre_gathering" ? t("health.addGatheringWellnessDialog.filledByPlaceholderClub") : t("health.addGatheringWellnessDialog.filledByPlaceholderPlayer")}
                    />
                  </div>
                </div>

                {linkedAssessment && (
                  <Card className="border-primary/50 bg-primary/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" />
                        {t("health.addGatheringWellnessDialog.linkedAssessmentTitle")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <span className="text-muted-foreground">{t("health.addGatheringWellnessDialog.fatigue")}</span>{" "}
                          <Badge variant="outline">{linkedAssessment.fatigue_level}/5</Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("health.addGatheringWellnessDialog.sleep")}</span>{" "}
                          <Badge variant="outline">{linkedAssessment.sleep_quality}/5</Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("health.addGatheringWellnessDialog.load7d")}</span>{" "}
                          <Badge variant="outline">{linkedAssessment.training_load_last_7_days || t("health.addGatheringWellnessDialog.notAvailable")}</Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("health.addGatheringWellnessDialog.recommendation")}</span>{" "}
                          <Badge variant="outline">{linkedAssessment.recommended_load}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="load" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("health.addGatheringWellnessDialog.trainingLoadTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("health.addGatheringWellnessDialog.load7dLabel")}</Label>
                        <Input
                          type="number"
                          value={trainingLoad7Days || ""}
                          onChange={(e) => setTrainingLoad7Days(e.target.value ? Number(e.target.value) : undefined)}
                          placeholder={t("health.addGatheringWellnessDialog.load7dPlaceholder")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("health.addGatheringWellnessDialog.load14dLabel")}</Label>
                        <Input
                          type="number"
                          value={trainingLoad14Days || ""}
                          onChange={(e) => setTrainingLoad14Days(e.target.value ? Number(e.target.value) : undefined)}
                          placeholder={t("health.addGatheringWellnessDialog.load14dPlaceholder")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("health.addGatheringWellnessDialog.matches14dLabel")}</Label>
                        <Input
                          type="number"
                          value={matchesPlayed14Days || ""}
                          onChange={(e) => setMatchesPlayed14Days(e.target.value ? Number(e.target.value) : undefined)}
                          placeholder={t("health.addGatheringWellnessDialog.matches14dPlaceholder")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("health.addGatheringWellnessDialog.minutes14dLabel")}</Label>
                        <Input
                          type="number"
                          value={totalMinutes14Days || ""}
                          onChange={(e) => setTotalMinutes14Days(e.target.value ? Number(e.target.value) : undefined)}
                          placeholder={t("health.addGatheringWellnessDialog.minutes14dPlaceholder")}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>{t("health.addGatheringWellnessDialog.currentAwcrLabel")}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={currentAwcr || ""}
                        onChange={(e) => setCurrentAwcr(e.target.value ? Number(e.target.value) : undefined)}
                        placeholder={t("health.addGatheringWellnessDialog.currentAwcrPlaceholder")}
                      />
                      {latestAwcr?.awcr && (
                        <p className="text-xs text-muted-foreground">
                          {t("health.addGatheringWellnessDialog.lastRecordedValue", { value: latestAwcr.awcr.toFixed(2) })}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="wellness" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("health.addGatheringWellnessDialog.generalStateTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <ScoreSlider
                        label={t("health.addGatheringWellnessDialog.sleepQualityLabel")}
                        value={sleepQuality}
                        onChange={setSleepQuality}
                        type="sleep_quality"
                      />
                      <div className="space-y-2">
                        <Label>{t("health.addGatheringWellnessDialog.sleepDurationLabel")}</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={sleepDuration || ""}
                          onChange={(e) => setSleepDuration(e.target.value ? Number(e.target.value) : undefined)}
                          placeholder={t("health.addGatheringWellnessDialog.sleepDurationPlaceholder")}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <ScoreSlider
                        label={t("health.addGatheringWellnessDialog.fatigueLevelLabel")}
                        value={fatigueLevel}
                        onChange={setFatigueLevel}
                        type="fatigue"
                      />
                      <ScoreSlider
                        label={t("health.addGatheringWellnessDialog.stressLevelLabel")}
                        value={stressLevel}
                        onChange={setStressLevel}
                        type="stress"
                      />
                    </div>

                    <ScoreSlider
                      label={t("health.addGatheringWellnessDialog.sorenessLabel")}
                      value={muscleSoreness}
                      onChange={setMuscleSoreness}
                      type="soreness"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("health.addGatheringWellnessDialog.mentalStateTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <ScoreSlider
                        label={t("health.addGatheringWellnessDialog.motivationLabel")}
                        value={motivationLevel}
                        onChange={setMotivationLevel}
                        type="motivation"
                      />
                      <ScoreSlider
                        label={t("health.addGatheringWellnessDialog.moodLabel")}
                        value={moodLevel}
                        onChange={setMoodLevel}
                        type="mood"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <ScoreSlider
                        label={t("health.addGatheringWellnessDialog.appetiteLabel")}
                        value={appetiteLevel}
                        onChange={setAppetiteLevel}
                        type="appetite"
                      />
                      <ScoreSlider
                        label={t("health.addGatheringWellnessDialog.hydrationLabel")}
                        value={hydrationLevel}
                        onChange={setHydrationLevel}
                        type="hydration"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pain" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      {t("health.addGatheringWellnessDialog.painTitle")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={hasPain} onCheckedChange={setHasPain} />
                      <Label>{t("health.addGatheringWellnessDialog.hasPainLabel")}</Label>
                    </div>

                    {hasPain && (
                      <>
                        <div className="space-y-2">
                          <Label>{t("health.addGatheringWellnessDialog.painLocationsLabel")}</Label>
                          <div className="flex flex-wrap gap-2">
                            {PAIN_LOCATIONS.map((location) => (
                              <Badge
                                key={location.key}
                                variant={painLocations.includes(location.key) ? "default" : "outline"}
                                className="cursor-pointer"
                                onClick={() => togglePainLocation(location.key)}
                              >
                                {location.label}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <Label>{t("health.addGatheringWellnessDialog.painIntensityLabel")}</Label>
                            <span className="text-sm text-muted-foreground">{painIntensity}/10</span>
                          </div>
                          <Slider
                            value={[painIntensity]}
                            onValueChange={(v) => setPainIntensity(v[0])}
                            min={1}
                            max={10}
                            step={1}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>{t("health.addGatheringWellnessDialog.painDescriptionLabel")}</Label>
                          <Textarea
                            value={painDescription}
                            onChange={(e) => setPainDescription(e.target.value)}
                            placeholder={t("health.addGatheringWellnessDialog.painDescriptionPlaceholder")}
                          />
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("health.addGatheringWellnessDialog.injuriesTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t("health.addGatheringWellnessDialog.recentInjuriesLabel")}</Label>
                      <Textarea
                        value={recentInjuries}
                        onChange={(e) => setRecentInjuries(e.target.value)}
                        placeholder={t("health.addGatheringWellnessDialog.recentInjuriesPlaceholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("health.addGatheringWellnessDialog.currentLimitationsLabel")}</Label>
                      <Textarea
                        value={currentLimitations}
                        onChange={(e) => setCurrentLimitations(e.target.value)}
                        placeholder={t("health.addGatheringWellnessDialog.currentLimitationsPlaceholder")}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="comments" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("health.addGatheringWellnessDialog.commentsTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {assessmentType === "pre_gathering" && (
                      <div className="space-y-2">
                        <Label>{t("health.addGatheringWellnessDialog.clubStaffCommentsLabel")}</Label>
                        <Textarea
                          value={clubStaffComments}
                          onChange={(e) => setClubStaffComments(e.target.value)}
                          placeholder={t("health.addGatheringWellnessDialog.clubStaffCommentsPlaceholder")}
                        />
                      </div>
                    )}

                    {assessmentType === "day_of" && (
                      <div className="space-y-2">
                        <Label>{t("health.addGatheringWellnessDialog.playerCommentsLabel")}</Label>
                        <Textarea
                          value={playerComments}
                          onChange={(e) => setPlayerComments(e.target.value)}
                          placeholder={t("health.addGatheringWellnessDialog.playerCommentsPlaceholder")}
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>{t("health.addGatheringWellnessDialog.nationalStaffCommentsLabel")}</Label>
                      <Textarea
                        value={nationalStaffComments}
                        onChange={(e) => setNationalStaffComments(e.target.value)}
                        placeholder={t("health.addGatheringWellnessDialog.nationalStaffCommentsPlaceholder")}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("health.addGatheringWellnessDialog.recommendationsTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t("health.addGatheringWellnessDialog.recommendedLoadLabel")}</Label>
                      <div className="flex gap-2">
                        {RECOMMENDED_LOAD_OPTIONS.map((option) => (
                          <Badge
                            key={option.value}
                            variant={recommendedLoad === option.value ? "default" : "outline"}
                            className={`cursor-pointer ${recommendedLoad === option.value ? option.color : ""}`}
                            onClick={() => setRecommendedLoad(option.value)}
                          >
                            {option.label}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>{t("health.addGatheringWellnessDialog.specificRecommendationsLabel")}</Label>
                      <Textarea
                        value={specificRecommendations}
                        onChange={(e) => setSpecificRecommendations(e.target.value)}
                        placeholder={t("health.addGatheringWellnessDialog.specificRecommendationsPlaceholder")}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </ScrollArea>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("health.addGatheringWellnessDialog.cancel")}
            </Button>
            <Button type="submit" disabled={!playerId || addAssessment.isPending}>
              {addAssessment.isPending ? t("health.addGatheringWellnessDialog.saving") : t("health.addGatheringWellnessDialog.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
