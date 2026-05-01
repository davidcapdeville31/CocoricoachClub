/**
 * Fartlek Training Method Types and Configuration
 * Méthode d'entraînement alternant des phases d'effort d'intensité variable 
 * et des phases de récupération active, de manière libre ou structurée.
 */

// Structure type for Fartlek
export type FartlekStructureType = 'libre' | 'structure';

// Terrain types
export type FartlekTerrain = 'plat' | 'vallonne' | 'trail' | 'piste' | 'libre';

// Physiological objectives
export type FartlekObjective = 
  | 'endurance_fondamentale' 
  | 'puissance_aerobie' 
  | 'tolerance_lactique' 
  | 'variation_allure';

// Athlete level for adaptations
export type AthleteLevel = 'debutant' | 'intermediaire' | 'avance';

// Intensity type
export type FartlekIntensityType = 'rpe' | 'vma' | 'zone_cardio' | 'qualitative';

// Recovery type
export type FartlekRecoveryType = 'active' | 'tres_legere';

// Phase configuration
export interface FartlekPhase {
  durationSeconds: number;
  intensityType: FartlekIntensityType;
  intensityValue?: number; // For RPE (1-10), VMA (%), or zone (1-5)
  intensityLabel?: string; // For qualitative description (e.g., "rapide", "lent")
  targetSpeed?: number; // Target speed in km/h
  targetHeartRate?: number; // Target heart rate in bpm
}

// Full Fartlek configuration
export interface FartlekConfig {
  // Basic info
  structureType: FartlekStructureType;
  
  // Session parameters
  totalDurationMinutes: number; // 20-60 min
  cycles?: number; // Optional number of cycles/repetitions
  
  // Effort phases
  effortPhases: FartlekPhase[];
  
  // Recovery phases
  recoveryType: FartlekRecoveryType;
  recoveryPhases: FartlekPhase[];
  
  // Context
  terrain: FartlekTerrain;
  
  // Objective
  objective: FartlekObjective;
  
  // Athlete adaptation
  athleteLevel?: AthleteLevel;
  
  // Coach notes
  coachNotes?: string;
}

// Athlete feedback for post-session tracking
export interface FartlekFeedback {
  // Actual values
  actualDurationMinutes?: number;
  actualCycles?: number;
  
  // Perceived exertion
  rpeGlobal?: number; // 1-10
  sensations?: 'tres_bien' | 'bien' | 'moyen' | 'difficile' | 'tres_difficile';
  difficultePercue?: 'facile' | 'adequat' | 'difficile' | 'trop_dur';
  respectAllures?: boolean;
  
  // Free comment
  commentaire?: string;
}

// Objective labels for display
export const FARTLEK_OBJECTIVES: Record<FartlekObjective, { label: string; description: string }> = {
  endurance_fondamentale: {
    label: 'Endurance fondamentale',
    description: 'Développement de la base aérobie avec des variations modérées'
  },
  puissance_aerobie: {
    label: 'Puissance aérobie',
    description: 'Amélioration de la VO2max par des efforts proches du maximum'
  },
  tolerance_lactique: {
    label: 'Tolérance lactique',
    description: 'Capacité à maintenir des efforts intenses malgré l\'accumulation d\'acide lactique'
  },
  variation_allure: {
    label: 'Variation d\'allure',
    description: 'Adaptabilité à des changements de rythme imprévisibles'
  }
};

// Terrain labels
export const FARTLEK_TERRAINS: Record<FartlekTerrain, string> = {
  plat: 'Terrain plat',
  vallonne: 'Vallonné',
  trail: 'Trail / Sentier',
  piste: 'Piste d\'athlétisme',
  libre: 'Libre / Variable'
};

// Structure type labels
export const FARTLEK_STRUCTURES: Record<FartlekStructureType, { label: string; description: string }> = {
  libre: {
    label: 'Fartlek libre',
    description: 'L\'athlète varie les allures selon ses sensations, sans structure prédéfinie'
  },
  structure: {
    label: 'Fartlek structuré',
    description: 'Phases d\'effort et de récupération définies avec durées et intensités précises'
  }
};

// Athlete level labels
export const ATHLETE_LEVELS: Record<AthleteLevel, { label: string; adaptations: string }> = {
  debutant: {
    label: 'Débutant',
    adaptations: 'Durées courtes, intensités modérées, récupérations longues'
  },
  intermediaire: {
    label: 'Intermédiaire',
    adaptations: 'Durées et intensités standard'
  },
  avance: {
    label: 'Avancé',
    adaptations: 'Durées longues, intensités élevées, récupérations courtes'
  }
};

// Intensity type labels
export const INTENSITY_TYPES: Record<FartlekIntensityType, { label: string; unit: string; placeholder: string }> = {
  rpe: { label: 'RPE', unit: '/10', placeholder: '7' },
  vma: { label: '% VMA', unit: '%', placeholder: '90' },
  zone_cardio: { label: 'Zone cardio', unit: '/5', placeholder: '4' },
  qualitative: { label: 'Consigne', unit: '', placeholder: 'Rapide' }
};

// Recovery type labels
export const RECOVERY_TYPES: Record<FartlekRecoveryType, string> = {
  active: 'Récupération active (trot léger)',
  tres_legere: 'Récupération très légère (marche)'
};

