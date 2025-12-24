import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, ArrowUp, ArrowDown, Minus, Building2, User, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface GatheringWellnessComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preAssessment: any;
  dayOfAssessment: any;
}

const SCORE_LABELS: Record<string, Record<number, string>> = {
  sleep_quality: { 1: "Très mauvais", 2: "Mauvais", 3: "Moyen", 4: "Bon", 5: "Excellent" },
  fatigue_level: { 1: "Épuisé", 2: "Fatigué", 3: "Normal", 4: "Énergique", 5: "Très frais" },
  stress_level: { 1: "Très stressé", 2: "Stressé", 3: "Normal", 4: "Détendu", 5: "Très serein" },
  muscle_soreness: { 1: "Très douloureux", 2: "Courbatures", 3: "Légères", 4: "Minimes", 5: "Aucune" },
  motivation_level: { 1: "Démotivé", 2: "Peu motivé", 3: "Normal", 4: "Motivé", 5: "Très motivé" },
  mood_level: { 1: "Très bas", 2: "Bas", 3: "Normal", 4: "Bon", 5: "Excellent" },
};

const LOAD_LABELS: Record<string, string> = {
  full: "Charge complète",
  adapted: "Charge adaptée",
  light: "Charge légère",
  rest: "Repos",
};

export function GatheringWellnessComparisonDialog({
  open,
  onOpenChange,
  preAssessment,
  dayOfAssessment,
}: GatheringWellnessComparisonDialogProps) {
  const getChangeIcon = (pre: number | null, dayOf: number | null) => {
    if (!pre || !dayOf) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (dayOf > pre) return <ArrowUp className="h-4 w-4 text-green-500" />;
    if (dayOf < pre) return <ArrowDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getChangeClass = (pre: number | null, dayOf: number | null) => {
    if (!pre || !dayOf) return "";
    if (dayOf > pre) return "text-green-600";
    if (dayOf < pre) return "text-red-600";
    return "";
  };

  const ComparisonRow = ({
    label,
    field,
    inverse = false,
  }: {
    label: string;
    field: string;
    inverse?: boolean;
  }) => {
    const preValue = preAssessment?.[field];
    const dayOfValue = dayOfAssessment?.[field];
    const labels = SCORE_LABELS[field];

    // For inverse metrics (like pain), lower is better
    const getIcon = () => {
      if (!preValue || !dayOfValue) return <Minus className="h-4 w-4 text-muted-foreground" />;
      if (inverse) {
        if (dayOfValue < preValue) return <ArrowDown className="h-4 w-4 text-green-500" />;
        if (dayOfValue > preValue) return <ArrowUp className="h-4 w-4 text-red-500" />;
      } else {
        if (dayOfValue > preValue) return <ArrowUp className="h-4 w-4 text-green-500" />;
        if (dayOfValue < preValue) return <ArrowDown className="h-4 w-4 text-red-500" />;
      }
      return <Minus className="h-4 w-4 text-muted-foreground" />;
    };

    return (
      <div className="grid grid-cols-4 gap-4 py-3 border-b last:border-b-0 items-center">
        <div className="font-medium">{label}</div>
        <div className="text-center">
          <span className="font-semibold">{preValue || "-"}/5</span>
          {labels && preValue && (
            <p className="text-xs text-muted-foreground">{labels[preValue]}</p>
          )}
        </div>
        <div className="flex justify-center">{getIcon()}</div>
        <div className="text-center">
          <span className={`font-semibold ${inverse 
            ? (dayOfValue && preValue && dayOfValue < preValue ? "text-green-600" : dayOfValue > preValue ? "text-red-600" : "")
            : getChangeClass(preValue, dayOfValue)
          }`}>
            {dayOfValue || "-"}/5
          </span>
          {labels && dayOfValue && (
            <p className="text-xs text-muted-foreground">{labels[dayOfValue]}</p>
          )}
        </div>
      </div>
    );
  };

  const calculateWellnessScore = (assessment: any) => {
    if (!assessment) return 0;
    const scores = [
      assessment.sleep_quality,
      assessment.fatigue_level,
      assessment.stress_level,
      assessment.muscle_soreness,
      assessment.motivation_level,
      assessment.mood_level,
    ].filter(Boolean);
    if (scores.length === 0) return 0;
    return (scores.reduce((a, b) => a + b, 0) / scores.length / 5) * 100;
  };

  const preScore = calculateWellnessScore(preAssessment);
  const dayOfScore = calculateWellnessScore(dayOfAssessment);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Comparaison des Bilans - {preAssessment?.players?.name || dayOfAssessment?.players?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header with dates */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-blue-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Bilan Pré-Rassemblement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">
                  {preAssessment?.assessment_date
                    ? format(new Date(preAssessment.assessment_date), "dd MMMM yyyy", { locale: fr })
                    : "Non rempli"}
                </p>
                {preAssessment?.filled_by && (
                  <p className="text-sm text-muted-foreground">Par: {preAssessment.filled_by}</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-green-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Bilan Jour J
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">
                  {dayOfAssessment?.assessment_date
                    ? format(new Date(dayOfAssessment.assessment_date), "dd MMMM yyyy", { locale: fr })
                    : "Non rempli"}
                </p>
                {dayOfAssessment?.filled_by && (
                  <p className="text-sm text-muted-foreground">Par: {dayOfAssessment.filled_by}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Global score comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Score Wellness Global</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 items-center">
                <div className="text-center">
                  <div className="text-3xl font-bold">{preScore.toFixed(0)}%</div>
                  <Progress value={preScore} className="mt-2" />
                </div>
                <div className="flex justify-center">
                  {getChangeIcon(preScore, dayOfScore)}
                  <span className={`ml-2 font-semibold ${getChangeClass(preScore, dayOfScore)}`}>
                    {dayOfScore - preScore > 0 ? "+" : ""}{(dayOfScore - preScore).toFixed(0)}%
                  </span>
                </div>
                <div className="text-center">
                  <div className={`text-3xl font-bold ${getChangeClass(preScore, dayOfScore)}`}>
                    {dayOfScore.toFixed(0)}%
                  </div>
                  <Progress value={dayOfScore} className="mt-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Détail des scores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 py-2 border-b font-semibold text-sm text-muted-foreground">
                <div>Métrique</div>
                <div className="text-center">Pré-Rassemblement</div>
                <div className="text-center">Évolution</div>
                <div className="text-center">Jour J</div>
              </div>
              <ComparisonRow label="Qualité sommeil" field="sleep_quality" />
              <ComparisonRow label="Fatigue" field="fatigue_level" />
              <ComparisonRow label="Stress" field="stress_level" />
              <ComparisonRow label="Courbatures" field="muscle_soreness" />
              <ComparisonRow label="Motivation" field="motivation_level" />
              <ComparisonRow label="Humeur" field="mood_level" />
            </CardContent>
          </Card>

          {/* Load comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Charge d'entraînement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Charge 7 jours</p>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold">{preAssessment?.training_load_last_7_days || "-"} UA</span>
                    <ArrowRight className="h-4 w-4" />
                    <span className="font-semibold">{dayOfAssessment?.training_load_last_7_days || "-"} UA</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Matchs (14 jours)</p>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold">{preAssessment?.matches_played_last_14_days || "-"}</span>
                    <ArrowRight className="h-4 w-4" />
                    <span className="font-semibold">{dayOfAssessment?.matches_played_last_14_days || "-"}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pain comparison */}
          {(preAssessment?.has_pain || dayOfAssessment?.has_pain) && (
            <Card className="border-orange-500/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Douleurs signalées
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-medium mb-2">Pré-Rassemblement</p>
                    {preAssessment?.has_pain ? (
                      <>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {preAssessment.pain_locations?.map((loc: string) => (
                            <Badge key={loc} variant="destructive" className="text-xs">
                              {loc}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Intensité: {preAssessment.pain_intensity}/10
                        </p>
                      </>
                    ) : (
                      <Badge variant="outline">Aucune douleur</Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Jour J</p>
                    {dayOfAssessment?.has_pain ? (
                      <>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {dayOfAssessment.pain_locations?.map((loc: string) => (
                            <Badge key={loc} variant="destructive" className="text-xs">
                              {loc}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Intensité: {dayOfAssessment.pain_intensity}/10
                        </p>
                      </>
                    ) : (
                      <Badge variant="outline">Aucune douleur</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recommandations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Pré-Rassemblement</p>
                  {preAssessment?.recommended_load && (
                    <Badge variant="outline" className="mb-2">
                      {LOAD_LABELS[preAssessment.recommended_load]}
                    </Badge>
                  )}
                  {preAssessment?.specific_recommendations && (
                    <p className="text-sm mt-2">{preAssessment.specific_recommendations}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Jour J</p>
                  {dayOfAssessment?.recommended_load && (
                    <Badge variant="outline" className="mb-2">
                      {LOAD_LABELS[dayOfAssessment.recommended_load]}
                    </Badge>
                  )}
                  {dayOfAssessment?.specific_recommendations && (
                    <p className="text-sm mt-2">{dayOfAssessment.specific_recommendations}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
