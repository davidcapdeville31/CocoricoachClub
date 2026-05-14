import { useMemo } from "react";
import { useCategoryPlayers, useMultiMatchEvents, type MatchRow } from "@/hooks/analytics/useTeamSportsAnalytics";
import { computeMatchAnalytics } from "@/lib/analytics/team-sports/eventAggregator";
import {
  SmartStatsComparator,
  type MetricDef,
  type ScopeDef,
  type PlayerLite as SmartPlayerLite,
} from "@/components/analytics/SmartStatsComparator";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  categoryId: string;
  matches: MatchRow[];
}

const TEAM_METRICS: MetricDef[] = [
  { key: "tries", label: "Essais", group: "Attaque", decimals: 0 },
  { key: "lineBreaks", label: "Franchissements", group: "Attaque", decimals: 0 },
  { key: "meters", label: "Mètres", group: "Attaque", decimals: 0 },
  { key: "carries", label: "Courses", group: "Attaque", decimals: 0 },
  { key: "passes", label: "Passes", group: "Attaque", decimals: 0 },
  { key: "offloads", label: "Offloads", group: "Attaque", decimals: 0 },
  { key: "tackles", label: "Plaquages", group: "Défense", decimals: 0 },
  { key: "missedTackles", label: "Plaq. manqués", group: "Défense", decimals: 0, direction: "lower" },
  { key: "turnovers", label: "Turnovers", group: "Jeu", decimals: 0 },
  { key: "fouls", label: "Pénalités conc.", group: "Discipline", decimals: 0, direction: "lower" },
  { key: "playTimeMinutes", label: "Temps de jeu", group: "Volume", decimals: 0, unit: " min" },
];

export function CompareTab({ categoryId, matches }: Props) {
  const { data: players = [] } = useCategoryPlayers(categoryId);
  const recent = matches.slice(0, 20);
  const recentMatchIds = recent.map((m) => m.id);
  const { data: events = [] } = useMultiMatchEvents(recentMatchIds);

  // Group events per match
  const eventsByMatch = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const e of events) {
      const arr = map.get(e.match_id) || [];
      arr.push(e);
      map.set(e.match_id, arr);
    }
    return map;
  }, [events]);

  // Stats per match per player
  const statsByMatch = useMemo(() => {
    const result: Record<string, Record<string, Record<string, number>>> = {};
    for (const [mid, evs] of eventsByMatch) {
      const a = computeMatchAnalytics(evs as any, "all");
      const row: Record<string, Record<string, number>> = {};
      for (const [pid, stats] of Object.entries(a.players)) {
        row[pid] = stats as any;
      }
      result[mid] = row;
    }
    return result;
  }, [eventsByMatch]);

  // Players with at least one event
  const involvedPlayers: SmartPlayerLite[] = useMemo(() => {
    const ids = new Set<string>();
    for (const m of Object.values(statsByMatch)) for (const pid of Object.keys(m)) ids.add(pid);
    return players
      .filter((p) => ids.has(p.id))
      .map((p) => ({ id: p.id, first_name: p.first_name, name: p.name || "Joueur" }));
  }, [players, statsByMatch]);

  // Scopes
  const scopes: ScopeDef[] = useMemo(() => {
    const list: ScopeDef[] = [
      { key: "all", label: "Toute la saison", hint: `${recent.length} matchs`, group: "Global" },
    ];
    for (const m of recent) {
      const dateStr = m.match_date ? format(new Date(m.match_date), "d MMM yyyy", { locale: fr }) : "";
      const score = m.score_home != null && m.score_away != null ? ` (${m.score_home}-${m.score_away})` : "";
      list.push({
        key: `match:${m.id}`,
        label: `${m.is_home ? "vs" : "@"} ${m.opponent}${score}`,
        hint: dateStr,
        group: "Par match",
      });
    }
    return list;
  }, [recent]);

  const getValue = (playerId: string, metricKey: string, scopeKey: string): number | null => {
    if (scopeKey === "all") {
      let total = 0;
      let found = false;
      for (const matchStats of Object.values(statsByMatch)) {
        const v = matchStats[playerId]?.[metricKey];
        if (typeof v === "number") {
          total += v;
          found = true;
        }
      }
      return found ? total : null;
    }
    if (scopeKey.startsWith("match:")) {
      const mid = scopeKey.slice("match:".length);
      const v = statsByMatch[mid]?.[playerId]?.[metricKey];
      return typeof v === "number" ? v : null;
    }
    return null;
  };

  if (recent.length === 0 || involvedPlayers.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        Aucune donnée enregistrée pour comparer.
      </div>
    );
  }

  return (
    <SmartStatsComparator
      categoryId={categoryId}
      players={involvedPlayers}
      metrics={TEAM_METRICS}
      scopes={scopes}
      getValue={getValue}
      title="Comparer les stats"
      description="Choisis une statistique et une période (toute la saison ou un match précis)"
      defaultMetricKeys={["tries", "tackles", "passes", "lineBreaks"]}
    />
  );
}
