import { useMemo, useState } from "react";
import {
  useMatchEventsAnalytics,
  useCategoryPlayers,
  type MatchRow,
  type PlayerLite,
} from "@/hooks/analytics/useTeamSportsAnalytics";
import { computeMatchAnalytics, tackleRatio } from "@/lib/analytics/team-sports/eventAggregator";
import type { AnalyticsPeriod } from "@/lib/analytics/team-sports/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PeriodToggle } from "../shared/PeriodToggle";
import { PlayerIdentityBadges } from "../shared/PlayerIdentityBadges";
import {
  Trophy,
  Shield,
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  Sparkles,
  AlertTriangle,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  Legend,
  CartesianGrid,
} from "recharts";

interface Props {
  match: MatchRow;
  categoryId: string;
}

const fullName = (p: PlayerLite) =>
  [p.first_name, p.name].filter(Boolean).join(" ").trim() || "Joueur";

type StatKey =
  | "playTimeMinutes"
  | "tries"
  | "passes"
  | "carries"
  | "meters"
  | "offloads"
  | "tackles"
  | "missedTackles"
  | "tackleEff"
  | "turnovers"
  | "cards"
  | "score";

interface Column {
  key: StatKey;
  label: string;
  short: string;
  group: "activity" | "off" | "def" | "disc" | "score";
  /** lower is better */
  invert?: boolean;
  format?: (v: number) => string;
}

const COLUMNS: Column[] = [
  { key: "playTimeMinutes", label: "Temps de jeu", short: "Min", group: "activity", format: (v) => `${v}'` },
  { key: "tries", label: "Essais", short: "Ess", group: "off" },
  { key: "passes", label: "Passes", short: "Pas", group: "off" },
  { key: "carries", label: "Courses", short: "Cou", group: "off" },
  { key: "meters", label: "Mètres gagnés", short: "Mèt", group: "off" },
  { key: "offloads", label: "Offloads", short: "Off", group: "off" },
  { key: "tackles", label: "Plaquages", short: "Plq", group: "def" },
  { key: "missedTackles", label: "Plq. manqués", short: "Plq✗", group: "def", invert: true },
  { key: "tackleEff", label: "% Efficacité", short: "Eff%", group: "def", format: (v) => `${v}%` },
  { key: "turnovers", label: "Turnovers", short: "Tur", group: "def" },
  { key: "cards", label: "Cartons", short: "Crt", group: "disc", invert: true },
  { key: "score", label: "Score perf.", short: "Perf", group: "score" },
];

interface Row {
  player: PlayerLite;
  values: Record<StatKey, number>;
}

const POSITION_WEIGHTS: Record<string, Partial<Record<StatKey, number>>> = {
  default: { tries: 3, meters: 0.05, passes: 0.3, carries: 0.4, offloads: 1, tackles: 1.2, tackleEff: 0.4, turnovers: 2, missedTackles: -1.5, cards: -3 },
};

function computeScore(values: Record<StatKey, number>, position?: string | null): number {
  const w = POSITION_WEIGHTS[position || "default"] || POSITION_WEIGHTS.default;
  let s = 0;
  for (const [k, weight] of Object.entries(w)) {
    s += (values[k as StatKey] || 0) * (weight || 0);
  }
  // normalise softly to 0–100
  const norm = Math.max(0, Math.min(100, Math.round(50 + s)));
  return norm;
}

