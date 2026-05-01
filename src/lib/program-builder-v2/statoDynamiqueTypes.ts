/**
 * Stato-Dynamique Training Method Types and Configuration
 * Méthode de renforcement musculaire combinant des phases de contraction 
 * isométrique (statique) et des phases de contractions dynamiques.
 */

// Static angle types (in degrees)
export type StaticAngleType = '60' | '90' | '120';

// Static phase timing (when the isometric hold occurs)
export type StaticPhaseTimingType = 'excentrique' | 'concentrique' | 'pivot';

// Individual static phase configuration
export interface StaticPhaseConfig {
  id: string;
  durationSeconds: number; // 5-30 seconds
  angle: StaticAngleType;
  timing: StaticPhaseTimingType;
}

// Sequence types
export type StatoDynamiqueSequence = 
  | 'statique_dynamique'   // Static → Dynamic
  | 'dynamique_statique'   // Dynamic → Static
  | 'alternance';          // Alternating

// Dynamic amplitude
export type DynamicAmplitude = 'complete' | 'partielle';

// Load type
export type LoadType = 'pourcentage_1rm' | 'charge_libre' | 'rpe';

// Athlete level for adaptations
export type AthleteLevel = 'debutant' | 'intermediaire' | 'avance';

// Import for variable sets support
import { SetData } from './variableSetsTypes';

// Full Stato-Dynamique configuration
export interface StatoDynamiqueConfig {
  // Exercise info (stored separately in the block)
  exerciseId?: string;
  exerciseName?: string;
  
  // Static phases (can have multiple)
  staticPhases: StaticPhaseConfig[];
  
  // Legacy fields for backwards compatibility (deprecated)
  staticDurationSeconds?: number;
  staticAngle?: StaticAngleType;
  staticPhaseTiming?: StaticPhaseTimingType;
  
  // Dynamic phase
  dynamicReps: number;
  dynamicAmplitude: DynamicAmplitude;
  dynamicTempo?: string; // e.g., "2-0-2"
  
  // Sequence
  sequence: StatoDynamiqueSequence;
  
  // Sets and recovery
  sets: number;
  restSeconds: number;
  
  // Variable sets support
  variableSets?: SetData[];
  useVariableSets?: boolean;
  
  // Load configuration
  loadType: LoadType;
  loadValue?: number; // % 1RM, kg, or RPE value
  targetRpe?: number; // 1-10
  
  // Athlete adaptation
  athleteLevel?: AthleteLevel;
  
  // Coach notes
  coachNotes?: string;
}

// Athlete feedback for post-session tracking
export interface StatoDynamiqueFeedback {
  // Actual values
  actualSets?: number;
  actualReps?: number;
  actualWeightKg?: number;
  
  // Static maintenance
  staticMaintained?: 'oui' | 'non' | 'partiel';
  
  // Perceived exertion
  rpe?: number; // 1-10
  
  // Muscular sensations
  sensationsMusculaires?: 'brulure' | 'fatigue' | 'congestionnement' | 'aucune' | 'douleur';
  
  // Free comment
  commentaire?: string;
}

// Static angle labels for display
export const STATIC_ANGLES: Record<StaticAngleType, { label: string; description: string }> = {
  '60': {
    label: '60°',
    description: 'Angle fermé - Position basse du mouvement (ex: bas du squat, bas du développé couché)'
  },
  '90': {
    label: '90°',
    description: 'Angle droit - Position médiane du mouvement'
  },
  '120': {
    label: '120°',
    description: 'Angle ouvert - Position haute du mouvement, proche de la fin du concentrique'
  }
};

// Static phase timing labels for display
export const STATIC_PHASE_TIMING: Record<StaticPhaseTimingType, { label: string; description: string }> = {
  excentrique: {
    label: 'Phase excentrique',
    description: 'Maintien isométrique pendant la phase de descente/allongement du muscle'
  },
  concentrique: {
    label: 'Phase concentrique',
    description: 'Maintien isométrique pendant la phase de montée/raccourcissement du muscle'
  },
  pivot: {
    label: 'Point pivot',
    description: 'Maintien isométrique au point de transition entre les phases excentrique et concentrique'
  }
};

