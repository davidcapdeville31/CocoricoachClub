import type { MatchEvent } from "@/components/category/matches/live/types";
import { filterByPeriod, type AnalyticsPeriod } from "./types";

/**
 * Estimation de la possession à partir des événements live.
 *
 * Hypothèse : chaque événement signe une « touche de balle ».
 * On attribue ensuite la touche à l'équipe qui PORTE le ballon
 * au moment de l'événement, puis on calcule un % par équipe.
 *
 *  - pass, kick, line_break, carry, occupation, exit_22, ruck, maul,
 *    kickoff, restart, try, penalty_try, conversion, penalty_kick, drop
 *      → l'équipe (team_side) a le ballon
 *  - lineout / scrum (outcome=won)  → team_side a le ballon
 *  - lineout / scrum (outcome=lost) → adversaire a le ballon
 *  - turnover (gagné par team_side) → team_side a le ballon
 *  - tackle / missed_tackle         → adversaire a le ballon
 *    (l'équipe qui plaque ne porte pas la balle)
 *  - knock_on                       → adversaire récupère le ballon
 *  - foul, cards, substitution, injury → ignoré (neutre)
 */
export interface PossessionResult {
  home: number;
  away: number;
  total: number;
  homePct: number;
  awayPct: number;
}

const HAS_BALL: Record<string, boolean> = {
  pass: true,
  kick: true,
  line_break: true,
  linebreak: true,
  carry: true,
  offload: true,
  occupation: true,
  exit_22: true,
  ruck: true,
  maul: true,
  kickoff: true,
  restart: true,
  try: true,
  penalty_try: true,
  conversion: true,
  penalty_kick: true,
  drop: true,
};

const OPPONENT_HAS_BALL: Record<string, boolean> = {
  tackle: true,
  missed_tackle: true,
  knock_on: true,
};

export function computePossession(
  events: MatchEvent[],
  period: AnalyticsPeriod = "all",
): PossessionResult {
  const filtered = filterByPeriod(events, period);
  let home = 0;
  let away = 0;
  const add = (side: "home" | "away") => {
    if (side === "home") home += 1;
    else away += 1;
  };

  for (const e of filtered) {
    const type = e.event_type as string;
    const side = e.team_side;
    const other: "home" | "away" = side === "home" ? "away" : "home";

    if (HAS_BALL[type]) {
      add(side);
      continue;
    }
    if (OPPONENT_HAS_BALL[type]) {
      add(other);
      continue;
    }
    if (type === "lineout" || type === "scrum") {
      if (e.outcome === "won") add(side);
      else if (e.outcome === "lost") add(other);
      continue;
    }
    if (type === "turnover") {
      // Convention : turnover crédité à l'équipe qui RÉCUPÈRE le ballon.
      add(side);
      continue;
    }
    // foul, yellow_card, red_card, substitution, injury → neutre
  }

  const total = home + away;
  return {
    home,
    away,
    total,
    homePct: total > 0 ? Math.round((home / total) * 100) : 0,
    awayPct: total > 0 ? Math.round((away / total) * 100) : 0,
  };
}
