// Bowling — "Stats Spécifiques" with 3 sub-tabs (Technique / Tactique / Parties).
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Target, Wrench, Trophy, Filter, TrendingUp, Sparkles } from "lucide-react";
import { format, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, LineChart, Line, Legend } from "recharts";
import {
  aggregateTechnicalStats,
  aggregateTacticalStats,
  TECHNICAL_PARAMETERS,
  TACTICAL_ZONES,
  type ThrowRecord,
} from "@/lib/bowling/aggregatedSpecificStats";
import { TECHNICAL_EXERCISE_TYPES } from "@/lib/constants/bowlingTechnicalParameters";
import { TACTICAL_EXERCISE_TYPES } from "@/lib/constants/bowlingTacticalZones";
import { TECHNICAL_THEMES } from "@/components/bowling/simplified/types";

// Labels pour les exercise_type spécifiques au mode simplifié tactique
const SIMPLIFIED_TACTICAL_LABELS: Record<string, string> = {
  spare_poche: "Poche du strike",
  spare_pin_7: "Quille 7 (seule)",
  spare_pin_10: "Quille 10 (seule)",
  spare_general: "Strike / Spares composés",
};
const tacticalExerciseLabel = (key: string) =>
  SIMPLIFIED_TACTICAL_LABELS[key] ??
  TACTICAL_EXERCISE_TYPES.find((t) => t.value === key)?.label ??
  key;

const TECHNICAL_THEME_LABELS: Record<string, string> = Object.fromEntries(
  TECHNICAL_THEMES.map((t) => [t.value, t.label]),
);

interface Props {
  playerId: string;
  categoryId: string;
}

const ALL_EXERCISE_TYPES = [...TECHNICAL_EXERCISE_TYPES, ...TACTICAL_EXERCISE_TYPES];