// Sequence labels
export const SEQUENCE_TYPES: Record<StatoDynamiqueSequence, { label: string; description: string }> = {
  statique_dynamique: {
    label: 'Statique → Dynamique',
    description: 'Commencer par le maintien isométrique puis enchaîner les répétitions dynamiques'
  },
  dynamique_statique: {
    label: 'Dynamique → Statique',
    description: 'Réaliser les répétitions dynamiques puis terminer par un maintien isométrique'
  },
  alternance: {
    label: 'Alternance',
    description: 'Alterner entre phases isométriques et dynamiques au sein de chaque répétition'
  }
};

// Amplitude labels
export const AMPLITUDE_TYPES: Record<DynamicAmplitude, string> = {
  complete: 'Amplitude complète',
  partielle: 'Amplitude partielle'
};

// Load type labels
export const LOAD_TYPES: Record<LoadType, { label: string; unit: string; placeholder: string }> = {
  pourcentage_1rm: { label: '% 1RM', unit: '%', placeholder: '70' },
  charge_libre: { label: 'Charge (kg)', unit: 'kg', placeholder: '50' },
  rpe: { label: 'RPE cible', unit: '/10', placeholder: '8' }
};

// Athlete level labels
export const ATHLETE_LEVELS: Record<AthleteLevel, { label: string; adaptations: string }> = {
  debutant: {
    label: 'Débutant',
    adaptations: 'Maintiens courts (5-10s), charges légères, récupérations longues'
  },
  intermediaire: {
    label: 'Intermédiaire',
    adaptations: 'Durées et charges standard'
  },
  avance: {
    label: 'Avancé',
    adaptations: 'Maintiens longs (20-30s), charges lourdes, récupérations courtes'
  }
};

// Sensation labels for feedback
export const SENSATIONS_LABELS: Record<NonNullable<StatoDynamiqueFeedback['sensationsMusculaires']>, string> = {
  brulure: 'Brûlure musculaire',
  fatigue: 'Fatigue profonde',
  congestionnement: 'Congestion / Pump',
  aucune: 'Aucune sensation particulière',
  douleur: 'Douleur (attention)'
};

// Static maintenance labels
export const STATIC_MAINTAINED_LABELS: Record<NonNullable<StatoDynamiqueFeedback['staticMaintained']>, string> = {
  oui: 'Maintien complet',
  partiel: 'Maintien partiel',
  non: 'Non maintenu'
};

