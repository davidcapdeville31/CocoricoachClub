import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAthleteAttributes } from "./useAthleteAttributes";

export interface ExerciseRecommendation {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  description: string | null;
  difficulty: string | null;
  muscle_groups: string[] | null;
  equipment: string[] | null;
  image_url: string | null;
  youtube_url: string | null;
  /** Score de pertinence (plus haut = plus pertinent) */
  matchScore: number;
  /** Pourquoi cet exercice a été recommandé */
  matchReasons: string[];
}

/**
 * Phase 6 — Identité Athlète :
 * Mapping `performance_profile` → catégories d'exercices pertinentes.
 * Chaque profil a un set de catégories prioritaires + bonus.
 */
const PROFILE_TO_CATEGORIES: Record<string, { primary: string[]; bonus: string[] }> = {
  explosif: {
    primary: [
      "explosive", "plyometrics", "plyo_lower_bilateral", "plyo_lower_unilateral",
      "plyo_upper", "plyo_depth_jumps", "plyo_box_jumps", "plyo_reactive",
      "plyo_horizontal", "plyo_lateral", "plyo_medball", "puissance",
      "halterophilie", "halterophilie_snatch", "halterophilie_clean",
      "halterophilie_clean_jerk", "force_vitesse", "vitesse_force",
    ],
    bonus: ["force_max", "contrast_training", "neuro_reaction", "running_acceleration_work", "running_max_velocity"],
  },
  puissant: {
    primary: ["puissance", "force_vitesse", "vitesse_force", "explosive", "halterophilie", "force_max"],
    bonus: ["plyometrics", "contrast_training", "cluster_sets"],
  },
  force_max: {
    primary: ["force_max", "halterophilie", "halterophilie_squats", "halterophilie_pulls_strength", "musculation", "isometrics"],
    bonus: ["excentrique", "tempo_training", "cluster_sets", "puissance"],
  },
  enduran: {
    primary: ["endurance", "endurance_force", "running_ef", "running_seuil", "running_tempo", "running_fartlek", "ergo_rowerg", "ergo_bikeerg", "ergo_skierg"],
    bonus: ["cardio", "interval", "running_vma"],
  },
  endurant: {
    primary: ["endurance", "endurance_force", "running_ef", "running_seuil", "running_tempo", "running_fartlek", "ergo_rowerg", "ergo_bikeerg", "ergo_skierg"],
    bonus: ["cardio", "interval", "running_vma"],
  },
  vitesse: {
    primary: [
      "speed", "running_sprint", "running_vma", "running_acceleration_work",
      "running_max_velocity", "running_sprint_resiste", "running_sprint_assiste",
      "athletisme_starting_blocks", "athletisme_acceleration", "athletisme_max_velocity",
      "vitesse_force", "force_vitesse",
    ],
    bonus: ["plyometrics", "explosive", "neuro_reaction"],
  },
  agile: {
    primary: ["agility", "neuro_coordination", "neuro_reaction", "neuro_dual_task", "running_drills_carioca", "running_drills_lateral", "plyo_lateral"],
    bonus: ["proprioception", "balance_training", "speed"],
  },
  hybrid: {
    primary: ["functional_fitness", "crossfit_wod", "crossfit_amrap", "crossfit_emom", "hyrox_simulation"],
    bonus: ["puissance", "endurance", "musculation"],
  },
  technique: {
    primary: ["mobility", "proprioception", "neuromuscular", "motor_control", "neuro_coordination"],
    bonus: ["dynamic_stretching", "balance_training"],
  },
};

