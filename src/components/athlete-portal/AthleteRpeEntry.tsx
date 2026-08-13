import { useState, useEffect } from "react";
import { computeSessionDurationMinutes } from "@/lib/utils/sessionDuration";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Activity, Calendar, Clock, CheckCircle2, Loader2, Target, Info } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { getTrainingTypeLabel } from "@/lib/constants/trainingTypes";
import { athletePortalHeaders, buildAthletePortalFunctionUrl } from "@/lib/athletePortalClient";
import { AthleteSpareExerciseForm } from "./AthleteSpareExerciseForm";
import { BowlingScoreSheet, BowlingStats } from "./BowlingScoreSheet";

import { AthletePortalWeightLog } from "./AthletePortalWeightLog";

interface AthleteRpeEntryProps {
  token?: string;
  playerId: string;
  categoryId: string;
  sportType?: string;
  onRefreshStats?: () => void;
}

interface Session {
  id: string;
  session_date: string;
  training_type: string;
  session_start_time: string | null;
  session_end_time: string | null;
  notes?: string | null;
  bowling_exercise_type?: string | null;
  blocks?: Array<{ training_type: string; bowling_exercise_type?: string | null }>;
}

interface TestRef {
  test_category: string;
  test_type: string;
  result_unit?: string;
}

interface ExistingTestResult {
  test_category: string;
  test_type: string;
  result_value: number;
  result_unit?: string | null;
  validation_status: "pending" | "validated" | "rejected";
}

