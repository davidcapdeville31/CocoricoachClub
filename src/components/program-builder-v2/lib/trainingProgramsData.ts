// V2 namespace - minimal copy of trainingProgramsData.
// Original (3050 lines) contains 30+ predefined programs not needed for session editor.
// We keep only types + DAYS_OF_WEEK + an empty PROGRAM_CATEGORIES skeleton.

export interface ProgramExercise {
  name: string;
  sets: number;
  reps: string;
  percentage?: number;
  rpe?: number;
  rest?: string;
  notes?: string;
}

export interface ProgramDay {
  name: string;
  exercises: ProgramExercise[];
  dayOfWeek?: string;
}

export interface ProgramWeek {
  weekNumber: number;
  name?: string;
  days: ProgramDay[];
}

export interface TrainingProgram {
  name: string;
  description: string;
  category: string;
  subcategory: string;
  durationWeeks: number;
  daysPerWeek: number;
  difficultyLevel: string;
  requiredTests: string[];
  weeks: ProgramWeek[];
  image_url?: string | null;
  image_crop?: any | null;
}

export const DAYS_OF_WEEK = [
  { id: "monday", label: "Lundi", shortLabel: "Lun" },
  { id: "tuesday", label: "Mardi", shortLabel: "Mar" },
  { id: "wednesday", label: "Mercredi", shortLabel: "Mer" },
  { id: "thursday", label: "Jeudi", shortLabel: "Jeu" },
  { id: "friday", label: "Vendredi", shortLabel: "Ven" },
  { id: "saturday", label: "Samedi", shortLabel: "Sam" },
  { id: "sunday", label: "Dimanche", shortLabel: "Dim" },
] as const;

// Empty in V2 — predefined programs library not used by SessionEditor flow.
export const ALL_PROGRAMS: TrainingProgram[] = [];

export const PROGRAM_CATEGORIES: Array<{
  category: string;
  sub_categories: { name: string; programs: TrainingProgram[] }[];
}> = [];
