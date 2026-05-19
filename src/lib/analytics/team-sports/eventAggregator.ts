import { emptyTeamStats, filterByPeriod, type AnalyticsPeriod, type MatchEvent, type PlayerAggStats, type TeamStats } from "./types";

function applyEvent(s: TeamStats, e: MatchEvent) {
  s.points += e.points || 0;
  const m = (e.metadata || {}) as any;
  switch (e.event_type) {
    case "try":
    case "penalty_try":
      s.tries += 1; break;
    case "conversion":
      s.conversionsAttempted += 1;
      if (e.outcome === "success") s.conversionsMade += 1; break;
    case "penalty_kick": {
      const mode = m.penaltyMode;
      if (!mode || mode === "kick") {
        s.penaltiesAttempted += 1;
        if (e.outcome === "success") s.penaltiesMade += 1;
      }
      break;
    }
    case "drop":
      s.dropsAttempted += 1;
      if (e.outcome === "success") s.drops += 1; break;
    case "tackle":
      if (e.outcome === "fail") s.missedTackles += 1; else s.tackles += 1; break;
    case "missed_tackle":
      s.missedTackles += 1; break;
    case "turnover":
      s.turnovers += 1; s.ballsWon += 1; break;
    case "knock_on":
      s.knockOns += 1; s.ballsLost += 1; break;
    case "foul": {
      s.fouls += 1;
      const fu = m.sanctionFollowUp;
      if (fu === "kick" || fu === "penaltouche" || fu === "scrum" || fu === "quick") s.foulsByPlay[fu] += 1;
      else s.foulsByPlay.unknown += 1;
      break;
    }
    case "yellow_card":
      s.yellowCards += 1; break;
    case "red_card":
      s.redCards += 1; break;
    case "lineout":
      if (e.outcome === "won") s.lineoutsWon += 1;
      else if (e.outcome === "lost") s.lineoutsLost += 1; break;
    case "scrum":
      if (e.outcome === "won") s.scrumsWon += 1;
      else if (e.outcome === "lost") s.scrumsLost += 1; break;
  }
  // Optional metadata-based stats
  if (typeof m.meters === "number") s.meters += m.meters;
  if (m.lineBreak === true || e.event_type === "linebreak" || e.event_type === "line_break") s.lineBreaks += 1;
  if (e.event_type === "offload") s.offloads += 1;
  if (e.event_type === "pass") {
    if (e.outcome === "fail") s.passesMissed += 1; else s.passes += 1;
  }
  if (e.event_type === "kick") {
    if (e.outcome === "fail") s.kicksMissed += 1; else s.kicks += 1;
  }
  if (e.event_type === "carry") s.carries += 1;
}

export interface MatchAnalytics {
  home: TeamStats;
  away: TeamStats;
  /** keyed by player_id */
  players: Record<string, PlayerAggStats>;
  /** Score timeline for momentum chart: cumulative points per minute */
  momentum: { minute: number; home: number; away: number }[];
  totalEvents: number;
}

export function computeMatchAnalytics(events: MatchEvent[], period: AnalyticsPeriod): MatchAnalytics {
  const filtered = filterByPeriod(events, period);
  const home = emptyTeamStats();
  const away = emptyTeamStats();
  const players: Record<string, PlayerAggStats> = {};

  for (const e of filtered) {
    applyEvent(e.team_side === "home" ? home : away, e);
    if (e.player_id) {
      const p = players[e.player_id] ||= { ...emptyTeamStats(), events: 0, playTimeMinutes: 0 };
      applyEvent(p, e);
      p.events += 1;
    }
  }

  // Momentum: cumulative score by minute (use full match for context, but filter shows period)
  const momentum: { minute: number; home: number; away: number }[] = [];
  let h = 0, a = 0;
  const sorted = [...filtered].sort((x, y) => (x.minute - y.minute) || (x.second - y.second));
  for (const e of sorted) {
    if (e.points && e.points > 0) {
      if (e.team_side === "home") h += e.points; else a += e.points;
      momentum.push({ minute: e.minute, home: h, away: a });
    }
  }

  // Play time from substitutions: a player without subs is assumed to have played all (period-dependent).
  // Best-effort: count play minutes from their first event to last event.
  const periodMaxMinute = period === "H1" ? 40 : period === "H2" ? 80 : 80;
  for (const [pid, p] of Object.entries(players)) {
    const playerEvents = filtered.filter(e => e.player_id === pid);
    if (playerEvents.length === 0) continue;
    const minMinute = Math.min(...playerEvents.map(e => e.minute));
    const maxMinute = Math.max(...playerEvents.map(e => e.minute));
    p.playTimeMinutes = Math.min(periodMaxMinute, Math.max(1, maxMinute - minMinute + 5));
  }

  return { home, away, players, momentum, totalEvents: filtered.length };
}

export function tackleRatio(s: TeamStats): number {
  const tot = s.tackles + s.missedTackles;
  return tot ? Math.round((s.tackles / tot) * 100) : 0;
}

export function kickRatio(made: number, attempted: number): number {
  return attempted ? Math.round((made / attempted) * 100) : 0;
}