const parseTestsFromNotes = (notes?: string | null): TestRef[] => {
  if (!notes) return [];
  const match = notes.match(/<!--TESTS:(.*?)-->/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const formatTestLabel = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

// Map block bowling_exercise_type values to SPARE_EXERCISE_TYPES values
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

const FEELINGS = [
  { value: 1, label: "Super forme", emoji: "💪" },
  { value: 2, label: "Bien", emoji: "🙂" },
  { value: 3, label: "Moyen", emoji: "😐" },
  { value: 4, label: "Fatigué", emoji: "😓" },
  { value: 5, label: "Épuisé", emoji: "🥵" },
];

export function AthleteRpeEntry({ token, playerId, categoryId, sportType, onRefreshStats }: AthleteRpeEntryProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [completedSessionIds, setCompletedSessionIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [rpe, setRpe] = useState<number>(5);
  const [feeling, setFeeling] = useState<number>(2);
  const [duration, setDuration] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingSpare, setIsSubmittingSpare] = useState(false);
  const [showScoreSheet, setShowScoreSheet] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [testEntries, setTestEntries] = useState<Record<string, string>>({});
  const [existingTestResults, setExistingTestResults] = useState<ExistingTestResult[]>([]);

  const isBowling = sportType?.toLowerCase().startsWith("bowling");

  useEffect(() => {
    fetchSessions();
  }, [token, refreshKey]);

  const fetchSessions = () => {
    setIsLoading(true);
    fetch(buildAthletePortalFunctionUrl("sessions", token), {
      headers: athletePortalHeaders(),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSessions(data.sessions || []);
          setCompletedSessionIds(new Set(data.completedSessionIds || []));
        }
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
        toast.error("Erreur lors du chargement des séances");
      });
  };

  const refresh = () => setRefreshKey(k => k + 1);

  const getSessionDuration = (session: Session) =>
    computeSessionDurationMinutes(session.session_start_time, session.session_end_time);

  const handleSelectSession = (sessionId: string) => {
    setSelectedSession(sessionId);
    setShowScoreSheet(false);
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setDuration(getSessionDuration(session).toString());
      setFeeling(2);
    }
  };

  const selectedSessionData = sessions.find(s => s.id === selectedSession);
  const selectedSessionTests = parseTestsFromNotes(selectedSessionData?.notes);
  const isPrecision = selectedSessionData?.training_type === "bowling_spare";
  const isSimulation = selectedSessionData?.training_type === "bowling_game" || selectedSessionData?.training_type === "bowling_practice";

  // Get the pre-filled exercise type from the block
  const prefilledExerciseType = selectedSessionData?.bowling_exercise_type
    ? BLOCK_TO_SPARE_MAP[selectedSessionData.bowling_exercise_type] || undefined
    : undefined;

  const prefilledExerciseLabel = selectedSessionData?.bowling_exercise_type
    ? BOWLING_EXERCISE_LABELS[selectedSessionData.bowling_exercise_type] || null
    : null;

  const handleSubmit = async () => {
    if (!selectedSession || !duration) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(buildAthletePortalFunctionUrl("submit-rpe", token), {
        method: "POST",
        headers: athletePortalHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          session_id: selectedSession,
          rpe,
          duration: parseInt(duration),
          post_session_feeling: feeling,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("RPE enregistré !");
        setCompletedSessionIds(prev => new Set([...prev, selectedSession]));
        setSelectedSession(null);
        setRpe(5);
        setFeeling(2);
        setDuration("");
        onRefreshStats?.();
      } else {
        toast.error(data.error || "Erreur");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!selectedSession || selectedSessionData?.training_type !== "test") {
      setExistingTestResults([]);
      setTestEntries({});
      return;
    }

    fetch(`${buildAthletePortalFunctionUrl("session-test-results", token)}&session_id=${encodeURIComponent(selectedSession)}`, {
      headers: athletePortalHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setExistingTestResults(data.existing || []);
        }
      })
      .catch(() => {
        setExistingTestResults([]);
      });
  }, [selectedSession, selectedSessionData?.training_type, token, refreshKey]);

  const handleSubmitTestResults = async () => {
    if (!selectedSession || selectedSessionData?.training_type !== "test") return;

    const results = selectedSessionTests
      .map((test) => {
        const key = `${test.test_category}::${test.test_type}`;
        const value = parseFloat(testEntries[key] || "");
        if (!Number.isFinite(value)) return null;
        return {
          test_category: test.test_category,
          test_type: test.test_type,
          result_value: value,
          result_unit: test.result_unit || null,
        };
      })
      .filter(Boolean);

    if (results.length === 0) {
      toast.error("Saisis au moins un résultat de test");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(buildAthletePortalFunctionUrl("submit-test-results", token), {
        method: "POST",
        headers: athletePortalHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ session_id: selectedSession, results }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Résultat(s) envoyé(s) au staff pour validation");
        setTestEntries({});
        setRefreshKey((k) => k + 1);
      } else {
        toast.error(data.error || "Erreur");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitSpare = async (exercises: Array<{ exercise_type: string; attempts: number; successes: number }>) => {
    if (!selectedSession) return;
    setIsSubmittingSpare(true);
    try {
      const res = await fetch(buildAthletePortalFunctionUrl("submit-spare-stats", token), {
        method: "POST",
        headers: athletePortalHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ session_id: selectedSession, exercises }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Stats de précision enregistrées !");
        onRefreshStats?.();
      } else {
        toast.error(data.error || "Erreur");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setIsSubmittingSpare(false);
    }
  };

  const handleSaveScoreSheet = async (stats: BowlingStats) => {
    if (!selectedSession) return;
    try {
      const res = await fetch(buildAthletePortalFunctionUrl("submit-training-scores", token), {
        method: "POST",
        headers: athletePortalHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          session_id: selectedSession,
          games: [{
            gameNumber: 1,
            score: stats.totalScore,
            strikes: stats.strikes,
            spares: stats.spares,
            splitCount: stats.splitCount,
            splitConverted: stats.splitConverted,
            splitOnLastThrow: stats.splitOnLastThrow,
            singlePinCount: stats.singlePinCount,
            singlePinConverted: stats.singlePinConverted,
            pocketCount: stats.pocketCount,
            strikePercentage: stats.strikePercentage,
            sparePercentage: stats.sparePercentage,
            splitPercentage: stats.splitPercentage,
            singlePinConversionRate: stats.singlePinConversionRate,
            pocketPercentage: stats.pocketPercentage,
            openFrames: stats.openFrames,
          }],
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Feuille de score enregistrée !");
        onRefreshStats?.();
      } else {
        toast.error(data.error || "Erreur");
      }
    } catch {
      toast.error("Erreur de connexion");
    }
  };

  const getRpeColor = (value: number) => {
    if (value <= 3) return "text-green-600";
    if (value <= 5) return "text-yellow-600";
    if (value <= 7) return "text-orange-600";
    return "text-red-600";
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Types informatifs : pas de RPE, juste affichage
  const NON_RPE_TYPES = new Set([
    "medical",
    "video",
    "video_analyse",
    "reunion",
    "surf_video",
  ]);
  const isNonRpe = (s: Session) => NON_RPE_TYPES.has(s.training_type);
  const pendingSessions = sessions.filter(s => !completedSessionIds.has(s.id) && !isNonRpe(s));
  const infoSessions = sessions.filter(s => isNonRpe(s));
  const completedSessions = sessions.filter(s => completedSessionIds.has(s.id) && !isNonRpe(s));

  return (
    <div className="space-y-6">
      {/* Informational sessions (no RPE) */}
      {infoSessions.length > 0 && (
        <Card className="border-sky-200 dark:border-sky-900/40 bg-sky-50/50 dark:bg-sky-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-sky-800 dark:text-sky-300">
              <Info className="h-4 w-4" />
              À ton agenda (informatif)
            </CardTitle>
            <CardDescription>
              Ces évènements n'ont pas de RPE à saisir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {infoSessions.map((s) => (
                <div
                  key={s.id}
                  className="p-3 rounded-lg bg-background/60 border flex items-center justify-between flex-wrap gap-2"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">
                        {format(parseISO(s.session_date), "EEEE d MMMM", { locale: fr })}
                      </p>
                      {s.session_start_time && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {s.session_start_time}{s.session_end_time ? ` - ${s.session_end_time}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline">{getTrainingTypeLabel(s.training_type)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Séances à compléter
          </CardTitle>
          <CardDescription>
            Sélectionnez une séance pour saisir votre ressenti (RPE)
            {isBowling && " et vos statistiques bowling"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingSessions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Aucune séance en attente de RPE
            </p>
          ) : (
            <div className="space-y-3">
              {pendingSessions.map((session) => {
                const exerciseLabel = session.bowling_exercise_type
                  ? BOWLING_EXERCISE_LABELS[session.bowling_exercise_type]
                  : null;

                return (
                  <div
                    key={session.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedSession === session.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => handleSelectSession(session.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {format(parseISO(session.session_date), "EEEE d MMMM", { locale: fr })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline">
                          {getTrainingTypeLabel(session.training_type)}
                        </Badge>
                        {exerciseLabel && (
                          <Badge variant="secondary" className="gap-1">
                            <Target className="h-3 w-3" />
                            {exerciseLabel}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {session.session_start_time && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {session.session_start_time} - {session.session_end_time}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* RPE Entry Form */}
      {selectedSession && (
        <>
          <Card className="border-primary">
            <CardHeader>
              <CardTitle>Saisir votre RPE</CardTitle>
              <CardDescription>
                RPE = Rate of Perceived Exertion (effort ressenti de 1 à 10)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Effort ressenti (RPE)</Label>
                  <span className={`text-2xl font-bold ${getRpeColor(rpe)}`}>
                    {rpe}
                  </span>
                </div>
                <Slider
                  value={[rpe]}
                  onValueChange={([v]) => setRpe(v)}
                  min={1}
                  max={10}
                  step={1}
                  className="py-4"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 - Très facile</span>
                  <span>5 - Modéré</span>
                  <span>10 - Maximum</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Durée (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="60"
                />
              </div>

              <div className="space-y-2">
                <Label>Ressenti global</Label>
                <div className="grid grid-cols-5 gap-2">
                  {FEELINGS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setFeeling(f.value)}
                      className={`rounded-lg border p-2 text-center text-xs transition-colors ${
                        feeling === f.value
                          ? "border-primary bg-primary/10 ring-2 ring-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="text-lg leading-none">{f.emoji}</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">{f.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Charge d'entraînement :</strong>{" "}
                  {rpe * (parseInt(duration) || 0)} UA
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedSession(null)}
                >
                  Annuler
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !duration}
                >
                  {isSubmitting ? "Enregistrement..." : "Enregistrer RPE"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Actual lifted weights — sent for staff validation */}
          <AthletePortalWeightLog token={token} sessionId={selectedSession} onSubmitted={onRefreshStats} />

          {selectedSessionData?.training_type === "test" && selectedSessionTests.length > 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Mes résultats de tests</CardTitle>
                <CardDescription>Envoie tes résultats au staff pour validation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedSessionTests.map((test) => {
                  const key = `${test.test_category}::${test.test_type}`;
                  const existing = existingTestResults.find(
                    (row) => row.test_category === test.test_category && row.test_type === test.test_type,
                  );

                  return (
                    <div key={key} className="rounded-md border bg-background p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-medium">{formatTestLabel(test.test_type)}</span>
                        {existing && (
                          <Badge variant={existing.validation_status === "rejected" ? "destructive" : existing.validation_status === "validated" ? "secondary" : "outline"}>
                            {existing.result_value} {existing.result_unit || test.result_unit || ""} · {existing.validation_status === "pending" ? "En attente" : existing.validation_status === "validated" ? "Validé" : "Rejeté"}
                          </Badge>
                        )}
                      </div>

                      {!existing && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Résultat"
                            value={testEntries[key] || ""}
                            onChange={(e) => setTestEntries((prev) => ({ ...prev, [key]: e.target.value }))}
                          />
                          <span className="text-xs text-muted-foreground min-w-8">{test.result_unit || ""}</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {existingTestResults.length < selectedSessionTests.length && (
                  <Button className="w-full" onClick={handleSubmitTestResults}>
                    {isSubmitting ? "Envoi..." : "Envoyer les résultats"}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Bowling Precision Stats */}
          {isBowling && isPrecision && (
            <AthleteSpareExerciseForm
              onSubmit={handleSubmitSpare}
              isSubmitting={isSubmittingSpare}
              prefilledExerciseType={prefilledExerciseType}
              exerciseLabel={prefilledExerciseLabel}
            />
          )}

          {/* Bowling Score Sheet */}
          {isBowling && isSimulation && (
            <Card className="border-blue-300 dark:border-blue-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Feuille de score</CardTitle>
                <CardDescription>Remplissez votre feuille de score bowling</CardDescription>
              </CardHeader>
              <CardContent>
                {!showScoreSheet ? (
                  <Button variant="outline" className="w-full" onClick={() => setShowScoreSheet(true)}>
                    Ajouter une feuille de score
                  </Button>
                ) : (
                  <BowlingScoreSheet
                    onSave={(stats) => handleSaveScoreSheet(stats)}
                    onCancel={() => setShowScoreSheet(false)}
                    playerId={playerId}
                    categoryId={categoryId}
                  />
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Completed Sessions */}
      {completedSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              Séances complétées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {completedSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>
                      {format(parseISO(session.session_date), "d MMMM", { locale: fr })}
                    </span>
                  </div>
                  <Badge variant="secondary">
                    {getTrainingTypeLabel(session.training_type)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
