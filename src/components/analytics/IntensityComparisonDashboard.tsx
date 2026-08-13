import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ComposedChart,
  Line,
  ReferenceLine
} from "recharts";
import { Target, Users, AlertTriangle, TrendingUp, TrendingDown, Minus, Calculator, Info } from "lucide-react";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { calculateWeightedRpe, checkTeamRpeAlert, type SessionBlock } from "@/lib/weightedRpeCalculations";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSeasonRosterFilter } from "@/contexts/SeasonRosterFilterContext";
import { useSeasonFilteredPlayerIds } from "@/hooks/use-season-filtered-players";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { generateCsv, downloadCsv } from "@/lib/csv";
import { toast } from "sonner";

interface IntensityComparisonDashboardProps {
  categoryId: string;
}

export function IntensityComparisonDashboard({ categoryId }: IntensityComparisonDashboardProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string>("all");
  const [selectedPosition, setSelectedPosition] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("30");
  const [dateMode, setDateMode] = useState<"preset" | "custom">("preset");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [selectedSession, setSelectedSession] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchParams] = useSearchParams();
  const urlSessionId = searchParams.get("session");
  const urlSessionDate = searchParams.get("sessionDate");

  // Arrivée depuis une notification « Bilan RPE » : cadrer sur la séance concernée
  useEffect(() => {
    if (!urlSessionId) return;
    if (urlSessionDate) {
      setDateMode("custom");
      setCustomFrom(urlSessionDate);
      setCustomTo(urlSessionDate);
    }
    setSelectedSession(urlSessionId);
  }, [urlSessionId, urlSessionDate]);
  const { activeSeasonOnly, activeSeasonId, activeSeasonStart, activeSeasonEnd, isDateInActiveSeason } = useSeasonRosterFilter();
  const { allowedIds } = useSeasonFilteredPlayerIds(categoryId);
  const scopeKey = activeSeasonOnly && activeSeasonId ? `season:${activeSeasonId}` : "all";
  const allowedIdsKey = allowedIds ? Array.from(allowedIds).sort().join(",") : "all";

  const useCustom = dateMode === "custom" && !!customFrom;
  const rangeFrom = useCustom
    ? customFrom
    : subDays(new Date(), parseInt(dateRange)).toISOString().split("T")[0];
  const rangeTo = useCustom && customTo ? customTo : null;
  const rangeKey = `${rangeFrom}|${rangeTo || ""}`;


  // Fetch players
  const { data: players } = useQuery({
    queryKey: ["players-intensity", categoryId, scopeKey],
    queryFn: async () => {
      let query = supabase
        .from("players")
        .select("id, name, first_name, position, season_id")
        .eq("category_id", categoryId)
        .order("name");

      if (activeSeasonOnly && activeSeasonId) {
        query = query.eq("season_id", activeSeasonId).not("season_id", "is", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data?.map(p => ({ ...p, fullName: [p.first_name, p.name].filter(Boolean).join(" ") }));
    },
  });

  // Fetch sessions with planned intensity
  const { data: sessions } = useQuery({
    queryKey: ["sessions-intensity", categoryId, rangeKey, scopeKey, activeSeasonStart, activeSeasonEnd],
    queryFn: async () => {
      const fromDate = rangeFrom;
      let query = supabase
        .from("training_sessions")
        .select("id, session_date, training_type, intensity, notes")
        .eq("category_id", categoryId)
        .gte("session_date", activeSeasonOnly && activeSeasonStart && activeSeasonStart > fromDate ? activeSeasonStart : fromDate);

      const upper = activeSeasonOnly && activeSeasonEnd
        ? (rangeTo && rangeTo < activeSeasonEnd ? rangeTo : activeSeasonEnd)
        : rangeTo;
      if (upper) query = query.lte("session_date", upper);

      const { data, error } = await query.order("session_date");
      if (error) throw error;
      return (data || []).filter((session) => isDateInActiveSeason(session.session_date));
    },
  });

  // Fetch session blocks for weighted RPE calculation
  const { data: sessionBlocks } = useQuery({
    queryKey: ["session-blocks-intensity", categoryId, rangeKey, scopeKey, sessions?.map(s => s.id).join(",")],
    queryFn: async () => {
      if (!sessions || sessions.length === 0) return [];
      const sessionIds = sessions.map(s => s.id);
      const { data, error } = await supabase
        .from("training_session_blocks")
        .select("*")
        .in("training_session_id", sessionIds)
        .order("block_order");
      if (error) throw error;
      return data;
    },
    enabled: !!sessions && sessions.length > 0,
  });

  // Fetch AWCR data (actual RPE)
  const { data: awcrData } = useQuery({
    queryKey: ["awcr-intensity", categoryId, rangeKey, scopeKey, allowedIdsKey, activeSeasonStart, activeSeasonEnd],
    queryFn: async () => {
      const fromDate = rangeFrom;
      if (allowedIds && allowedIds.size === 0) return [];

      let query = supabase
        .from("awcr_tracking")
        .select("player_id, session_date, rpe, training_session_id, training_load")
        .eq("category_id", categoryId)
        .gte("session_date", activeSeasonOnly && activeSeasonStart && activeSeasonStart > fromDate ? activeSeasonStart : fromDate);

      const upper = activeSeasonOnly && activeSeasonEnd
        ? (rangeTo && rangeTo < activeSeasonEnd ? rangeTo : activeSeasonEnd)
        : rangeTo;
      if (upper) query = query.lte("session_date", upper);

      if (allowedIds) {
        query = query.in("player_id", Array.from(allowedIds));
      }

      const { data, error } = await query.order("session_date");
      if (error) throw error;
      return (data || []).filter((entry) => {
        if (!isDateInActiveSeason(entry.session_date)) return false;
        if (!allowedIds) return true;
        return allowedIds.has(entry.player_id);
      });
    },
  });


  // Get unique positions
  const positions = useMemo(() => {
    if (!players) return [];
    const posSet = new Set(players.map(p => p.position).filter(Boolean));
    return Array.from(posSet).sort();
  }, [players]);

  // Filter players by position
  const filteredPlayers = useMemo(() => {
    if (!players) return [];
    if (selectedPosition === "all") return players;
    return players.filter(p => p.position === selectedPosition);
  }, [players, selectedPosition]);

  useEffect(() => {
    if (selectedPlayer !== "all" && !filteredPlayers.some((p) => p.id === selectedPlayer)) {
      setSelectedPlayer("all");
    }
  }, [filteredPlayers, selectedPlayer]);

  // Group session blocks by session ID
  const blocksBySession = useMemo(() => {
    if (!sessionBlocks) return new Map<string, typeof sessionBlocks>();
    const map = new Map<string, typeof sessionBlocks>();
    sessionBlocks.forEach(block => {
      const existing = map.get(block.training_session_id) || [];
      existing.push(block);
      map.set(block.training_session_id, existing);
    });
    return map;
  }, [sessionBlocks]);

  // Options de séances (entraînements) de la période
  const sessionOptions = useMemo(() => {
    if (!sessions) return [];
    return [...sessions].sort((a, b) => b.session_date.localeCompare(a.session_date));
  }, [sessions]);

  useEffect(() => {
    if (sessionOptions.length > 0 && selectedSession !== "all" && !sessionOptions.some((s) => s.id === selectedSession)) {
      setSelectedSession("all");
    }
  }, [sessionOptions, selectedSession]);

  // Séances retenues après filtre "entraînement"
  const scopedSessions = useMemo(() => {
    if (!sessions) return sessions;
    if (selectedSession === "all") return sessions;
    return sessions.filter((s) => s.id === selectedSession);
  }, [sessions, selectedSession]);


  // Calculate comparison data with weighted RPE
  const comparisonData = useMemo(() => {
    if (!scopedSessions || !awcrData || !players) return [];

    const playersToAnalyze = selectedPlayer === "all" 
      ? filteredPlayers 
      : filteredPlayers.filter(p => p.id === selectedPlayer);

    // Group by session
    const sessionMap = new Map<string, {
      date: string;
      planned: number;
      weightedPlanned: number;
      hasBlocks: boolean;
      actual: number[];
      sessionType: string;
    }>();

    scopedSessions.forEach(session => {
      // Calculate weighted RPE from blocks if available
      const blocks = blocksBySession.get(session.id) || [];
      const weightedResult = calculateWeightedRpe(blocks as SessionBlock[]);
      
      // Use weighted RPE if available, otherwise fall back to session intensity
      const effectivePlanned = weightedResult.hasValidData 
        ? weightedResult.weightedRpe 
        : session.intensity || 0;

      if (effectivePlanned > 0 || session.intensity) {
        sessionMap.set(session.id, {
          date: session.session_date,
          planned: session.intensity || 0,
          weightedPlanned: effectivePlanned,
          hasBlocks: weightedResult.hasValidData,
          actual: [],
          sessionType: session.training_type,
        });
      }
    });

    // Add actual RPE values
    awcrData.forEach(awcr => {
      if (awcr.training_session_id && sessionMap.has(awcr.training_session_id)) {
        const playerMatch = playersToAnalyze.find(p => p.id === awcr.player_id);
        if (playerMatch) {
          sessionMap.get(awcr.training_session_id)!.actual.push(awcr.rpe);
        }
      }
    });

    // Convert to chart data
    return Array.from(sessionMap.entries())
      .filter(([_, data]) => data.actual.length > 0)
      .map(([id, data]) => {
        const avgActual = data.actual.reduce((a, b) => a + b, 0) / data.actual.length;
        const diff = avgActual - data.weightedPlanned;
        return {
          id,
          date: format(new Date(data.date), "dd/MM", { locale: fr }),
          fullDate: data.date,
          planned: data.weightedPlanned, // Use weighted value for display
          originalPlanned: data.planned,
          hasBlocks: data.hasBlocks,
          actual: parseFloat(avgActual.toFixed(1)),
          diff: parseFloat(diff.toFixed(1)),
          sessionType: data.sessionType,
          playerCount: data.actual.length,
        };
      })
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  }, [scopedSessions, awcrData, players, selectedPlayer, filteredPlayers, blocksBySession]);

  // Calculate per-player stats with weighted RPE
  const playerStats = useMemo(() => {
    if (!scopedSessions || !awcrData || !players) return [];

    const playersToAnalyze = selectedPosition === "all" 
      ? players 
      : players.filter(p => p.position === selectedPosition);

    return playersToAnalyze.map(player => {
      const playerAwcr = awcrData.filter(a => a.player_id === player.id);
      
      let totalDiff = 0;
      let count = 0;
      
      playerAwcr.forEach(awcr => {
        if (awcr.training_session_id) {
          const session = scopedSessions.find(s => s.id === awcr.training_session_id);
          if (session) {
            // Calculate weighted RPE for this session
            const blocks = blocksBySession.get(session.id) || [];
            const weightedResult = calculateWeightedRpe(blocks as SessionBlock[]);
            const effectivePlanned = weightedResult.hasValidData 
              ? weightedResult.weightedRpe 
              : session.intensity || 0;

            if (effectivePlanned > 0) {
              totalDiff += awcr.rpe - effectivePlanned;
              count++;
            }
          }
        }
      });

      const avgDiff = count > 0 ? totalDiff / count : 0;
      
      return {
        id: player.id,
        name: player.fullName,
        position: player.position,
        avgDiff: parseFloat(avgDiff.toFixed(1)),
        sessionsCount: count,
        // Vigilance dès ±1.5, alerte à ±2
        status: avgDiff >= 1.5 ? "over" : avgDiff <= -1.5 ? "under" : "optimal",
        severity: Math.abs(avgDiff) >= 2 ? "alert" : Math.abs(avgDiff) >= 1.5 ? "watch" : "none",
      };
    }).filter(p => p.sessionsCount > 0)
      .sort((a, b) => Math.abs(b.avgDiff) - Math.abs(a.avgDiff));
  }, [scopedSessions, awcrData, players, selectedPosition, blocksBySession]);

  const displayedPlayerStats = useMemo(
    () => (statusFilter === "all" ? playerStats : playerStats.filter((p) => p.status === statusFilter)),
    [playerStats, statusFilter]
  );

  // Détail ligne à ligne (athlète × séance) pour l'export CSV / Excel
  const detailRows = useMemo(() => {
    if (!scopedSessions || !awcrData || !players) return [];
    const playerMap = new Map(players.map((p) => [p.id, p]));
    // Seuils d'alerte : vigilance à ±1.5, alerte à ±2
    const statusOf = (diff: number) => {
      if (diff >= 2) return "Sur-entraînement (alerte)";
      if (diff >= 1.5) return "Sur-entraînement (vigilance)";
      if (diff <= -2) return "Sous-entraînement (alerte)";
      if (diff <= -1.5) return "Sous-entraînement (vigilance)";
      return "Optimal";
    };
    const alertOf = (diff: number) => {
      const abs = Math.abs(diff);
      if (abs >= 2) return "Alerte (±2)";
      if (abs >= 1.5) return "Vigilance (±1.5)";
      return "—";
    };

    return awcrData
      .filter((a) => a.training_session_id && scopedSessions.some((s) => s.id === a.training_session_id))
      .filter((a) => {
        const p = playerMap.get(a.player_id);
        if (!p) return false;
        if (selectedPosition !== "all" && p.position !== selectedPosition) return false;
        if (selectedPlayer !== "all" && p.id !== selectedPlayer) return false;
        return true;
      })
      .map((a) => {
        const session = scopedSessions.find((s) => s.id === a.training_session_id)!;
        const blocks = blocksBySession.get(session.id) || [];
        const weighted = calculateWeightedRpe(blocks as SessionBlock[]);
        const planned = weighted.hasValidData ? weighted.weightedRpe : session.intensity || 0;
        const diff = a.rpe - planned;
        const p = playerMap.get(a.player_id)!;
        // Thématique : types/thèmes des blocs (musculation, rugby, ...) sinon type de séance
        const themes = Array.from(
          new Set(
            (blocks as any[])
              .flatMap((b) => [b.training_type, b.theme])
              .filter((v): v is string => !!v && v.trim() !== "")
          )
        );
        const theme = themes.length > 0 ? themes.join(" + ") : session.training_type || "Séance";
        return {
          date: session.session_date,
          sessionType: session.training_type || "Séance",
          theme,
          name: p.fullName,
          position: p.position || "—",
          planned: Number(planned.toFixed(1)),
          actual: a.rpe,
          diff: Number(diff.toFixed(1)),
          load: a.training_load ?? "",
          status: statusOf(diff),
          alert: alertOf(diff),
        };
      })
      .filter((r) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "over") return r.diff >= 1.5;
        if (statusFilter === "under") return r.diff <= -1.5;
        return r.diff > -1.5 && r.diff < 1.5;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  }, [scopedSessions, awcrData, players, blocksBySession, selectedPlayer, selectedPosition, statusFilter]);

  const handleExportCsv = () => {
    if (detailRows.length === 0) {
      toast.error("Aucune donnée RPE à exporter pour ces filtres");
      return;
    }
    const headers = [
      "Date",
      "Séance",
      "Thématique",
      "Athlète",
      "Poste",
      "RPE prévu (staff)",
      "RPE réel (athlète)",
      "Écart",
      "Alerte",
      "Charge (UA)",
      "Statut",
    ];
    const rows = detailRows.map((r) => [
      format(new Date(r.date), "dd/MM/yyyy", { locale: fr }),
      r.sessionType,
      r.theme,
      r.name,
      r.position,
      String(r.planned).replace(".", ","),
      String(r.actual).replace(".", ","),
      String(r.diff).replace(".", ","),
      r.alert,
      r.load,
      r.status,
    ]);
    downloadCsv(
      `rpe-prevu-reel-${rangeFrom}_${rangeTo || new Date().toISOString().split("T")[0]}.csv`,
      generateCsv(headers, rows),
    );
  };

  // Export de la synthèse par séance sur la période sélectionnée
  const handleExportSessionsCsv = () => {
    if (comparisonData.length === 0) {
      toast.error("Aucune séance à exporter sur cette période");
      return;
    }
    const headers = [
      "Date",
      "RPE prévu (staff)",
      "RPE réel (athlètes)",
      "Écart",
      "Nb athlètes",
    ];
    const rows = comparisonData.map((d: any) => [
      d.fullDate || d.date,
      String(Number(d.planned).toFixed(1)).replace(".", ","),
      String(Number(d.actual).toFixed(1)).replace(".", ","),
      String(Number(d.diff).toFixed(1)).replace(".", ","),
      d.playerCount ?? "",
    ]);
    downloadCsv(
      `rpe-par-seance-${rangeFrom}_${rangeTo || new Date().toISOString().split("T")[0]}.csv`,
      generateCsv(headers, rows),
    );
  };



  // Check for team-wide RPE alert (>5 athletes with +2 gap)
  const teamAlert = useMemo(() => {
    const gaps = playerStats.map(p => ({
      playerId: p.id,
      playerName: p.name,
      gap: p.avgDiff,
    }));
    return checkTeamRpeAlert(gaps, 5, 2);
  }, [playerStats]);

  // Summary stats
  const summaryStats = useMemo(() => {
    if (comparisonData.length === 0) return null;

    const avgPlanned = comparisonData.reduce((a, b) => a + b.planned, 0) / comparisonData.length;
    const avgActual = comparisonData.reduce((a, b) => a + b.actual, 0) / comparisonData.length;
    const overCount = playerStats.filter(p => p.status === "over").length;
    const underCount = playerStats.filter(p => p.status === "under").length;

    return {
      avgPlanned: avgPlanned.toFixed(1),
      avgActual: avgActual.toFixed(1),
      avgDiff: (avgActual - avgPlanned).toFixed(1),
      overCount,
      underCount,
      optimalCount: playerStats.length - overCount - underCount,
    };
  }, [comparisonData, playerStats]);

  const getStatusBadge = (status: string, severity?: string) => {
    const suffix = severity === "watch" ? " (vigilance)" : "";
    switch (status) {
      case "over":
        return (
          <Badge className={severity === "watch" ? "bg-orange-500 text-white" : "bg-red-500 text-white"}>
            Surcharge{suffix}
          </Badge>
        );
      case "under":
        return (
          <Badge className={severity === "watch" ? "bg-amber-400 text-black" : "bg-yellow-500 text-white"}>
            Sous-charge{suffix}
          </Badge>
        );
      default:
        return <Badge className="bg-green-500 text-white">Optimal</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "over":
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case "under":
        return <TrendingDown className="h-4 w-4 text-yellow-500" />;
      default:
        return <Minus className="h-4 w-4 text-green-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Team Alert Banner */}
      {teamAlert.hasAlert && (
        <Card className="border-red-500/50 bg-red-500/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-600 dark:text-red-400">
                Alerte : Écart significatif détecté
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {teamAlert.message}
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {teamAlert.affectedAthletes.slice(0, 5).map(a => (
                  <Badge key={a.playerId} variant="destructive" className="text-xs">
                    {a.playerName} (+{a.gap.toFixed(1)})
                  </Badge>
                ))}
                {teamAlert.affectedAthletes.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{teamAlert.affectedAthletes.length - 5} autres
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Intensité Prévue vs Subie
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger>
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    L'intensité prévue est calculée comme une <strong>moyenne pondérée</strong> basée sur la durée et l'intensité de chaque bloc thématique de la séance.
                  </p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Période</Label>
              <Select
                value={dateMode === "custom" ? "custom" : dateRange}
                onValueChange={(v) => {
                  if (v === "custom") setDateMode("custom");
                  else { setDateMode("preset"); setDateRange(v); }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Aujourd'hui</SelectItem>
                  <SelectItem value="1">Hier</SelectItem>
                  <SelectItem value="7">7 derniers jours</SelectItem>
                  <SelectItem value="14">14 derniers jours</SelectItem>
                  <SelectItem value="30">30 derniers jours</SelectItem>
                  <SelectItem value="60">60 derniers jours</SelectItem>
                  <SelectItem value="90">90 derniers jours</SelectItem>
                  <SelectItem value="custom">Période personnalisée…</SelectItem>
                </SelectContent>
              </Select>
              {dateMode === "custom" && (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-9"
                  />
                  <span className="text-xs text-muted-foreground">au</span>
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-9"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Entraînement</Label>
              <Select value={selectedSession} onValueChange={setSelectedSession}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les entraînements" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les entraînements</SelectItem>
                  {sessionOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {format(new Date(s.session_date), "dd/MM/yyyy", { locale: fr })} · {s.training_type || "Séance"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Statut athlète</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="over">Hors cible · sur-entraînement</SelectItem>
                  <SelectItem value="under">Hors cible · sous-entraînement</SelectItem>
                  <SelectItem value="optimal">Optimal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Poste</Label>
              <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les postes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les postes</SelectItem>
                  {positions.map(pos => (
                    <SelectItem key={pos} value={pos || "unknown"}>{pos || "Non défini"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Athlète</Label>
              <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les athlètes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les athlètes</SelectItem>
                  {filteredPlayers.map(player => (
                    <SelectItem key={player.id} value={player.id}>{player.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summaryStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Intensité moyenne prévue</p>
            <p className="text-2xl font-bold">{summaryStats.avgPlanned}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Intensité moyenne réelle</p>
            <p className="text-2xl font-bold">{summaryStats.avgActual}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Écart moyen</p>
            <p className={cn(
              "text-2xl font-bold",
              parseFloat(summaryStats.avgDiff) > 0 ? "text-red-500" : 
              parseFloat(summaryStats.avgDiff) < 0 ? "text-yellow-500" : "text-green-500"
            )}>
              {parseFloat(summaryStats.avgDiff) > 0 ? "+" : ""}{summaryStats.avgDiff}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Athlètes hors cible</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">
                {summaryStats.overCount + summaryStats.underCount}
              </p>
              {(summaryStats.overCount + summaryStats.underCount) > 0 && (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Chart */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Comparaison par séance</CardTitle>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportSessionsCsv}>
              <Download className="h-4 w-4" />
              Export CSV (période)
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {comparisonData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Aucune donnée disponible pour cette période</p>
              <p className="text-sm">Assurez-vous que les séances ont une intensité prévue et des RPE enregistrés</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  domain={[0, 10]} 
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-popover border rounded-lg p-3 shadow-lg">
                          <p className="font-medium">{data.fullDate}</p>
                          <p className="text-sm">
                            Prévu: <span className="font-bold text-blue-500">{data.planned.toFixed(1)}</span>
                            {data.hasBlocks && (
                              <span className="text-xs text-muted-foreground ml-1">(pondéré)</span>
                            )}
                          </p>
                          <p className="text-sm">Réel: <span className="font-bold text-green-500">{data.actual}</span></p>
                          <p className="text-sm">Écart: <span className={cn(
                            "font-bold",
                            data.diff > 0 ? "text-red-500" : data.diff < 0 ? "text-yellow-500" : "text-green-500"
                          )}>{data.diff > 0 ? "+" : ""}{data.diff.toFixed(1)}</span></p>
                          <p className="text-xs text-muted-foreground mt-1">{data.playerCount} athlète(s)</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <ReferenceLine y={5} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
                <Bar dataKey="planned" fill="hsl(var(--primary))" name="Intensité prévue" opacity={0.7} />
                <Bar dataKey="actual" fill="hsl(142, 71%, 45%)" name="Intensité réelle" opacity={0.9} />
                <Line 
                  type="monotone" 
                  dataKey="diff" 
                  stroke="hsl(var(--destructive))" 
                  name="Écart"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--destructive))" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Player Details */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Détail par athlète
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleExportCsv}
            >
              <Download className="h-4 w-4" />
              Export CSV / Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {displayedPlayerStats.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">Aucune donnée</p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {displayedPlayerStats.map(player => (
                  <div 
                    key={player.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      player.status === "over" && "border-red-500/30 bg-red-500/5",
                      player.status === "under" && "border-yellow-500/30 bg-yellow-500/5",
                      player.status === "optimal" && "border-green-500/30 bg-green-500/5"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(player.status)}
                      <div>
                        <p className="font-medium">{player.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {player.position || "—"} • {player.sessionsCount} séance(s)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={cn(
                          "font-bold",
                          player.avgDiff > 0 ? "text-red-500" : 
                          player.avgDiff < 0 ? "text-yellow-500" : "text-green-500"
                        )}>
                          {player.avgDiff > 0 ? "+" : ""}{player.avgDiff}
                        </p>
                        <p className="text-xs text-muted-foreground">écart moyen</p>
                      </div>
                      {getStatusBadge(player.status, player.severity)}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
