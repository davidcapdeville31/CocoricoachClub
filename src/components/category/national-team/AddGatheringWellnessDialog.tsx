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

const SCORE_LABELS: Record<string, Record<number, string>> = {
  sleep_quality: { 1: "Très mauvais", 2: "Mauvais", 3: "Moyen", 4: "Bon", 5: "Excellent" },
  fatigue: { 1: "Épuisé", 2: "Fatigué", 3: "Normal", 4: "Énergique", 5: "Très frais" },
  stress: { 1: "Très stressé", 2: "Stressé", 3: "Normal", 4: "Détendu", 5: "Très serein" },
  soreness: { 1: "Très douloureux", 2: "Courbatures", 3: "Légères", 4: "Minimes", 5: "Aucune" },
  motivation: { 1: "Démotivé", 2: "Peu motivé", 3: "Normal", 4: "Motivé", 5: "Très motivé" },
  mood: { 1: "Très bas", 2: "Bas", 3: "Normal", 4: "Bon", 5: "Excellent" },
  appetite: { 1: "Pas d'appétit", 2: "Faible", 3: "Normal", 4: "Bon", 5: "Très bon" },
  hydration: { 1: "Déshydraté", 2: "Insuffisant", 3: "Normal", 4: "Bon", 5: "Optimal" },
};

const PAIN_LOCATIONS = [
  "Épaule gauche", "Épaule droite",
  "Coude gauche", "Coude droit",
  "Poignet gauche", "Poignet droit",
  "Dos haut", "Dos bas (lombaires)",
  "Hanche gauche", "Hanche droite",
  "Genou gauche", "Genou droit",
  "Cheville gauche", "Cheville droite",
  "Ischio-jambiers gauche", "Ischio-jambiers droit",
  "Quadriceps gauche", "Quadriceps droit",
  "Mollet gauche", "Mollet droit",
  "Adducteurs", "Abdominaux",
  "Cou/Nuque", "Autre"
];

