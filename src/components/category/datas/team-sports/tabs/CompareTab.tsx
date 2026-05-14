import { useMemo, useState } from "react";
import { useCategoryPlayers, useMultiMatchEvents, type MatchRow, type PlayerLite } from "@/hooks/analytics/useTeamSportsAnalytics";
import { computeMatchAnalytics } from "@/lib/analytics/team-sports/eventAggregator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { GitCompare, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  categoryId: string;
  matches: MatchRow[];
}

const STAT_OPTIONS: { key: string; label: string }[] = [
  { key: "tries", label: "Essais" },
  { key: "tackles", label: "Plaquages" },
  { key: "missedTackles", label: "Plaq. manqués" },
  { key: "passes", label: "Passes" },
  { key: "offloads", label: "Offloads" },
  { key: "lineBreaks", label: "Franchissements" },
  { key: "meters", label: "Mètres" },
  { key: "turnovers", label: "Turnovers" },
  { key: "carries", label: "Courses" },
  { key: "fouls", label: "Pénalités conc." },
  { key: "playTimeMinutes", label: "Temps de jeu" },
];

const COLORS = ["hsl(var(--primary))", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899", "#84cc16"];

const fullName = (p: PlayerLite) => [p.first_name, p.name].filter(Boolean).join(" ").trim() || "Joueur";

export function CompareTab({ categoryId, matches }: Props) {
  const { data: players = [] } = useCategoryPlayers(categoryId);
  const recentMatchIds = matches.slice(0, 10).map(m => m.id);
  const { data: events = [], isLoading } = useMultiMatchEvents(recentMatchIds);

  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectedStats, setSelectedStats] = useState<string[]>(["tries", "tackles", "passes", "lineBreaks"]);

  const eventsByMatch = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const e of events) {
      const arr = map.get(e.match_id) || [];
      arr.push(e);
      map.set(e.match_id, arr);
    }
    return map;
  }, [events]);

  // Aggregate player stats across selected match window
  const playerTotals = useMemo(() => {
    const totals: Record<string, Record<string, number>> = {};
    for (const [, evs] of eventsByMatch) {
      const a = computeMatchAnalytics(evs as any, "all");
      for (const [pid, stats] of Object.entries(a.players)) {
        const t = totals[pid] || (totals[pid] = {});
        for (const k of STAT_OPTIONS.map(s => s.key)) {
          t[k] = (t[k] || 0) + ((stats as any)[k] || 0);
        }
      }
    }
    return totals;
  }, [eventsByMatch]);

  const involved = useMemo(() => {
    return players.filter(p => playerTotals[p.id]);
  }, [players, playerTotals]);

  const togglePlayer = (id: string) =>
    setSelectedPlayers(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleStat = (k: string) =>
    setSelectedStats(s => s.includes(k) ? s.filter(x => x !== k) : [...s, k]);

  const barData = useMemo(() => {
    return selectedPlayers.map((pid) => {
      const p = players.find(x => x.id === pid);
      const totals = playerTotals[pid] || {};
      const row: any = { name: p ? fullName(p) : pid };
      selectedStats.forEach(k => { row[k] = totals[k] || 0; });
      return row;
    });
  }, [selectedPlayers, selectedStats, playerTotals, players]);

  const radarData = useMemo(() => {
    return selectedStats.map((k) => {
      const stat = STAT_OPTIONS.find(s => s.key === k);
      const row: any = { stat: stat?.label || k };
      selectedPlayers.forEach((pid) => {
        const p = players.find(x => x.id === pid);
        row[p ? fullName(p) : pid] = playerTotals[pid]?.[k] || 0;
      });
      return row;
    });
  }, [selectedPlayers, selectedStats, playerTotals, players]);

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <GitCompare className="h-4 w-4" /> Comparer les joueurs
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Données agrégées sur les {recentMatchIds.length} derniers matchs.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Joueurs ({selectedPlayers.length})</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setSelectedPlayers(involved.map(p => p.id))}>Tous</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setSelectedPlayers([])}>Aucun</Button>
                </div>
              </div>
              <ScrollArea className="h-[280px] border rounded-xl p-2 bg-surface-sunken">
                {involved.length === 0 && <p className="text-xs text-muted-foreground p-2">Aucun joueur avec des données récentes.</p>}
                {involved.map((p) => (
                  <label key={p.id} className={cn(
                    "flex items-center gap-2 p-1.5 rounded-lg hover:bg-accent/40 cursor-pointer",
                    selectedPlayers.includes(p.id) && "bg-accent/40"
                  )}>
                    <Checkbox checked={selectedPlayers.includes(p.id)} onCheckedChange={() => togglePlayer(p.id)} />
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={p.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">{(p.name || p.first_name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{fullName(p)}</p>
                      {p.position && <p className="text-[10px] text-muted-foreground truncate">{p.position}</p>}
                    </div>
                  </label>
                ))}
              </ScrollArea>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statistiques</span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {STAT_OPTIONS.map((s) => (
                  <button key={s.key} onClick={() => toggleStat(s.key)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs border transition-colors",
                      selectedStats.includes(s.key) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent/40"
                    )}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedPlayers.length === 0 || selectedStats.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="p-8 text-center text-muted-foreground">
          Sélectionnez au moins un joueur et une statistique.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-sm">Bar chart</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {selectedStats.map((k, i) => (
                    <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} name={STAT_OPTIONS.find(s => s.key === k)?.label} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-sm">Radar</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="stat" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis />
                  {selectedPlayers.map((pid, i) => {
                    const p = players.find(x => x.id === pid);
                    const name = p ? fullName(p) : pid;
                    return <Radar key={pid} name={name} dataKey={name} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.25} />;
                  })}
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