export function BowlingSpecificStatsTabs({ playerId, categoryId }: Props) {
  const [subTab, setSubTab] = useState("technique");
  // Filters
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [patternId, setPatternId] = useState<string>("all");
  const [ballId, setBallId] = useState<string>("all");
  const [exerciseType, setExerciseType] = useState<string>("all");
  const [techParam, setTechParam] = useState<string>("all");
  const [zone, setZone] = useState<string>("all");

  // ─── Fetch throws + blocks ───
  const { data: rawThrows = [], isLoading } = useQuery({
    queryKey: ["bowling_specific_stats_throws", playerId, categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bowling_throw_results")
        .select(
          "id, block_id, athlete_id, throw_number, created_at, ball_arsenal_id, target_zone, actual_zone, target_arrow, foot_board, breakpoint_board, foot_delta, breakpoint_delta, speed_kmh, axis_success, speed_success, release_success, breakpoint_success, pocket_success, strike_success, spare_success, success_global, parameter_results, outcome_results, bowling_training_blocks!inner(id, block_type, pattern_id, config, objectives, category_id, created_at, training_sessions:session_id(session_date))",
        )
        .eq("athlete_id", playerId)
        .eq("bowling_training_blocks.category_id", categoryId);
      if (error) throw error;
      return (data || []).map((row: any): ThrowRecord => ({
        id: row.id,
        block_id: row.block_id,
        athlete_id: row.athlete_id,
        throw_number: row.throw_number,
        created_at: row.created_at,
        ball_arsenal_id: row.ball_arsenal_id,
        target_zone: row.target_zone,
        actual_zone: row.actual_zone,
        target_arrow: row.target_arrow,
        foot_board: row.foot_board,
        breakpoint_board: row.breakpoint_board,
        foot_delta: row.foot_delta,
        breakpoint_delta: row.breakpoint_delta,
        speed_kmh: row.speed_kmh,
        axis_success: row.axis_success,
        speed_success: row.speed_success,
        release_success: row.release_success,
        breakpoint_success: row.breakpoint_success,
        pocket_success: row.pocket_success,
        strike_success: row.strike_success,
        spare_success: row.spare_success,
        success_global: row.success_global,
        parameter_results: row.parameter_results,
        outcome_results: row.outcome_results,
        block: {
          id: row.bowling_training_blocks.id,
          block_type: row.bowling_training_blocks.block_type,
          pattern_id: row.bowling_training_blocks.pattern_id,
          config: row.bowling_training_blocks.config,
          objectives: row.bowling_training_blocks.objectives,
          session_date:
            row.bowling_training_blocks?.training_sessions?.session_date ||
            row.bowling_training_blocks?.created_at ||
            row.created_at,
        },
      }));
    },
  });

  // Arsenal for ball labels + filter
  const { data: arsenal = [] } = useQuery({
    queryKey: ["bowling_specific_arsenal", playerId, categoryId],
    queryFn: async () => {
      const { data } = await supabase
        .from("player_bowling_arsenal")
        .select("id, custom_ball_name, custom_ball_brand, catalog:bowling_ball_catalog(brand, model)")
        .eq("player_id", playerId);
      return data || [];
    },
  });

  // Oil patterns referenced by the blocks
  const patternIds = useMemo(() => Array.from(new Set(rawThrows.map((t) => t.block.pattern_id).filter(Boolean))) as string[], [rawThrows]);
  const { data: patterns = [] } = useQuery({
    queryKey: ["bowling_specific_patterns", patternIds.join(",")],
    queryFn: async () => {
      if (patternIds.length === 0) return [];
      const { data } = await supabase.from("bowling_oil_patterns").select("id, name").in("id", patternIds);
      return data || [];
    },
    enabled: patternIds.length > 0,
  });

  const ballNameMap = useMemo(() => {
    const m = new Map<string, string>();
    arsenal.forEach((b: any) => {
      const label = b.catalog
        ? `${b.catalog.brand} ${b.catalog.model}`
        : b.custom_ball_brand
          ? `${b.custom_ball_brand} ${b.custom_ball_name || ""}`.trim()
          : b.custom_ball_name || "Boule";
      m.set(b.id, label);
    });
    return m;
  }, [arsenal]);

  const patternNameMap = useMemo(() => {
    const m = new Map<string, string>();
    patterns.forEach((p: any) => m.set(p.id, p.name));
    return m;
  }, [patterns]);

  // ─── Apply filters ───
  const filteredThrows = useMemo(() => {
    return rawThrows.filter((r) => {
      const d = new Date(r.block.session_date);
      if (dateFrom && isBefore(d, startOfDay(dateFrom))) return false;
      if (dateTo && isAfter(d, endOfDay(dateTo))) return false;
      if (patternId !== "all" && r.block.pattern_id !== patternId) return false;
      if (ballId !== "all" && r.ball_arsenal_id !== ballId) return false;
      if (exerciseType !== "all") {
        const ex = (r.block.config as any)?.exercise_type;
        if (ex !== exerciseType) return false;
      }
      if (techParam !== "all") {
        const v = r.parameter_results?.[techParam];
        if (v === undefined || v === null) return false;
      }
      if (zone !== "all") {
        const z = r.actual_zone ?? r.target_zone;
        if (z !== zone) return false;
      }
      return true;
    });
  }, [rawThrows, dateFrom, dateTo, patternId, ballId, exerciseType, techParam, zone]);

  const techStats = useMemo(() => {
    const techThrows = filteredThrows.filter((r) => r.block.block_type === "technical" || Object.keys(r.parameter_results ?? {}).length > 0 || Object.keys(r.outcome_results ?? {}).length > 0);
    return aggregateTechnicalStats(techThrows);
  }, [filteredThrows]);

  const tacticalStats = useMemo(() => {
    const tactThrows = filteredThrows.filter((r) => r.block.block_type === "tactical" || r.target_zone || r.actual_zone || r.target_arrow || r.foot_board != null);
    return aggregateTacticalStats(tactThrows, ballNameMap, patternNameMap);
  }, [filteredThrows, ballNameMap, patternNameMap]);

  const resetFilters = () => {
    setDateFrom(undefined); setDateTo(undefined);
    setPatternId("all"); setBallId("all"); setExerciseType("all"); setTechParam("all"); setZone("all");
  };
  const hasActiveFilters = dateFrom || dateTo || patternId !== "all" || ballId !== "all" || exerciseType !== "all" || techParam !== "all" || zone !== "all";

  return (
    <div className="space-y-4">
      {/* ───── Filters bar ───── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtres
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={resetFilters}>Réinitialiser</Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-8 gap-2 text-xs", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="h-3 w-3" />
                  {dateFrom ? format(dateFrom, "dd MMM", { locale: fr }) : "Du"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={fr} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-8 gap-2 text-xs", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="h-3 w-3" />
                  {dateTo ? format(dateTo, "dd MMM", { locale: fr }) : "Au"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={fr} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>

            <Select value={patternId} onValueChange={setPatternId}>
              <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Pattern" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les patterns</SelectItem>
                {patterns.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={ballId} onValueChange={setBallId}>
              <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Boule" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les boules</SelectItem>
                {Array.from(ballNameMap.entries()).map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={exerciseType} onValueChange={setExerciseType}>
              <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Exercice" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les exercices</SelectItem>
                {ALL_EXERCISE_TYPES.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={techParam} onValueChange={setTechParam}>
              <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Paramètre" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les paramètres</SelectItem>
                {TECHNICAL_PARAMETERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Zone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les zones</SelectItem>
                {TACTICAL_ZONES.map((z) => <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ───── Sub-tabs ───── */}
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="technique" className="gap-1.5"><Wrench className="h-4 w-4" />Stats Techniques</TabsTrigger>
          <TabsTrigger value="tactique" className="gap-1.5"><Target className="h-4 w-4" />Stats Tactiques</TabsTrigger>
        </TabsList>

        {/* ─── Technique ─── */}
        <TabsContent value="technique" className="space-y-4 mt-4">
          {isLoading ? (
            <Card><CardContent className="py-6 text-sm text-muted-foreground text-center">Chargement…</CardContent></Card>
          ) : techStats.totalThrows === 0 ? (
            <EmptyState icon={<Wrench className="h-10 w-10" />} text="Aucun lancer technique enregistré sur la période." />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <Kpi label="Lancers" value={techStats.totalThrows} />
                <Kpi label="Réussite parfaite" value={`${techStats.perfectPct}%`} accent="text-emerald-600" />
                <Kpi label="Tech. complète" value={`${techStats.fullTechnicalPct}%`} accent="text-primary" />
                <Kpi label="Objectifs résultat" value={`${techStats.fullResultPct}%`} accent="text-amber-600" />
                <Kpi label="Score qualité moyen" value={`${techStats.averageQuality}%`} accent="text-cyan-600" />
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Réussite par paramètre / objectif</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {techStats.perCriterion.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucun critère renseigné.</p>
                  ) : techStats.perCriterion.map((c) => (
                    <div key={c.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2">
                          <Badge variant={c.category === "technical" ? "default" : "secondary"} className="text-[10px]">
                            {c.category === "technical" ? "Tech" : "Obj"}
                          </Badge>
                          {c.label}
                        </span>
                        <span className="font-semibold">{c.pct}% <span className="text-muted-foreground">({c.ok}/{c.total})</span></span>
                      </div>
                      <div className="h-2 bg-muted rounded overflow-hidden">
                        <div className={cn("h-full rounded transition-all", c.category === "technical" ? "bg-primary" : "bg-amber-500")} style={{ width: `${c.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Score qualité — répartition</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <QualityBucket label="100%" value={techStats.qualityBuckets.perfect} color="bg-emerald-500" />
                      <QualityBucket label="75-99%" value={techStats.qualityBuckets.high} color="bg-primary" />
                      <QualityBucket label="50-74%" value={techStats.qualityBuckets.mid} color="bg-amber-500" />
                      <QualityBucket label="<50%" value={techStats.qualityBuckets.low} color="bg-red-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Analyse automatique</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-muted-foreground">{techStats.insight || "Pas encore d'analyse disponible."}</p>
                  </CardContent>
                </Card>
              </div>

              {techStats.combinations.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Combinaisons de paramètres (top 12)</CardTitle></CardHeader>
                  <CardContent className="space-y-1.5">
                    {techStats.combinations.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-xs gap-2 p-2 rounded bg-muted/40">
                        <span className="flex-1 truncate">{c.labels.join(" + ")}</span>
                        <Badge variant="outline" className="text-[10px]">{c.occurrences} lancers</Badge>
                        <span className="font-bold text-primary w-12 text-right">{c.pct}%</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {techStats.timeline.length > 1 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" />Évolution temporelle</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={techStats.timeline} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                        <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="quality" stroke="hsl(var(--primary))" strokeWidth={2} dot name="Score qualité moyen" />
                        <Line type="monotone" dataKey="perfectPct" stroke="hsl(160 84% 39%)" strokeWidth={2} dot name="Réussite parfaite" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ─── Tactique ─── */}
        <TabsContent value="tactique" className="space-y-4 mt-4">
          {isLoading ? (
            <Card><CardContent className="py-6 text-sm text-muted-foreground text-center">Chargement…</CardContent></Card>
          ) : tacticalStats.totalThrows === 0 ? (
            <EmptyState icon={<Target className="h-10 w-10" />} text="Aucun lancer tactique enregistré sur la période." />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Kpi label="Lancers" value={tacticalStats.totalThrows} />
                <Kpi label="Pied sur cible (±1)" value={`${tacticalStats.movementEfficiency.footOnTargetPct}%`} accent="text-primary" />
                <Kpi label="Sortie sur cible (±1)" value={`${tacticalStats.movementEfficiency.breakpointOnTargetPct}%`} accent="text-cyan-600" />
                <Kpi label="Écart pied moyen" value={`${tacticalStats.movementEfficiency.footAvgDelta}`} />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <BucketCard title="Réussite par zone" stats={tacticalStats.byZone} />
                <BucketCard title="Réussite par flèche" stats={tacticalStats.byArrow} />
                <BucketCard title="Réussite par latte au pied" stats={tacticalStats.byFootBoard} />
                <BucketCard title="Réussite par point de sortie" stats={tacticalStats.byBreakpoint} />
                <BucketCard title="Réussite par pattern" stats={tacticalStats.byPattern} />
                <BucketCard title="Réussite par boule" stats={tacticalStats.byBall} />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-emerald-600" />Meilleure ligne de jeu</CardTitle></CardHeader>
                  <CardContent>
                    {tacticalStats.bestPlayLine ? (
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{tacticalStats.bestPlayLine.label}</p>
                        <p className="text-xs text-muted-foreground">{tacticalStats.bestPlayLine.count} lancers · {tacticalStats.bestPlayLine.pocketStrikePct}% poche+strike</p>
                      </div>
                    ) : <p className="text-xs text-muted-foreground italic">Pas assez de répétitions (min 3 lancers).</p>}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-600" />Meilleure combinaison tactique</CardTitle></CardHeader>
                  <CardContent>
                    {tacticalStats.bestCombination ? (
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{tacticalStats.bestCombination.label}</p>
                        <p className="text-xs text-muted-foreground">{tacticalStats.bestCombination.count} lancers · {tacticalStats.bestCombination.pocketStrikePct}% poche+strike</p>
                      </div>
                    ) : <p className="text-xs text-muted-foreground italic">Pas assez de répétitions (min 3 lancers).</p>}
                  </CardContent>
                </Card>
              </div>

              {tacticalStats.heatmap.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Heatmap des zones</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={Math.max(140, tacticalStats.heatmap.length * 26)}>
                      <BarChart data={tacticalStats.heatmap} layout="vertical" margin={{ top: 4, right: 30, left: 30, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                        <YAxis type="category" dataKey="short" tick={{ fontSize: 10 }} width={60} />
                        <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11 }}
                          formatter={(v: any, _n: any, item: any) => [`${v}% · ${item?.payload?.count} lancers`, "Poche+Strike"]}
                        />
                        <Bar dataKey="pocketStrikePct" radius={[0, 6, 6, 0]}>
                          {tacticalStats.heatmap.map((z, i) => {
                            const c = z.pocketStrikePct >= 50 ? "hsl(160 84% 39%)" : z.pocketStrikePct >= 25 ? "hsl(38 92% 50%)" : "hsl(0 70% 55%)";
                            return <Cell key={i} fill={c} />;
                          })}
                          <LabelList dataKey="pocketStrikePct" position="right" formatter={(v: any) => `${v}%`} fontSize={10} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ───────────────────── Helpers ─────────────────────

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <p className={cn("text-2xl font-bold", accent ?? "text-primary")}>{value}</p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <Card>
      <CardContent className="py-8 text-center text-muted-foreground">
        <div className="mx-auto mb-3 opacity-50 w-fit">{icon}</div>
        <p className="text-sm">{text}</p>
      </CardContent>
    </Card>
  );
}

function QualityBucket({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="p-2 rounded border">
      <div className={cn("h-1 rounded mb-2", color)} />
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function BucketCard({ title, stats }: { title: string; stats: { key: string; label: string; count: number; pocketStrikePct: number; pocketPct: number; strikePct: number }[] }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        {stats.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Aucune donnée.</p>
        ) : (
          <div className="space-y-1.5">
            {stats.slice(0, 8).map((s) => (
              <div key={s.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="truncate">{s.label}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px]">{s.count}</Badge>
                    <span className="font-semibold w-10 text-right">{s.pocketStrikePct}%</span>
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded overflow-hidden">
                  <div className="h-full bg-primary rounded transition-all" style={{ width: `${s.pocketStrikePct}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