/** Mapping discipline athlétisme → catégories */
const DISCIPLINE_TO_CATEGORIES: Record<string, string[]> = {
  sprint: ["athletisme_starting_blocks", "athletisme_acceleration", "athletisme_max_velocity", "running_sprint", "plyometrics", "halterophilie"],
  haies: ["athletisme_hurdle_drills", "athletisme_hurdle_rhythm", "running_hurdle_mobility", "running_hurdle_trail_leg", "running_hurdle_lead_leg"],
  demi_fond: ["athletisme_intervals", "athletisme_tempo_runs", "running_seuil", "running_vma", "endurance_force"],
  fond: ["athletisme_long_run", "athletisme_fartlek", "running_ef", "running_seuil", "endurance"],
  saut: ["athletisme_approach_work", "athletisme_takeoff_drills", "athletisme_flight_drills", "athletisme_landing", "plyometrics", "explosive"],
  perche: ["athletisme_pole_vault_tech", "athletisme_approach_work", "puissance"],
  lancer: ["athletisme_throwing_drills", "athletisme_rotation_work", "athletisme_release_drills", "athletisme_implement_work", "force_max", "puissance"],
};

export function useRecommendedExercises(playerId?: string | null, opts?: { limit?: number }) {
  const limit = opts?.limit ?? 12;
  const { data: attributes = [] } = useAthleteAttributes(playerId);

  // Charge la bibliothèque (system + user)
  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ["recommended_exercises_library"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_library")
        .select("id, name, category, subcategory, description, difficulty, muscle_groups, equipment, image_url, youtube_url");
      if (error) throw error;
      return data || [];
    },
  });

  const recommendations = useMemo<ExerciseRecommendation[]>(() => {
    if (!exercises.length || !attributes.length) return [];

    // Construit la table catégorie → score
    const categoryScores = new Map<string, { score: number; reasons: Set<string> }>();
    const addScore = (cat: string, pts: number, reason: string) => {
      if (!categoryScores.has(cat)) categoryScores.set(cat, { score: 0, reasons: new Set() });
      const e = categoryScores.get(cat)!;
      e.score += pts;
      e.reasons.add(reason);
    };

    for (const a of attributes) {
      const isPrimary = a.is_primary;
      const weightMul = isPrimary ? 1 : 0.6;

      if (a.dimension === "performance_profile") {
        const map = PROFILE_TO_CATEGORIES[a.value.toLowerCase()];
        if (map) {
          for (const c of map.primary) addScore(c, 10 * weightMul, `profil:${a.value}${isPrimary ? " ⭐" : ""}`);
          for (const c of map.bonus) addScore(c, 4 * weightMul, `profil:${a.value}`);
        }
      }

      if (a.dimension === "discipline") {
        const cats = DISCIPLINE_TO_CATEGORIES[a.value.toLowerCase()];
        if (cats) {
          for (const c of cats) addScore(c, 8 * weightMul, `discipline:${a.value}${isPrimary ? " ⭐" : ""}`);
        }
      }

      // Heuristiques basées sur le poste rugby (illustratif, extensible)
      if (a.dimension === "position") {
        const v = a.value.toLowerCase();
        if (["pilier", "talonneur", "deuxieme_ligne", "prop", "hooker", "lock"].includes(v)) {
          for (const c of ["force_max", "halterophilie", "musculation", "isometrics"]) {
            addScore(c, 6 * weightMul, `poste:${a.value}`);
          }
        }
        if (["ailier", "arriere", "demi_de_melee", "wing", "fullback", "scrum_half"].includes(v)) {
          for (const c of ["speed", "running_sprint", "agility", "plyometrics"]) {
            addScore(c, 6 * weightMul, `poste:${a.value}`);
          }
        }
      }
    }

    // Scoring final des exercices
    return exercises
      .map((ex: any): ExerciseRecommendation => {
        const e = categoryScores.get(ex.category);
        return {
          id: ex.id,
          name: ex.name,
          category: ex.category,
          subcategory: ex.subcategory,
          description: ex.description,
          difficulty: ex.difficulty,
          muscle_groups: ex.muscle_groups,
          equipment: ex.equipment,
          image_url: ex.image_url,
          youtube_url: ex.youtube_url,
          matchScore: e ? Math.round(e.score * 10) / 10 : 0,
          matchReasons: e ? Array.from(e.reasons) : [],
        };
      })
      .filter((r) => r.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  }, [exercises, attributes, limit]);

  return { recommendations, isLoading };
}
