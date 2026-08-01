import { computeRecoveryScore } from "@/lib/wellness/aggregatePeriod";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { TrendingUp, Info } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { NAV_COLORS } from "@/components/ui/colored-nav-tabs";
import { sleepScoreToHours } from "@/lib/sleepConversion";
import { aggregateWellnessByPeriod, type WellnessPeriod } from "@/lib/wellness/aggregatePeriod";

interface Props {
  playerId: string;
  categoryId: string;
}

const METRIC_COLORS: Record<string, string> = {
  sleep_quality: "#1e3a8a",       // bleu marine
  general_fatigue: "#dc2626",     // rouge vif
  soreness_upper_body: "#f59e0b", // orange
  soreness_lower_body: "#7c3aed", // violet
  stress_level: "#0891b2",        // cyan profond
};

const METRIC_DASH: Record<string, string | undefined> = {
  sleep_quality: undefined,
  general_fatigue: undefined,
  soreness_upper_body: "6 3",
  soreness_lower_body: "2 3",
  stress_level: "8 4",
};

const METRIC_LABELS: Record<string, string> = {
  sleep_quality: "Sommeil",
  general_fatigue: "Fatigue",
  soreness_upper_body: "Douleurs haut",
  soreness_lower_body: "Douleurs bas",
  stress_level: "Stress",
  recovery_score: "Récupération",
};

