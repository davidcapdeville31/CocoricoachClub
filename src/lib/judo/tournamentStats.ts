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
  // Ne-waza
  osaekomiSecFor: number;
  osaekomiSecAgainst: number;
  immoAttempts: number;
  immoSuccess: number;
  chokeAttempts: number;
  chokeSuccess: number;
  armlockAttempts: number;
  armlockSuccess: number;
  submissionsFor: number;
  submissionsAgainst: number;
  // Défense
  attacksReceived: number;
  attacksNeutralized: number;
  scoresConceded: number;
  neutralizationRate: number; // %
  // Divers
  goldenScoreCount: number;
  combatDurationSec: number;
  groundTimeSec: number;
  avgDominanceStanding: number; // %
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
    osaekomiSecFor: 0, osaekomiSecAgainst: 0,
    immoAttempts: 0, immoSuccess: 0, chokeAttempts: 0, chokeSuccess: 0,
    armlockAttempts: 0, armlockSuccess: 0, submissionsFor: 0, submissionsAgainst: 0,
    attacksReceived: 0, attacksNeutralized: 0, scoresConceded: 0, neutralizationRate: 0,
    goldenScoreCount: 0, combatDurationSec: 0, groundTimeSec: 0, avgDominanceStanding: 0,
  };
}

export function summarizeTournamentRounds(rounds: JudoRoundStatsRow[]): JudoTournamentSummary {
  const out = emptyJudoSummary();
  let dominanceSum = 0;
  let dominanceCount = 0;

  for (const r of rounds) {
    const s = r.stats || {};
    out.combats += 1;
    if (isWin(r.result)) out.wins += 1;
    else if (isLoss(r.result)) out.losses += 1;
    else out.draws += 1;

    // Osaekomi -> derive score effectif (10s waza, 20s ippon)
    const osaeMe = num(s["ijf_osaekomi_me_sec"]);
    const osaeOpp = num(s["ijf_osaekomi_opp_sec"]);

    out.ipponFor += num(s["ijf_ippon_me"]) + (osaeMe >= 20 ? 1 : 0);
    out.ipponAgainst += num(s["ijf_ippon_opp"]) + (osaeOpp >= 20 ? 1 : 0);
    out.yukoFor += num(s["ijf_yuko_me"]);
    out.yukoAgainst += num(s["ijf_yuko_opp"]);
    out.wazariFor += num(s["ijf_wazari_me"]) + (osaeMe >= 10 && osaeMe < 20 ? 1 : 0);
    out.wazariAgainst += num(s["ijf_wazari_opp"]) + (osaeOpp >= 10 && osaeOpp < 20 ? 1 : 0);
    out.shidoFor += num(s["ijf_shido_me"]);
    out.shidoAgainst += num(s["ijf_shido_opp"]);
    out.hansokuDirectFor += num(s["ijf_hansoku_direct_me"]) > 0 ? 1 : 0;
    out.hansokuDirectAgainst += num(s["ijf_hansoku_direct_opp"]) > 0 ? 1 : 0;

    out.osaekomiSecFor += osaeMe;
    out.osaekomiSecAgainst += osaeOpp;

    out.immoAttempts += num(s["immobilizationAttempts"]);
    out.immoSuccess += num(s["ijf_immo_success"]);
    out.chokeAttempts += num(s["chokeAttempts"]);
    out.chokeSuccess += num(s["ijf_choke_success"]);
    out.armlockAttempts += num(s["armLockAttempts"]);
    out.armlockSuccess += num(s["ijf_armlock_success"]);
    out.submissionsFor += num(s["ijf_submission_me"]);
    out.submissionsAgainst += num(s["ijf_submission_opp"]);

    out.attacksReceived += num(s["ijf_def_attacks_received"]);
    out.attacksNeutralized += num(s["ijf_def_attacks_neutralized"]);
    out.scoresConceded += num(s["ijf_def_scores_conceded"]);

    if (num(s["goldenScore"]) > 0) out.goldenScoreCount += 1;
    out.combatDurationSec += num(s["combatDuration"]);
    out.groundTimeSec += num(s["groundTimeSeconds"]);

    const dom = num(s["ijf_dominance_standing"]);
    if (dom > 0) {
      dominanceSum += dom;
      dominanceCount += 1;
    }
  }

  const decisive = out.wins + out.losses;
  out.winRate = decisive > 0 ? Math.round((out.wins / decisive) * 1000) / 10 : 0;
  out.neutralizationRate = out.attacksReceived > 0
    ? Math.round((out.attacksNeutralized / out.attacksReceived) * 1000) / 10
    : 0;
  out.avgDominanceStanding = dominanceCount > 0
    ? Math.round((dominanceSum / dominanceCount) * 10) / 10
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
    ],
  },
  {
    title: "Discipline",
    metrics: [
      { key: "shidoFor", label: "Shido reçus", format: "int", higherIsBetter: false },
      { key: "shidoAgainst", label: "Shido adverses", format: "int", higherIsBetter: true },
      { key: "hansokuDirectFor", label: "Hansoku-make subis", format: "int", higherIsBetter: false },
      { key: "hansokuDirectAgainst", label: "Hansoku-make provoqués", format: "int", higherIsBetter: true },
    ],
  },
  {
    title: "Ne-waza",
    metrics: [
      { key: "osaekomiSecFor", label: "Osaekomi cumulé (pour)", format: "duration", higherIsBetter: true },
      { key: "osaekomiSecAgainst", label: "Osaekomi cumulé (contre)", format: "duration", higherIsBetter: false },
      { key: "immoAttempts", label: "Immobilisations tentées", format: "int", higherIsBetter: true },
      { key: "immoSuccess", label: "Immobilisations réussies", format: "int", higherIsBetter: true },
      { key: "chokeAttempts", label: "Étranglements tentés", format: "int", higherIsBetter: true },
      { key: "chokeSuccess", label: "Étranglements réussis", format: "int", higherIsBetter: true },
      { key: "armlockAttempts", label: "Clés tentées", format: "int", higherIsBetter: true },
      { key: "armlockSuccess", label: "Clés réussies", format: "int", higherIsBetter: true },
      { key: "submissionsFor", label: "Abandons provoqués", format: "int", higherIsBetter: true },
      { key: "submissionsAgainst", label: "Abandons subis", format: "int", higherIsBetter: false },
      { key: "groundTimeSec", label: "Temps au sol total", format: "duration", higherIsBetter: true },
    ],
  },
  {
    title: "Défense",
    metrics: [
      { key: "attacksReceived", label: "Attaques reçues", format: "int", higherIsBetter: false },
      { key: "attacksNeutralized", label: "Attaques neutralisées", format: "int", higherIsBetter: true },
      { key: "neutralizationRate", label: "% Neutralisation", format: "percent", higherIsBetter: true },
      { key: "scoresConceded", label: "Scores concédés", format: "int", higherIsBetter: false },
    ],
  },
  {
    title: "Tactique",
    metrics: [
      { key: "goldenScoreCount", label: "Combats en Golden Score", format: "int", higherIsBetter: false },
      { key: "combatDurationSec", label: "Durée cumulée des combats", format: "duration", higherIsBetter: true },
      { key: "avgDominanceStanding", label: "Dominance debout moyenne", format: "percent", higherIsBetter: true },
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
