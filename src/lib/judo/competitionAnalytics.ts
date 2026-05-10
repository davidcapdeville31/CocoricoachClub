// Helpers for judo competition-wide analytics (across multiple tournaments).
// - Tournament level grouping (local / national / international / other)
// - Performance label from best ranking achieved
// - Win/loss counters per opponent

export type TournamentLevel =
  | "local"
  | "departmental"
  | "regional"
  | "national"
  | "international"
  | "other";

export const TOURNAMENT_LEVELS: { value: TournamentLevel; label: string; color: string }[] = [
  { value: "local",         label: "Local",         color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  { value: "departmental",  label: "Départemental", color: "bg-teal-100 text-teal-700 border-teal-300" },
  { value: "regional",      label: "Régional",      color: "bg-cyan-100 text-cyan-700 border-cyan-300" },
  { value: "national",      label: "National",      color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "international", label: "International", color: "bg-purple-100 text-purple-700 border-purple-300" },
  { value: "other",         label: "Autre",         color: "bg-muted text-muted-foreground border-border" },
];

export type SelectionType =
  | "club"
  | "departmental_selection"
  | "regional_selection"
  | "national_selection";

export const SELECTION_TYPES: { value: SelectionType; label: string; short: string; color: string }[] = [
  { value: "club",                   label: "Club",                       short: "Club",       color: "bg-slate-100 text-slate-700 border-slate-300" },
  { value: "departmental_selection", label: "Sélection départementale",   short: "Sél. Dép.",  color: "bg-teal-100 text-teal-700 border-teal-300" },
  { value: "regional_selection",     label: "Sélection régionale",        short: "Sél. Rég.",  color: "bg-cyan-100 text-cyan-700 border-cyan-300" },
  { value: "national_selection",     label: "Équipe de France",           short: "Équipe Fr.", color: "bg-blue-100 text-blue-700 border-blue-300" },
];

export function selectionLabel(v?: string | null): string {
  return SELECTION_TYPES.find((s) => s.value === v)?.label || "Club";
}

export function tournamentLevelLabel(v?: string | null): string {
  return TOURNAMENT_LEVELS.find((l) => l.value === v)?.label || "Non défini";
}

// Performance label from a best ranking (1 = best). For judo, also derives from
// the deepest phase reached when no ranking is available.
export function performanceLabelFromRanking(rank?: number | null): string {
  if (!rank || rank < 1) return "Non classé";
  if (rank === 1) return "Vainqueur";
  if (rank === 2) return "Finaliste";
  if (rank <= 4) return "Demi-finaliste";
  if (rank <= 8) return "Quart de finaliste";
  if (rank <= 16) return "8e de finale";
  if (rank <= 32) return "16e de finale";
  return `${rank}e place`;
}

// Map a phase label to an "equivalent rank" so we can rank performances when
// no explicit ranking is set. Lower = better.
const PHASE_TO_RANK: Record<string, number> = {
  // common keys
  final: 2,
  finale: 2,
  vainqueur: 1,
  winner: 1,
  semi: 4,
  semifinal: 4,
  "1/2": 4,
  half: 4,
  quarter: 8,
  "1/4": 8,
  "1/8": 16,
  "1/16": 32,
  "1/32": 64,
  poule: 99,
  pool: 99,
  qualification: 99,
};

export function phaseEquivalentRank(phase?: string | null): number | null {
  if (!phase) return null;
  const k = phase.toString().trim().toLowerCase();
  return PHASE_TO_RANK[k] ?? null;
}

export interface RoundForAnalytics {
  result?: string | null;
  ranking?: number | null;
  phase?: string | null;
  opponent_name?: string | null;
  opponent_profile?: { last_name?: string | null; first_name?: string | null } | null;
}

export interface MatchForAnalytics {
  id: string;
  match_date: string;
  competition?: string | null;
  opponent?: string | null;
  tournament_level?: string | null;
  selection_type?: string | null;
  rounds: RoundForAnalytics[];
}

export interface LevelSummary {
  level: TournamentLevel | "unknown";
  label: string;
  tournamentsCount: number;
  bestPerformance: { label: string; rank: number; tournament: string; date: string } | null;
  averageRankLabel: string;
  averageRankNumeric: number | null;
}

function bestRankOfMatch(m: MatchForAnalytics): number | null {
  let best: number | null = null;
  for (const r of m.rounds) {
    const candidates: number[] = [];
    if (r.ranking && r.ranking > 0) candidates.push(r.ranking);
    const phaseRank = phaseEquivalentRank(r.phase);
    if (phaseRank !== null) candidates.push(phaseRank);
    for (const c of candidates) {
      if (best === null || c < best) best = c;
    }
  }
  return best;
}

export function summarizeByLevel(matches: MatchForAnalytics[]): LevelSummary[] {
  const groups: Record<string, MatchForAnalytics[]> = {};
  for (const m of matches) {
    const key = (m.tournament_level as TournamentLevel) || "unknown";
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  }
  const order: (TournamentLevel | "unknown")[] = ["local", "national", "international", "other", "unknown"];
  const out: LevelSummary[] = [];
  for (const lvl of order) {
    const list = groups[lvl];
    if (!list || list.length === 0) continue;
    let best: { rank: number; tournament: string; date: string } | null = null;
    const ranks: number[] = [];
    for (const m of list) {
      const r = bestRankOfMatch(m);
      if (r !== null) {
        ranks.push(r);
        if (!best || r < best.rank) {
          best = { rank: r, tournament: m.competition || m.opponent || "Compétition", date: m.match_date };
        }
      }
    }
    const avg = ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null;
    out.push({
      level: lvl,
      label: lvl === "unknown" ? "Non défini" : tournamentLevelLabel(lvl),
      tournamentsCount: list.length,
      bestPerformance: best
        ? { label: performanceLabelFromRanking(best.rank), rank: best.rank, tournament: best.tournament, date: best.date }
        : null,
      averageRankNumeric: avg,
      averageRankLabel: avg !== null ? performanceLabelFromRanking(Math.round(avg)) : "—",
    });
  }
  return out;
}

export interface OpponentStat {
  name: string;
  total: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

const WIN_TOKENS = ["v", "w", "win", "victoire", "ippon", "wazari", "yuko"];
const LOSS_TOKENS = ["d", "l", "loss", "defaite", "défaite", "perdu"];

function isWin(s?: string | null) {
  if (!s) return false;
  const v = s.toString().trim().toLowerCase();
  return v === "win" || WIN_TOKENS.some((t) => v === t || v.startsWith(t));
}
function isLoss(s?: string | null) {
  if (!s) return false;
  const v = s.toString().trim().toLowerCase();
  return v === "loss" || LOSS_TOKENS.some((t) => v === t || v.startsWith(t));
}

function opponentName(r: RoundForAnalytics): string | null {
  const p = r.opponent_profile;
  if (p && (p.last_name || p.first_name)) {
    return `${(p.last_name || "").toUpperCase()} ${p.first_name || ""}`.trim();
  }
  const n = (r.opponent_name || "").trim();
  return n || null;
}

export function summarizeOpponents(matches: MatchForAnalytics[]): OpponentStat[] {
  const map = new Map<string, OpponentStat>();
  for (const m of matches) {
    for (const r of m.rounds) {
      const name = opponentName(r);
      if (!name) continue;
      let s = map.get(name);
      if (!s) {
        s = { name, total: 0, wins: 0, losses: 0, draws: 0, winRate: 0 };
        map.set(name, s);
      }
      s.total += 1;
      if (isWin(r.result)) s.wins += 1;
      else if (isLoss(r.result)) s.losses += 1;
      else s.draws += 1;
    }
  }
  const arr = Array.from(map.values()).map((s) => {
    const decisive = s.wins + s.losses;
    s.winRate = decisive > 0 ? Math.round((s.wins / decisive) * 1000) / 10 : 0;
    return s;
  });
  arr.sort((a, b) => b.total - a.total || b.winRate - a.winRate);
  return arr;
}
