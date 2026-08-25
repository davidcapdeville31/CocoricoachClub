import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeAcwrDetailed, acwrToScore, acwrMethodLabel, ACWR_MIN_HISTORY_DAYS } from "@/lib/acwr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Activity, Heart, AlertTriangle, Target, CheckCircle2, AlertCircle, XCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/training-load/InfoHint";
import { format, subDays } from "date-fns";
import { useSeasonFilteredPlayerIds } from "@/hooks/use-season-filtered-players";
import { useSeasonRosterFilter } from "@/contexts/SeasonRosterFilterContext";
import { useWellnessQuestions, DEFAULT_WELLNESS_QUESTIONS } from "@/lib/wellness/questionConfig";
import { Trans, useTranslation } from "react-i18next";

/** Hiérarchie wellness-first : le wellness prime sur la charge (contexte). */
const AVAILABILITY_WEIGHTS = { wellness: 0.6, acwr: 0.4 } as const;

interface AvailabilityScoreTabProps {
  categoryId: string;
}

interface PlayerAvailability {
  playerId: string;
  playerName: string;
  avatarUrl: string | null;
  position: string | null;
  acwr: number | null;
  acwrScore: number | null;
  acwrInsufficient: boolean;
  acwrHistoryDays: number;
  adherenceRatio: number | null;
  wellnessScore: number | null;
  injuryScore: number;
  overallScore: number | null;
  status: 'available' | 'limited' | 'unavailable' | 'no_data';
  factors: string[];
  hasAnyData: boolean;
}


