import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSeasonFilteredPlayerIds } from "@/hooks/use-season-filtered-players";
import { useSeasonRosterFilter } from "@/contexts/SeasonRosterFilterContext";
import { 
  DailyLoadData, 
  MetricType, 
  EWMAResult,
  LoadSummary,
  calculateEWMASeries, 
  calculateAWCR,
  calculateLoadSummary,
  transformToDailyLoadData,
  fillMissingDays,
  METRICS_CONFIG,
  getAvailableMetrics,
  getRiskLevel,
} from "@/lib/trainingLoadCalculations";


/**
 * Construit la série EWMA à partir des lignes brutes `awcr_tracking`.
 *
 * Les valeurs `acute_load` / `chronic_load` calculées en base sont volontairement
 * ignorées ici : elles sont calculées LIGNE PAR LIGNE, donc
 *  - plusieurs séances (ou plusieurs lignes) le même jour appliquent plusieurs fois
 *    le facteur de lissage sur la même journée,
 *  - les jours sans ligne ne décroissent pas du tout,
 * ce qui écrase l'EWMA aiguë et fait apparaître un "sous-entraînement" permanent.
 *
 * Ici on reconstruit une vraie série journalière (somme des charges par athlète et
 * par jour, jours de repos remplis à 0), on calcule l'EWMA 7j/28j par athlète, puis
 * on moyenne entre athlètes pour la vue équipe.
 */
function buildEWMAFromDbData(awcrData: any[], playerId?: string): EWMAResult[] {
  const entries = playerId
    ? awcrData.filter((d) => d.player_id === playerId)
    : awcrData;
  if (entries.length === 0) return [];

  const DAY = 24 * 60 * 60 * 1000;
  const LAMBDA_ACUTE = 2 / (7 + 1);
  const LAMBDA_CHRONIC = 2 / (28 + 1);

  // Somme des charges par athlète et par jour
  const perPlayer = new Map<string, Map<string, number>>();
  let minTs = Infinity;
  let maxTs = -Infinity;

  entries.forEach((entry) => {
    const date = String(entry.session_date).slice(0, 10);
    const ts = new Date(date).getTime();
    if (!Number.isFinite(ts)) return;
    minTs = Math.min(minTs, ts);
    maxTs = Math.max(maxTs, ts);
    const load =
      entry.training_load != null && Number.isFinite(Number(entry.training_load))
        ? Number(entry.training_load)
        : (Number(entry.rpe) || 0) * (Number(entry.duration_minutes) || 0);
    const pid = entry.player_id || "unknown";
    if (!perPlayer.has(pid)) perPlayer.set(pid, new Map());
    const days = perPlayer.get(pid)!;
    days.set(date, (days.get(date) || 0) + load);
  });

  if (!Number.isFinite(minTs) || !Number.isFinite(maxTs)) return [];

  // Calendrier continu (jours de repos inclus)
  const calendar: string[] = [];
  for (let t = minTs; t <= maxTs; t += DAY) {
    calendar.push(new Date(t).toISOString().slice(0, 10));
  }

  // Agrégats par jour, moyennés sur les athlètes présents dans la période
  const agg = new Map<string, { acute: number; chronic: number; raw: number }>();
  calendar.forEach((d) => agg.set(d, { acute: 0, chronic: 0, raw: 0 }));

  perPlayer.forEach((days) => {
    let acute = 0;
    let chronic = 0;
    calendar.forEach((date, i) => {
      const value = days.get(date) || 0;
      if (i === 0) {
        acute = value;
        chronic = value;
      } else {
        acute = LAMBDA_ACUTE * value + (1 - LAMBDA_ACUTE) * acute;
        chronic = LAMBDA_CHRONIC * value + (1 - LAMBDA_CHRONIC) * chronic;
      }
      const bucket = agg.get(date)!;
      bucket.acute += acute;
      bucket.chronic += chronic;
      bucket.raw += value;
    });
  });

  const n = Math.max(perPlayer.size, 1);

  return calendar.map((date) => {
    const bucket = agg.get(date)!;
    const acute = Math.round((bucket.acute / n) * 100) / 100;
    const chronic = Math.round((bucket.chronic / n) * 100) / 100;
    const ratio = chronic > 0 ? Math.round((acute / chronic) * 100) / 100 : 0;
    return {
      date,
      rawValue: Math.round((bucket.raw / n) * 100) / 100,
      acute,
      chronic,
      ratio,
      riskLevel: getRiskLevel(ratio),
    };
  });
}


