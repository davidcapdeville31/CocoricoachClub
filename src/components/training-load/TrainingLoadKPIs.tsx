import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Activity, AlertTriangle, Target, Zap } from "lucide-react";
import { LoadSummary, getRiskColor, getRiskLabelKey } from "@/lib/trainingLoadCalculations";
import { InfoHint } from "./InfoHint";
import { Trans, useTranslation } from "react-i18next";

interface TrainingLoadKPIsProps {
  summary: LoadSummary | null;
  isLoading?: boolean;
  loadModel?: "ewma" | "awcr";
}

export function TrainingLoadKPIs({ summary, isLoading, loadModel = "ewma" }: TrainingLoadKPIsProps) {
  const { t } = useTranslation();
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
            <p>{t("workload.kpis.noData")}</p>
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
            <span>{t("workload.kpis.currentLoad.label")}</span>
            <InfoHint
              title={t("workload.kpis.currentLoad.hint.title")}
              what={t("workload.kpis.currentLoad.hint.what")}
              how={t("workload.kpis.currentLoad.hint.how")}
              why={t("workload.kpis.currentLoad.hint.why")}
            />
          </CardTitle>
          <Zap className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{Math.round(summary.currentLoad)}</div>
          <p className="text-xs text-muted-foreground">{t("workload.kpis.currentLoad.unit")}</p>
        </CardContent>
      </Card>

      {/* Acute */}
      <Card className="bg-gradient-card shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <span>{loadModel === "ewma" ? t("workload.kpis.acute.labelEwma") : t("workload.kpis.acute.labelAwcr")}</span>
            <InfoHint
              title={t("workload.kpis.acute.hint.title")}
              what={t("workload.kpis.acute.hint.what")}
              how={loadModel === "ewma"
                ? t("workload.kpis.acute.hint.howEwma")
                : t("workload.kpis.acute.hint.howAwcr")}
              why={t("workload.kpis.acute.hint.why")}
            />
          </CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.ewmaAcute.toFixed(1)}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendIcon className={`h-3 w-3 ${trendColor}`} />
            <span className={trendColor}>
              {t("workload.kpis.acute.weeklyChange", { value: `${summary.weeklyChange >= 0 ? "+" : ""}${summary.weeklyChange}` })}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/70 mt-2 leading-relaxed border-t border-border/30 pt-1.5">
            <Trans i18nKey="workload.kpis.acute.footer" t={t} components={[<span className="font-semibold" key="0" />]} />
          </p>
        </CardContent>
      </Card>

      {/* Chronic */}
      <Card className="bg-gradient-card shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <span>{loadModel === "ewma" ? t("workload.kpis.chronic.labelEwma") : t("workload.kpis.chronic.labelAwcr")}</span>
            <InfoHint
              title={t("workload.kpis.chronic.hint.title")}
              what={t("workload.kpis.chronic.hint.what")}
              how={loadModel === "ewma"
                ? t("workload.kpis.chronic.hint.howEwma")
                : t("workload.kpis.chronic.hint.howAwcr")}
              why={t("workload.kpis.chronic.hint.why")}
            />
          </CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.ewmaChronic.toFixed(1)}</div>
          <p className="text-xs text-muted-foreground">{t("workload.kpis.chronic.unit")}</p>
          <p className="text-[10px] text-muted-foreground/70 mt-2 leading-relaxed border-t border-border/30 pt-1.5">
            {t("workload.kpis.chronic.footer")}
          </p>
        </CardContent>
      </Card>

      {/* Ratio */}
      <Card className="bg-gradient-card shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <span>{t("workload.kpis.ratio.label")}</span>
            <InfoHint
              title={loadModel === "ewma" ? t("workload.kpis.ratio.hint.titleEwma") : t("workload.kpis.ratio.hint.titleAwcr")}
              what={t("workload.kpis.ratio.hint.what")}
              how={t("workload.kpis.ratio.hint.how")}
              why={t("workload.kpis.ratio.hint.why")}
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
              summary.ratioReliable === false ? "bg-muted text-muted-foreground" :
              summary.riskLevel === "optimal" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
              summary.riskLevel === "warning" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" :
              "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            {t(`workload.kpis.ratio.${getRiskLabelKey(summary.riskLevel, summary.ewmaRatio, summary.ratioReliable !== false)}`)}
          </Badge>
          {summary.ratioReliable === false && (
            <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
              {summary.limitedReason === "gap"
                ? `Coupure de ${summary.gapDays} j dans la fenêtre 28 j · reprise il y a ${summary.daysSinceResumption ?? 0} j. Le ratio redevient lisible après 21 j de charge continue — se fier à la variation hebdomadaire.`
                : "Moins de 21 jours d'historique : le ratio n'est pas encore interprétable — se fier à la variation hebdomadaire."}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground/70 mt-2 leading-relaxed border-t border-border/30 pt-1.5">
            {t("workload.kpis.ratio.footer")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