export function AvailabilityScoreTab({ categoryId }: AvailabilityScoreTabProps) {
  const { t } = useTranslation();
  const [acwrMethod, setAcwrMethod] = useState<"rolling" | "ewma">("rolling");
  const today = new Date();
  const weekAgo = subDays(today, 7);
  const monthAgo = subDays(today, 27);
  const { allowedIds, isFiltering } = useSeasonFilteredPlayerIds(categoryId);
  const { isDateInActiveSeason, activeSeasonEnd } = useSeasonRosterFilter();
  const scopeKey = isFiltering ? `season:${activeSeasonEnd ?? "x"}` : "all";
  const { data: wellnessQuestions } = useWellnessQuestions(categoryId);
  const activeQuestions = (wellnessQuestions || DEFAULT_WELLNESS_QUESTIONS).filter((q) => q.enabled);

  const { data: availabilityData, isLoading } = useQuery({
    queryKey: ["availability-scores", categoryId, scopeKey, acwrMethod, activeQuestions.map((q) => `${q.key}:${q.inverted}`).join(",")],
    queryFn: async () => {
      // Get all players
      const { data: playersRaw } = await supabase
        .from("players")
        .select("id, first_name, name, avatar_url, position")
        .eq("category_id", categoryId);

      const players = allowedIds
        ? (playersRaw || []).filter((p: any) => allowedIds.has(p.id))
        : playersRaw;
      if (!players) return [];

      // Charges des 28 derniers jours pour un ACWR réel (aigu 7j / chronique 28j)
      const { data: loadRowsRaw } = await supabase
        .from("awcr_tracking")
        .select("player_id, session_date, awcr, rpe, duration_minutes")
        .eq("category_id", categoryId)
        .gte("session_date", format(monthAgo, "yyyy-MM-dd"))
        .order("session_date", { ascending: false });

      // Filter out auto-completed zero-load entries
      const loadRows = (loadRowsRaw || []).filter(a => !(a.rpe === 0 && a.duration_minutes === 0));

      // Get latest wellness data
      const { data: wellnessDataRaw } = await supabase
        .from("wellness_tracking")
        .select("player_id, sleep_quality, sleep_duration, general_fatigue, stress_level, soreness_upper_body, soreness_lower_body, custom_answers")
        .eq("category_id", categoryId)
        .gte("tracking_date", format(weekAgo, "yyyy-MM-dd"))
        .order("tracking_date", { ascending: false });

      const wellnessData = wellnessDataRaw;

      // Get active injuries
      const { data: injuries } = await supabase
        .from("injuries")
        .select("player_id, status, severity")
        .eq("category_id", categoryId)
        .in("status", ["active", "recovering"]);

      // Calculate availability for each player
      return players.map(player => {
        const playerLoads = loadRows.filter(a => a.player_id === player.id);
        const playerWellnessRows = (wellnessData || []).filter(w => w.player_id === player.id);
        const playerWellness = playerWellnessRows[0];
        const playerInjury = injuries?.find(i => i.player_id === player.id);

        const factors: string[] = [];

        // ---- ACWR réel : charge aiguë (7j) / charge chronique (28j) ----
        const hasLoad = playerLoads.length > 0;
        const acwrDetail = computeAcwrDetailed(playerLoads as any, acwrMethod, today);
        const acwr = acwrDetail.acwr;
        const acwrScore = acwrToScore(acwr);
        if (acwr !== null && acwrScore !== null && acwrScore < 100) {
          factors.push(acwr < 0.8 ? t("workload.availability.factors.acwrLow", { value: acwr.toFixed(2) }) : t("workload.availability.factors.acwrHigh", { value: acwr.toFixed(2) }));
        }

        // ---- Ratio d'adhérence au plan (réel / prévu) — indicateur descriptif, non noté ----
        const adherenceValues = playerLoads
          .filter(a => new Date(a.session_date) >= new Date(format(weekAgo, "yyyy-MM-dd")))
          .map(a => Number(a.awcr))
          .filter(v => Number.isFinite(v) && v > 0);
        const adherenceRatio = adherenceValues.length
          ? adherenceValues.reduce((s2, v) => s2 + v, 0) / adherenceValues.length
          : null;

        const hasWellness = playerWellnessRows.length > 0;
        const hasInjuryData = !!playerInjury;
        const hasAnyData = hasLoad || hasWellness || hasInjuryData;

        // Helper: clamp a value between 0 and 100
        const clamp100 = (v: number) => Math.max(0, Math.min(100, v));

        // Wellness Score (0-100) — null if no data
        // Each answer is normalised to a "concern" ratio (0 = optimal, 1 = worst)
        // using its own scale + orientation from the category configuration.
        // Wellness Score (0-100) — moyenne des réponses PROPRES à l'athlète sur 7 jours.
        // La fatigue générale y est incluse une seule fois (plus de sous-score dédié).
        let wellnessScore: number | null = null;
        if (hasWellness) {
          const concerns: number[] = [];
          const fatigueRatios: number[] = [];

          for (const row of playerWellnessRows) {
            const w: any = row;
            for (const q of activeQuestions) {
              const raw = q.is_custom ? w.custom_answers?.[q.key] : w[q.key];
              if (raw === null || raw === undefined || raw === "") continue;
              const num = Number(raw);
              if (!Number.isFinite(num)) continue;

              // `sleep_duration` est stocké en score 1-5 où 1 = >8h (optimal)
              const isSleepDuration = q.key === "sleep_duration" || !!q.is_sleep_duration;

              const values = (q.scale || []).map((s2: any) => s2.value);
              let min = values.length ? Math.min(...values) : 1;
              let max = values.length ? Math.max(...values) : 5;
              if (isSleepDuration) { min = 1; max = 5; }
              if (max === min) continue;
              const clamped = Math.max(min, Math.min(max, num));
              const isHigherWorse = isSleepDuration ? true : !!q.inverted;
              const ratio = isHigherWorse
                ? (clamped - min) / (max - min)
                : (max - clamped) / (max - min);

              concerns.push(ratio);
              if (q.key === "general_fatigue") fatigueRatios.push(ratio);
              if (row === playerWellness && ratio >= 0.7) {
                factors.push(isSleepDuration ? t("workload.availability.factors.insufficientSleep") : q.label);
              }
            }
          }

          if (concerns.length > 0) {
            const avgConcern = concerns.reduce((s2, r) => s2 + r, 0) / concerns.length;
            wellnessScore = Math.round(clamp100((1 - avgConcern) * 100));
          }
          if (fatigueRatios.length > 0) {
            const avgFatigue = fatigueRatios.reduce((s2, r) => s2 + r, 0) / fatigueRatios.length;
            if (avgFatigue >= 0.7) factors.push(t("workload.availability.factors.highFatigue"));
          }
        }

        // Blessure : plafond de statut (et non composante pondérée)
        let injuryScore = 100;
        let injuryCap: 'limited' | 'unavailable' | null = null;
        if (hasInjuryData) {
          const sev = (playerInjury!.severity as string) || "";
          const isSevere = sev === "severe" || sev === "grave";
          const isModerate = sev === "moderate" || sev === "modérée";
          if (playerInjury!.status === "active") {
            injuryScore = isSevere ? 0 : isModerate ? 20 : 40;
            injuryCap = isSevere ? 'unavailable' : 'limited';
            factors.push(isSevere ? t("workload.availability.factors.injurySevere") : isModerate ? t("workload.availability.factors.injuryModerate") : t("workload.availability.factors.injuryMild"));
          } else {
            injuryScore = 70;
            injuryCap = 'limited';
            factors.push(t("workload.availability.factors.rehab"));
          }
        }

        // Score global — Wellness 60 % / ACWR 40 % (la blessure agit comme plafond)
        let overallScore: number | null = null;
        if (hasAnyData) {
          let totalWeight = 0;
          let weightedSum = 0;
          if (acwrScore !== null) { weightedSum += clamp100(acwrScore) * AVAILABILITY_WEIGHTS.acwr; totalWeight += AVAILABILITY_WEIGHTS.acwr; }
          if (wellnessScore !== null) { weightedSum += clamp100(wellnessScore) * AVAILABILITY_WEIGHTS.wellness; totalWeight += AVAILABILITY_WEIGHTS.wellness; }
          overallScore = totalWeight > 0 ? Math.round(clamp100(weightedSum / totalWeight)) : null;
        }

        // Statut
        let status: 'available' | 'limited' | 'unavailable' | 'no_data' = hasAnyData ? 'available' : 'no_data';
        if (hasAnyData && overallScore !== null) {
          if (overallScore < 50) status = 'unavailable';
          else if (overallScore < 75) status = 'limited';
        }
        if (injuryCap === 'unavailable') status = 'unavailable';
        else if (injuryCap === 'limited' && status !== 'unavailable') status = 'limited';

        return {
          playerId: player.id,
          playerName: player.first_name ? `${player.first_name} ${player.name}` : player.name,
          avatarUrl: player.avatar_url,
          position: player.position,
          acwr,
          acwrScore,
          acwrInsufficient: acwrDetail.insufficientHistory,
          acwrHistoryDays: acwrDetail.historyDays,
          adherenceRatio,
          wellnessScore,
          injuryScore,
          overallScore,
          status,
          factors,
          hasAnyData,
        } as PlayerAvailability;
      }).sort((a, b) => {
        // Players with data first, then by score desc
        if (a.hasAnyData && !b.hasAnyData) return -1;
        if (!a.hasAnyData && b.hasAnyData) return 1;
        return (b.overallScore ?? 0) - (a.overallScore ?? 0);
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'no_data':
        return <Badge className="bg-muted/50 text-muted-foreground border-border"><AlertCircle className="h-3 w-3 mr-1" /> {t("workload.availability.badges.noData")}</Badge>;
      case 'available':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" /> {t("workload.availability.badges.available")}</Badge>;
      case 'limited':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><AlertCircle className="h-3 w-3 mr-1" /> {t("workload.availability.badges.limited")}</Badge>;
      case 'unavailable':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" /> {t("workload.availability.badges.unavailable")}</Badge>;
      default:
        return null;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    if (score >= 40) return "bg-orange-500";
    return "bg-red-500";
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Card key={i} className="bg-gradient-card">
            <CardContent className="p-4">
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = {
    available: availabilityData?.filter(p => p.status === 'available').length || 0,
    limited: availabilityData?.filter(p => p.status === 'limited').length || 0,
    unavailable: availabilityData?.filter(p => p.status === 'unavailable').length || 0,
  };

  const exportCsv = () => {
    const rows = availabilityData || [];
    const header = [
      "joueur","poste","statut","score_global","score_wellness","acwr","score_acwr",
      "methode_acwr","acwr_calculable","jours_historique_acwr","adherence","facteurs",
    ];
    const lines = [header.join(";")];
    for (const p of rows) {
      lines.push([
        p.playerName,
        p.position ?? "",
        p.status,
        p.overallScore ?? "",
        p.wellnessScore ?? "",
        p.acwr !== null ? p.acwr.toFixed(2).replace(".", ",") : "",
        p.acwrScore ?? "",
        acwrMethodLabel(acwrMethod),
        p.acwrInsufficient ? "non (historique insuffisant)" : "oui",
        p.acwrHistoryDays,
        p.adherenceRatio !== null ? p.adherenceRatio.toFixed(2).replace(".", ",") : "",
        p.factors.join(" | "),
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `disponibilite_${acwrMethod}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-card border-green-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-green-500/20">
              <CheckCircle2 className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-400">{stats.available}</p>
              <p className="text-sm text-muted-foreground">{t("workload.availability.stats.available")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card border-yellow-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-yellow-500/20">
              <AlertCircle className="h-6 w-6 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-400">{stats.limited}</p>
              <p className="text-sm text-muted-foreground">{t("workload.availability.stats.limited")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card border-red-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-red-500/20">
              <XCircle className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{stats.unavailable}</p>
              <p className="text-sm text-muted-foreground">{t("workload.availability.stats.unavailable")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Player Cards */}
      <Card className="bg-gradient-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            {t("workload.availability.cardTitle")}
          </CardTitle>
          <CardDescription>
            {t("workload.availability.cardDesc")}
          </CardDescription>
          <div className="flex items-center gap-2 pt-2">
            <span className="text-xs text-muted-foreground">{t("workload.availability.acwrMethodLabel")}</span>
            <Button
              size="sm"
              variant={acwrMethod === "rolling" ? "default" : "outline"}
              onClick={() => setAcwrMethod("rolling")}
            >
              {t("workload.availability.acwrMethodRolling")}
            </Button>
            <Button
              size="sm"
              variant={acwrMethod === "ewma" ? "default" : "outline"}
              onClick={() => setAcwrMethod("ewma")}
            >
              {t("workload.availability.acwrMethodEwma")}
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" /> {t("workload.availability.exportCsv")}
            </Button>
            <InfoHint
              title={t("workload.availability.acwrVsAdherenceHint.title")}
              what={t("workload.availability.acwrVsAdherenceHint.what")}
              how={t("workload.availability.acwrVsAdherenceHint.how", { method: acwrMethodLabel(acwrMethod) })}
              why={t("workload.availability.acwrVsAdherenceHint.why")}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {availabilityData?.map(player => (
              <Card key={player.playerId} className="bg-card/50 border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={player.avatarUrl || undefined} />
                      <AvatarFallback>{player.playerName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{player.playerName}</p>
                      <p className="text-sm text-muted-foreground">{player.position || t("workload.availability.noPosition")}</p>
                    </div>
                    {getStatusBadge(player.status)}
                  </div>

                  {/* Overall Score */}
                  {player.hasAnyData ? (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{t("workload.availability.overallScore")}</span>
                        <span className={`text-lg font-bold ${
                          (player.overallScore ?? 0) >= 80 ? 'text-green-400' :
                          (player.overallScore ?? 0) >= 60 ? 'text-yellow-400' :
                          (player.overallScore ?? 0) >= 40 ? 'text-orange-400' : 'text-red-400'
                        }`}>
                          {player.overallScore ?? 0}%
                        </span>
                      </div>
                      <Progress value={player.overallScore ?? 0} className={getScoreColor(player.overallScore ?? 0)} />
                    </div>
                  ) : (
                    <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-dashed border-border text-center">
                      <p className="text-sm text-muted-foreground font-medium">{t("workload.availability.noDataTitle")}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        <Trans
                          i18nKey="workload.availability.noDataDesc"
                          t={t}
                          components={[<span className="font-semibold" key="0" />]}
                        />
                      </p>
                    </div>
                  )}

                  {/* Sub-scores */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-blue-400" />
                      <span>
                        {t("workload.availability.acwrLabel", { value: "" })}{player.acwrScore !== null
                          ? <>{player.acwrScore}% <span className="text-muted-foreground">({player.acwr?.toFixed(2)} · {acwrMethod === "ewma" ? t("workload.availability.acwrMethodEwma") : t("workload.availability.acwrMethodRolling")})</span></>
                          : player.acwrInsufficient
                          ? <span className="italic text-muted-foreground">{t("workload.availability.acwrNotCalculated", { days: player.acwrHistoryDays, min: ACWR_MIN_HISTORY_DAYS })}</span>
                          : <span className="text-muted-foreground italic">—</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-pink-400" />
                      <span>{t("workload.availability.wellnessLabel", { value: "" })}{player.wellnessScore !== null ? `${player.wellnessScore}%` : <span className="text-muted-foreground italic">—</span>}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-400" />
                      <span>{t("workload.availability.injuryLabel", { value: "" })}{player.injuryScore === 100 ? t("workload.availability.injuryNone") : `${player.injuryScore}%`}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-green-400" />
                      <span className="text-muted-foreground">
                        {t("workload.availability.adherenceLabel", { value: "" })}{player.adherenceRatio !== null ? player.adherenceRatio.toFixed(2) : <span className="italic">—</span>}
                      </span>
                    </div>
                  </div>

                  {/* Risk Factors */}
                  {player.factors.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-1">{t("workload.availability.riskFactors")}</p>
                      <div className="flex flex-wrap gap-1">
                        {player.factors.map((factor, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">
                            {factor}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
