import { getDateLocale } from "@/lib/i18n/dateLocale";
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

interface Props {
  categoryId: string;
  matches: MatchRow[];
}

const TEAM_METRICS: MetricDef[] = [
  // Attaque
  { key: "tries", label: "Essais", group: "Attaque", decimals: 0 },
  { key: "conversionsMade", label: "Transformations", group: "Attaque", decimals: 0 },
  { key: "penaltiesMade", label: "Pénalités", group: "Attaque", decimals: 0 },
  { key: "drops", label: "Drops", group: "Attaque", decimals: 0 },
  { key: "lineBreaks", label: "Franchissements", group: "Attaque", decimals: 0 },
  { key: "knockOns", label: "En-avants", group: "Attaque", decimals: 0, direction: "lower" },
  { key: "passes", label: "Passes réussies", group: "Attaque", decimals: 0 },
  { key: "passesMissed", label: "Passes manquées", group: "Attaque", decimals: 0, direction: "lower" },
  { key: "kicks", label: "Passes au pied", group: "Attaque", decimals: 0 },
  { key: "kicksMissed", label: "P. au pied manquées", group: "Attaque", decimals: 0, direction: "lower" },
  // Défense
  { key: "tackles", label: "Plaquages", group: "Défense", decimals: 0 },
  { key: "missedTackles", label: "Plaq. manqués", group: "Défense", decimals: 0, direction: "lower" },
  { key: "turnovers", label: "Ballons grattés", group: "Défense", decimals: 0 },
  // Conquête
  { key: "scrumsWon", label: "Mêlées gagnées", group: "Conquête", decimals: 0 },
  { key: "lineoutsWon", label: "Touches gagnées", group: "Conquête", decimals: 0 },
  // Discipline
  { key: "fouls", label: "Pénalités conc.", group: "Discipline", decimals: 0, direction: "lower" },
  { key: "yellowCards", label: "Cartons jaunes", group: "Discipline", decimals: 0, direction: "lower" },
  { key: "redCards", label: "Cartons rouges", group: "Discipline", decimals: 0, direction: "lower" },
  // Volume
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

  // Tous les joueurs de la catégorie (même ceux sans actions enregistrées)
  const involvedPlayers: SmartPlayerLite[] = useMemo(() => {
    return players.map((p) => ({ id: p.id, first_name: p.first_name, name: p.name || "Joueur", position: p.position }));
  }, [players]);

  // Scopes
  const scopes: ScopeDef[] = useMemo(() => {
    const list: ScopeDef[] = [
      { key: "all", label: "Toute la saison", hint: `${recent.length} matchs`, group: "Global" },
    ];
    for (const m of recent) {
      const dateStr = m.match_date ? format(new Date(m.match_date), "d MMM yyyy", { locale: getDateLocale() }) : "";
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
      defaultMetricKeys={["tries", "tackles", "lineBreaks", "turnovers"]}
      allowedDimensions={["position", "laterality", "lateralite", "age_category"]}
    />
  );
}
