// Types partagés pour le nouveau module bowling training.

export type BowlingBlockType = "warmup" | "technical" | "tactical" | "games";

export interface BowlingBlockConfig {
  // Commun
  exercise_type?: string;
  // Technique
  parameters?: string[];
  sequence?: string;
  // Tactique
  tactical_type?: string;
  zones?: string[];
  throws_per_zone?: number;
  target_arrow?: string;
  tolerance?: number;
  pattern_length?: number;
  pattern_ratio?: string;
  pattern_volume?: string;
  pattern_difficulty?: string;
  pattern_comment?: string;
  // Parties
  games_count?: number;
  objective?: string;
  // Commun
  target_outcomes?: string[];
}

export interface BowlingSuccessCriteria {
  min_axis_pct?: number;
  min_pocket_pct?: number;
  min_strike_pct?: number;
  min_pocket_strike_pct?: number;
  min_breakpoint_pct?: number;
  min_pin_pct?: number;
  speed_tolerance_kmh?: number;
  consecutive_target?: number;
  min_score?: number;
}

export interface BowlingBlockDraft {
  id?: string;
  block_type: BowlingBlockType;
  title: string;
  duration_min: number;
  planned_throws: number;
  priority: "low" | "medium" | "high";
  coach_instruction: string;
  internal_note: string;
  objectives: string[];
  success_criteria: BowlingSuccessCriteria;
  pattern_id: string | null;
  config: BowlingBlockConfig;
}

export const EMPTY_BLOCK: BowlingBlockDraft = {
  block_type: "technical",
  title: "",
  duration_min: 30,
  planned_throws: 20,
  priority: "medium",
  coach_instruction: "",
  internal_note: "",
  objectives: [],
  success_criteria: {},
  pattern_id: null,
  config: {},
};