function heatClass(value: number, col: Column, allValues: number[]): string {
  if (allValues.length === 0) return "";
  const max = Math.max(...allValues);
  const min = Math.min(...allValues);
  if (max === min) return "";
  const ratio = (value - min) / (max - min);
  const score = col.invert ? 1 - ratio : ratio;
  if (score >= 0.75) return "text-emerald-600 dark:text-emerald-400 font-semibold";
  if (score >= 0.4) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

export function PlayerStatsTab({ match, categoryId }: Props) {
  const [period, setPeriod] = useState<AnalyticsPeriod>("all");
  const [view, setView] = useState<"table" | "compare" | "radar">("table");
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<string>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<StatKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: events = [] } = useMatchEventsAnalytics(match.id);
  const { data: players = [] } = useCategoryPlayers(categoryId);
  const analytics = useMemo(() => computeMatchAnalytics(events, period), [events, period]);

  const involved = useMemo(() => {
    const ids = new Set(events.map((e) => e.player_id).filter(Boolean) as string[]);
    return players.filter((p) => ids.has(p.id));
  }, [events, players]);

  const positions = useMemo(() => {
    const set = new Set<string>();
    involved.forEach((p) => p.position && set.add(p.position));
    return Array.from(set).sort();
  }, [involved]);

  const rows: Row[] = useMemo(() => {
    return involved
      .map((player) => {
        const s = analytics.players[player.id];
        if (!s) return null;
        const values: Record<StatKey, number> = {
          playTimeMinutes: s.playTimeMinutes,
          tries: s.tries,
          passes: s.passes,
          carries: s.carries,
          meters: s.meters,
          offloads: s.offloads,
          tackles: s.tackles,
          missedTackles: s.missedTackles,
          tackleEff: tackleRatio(s),
          turnovers: s.turnovers,
          cards: s.yellowCards + s.redCards,
          score: 0,
        };
        values.score = computeScore(values, player.position);
        return { player, values };
      })
      .filter(Boolean) as Row[];
  }, [involved, analytics]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (posFilter !== "all" && r.player.position !== posFilter) return false;
      if (search && !fullName(r.player).toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, posFilter, search]);

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      const av = a.values[sortKey];
      const bv = b.values[sortKey];
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return copy;
  }, [filteredRows, sortKey, sortDir]);

  const teamAverages = useMemo(() => {
    if (rows.length === 0) return null;
    const avg: Record<StatKey, number> = { ...rows[0].values };
    COLUMNS.forEach((c) => {
      avg[c.key] = Math.round((rows.reduce((s, r) => s + r.values[c.key], 0) / rows.length) * 10) / 10;
    });
    return avg;
  }, [rows]);

  const insights = useMemo(() => {
    if (rows.length === 0) return null;
    const top = [...rows].sort((a, b) => b.values.score - a.values.score).slice(0, 3);
    const bestDef = [...rows].sort((a, b) => (b.values.tackles + b.values.turnovers) - (a.values.tackles + a.values.turnovers))[0];
    const bestOff = [...rows].sort((a, b) => (b.values.tries * 5 + b.values.meters * 0.05 + b.values.offloads) - (a.values.tries * 5 + a.values.meters * 0.05 + a.values.offloads))[0];
    const mostActive = [...rows].sort((a, b) => (b.values.playTimeMinutes + b.values.passes + b.values.carries) - (a.values.playTimeMinutes + a.values.passes + a.values.carries))[0];
    const struggling = [...rows].sort((a, b) => a.values.score - b.values.score)[0];
    return { top, bestDef, bestOff, mostActive, struggling };
  }, [rows]);

  const toggleSort = (k: StatKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((sel) =>
      sel.includes(id) ? sel.filter((s) => s !== id) : sel.length >= 5 ? sel : [...sel, id]
    );
  };

  const drawerPlayer = drawerId ? rows.find((r) => r.player.id === drawerId) : null;
  const selectedRows = rows.filter((r) => selected.includes(r.player.id));

  if (involved.length === 0) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-10 text-center text-muted-foreground">
          Aucun joueur n'a d'événement dans ce match.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* HEADER STICKY */}
      <div className="sticky top-0 z-10 -mx-2 px-2 py-2 bg-background/95 backdrop-blur border-b">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Statistiques par joueur</h2>
            <Badge variant="outline" className="text-[10px]">{rows.length} joueurs</Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <PeriodToggle value={period} onChange={setPeriod} />
            <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as any)} size="sm">
              <ToggleGroupItem value="table" className="text-xs">Tableau</ToggleGroupItem>
              <ToggleGroupItem value="compare" className="text-xs">Comparer</ToggleGroupItem>
              <ToggleGroupItem value="radar" className="text-xs">Radar</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {/* FILTERS */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un joueur"
              className="h-8 pl-7 text-xs"
            />
          </div>
          <ToggleGroup type="single" value={posFilter} onValueChange={(v) => setPosFilter(v || "all")} size="sm">
            <ToggleGroupItem value="all" className="text-[11px]">Tous postes</ToggleGroupItem>
            {positions.map((pos) => (
              <ToggleGroupItem key={pos} value={pos} className="text-[11px]">{pos}</ToggleGroupItem>
            ))}
          </ToggleGroup>
          {selected.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <Badge variant="secondary" className="text-[10px]">{selected.length}/5 sélectionnés</Badge>
              <Button size="sm" variant="default" className="h-8 text-xs" onClick={() => setView("compare")}>
                Comparer
              </Button>
              <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setSelected([])}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* INSIGHTS BAND */}
      {insights && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <InsightCard icon={<Crown className="h-3.5 w-3.5" />} label="Top performance" player={insights.top[0]?.player} hint={`Score ${insights.top[0]?.values.score}`} tone="primary" />
          <InsightCard icon={<Trophy className="h-3.5 w-3.5" />} label="Meilleur offensif" player={insights.bestOff?.player} hint={`${insights.bestOff?.values.tries} ess. · ${insights.bestOff?.values.meters} m`} tone="success" />
          <InsightCard icon={<Shield className="h-3.5 w-3.5" />} label="Meilleur défenseur" player={insights.bestDef?.player} hint={`${insights.bestDef?.values.tackles} plq. · ${insights.bestDef?.values.turnovers} turn.`} tone="info" />
          <InsightCard icon={<Activity className="h-3.5 w-3.5" />} label="Plus actif" player={insights.mostActive?.player} hint={`${insights.mostActive?.values.playTimeMinutes}' · ${insights.mostActive?.values.passes + insights.mostActive?.values.carries} actions`} tone="warning" />
        </div>
      )}

      {/* MAIN VIEW */}
      {view === "table" && (
        <Card className="rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="sticky left-0 bg-muted/40 z-[1] text-left px-3 py-2 font-medium w-[220px]">Joueur</th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} className="px-2 py-2 text-right font-medium whitespace-nowrap">
                      <button
                        onClick={() => toggleSort(c.key)}
                        className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                        title={c.label}
                      >
                        {c.short}
                        {sortKey === c.key ? (
                          sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => {
                  const isSelected = selected.includes(r.player.id);
                  return (
                    <tr
                      key={r.player.id}
                      className={cn(
                        "border-t hover:bg-accent/30 transition-colors cursor-pointer",
                        isSelected && "bg-primary/5"
                      )}
                      onClick={() => setDrawerId(r.player.id)}
                    >
                      <td
                        className={cn(
                          "sticky left-0 z-[1] px-3 py-2 bg-background",
                          isSelected && "bg-primary/5"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleSelect(r.player.id)}
                            className="h-3.5 w-3.5 accent-primary"
                          />
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={r.player.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {(r.player.name || r.player.first_name || "?").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{fullName(r.player)}</p>
                            {r.player.position && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1">
                                {r.player.position}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      {COLUMNS.map((c) => {
                        const v = r.values[c.key];
                        const all = filteredRows.map((x) => x.values[c.key]);
                        return (
                          <td
                            key={c.key}
                            className={cn(
                              "px-2 py-2 text-right tabular-nums whitespace-nowrap",
                              heatClass(v, c, all)
                            )}
                          >
                            {c.format ? c.format(v) : v}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {teamAverages && (
                  <tr className="border-t bg-muted/30 text-muted-foreground">
                    <td className="sticky left-0 bg-muted/30 z-[1] px-3 py-2 font-medium italic">
                      Moyenne équipe
                    </td>
                    {COLUMNS.map((c) => (
                      <td key={c.key} className="px-2 py-2 text-right tabular-nums italic">
                        {c.format ? c.format(teamAverages[c.key]) : teamAverages[c.key]}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {view === "compare" && (
        <CompareView rows={selectedRows.length >= 2 ? selectedRows : sortedRows.slice(0, 3)} />
      )}

      {view === "radar" && (
        <RadarView rows={selectedRows.length >= 2 ? selectedRows : sortedRows.slice(0, 3)} />
      )}

      {/* DRAWER */}
      <Sheet open={!!drawerId} onOpenChange={(o) => !o && setDrawerId(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {drawerPlayer && teamAverages && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={drawerPlayer.player.avatar_url || undefined} />
                    <AvatarFallback>{(drawerPlayer.player.name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{fullName(drawerPlayer.player)}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {drawerPlayer.player.position && (
                        <Badge variant="outline" className="text-[10px]">{drawerPlayer.player.position}</Badge>
                      )}
                      <PlayerIdentityBadges playerId={drawerPlayer.player.id} compact />
                    </div>
                  </div>
                </SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-2">
                {COLUMNS.map((c) => {
                  const v = drawerPlayer.values[c.key];
                  const avg = teamAverages[c.key];
                  const diff = v - avg;
                  const goodDiff = c.invert ? diff < 0 : diff > 0;
                  return (
                    <div
                      key={c.key}
                      className="flex items-center justify-between text-xs border-b border-border/50 py-2"
                    >
                      <span className="text-muted-foreground">{c.label}</span>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span className="font-semibold">
                          {c.format ? c.format(v) : v}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] w-14 text-right",
                            goodDiff ? "text-emerald-600 dark:text-emerald-400" : diff === 0 ? "text-muted-foreground" : "text-rose-600 dark:text-rose-400"
                          )}
                        >
                          {diff > 0 ? "+" : ""}{Math.round(diff * 10) / 10} vs moy.
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InsightCard({
  icon, label, player, hint, tone,
}: {
  icon: React.ReactNode;
  label: string;
  player?: PlayerLite;
  hint: string;
  tone: "primary" | "success" | "info" | "warning";
}) {
  const toneClass = {
    primary: "border-primary/40 bg-primary/5",
    success: "border-emerald-500/30 bg-emerald-500/5",
    info: "border-sky-500/30 bg-sky-500/5",
    warning: "border-amber-500/30 bg-amber-500/5",
  }[tone];
  if (!player) return null;
  return (
    <Card className={cn("rounded-2xl border", toneClass)}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {icon} {label}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <Avatar className="h-7 w-7">
            <AvatarImage src={player.avatar_url || undefined} />
            <AvatarFallback className="text-[10px]">{(player.name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{fullName(player)}</p>
            <p className="text-[10px] text-muted-foreground truncate">{hint}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const COMPARE_KEYS: StatKey[] = ["tries", "meters", "passes", "carries", "tackles", "turnovers"];

function CompareView({ rows }: { rows: Row[] }) {
  if (rows.length < 2) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-8 text-center text-muted-foreground text-sm">
          Sélectionnez au moins 2 joueurs dans le tableau pour les comparer.
        </CardContent>
      </Card>
    );
  }
  const data = COMPARE_KEYS.map((k) => {
    const col = COLUMNS.find((c) => c.key === k)!;
    const row: any = { stat: col.short };
    rows.forEach((r) => (row[fullName(r.player)] = r.values[k]));
    return row;
  });
  const colors = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-sm">Comparaison</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="stat" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <RTooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {rows.map((r, i) => (
                <Bar key={r.player.id} dataKey={fullName(r.player)} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-sm">Score de performance</CardTitle></CardHeader>
        <CardContent className="space-y-3 pt-2">
          {rows.map((r, i) => (
            <div key={r.player.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: colors[i % colors.length] }} />
                  {fullName(r.player)}
                </span>
                <span className="tabular-nums font-semibold">{r.values.score}/100</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${r.values.score}%`, background: colors[i % colors.length] }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function RadarView({ rows }: { rows: Row[] }) {
  if (rows.length < 2) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-8 text-center text-muted-foreground text-sm">
          Sélectionnez au moins 2 joueurs pour afficher le radar.
        </CardContent>
      </Card>
    );
  }
  // normalise per stat for fair radar
  const maxByKey: Record<string, number> = {};
  COMPARE_KEYS.forEach((k) => {
    maxByKey[k] = Math.max(1, ...rows.map((r) => r.values[k]));
  });
  const data = COMPARE_KEYS.map((k) => {
    const col = COLUMNS.find((c) => c.key === k)!;
    const row: any = { stat: col.short };
    rows.forEach((r) => (row[fullName(r.player)] = Math.round((r.values[k] / maxByKey[k]) * 100)));
    return row;
  });
  const colors = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
  return (
    <Card className="rounded-2xl">
      <CardHeader><CardTitle className="text-sm">Radar comparatif (normalisé)</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={420}>
          <RadarChart data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="stat" tick={{ fontSize: 11 }} />
            <PolarRadiusAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
            {rows.map((r, i) => (
              <Radar
                key={r.player.id}
                name={fullName(r.player)}
                dataKey={fullName(r.player)}
                stroke={colors[i % colors.length]}
                fill={colors[i % colors.length]}
                fillOpacity={0.2}
              />
            ))}
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <RTooltip />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