// Default configuration
export const getDefaultFartlekConfig = (): FartlekConfig => ({
  structureType: 'structure',
  totalDurationMinutes: 30,
  cycles: 6,
  effortPhases: [
    { durationSeconds: 60, intensityType: 'rpe', intensityValue: 7 }
  ],
  recoveryType: 'active',
  recoveryPhases: [
    { durationSeconds: 60, intensityType: 'rpe', intensityValue: 4 }
  ],
  terrain: 'libre',
  objective: 'variation_allure',
  athleteLevel: 'intermediaire'
});

// Preset configurations based on objectives
export const FARTLEK_PRESETS: Record<FartlekObjective, Partial<FartlekConfig>> = {
  endurance_fondamentale: {
    totalDurationMinutes: 40,
    cycles: 8,
    effortPhases: [{ durationSeconds: 120, intensityType: 'rpe', intensityValue: 6 }],
    recoveryPhases: [{ durationSeconds: 120, intensityType: 'rpe', intensityValue: 4 }],
  },
  puissance_aerobie: {
    totalDurationMinutes: 25,
    cycles: 6,
    effortPhases: [{ durationSeconds: 90, intensityType: 'vma', intensityValue: 95 }],
    recoveryPhases: [{ durationSeconds: 90, intensityType: 'rpe', intensityValue: 3 }],
  },
  tolerance_lactique: {
    totalDurationMinutes: 20,
    cycles: 4,
    effortPhases: [{ durationSeconds: 180, intensityType: 'vma', intensityValue: 100 }],
    recoveryPhases: [{ durationSeconds: 180, intensityType: 'rpe', intensityValue: 4 }],
  },
  variation_allure: {
    totalDurationMinutes: 30,
    cycles: 10,
    effortPhases: [{ durationSeconds: 45, intensityType: 'qualitative', intensityLabel: 'Sprint court' }],
    recoveryPhases: [{ durationSeconds: 60, intensityType: 'qualitative', intensityLabel: 'Trot récupération' }],
  }
};

// Level adaptations (multipliers)
export const LEVEL_ADAPTATIONS: Record<AthleteLevel, { 
  durationMultiplier: number; 
  intensityAdjustment: number; 
  recoveryMultiplier: number;
}> = {
  debutant: { durationMultiplier: 0.7, intensityAdjustment: -1, recoveryMultiplier: 1.5 },
  intermediaire: { durationMultiplier: 1, intensityAdjustment: 0, recoveryMultiplier: 1 },
  avance: { durationMultiplier: 1.3, intensityAdjustment: 1, recoveryMultiplier: 0.7 }
};

// Format seconds to MM:SS
export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}min`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Parse duration string to seconds
export const parseDuration = (value: string): number => {
  if (!value) return 0;
  if (value.includes(':')) {
    const [mins, secs] = value.split(':').map(Number);
    return (mins || 0) * 60 + (secs || 0);
  }
  if (value.endsWith('min')) {
    return parseInt(value) * 60;
  }
  if (value.endsWith('s')) {
    return parseInt(value);
  }
  return parseInt(value) * 60; // Default to minutes
};

// Generate summary text for display
export const formatFartlekSummary = (config: FartlekConfig): string => {
  const structure = FARTLEK_STRUCTURES[config.structureType].label;
  const terrain = FARTLEK_TERRAINS[config.terrain];
  const objective = FARTLEK_OBJECTIVES[config.objective].label;
  
  if (config.structureType === 'libre') {
    return `${structure} - ${config.totalDurationMinutes}min sur ${terrain.toLowerCase()}`;
  }
  
  const effortDuration = config.effortPhases[0]?.durationSeconds || 0;
  const recoveryDuration = config.recoveryPhases[0]?.durationSeconds || 0;
  const cycles = config.cycles || 1;
  
  return `${cycles}× (${formatDuration(effortDuration)}/${formatDuration(recoveryDuration)}) - ${config.totalDurationMinutes}min`;
};

// Calculate estimated work/rest times
export const calculateFartlekVolume = (config: FartlekConfig): {
  totalWorkSeconds: number;
  totalRestSeconds: number;
  estimatedCalories: number;
} => {
  if (config.structureType === 'libre') {
    // Estimate 50/50 split for libre
    const halfDuration = (config.totalDurationMinutes * 60) / 2;
    return {
      totalWorkSeconds: halfDuration,
      totalRestSeconds: halfDuration,
      estimatedCalories: config.totalDurationMinutes * 10 // Rough estimate
    };
  }
  
  const effortTotal = config.effortPhases.reduce((acc, p) => acc + p.durationSeconds, 0);
  const recoveryTotal = config.recoveryPhases.reduce((acc, p) => acc + p.durationSeconds, 0);
  const cycles = config.cycles || 1;
  
  return {
    totalWorkSeconds: effortTotal * cycles,
    totalRestSeconds: recoveryTotal * cycles,
    estimatedCalories: (effortTotal * cycles / 60) * 12 + (recoveryTotal * cycles / 60) * 6
  };
};

// Sensations labels
export const SENSATIONS_LABELS: Record<NonNullable<FartlekFeedback['sensations']>, string> = {
  tres_bien: 'Très bien',
  bien: 'Bien',
  moyen: 'Moyen',
  difficile: 'Difficile',
  tres_difficile: 'Très difficile'
};

// Difficulty labels
export const DIFFICULTY_LABELS: Record<NonNullable<FartlekFeedback['difficultePercue']>, string> = {
  facile: 'Facile',
  adequat: 'Adéquat',
  difficile: 'Difficile',
  trop_dur: 'Trop dur'
};
