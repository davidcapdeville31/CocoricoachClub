import type { MatchEvent, Period } from "@/components/category/matches/live/types";

export type AnalyticsPeriod = "all" | "H1" | "H2";

export interface FoulsByPlay {
  kick: number;
  points: number;
  penaltouche: number;
  scrum: number;
  quick: number;
  unknown: number;
}

export interface TeamStats {
  points: number;
  tries: number;
  conversionsMade: number; conversionsAttempted: number;
  penaltiesMade: number; penaltiesAttempted: number;
  drops: number; dropsAttempted: number;
  // Defense
  tackles: number; missedTackles: number;
  // Game
  turnovers: number; ballsWon: number; ballsLost: number;
  meters: number; lineBreaks: number; offloads: number; passes: number; passesMissed: number; carries: number; kicks: number; kicksMissed: number;
  // Discipline
  fouls: number; yellowCards: number; redCards: number; knockOns: number;
  foulsByPlay: FoulsByPlay;
  // Set piece
  lineoutsWon: number; lineoutsLost: number;
  scrumsWon: number; scrumsLost: number;
}

export interface PlayerAggStats extends TeamStats {
  events: number;
  playTimeMinutes: number;
}

export const emptyFoulsByPlay = (): FoulsByPlay => ({ kick: 0, penaltouche: 0, scrum: 0, quick: 0, unknown: 0 });

export const emptyTeamStats = (): TeamStats => ({
  points: 0, tries: 0,
  conversionsMade: 0, conversionsAttempted: 0,
  penaltiesMade: 0, penaltiesAttempted: 0,
  drops: 0, dropsAttempted: 0,
  tackles: 0, missedTackles: 0,
  turnovers: 0, ballsWon: 0, ballsLost: 0,
  meters: 0, lineBreaks: 0, offloads: 0, passes: 0, passesMissed: 0, carries: 0, kicks: 0, kicksMissed: 0,
  fouls: 0, yellowCards: 0, redCards: 0, knockOns: 0,
  foulsByPlay: emptyFoulsByPlay(),
  lineoutsWon: 0, lineoutsLost: 0,
  scrumsWon: 0, scrumsLost: 0,
});

export function filterByPeriod(events: MatchEvent[], period: AnalyticsPeriod): MatchEvent[] {
  if (period === "all") return events;
  if (period === "H1") return events.filter(e => e.period === "H1" || e.period === "HT");
  return events.filter(e => e.period === "H2" || e.period === "ET");
}

export type { MatchEvent, Period };
