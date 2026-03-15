import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BarChart3, Target, Trophy, CalendarIcon, Circle } from "lucide-react";
import { format, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { SPARE_EXERCISE_TYPES } from "@/lib/constants/bowlingBallBrands";
import { BowlingFrameAnalysis } from "./BowlingFrameAnalysis";
import type { FrameData } from "@/components/athlete-portal/BowlingScoreSheet";

interface BowlingTrainingStatsProps {
  categoryId: string;
}

export function BowlingTrainingStats({ categoryId }: BowlingTrainingStatsProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("games");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedBallId, setSelectedBallId] = useState<string>("all");

  // Fetch training data
  const { data: trainingData, isLoading } = useQuery({
    queryKey: ["bowling_training_stats", categoryId],
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

          // Extract ball IDs used in this game
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

  // Fetch arsenal for the active player
  const activePlayerId = selectedPlayerId || (trainingData ? (() => {
    const map = new Map<string, string>();
    trainingData.games.forEach((g: any) => map.set(g.playerId, g.playerName));
    trainingData.spareExercises.forEach((ex: any) => {
      if (!map.has(ex.player_id)) {
        const p = ex.player;
        map.set(ex.player_id, p ? [p.first_name, p.name].filter(Boolean).join(" ") : "Athlète");
      }
    });
    return Array.from(map.keys())[0];
  })() : undefined);

  const { data: arsenal } = useQuery({
    queryKey: ["player_arsenal_stats", activePlayerId, categoryId],
    queryFn: async () => {
      if (!activePlayerId) return [];
      const { data } = await supabase
        .from("player_bowling_arsenal")
        .select("*, catalog:bowling_ball_catalog(brand, model)")
        .eq("player_id", activePlayerId)
        .eq("category_id", categoryId)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!activePlayerId,
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
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [trainingData]);

  const dateFilter = (dateStr: string) => {
    if (!dateFrom && !dateTo) return true;
    const d = new Date(dateStr);
    if (dateFrom && isBefore(d, startOfDay(dateFrom))) return false;
    if (dateTo && isAfter(d, endOfDay(dateTo))) return false;
    return true;
  };

  const filteredGames = useMemo(() => {
    if (!trainingData || !activePlayerId) return [];
    let result = trainingData.games
      .filter((g: any) => g.playerId === activePlayerId && dateFilter(g.matchDate));
    if (selectedBallId !== "all") {
      result = result.filter((g: any) => g.ballIds?.includes(selectedBallId));
    }
    return result;
  }, [trainingData, activePlayerId, dateFrom, dateTo, selectedBallId]);

  const filteredSpares = useMemo(() => {
    if (!trainingData || !activePlayerId) return [];
    let result = trainingData.spareExercises
      .filter((ex: any) => ex.player_id === activePlayerId && dateFilter(ex.session_date));
    if (selectedBallId !== "all") {
      result = result.filter((ex: any) => ex.ball_arsenal_id === selectedBallId);
    }
    return result;
  }, [trainingData, activePlayerId, dateFrom, dateTo, selectedBallId]);

  const spareStats = useMemo(() => {
    const byType: Record<string, { attempts: number; successes: number }> = {};
    for (const ex of filteredSpares) {
      if (!byType[ex.exercise_type]) byType[ex.exercise_type] = { attempts: 0, successes: 0 };
      byType[ex.exercise_type].attempts += ex.attempts;
      byType[ex.exercise_type].successes += ex.successes;
    }
    return byType;
  }, [filteredSpares]);

  // Spare stats grouped by ball
  const spareStatsByBall = useMemo(() => {
    if (!trainingData || !activePlayerId) return [];
    const sparesForPlayer = trainingData.spareExercises
      .filter((ex: any) => ex.player_id === activePlayerId && dateFilter(ex.session_date) && ex.ball_arsenal_id);
    
    const byBall: Record<string, { attempts: number; successes: number }> = {};
    for (const ex of sparesForPlayer) {
      const bid = ex.ball_arsenal_id;
      if (!byBall[bid]) byBall[bid] = { attempts: 0, successes: 0 };
      byBall[bid].attempts += ex.attempts;
      byBall[bid].successes += ex.successes;
    }
    return Object.entries(byBall).map(([ballId, stats]) => ({
      ballId,
      ...stats,
      rate: stats.attempts > 0 ? (stats.successes / stats.attempts) * 100 : 0,
    })).sort((a, b) => b.rate - a.rate);
  }, [trainingData, activePlayerId, dateFrom, dateTo]);

  // Game stats grouped by ball
  const gameStatsByBall = useMemo(() => {
    if (!trainingData || !activePlayerId) return [];
    const gamesForPlayer = trainingData.games
      .filter((g: any) => g.playerId === activePlayerId && dateFilter(g.matchDate));
    
    const byBall: Record<string, { scores: number[]; strikes: number; spares: number; games: number }> = {};
    for (const g of gamesForPlayer) {
      for (const bid of (g.ballIds || [])) {
        if (!byBall[bid]) byBall[bid] = { scores: [], strikes: 0, spares: 0, games: 0 };
        byBall[bid].scores.push(g.score);
        byBall[bid].strikes += g.strikes;
        byBall[bid].spares += g.spares;
        byBall[bid].games += 1;
      }
    }
    return Object.entries(byBall).map(([ballId, stats]) => ({
      ballId,
      games: stats.games,
      avgScore: stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length,
      high: Math.max(...stats.scores),
      totalStrikes: stats.strikes,
      totalSpares: stats.spares,
    })).sort((a, b) => b.avgScore - a.avgScore);
  }, [trainingData, activePlayerId, dateFrom, dateTo]);

  const totalSpareStats = useMemo(() => {
    let totalAttempts = 0;
    let totalSuccesses = 0;
    for (const s of Object.values(spareStats)) {
      totalAttempts += s.attempts;
      totalSuccesses += s.successes;
    }
    const rate = totalAttempts > 0 ? (totalSuccesses / totalAttempts) * 100 : 0;
    return { totalAttempts, totalSuccesses, rate };
  }, [spareStats]);

  const gameStats = useMemo(() => {
    if (filteredGames.length === 0) return null;
    const total = filteredGames.length;
    const avgScore = filteredGames.reduce((s: number, g: any) => s + g.score, 0) / total;
    const avgStrike = filteredGames.reduce((s: number, g: any) => s + g.strikePercentage, 0) / total;
    const avgSpare = filteredGames.reduce((s: number, g: any) => s + g.sparePercentage, 0) / total;
    const high = Math.max(...filteredGames.map((g: any) => g.score));
    return { total, avgScore, avgStrike, avgSpare, high };
  }, [filteredGames]);

  const getBallName = (ballId: string) => {
    const ball = arsenal?.find((b: any) => b.id === ballId);
    if (!ball) return "Boule inconnue";
    if (ball.catalog) return `${ball.catalog.brand} ${ball.catalog.model}`;
    if (ball.custom_ball_brand) return `${ball.custom_ball_brand} ${ball.custom_ball_name || ""}`.trim();
    return "Boule";
  };

  if (isLoading) return <p className="text-muted-foreground">Chargement...</p>;

  const hasGameData = !!gameStats;
  const hasSpareData = Object.keys(spareStats).length > 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {players.length > 1 && players.map(p => (
          <Button
            key={p.id}
            variant={activePlayerId === p.id ? "default" : "outline"}
            size="sm"
            onClick={() => { setSelectedPlayerId(p.id); setSelectedBallId("all"); }}
          >
            {p.name}
          </Button>
        ))}
      </div>

      {/* Date range + Ball filter */}
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

        {arsenal && arsenal.length > 0 && (
          <Select value={selectedBallId} onValueChange={setSelectedBallId}>
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue placeholder="Toutes les boules" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les boules</SelectItem>
              {arsenal.map((ball: any) => (
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
      {(hasGameData || hasSpareData) ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="games" className="gap-1.5">
              <Trophy className="h-4 w-4" />
              Stats Parties
            </TabsTrigger>
            <TabsTrigger value="specific" className="gap-1.5">
              <Target className="h-4 w-4" />
              Stats Spécifiques
            </TabsTrigger>
          </TabsList>

          {/* Tab: Stats Parties */}
          <TabsContent value="games" className="space-y-4 mt-4">
            {gameStats ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
                    <CardContent className="pt-3 pb-2 text-center">
                      <p className="text-2xl font-bold text-primary">{gameStats.total}</p>
                      <p className="text-[10px] text-muted-foreground">Parties</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
                    <CardContent className="pt-3 pb-2 text-center">
                      <p className="text-2xl font-bold text-primary">{gameStats.avgScore.toFixed(1)}</p>
                      <p className="text-[10px] text-muted-foreground">Moyenne</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
                    <CardContent className="pt-3 pb-2 text-center">
                      <p className="text-2xl font-bold text-primary">{gameStats.high}</p>
                      <p className="text-[10px] text-muted-foreground">High</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
                    <CardContent className="pt-3 pb-2 text-center">
                      <p className="text-2xl font-bold text-primary">{gameStats.avgStrike.toFixed(1)}%</p>
                      <p className="text-[10px] text-muted-foreground">Strike</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
                    <CardContent className="pt-3 pb-2 text-center">
                      <p className="text-2xl font-bold text-primary">{gameStats.avgSpare.toFixed(1)}%</p>
                      <p className="text-[10px] text-muted-foreground">Spare</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Per-ball breakdown for games */}
                {gameStatsByBall.length > 0 && selectedBallId === "all" && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Circle className="h-4 w-4 text-primary" />
                        Performance par boule
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {gameStatsByBall.map((bs) => (
                          <div key={bs.ballId} className="flex items-center justify-between p-3 rounded-lg border">
                            <div>
                              <p className="text-sm font-medium">{getBallName(bs.ballId)}</p>
                              <p className="text-xs text-muted-foreground">{bs.games} partie{bs.games > 1 ? "s" : ""}</p>
                            </div>
                            <div className="flex items-center gap-4 text-right">
                              <div>
                                <p className="text-lg font-bold text-primary">{bs.avgScore.toFixed(1)}</p>
                                <p className="text-[10px] text-muted-foreground">Moy.</p>
                              </div>
                              <div>
                                <p className="text-lg font-bold text-primary">{bs.high}</p>
                                <p className="text-[10px] text-muted-foreground">High</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {filteredGames.length > 0 && (
                  <BowlingFrameAnalysis games={filteredGames} />
                )}
              </>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Trophy className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Aucune partie d'entraînement enregistrée.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab: Stats Spécifiques */}
          <TabsContent value="specific" className="space-y-4 mt-4">
            {hasSpareData ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
                    <CardContent className="pt-3 pb-2 text-center">
                      <p className="text-2xl font-bold text-primary">{totalSpareStats.rate.toFixed(1)}%</p>
                      <p className="text-[10px] text-muted-foreground">Taux global</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
                    <CardContent className="pt-3 pb-2 text-center">
                      <p className="text-2xl font-bold text-primary">{totalSpareStats.totalSuccesses}/{totalSpareStats.totalAttempts}</p>
                      <p className="text-[10px] text-muted-foreground">Réussites</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
                    <CardContent className="pt-3 pb-2 text-center">
                      <p className="text-2xl font-bold text-primary">{Object.keys(spareStats).length}</p>
                      <p className="text-[10px] text-muted-foreground">Exercices</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Detail by type */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      Détail par exercice
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(spareStats).map(([type, stats]) => {
                        const label = SPARE_EXERCISE_TYPES.find(t => t.value === type)?.label || type;
                        const rate = stats.attempts > 0 ? (stats.successes / stats.attempts) * 100 : 0;
                        return (
                          <div key={type} className="p-3 rounded-lg border">
                            <div className="flex justify-between items-center mb-2">
                              <Badge variant="secondary">{label}</Badge>
                              <span className="text-lg font-bold text-primary">{rate.toFixed(1)}%</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {stats.successes}/{stats.attempts} réussites
                            </p>
                            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${rate}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Per-ball breakdown for spares */}
                {spareStatsByBall.length > 0 && selectedBallId === "all" && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Circle className="h-4 w-4 text-primary" />
                        Précision par boule
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {spareStatsByBall.map((bs) => (
                          <div key={bs.ballId} className="flex items-center justify-between p-3 rounded-lg border">
                            <div>
                              <p className="text-sm font-medium">{getBallName(bs.ballId)}</p>
                              <p className="text-xs text-muted-foreground">{bs.successes}/{bs.attempts} réussites</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-primary">{bs.rate.toFixed(1)}%</p>
                              <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${bs.rate}%` }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
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
