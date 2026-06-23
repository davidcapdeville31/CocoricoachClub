import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Activity, AlertTriangle, Target, Zap } from "lucide-react";
import { LoadSummary, getRiskColor } from "@/lib/trainingLoadCalculations";
import { InfoHint } from "./InfoHint";

interface TrainingLoadKPIsProps {
  summary: LoadSummary | null;
  isLoading?: boolean;
  loadModel?: "ewma" | "awcr";
}

export function TrainingLoadKPIs({ summary, isLoading, loadModel = "ewma" }: TrainingLoadKPIsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-gradient-card">
            <CardContent className="p-6">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-8 bg-muted rounded w-3/4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-card col-span-full">
          <CardContent className="p-6 text-center text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Aucune donnée de charge disponible</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const riskColor = getRiskColor(summary.riskLevel);
  const TrendIcon = summary.trend === "increasing" ? TrendingUp : 
                   summary.trend === "decreasing" ? TrendingDown : Minus;
  const trendColor = summary.trend === "increasing" ? "text-orange-500" :
                    summary.trend === "decreasing" ? "text-blue-500" : "text-muted-foreground";

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Current Load */}
      <Card className="bg-gradient-card shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <span>Charge du jour</span>
            <InfoHint
              title="Charge du jour"
              what="La quantité d'effort de la dernière séance enregistrée."
              how="Durée de la séance (en min) × RPE ressenti (1 à 10)."
              why="Pour voir si la séance a été légère, normale ou très lourde par rapport à l'habitude de l'athlète."
            />
          </CardTitle>
          <Zap className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{Math.round(summary.currentLoad)}</div>
          <p className="text-xs text-muted-foreground">UA (unités arbitraires)</p>
        </CardContent>
      </Card>

      {/* Acute */}
      <Card className="bg-gradient-card shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <span>{loadModel === "ewma" ? "Charge récente" : "Charge récente (7j)"}</span>
            <InfoHint
              title="Charge récente (7 derniers jours)"
              what="Ce que l'athlète a encaissé cette semaine."
              how={loadModel === "ewma"
                ? "Moyenne des 7 derniers jours, avec plus de poids sur les séances les plus récentes (EWMA)."
                : "Moyenne simple de la charge des 7 derniers jours (méthode Gabbett)."}
              why="Si elle monte brutalement, l'athlète est en surcharge potentielle. Si elle chute, il se désentraîne."
            />
          </CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.ewmaAcute.toFixed(1)}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendIcon className={`h-3 w-3 ${trendColor}`} />
            <span className={trendColor}>
              {summary.weeklyChange >= 0 ? "+" : ""}{summary.weeklyChange}% vs sem. préc.
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/70 mt-2 leading-relaxed border-t border-border/30 pt-1.5">
            Alimentée par le RPE et la durée des séances saisis dans <span className="font-semibold">Programmation</span>.
          </p>
        </CardContent>
      </Card>

      {/* Chronic */}
      <Card className="bg-gradient-card shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <span>{loadModel === "ewma" ? "Charge habituelle" : "Charge habituelle (28j)"}</span>
            <InfoHint
              title="Charge habituelle (28 derniers jours)"
              what="La capacité de travail de base de l'athlète — son niveau de référence."
              how={loadModel === "ewma"
                ? "Moyenne pondérée des 28 derniers jours (EWMA)."
                : "Moyenne simple des charges sur 28 jours."}
              why="C'est le 'point d'équilibre' contre lequel on compare la semaine en cours. Elle évolue lentement."
            />
          </CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.ewmaChronic.toFixed(1)}</div>
          <p className="text-xs text-muted-foreground">Capacité de base (28j)</p>
          <p className="text-[10px] text-muted-foreground/70 mt-2 leading-relaxed border-t border-border/30 pt-1.5">
            Se met à jour automatiquement à chaque séance enregistrée.
          </p>
        </CardContent>
      </Card>

      {/* Ratio */}
      <Card className="bg-gradient-card shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <span>Ratio charge récente / habituelle</span>
            <InfoHint
              title={loadModel === "ewma" ? "Ratio EWMA (aiguë / chronique)" : "Ratio AWCR (aiguë / chronique)"}
              what="Compare ce que l'athlète fait cette semaine à ce qu'il fait d'habitude."
              how="Charge récente (7j) ÷ Charge habituelle (28j)."
              why="🟢 0,85–1,30 = zone optimale. 🟡 0,8–0,85 ou 1,30–1,50 = à surveiller. 🔴 <0,8 = désentraînement, >1,5 = risque de blessure élevé."
            />
          </CardTitle>
          {summary.riskLevel !== "optimal" ? (
            <AlertTriangle className={`h-4 w-4 ${riskColor}`} />
          ) : (
            <Activity className={`h-4 w-4 ${riskColor}`} />
          )}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${riskColor}`}>
            {summary.ewmaRatio.toFixed(2)}
          </div>
          <Badge 
            variant="secondary"
            className={`text-xs mt-1 ${
              summary.riskLevel === "optimal" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
              summary.riskLevel === "warning" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" :
              "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            {summary.riskLevel === "optimal" ? "Zone optimale" : 
             summary.riskLevel === "warning" ? "Vigilance" : "Zone danger"}
          </Badge>
          <p className="text-[10px] text-muted-foreground/70 mt-2 leading-relaxed border-t border-border/30 pt-1.5">
            En zone danger : alléger la prochaine séance. En sous-charge : réintroduire progressivement de l'intensité.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
