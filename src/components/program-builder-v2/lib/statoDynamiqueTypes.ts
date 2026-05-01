/**
 * Stato-Dynamique Training Method Types and Configuration
 */
import { SetData } from './variableSetsTypes';

export type StaticAngleType = '60' | '90' | '120';
export type StaticPhaseTimingType = 'excentrique' | 'concentrique' | 'pivot';

export interface StaticPhaseConfig {
  id: string;
  durationSeconds: number;
  angle: StaticAngleType;
  timing: StaticPhaseTimingType;
}

export type StatoDynamiqueSequence = 'statique_dynamique' | 'dynamique_statique' | 'alternance';
export type DynamicAmplitude = 'complete' | 'partielle';
export type LoadType = 'pourcentage_1rm' | 'charge_libre' | 'rpe';
export type AthleteLevel = 'debutant' | 'intermediaire' | 'avance';

export interface StatoDynamiqueConfig {
  exerciseId?: string;
  exerciseName?: string;
  staticPhases: StaticPhaseConfig[];
  staticDurationSeconds?: number;
  staticAngle?: StaticAngleType;
  staticPhaseTiming?: StaticPhaseTimingType;
  dynamicReps: number;
  dynamicAmplitude: DynamicAmplitude;
  dynamicTempo?: string;
  sequence: StatoDynamiqueSequence;
  sets: number;
  restSeconds: number;
  variableSets?: SetData[];
  useVariableSets?: boolean;
  loadType: LoadType;
  loadValue?: number;
  targetRpe?: number;
  athleteLevel?: AthleteLevel;
  coachNotes?: string;
}

export interface StatoDynamiqueFeedback {
  actualSets?: number;
  actualReps?: number;
  actualWeightKg?: number;
  staticMaintained?: 'oui' | 'non' | 'partiel';
  rpe?: number;
  sensationsMusculaires?: 'brulure' | 'fatigue' | 'congestionnement' | 'aucune' | 'douleur';
  commentaire?: string;
}

export const STATIC_ANGLES: Record<StaticAngleType, { label: string; description: string }> = {
  '60': { label: '60°', description: 'Angle fermé - Position basse du mouvement' },
  '90': { label: '90°', description: 'Angle droit - Position médiane du mouvement' },
  '120': { label: '120°', description: 'Angle ouvert - Position haute du mouvement' },
};

export const STATIC_PHASE_TIMING: Record<StaticPhaseTimingType, { label: string; description: string }> = {
  excentrique: { label: 'Phase excentrique', description: 'Maintien isométrique pendant la phase de descente' },
  concentrique: { label: 'Phase concentrique', description: 'Maintien isométrique pendant la phase de montée' },
  pivot: { label: 'Point pivot', description: 'Maintien isométrique au point de transition' },
};

export const SEQUENCE_TYPES: Record<StatoDynamiqueSequence, { label: string; description: string }> = {
  statique_dynamique: { label: 'Statique → Dynamique', description: 'Commencer par le maintien isométrique puis enchaîner les répétitions dynamiques' },
  dynamique_statique: { label: 'Dynamique → Statique', description: 'Réaliser les répétitions dynamiques puis terminer par un maintien isométrique' },
  alternance: { label: 'Alternance', description: 'Alterner entre phases isométriques et dynamiques au sein de chaque répétition' },
};

export const AMPLITUDE_TYPES: Record<DynamicAmplitude, string> = {
  complete: 'Amplitude complète',
  partielle: 'Amplitude partielle',
};

export const LOAD_TYPES: Record<LoadType, { label: string; unit: string; placeholder: string }> = {
  pourcentage_1rm: { label: '% 1RM', unit: '%', placeholder: '70' },
  charge_libre: { label: 'Charge (kg)', unit: 'kg', placeholder: '50' },
  rpe: { label: 'RPE cible', unit: '/10', placeholder: '8' },
};

export const ATHLETE_LEVELS: Record<AthleteLevel, { label: string; adaptations: string }> = {
  debutant: { label: 'Débutant', adaptations: 'Maintiens courts, charges légères' },
  intermediaire: { label: 'Intermédiaire', adaptations: 'Durées et charges standard' },
  avance: { label: 'Avancé', adaptations: 'Maintiens longs, charges lourdes' },
};

export const generateStaticPhaseId = (): string =>
  `sp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const createDefaultStaticPhase = (): StaticPhaseConfig => ({
  id: generateStaticPhaseId(),
  durationSeconds: 15,
  angle: '90',
  timing: 'pivot',
});

export const getDefaultStatoDynamiqueConfig = (): StatoDynamiqueConfig => ({
  staticPhases: [createDefaultStaticPhase()],
  dynamicReps: 8,
  dynamicAmplitude: 'complete',
  dynamicTempo: '2-0-2',
  sequence: 'statique_dynamique',
  sets: 3,
  restSeconds: 90,
  loadType: 'pourcentage_1rm',
  loadValue: 70,
  athleteLevel: 'intermediaire',
});

export const formatStatoDynamiqueSummary = (config: StatoDynamiqueConfig): string => {
  const phases = config.staticPhases || [];
  const phaseCount = phases.length || 1;
  const loadDisplay = config.loadType === 'pourcentage_1rm'
    ? `${config.loadValue}% 1RM`
    : config.loadType === 'charge_libre'
      ? `${config.loadValue}kg`
      : `RPE ${config.loadValue}`;
  const getTimingShort = (timing: StaticPhaseTimingType): string => {
    switch (timing) {
      case 'excentrique': return 'exc';
      case 'concentrique': return 'conc';
      case 'pivot': return 'pivot';
      default: return '';
    }
  };
  let phaseLabel: string;
  if (phaseCount === 1) {
    const phase = phases[0];
    phaseLabel = phase ? `${phase.durationSeconds}s @ ${phase.angle}° ${getTimingShort(phase.timing)}` : `${config.staticDurationSeconds || 15}s iso`;
  } else {
    phaseLabel = phases.map(p => `${p.durationSeconds}s ${getTimingShort(p.timing)}`).join(' + ');
  }
  return `${config.sets}×(${phaseLabel} + ${config.dynamicReps} reps) @ ${loadDisplay}`;
};