const RECOMMENDED_LOAD_OPTIONS = [
  { value: "full", label: "Charge complète", color: "bg-green-500" },
  { value: "adapted", label: "Charge adaptée", color: "bg-yellow-500" },
  { value: "light", label: "Charge légère", color: "bg-orange-500" },
  { value: "rest", label: "Repos recommandé", color: "bg-red-500" },
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
  const queryClient = useQueryClient();
  
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
      toast.success("Bilan enregistré avec succès");
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Erreur lors de l'enregistrement");
      console.error(error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerId) {
      toast.error("Veuillez sélectionner un joueur");
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
                Bilan Pré-Rassemblement (Club)
              </>
            ) : (
              <>
                <User className="h-5 w-5" />
                Bilan Jour J (Joueur)
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <ScrollArea className="h-[calc(90vh-180px)] pr-4">
            <Tabs defaultValue="general" className="space-y-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="general">Général</TabsTrigger>
                <TabsTrigger value="load">Charge</TabsTrigger>
                <TabsTrigger value="wellness">Wellness</TabsTrigger>
                <TabsTrigger value="pain">Douleurs</TabsTrigger>
                <TabsTrigger value="comments">Commentaires</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Joueur *</Label>
                    <Select value={playerId} onValueChange={setPlayerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un joueur" />
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
                    <Label>Événement lié</Label>
                    <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un événement" />
                      </SelectTrigger>
                      <SelectContent>
                        {events?.map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            {event.name} - {new Date(event.start_date).toLocaleDateString("fr-FR")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Date du bilan</Label>
                    <Input
                      type="date"
                      value={assessmentDate}
                      onChange={(e) => setAssessmentDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Rempli par</Label>
                    <Input
                      value={filledBy}
                      onChange={(e) => setFilledBy(e.target.value)}
                      placeholder={assessmentType === "pre_gathering" ? "Nom du préparateur physique" : "Nom du joueur"}
                    />
                  </div>
                </div>

                {linkedAssessment && (
                  <Card className="border-primary/50 bg-primary/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" />
                        Bilan pré-rassemblement lié
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <span className="text-muted-foreground">Fatigue:</span>{" "}
                          <Badge variant="outline">{linkedAssessment.fatigue_level}/5</Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Sommeil:</span>{" "}
                          <Badge variant="outline">{linkedAssessment.sleep_quality}/5</Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Charge 7j:</span>{" "}
                          <Badge variant="outline">{linkedAssessment.training_load_last_7_days || "N/A"}</Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Recommandation:</span>{" "}
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
                    <CardTitle className="text-base">Charge d'entraînement récente</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Charge 7 derniers jours (UA)</Label>
                        <Input
                          type="number"
                          value={trainingLoad7Days || ""}
                          onChange={(e) => setTrainingLoad7Days(e.target.value ? Number(e.target.value) : undefined)}
                          placeholder="Ex: 2500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Charge 14 derniers jours (UA)</Label>
                        <Input
                          type="number"
                          value={trainingLoad14Days || ""}
                          onChange={(e) => setTrainingLoad14Days(e.target.value ? Number(e.target.value) : undefined)}
                          placeholder="Ex: 5000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Matchs joués (14 derniers jours)</Label>
                        <Input
                          type="number"
                          value={matchesPlayed14Days || ""}
                          onChange={(e) => setMatchesPlayed14Days(e.target.value ? Number(e.target.value) : undefined)}
                          placeholder="Ex: 2"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Minutes jouées (14 derniers jours)</Label>
                        <Input
                          type="number"
                          value={totalMinutes14Days || ""}
                          onChange={(e) => setTotalMinutes14Days(e.target.value ? Number(e.target.value) : undefined)}
                          placeholder="Ex: 160"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>AWCR actuel</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={currentAwcr || ""}
                        onChange={(e) => setCurrentAwcr(e.target.value ? Number(e.target.value) : undefined)}
                        placeholder="Ex: 1.05"
                      />
                      {latestAwcr?.awcr && (
                        <p className="text-xs text-muted-foreground">
                          Dernière valeur enregistrée: {latestAwcr.awcr.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="wellness" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">État général</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <ScoreSlider
                        label="Qualité du sommeil"
                        value={sleepQuality}
                        onChange={setSleepQuality}
                        type="sleep_quality"
                      />
                      <div className="space-y-2">
                        <Label>Durée du sommeil (heures)</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={sleepDuration || ""}
                          onChange={(e) => setSleepDuration(e.target.value ? Number(e.target.value) : undefined)}
                          placeholder="Ex: 7.5"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <ScoreSlider
                        label="Niveau de fatigue"
                        value={fatigueLevel}
                        onChange={setFatigueLevel}
                        type="fatigue"
                      />
                      <ScoreSlider
                        label="Niveau de stress"
                        value={stressLevel}
                        onChange={setStressLevel}
                        type="stress"
                      />
                    </div>

                    <ScoreSlider
                      label="Courbatures musculaires"
                      value={muscleSoreness}
                      onChange={setMuscleSoreness}
                      type="soreness"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">État mental et général</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <ScoreSlider
                        label="Motivation"
                        value={motivationLevel}
                        onChange={setMotivationLevel}
                        type="motivation"
                      />
                      <ScoreSlider
                        label="Humeur"
                        value={moodLevel}
                        onChange={setMoodLevel}
                        type="mood"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <ScoreSlider
                        label="Appétit"
                        value={appetiteLevel}
                        onChange={setAppetiteLevel}
                        type="appetite"
                      />
                      <ScoreSlider
                        label="Hydratation"
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
                      Douleurs et gênes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={hasPain} onCheckedChange={setHasPain} />
                      <Label>Le joueur présente des douleurs/gênes</Label>
                    </div>

                    {hasPain && (
                      <>
                        <div className="space-y-2">
                          <Label>Zones de douleur (cliquez pour sélectionner)</Label>
                          <div className="flex flex-wrap gap-2">
                            {PAIN_LOCATIONS.map((location) => (
                              <Badge
                                key={location}
                                variant={painLocations.includes(location) ? "default" : "outline"}
                                className="cursor-pointer"
                                onClick={() => togglePainLocation(location)}
                              >
                                {location}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <Label>Intensité de la douleur</Label>
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
                          <Label>Description de la douleur</Label>
                          <Textarea
                            value={painDescription}
                            onChange={(e) => setPainDescription(e.target.value)}
                            placeholder="Décrivez la nature de la douleur, les circonstances d'apparition..."
                          />
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Blessures et limitations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Blessures récentes</Label>
                      <Textarea
                        value={recentInjuries}
                        onChange={(e) => setRecentInjuries(e.target.value)}
                        placeholder="Blessures des dernières semaines, même si guéries..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Limitations actuelles</Label>
                      <Textarea
                        value={currentLimitations}
                        onChange={(e) => setCurrentLimitations(e.target.value)}
                        placeholder="Mouvements à éviter, exercices contre-indiqués..."
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="comments" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Commentaires</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {assessmentType === "pre_gathering" && (
                      <div className="space-y-2">
                        <Label>Commentaires du staff club</Label>
                        <Textarea
                          value={clubStaffComments}
                          onChange={(e) => setClubStaffComments(e.target.value)}
                          placeholder="Observations du préparateur physique du club..."
                        />
                      </div>
                    )}

                    {assessmentType === "day_of" && (
                      <div className="space-y-2">
                        <Label>Commentaires du joueur</Label>
                        <Textarea
                          value={playerComments}
                          onChange={(e) => setPlayerComments(e.target.value)}
                          placeholder="Ressenti du joueur, informations complémentaires..."
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Notes staff sélection</Label>
                      <Textarea
                        value={nationalStaffComments}
                        onChange={(e) => setNationalStaffComments(e.target.value)}
                        placeholder="Notes pour le staff de l'équipe nationale..."
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Recommandations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Charge recommandée</Label>
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
                      <Label>Recommandations spécifiques</Label>
                      <Textarea
                        value={specificRecommendations}
                        onChange={(e) => setSpecificRecommendations(e.target.value)}
                        placeholder="Recommandations particulières pour le rassemblement..."
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </ScrollArea>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={!playerId || addAssessment.isPending}>
              {addAssessment.isPending ? "Enregistrement..." : "Enregistrer le bilan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
