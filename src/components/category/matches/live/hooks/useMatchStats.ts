import { useMemo } from "react";
import type { MatchEvent } from "../types";

export interface TeamStats {
  points: number;
  tries: number;
  conversionsMade: number; conversionsAttempted: number;
  penaltiesMade: number; penaltiesAttempted: number;
  drops: number;
  lineoutsWon: number; lineoutsLost: number;
  scrumsWon: number; scrumsLost: number;
  tackles: number; missedTackles: number;
  turnovers: number;
  fouls: number;
  yellowCards: number; redCards: number;
  knockOns: number;
}

const empty = (): TeamStats => ({
  points: 0, tries: 0,
  conversionsMade: 0, conversionsAttempted: 0,
  penaltiesMade: 0, penaltiesAttempted: 0,
  drops: 0,
  lineoutsWon: 0, lineoutsLost: 0,
  scrumsWon: 0, scrumsLost: 0,
  tackles: 0, missedTackles: 0,
  turnovers: 0, fouls: 0,
  yellowCards: 0, redCards: 0, knockOns: 0,
});

function add(s: TeamStats, e: MatchEvent) {
  s.points += e.points || 0;
  switch (e.event_type) {
    case "try": case "penalty_try": s.tries += 1; break;
    case "conversion":
      s.conversionsAttempted += 1;
      if (e.outcome === "success") s.conversionsMade += 1; break;
    case "penalty_kick":
      s.penaltiesAttempted += 1;
      if (e.outcome === "success") s.penaltiesMade += 1; break;
    case "drop":
      if (e.outcome === "success") s.drops += 1; break;
    case "lineout":
      if (e.outcome === "won") s.lineoutsWon += 1;
      else if (e.outcome === "lost") s.lineoutsLost += 1; break;
    case "scrum":
      if (e.outcome === "won") s.scrumsWon += 1;
      else if (e.outcome === "lost") s.scrumsLost += 1; break;
    case "tackle": s.tackles += 1; break;
    case "missed_tackle": s.missedTackles += 1; break;
    case "turnover": s.turnovers += 1; break;
    case "foul": s.fouls += 1; break;
    case "yellow_card": s.yellowCards += 1; break;
    case "red_card": s.redCards += 1; break;
    case "knock_on": s.knockOns += 1; break;
  }
}

export function useMatchStats(events: MatchEvent[]) {
  return useMemo(() => {
    const home = empty();
    const away = empty();
    const players: Record<string, TeamStats & { events: number }> = {};
    for (const e of events) {
      (e.team_side === "home" ? home : away);
      add(e.team_side === "home" ? home : away, e);
      if (e.player_id) {
        const p = (players[e.player_id] ||= { ...empty(), events: 0 });
        add(p, e);
        p.events += 1;
      }
    }
    return { home, away, players };
  }, [events]);
}
