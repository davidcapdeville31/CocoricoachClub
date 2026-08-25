import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, Info } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { NAV_COLORS } from "@/components/ui/colored-nav-tabs";
import { sleepScoreToHours } from "@/lib/sleepConversion";
import { aggregateWellnessByPeriod, computeRecoveryScore, type WellnessPeriod } from "@/lib/wellness/aggregatePeriod";

interface Props {
  playerId: string;
}

export function PlayerRecoveryScore({ playerId }: Props) {
  const [recoveryPeriod, setRecoveryPeriod] = useState<WellnessPeriod>("day");

  const { data: wellnessHistory = [], isLoading } = useQuery({
    queryKey: ["player-recovery-score-history", playerId],
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
  const latestRecovery = (() => {
    const w: any = recentHistory[recentHistory.length - 1];
    if (!w) return 0;
    return computeRecoveryScore(w);
  })();

  const sleepEntries = wellnessHistory.filter((w: any) => w.sleep_duration != null && w.sleep_duration > 0);
  const avgSleep = sleepEntries.length > 0
    ? (sleepEntries.reduce((s: number, w: any) => s + sleepScoreToHours(w.sleep_duration), 0) / sleepEntries.length).toFixed(1)
    : "—";

  const recoveryHistory =
    recoveryPeriod === "day"
      ? wellnessHistory.slice(-30)
      : recoveryPeriod === "week"
      ? wellnessHistory.slice(-84)
      : wellnessHistory.slice(-365);
  const recoveryData = aggregateWellnessByPeriod(recoveryHistory as any, recoveryPeriod);

  const getRecoveryColor = (score: number) => {
    if (score >= 80) return "text-status-optimal";
    if (score >= 60) return "text-accent";
    if (score >= 40) return "text-warning";
    return "text-destructive";
  };

  return (
    <div className="space-y-4">
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
                    <p>Synthèse globale de la forme du jour de l'athlète, calculée à partir de ses 5 réponses wellness (sommeil, fatigue générale, fatigue haut/bas du corps, stress).</p>
                    <p className="mt-1 text-muted-foreground">Plus c'est haut, mieux il récupère. 80%+ = top forme · 60-80% = correct · &lt;60% = vigilance.</p>
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
            Indicateur global (0-100%) de la capacité de récupération de l'athlète, calculé à partir des réponses wellness :
            <span className="font-medium text-foreground"> sommeil + (6 − fatigue générale) + (6 − fatigue haut) + (6 − fatigue bas) + (6 − stress)</span>, le tout divisé par 5 et ramené sur 100. Plus la courbe est haute, mieux il récupère.
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
    </div>
  );
}
