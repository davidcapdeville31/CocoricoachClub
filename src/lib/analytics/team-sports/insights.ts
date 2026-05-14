import type { TeamStats } from "./types";
import { tackleRatio, kickRatio } from "./eventAggregator";

export type InsightTone = "positive" | "negative" | "warning" | "neutral";

export interface Insight {
  tone: InsightTone;
  title: string;
  detail?: string;
}

/** Generate human-readable insights for the home team based on the score sheet. */
export function generateInsights(home: TeamStats, away: TeamStats, homeName: string, awayName: string): Insight[] {
  const out: Insight[] = [];

  // Result
  if (home.points > away.points) out.push({ tone: "positive", title: `Victoire ${homeName}`, detail: `+${home.points - away.points} points d'écart` });
  else if (home.points < away.points) out.push({ tone: "negative", title: `Défaite face à ${awayName}`, detail: `${away.points - home.points} points d'écart` });

  // Defense
  const homeTR = tackleRatio(home);
  const awayTR = tackleRatio(away);
  if (home.tackles + home.missedTackles > 5) {
    if (homeTR >= 85) out.push({ tone: "positive", title: "Domination défensive", detail: `${homeTR}% de plaquages réussis` });
    else if (homeTR < 70) out.push({ tone: "negative", title: "Très faible efficacité défensive", detail: `${homeTR}% de plaquages réussis` });
  }

  // Attack
  if (home.tries > away.tries + 1) out.push({ tone: "positive", title: "Domination offensive", detail: `${home.tries} essais marqués` });
  else if (home.tries === 0 && away.tries >= 1) out.push({ tone: "negative", title: "Faible efficacité offensive", detail: "Aucun essai inscrit" });

  // Ball management
  if (home.ballsLost >= 8 && home.ballsLost > home.ballsWon) {
    out.push({ tone: "warning", title: "Beaucoup de pertes de balle", detail: `${home.ballsLost} ballons perdus` });
  }
  if (home.turnovers >= 5 && home.turnovers > away.turnovers) {
    out.push({ tone: "positive", title: "Pression au sol efficace", detail: `${home.turnovers} turnovers gagnés` });
  }

  // Discipline
  if (home.fouls >= 10) out.push({ tone: "warning", title: "Indiscipline préoccupante", detail: `${home.fouls} pénalités concédées` });
  if (home.yellowCards + home.redCards >= 2) out.push({ tone: "negative", title: "Cartons à répétition", detail: `${home.yellowCards} jaune(s) · ${home.redCards} rouge(s)` });

  // Set piece
  const lineoutTotal = home.lineoutsWon + home.lineoutsLost;
  if (lineoutTotal >= 5) {
    const ratio = Math.round((home.lineoutsWon / lineoutTotal) * 100);
    if (ratio < 60) out.push({ tone: "warning", title: "Conquête en touche fragile", detail: `${ratio}% de touches gagnées` });
    else if (ratio >= 90) out.push({ tone: "positive", title: "Touche maîtrisée", detail: `${ratio}% de réussite` });
  }
  const scrumTotal = home.scrumsWon + home.scrumsLost;
  if (scrumTotal >= 5) {
    const ratio = Math.round((home.scrumsWon / scrumTotal) * 100);
    if (ratio < 60) out.push({ tone: "warning", title: "Mêlée en difficulté", detail: `${ratio}% de mêlées gagnées` });
  }

  // Kicking
  if (home.conversionsAttempted >= 3) {
    const r = kickRatio(home.conversionsMade, home.conversionsAttempted);
    if (r < 50) out.push({ tone: "warning", title: "Tirs au but à travailler", detail: `${r}% de transformations` });
  }

  return out.slice(0, 4);
}
