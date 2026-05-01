import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  SmartStatsComparator,
  type MetricDef,
  type ScopeDef,
  type PlayerLite,
} from "@/components/analytics/SmartStatsComparator";
import { getOilCategory } from "@/lib/constants/bowlingOilPatterns";
import type { FrameData } from "@/components/athlete-portal/BowlingScoreSheet";

interface BowlingGameData {
  roundId: string;
  matchId: string;
  playerId: string;
  playerName: string;
  matchDate: string;
  matchOpponent: string;
  score: number;
  strikes: number;
  spares: number;
  strikePercentage: number;
  sparePercentage: number;
  openFrames: number;
  splitCount: number;
  splitConverted: number;
  pocketCount: number;
  pocketPercentage: number;
  singlePinCount: number;
  singlePinConverted: number;
  singlePinConversionRate: number;
  frames?: FrameData[];
  trackPockets?: boolean;
}

interface Props {
  categoryId: string;
  /** Toutes les parties (équipe complète) */
  allGames: BowlingGameData[];
}

const BOWLING_METRICS: MetricDef[] = [
  // Score
  { key: "avgScore", label: "Moyenne au score", group: "Score", decimals: 1 },
  { key: "highGame", label: "Meilleure partie", group: "Score", decimals: 0 },
  { key: "lowGame", label: "Pire partie", group: "Score", decimals: 0, direction: "lower" },
  { key: "totalGames", label: "Nombre de parties", group: "Score", decimals: 0 },

  // Pourcentages
  { key: "avgStrikeRate", label: "% Strikes", unit: "%", group: "Précision (%)" },
  { key: "avgSpareRate", label: "% Spares", unit: "%", group: "Précision (%)" },
  { key: "avgPocketRate", label: "% Poches", unit: "%", group: "Précision (%)" },
  { key: "singlePinConversionRate", label: "% Quilles seules", unit: "%", group: "Précision (%)" },
  { key: "splitConversionRate", label: "% Conversion splits", unit: "%", group: "Précision (%)" },
  { key: "firstBallGte8Percentage", label: "% Boules ≥8", unit: "%", group: "Précision (%)" },
  { key: "openFramePercentage", label: "% Frames non fermées", unit: "%", group: "Précision (%)", direction: "lower" },

];

function computeStats(games: BowlingGameData[]) {
  if (games.length === 0) return null;
  const totalGames = games.length;
  const totalScore = games.reduce((s, g) => s + g.score, 0);
  const totalStrikes = games.reduce((s, g) => s + g.strikes, 0);
  const totalSpares = games.reduce((s, g) => s + g.spares, 0);
  const totalOpenFrames = games.reduce((s, g) => s + g.openFrames, 0);
  const totalSplits = games.reduce((s, g) => s + g.splitCount, 0);
  const totalSplitsConverted = games.reduce((s, g) => s + g.splitConverted, 0);
  const pocketGames = games.filter((g) => g.trackPockets !== false);
  const totalPocket = pocketGames.reduce((s, g) => s + g.pocketCount, 0);
  const totalSinglePin = games.reduce((s, g) => s + g.singlePinCount, 0);
  const totalSinglePinConverted = games.reduce((s, g) => s + g.singlePinConverted, 0);
  const highGame = Math.max(...games.map((g) => g.score));
  const lowGame = Math.min(...games.map((g) => g.score));
  const avgScore = totalScore / totalGames;
  const avgStrikeRate = games.reduce((s, g) => s + g.strikePercentage, 0) / totalGames;
  const avgSpareRate = games.reduce((s, g) => s + g.sparePercentage, 0) / totalGames;
  const avgPocketRate =
    pocketGames.length > 0
      ? pocketGames.reduce((s, g) => s + g.pocketPercentage, 0) / pocketGames.length
      : 0;
  const totalFrames = totalGames * 10;
  const openFramePercentage = totalFrames > 0 ? (totalOpenFrames / totalFrames) * 100 : 0;

  // First ball ≥ 8 from frames
  let totalFBGte8 = 0;
  let totalFBGte8Opp = 0;
  games.forEach((g) => {
    if (g.frames) {
      g.frames.forEach((frame, fi) => {
        const isTenth = fi === 9;
        frame.throws.forEach((t, ti) => {
          if (t.value === "") return;
          const isFirst =
            ti === 0 ||
            (isTenth &&
              ((ti === 1 && frame.throws[0]?.value === "X") ||
                (ti === 2 &&
                  (frame.throws[1]?.value === "X" || frame.throws[1]?.value === "/"))));
          if (!isFirst) return;
          const isLast =
            isTenth &&
            ti === 2 &&
            ((frame.throws[0]?.value === "X" && frame.throws[1]?.value === "X") ||
              (frame.throws[0]?.value !== "X" && frame.throws[1]?.value === "/"));
          if (isLast) return;
          totalFBGte8Opp++;
          if (t.pins >= 8) totalFBGte8++;
        });
      });
    }
  });
  const firstBallGte8Percentage =
    totalFBGte8Opp > 0 ? (totalFBGte8 / totalFBGte8Opp) * 100 : 0;

  return {
    totalGames,
    avgScore,
    highGame,
    lowGame,
    avgStrikeRate,
    avgSpareRate,
    avgPocketRate,
    singlePinConversionRate:
      totalSinglePin > 0 ? (totalSinglePinConverted / totalSinglePin) * 100 : 0,
    splitConversionRate:
      totalSplits > 0 ? (totalSplitsConverted / totalSplits) * 100 : 0,
    firstBallGte8Percentage,
    openFramePercentage,
    totalStrikes,
    totalSpares,
    totalPocket,
    totalSplits,
    totalOpenFrames,
    totalSinglePin,
  };
}

