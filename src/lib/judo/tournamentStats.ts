// Aggregation of judo combat stats per tournament (match).
// Consumes competition_rounds.stats (JSONB) and .result to build a summary.

export interface JudoRoundStatsRow {
  result?: string | null;
  stats?: Record<string, number> | null;
}

export interface JudoTournamentSummary {
  combats: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number; // %
  // Scores
  ipponFor: number;
  ipponAgainst: number;
  wazariFor: number;
  yukoFor: number;
  yukoAgainst: number;
  wazariAgainst: number;
  shidoFor: number;
  shidoAgainst: number;
  hansokuDirectFor: number;
  hansokuDirectAgainst: number;
  immobilizationYukoFor: number;
  immobilizationYukoAgainst: number;
  immobilizationWazariFor: number;
  immobilizationWazariAgainst: number;
  immobilizationIpponFor: number;
  immobilizationIpponAgainst: number;
  standingGroundTransitions: number;
  standingAttempts: number;
  standingSuccess: number;
  standingSuccessRate: number;
  // Divers
  goldenScoreCount: number;
}

const num = (v: unknown) => (typeof v === "number" && !isNaN(v) ? v : Number(v) || 0);

const WIN_TOKENS = ["v", "w", "win", "victoire", "ippon", "wazari", "yuko"];
const LOSS_TOKENS = ["d", "l", "loss", "defaite", "défaite", "perdu"];

function isWin(s?: string | null) {
  if (!s) return false;
  const v = s.toLowerCase();
  return v === "win" || WIN_TOKENS.some((t) => v === t || v.startsWith(t));
}
function isLoss(s?: string | null) {
  if (!s) return false;
  const v = s.toLowerCase();
  return v === "loss" || LOSS_TOKENS.some((t) => v === t || v.startsWith(t));
}

export function emptyJudoSummary(): JudoTournamentSummary {
  return {
    combats: 0, wins: 0, losses: 0, draws: 0, winRate: 0,
    ipponFor: 0, ipponAgainst: 0, wazariFor: 0, wazariAgainst: 0, yukoFor: 0, yukoAgainst: 0,
    shidoFor: 0, shidoAgainst: 0, hansokuDirectFor: 0, hansokuDirectAgainst: 0,
    immobilizationYukoFor: 0, immobilizationYukoAgainst: 0,
    immobilizationWazariFor: 0, immobilizationWazariAgainst: 0,
    immobilizationIpponFor: 0, immobilizationIpponAgainst: 0,
    standingGroundTransitions: 0, standingAttempts: 0, standingSuccess: 0, standingSuccessRate: 0,
    goldenScoreCount: 0,
  };
}

export function summarizeTournamentRounds(rounds: JudoRoundStatsRow[]): JudoTournamentSummary {
  const out = emptyJudoSummary();
  for (const r of rounds) {
    const s = r.stats || {};
    out.combats += 1;
    if (isWin(r.result)) out.wins += 1;
    else if (isLoss(r.result)) out.losses += 1;
    else out.draws += 1;

    // Keep legacy osaekomi scores readable while aggregating the new post-combat choice.
    const osaeMe = num(s["ijf_osaekomi_me_sec"]);
    const osaeOpp = num(s["ijf_osaekomi_opp_sec"]);
    const immoMe = num(s["ijf_immo_score_me"]);
    const immoOpp = num(s["ijf_immo_score_opp"]);

    out.ipponFor += num(s["ijf_ippon_me"]) + (immoMe === 3 || osaeMe >= 20 ? 1 : 0);
    out.ipponAgainst += num(s["ijf_ippon_opp"]) + (immoOpp === 3 || osaeOpp >= 20 ? 1 : 0);
    out.yukoFor += num(s["ijf_yuko_me"]) + (immoMe === 1 ? 1 : 0);
    out.yukoAgainst += num(s["ijf_yuko_opp"]) + (immoOpp === 1 ? 1 : 0);
    out.wazariFor += num(s["ijf_wazari_me"]) + (immoMe === 2 || (osaeMe >= 10 && osaeMe < 20) ? 1 : 0);
    out.wazariAgainst += num(s["ijf_wazari_opp"]) + (immoOpp === 2 || (osaeOpp >= 10 && osaeOpp < 20) ? 1 : 0);
    out.shidoFor += num(s["ijf_shido_me"]);
    out.shidoAgainst += num(s["ijf_shido_opp"]);
    out.hansokuDirectFor += num(s["ijf_hansoku_direct_me"]) > 0 ? 1 : 0;
    out.hansokuDirectAgainst += num(s["ijf_hansoku_direct_opp"]) > 0 ? 1 : 0;
    out.immobilizationYukoFor += immoMe === 1 ? 1 : 0;
    out.immobilizationYukoAgainst += immoOpp === 1 ? 1 : 0;
    out.immobilizationWazariFor += immoMe === 2 ? 1 : 0;
    out.immobilizationWazariAgainst += immoOpp === 2 ? 1 : 0;
    out.immobilizationIpponFor += immoMe === 3 ? 1 : 0;
    out.immobilizationIpponAgainst += immoOpp === 3 ? 1 : 0;
    out.standingGroundTransitions += num(s["ijf_transition_s2g"]);
    out.standingAttempts += num(s["ijf_standing_attempts"]);
    out.standingSuccess += num(s["ijf_standing_success"]);

    if (num(s["goldenScore"]) > 0) out.goldenScoreCount += 1;
  }

  const decisive = out.wins + out.losses;
  out.winRate = decisive > 0 ? Math.round((out.wins / decisive) * 1000) / 10 : 0;
  out.standingSuccessRate = out.standingAttempts > 0
    ? Math.round((out.standingSuccess / out.standingAttempts) * 1000) / 10
    : 0;

  return out;
}

