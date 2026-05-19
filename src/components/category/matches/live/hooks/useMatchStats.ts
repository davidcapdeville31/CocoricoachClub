import { useMemo } from "react";
import type { MatchEvent } from "../types";

export interface FoulsByPlay {
  kick: number;
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
  drops: number;
  lineoutsWon: number; lineoutsLost: number;
  scrumsWon: number; scrumsLost: number;
  tackles: number; missedTackles: number;
  passes: number; missedPasses: number;
  turnovers: number;
  fouls: number;
  foulsByPlay: FoulsByPlay;
  yellowCards: number; redCards: number;
  knockOns: number;
}

const emptyFoulsByPlay = (): FoulsByPlay => ({ kick: 0, penaltouche: 0, scrum: 0, quick: 0, unknown: 0 });

const empty = (): TeamStats => ({
  points: 0, tries: 0,
  conversionsMade: 0, conversionsAttempted: 0,
  penaltiesMade: 0, penaltiesAttempted: 0,
  drops: 0,
  lineoutsWon: 0, lineoutsLost: 0,
  scrumsWon: 0, scrumsLost: 0,
  tackles: 0, missedTackles: 0,
  passes: 0, missedPasses: 0,
  turnovers: 0, fouls: 0,
  foulsByPlay: emptyFoulsByPlay(),
  yellowCards: 0, redCards: 0, knockOns: 0,
});

function add(s: TeamStats, e: MatchEvent) {
  s.points += e.points || 0;
  switch (e.event_type) {
    case "try": case "penalty_try": s.tries += 1; break;
    case "conversion":
      s.conversionsAttempted += 1;
      if (e.outcome === "success") s.conversionsMade += 1; break;
    case "penalty_kick": {
      const mode = (e as any).metadata?.penaltyMode;
      // Only count as a shot at goal if explicitly a kick (not pénaltouche / jeu à la main / mêlée…)
      if (!mode || mode === "kick") {
        s.penaltiesAttempted += 1;
        if (e.outcome === "success") s.penaltiesMade += 1;
      }
      break;
    }
    case "drop":
      if (e.outcome === "success") s.drops += 1; break;
    case "lineout":
      if (e.outcome === "won") s.lineoutsWon += 1;
      else if (e.outcome === "lost") s.lineoutsLost += 1; break;
    case "scrum":
      if (e.outcome === "won") s.scrumsWon += 1;
      else if (e.outcome === "lost") s.scrumsLost += 1; break;
    case "tackle":
      if (e.outcome === "fail") s.missedTackles += 1;
      else s.tackles += 1;
      break;
    case "missed_tackle": s.missedTackles += 1; break;
    case "pass":
      if (e.outcome === "fail") s.missedPasses += 1;
      else s.passes += 1;
      break;
    case "turnover": s.turnovers += 1; break;
    case "foul": {
      s.fouls += 1;
      const fu = (e as any).metadata?.sanctionFollowUp;
      if (fu === "kick" || fu === "penaltouche" || fu === "scrum" || fu === "quick") s.foulsByPlay[fu] += 1;
      else s.foulsByPlay.unknown += 1;
      break;
    }
    case "yellow_card": s.yellowCards += 1; break;
    case "red_card": s.redCards += 1; break;
    case "knock_on": s.knockOns += 1; break;
  }
}

export function useMatchStats(events: MatchEvent[]) {
  return useMemo(() => {
    const home = empty();
    const away = empty();
    const homeH1 = empty();
    const awayH1 = empty();
    const homeH2 = empty();
    const awayH2 = empty();
    const players: Record<string, TeamStats & { events: number }> = {};
    for (const e of events) {
      add(e.team_side === "home" ? home : away, e);
      const isH1 = e.period === "H1" || e.period === "HT";
      const periodTarget = isH1
        ? (e.team_side === "home" ? homeH1 : awayH1)
        : (e.team_side === "home" ? homeH2 : awayH2);
      add(periodTarget, e);
      if (e.player_id) {
        const p = (players[e.player_id] ||= { ...empty(), events: 0 });
        add(p, e);
        p.events += 1;
      }
    }
    return { home, away, homeH1, awayH1, homeH2, awayH2, players };
  }, [events]);
}