// Generate unique ID for static phases
export const generateStaticPhaseId = (): string => {
  return `sp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Create a default static phase
export const createDefaultStaticPhase = (): StaticPhaseConfig => ({
  id: generateStaticPhaseId(),
  durationSeconds: 15,
  angle: '90',
  timing: 'pivot',
});

// Default configuration
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
  athleteLevel: 'intermediaire'
});

// Preset configurations based on athlete level
export const STATO_PRESETS: Record<AthleteLevel, Partial<StatoDynamiqueConfig>> = {
  debutant: {
    staticDurationSeconds: 8,
    dynamicReps: 10,
    sets: 3,
    restSeconds: 120,
    loadValue: 60,
  },
  intermediaire: {
    staticDurationSeconds: 15,
    dynamicReps: 8,
    sets: 4,
    restSeconds: 90,
    loadValue: 70,
  },
  avance: {
    staticDurationSeconds: 25,
    dynamicReps: 6,
    sets: 4,
    restSeconds: 75,
    loadValue: 80,
  }
};

// Level adaptations (multipliers)
export const LEVEL_ADAPTATIONS: Record<AthleteLevel, { 
  staticMultiplier: number; 
  loadAdjustment: number; 
  restMultiplier: number;
}> = {
  debutant: { staticMultiplier: 0.6, loadAdjustment: -10, restMultiplier: 1.3 },
  intermediaire: { staticMultiplier: 1, loadAdjustment: 0, restMultiplier: 1 },
  avance: { staticMultiplier: 1.5, loadAdjustment: 10, restMultiplier: 0.8 }
};

// Format summary text for display
export const formatStatoDynamiqueSummary = (config: StatoDynamiqueConfig): string => {
  // Handle both new and legacy format
  const phases = config.staticPhases || [];
  const phaseCount = phases.length || 1;
  
  const loadDisplay = config.loadType === 'pourcentage_1rm' 
    ? `${config.loadValue}% 1RM`
    : config.loadType === 'charge_libre'
      ? `${config.loadValue}kg`
      : `RPE ${config.loadValue}`;
  
  // Build phase timing summary
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
    if (phase) {
      phaseLabel = `${phase.durationSeconds}s @ ${phase.angle}° ${getTimingShort(phase.timing)}`;
    } else {
      phaseLabel = `${config.staticDurationSeconds || 15}s iso`;
    }
  } else {
    // Multiple phases: show count and timings
    const timings = phases.map(p => `${p.durationSeconds}s ${getTimingShort(p.timing)}`).join(' + ');
    phaseLabel = timings;
  }
  
  return `${config.sets}×(${phaseLabel} + ${config.dynamicReps} reps) @ ${loadDisplay}`;
};

// Calculate estimated time under tension
export const calculateTimeUnderTension = (config: StatoDynamiqueConfig): number => {
  // Handle both new and legacy format
  const phases = config.staticPhases || [];
  const staticTUT = phases.reduce((sum, p) => sum + p.durationSeconds, 0) || config.staticDurationSeconds || 15;
  
  // Parse tempo for dynamic phase TUT calculation
  let dynamicTUT = config.dynamicReps * 4; // Default 4 seconds per rep
  if (config.dynamicTempo) {
    const tempoParts = config.dynamicTempo.split('-').map(Number);
    if (tempoParts.length >= 3) {
      const repDuration = tempoParts.reduce((a, b) => a + (b || 0), 0);
      dynamicTUT = config.dynamicReps * repDuration;
    }
  }
  
  return staticTUT + dynamicTUT;
};

// Calculate total session volume
export const calculateStatoDynamiqueVolume = (config: StatoDynamiqueConfig): {
  totalTUT: number; // Total time under tension in seconds
  totalSets: number;
  totalReps: number;
  estimatedTonnage: number | null;
} => {
  const tutPerSet = calculateTimeUnderTension(config);
  const totalTUT = tutPerSet * config.sets;
  
  // Estimate tonnage only if we have a weight in kg
  let estimatedTonnage: number | null = null;
  if (config.loadType === 'charge_libre' && config.loadValue) {
    estimatedTonnage = config.loadValue * config.dynamicReps * config.sets;
  }
  
  return {
    totalTUT,
    totalSets: config.sets,
    totalReps: config.dynamicReps * config.sets,
    estimatedTonnage
  };
};

// Validate configuration
export const validateStatoDynamiqueConfig = (config: StatoDynamiqueConfig): string[] => {
  const errors: string[] = [];
  
  // Validate static phases
  const phases = config.staticPhases || [];
  if (phases.length === 0) {
    errors.push('Au moins une phase isométrique est requise');
  }
  
  phases.forEach((phase, index) => {
    if (phase.durationSeconds < 1) {
      errors.push(`Phase ${index + 1}: la durée doit être d'au moins 1 seconde`);
    }
  });
  
  if (config.dynamicReps < 1 || config.dynamicReps > 20) {
    errors.push('Le nombre de répétitions doit être entre 1 et 20');
  }
  
  if (config.sets < 1 || config.sets > 10) {
    errors.push('Le nombre de séries doit être entre 1 et 10');
  }
  
  if (config.loadType === 'pourcentage_1rm' && (config.loadValue! < 40 || config.loadValue! > 100)) {
    errors.push('Le % 1RM doit être entre 40% et 100%');
  }
  
  if (config.loadType === 'rpe' && (config.loadValue! < 1 || config.loadValue! > 10)) {
    errors.push('Le RPE doit être entre 1 et 10');
  }
  
  return errors;
};