// Grouped rows for display / compare.
export interface JudoMetricGroup {
  title: string;
  metrics: JudoMetricRow[];
}
export interface JudoMetricRow {
  key: keyof JudoTournamentSummary;
  label: string;
  format?: "int" | "percent" | "duration";
  higherIsBetter: boolean;
}

export const JUDO_METRIC_GROUPS: JudoMetricGroup[] = [
  {
    title: "Bilan combats",
    metrics: [
      { key: "combats", label: "Combats", format: "int", higherIsBetter: true },
      { key: "wins", label: "Victoires", format: "int", higherIsBetter: true },
      { key: "losses", label: "Défaites", format: "int", higherIsBetter: false },
      { key: "draws", label: "Nuls", format: "int", higherIsBetter: true },
      { key: "winRate", label: "% Victoires", format: "percent", higherIsBetter: true },
    ],
  },
  {
    title: "Scores",
    metrics: [
      { key: "ipponFor", label: "Ippon pour", format: "int", higherIsBetter: true },
      { key: "ipponAgainst", label: "Ippon contre", format: "int", higherIsBetter: false },
      { key: "wazariFor", label: "Waza-ari pour", format: "int", higherIsBetter: true },
      { key: "yukoFor", label: "Yuko pour", format: "int", higherIsBetter: true },
      { key: "yukoAgainst", label: "Yuko contre", format: "int", higherIsBetter: false },
      { key: "wazariAgainst", label: "Waza-ari contre", format: "int", higherIsBetter: false },
      { key: "shidoFor", label: "Shido reçus", format: "int", higherIsBetter: false },
      { key: "shidoAgainst", label: "Shido adverses", format: "int", higherIsBetter: true },
      { key: "hansokuDirectFor", label: "Hansoku-make subis", format: "int", higherIsBetter: false },
      { key: "hansokuDirectAgainst", label: "Hansoku-make provoqués", format: "int", higherIsBetter: true },
    ],
  },
  {
    title: "Ne-waza",
    metrics: [
      { key: "immobilizationYukoFor", label: "Yuko sur immobilisation", format: "int", higherIsBetter: true },
      { key: "immobilizationWazariFor", label: "Waza-ari sur immobilisation", format: "int", higherIsBetter: true },
      { key: "immobilizationIpponFor", label: "Ippon sur immobilisation", format: "int", higherIsBetter: true },
      { key: "standingGroundTransitions", label: "Liaisons debout-sol", format: "int", higherIsBetter: true },
    ],
  },
  {
    title: "Techniques debout",
    metrics: [
      { key: "standingAttempts", label: "Techniques tentées", format: "int", higherIsBetter: true },
      { key: "standingSuccess", label: "Techniques réussies", format: "int", higherIsBetter: true },
      { key: "standingSuccessRate", label: "% de réussite", format: "percent", higherIsBetter: true },
    ],
  },
  {
    title: "Tactique",
    metrics: [
      { key: "goldenScoreCount", label: "Combats en Golden Score", format: "int", higherIsBetter: false },
    ],
  },
];

export function formatMetric(value: number, format?: JudoMetricRow["format"]): string {
  if (format === "percent") return `${value}%`;
  if (format === "duration") {
    const sec = Math.round(value);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m${s.toString().padStart(2, "0")}` : `${s}s`;
  }
  return Math.round(value).toString();
}
