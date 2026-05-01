/**
 * Intermittent Cardio Method Types and Configuration
 * Supports: Running, Cycling, Swimming with specific variables per support
 */

export type IntermittentCardioSupport = 'running' | 'cycling' | 'swimming';
export type EffortMode = 'duration' | 'distance';

export interface IntensityConfig {
  type: 'percentage' | 'pace' | 'power' | 'hr' | 'rpe';
  label: string;
  unit: string;
  placeholder: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface IntermittentCardioConfig {
  support: IntermittentCardioSupport;
  repetitions: number;
  series: number;
  effortMode: EffortMode;
  effortDurationSeconds?: number;
  effortDistanceMeters?: number;
  recoveryMode: EffortMode;
  recoveryDurationSeconds?: number;
  recoveryDistanceMeters?: number;
  interSeriesRecoverySeconds: number;
  intensityType: IntensityConfig['type'];
  intensityValue?: number;
  targetRpe?: number;
  targetHr?: number;
}

export const INTENSITY_OPTIONS_BY_SUPPORT: Record<IntermittentCardioSupport, IntensityConfig[]> = {
  running: [
    { type: 'percentage', label: '% VMA', unit: '%', placeholder: '100', min: 60, max: 130, step: 5 },
    { type: 'pace', label: 'Allure', unit: 'min/km', placeholder: '4:30', min: 0 },
    { type: 'hr', label: 'FC', unit: 'bpm', placeholder: '160', min: 60, max: 220, step: 1 },
    { type: 'rpe', label: 'RPE', unit: '/10', placeholder: '8', min: 1, max: 10, step: 0.5 },
  ],
  cycling: [
    { type: 'percentage', label: '% FTP', unit: '%', placeholder: '90', min: 50, max: 150, step: 5 },
    { type: 'power', label: 'Puissance', unit: 'watts', placeholder: '250', min: 0, max: 2000, step: 5 },
    { type: 'hr', label: 'FC', unit: 'bpm', placeholder: '155', min: 60, max: 220, step: 1 },
    { type: 'rpe', label: 'RPE', unit: '/10', placeholder: '8', min: 1, max: 10, step: 0.5 },
  ],
  swimming: [
    { type: 'pace', label: 'Allure', unit: '/100m', placeholder: '1:30', min: 0 },
    { type: 'hr', label: 'FC', unit: 'bpm', placeholder: '150', min: 60, max: 220, step: 1 },
    { type: 'rpe', label: 'RPE', unit: '/10', placeholder: '7', min: 1, max: 10, step: 0.5 },
  ],
};

export const SUPPORT_CONFIG: Record<IntermittentCardioSupport, {
  label: string;
  icon: string;
  distanceUnit: string;
  distanceUnitShort: string;
  defaultEffortDistance: number;
  defaultRecoveryDistance: number;
}> = {
  running: { label: 'Course à pied', icon: 'PersonStanding', distanceUnit: 'mètres', distanceUnitShort: 'm', defaultEffortDistance: 400, defaultRecoveryDistance: 200 },
  cycling: { label: 'Vélo', icon: 'Bike', distanceUnit: 'mètres', distanceUnitShort: 'm', defaultEffortDistance: 1000, defaultRecoveryDistance: 500 },
  swimming: { label: 'Natation', icon: 'Waves', distanceUnit: 'mètres', distanceUnitShort: 'm', defaultEffortDistance: 100, defaultRecoveryDistance: 50 },
};

export const getDefaultIntermittentConfig = (support: IntermittentCardioSupport = 'running'): IntermittentCardioConfig => ({
  support,
  repetitions: 6,
  series: 1,
  effortMode: 'duration',
  effortDurationSeconds: 30,
  recoveryMode: 'duration',
  recoveryDurationSeconds: 30,
  interSeriesRecoverySeconds: 180,
  intensityType: 'percentage',
  intensityValue: support === 'running' ? 100 : support === 'cycling' ? 90 : undefined,
});

export const formatPace = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const parsePace = (paceStr: string): number => {
  if (!paceStr) return 0;
  if (paceStr.includes(':')) {
    const [mins, secs] = paceStr.split(':').map(Number);
    return (mins || 0) * 60 + (secs || 0);
  }
  return parseInt(paceStr) || 0;
};

export const calculateIntermittentVolume = (config: IntermittentCardioConfig) => {
  const reps = config.repetitions || 1;
  const sets = config.series || 1;
  let workDurationPerRep = config.effortDurationSeconds || 0;
  let restDurationPerRep = config.recoveryDurationSeconds || 0;
  const interSeriesRest = config.interSeriesRecoverySeconds || 0;
  if (config.effortMode === 'distance') {
    const speedEstimate = config.support === 'running' ? 4 : config.support === 'cycling' ? 8 : 1.5;
    workDurationPerRep = (config.effortDistanceMeters || 0) / speedEstimate;
  }
  if (config.recoveryMode === 'distance') {
    const recoverySpeedEstimate = config.support === 'running' ? 2 : config.support === 'cycling' ? 4 : 1;
    restDurationPerRep = (config.recoveryDistanceMeters || 0) / recoverySpeedEstimate;
  }
  const workPerSet = workDurationPerRep * reps;
  const restPerSet = restDurationPerRep * reps;
  const totalWork = workPerSet * sets;
  const totalRest = restPerSet * sets + interSeriesRest * (sets - 1);
  let totalDistance = 0;
  if (config.effortMode === 'distance') totalDistance = (config.effortDistanceMeters || 0) * reps * sets;
  if (config.recoveryMode === 'distance') totalDistance += (config.recoveryDistanceMeters || 0) * reps * sets;
  return {
    totalDurationSeconds: totalWork + totalRest,
    totalDistanceMeters: totalDistance,
    workDurationSeconds: totalWork,
    restDurationSeconds: totalRest,
  };
};

export const formatIntermittentSummary = (config: IntermittentCardioConfig): string => {
  const supportLabel = SUPPORT_CONFIG[config.support].label;
  const distanceUnit = SUPPORT_CONFIG[config.support].distanceUnitShort;
  const effortStr = config.effortMode === 'duration'
    ? formatPace(config.effortDurationSeconds || 0)
    : `${config.effortDistanceMeters}${distanceUnit}`;
  const recoveryStr = config.recoveryMode === 'duration'
    ? formatPace(config.recoveryDurationSeconds || 0)
    : `${config.recoveryDistanceMeters}${distanceUnit}`;
  const structure = config.series > 1
    ? `${config.series} × ${config.repetitions} × (${effortStr}/${recoveryStr})`
    : `${config.repetitions} × (${effortStr}/${recoveryStr})`;
  return `${supportLabel}: ${structure}`;
};

export interface IntermittentCardioFeedback {
  actualRepetitions?: number;
  actualSeries?: number;
  actualIntensityType?: IntensityConfig['type'];
  actualIntensityValue?: number;
  actualRpe?: number;
  actualHr?: number;
  totalDistanceMeters?: number;
  totalDurationSeconds?: number;
  notes?: string;
}
