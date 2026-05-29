import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BarChart3, Target, Trophy, CalendarIcon, Circle, Users, Download, FileSpreadsheet, Activity, Clock, Wrench } from "lucide-react";
import { format, isAfter, isBefore, startOfDay, endOfDay, startOfWeek, startOfMonth, startOfYear } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import { SPARE_EXERCISE_TYPES } from "@/lib/constants/bowlingBallBrands";
import { BowlingFrameAnalysis } from "./BowlingFrameAnalysis";
import { getExcelBranding, addBrandedHeader, styleDataHeaderRow, addZebraRows, addFooter, downloadWorkbook } from "@/lib/excelExport";
import { preparePdfWithSettings } from "@/lib/pdfExport";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";
import type { FrameData } from "@/components/athlete-portal/BowlingScoreSheet";

interface BowlingTrainingStatsProps {
  categoryId: string;
  playerId?: string;
}

export function BowlingTrainingStats({ categoryId, playerId }: BowlingTrainingStatsProps) {
  const [activeTab, setActiveTab] = useState("global");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedBallId, setSelectedBallId] = useState<string>("all");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(playerId || "all");
  const [globalPeriod, setGlobalPeriod] = useState<"day" | "week" | "month" | "year">("month");

  // Fetch training data
  const { data: trainingData, isLoading } = useQuery({
    queryKey: ["bowling_training_stats", categoryId, playerId || "all"],
    queryFn: async () => {
      const { data: matches } = await supabase
        .from("matches")
        .select("id, match_date")
        .eq("category_id", categoryId)
        .eq("event_type", "training")
        .order("match_date", { ascending: false });

      const games: any[] = [];

      if (matches && matches.length > 0) {
        const matchIds = matches.map(m => m.id);
        const matchMap = Object.fromEntries(matches.map(m => [m.id, m]));

        const { data: rounds } = await supabase
          .from("competition_rounds")
          .select("*, competition_round_stats(*), players(id, name, first_name)")
          .in("match_id", matchIds)
          .order("round_number");

        for (const round of rounds || []) {
          const match = matchMap[round.match_id];
          const player = round.players as any;
          const statData = ((round.competition_round_stats as any[])?.[0]?.stat_data as any) || {};
          const bowlingFrames = (statData.frames || statData.bowlingFrames) as FrameData[] | undefined;
          const score = (statData.totalScore ?? statData.gameScore) || parseInt(round.result || "0") || 0;
          const ballData = statData.ballData || null;

          const ballIds: string[] = [];
          if (ballData) {
            if (ballData.simpleBallId) ballIds.push(ballData.simpleBallId);
            if (ballData.frameBalls) {
              Object.values(ballData.frameBalls as Record<string, any>).forEach((fb: any) => {
                if (fb.ball1 && !ballIds.includes(fb.ball1)) ballIds.push(fb.ball1);
                if (fb.ball2 && !ballIds.includes(fb.ball2)) ballIds.push(fb.ball2);
              });
            }
          }

          if (score > 0 || bowlingFrames) {
            games.push({
              roundId: round.id,
              matchId: round.match_id,
              playerId: round.player_id,
              playerName: player ? [player.first_name, player.name].filter(Boolean).join(" ") : "Athlète",
              matchDate: match?.match_date || "",
              score,
              strikes: statData.strikes || 0,
              spares: statData.spares || 0,
              strikePercentage: statData.strikePercentage || 0,
              sparePercentage: statData.sparePercentage || 0,
              openFrames: statData.openFrames || 0,
              frames: bowlingFrames,
              ballIds,
            });
          }
        }
      }

      const { data: spareData } = await supabase
        .from("bowling_spare_training" as any)
        .select("*, player:players(name, first_name)")
        .eq("category_id", categoryId)
        .order("session_date", { ascending: false });

      return { games, spareExercises: (spareData as any[]) || [] };
    },
  });

  // Fetch new system training blocks (used for "Stats Globales" and to filter obsolete spare data)
  const { data: trainingBlocks = [] } = useQuery({
    queryKey: ["bowling_training_blocks_stats", categoryId, playerId || "all"],
    queryFn: async () => {
      let q = supabase
        .from("bowling_training_blocks")
        .select("id, athlete_id, block_type, duration_min, created_at, session_id, training_sessions:session_id(session_date)")
        .eq("category_id", categoryId);
      if (playerId) q = q.eq("athlete_id", playerId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((b: any) => ({
        ...b,
        session_date: b.training_sessions?.session_date || b.created_at,
      })) as Array<{ id: string; athlete_id: string | null; block_type: string; duration_min: number | null; created_at: string; session_id: string | null; session_date: string }>;
    },
  });


  // Set of athletes who have new-system bowling sessions (used to hide obsolete legacy data)
  const athletesWithNewBlocks = useMemo(() => {
    const s = new Set<string>();
    trainingBlocks.forEach((b) => { if (b.athlete_id) s.add(b.athlete_id); });
    return s;
  }, [trainingBlocks]);

  // Fetch all arsenals for all players
  const { data: allArsenals } = useQuery({
    queryKey: ["all_arsenals_stats", categoryId],
    queryFn: async () => {
      const { data } = await supabase
        .from("player_bowling_arsenal")
        .select("*, catalog:bowling_ball_catalog(brand, model)")
        .eq("category_id", categoryId)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const players = useMemo(() => {
    if (!trainingData) return [];
    const map = new Map<string, string>();
    trainingData.games.forEach((g: any) => map.set(g.playerId, g.playerName));
    trainingData.spareExercises.forEach((ex: any) => {
      if (!map.has(ex.player_id)) {
        const p = ex.player;
        map.set(ex.player_id, p ? [p.first_name, p.name].filter(Boolean).join(" ") : "Athlète");
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [trainingData]);

  const dateFilter = (dateStr: string) => {
    if (!dateFrom && !dateTo) return true;
    const d = new Date(dateStr);
    if (dateFrom && isBefore(d, startOfDay(dateFrom))) return false;
    if (dateTo && isAfter(d, endOfDay(dateTo))) return false;
    return true;
  };

  const getBallName = (ballId: string) => {
    const ball = allArsenals?.find((b: any) => b.id === ballId);
    if (!ball) return "Boule inconnue";
    if (ball.catalog) return `${ball.catalog.brand} ${ball.catalog.model}`;
    if (ball.custom_ball_brand) return `${ball.custom_ball_brand} ${ball.custom_ball_name || ""}`.trim();
    return "Boule";
  };

  const filteredPlayers = useMemo(() => {
    if (playerId) return players.filter(p => p.id === playerId);
    if (selectedPlayerId === "all") return players;
    return players.filter(p => p.id === selectedPlayerId);
  }, [players, selectedPlayerId, playerId]);

  // Compute per-player game stats
  const playerGameStats = useMemo(() => {
    if (!trainingData) return [];
    return filteredPlayers.map(player => {
      let games = trainingData.games.filter((g: any) => g.playerId === player.id && dateFilter(g.matchDate));
      if (selectedBallId !== "all") {
        games = games.filter((g: any) => g.ballIds?.includes(selectedBallId));
      }
      if (games.length === 0) return { player, stats: null, games: [] };
      const total = games.length;
      const avgScore = games.reduce((s: number, g: any) => s + g.score, 0) / total;
      const avgStrike = games.reduce((s: number, g: any) => s + g.strikePercentage, 0) / total;
      const avgSpare = games.reduce((s: number, g: any) => s + g.sparePercentage, 0) / total;
      const high = Math.max(...games.map((g: any) => g.score));
      return { player, stats: { total, avgScore, avgStrike, avgSpare, high }, games };
    }).filter(p => p.stats !== null);
  }, [trainingData, filteredPlayers, dateFrom, dateTo, selectedBallId]);

  // Compute per-player spare stats (legacy bowling_spare_training data).
  // Only displayed for athletes who also have new-system bowling_training_blocks,
  // otherwise the data is considered obsolete and hidden.
  const playerSpareStats = useMemo(() => {
    if (!trainingData) return [];
    return filteredPlayers.map(player => {
      if (!athletesWithNewBlocks.has(player.id)) return { player, byType: {}, total: null };
      let spares = trainingData.spareExercises.filter((ex: any) => ex.player_id === player.id && dateFilter(ex.session_date));
      if (selectedBallId !== "all") {
        spares = spares.filter((ex: any) => ex.ball_arsenal_id === selectedBallId);
      }
      if (spares.length === 0) return { player, byType: {}, total: null };
      const byType: Record<string, { attempts: number; successes: number }> = {};
      let totalAttempts = 0, totalSuccesses = 0;
      for (const ex of spares) {
        if (!byType[ex.exercise_type]) byType[ex.exercise_type] = { attempts: 0, successes: 0 };
        byType[ex.exercise_type].attempts += ex.attempts;
        byType[ex.exercise_type].successes += ex.successes;
        totalAttempts += ex.attempts;
        totalSuccesses += ex.successes;
      }
      const rate = totalAttempts > 0 ? (totalSuccesses / totalAttempts) * 100 : 0;
      return { player, byType, total: { totalAttempts, totalSuccesses, rate } };
    }).filter(p => p.total !== null);
  }, [trainingData, filteredPlayers, dateFrom, dateTo, selectedBallId, athletesWithNewBlocks]);

  // Compute global stats from new-system bowling_training_blocks
  const globalStats = useMemo(() => {
    const filtered = trainingBlocks.filter((b) => {
      if (!b.athlete_id) return false;
      if (selectedPlayerId !== "all" && !playerId && b.athlete_id !== selectedPlayerId) return false;
      if (playerId && b.athlete_id !== playerId) return false;
      if (!dateFilter(b.session_date)) return false;
      return true;
    });

    const sessionIds = new Set<string>();
    filtered.forEach((b) => {
      sessionIds.add(b.session_id || `${b.athlete_id}-${b.session_date.slice(0, 10)}`);
    });

    const minutesByTheme: Record<string, number> = { warmup: 0, technical: 0, tactical: 0, games: 0 };
    let totalMinutes = 0;
    filtered.forEach((b) => {
      const d = b.duration_min || 0;
      if (minutesByTheme[b.block_type] !== undefined) minutesByTheme[b.block_type] += d;
      totalMinutes += d;
    });

    // Time buckets
    const bucketKey = (iso: string) => {
      const d = new Date(iso);
      if (globalPeriod === "day") {
        const day = startOfDay(d);
        return { key: format(day, "yyyy-MM-dd"), label: format(day, "dd MMM", { locale: fr }), order: day.getTime() };
      }
      if (globalPeriod === "week") {
        const w = startOfWeek(d, { weekStartsOn: 1, locale: fr });
        return { key: format(w, "yyyy-'S'II", { locale: fr }), label: format(w, "'S'II", { locale: fr }), order: w.getTime() };
      }
      if (globalPeriod === "year") {
        const y = startOfYear(d);
        return { key: format(y, "yyyy"), label: format(y, "yyyy"), order: y.getTime() };
      }
      const m = startOfMonth(d);
      return { key: format(m, "yyyy-MM"), label: format(m, "MMM yy", { locale: fr }), order: m.getTime() };
    };

    const buckets = new Map<string, { label: string; order: number; warmup: number; technical: number; tactical: number; games: number; total: number }>();
    filtered.forEach((b) => {
      const { key, label, order } = bucketKey(b.session_date);
      const d = (b.duration_min || 0) / 60; // hours
      const cur = buckets.get(key) || { label, order, warmup: 0, technical: 0, tactical: 0, games: 0, total: 0 };
      if ((cur as any)[b.block_type] !== undefined) (cur as any)[b.block_type] += d;
      cur.total += d;
      buckets.set(key, cur);
    });

    const chartData = Array.from(buckets.values()).sort((a, b) => a.order - b.order).map((b) => {
      const total = b.warmup + b.technical + b.tactical + b.games;
      return {
        label: b.label,
        "Échauffement": Math.round(b.warmup * 10) / 10,
        "Technique": Math.round(b.technical * 10) / 10,
        "Tactique": Math.round(b.tactical * 10) / 10,
        "Parties": Math.round(b.games * 10) / 10,
        __total: total,
      };
    });

    return {
      sessionsCount: sessionIds.size,
      totalHours: totalMinutes / 60,
      hoursByTheme: {
        warmup: minutesByTheme.warmup / 60,
        technical: minutesByTheme.technical / 60,
        tactical: minutesByTheme.tactical / 60,
        games: minutesByTheme.games / 60,
      },
      chartData,
      blockCount: filtered.length,
    };
  }, [trainingBlocks, selectedPlayerId, playerId, dateFrom, dateTo, globalPeriod]);

  // Get unique balls used by all players for ball filter
  const availableBalls = useMemo(() => {
    if (!allArsenals) return [];
    return allArsenals;
  }, [allArsenals]);

  const handleExportExcel = async () => {
    try {
      const branding = await getExcelBranding(categoryId);
      const wb = new ExcelJS.Workbook();

      // Sheet 1: Game stats per player
      if (playerGameStats.length > 0) {
        const ws1 = wb.addWorksheet("Stats parties");
        ws1.columns = [
          { header: "Athlète", key: "name", width: 22 },
          { header: "Parties", key: "total", width: 10 },
          { header: "Moyenne", key: "avg", width: 12 },
          { header: "High", key: "high", width: 10 },
          { header: "% Strike", key: "strike", width: 12 },
          { header: "% Spare", key: "spare", width: 12 },
        ];
        const sr = addBrandedHeader(ws1, "Stats entraînement bowling - Parties", branding, [
          ["Période", `${dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Début"} → ${dateTo ? format(dateTo, "dd/MM/yyyy") : "Fin"}`],
        ]);
        styleDataHeaderRow(ws1, sr, 6, branding.headerColor);
        ws1.getRow(sr).values = ["Athlète", "Parties", "Moyenne", "High", "% Strike", "% Spare"];
        playerGameStats.forEach((p, i) => {
          const row = ws1.getRow(sr + 1 + i);
          row.values = [p.player.name, p.stats!.total, p.stats!.avgScore.toFixed(1), p.stats!.high, `${p.stats!.avgStrike.toFixed(1)}%`, `${p.stats!.avgSpare.toFixed(1)}%`];
        });
        addZebraRows(ws1, sr + 1, sr + playerGameStats.length, 6);
        addFooter(ws1, sr + playerGameStats.length + 1, 6, branding.footerText);
      }

      // Sheet 2: Spare training per player
      if (playerSpareStats.length > 0) {
        const ws2 = wb.addWorksheet("Stats spécifiques");
        const exerciseTypes = [...new Set(playerSpareStats.flatMap(p => Object.keys(p.byType)))];
        ws2.columns = [
          { header: "Athlète", key: "name", width: 22 },
          { header: "Taux global", key: "global", width: 14 },
          ...exerciseTypes.map(t => ({ header: SPARE_EXERCISE_TYPES.find(e => e.value === t)?.label || t, key: t, width: 16 })),
        ];
        const sr = addBrandedHeader(ws2, "Stats entraînement bowling - Exercices", branding);
        styleDataHeaderRow(ws2, sr, 2 + exerciseTypes.length, branding.headerColor);
        ws2.getRow(sr).values = ["Athlète", "Taux global", ...exerciseTypes.map(t => SPARE_EXERCISE_TYPES.find(e => e.value === t)?.label || t)];
        playerSpareStats.forEach((p, i) => {
          const row = ws2.getRow(sr + 1 + i);
          row.getCell(1).value = p.player.name;
          row.getCell(2).value = `${p.total!.rate.toFixed(1)}%`;
          exerciseTypes.forEach((t, j) => {
            const d = p.byType[t];
            row.getCell(3 + j).value = d ? `${(d.attempts > 0 ? (d.successes / d.attempts) * 100 : 0).toFixed(1)}%` : "-";
          });
        });
        addZebraRows(ws2, sr + 1, sr + playerSpareStats.length, 2 + exerciseTypes.length);
      }

      await downloadWorkbook(wb, `stats-entrainement-bowling-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast.success("Export Excel téléchargé !");
    } catch (e) {
      toast.error("Erreur lors de l'export Excel");
    }
  };

  const handleExportPdf = async () => {
    try {
      const { settings, clubName, categoryName, seasonName } = await preparePdfWithSettings(categoryId);
      const doc = new jsPDF({ orientation: "landscape" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      // Header
      if (settings?.header_color) {
        const hc = settings.header_color.replace("#", "");
        doc.setFillColor(parseInt(hc.substring(0, 2), 16), parseInt(hc.substring(2, 4), 16), parseInt(hc.substring(4, 6), 16));
      } else {
        doc.setFillColor(34, 67, 120);
      }
      doc.rect(0, 0, pageW, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text("Stats entraînement bowling", 14, 12);
      doc.setFontSize(10);
      doc.text(`${clubName || ""} • ${categoryName || ""} • ${seasonName || ""}`, 14, 20);
      doc.text(format(new Date(), "dd/MM/yyyy"), pageW - 14, 20, { align: "right" });

      let y = 36;

      // Game stats
      if (playerGameStats.length > 0) {
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Stats Parties d'entraînement", 14, y);
        y += 6;

        const cols = [14, 80, 115, 145, 175, 210];
        const headers = ["Athlète", "Parties", "Moyenne", "High", "% Strike", "% Spare"];
        doc.setFillColor(241, 245, 249);
        doc.rect(14, y, pageW - 28, 7, "F");
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        headers.forEach((h, i) => doc.text(h, cols[i], y + 5));
        y += 9;
        doc.setFont("helvetica", "normal");

        playerGameStats.forEach(p => {
          if (y > pageH - 15) { doc.addPage(); y = 15; }
          doc.setTextColor(30, 41, 59);
          doc.text(p.player.name.substring(0, 25), cols[0], y + 4);
          doc.text(String(p.stats!.total), cols[1], y + 4);
          doc.text(p.stats!.avgScore.toFixed(1), cols[2], y + 4);
          doc.text(String(p.stats!.high), cols[3], y + 4);
          doc.text(`${p.stats!.avgStrike.toFixed(1)}%`, cols[4], y + 4);
          doc.text(`${p.stats!.avgSpare.toFixed(1)}%`, cols[5], y + 4);
          y += 7;
        });
        y += 8;
      }

      // Spare stats
      if (playerSpareStats.length > 0) {
        if (y > pageH - 50) { doc.addPage(); y = 15; }
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Stats Exercices spécifiques", 14, y);
        y += 6;

        playerSpareStats.forEach(p => {
          if (y > pageH - 30) { doc.addPage(); y = 15; }
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 41, 59);
          doc.text(`${p.player.name} — Global: ${p.total!.rate.toFixed(1)}%`, 14, y);
          y += 6;
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          Object.entries(p.byType).forEach(([type, stats]) => {
            if (y > pageH - 15) { doc.addPage(); y = 15; }
            const label = SPARE_EXERCISE_TYPES.find(e => e.value === type)?.label || type;
            const rate = stats.attempts > 0 ? (stats.successes / stats.attempts) * 100 : 0;
            doc.text(`${label}: ${stats.successes}/${stats.attempts} (${rate.toFixed(1)}%)`, 20, y);
            y += 6;
          });
          y += 4;
        });
      }

      doc.save(`stats-entrainement-bowling-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("Export PDF téléchargé !");
    } catch (e) {
      toast.error("Erreur lors de l'export PDF");
    }
  };

  if (isLoading) return <p className="text-muted-foreground">Chargement...</p>;

  const hasGameData = playerGameStats.length > 0;
  const hasSpareData = playerSpareStats.length > 0;
  const hasGlobalData = globalStats.blockCount > 0;
  const THEME_COLORS = { warmup: "hsl(43 96% 56%)", technical: "hsl(160 84% 39%)", tactical: "hsl(217 91% 60%)", games: "hsl(38 92% 50%)" };

  return (
    <div className="space-y-4">
      {/* Player + Date range + Ball filter */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          {!playerId && players.length > 0 && (
            <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue placeholder="Tous les athlètes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les athlètes</SelectItem>
                {players.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3 w-3" />
                      {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {(hasGameData || hasSpareData || hasGlobalData) && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} className="gap-1">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("gap-1.5 h-8", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Début"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={setDateFrom}
              locale={fr}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("gap-1.5 h-8", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateTo ? format(dateTo, "dd/MM/yyyy") : "Fin"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={setDateTo}
              locale={fr}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
            Réinitialiser
          </Button>
        )}

        {availableBalls.length > 0 && (
          <Select value={selectedBallId} onValueChange={setSelectedBallId}>
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue placeholder="Toutes les boules" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les boules</SelectItem>
              {availableBalls.map((ball: any) => (
                <SelectItem key={ball.id} value={ball.id}>
                  <span className="flex items-center gap-1.5">
                    <Circle className="h-2 w-2 fill-primary text-primary" />
                    {ball.catalog ? `${ball.catalog.brand} ${ball.catalog.model}` : ball.custom_ball_brand ? `${ball.custom_ball_brand} ${ball.custom_ball_name || ""}`.trim() : "Boule"}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Sub-menu tabs */}
      {(hasGameData || hasSpareData || hasGlobalData) ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="global" className="gap-1.5">
              <Activity className="h-4 w-4" />
              Stats globales
            </TabsTrigger>
            <TabsTrigger value="games" className="gap-1.5">
              <Trophy className="h-4 w-4" />
              Stats Parties
            </TabsTrigger>
            <TabsTrigger value="specific" className="gap-1.5">
              <Target className="h-4 w-4" />
              Stats Spécifiques
            </TabsTrigger>
          </TabsList>

          {/* Tab: Stats Globales - new system aggregation */}
          <TabsContent value="global" className="space-y-4 mt-4">
            {hasGlobalData ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-primary">{globalStats.sessionsCount}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Entraînements</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-primary">{globalStats.totalHours.toFixed(1)}h</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Volume total</p>
                    </CardContent>
                  </Card>
                  <Card style={{ borderColor: THEME_COLORS.technical }}>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold" style={{ color: THEME_COLORS.technical }}>{globalStats.hoursByTheme.technical.toFixed(1)}h</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1 justify-center"><Wrench className="h-3 w-3" />Technique</p>
                    </CardContent>
                  </Card>
                  <Card style={{ borderColor: THEME_COLORS.tactical }}>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold" style={{ color: THEME_COLORS.tactical }}>{globalStats.hoursByTheme.tactical.toFixed(1)}h</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1 justify-center"><Target className="h-3 w-3" />Tactique</p>
                    </CardContent>
                  </Card>
                  <Card style={{ borderColor: THEME_COLORS.games }}>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold" style={{ color: THEME_COLORS.games }}>{globalStats.hoursByTheme.games.toFixed(1)}h</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1 justify-center"><Circle className="h-3 w-3" />Parties</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Volume d'entraînement (heures) par thématique
                    </CardTitle>
                    <ToggleGroup type="single" value={globalPeriod} onValueChange={(v) => v && setGlobalPeriod(v as any)} size="sm">
                      <ToggleGroupItem value="day" className="text-xs h-7 px-2">Jour</ToggleGroupItem>
                      <ToggleGroupItem value="week" className="text-xs h-7 px-2">Semaine</ToggleGroupItem>
                      <ToggleGroupItem value="month" className="text-xs h-7 px-2">Mois</ToggleGroupItem>
                      <ToggleGroupItem value="year" className="text-xs h-7 px-2">Année</ToggleGroupItem>
                    </ToggleGroup>
                  </CardHeader>
                  <CardContent>
                    {globalStats.chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={globalStats.chartData} barCategoryGap="25%" barGap={2} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={32} unit="h" />
                          <Tooltip
                            cursor={{ fill: "hsl(var(--muted)/0.4)" }}
                            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11, boxShadow: "0 8px 24px -8px hsl(var(--foreground)/0.25)" }}
                            formatter={(v: any, name: any, item: any) => {
                              const total = item?.payload?.__total || 0;
                              const pct = total > 0 ? Math.round(((v as number) / total) * 100) : 0;
                              return [`${v}h · ${pct}%`, name];
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="circle" iconSize={8} />
                          {(["Échauffement", "Technique", "Tactique", "Parties"] as const).map((k) => {
                            const color = k === "Échauffement" ? THEME_COLORS.warmup : k === "Technique" ? THEME_COLORS.technical : k === "Tactique" ? THEME_COLORS.tactical : THEME_COLORS.games;
                            return (
                              <Bar key={k} dataKey={k} fill={color} radius={[4, 4, 0, 0]} maxBarSize={22}>
                                <LabelList
                                  dataKey={k}
                                  position="top"
                                  content={(props: any) => {
                                    const { x, y, width, value, index } = props;
                                    if (!value || value <= 0) return null;
                                    const total = globalStats.chartData[index]?.__total || 0;
                                    const pct = total > 0 ? Math.round(((value as number) / total) * 100) : 0;
                                    return (
                                      <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={9} fontWeight={600} fill={color}>
                                        {value}h·{pct}%
                                      </text>
                                    );
                                  }}
                                />
                              </Bar>
                            );
                          })}
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée sur cette période.</p>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Activity className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Aucun entraînement bowling enregistré.</p>
                  <p className="text-xs mt-1">Les statistiques globales apparaîtront dès que des séances seront planifiées et complétées.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>



          {/* Tab: Stats Parties - grouped by athlete */}
          <TabsContent value="games" className="space-y-4 mt-4">
            {hasGameData ? (
              <div className="space-y-6">
                {playerGameStats.map(({ player, stats, games }) => (
                  <Card key={player.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        {player.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-2 text-center">
                          <p className="text-xl font-bold text-primary">{stats!.total}</p>
                          <p className="text-[10px] text-muted-foreground">Parties</p>
                        </div>
                        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-2 text-center">
                          <p className="text-xl font-bold text-primary">{stats!.avgScore.toFixed(1)}</p>
                          <p className="text-[10px] text-muted-foreground">Moyenne</p>
                        </div>
                        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-2 text-center">
                          <p className="text-xl font-bold text-primary">{stats!.high}</p>
                          <p className="text-[10px] text-muted-foreground">High</p>
                        </div>
                        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-2 text-center">
                          <p className="text-xl font-bold text-primary">{stats!.avgStrike.toFixed(1)}%</p>
                          <p className="text-[10px] text-muted-foreground">Strike</p>
                        </div>
                        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-2 text-center">
                          <p className="text-xl font-bold text-primary">{stats!.avgSpare.toFixed(1)}%</p>
                          <p className="text-[10px] text-muted-foreground">Spare</p>
                        </div>
                      </div>
                      {games.length > 0 && (
                        <BowlingFrameAnalysis games={games} />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Trophy className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Aucune partie d'entraînement enregistrée.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab: Stats Spécifiques - grouped by athlete */}
          <TabsContent value="specific" className="space-y-4 mt-4">
            {hasSpareData ? (
              <div className="space-y-6">
                {playerSpareStats.map(({ player, byType, total }) => (
                  <Card key={player.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        {player.name}
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {total!.rate.toFixed(1)}% global
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-2 text-center">
                          <p className="text-xl font-bold text-primary">{total!.rate.toFixed(1)}%</p>
                          <p className="text-[10px] text-muted-foreground">Taux global</p>
                        </div>
                        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-2 text-center">
                          <p className="text-xl font-bold text-primary">{total!.totalSuccesses}/{total!.totalAttempts}</p>
                          <p className="text-[10px] text-muted-foreground">Réussites</p>
                        </div>
                        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-2 text-center">
                          <p className="text-xl font-bold text-primary">{Object.keys(byType).length}</p>
                          <p className="text-[10px] text-muted-foreground">Exercices</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.entries(byType).map(([type, stats]) => {
                          const label = SPARE_EXERCISE_TYPES.find(t => t.value === type)?.label || type;
                          const rate = stats.attempts > 0 ? (stats.successes / stats.attempts) * 100 : 0;
                          return (
                            <div key={type} className="p-3 rounded-lg border">
                              <div className="flex justify-between items-center mb-1.5">
                                <Badge variant="secondary" className="text-xs">{label}</Badge>
                                <span className="text-base font-bold text-primary">{rate.toFixed(1)}%</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {stats.successes}/{stats.attempts} réussites
                              </p>
                              <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${rate}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Target className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Aucun exercice de précision enregistré.</p>
                  <p className="text-xs mt-1">Quille 5 · Quille 7 · Quille 10 · Spares</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Aucune donnée d'entraînement bowling pour cette période.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