export function AthleteSpaceWellnessHistory({ playerId, categoryId }: Props) {
  const [period, setPeriod] = useState<WellnessPeriod>("day");
  const [recoveryPeriod, setRecoveryPeriod] = useState<WellnessPeriod>("day");
  const [visibleMetrics, setVisibleMetrics] = useState<Record<string, boolean>>({
    sleep_quality: true,
    general_fatigue: true,
    soreness_upper_body: true,
    soreness_lower_body: true,
    stress_level: true,
  });
  const toggleMetric = (key: string) =>
    setVisibleMetrics((p) => ({ ...p, [key]: !p[key] }));

  const { data: wellnessHistory = [], isLoading } = useQuery({
    queryKey: ["athlete-space-wellness-history", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_tracking")
        .select("tracking_date, sleep_quality, sleep_duration, general_fatigue, soreness_upper_body, soreness_lower_body, stress_level")
        .eq("player_id", playerId)
        .order("tracking_date", { ascending: true })
        .limit(365);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading || wellnessHistory.length < 2) return null;

  const recentHistory = wellnessHistory.slice(-30);

  const chartData = recentHistory.map((w: any) => {
    const recoveryScore = computeRecoveryScore(w);

    return {
      date: format(new Date(w.tracking_date), "dd/MM", { locale: fr }),
      fullDate: format(new Date(w.tracking_date), "dd MMM yyyy", { locale: fr }),
      sleep_quality: w.sleep_quality,
      general_fatigue: w.general_fatigue,
      soreness_upper_body: w.soreness_upper_body,
      soreness_lower_body: w.soreness_lower_body,
      stress_level: w.stress_level,
      sleep_duration: w.sleep_duration,
      recovery_score: recoveryScore,
    };
  });

  // Aggregated data for metrics chart (per period)
  const metricsHistory =
    period === "day"
      ? wellnessHistory.slice(-30)
      : period === "week"
      ? wellnessHistory.slice(-84) // ~12 weeks
      : wellnessHistory.slice(-365);
  const metricsData = aggregateWellnessByPeriod(metricsHistory as any, period);

  // Aggregated recovery score (independent period selector)
  const recoveryHistory =
    recoveryPeriod === "day"
      ? wellnessHistory.slice(-30)
      : recoveryPeriod === "week"
      ? wellnessHistory.slice(-84)
      : wellnessHistory.slice(-365);
  const recoveryData = aggregateWellnessByPeriod(recoveryHistory as any, recoveryPeriod);

  // Latest recovery score
  const latestRecovery = chartData[chartData.length - 1]?.recovery_score || 0;
  // sleep_duration is stored as a 1-5 score (1 = >8h, 5 = <5h). Convert to approximate hours for display.
  const sleepEntries = wellnessHistory.filter((w: any) => w.sleep_duration != null && w.sleep_duration > 0);
  const avgSleep = sleepEntries.length > 0
    ? (sleepEntries.reduce((s: number, w: any) => s + sleepScoreToHours(w.sleep_duration), 0) / sleepEntries.length).toFixed(1)
    : "—";

  const getRecoveryColor = (score: number) => {
    if (score >= 80) return "text-status-optimal";
    if (score >= 60) return "text-accent";
    if (score >= 40) return "text-warning";
    return "text-destructive";
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-card">
          <CardContent className="py-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <p className={`text-2xl font-bold ${getRecoveryColor(latestRecovery)}`}>{latestRecovery}%</p>
              <TooltipProvider delayDuration={150}>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="Comment est calculé ce score ?" className="text-muted-foreground hover:text-foreground transition-colors">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                    <p className="font-semibold mb-1">Score de récupération (0-100%)</p>
                    <p>Synthèse globale de ta forme du jour, calculée à partir de tes 5 réponses wellness (sommeil, fatigue générale, fatigue haut/bas du corps, stress).</p>
                    <p className="mt-1 text-muted-foreground">Plus c'est haut, mieux tu récupères. 80%+ = top forme · 60-80% = correct · &lt;60% = vigilance.</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
            <p className="text-[10px] text-muted-foreground">Récupération actuelle</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card">
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-primary">{avgSleep}h</p>
            <p className="text-[10px] text-muted-foreground">Sommeil moyen</p>
          </CardContent>
        </Card>
      </div>

      {/* Recovery score evolution */}
      <Card className="bg-gradient-card shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: NAV_COLORS.sante.base }} />
              Score de récupération
              <Badge variant="secondary" className="text-[10px]">{wellnessHistory.length} jours</Badge>
            </CardTitle>
            <ToggleGroup
              type="single"
              size="sm"
              value={recoveryPeriod}
              onValueChange={(v) => v && setRecoveryPeriod(v as WellnessPeriod)}
              className="h-7"
            >
              <ToggleGroupItem value="day" className="h-7 px-2 text-[11px]">Jour</ToggleGroupItem>
              <ToggleGroupItem value="week" className="h-7 px-2 text-[11px]">Semaine</ToggleGroupItem>
              <ToggleGroupItem value="month" className="h-7 px-2 text-[11px]">Mois</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
            Indicateur global (0-100%) de ta capacité de récupération, calculé à partir de tes réponses wellness :
            <span className="font-medium text-foreground"> sommeil + (6 − fatigue générale) + (6 − fatigue haut) + (6 − fatigue bas) + (6 − stress)</span>, le tout divisé par 5 et ramené sur 100. Plus la courbe est haute, mieux tu récupères.
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={recoveryData} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-[10px]" />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} className="text-[10px]" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  fontSize: "12px",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => [`${value}%`, "Récupération"]}
                labelFormatter={(_, payload: any[]) => payload?.[0]?.payload?.fullDate || ""}
              />
              <Line
                type="monotone"
                dataKey="recovery_score"
                stroke={NAV_COLORS.sante.base}
                strokeWidth={4}
                dot={{ r: 4, fill: NAV_COLORS.sante.base, strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 6 }}
                name="Récupération"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Wellness metrics evolution */}
      <Card className="bg-gradient-card shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Détail des métriques
            </CardTitle>
            <ToggleGroup
              type="single"
              size="sm"
              value={period}
              onValueChange={(v) => v && setPeriod(v as WellnessPeriod)}
              className="h-7"
            >
              <ToggleGroupItem value="day" className="h-7 px-2 text-[11px]">Jour</ToggleGroupItem>
              <ToggleGroupItem value="week" className="h-7 px-2 text-[11px]">Semaine</ToggleGroupItem>
              <ToggleGroupItem value="month" className="h-7 px-2 text-[11px]">Mois</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {Object.entries(METRIC_COLORS).map(([key, color]) => {
              const active = visibleMetrics[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleMetric(key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                    active
                      ? "bg-surface-elevated border-border shadow-sm"
                      : "bg-transparent border-border/60 text-muted-foreground opacity-60 hover:opacity-100"
                  }`}
                  aria-pressed={active}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: active ? color : "transparent", border: `1.5px solid ${color}` }}
                  />
                  {METRIC_LABELS[key] || key}
                </button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            const activeKeys = Object.keys(METRIC_COLORS).filter((k) => visibleMetrics[k]);
            if (activeKeys.length === 0) {
              return (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Sélectionne au moins une métrique à afficher.
                </p>
              );
            }
            // Auto-scale Y axis based on selected metrics
            let minV = Infinity;
            let maxV = -Infinity;
            metricsData.forEach((d: any) => {
              activeKeys.forEach((k) => {
                const v = d[k];
                if (typeof v === "number") {
                  if (v < minV) minV = v;
                  if (v > maxV) maxV = v;
                }
              });
            });
            const lo = Number.isFinite(minV) ? Math.max(1, Math.floor((minV - 0.25) * 2) / 2) : 1;
            const hi = Number.isFinite(maxV) ? Math.min(5, Math.ceil((maxV + 0.25) * 2) / 2) : 5;
            const ticks: number[] = [];
            for (let t = lo; t <= hi + 1e-9; t += 0.5) ticks.push(Math.round(t * 2) / 2);
            return (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={metricsData} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-[10px]" />
                  <YAxis domain={[lo, hi]} ticks={ticks} className="text-[10px]" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      fontSize: "12px",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number, name: string) => [`${Math.round(Number(value))}/5`, METRIC_LABELS[name] || name]}
                    labelFormatter={(_, payload: any[]) => payload?.[0]?.payload?.fullDate || ""}
                  />
                  <Legend
                    formatter={(value) => METRIC_LABELS[value] || value}
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  />
                  {activeKeys.map((key) => {
                    const color = METRIC_COLORS[key];
                    return (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={color}
                        strokeWidth={3}
                        strokeDasharray={METRIC_DASH[key]}
                        dot={{ r: 3.5, fill: color, strokeWidth: 1.5, stroke: "#fff" }}
                        activeDot={{ r: 6 }}
                        name={key}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
