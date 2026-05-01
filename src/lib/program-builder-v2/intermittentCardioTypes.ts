/**
 * Intermittent Cardio Method Types and Configuration
 * Supports: Running, Cycling, Swimming with specific variables per support
 */

// Support types for intermittent cardio
export type IntermittentCardioSupport = 'running' | 'cycling' | 'swimming';

// Effort/Recovery mode: by time or by distance
export type EffortMode = 'duration' | 'distance';

// Intensity type varies by support
export interface IntensityConfig {
  type: 'percentage' | 'pace' | 'power' | 'hr' | 'rpe';
  label: string;
  unit: string;
  placeholder: string;
  min?: number;
  max?: number;
  step?: number;
}

// Full intermittent cardio configuration
export interface IntermittentCardioConfig {
  support: IntermittentCardioSupport;
  
  // Structure
  repetitions: number;
  series: number;
  
  // Effort
  effortMode: EffortMode;
  effortDurationSeconds?: number;
  effortDistanceMeters?: number;
  
  // Recovery
  recoveryMode: EffortMode;
  recoveryDurationSeconds?: number;
  recoveryDistanceMeters?: number;
  
  // Inter-series recovery (always duration)
  interSeriesRecoverySeconds: number;
  
  // Intensity (values stored, type depends on support)
  intensityType: IntensityConfig['type'];
  intensityValue?: number;
  
  // Optional fields
  targetRpe?: number;
  targetHr?: number;
}

// Support-specific intensity options
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

// Support labels and icons
export const SUPPORT_CONFIG: Record<IntermittentCardioSupport, { 
  label: string; 
  icon: string; 
  distanceUnit: string;
  distanceUnitShort: string;
  defaultEffortDistance: number;
  defaultRecoveryDistance: number;
}> = {
  running: { 
    label: 'Course à pied', 
    icon: 'PersonStanding',
    distanceUnit: 'mètres',
    distanceUnitShort: 'm',
    defaultEffortDistance: 400,
    defaultRecoveryDistance: 200,
  },
  cycling: { 
    label: 'Vélo', 
    icon: 'Bike',
    distanceUnit: 'mètres',
    distanceUnitShort: 'm',
    defaultEffortDistance: 1000,
    defaultRecoveryDistance: 500,
  },
  swimming: { 
    label: 'Natation', 
    icon: 'Waves',
    distanceUnit: 'mètres',
    distanceUnitShort: 'm',
    defaultEffortDistance: 100,
    defaultRecoveryDistance: 50,
  },
};

// Default configuration for new intermittent cardio
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

// Format pace (seconds) to mm:ss string
export const formatPace = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Parse mm:ss string to seconds
export const parsePace = (paceStr: string): number => {
  if (!paceStr) return 0;
  if (paceStr.includes(':')) {
    const [mins, secs] = paceStr.split(':').map(Number);
    return (mins || 0) * 60 + (secs || 0);
  }
  return parseInt(paceStr) || 0;
};

// Calculate total volume for an intermittent session
export const calculateIntermittentVolume = (config: IntermittentCardioConfig): {
  totalDurationSeconds: number;
  totalDistanceMeters: number;
  workDurationSeconds: number;
  restDurationSeconds: number;
} => {
  const reps = config.repetitions || 1;
  const sets = config.series || 1;
  
  let workDurationPerRep = config.effortDurationSeconds || 0;
  let restDurationPerRep = config.recoveryDurationSeconds || 0;
  const interSeriesRest = config.interSeriesRecoverySeconds || 0;
  
  // If distance mode, estimate time (rough estimate based on support)
  if (config.effortMode === 'distance') {
    // Rough speed estimates: running ~4m/s, cycling ~8m/s, swimming ~1.5m/s
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
  
  // Distance calculation
  let totalDistance = 0;
  if (config.effortMode === 'distance') {
    totalDistance = (config.effortDistanceMeters || 0) * reps * sets;
  }
  if (config.recoveryMode === 'distance') {
    totalDistance += (config.recoveryDistanceMeters || 0) * reps * sets;
  }
  
  return {
    totalDurationSeconds: totalWork + totalRest,
    totalDistanceMeters: totalDistance,
    workDurationSeconds: totalWork,
    restDurationSeconds: totalRest,
  };
};

// Format a summary of the intermittent session
export const formatIntermittentSummary = (config: IntermittentCardioConfig): string => {
  const supportLabel = SUPPORT_CONFIG[config.support].label;
  const distanceUnit = SUPPORT_CONFIG[config.support].distanceUnitShort;
  
  let effortStr = '';
  if (config.effortMode === 'duration') {
    effortStr = formatPace(config.effortDurationSeconds || 0);
  } else {
    effortStr = `${config.effortDistanceMeters}${distanceUnit}`;
  }
  
  let recoveryStr = '';
  if (config.recoveryMode === 'duration') {
    recoveryStr = formatPace(config.recoveryDurationSeconds || 0);
  } else {
    recoveryStr = `${config.recoveryDistanceMeters}${distanceUnit}`;
  }
  
  const structure = config.series > 1 
    ? `${config.series} × ${config.repetitions} × (${effortStr}/${recoveryStr})`
    : `${config.repetitions} × (${effortStr}/${recoveryStr})`;
  
  return `${supportLabel}: ${structure}`;
};

// Athlete feedback fields for intermittent cardio
export interface IntermittentCardioFeedback {
  // Actual values
  actualRepetitions?: number;
  actualSeries?: number;
  
  // Effort intensity achieved
  actualIntensityType?: IntensityConfig['type'];
  actualIntensityValue?: number;
  
  // Perceived exertion
  actualRpe?: number;
  actualHr?: number;
  
  // Total metrics (calculated or manual)
  totalDistanceMeters?: number;
  totalDurationSeconds?: number;
  
  // Notes
  notes?: string;
}

// Calculate progression metrics from feedback
export const calculateProgressionMetrics = (
  config: IntermittentCardioConfig,
  feedback: IntermittentCardioFeedback
): {
  volumeTotal: number; // Total distance or time
  intensiteMoyenne: number; // Average intensity
  chargeInterne: number; // Volume × Intensity × RPE
} => {
  const volume = feedback.totalDistanceMeters || feedback.totalDurationSeconds || 0;
  const intensity = feedback.actualIntensityValue || config.intensityValue || 0;
  const rpe = feedback.actualRpe || 7;
  
  // Normalize intensity to 0-100 scale for calculation
  let normalizedIntensity = intensity;
  if (config.intensityType === 'rpe') {
    normalizedIntensity = intensity * 10; // RPE 1-10 → 10-100
  } else if (config.intensityType === 'hr') {
    normalizedIntensity = (intensity / 200) * 100; // HR as % of 200bpm max
  }
  
  return {
    volumeTotal: volume,
    intensiteMoyenne: normalizedIntensity,
    chargeInterne: volume * (normalizedIntensity / 100) * (rpe / 10),
  };
};
