// Helpers pour les statistiques d'analyse adversaires (judo)

export type OpponentResult = "win" | "loss" | "draw" | "unknown";

const WIN_TOKENS = ["v", "w", "win", "victoire", "ippon", "wazari", "yuko"];
const LOSS_TOKENS = ["d", "l", "loss", "defaite", "défaite", "perdu"];
const DRAW_TOKENS = ["n", "nul", "draw", "egalite", "égalité"];

export function normalizeResult(raw: string | null | undefined): OpponentResult {
  if (!raw) return "unknown";
  const s = raw.toString().trim().toLowerCase();
  if (!s) return "unknown";
  // Score patterns like "10-5" → win, "5-10" → loss, "5-5" → draw
  const m = s.match(/^(\d+)\s*[-–:\/]\s*(\d+)$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (a > b) return "win";
    if (a < b) return "loss";
    return "draw";
  }
  if (DRAW_TOKENS.some((t) => s === t || s.startsWith(t))) return "draw";
  if (WIN_TOKENS.some((t) => s === t || s.startsWith(t))) return "win";
  if (LOSS_TOKENS.some((t) => s === t || s.startsWith(t))) return "loss";
  return "unknown";
}

export interface RoundLike {
  result?: string | null;
  opponent_profile?: {
    handedness?: string | null;
    weight_category?: string | null;
    gender?: string | null;
    fighting_style?: string | null;
  } | null;
}

export interface GroupBucket {
  key: string;
  label: string;
  wins: number;
  losses: number;
  draws: number;
  total: number;
  winRate: number; // 0..100, basé sur (wins / (wins+losses)) si dispo
}

function bucket(label: string): GroupBucket {
  return { key: label, label, wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 };
}

function finalize(b: GroupBucket): GroupBucket {
  const decisive = b.wins + b.losses;
  b.winRate = decisive > 0 ? Math.round((b.wins / decisive) * 1000) / 10 : 0;
  return b;
}

export function computeOpponentStats(rounds: RoundLike[]) {
  const overall = bucket("Total");
  const byHandedness: Record<string, GroupBucket> = {};
  const byWeight: Record<string, GroupBucket> = {};
  const byGender: Record<string, GroupBucket> = {};

  const handLabel = (h?: string | null) =>
    h === "left"
      ? "Gauchers"
      : h === "right"
      ? "Droitiers"
      : h === "ambidextrous"
      ? "Ambidextres"
      : "Non renseigné";
  const genderLabel = (g?: string | null) =>
    g === "male" ? "Hommes" : g === "female" ? "Femmes" : g === "other" ? "Autre" : "Non renseigné";

  for (const r of rounds) {
    const res = normalizeResult(r.result);
    if (res === "unknown") continue;
    const op = r.opponent_profile || null;
    overall.total += 1;
    if (res === "win") overall.wins += 1;
    else if (res === "loss") overall.losses += 1;
    else overall.draws += 1;

    const hKey = op?.handedness || "unknown";
    if (!byHandedness[hKey]) byHandedness[hKey] = bucket(handLabel(op?.handedness));
    const hb = byHandedness[hKey];
    hb.total += 1;
    if (res === "win") hb.wins += 1;
    else if (res === "loss") hb.losses += 1;
    else hb.draws += 1;

    const wKey = op?.weight_category || "unknown";
    if (!byWeight[wKey]) byWeight[wKey] = bucket(wKey === "unknown" ? "Non renseigné" : wKey.replace(/^judo_/, ""));
    const wb = byWeight[wKey];
    wb.total += 1;
    if (res === "win") wb.wins += 1;
    else if (res === "loss") wb.losses += 1;
    else wb.draws += 1;

    const gKey = op?.gender || "unknown";
    if (!byGender[gKey]) byGender[gKey] = bucket(genderLabel(op?.gender));
    const gb = byGender[gKey];
    gb.total += 1;
    if (res === "win") gb.wins += 1;
    else if (res === "loss") gb.losses += 1;
    else gb.draws += 1;
  }

  return {
    overall: finalize(overall),
    byHandedness: Object.values(byHandedness).map(finalize),
    byWeight: Object.values(byWeight).map(finalize),
    byGender: Object.values(byGender).map(finalize),
  };
}