interface UseTrainingLoadOptions {
  categoryId: string;
  playerId?: string;
  metric?: MetricType;
  periodDays?: number;
}

export function useTrainingLoad({ 
  categoryId, 
  playerId, 
  metric = "ewma_srpe",
  periodDays = 56 // 8 weeks by default
}: UseTrainingLoadOptions) {
  const { activeSeasonOnly, activeSeasonStart: ctxSeasonStart, activeSeasonEnd, isDateInActiveSeason } = useSeasonRosterFilter();
  const { allowedIds } = useSeasonFilteredPlayerIds(categoryId);
  const scopeKey = `${activeSeasonOnly ? "on" : "off"}:${activeSeasonEnd ?? "-"}`;

  
  // Fetch category sport type + club for season-scoped load reset
  const { data: category } = useQuery({
    queryKey: ["category-sport", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("rugby_type, club_id")
        .eq("id", categoryId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const sportType = category?.rugby_type || "XV";

  // Fetch active season start to reset training load when a new season begins.
  // History (injuries/tests/performances) is NOT filtered — only load aggregates.
  const { data: activeSeasonStart } = useQuery({
    queryKey: ["active-season-start", category?.club_id],
    queryFn: async () => {
      if (!category?.club_id) return null;
      const { data, error } = await supabase
        .from("seasons")
        .select("start_date")
        .eq("club_id", category.club_id)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data?.start_date || null;
    },
    enabled: !!category?.club_id,
  });

  // Returns the later of (today - periodDays) and the active season start.
  const getEffectiveStart = (days: number) => {
    const rolling = new Date();
    rolling.setDate(rolling.getDate() - days);
    const rollingStr = rolling.toISOString().split("T")[0];
    if (activeSeasonStart && activeSeasonStart > rollingStr) return activeSeasonStart;
    return rollingStr;
  };

  // Fetch AWCR/RPE data (sliding window preserved for EWMA accuracy)
  // For an individual player, training load is global per athlete: do NOT filter
  // by category_id, so multi-structure athletes show the same load in every
  // authorized structure. RLS still restricts access.
  const { data: awcrDataRaw, isLoading: awcrLoading } = useQuery({
    queryKey: ["training-load-awcr", categoryId, playerId, periodDays, activeSeasonStart, scopeKey],
    queryFn: async () => {
      let query = supabase
        .from("awcr_tracking")
        .select("*")
        .gte("session_date", getEffectiveStart(periodDays))
        .order("session_date", { ascending: true });

      if (playerId) {
        query = query.eq("player_id", playerId);
      } else {
        query = query.eq("category_id", categoryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: category !== undefined,
  });

  // Fetch HRV data
  const { data: hrvDataRaw, isLoading: hrvLoading } = useQuery({
    queryKey: ["training-load-hrv", categoryId, playerId, periodDays, activeSeasonStart, scopeKey],
    queryFn: async () => {
      let query = supabase
        .from("hrv_records")
        .select("*")
        .gte("record_date", getEffectiveStart(periodDays))
        .order("record_date", { ascending: true });

      if (playerId) {
        query = query.eq("player_id", playerId);
      } else {
        query = query.eq("category_id", categoryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: category !== undefined,
  });

  // Fetch GPS data
  const { data: gpsDataRaw, isLoading: gpsLoading } = useQuery({
    queryKey: ["training-load-gps", categoryId, playerId, periodDays, activeSeasonStart, scopeKey],
    queryFn: async () => {
      let query = supabase
        .from("gps_sessions")
        .select("*")
        .gte("session_date", getEffectiveStart(periodDays))
        .order("session_date", { ascending: true });

      if (playerId) {
        query = query.eq("player_id", playerId);
      } else {
        query = query.eq("category_id", categoryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: category !== undefined,
  });

  // Apply season scope:
  // - allowedIds restricts the roster (only when toggle ON)
  // - isDateInActiveSeason restricts displayed dates to [start, end]
  // EWMA chronic load still benefits from the 28d sliding window kept in the fetch.
  const awcrData = useMemo(
    () =>
      (awcrDataRaw || []).filter(
        (r: any) =>
          (!allowedIds || allowedIds.has(r.player_id)) &&
          isDateInActiveSeason(r.session_date)
      ),
    [awcrDataRaw, allowedIds, isDateInActiveSeason]
  );
  const hrvData = useMemo(
    () =>
      (hrvDataRaw || []).filter(
        (r: any) =>
          (!allowedIds || allowedIds.has(r.player_id)) &&
          isDateInActiveSeason(r.record_date)
      ),
    [hrvDataRaw, allowedIds, isDateInActiveSeason]
  );
  const gpsData = useMemo(
    () =>
      (gpsDataRaw || []).filter(
        (r: any) =>
          (!allowedIds || allowedIds.has(r.player_id)) &&
          isDateInActiveSeason(r.session_date)
      ),
    [gpsDataRaw, allowedIds, isDateInActiveSeason]
  );


  // Check if data exists
  const hasGpsData = (gpsData?.length || 0) > 0;
  const hasHrvData = (hrvData?.length || 0) > 0;
  const availableMetrics = getAvailableMetrics(sportType, hasGpsData);

  // Transform and calculate
  const dailyData: DailyLoadData[] = awcrData && gpsData 
    ? fillMissingDays(transformToDailyLoadData(awcrData, gpsData))
    : [];

  // Get metric configuration
  const metricConfig = METRICS_CONFIG[metric];
  const isEwma = metric.startsWith("ewma_");

  // For EWMA sRPE: use DB-computed values (acute_load, chronic_load, awcr)
  // which have full historical context from the compute_ewma_loads trigger.
  // Only fall back to frontend recalculation for non-sRPE metrics or AWCR mode.
  const chartData: EWMAResult[] = (() => {
    let baseData: EWMAResult[];
    if (isEwma && metric === "ewma_srpe" && awcrData && awcrData.length > 0) {
      baseData = buildEWMAFromDbData(awcrData, playerId);
    } else {
      baseData = isEwma
        ? calculateEWMASeries(dailyData, metricConfig.dataKey)
        : calculateAWCR(dailyData, metricConfig.dataKey);
    }

    // Merge HRV data into chart data by date
    if (hrvData && hrvData.length > 0) {
      const hrvByDate = new Map<string, { hrvMs: number | null; avgHr: number | null; maxHr: number | null; restingHr: number | null; count: number }>();
      
      hrvData.forEach((h: any) => {
        const date = h.record_date;
        const existing = hrvByDate.get(date);
        if (existing) {
          if (h.hrv_ms != null) existing.hrvMs = (existing.hrvMs || 0) + h.hrv_ms;
          if (h.avg_hr_bpm != null) existing.avgHr = (existing.avgHr || 0) + h.avg_hr_bpm;
          if (h.max_hr_bpm != null) existing.maxHr = Math.max(existing.maxHr || 0, h.max_hr_bpm);
          if (h.resting_hr_bpm != null) existing.restingHr = (existing.restingHr || 0) + h.resting_hr_bpm;
          existing.count++;
        } else {
          hrvByDate.set(date, {
            hrvMs: h.hrv_ms,
            avgHr: h.avg_hr_bpm,
            maxHr: h.max_hr_bpm,
            restingHr: h.resting_hr_bpm,
            count: 1,
          });
        }
      });

      baseData = baseData.map(d => {
        const hrv = hrvByDate.get(d.date);
        if (hrv) {
          const n = hrv.count;
          return {
            ...d,
            hrvMs: hrv.hrvMs != null ? Math.round((hrv.hrvMs / n) * 10) / 10 : null,
            avgHrBpm: hrv.avgHr != null ? Math.round(hrv.avgHr / n) : null,
            maxHrBpm: hrv.maxHr,
            restingHrBpm: hrv.restingHr != null ? Math.round(hrv.restingHr / n) : null,
          };
        }
        return d;
      });
    }

    return baseData;
  })();

  // Calculate summary from chart data (use last entry)
  const summary: LoadSummary | null = (() => {
    if (isEwma && metric === "ewma_srpe" && chartData.length > 0) {
      const latest = chartData[chartData.length - 1];
      const oneWeekAgo = chartData.length >= 7 ? chartData[chartData.length - 7] : chartData[0];
      const weeklyChange = oneWeekAgo.acute > 0 
        ? ((latest.acute - oneWeekAgo.acute) / oneWeekAgo.acute) * 100 
        : 0;
      let trend: "increasing" | "stable" | "decreasing" = "stable";
      if (weeklyChange > 10) trend = "increasing";
      else if (weeklyChange < -10) trend = "decreasing";
      return {
        currentLoad: latest.rawValue,
        ewmaAcute: latest.acute,
        ewmaChronic: latest.chronic,
        ewmaRatio: latest.ratio,
        weeklyChange: Math.round(weeklyChange * 10) / 10,
        riskLevel: latest.riskLevel,
        trend,
      };
    }
    return calculateLoadSummary(dailyData, metricConfig.dataKey);
  })();

  return {
    chartData,
    dailyData,
    summary,
    availableMetrics,
    metricConfig,
    sportType,
    hasGpsData,
    hasHrvData,
    isLoading: awcrLoading || gpsLoading || hrvLoading,
  };
}

/**
 * Hook for team-level training load comparison
 */
export function useTeamTrainingLoad({ 
  categoryId,
  metric = "ewma_srpe",
  periodDays = 28
}: {
  categoryId: string;
  metric?: MetricType;
  periodDays?: number;
}) {
  // Fetch club to get active season start (training load resets each season)
  const { data: categoryClub } = useQuery({
    queryKey: ["category-club-for-team-load", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("club_id")
        .eq("id", categoryId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: activeSeasonStart } = useQuery({
    queryKey: ["active-season-start", categoryClub?.club_id],
    queryFn: async () => {
      if (!categoryClub?.club_id) return null;
      const { data, error } = await supabase
        .from("seasons")
        .select("start_date")
        .eq("club_id", categoryClub.club_id)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data?.start_date || null;
    },
    enabled: !!categoryClub?.club_id,
  });

  const getEffectiveStart = (days: number) => {
    const rolling = new Date();
    rolling.setDate(rolling.getDate() - days);
    const rollingStr = rolling.toISOString().split("T")[0];
    if (activeSeasonStart && activeSeasonStart > rollingStr) return activeSeasonStart;
    return rollingStr;
  };

  // Season-filtered roster (null when filter OFF or no active season)
  const { allowedIds } = useSeasonFilteredPlayerIds(categoryId);

  // Fetch all players (intersect with season roster when the filter is ON)
  const { data: players } = useQuery({
    queryKey: ["players-for-load", categoryId, allowedIds ? Array.from(allowedIds).sort().join(",") : "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name, position, discipline")
        .eq("category_id", categoryId);
      if (error) throw error;
      return (data || []).filter((p) => !allowedIds || allowedIds.has(p.id));
    },
  });


  const { activeSeasonOnly: ctxOnly2, activeSeasonEnd: ctxEnd2, isDateInActiveSeason: ctxInSeason2 } = useSeasonRosterFilter();
  const teamScopeKey = `${ctxOnly2 ? "on" : "off"}:${ctxEnd2 ?? "-"}`;

  // Fetch all AWCR data (sliding window kept; season filter applied client-side)
  const { data: allAwcrDataRaw, isLoading } = useQuery({
    queryKey: ["team-awcr", categoryId, periodDays, activeSeasonStart, teamScopeKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("awcr_tracking")
        .select("*")
        .eq("category_id", categoryId)
        .gte("session_date", getEffectiveStart(periodDays))
        .order("session_date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: categoryClub !== undefined,
  });
  const allAwcrData = useMemo(
    () => (allAwcrDataRaw || []).filter((r: any) => ctxInSeason2(r.session_date)),
    [allAwcrDataRaw, ctxInSeason2]
  );

  // Fetch all GPS data
  const { data: allGpsDataRaw } = useQuery({
    queryKey: ["team-gps", categoryId, periodDays, activeSeasonStart, teamScopeKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gps_sessions")
        .select("*")
        .eq("category_id", categoryId)
        .gte("session_date", getEffectiveStart(periodDays))
        .order("session_date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: categoryClub !== undefined,
  });
  const allGpsData = useMemo(
    () => (allGpsDataRaw || []).filter((r: any) => ctxInSeason2(r.session_date)),
    [allGpsDataRaw, ctxInSeason2]
  );


  // Calculate per-player summaries
  const isEwmaSrpe = metric === "ewma_srpe";
  const playerSummaries = players?.map(player => {
    const playerAwcr = allAwcrData?.filter(d => d.player_id === player.id) || [];
    const playerGps = allGpsData?.filter(d => d.player_id === player.id) || [];

    let summary: LoadSummary | null = null;

    if (isEwmaSrpe && playerAwcr.length > 0) {
      // Use DB-computed EWMA values for accurate ratio
      const chartData = buildEWMAFromDbData(playerAwcr, player.id);
      if (chartData.length > 0) {
        const latest = chartData[chartData.length - 1];
        const oneWeekAgo = chartData.length >= 7 ? chartData[chartData.length - 7] : chartData[0];
        const weeklyChange = oneWeekAgo.acute > 0
          ? ((latest.acute - oneWeekAgo.acute) / oneWeekAgo.acute) * 100
          : 0;
        let trend: "increasing" | "stable" | "decreasing" = "stable";
        if (weeklyChange > 10) trend = "increasing";
        else if (weeklyChange < -10) trend = "decreasing";
        summary = {
          currentLoad: latest.rawValue,
          ewmaAcute: latest.acute,
          ewmaChronic: latest.chronic,
          ewmaRatio: latest.ratio,
          weeklyChange: Math.round(weeklyChange * 10) / 10,
          riskLevel: latest.riskLevel,
          trend,
        };
      }
    } else {
      const dailyData = fillMissingDays(transformToDailyLoadData(playerAwcr, playerGps));
      summary = calculateLoadSummary(dailyData, METRICS_CONFIG[metric].dataKey);
    }

    return {
      ...player,
      summary,
    };
  }) || [];

  // Calculate team average
  const validSummaries = playerSummaries.filter(p => p.summary !== null);
  const teamAverage = validSummaries.length > 0 ? {
    ewmaRatio: validSummaries.reduce((sum, p) => sum + (p.summary?.ewmaRatio || 0), 0) / validSummaries.length,
    ewmaAcute: validSummaries.reduce((sum, p) => sum + (p.summary?.ewmaAcute || 0), 0) / validSummaries.length,
    ewmaChronic: validSummaries.reduce((sum, p) => sum + (p.summary?.ewmaChronic || 0), 0) / validSummaries.length,
    currentLoad: validSummaries.reduce((sum, p) => sum + (p.summary?.currentLoad || 0), 0) / validSummaries.length,
    weeklyChange: validSummaries.reduce((sum, p) => sum + (p.summary?.weeklyChange || 0), 0) / validSummaries.length,
    trend: (() => {
      const avgChange = validSummaries.reduce((sum, p) => sum + (p.summary?.weeklyChange || 0), 0) / validSummaries.length;
      if (avgChange > 10) return "increasing" as const;
      if (avgChange < -10) return "decreasing" as const;
      return "stable" as const;
    })(),
  } : null;

  // Players at risk
  const playersAtRisk = playerSummaries.filter(p => 
    p.summary?.riskLevel === "danger" || p.summary?.riskLevel === "warning"
  );

  return {
    players: playerSummaries,
    teamAverage,
    playersAtRisk,
    isLoading,
  };
}
