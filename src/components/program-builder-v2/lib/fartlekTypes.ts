/**
 * Fartlek Training Method Types and Configuration
 */

export type FartlekStructureType = 'libre' | 'structure';
export type FartlekTerrain = 'plat' | 'vallonne' | 'trail' | 'piste' | 'libre';
export type FartlekObjective = 'endurance_fondamentale' | 'puissance_aerobie' | 'tolerance_lactique' | 'variation_allure';
export type AthleteLevel = 'debutant' | 'intermediaire' | 'avance';
export type FartlekIntensityType = 'rpe' | 'vma' | 'zone_cardio' | 'qualitative';
export type FartlekRecoveryType = 'active' | 'tres_legere';

export interface FartlekPhase {
  durationSeconds: number;
  intensityType: FartlekIntensityType;
  intensityValue?: number;
  intensityLabel?: string;
  targetSpeed?: number;
  targetHeartRate?: number;
}

export interface FartlekConfig {
  structureType: FartlekStructureType;
  totalDurationMinutes: number;
  cycles?: number;
  effortPhases: FartlekPhase[];
  recoveryType: FartlekRecoveryType;
  recoveryPhases: FartlekPhase[];
  terrain: FartlekTerrain;
  objective: FartlekObjective;
  athleteLevel?: AthleteLevel;
  coachNotes?: string;
}

export interface FartlekFeedback {
  actualDurationMinutes?: number;
  actualCycles?: number;
  rpeGlobal?: number;
  sensations?: 'tres_bien' | 'bien' | 'moyen' | 'difficile' | 'tres_difficile';
  difficultePercue?: 'facile' | 'adequat' | 'difficile' | 'trop_dur';
  respectAllures?: boolean;
  commentaire?: string;
}

export const FARTLEK_OBJECTIVES: Record<FartlekObjective, { label: string; description: string }> = {
  endurance_fondamentale: { label: 'Endurance fondamentale', description: 'Développement de la base aérobie avec des variations modérées' },
  puissance_aerobie: { label: 'Puissance aérobie', description: 'Amélioration de la VO2max par des efforts proches du maximum' },
  tolerance_lactique: { label: 'Tolérance lactique', description: 'Capacité à maintenir des efforts intenses malgré l\'accumulation d\'acide lactique' },
  variation_allure: { label: 'Variation d\'allure', description: 'Adaptabilité à des changements de rythme imprévisibles' },
};

export const FARTLEK_TERRAINS: Record<FartlekTerrain, string> = {
  plat: 'Terrain plat', vallonne: 'Vallonné', trail: 'Trail / Sentier', piste: 'Piste d\'athlétisme', libre: 'Libre / Variable',
};

export const FARTLEK_STRUCTURES: Record<FartlekStructureType, { label: string; description: string }> = {
  libre: { label: 'Fartlek libre', description: 'L\'athlète varie les allures selon ses sensations, sans structure prédéfinie' },
  structure: { label: 'Fartlek structuré', description: 'Phases d\'effort et de récupération définies avec durées et intensités précises' },
};

export const ATHLETE_LEVELS: Record<AthleteLevel, { label: string; adaptations: string }> = {
  debutant: { label: 'Débutant', adaptations: 'Durées courtes, intensités modérées, récupérations longues' },
  intermediaire: { label: 'Intermédiaire', adaptations: 'Durées et intensités standard' },
  avance: { label: 'Avancé', adaptations: 'Durées longues, intensités élevées, récupérations courtes' },
};

export const INTENSITY_TYPES: Record<FartlekIntensityType, { label: string; unit: string; placeholder: string }> = {
  rpe: { label: 'RPE', unit: '/10', placeholder: '7' },
  vma: { label: '% VMA', unit: '%', placeholder: '90' },
  zone_cardio: { label: 'Zone cardio', unit: '/5', placeholder: '4' },
  qualitative: { label: 'Consigne', unit: '', placeholder: 'Rapide' },
};

export const RECOVERY_TYPES: Record<FartlekRecoveryType, string> = {
  active: 'Récupération active (trot léger)',
  tres_legere: 'Récupération très légère (marche)',
};

export const getDefaultFartlekConfig = (): FartlekConfig => ({
  structureType: 'structure',
  totalDurationMinutes: 30,
  cycles: 6,
  effortPhases: [{ durationSeconds: 60, intensityType: 'rpe', intensityValue: 7 }],
  recoveryType: 'active',
  recoveryPhases: [{ durationSeconds: 60, intensityType: 'rpe', intensityValue: 4 }],
  terrain: 'libre',
  objective: 'variation_allure',
  athleteLevel: 'intermediaire',
});

export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}min`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const formatFartlekSummary = (config: FartlekConfig): string => {
  const structure = FARTLEK_STRUCTURES[config.structureType].label;
  const terrain = FARTLEK_TERRAINS[config.terrain];
  if (config.structureType === 'libre') {
    return `${structure} - ${config.totalDurationMinutes}min sur ${terrain.toLowerCase()}`;
  }
  const effortDuration = config.effortPhases[0]?.durationSeconds || 0;
  const recoveryDuration = config.recoveryPhases[0]?.durationSeconds || 0;
  const cycles = config.cycles || 1;
  return `${cycles}× (${formatDuration(effortDuration)}/${formatDuration(recoveryDuration)}) - ${config.totalDurationMinutes}min`;
};

export const SENSATIONS_LABELS: Record<NonNullable<FartlekFeedback['sensations']>, string> = {
  tres_bien: 'Très bien', bien: 'Bien', moyen: 'Moyen', difficile: 'Difficile', tres_difficile: 'Très difficile',
};

export const DIFFICULTY_LABELS: Record<NonNullable<FartlekFeedback['difficultePercue']>, string> = {
  facile: 'Facile', adequat: 'Adéquat', difficile: 'Difficile', trop_dur: 'Trop dur',
};
