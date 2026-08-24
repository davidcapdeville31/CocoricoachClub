import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColoredSubTabsList, ColoredSubTabsTrigger } from "@/components/ui/colored-subtabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, Users, TrendingUp, BarChart3, Heart, Activity, Satellite, Lightbulb, Info } from "lucide-react";
import { InfoHint } from "./InfoHint";
import { HrvEntryDialog } from "@/components/category/hrv/HrvEntryDialog";
import { TrainingLoadChart } from "./TrainingLoadChart";
import { TrainingLoadKPIs } from "./TrainingLoadKPIs";
import { TrainingLoadAlerts } from "./TrainingLoadAlerts";
import { TeamLoadComparison } from "./TeamLoadComparison";
import { IntensityComparisonDashboard } from "@/components/analytics/IntensityComparisonDashboard";
import { TrainingLoadCalendar } from "./TrainingLoadCalendar";
import { TrainingDistribution } from "./TrainingDistribution";
import { HrvAnalysisPanel } from "./HrvAnalysisPanel";
import { useTrainingLoad, useTeamTrainingLoad } from "@/hooks/use-training-load";
import { MetricType, METRICS_CONFIG } from "@/lib/trainingLoadCalculations";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TrainingLoadTabProps {
  categoryId: string;
}

export function TrainingLoadTab({ categoryId }: TrainingLoadTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isViewer } = useViewerModeContext();
  const [loadModel, setLoadModel] = useState<"ewma" | "awcr">("ewma");
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("ewma_srpe");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | undefined>();
  const [periodDays, setPeriodDays] = useState<number>(56);
  const [isHrvDialogOpen, setIsHrvDialogOpen] = useState(false);
  const [loadSection, setLoadSection] = useState<"internal" | "external">("internal");
  const [searchParams] = useSearchParams();
  const urlLoadTab = searchParams.get("loadtab");
  const [contentTab, setContentTab] = useState<string>(urlLoadTab || "chart");

  useEffect(() => {
    if (urlLoadTab) setContentTab(urlLoadTab);
  }, [urlLoadTab]);

  // Sync metric when model changes
  const handleModelChange = (model: "ewma" | "awcr") => {
    setLoadModel(model);
    const currentBase = selectedMetric.replace(/^(ewma|awcr)_/, "");
    setSelectedMetric(`${model}_${currentBase}` as MetricType);
  };

  // Realtime sync for training data
  useRealtimeSync({
    tables: ["training_sessions", "training_session_blocks", "awcr_tracking", "wellness_tracking"],
    categoryId,
    queryKeys: [
      ["training-load", categoryId],
      ["training-load-awcr", categoryId],
      ["training-load-gps", categoryId],
      ["training-load-hrv", categoryId],
      ["team-training-load", categoryId],
      ["load-calendar-sessions", categoryId],
      ["awcr_tracking", categoryId],
      ["awcr-data", categoryId],
      ["awcr-risk", categoryId],
      ["ewma_summary", categoryId],
      ["training_sessions", categoryId],
      ["wellness_tracking", categoryId],
    ],
    channelName: `training-load-sync-${categoryId}`,
  });

  // Individual athlete data (if selected)
  const { 
    chartData, 
    summary, 
    availableMetrics, 
    hasGpsData,
    hasHrvData,
    sportType,
    isLoading 
  } = useTrainingLoad({
    categoryId,
    playerId: selectedPlayerId,
    metric: selectedMetric,
    periodDays,
  });

  // Team data
  const { 
    players, 
    teamAverage, 
    playersAtRisk,
    isLoading: teamLoading 
  } = useTeamTrainingLoad({
    categoryId,
    metric: selectedMetric,
    periodDays: 28,
  });

  // Fetch HRV records for external tab
  const { data: hrvRecords = [], isLoading: hrvRecordsLoading } = useQuery({
    queryKey: ["hrv-records-analysis", categoryId, selectedPlayerId, periodDays],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Math.max(periodDays, 60)); // min 60 days for baseline

      let query = supabase
        .from("hrv_records")
        .select("*")
        .eq("category_id", categoryId)
        .gte("record_date", startDate.toISOString().split("T")[0])
        .order("record_date", { ascending: true });

      if (selectedPlayerId) {
        query = query.eq("player_id", selectedPlayerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const handlePlayerClick = (playerId: string) => {
    setSelectedPlayerId(playerId);
  };

  const periodOptions = [
    { value: 3, label: t("workload.tab.period.days3") },
    { value: 7, label: t("workload.tab.period.days7") },
    { value: 14, label: t("workload.tab.period.days14") },
    { value: 28, label: t("workload.tab.period.days28") },
    { value: 56, label: t("workload.tab.period.weeks8") },
    { value: 90, label: t("workload.tab.period.season") },
  ];

  return (
    <div className="space-y-6">
      {/* Pedagogical banner */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-3 px-4 flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-1.5 shrink-0">
            <Lightbulb className="h-4 w-4 text-primary" />
          </div>
          <div className="text-sm text-foreground/90 leading-relaxed">
            <span className="font-semibold">{t("workload.tab.banner.title")}</span>{" "}
            {t("workload.tab.banner.text")}{" "}
            <Info className="inline h-3.5 w-3.5 mx-0.5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            {t("workload.tab.header.title")}
            <InfoHint
              title={t("workload.tab.header.hint.title")}
              what={t("workload.tab.header.hint.what")}
              how={t("workload.tab.header.hint.how")}
              why={t("workload.tab.header.hint.why")}
            />
          </h2>
          <p className="text-muted-foreground text-sm">
            {loadModel === "ewma" ? t("workload.tab.header.subtitleEwma") : t("workload.tab.header.subtitleAwcr")}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <TooltipProvider delayDuration={300}>
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={`px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1 ${
                    loadSection === "internal" 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => setLoadSection("internal")}
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t("workload.tab.section.internal")}</span>
                  <span className="sm:hidden">{t("workload.tab.section.internalShort")}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs bg-background/95 backdrop-blur-sm border shadow-lg">
                <p className="font-semibold text-xs mb-1">{t("workload.tab.section.internalTooltipTitle")}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t("workload.tab.section.internalTooltipDesc")}
                </p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={`px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1 ${
                    loadSection === "external" 
                      ? "bg-destructive text-destructive-foreground" 
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => setLoadSection("external")}
                >
                  <Heart className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t("workload.tab.section.external")}</span>
                  <span className="sm:hidden">{t("workload.tab.section.externalShort")}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs bg-background/95 backdrop-blur-sm border shadow-lg">
                <p className="font-semibold text-xs mb-1">{t("workload.tab.section.externalTooltipTitle")}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t("workload.tab.section.externalTooltipDesc")}
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          </TooltipProvider>

          {/* Model toggle EWMA / AWCR - only for internal */}
          {loadSection === "internal" && (
            <TooltipProvider delayDuration={300}>
            <div className="flex items-center border rounded-lg overflow-hidden">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      loadModel === "ewma" 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={() => handleModelChange("ewma")}
                  >
                    EWMA
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs bg-background/95 backdrop-blur-sm border shadow-lg">
                  <p className="font-semibold text-xs mb-1">{t("workload.tab.model.ewmaTooltipTitle")}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {t("workload.tab.model.ewmaTooltipDesc")}
                  </p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      loadModel === "awcr" 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={() => handleModelChange("awcr")}
                  >
                    AWCR
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs bg-background/95 backdrop-blur-sm border shadow-lg">
                  <p className="font-semibold text-xs mb-1">{t("workload.tab.model.awcrTooltipTitle")}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {t("workload.tab.model.awcrTooltipDesc")}
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            </TooltipProvider>
          )}

          {/* Period filter */}
          <Select value={periodDays.toString()} onValueChange={(v) => setPeriodDays(Number(v))}>
            <SelectTrigger className="w-[130px]">
              <Calendar className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value.toString()}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Player filter */}
          <Select 
            value={selectedPlayerId || "team"} 
            onValueChange={(v) => setSelectedPlayerId(v === "team" ? undefined : v)}
          >
            <SelectTrigger className="w-[180px]">
              <Users className="h-3 w-3 mr-1" />
              <SelectValue placeholder={t("workload.tab.playerSelect.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="team">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {t("workload.tab.playerSelect.teamView")}
                </span>
              </SelectItem>
              {players.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {[p.first_name, p.name].filter(Boolean).join(" ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!isViewer && (
            <Button 
              onClick={() => setIsHrvDialogOpen(true)} 
              variant="outline"
              className="gap-2"
            >
              <Heart className="h-4 w-4 text-destructive" />
              <span className="hidden sm:inline">{t("workload.tab.enterHrv")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* ===== INTERNAL LOAD SECTION ===== */}
      {loadSection === "internal" && (
        <>
          {/* GPS Info */}
          {hasGpsData && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <p className="text-sm">
                  <Badge variant="secondary" className="mr-2 gap-1">
                    <Satellite className="h-3 w-3" />
                    GPS
                  </Badge>
                  {t("workload.tab.gpsInfo")}
                </p>
              </CardContent>
            </Card>
          )}

          {/* KPI Cards */}
          <TrainingLoadKPIs 
            summary={selectedPlayerId ? summary : (teamAverage ? {
              currentLoad: teamAverage.currentLoad ?? 0,
              ewmaAcute: teamAverage.ewmaAcute,
              ewmaChronic: teamAverage.ewmaChronic,
              ewmaRatio: teamAverage.ewmaRatio,
              weeklyChange: teamAverage.weeklyChange ?? 0,
              riskLevel: teamAverage.ewmaRatio >= 0.85 && teamAverage.ewmaRatio <= 1.3 ? "optimal" :
                        teamAverage.ewmaRatio >= 0.8 && teamAverage.ewmaRatio <= 1.5 ? "warning" : "danger",
              trend: teamAverage.trend ?? "stable",
            } : null)}
            isLoading={isLoading || teamLoading}
            loadModel={loadModel}
          />

          {/* Main content tabs */}
          <Tabs value={contentTab} onValueChange={setContentTab} className="space-y-4">
            <div className="flex justify-center">
              <ColoredSubTabsList colorKey="performance" className="inline-flex flex-wrap h-auto gap-1 w-max">
                <ColoredSubTabsTrigger value="chart" colorKey="performance" icon={<BarChart3 className="h-4 w-4" />}>
                  {t("workload.tab.subtabs.chart")}
                </ColoredSubTabsTrigger>
                <ColoredSubTabsTrigger value="calendar" colorKey="performance" icon={<Calendar className="h-4 w-4" />}>
                  {t("workload.tab.subtabs.calendar")}
                </ColoredSubTabsTrigger>
                <ColoredSubTabsTrigger value="rpe" colorKey="performance" icon={<TrendingUp className="h-4 w-4" />}>
                  {t("workload.tab.subtabs.rpe")}
                </ColoredSubTabsTrigger>
                <ColoredSubTabsTrigger value="team" colorKey="performance" icon={<Users className="h-4 w-4" />}>
                  {t("workload.tab.subtabs.team")}
                </ColoredSubTabsTrigger>
                <ColoredSubTabsTrigger value="distribution" colorKey="performance" icon={<BarChart3 className="h-4 w-4" />}>
                  {t("workload.tab.subtabs.distribution")}
                </ColoredSubTabsTrigger>
              </ColoredSubTabsList>
            </div>

            <TabsContent value="chart" className="space-y-2">
              <SubTabHelp
                title={t("workload.tab.subtabHelp.chartTitle")}
                text={t("workload.tab.subtabHelp.chartText")}
              />
              <TrainingLoadChart
                chartData={chartData}
                availableMetrics={availableMetrics}
                selectedMetric={selectedMetric}
                onMetricChange={setSelectedMetric}
                hasGpsData={hasGpsData}
                hasHrvData={hasHrvData}
                isLoading={isLoading}
              />
            </TabsContent>

            <TabsContent value="calendar" className="space-y-2">
              <SubTabHelp
                title={t("workload.tab.subtabHelp.calendarTitle")}
                text={t("workload.tab.subtabHelp.calendarText")}
              />
              <TrainingLoadCalendar categoryId={categoryId} />
            </TabsContent>

            <TabsContent value="rpe" className="space-y-2">
              <SubTabHelp
                title={t("workload.tab.subtabHelp.rpeTitle")}
                text={t("workload.tab.subtabHelp.rpeText")}
              />
              <IntensityComparisonDashboard categoryId={categoryId} />
            </TabsContent>

            <TabsContent value="team" className="space-y-2">
              <SubTabHelp
                title={t("workload.tab.subtabHelp.teamTitle")}
                text={t("workload.tab.subtabHelp.teamText")}
              />
              <TeamLoadComparison
                players={players}
                teamAverage={teamAverage}
                onPlayerClick={handlePlayerClick}
                isLoading={teamLoading}
                sportType={sportType}
              />
            </TabsContent>

            <TabsContent value="distribution" className="space-y-2">
              <SubTabHelp
                title={t("workload.tab.subtabHelp.distributionTitle")}
                text={t("workload.tab.subtabHelp.distributionText")}
              />
              <TrainingDistribution categoryId={categoryId} />
            </TabsContent>

          </Tabs>

          {/* Recommendations section */}
          {summary && selectedPlayerId && (
            <Card className="bg-gradient-card shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{t("workload.tab.recommendations.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`p-4 rounded-lg border ${
                  summary.riskLevel === "optimal" ? "bg-green-500/5 border-green-500/20" :
                  summary.riskLevel === "warning" ? "bg-yellow-500/5 border-yellow-500/20" :
                  "bg-red-500/5 border-red-500/20"
                }`}>
                  <p className="font-medium">
                    {summary.riskLevel === "optimal" ? t("workload.tab.recommendations.optimal") :
                     summary.riskLevel === "warning" ? t("workload.tab.recommendations.warning") :
                     t("workload.tab.recommendations.danger")}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {summary.ewmaRatio > 1.3 
                      ? t("workload.tab.recommendations.reduceIntensity")
                      : summary.ewmaRatio < 0.85
                      ? t("workload.tab.recommendations.increaseLoad")
                      : t("workload.tab.recommendations.maintain")
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ===== EXTERNAL LOAD (HRV) SECTION ===== */}
      {loadSection === "external" && (
        <HrvAnalysisPanel
          hrvRecords={hrvRecords}
          loadData={chartData}
          playerId={selectedPlayerId}
          isLoading={hrvRecordsLoading || isLoading}
        />
      )}

      {/* HRV Entry Dialog */}
      <HrvEntryDialog
        open={isHrvDialogOpen}
        onOpenChange={setIsHrvDialogOpen}
        categoryId={categoryId}
      />
    </div>
  );
}

/** Petite aide contextuelle affichée en haut de chaque sous-onglet. */
function SubTabHelp({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-muted/40 border border-border/50 px-3 py-2 text-xs text-muted-foreground">
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/70" />
      <p className="leading-relaxed">
        <span className="font-medium text-foreground">{title} · </span>
        {text}
      </p>
    </div>
  );
}
