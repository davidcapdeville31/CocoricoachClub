export type EventType =
  | "try" | "penalty_try" | "conversion" | "penalty_kick" | "drop"
  | "lineout" | "scrum" | "ruck" | "maul"
  | "tackle" | "missed_tackle" | "turnover" | "knock_on" | "foul"
  | "yellow_card" | "red_card" | "substitution" | "injury"
  | "kickoff" | "restart" | "kick" | "occupation" | "exit_22"
  | "pass" | "line_break";

export type Period = "H1" | "HT" | "H2" | "ET";
export type TeamSide = "home" | "away";
export type Outcome = "success" | "fail" | "won" | "lost" | "contested" | null;

export interface MatchEvent {
  id: string;
  match_id: string;
  team_side: TeamSide;
  player_id: string | null;
  minute: number;
  second: number;
  period: Period;
  event_type: EventType | string;
  event_subtype: string | null;
  outcome: Outcome | string | null;
  points: number;
  metadata: Record<string, any>;
  created_at: string;
}

export const EVENT_LABELS: Record<string, string> = {
  try: "Essai",
  penalty_try: "Essai de pénalité",
  conversion: "Transformation",
  penalty_kick: "Pénalité",
  drop: "Drop",
  lineout: "Touche",
  scrum: "Mêlée",
  ruck: "Ruck",
  maul: "Maul / Ballon porté",
  tackle: "Plaquage",
  missed_tackle: "Plaquage manqué",
  turnover: "Turnover",
  knock_on: "En-avant",
  foul: "Faute",
  yellow_card: "Carton jaune",
  red_card: "Carton rouge",
  substitution: "Remplacement",
  injury: "Blessure",
  kickoff: "Coup d'envoi",
  restart: "Renvoi",
  kick: "Jeu au pied",
  occupation: "Occupation",
  exit_22: "Sortie de camp",
  pass: "Passe",
  line_break: "Franchissement",
};