export function BowlingStatsComparator({ categoryId, allGames }: Props) {
  // Liste des joueurs uniques
  const players: PlayerLite[] = useMemo(() => {
    const map = new Map<string, PlayerLite>();
    for (const g of allGames) {
      if (!map.has(g.playerId)) {
        const [first, ...rest] = g.playerName.split(" ");
        map.set(g.playerId, {
          id: g.playerId,
          first_name: first ?? null,
          name: rest.join(" ") || g.playerName,
        });
      }
    }
    return Array.from(map.values());
  }, [allGames]);

  // Compétitions uniques
  const competitions = useMemo(() => {
    const seen = new Map<string, { matchId: string; label: string; date: string }>();
    for (const g of allGames) {
      if (!seen.has(g.matchId)) {
        seen.set(g.matchId, {
          matchId: g.matchId,
          label: g.matchOpponent || "Compétition",
          date: g.matchDate,
        });
      }
    }
    return Array.from(seen.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [allGames]);

  // Récupérer les huilages pour pouvoir filtrer par catégorie d'huilage
  const matchIds = useMemo(() => competitions.map((c) => c.matchId), [competitions]);
  const { data: oilByMatch = new Map() } = useQuery({
    queryKey: ["bowling_stats_comparator_oils", categoryId, matchIds.length],
    enabled: matchIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bowling_oil_patterns")
        .select("name, match_id, oil_ratio")
        .in("match_id", matchIds);
      if (error) throw error;
      const m = new Map<string, { name: string; oil_ratio: string | null; categoryType: string | null; categoryLabel: string | null }>();
      for (const op of data ?? []) {
        if (!op.match_id) continue;
        const cat = getOilCategory(op.oil_ratio);
        m.set(op.match_id, {
          name: op.name,
          oil_ratio: op.oil_ratio,
          categoryType: cat?.type ?? null,
          categoryLabel: cat?.label ?? null,
        });
      }
      return m;
    },
  });

  // Build scopes
  const scopes: ScopeDef[] = useMemo(() => {
    const list: ScopeDef[] = [
      {
        key: "all",
        label: "Toute l'année",
        hint: `${allGames.length} parties`,
        group: "Global",
      },
    ];

    // Par catégorie d'huilage (sport / challenge / recreation)
    const oilCatCounts = new Map<string, { label: string; count: number }>();
    for (const g of allGames) {
      const oil = oilByMatch.get(g.matchId);
      if (oil?.categoryType) {
        const cur = oilCatCounts.get(oil.categoryType) ?? {
          label: oil.categoryLabel ?? oil.categoryType,
          count: 0,
        };
        cur.count += 1;
        oilCatCounts.set(oil.categoryType, cur);
      }
    }
    for (const [type, info] of oilCatCounts.entries()) {
      list.push({
        key: `oilcat:${type}`,
        label: info.label,
        hint: `${info.count} parties`,
        group: "Par type d'huilage",
      });
    }

    // Par compétition
    for (const c of competitions) {
      const count = allGames.filter((g) => g.matchId === c.matchId).length;
      const oil = oilByMatch.get(c.matchId);
      const dateStr = c.date ? new Date(c.date).toLocaleDateString("fr-FR") : "";
      list.push({
        key: `match:${c.matchId}`,
        label: `${c.label}${dateStr ? ` — ${dateStr}` : ""}`,
        hint: `${count} parties${oil ? ` • ${oil.name}` : ""}`,
        group: "Par compétition",
      });
    }

    return list;
  }, [allGames, competitions, oilByMatch]);

  // Filtre les parties pour un scope donné
  const gamesForScope = (scopeKey: string): BowlingGameData[] => {
    if (scopeKey === "all") return allGames;
    if (scopeKey.startsWith("match:")) {
      const id = scopeKey.slice("match:".length);
      return allGames.filter((g) => g.matchId === id);
    }
    if (scopeKey.startsWith("oilcat:")) {
      const cat = scopeKey.slice("oilcat:".length);
      return allGames.filter((g) => oilByMatch.get(g.matchId)?.categoryType === cat);
    }
    return allGames;
  };

  const getValue = (playerId: string, metricKey: string, scopeKey: string): number | null => {
    const games = gamesForScope(scopeKey).filter((g) => g.playerId === playerId);
    const stats = computeStats(games);
    if (!stats) return null;
    const v = (stats as any)[metricKey];
    if (typeof v !== "number" || isNaN(v)) return null;
    return v;
  };

  if (allGames.length === 0 || players.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        Aucune donnée bowling enregistrée pour comparer.
      </div>
    );
  }

  return (
    <SmartStatsComparator
      categoryId={categoryId}
      players={players}
      metrics={BOWLING_METRICS}
      scopes={scopes}
      getValue={getValue}
      title="Comparer les stats bowling"
      description="Choisis une statistique et une période (toute l'année, une compétition précise ou un type d'huilage)"
      hiddenDimensions={["styles", "discipline", "specialties", "disciplines_all", "technical_style", "position", "positions"]}
    />
  );
}
