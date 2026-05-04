/**
 * Rest-Pause — Structure de données UNIQUE
 */

export interface RestPauseMiniSet {
  /** Reps cible — "MAX" par défaut, modifiable (number ou "MAX") */
  reps: "MAX" | number | string;
  pauseSeconds: number;
  // Variables dynamiques optionnelles par mini-série
  percentage?: number;
  load?: number;
  tempo?: string;
  rpe?: number;
  rir?: number;
}

export interface RestPauseSeries {
  miniSets: RestPauseMiniSet[];
  recoverySeconds?: number;
  // Variables dynamiques optionnelles par série
  percentage?: number;
  load?: number;
  tempo?: string;
  rpe?: number;
  rir?: number;
  reps?: number;
}

/** Variables dynamiques disponibles pour Rest-Pause */
export interface RestPauseVariable {
  key: 'percentage' | 'load' | 'tempo' | 'rpe' | 'rir' | 'reps';
  label: string;
  placeholder: string;
  unit?: string;
  type: 'number' | 'text';
}

export const REST_PAUSE_VARIABLES: RestPauseVariable[] = [
  { key: 'load', label: 'Charge', placeholder: '50', unit: 'kg', type: 'number' },
  { key: 'percentage', label: '%1RM', placeholder: '75', unit: '%', type: 'number' },
  { key: 'reps', label: 'Reps', placeholder: '8', unit: 'reps', type: 'number' },
  { key: 'tempo', label: 'Tempo', placeholder: '2-0-1-0', type: 'text' },
  { key: 'rpe', label: 'RPE', placeholder: '10', type: 'number' },
  { key: 'rir', label: 'RIR', placeholder: '0', type: 'number' },
];

/** Objet unique stocké sur ProgramExercise.restPauseConfig */
export interface RestPauseConfig {
  series: RestPauseSeries[];
  /** Variables visibles pour toutes les séries */
  visibleVariables?: string[];
  /** Variables visibles pour toutes les mini-séries */
  visibleMiniSetVariables?: string[];
}
