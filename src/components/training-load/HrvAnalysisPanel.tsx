import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Area,
} from "recharts";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Heart, Activity, AlertTriangle, TrendingUp, Info } from "lucide-react";
import {
  HrvDailyData,
  HrvAnalysis,
  AcwrHrvCorrelation,
  calculateHrvAnalysis,
  correlateAcwrHrv,
  getCvStatusColor,
  getCvStatusLabel,
  getHrvScoreColor,
  getHrvScoreLabel,
  getCorrelationRiskColor,
  getCorrelationRiskLabel,
} from "@/lib/hrvCalculations";
import { EWMAResult } from "@/lib/trainingLoadCalculations";
import { InfoHint } from "./InfoHint";
import { Trans, useTranslation } from "react-i18next";

interface HrvAnalysisPanelProps {
  hrvRecords: any[];
  loadData: EWMAResult[];
  playerId?: string;
  isLoading?: boolean;
}

export function HrvAnalysisPanel({ hrvRecords, loadData, playerId, isLoading }: HrvAnalysisPanelProps) {
  const { t } = useTranslation();
  const [viewTab, setViewTab] = useState("trend");

  // Transform HRV records to daily data
  const hrvDailyData: HrvDailyData[] = useMemo(() => {
    const filtered = playerId
      ? hrvRecords.filter((r: any) => r.player_id === playerId)
      : hrvRecords;

    // Group by date and average if team view
    const byDate = new Map<string, { sum: number; count: number; record: any }>();
    filtered.forEach((r: any) => {
      const key = r.record_date;
      const existing = byDate.get(key);
      if (existing) {
        existing.count++;
        // Keep the first record for non-numeric fields
      } else {
        byDate.set(key, { sum: 0, count: 1, record: r });
      }
    });

    return filtered.map((r: any) => ({
      date: r.record_date,
      hrvMs: r.hrv_ms,
      restingHrBpm: r.resting_hr_bpm,
      avgHrBpm: r.avg_hr_bpm,
      maxHrBpm: r.max_hr_bpm,
      playerId: r.player_id,
      recordType: r.record_type || "session",
    }));
  }, [hrvRecords, playerId]);

  // Calculate HRV analysis
  const hrvAnalysis = useMemo(
    () => calculateHrvAnalysis(hrvDailyData),
    [hrvDailyData]
  );

  // Correlate with load data
  const correlations = useMemo(() => {
    if (!loadData.length || !hrvAnalysis.length) return [];
    const ratios = loadData.map((d) => ({ date: d.date, ratio: d.ratio }));
    return correlateAcwrHrv(ratios, hrvAnalysis);
  }, [loadData, hrvAnalysis]);

  // Latest values for KPI cards
  const latest = hrvAnalysis.length > 0 ? hrvAnalysis[hrvAnalysis.length - 1] : null;
  const latestCorrelation = correlations.length > 0 ? correlations[correlations.length - 1] : null;

  // Chart data for trend
  const trendChartData = useMemo(() => {
    return hrvAnalysis
      .filter((h) => h.hrvMs != null)
      .map((h) => ({
        ...h,
        dateFormatted: format(parseISO(h.date), "dd/MM", { locale: fr }),
      }));
  }, [hrvAnalysis]);

  // Chart data for correlation
  const correlationChartData = useMemo(() => {
    return correlations.map((c) => ({
      ...c,
      dateFormatted: format(parseISO(c.date), "dd/MM", { locale: fr }),
      hrvScore: hrvAnalysis.find((h) => h.date === c.date)?.hrvScore ?? null,
    }));
  }, [correlations, hrvAnalysis]);

  if (isLoading) {
    return (
      <Card className="bg-gradient-card shadow-md">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="h-[300px] bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (hrvDailyData.length === 0) {
    return (
      <Card className="bg-gradient-card shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-destructive" />
            t("workload.hrvPanel.title")
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Heart className="h-12 w-12 mb-4 opacity-50" />
            <p className="font-medium">{t("workload.hrvPanel.noData")}</p>
            <p className="text-sm mt-1">
              {t("workload.hrvPanel.noDataDesc")}
            </p>
            <p className="text-xs mt-3 max-w-md text-center">
              {t("workload.hrvPanel.tip")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gradient-card shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground">{t("workload.hrvPanel.kpi.hrvCurrent")}</p>
              <InfoHint
                title={t("workload.hrvPanel.kpi.hrvCurrentHint.title")}
                what={t("workload.hrvPanel.kpi.hrvCurrentHint.what")}
                how={t("workload.hrvPanel.kpi.hrvCurrentHint.how")}
                why={t("workload.hrvPanel.kpi.hrvCurrentHint.why")}
              />
            </div>
            <p className="text-xl font-bold">
              {latest?.hrvMs != null ? `${latest.hrvMs} ms` : "—"}
            </p>
            {latest?.baselineMean != null && (
              <p className="text-[10px] text-muted-foreground">
                {t("workload.hrvPanel.kpi.baseline", { mean: latest.baselineMean, days: latest.baselineDays })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground">{t("workload.hrvPanel.kpi.cv")}</p>
              <InfoHint
                title={t("workload.hrvPanel.kpi.cvHint.title")}
                what={t("workload.hrvPanel.kpi.cvHint.what")}
                how={t("workload.hrvPanel.kpi.cvHint.how")}
                why={t("workload.hrvPanel.kpi.cvHint.why")}
              />
            </div>
            <p className={`text-xl font-bold ${getCvStatusColor(latest?.cvStatus ?? null)}`}>
              {latest?.cvPercent != null ? `${latest.cvPercent}%` : "—"}
            </p>
            {latest?.cvStatus && (
              <Badge variant="secondary" className="text-[10px] mt-1">
                {getCvStatusLabel(latest.cvStatus)}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground">{t("workload.hrvPanel.kpi.score")}</p>
              <InfoHint
                title={t("workload.hrvPanel.kpi.scoreHint.title")}
                what={t("workload.hrvPanel.kpi.scoreHint.what")}
                how={t("workload.hrvPanel.kpi.scoreHint.how")}
                why={t("workload.hrvPanel.kpi.scoreHint.why")}
              />
            </div>
            <p className={`text-xl font-bold ${getHrvScoreColor(latest?.hrvScoreStatus ?? null)}`}>
              {latest?.hrvScore != null ? latest.hrvScore.toFixed(2) : "—"}
            </p>
            {latest?.hrvScoreStatus && (
              <Badge variant="secondary" className="text-[10px] mt-1">
                {getHrvScoreLabel(latest.hrvScoreStatus)}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-sm">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{t("workload.hrvPanel.kpi.combinedRisk")}</p>
            {latestCorrelation ? (
              <>
                <p className={`text-xl font-bold ${latestCorrelation.color}`}>
                  {getCorrelationRiskLabel(latestCorrelation.riskLevel)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  ACWR: {latestCorrelation.acwr?.toFixed(2) ?? "—"}
                </p>
              </>
            ) : (
              <p className="text-xl font-bold text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Baseline warning */}
      {latest && latest.baselineDays < 28 && latest.baselineDays >= 7 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-sm">
          <Info className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-yellow-600 dark:text-yellow-400">
              {t("workload.hrvPanel.baselineWarning.title", { days: latest.baselineDays })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("workload.hrvPanel.baselineWarning.desc")}
            </p>
          </div>
        </div>
      )}

      {/* Chart tabs */}
      <Card className="bg-gradient-card shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-destructive" />
            {t("workload.hrvPanel.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={viewTab} onValueChange={setViewTab}>
            <TabsList className="grid w-full max-w-md grid-cols-3 mb-4">
              <TabsTrigger value="trend">{t("workload.hrvPanel.tabs.trend")}</TabsTrigger>
              <TabsTrigger value="correlation">{t("workload.hrvPanel.tabs.correlation")}</TabsTrigger>
              <TabsTrigger value="table">{t("workload.hrvPanel.tabs.table")}</TabsTrigger>
            </TabsList>

            <TabsContent value="trend">
              {/* HRV Trend Chart with CV% and Score */}
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="dateFormatted" className="text-xs" />
                  <YAxis yAxisId="left" className="text-xs" label={{ value: t("workload.hrvPanel.chart.msAxis"), angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
                  <YAxis yAxisId="right" orientation="right" className="text-xs" label={{ value: t("workload.hrvPanel.chart.scoreCvAxis"), angle: 90, position: "insideRight", style: { fontSize: 10 } }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      if (!d) return null;
                      return (
                        <div className="rounded-lg border bg-background p-3 shadow-lg text-sm space-y-1">
                          <p className="font-medium">{format(parseISO(d.date), "EEEE d MMMM", { locale: fr })}</p>
                          {d.hrvMs != null && <p>{t("workload.hrvPanel.chart.tooltipHrv", { value: d.hrvMs })}</p>}
                          {d.baselineMean != null && <p className="text-xs text-muted-foreground">{t("workload.hrvPanel.chart.tooltipBaseline", { value: d.baselineMean })}</p>}
                          {d.cvPercent != null && <p>{t("workload.hrvPanel.chart.tooltipCv", { value: d.cvPercent })} <span className={`font-semibold ${getCvStatusColor(d.cvStatus)}`}></span> ({getCvStatusLabel(d.cvStatus)})</p>}
                          {d.hrvScore != null && <p>{t("workload.hrvPanel.chart.tooltipScore", { value: d.hrvScore.toFixed(2) })} ({getHrvScoreLabel(d.hrvScoreStatus)})</p>}
                        </div>
                      );
                    }}
                  />
                  <Legend />

                  {/* Baseline area */}
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="baselineMean"
                    fill="hsl(var(--muted))"
                    stroke="hsl(var(--muted-foreground))"
                    fillOpacity={0.2}
                    strokeDasharray="4 4"
                    strokeWidth={1}
                    name={t("workload.hrvPanel.chart.baselineMean")}
                  />

                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="hrvMs"
                    stroke="hsl(280, 67%, 55%)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name={t("workload.hrvPanel.chart.hrvMs")}
                    connectNulls
                  />

                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cvPercent"
                    stroke="hsl(45, 93%, 47%)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={{ r: 2 }}
                    name={t("workload.hrvPanel.chart.cvSeries")}
                    connectNulls
                  />

                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="hrvScore"
                    stroke="hsl(142, 76%, 36%)"
                    strokeWidth={1.5}
                    dot={{ r: 2 }}
                    name={t("workload.hrvPanel.chart.hrvScoreSeries")}
                    connectNulls
                  />

                  {/* Reference lines for CV% thresholds */}
                  <ReferenceLine yAxisId="right" y={5} stroke="hsl(45, 93%, 47%)" strokeDasharray="3 3" strokeWidth={0.5} />
                  <ReferenceLine yAxisId="right" y={8} stroke="hsl(0, 84%, 60%)" strokeDasharray="3 3" strokeWidth={0.5} />
                  <ReferenceLine yAxisId="right" y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeWidth={0.5} />
                </ComposedChart>
              </ResponsiveContainer>

              {/* Legend info */}
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <Trans i18nKey="workload.hrvPanel.legendInfo.cv" t={t} components={[<span className="text-green-500" key="0" />, <span className="text-yellow-500" key="1" />, <span className="text-red-500" key="2" />]} />
                <Trans i18nKey="workload.hrvPanel.legendInfo.score" t={t} components={[<span className="text-green-500" key="0" />, <span className="text-primary" key="1" />, <span className="text-orange-500" key="2" />, <span className="text-red-500" key="3" />]} />
              </div>
            </TabsContent>

            <TabsContent value="correlation">
              {correlationChartData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={correlationChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="dateFormatted" className="text-xs" />
                      <YAxis yAxisId="left" className="text-xs" domain={[0.5, 2]} label={{ value: "ACWR", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
                      <YAxis yAxisId="right" orientation="right" className="text-xs" label={{ value: "Score HRV", angle: 90, position: "insideRight", style: { fontSize: 10 } }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0]?.payload;
                          if (!d) return null;
                          return (
                            <div className="rounded-lg border bg-background p-3 shadow-lg text-sm space-y-1">
                              <p className="font-medium">{format(parseISO(d.date), "EEEE d MMMM", { locale: fr })}</p>
                              <p>{t("workload.hrvPanel.chart.tooltipRatio", { value: d.acwr?.toFixed(2) })}</p>
                              {d.hrvScore != null && <p>{t("workload.hrvPanel.chart.tooltipHrvScore", { value: d.hrvScore.toFixed(2) })}</p>}
                              <p className={`font-medium mt-1 ${d.color}`}>{getCorrelationRiskLabel(d.riskLevel)}</p>
                              <p className="text-xs">{d.recommendation}</p>
                            </div>
                          );
                        }}
                      />
                      <Legend />

                      <ReferenceLine yAxisId="left" y={0.85} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                      <ReferenceLine yAxisId="left" y={1.3} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                      <ReferenceLine yAxisId="right" y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />

                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="acwr"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name={t("workload.hrvPanel.chart.ratioCharge")}
                        connectNulls
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="hrvScore"
                        stroke="hsl(280, 67%, 55%)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name={t("workload.hrvPanel.chart.hrvScoreSeries")}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>

                  {/* Latest correlation recommendation */}
                  {latestCorrelation && (
                    <div className={`mt-3 p-3 rounded-lg border ${getCorrelationRiskColor(latestCorrelation.riskLevel)}`}>
                      <p className="text-sm font-medium">{latestCorrelation.recommendation}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{t("workload.hrvPanel.correlationEmpty.title")}</p>
                  <p className="text-xs mt-1">{t("workload.hrvPanel.correlationEmpty.desc")}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="table">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("workload.hrvPanel.table.date")}</TableHead>
                      <TableHead>{t("workload.hrvPanel.table.hrvMs")}</TableHead>
                      <TableHead>{t("workload.hrvPanel.table.restingHr")}</TableHead>
                      <TableHead>{t("workload.hrvPanel.table.cv")}</TableHead>
                      <TableHead>{t("workload.hrvPanel.table.score")}</TableHead>
                      <TableHead>{t("workload.hrvPanel.table.status")}</TableHead>
                      <TableHead>{t("workload.hrvPanel.table.baseline")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...hrvAnalysis]
                      .filter((h) => h.hrvMs != null)
                      .reverse()
                      .slice(0, 30)
                      .map((h) => (
                        <TableRow key={h.date}>
                          <TableCell className="text-sm">
                            {format(parseISO(h.date), "dd/MM/yy", { locale: fr })}
                          </TableCell>
                          <TableCell className="font-semibold">{h.hrvMs} ms</TableCell>
                          <TableCell>{h.restingHrBpm != null ? `${h.restingHrBpm} bpm` : "—"}</TableCell>
                          <TableCell>
                            <span className={getCvStatusColor(h.cvStatus)}>
                              {h.cvPercent != null ? `${h.cvPercent}%` : "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={getHrvScoreColor(h.hrvScoreStatus)}>
                              {h.hrvScore != null ? h.hrvScore.toFixed(2) : "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {h.hrvScoreStatus ? (
                              <Badge
                                variant="secondary"
                                className={`text-[10px] ${
                                  h.hrvScoreStatus === "optimal"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                    : h.hrvScoreStatus === "normal"
                                    ? ""
                                    : h.hrvScoreStatus === "under_recovery"
                                    ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                }`}
                              >
                                {getHrvScoreLabel(h.hrvScoreStatus)}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {h.baselineMean != null
                              ? `${h.baselineMean} ± ${h.baselineStd} (${h.baselineDays}j)`
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
