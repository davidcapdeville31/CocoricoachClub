/**
 * Centralized exercise type definitions and variable configurations
 * This ensures consistency between program creation and athlete feedback
 */

// Exercise types stored in database
export type ExerciseType = 'strength' | 'bodyweight' | 'cardio_machine' | 'cardio_locomotion' | 'skill';

// Variable configurations per exercise type
export interface VariableConfig {
  key: string;
  label: string;
  placeholder: string;
  type: 'number' | 'text' | 'time';
  min?: number;
  max?: number;
  step?: number;
  icon: string; // Lucide icon name
}

// Strength exercises (barbells, machines, dumbbells)
export const STRENGTH_VARIABLES: VariableConfig[] = [
  { key: 'sets', label: 'Séries', placeholder: '4', type: 'number', min: 1, icon: 'Hash' },
  { key: 'reps', label: 'Reps', placeholder: '8-10', type: 'text', icon: 'Repeat' },
  { key: 'percentage', label: '%1RM', placeholder: '75', type: 'number', min: 0, max: 100, icon: 'Percent' },
  { key: 'weight_kg', label: 'Poids (kg)', placeholder: '60', type: 'number', min: 0, step: 0.5, icon: 'Dumbbell' },
  { key: 'tempo', label: 'Tempo', placeholder: '3-1-2-0', type: 'text', icon: 'Timer' },
  { key: 'rpe', label: 'RPE', placeholder: '8', type: 'number', min: 1, max: 10, step: 0.5, icon: 'Gauge' },
  { key: 'rir', label: 'RIR', placeholder: '2', type: 'number', min: 0, max: 5, icon: 'Target' },
  { key: 'restSeconds', label: 'Repos', placeholder: '01:30', type: 'time', min: 0, icon: 'Clock' },
];

// Bodyweight / Gymnastics exercises
export const BODYWEIGHT_VARIABLES: VariableConfig[] = [
  { key: 'sets', label: 'Séries', placeholder: '4', type: 'number', min: 1, icon: 'Hash' },
  { key: 'reps', label: 'Reps', placeholder: '8-10', type: 'text', icon: 'Repeat' },
  { key: 'assistance_kg', label: 'Assistance (kg)', placeholder: '-10', type: 'number', icon: 'ArrowUp' },
  { key: 'weight_kg', label: 'Charge ajoutée (kg)', placeholder: '10', type: 'number', min: 0, step: 0.5, icon: 'Dumbbell' },
  { key: 'rpe', label: 'RPE', placeholder: '8', type: 'number', min: 1, max: 10, step: 0.5, icon: 'Gauge' },
  { key: 'restSeconds', label: 'Repos', placeholder: '01:30', type: 'time', min: 0, icon: 'Clock' },
];

// Cardio machine exercises (rower, ski erg, assault bike, etc.)
export const CARDIO_MACHINE_VARIABLES: VariableConfig[] = [
  { key: 'durationSeconds', label: 'Durée', placeholder: '5:00', type: 'time', icon: 'Clock' },
  { key: 'distanceMeters', label: 'Distance (m)', placeholder: '1000', type: 'number', min: 0, icon: 'MapPin' },
  { key: 'calories', label: 'Calories', placeholder: '50', type: 'number', min: 0, icon: 'Flame' },
  { key: 'watts', label: 'Watts', placeholder: '150', type: 'number', min: 0, icon: 'Zap' },
  { key: 'cadence', label: 'Cadence (RPM)', placeholder: '80', type: 'number', min: 0, icon: 'Activity' },
  { key: 'rpe', label: 'RPE', placeholder: '7', type: 'number', min: 1, max: 10, icon: 'Gauge' },
];

// Cardio locomotion (running, cycling, swimming)
export const CARDIO_LOCOMOTION_VARIABLES: VariableConfig[] = [
  { key: 'runDistanceMeters', label: 'Distance (m)', placeholder: '5000', type: 'number', min: 0, icon: 'MapPin' },
  { key: 'runDurationSeconds', label: 'Durée', placeholder: '30:00', type: 'time', icon: 'Clock' },
  { key: 'paceSecondsPerKm', label: 'Allure (/km)', placeholder: '5:30', type: 'time', icon: 'Play' },
  { key: 'elevationMeters', label: 'Dénivelé (m)', placeholder: '100', type: 'number', min: 0, icon: 'TrendingUp' },
  { key: 'rpe', label: 'RPE', placeholder: '7', type: 'number', min: 1, max: 10, icon: 'Gauge' },
];

// Skill / Technique exercises
export const SKILL_VARIABLES: VariableConfig[] = [
  { key: 'durationSeconds', label: 'Temps de pratique', placeholder: '10:00', type: 'time', icon: 'Clock' },
  { key: 'attempts', label: "Nombre d'essais", placeholder: '10', type: 'number', min: 1, icon: 'Target' },
  { key: 'successRate', label: 'Taux de réussite (%)', placeholder: '80', type: 'number', min: 0, max: 100, icon: 'CheckCircle' },
  { key: 'notes', label: 'Notes', placeholder: 'Observations...', type: 'text', icon: 'FileText' },
];

// Get variables configuration for an exercise type
export const getVariablesForType = (exerciseType: ExerciseType): VariableConfig[] => {
  switch (exerciseType) {
    case 'strength':
      return STRENGTH_VARIABLES;
    case 'bodyweight':
      return BODYWEIGHT_VARIABLES;
    case 'cardio_machine':
      return CARDIO_MACHINE_VARIABLES;
    case 'cardio_locomotion':
      return CARDIO_LOCOMOTION_VARIABLES;
    case 'skill':
      return SKILL_VARIABLES;
    default:
      return STRENGTH_VARIABLES;
  }
};

// Get default visible variables for an exercise type
export const getDefaultVisibleVariables = (exerciseType: ExerciseType): string[] => {
  switch (exerciseType) {
    case 'strength':
      return ['sets', 'reps', 'percentage', 'restSeconds'];
    case 'bodyweight':
      return ['sets', 'reps', 'weight_kg', 'restSeconds'];
    case 'cardio_machine':
      return ['durationSeconds', 'distanceMeters', 'calories'];
    case 'cardio_locomotion':
      return ['runDistanceMeters', 'runDurationSeconds', 'paceSecondsPerKm'];
    case 'skill':
      return ['durationSeconds', 'attempts'];
    default:
      return ['sets', 'reps', 'percentage', 'restSeconds'];
  }
};

// Fallback detection if exercise_type is not set in DB
export const inferExerciseTypeFromName = (exerciseName: string, stationName?: string): ExerciseType => {
  const lowerName = exerciseName.toLowerCase();
  const lowerStation = (stationName || '').toLowerCase();
  
  // Cardio machines
  const cardioMachineKeywords = [
    'rameur', 'skierg', 'ski erg', 'ski-erg', 'echo bike', 'assault bike',
    'air bike', 'bike erg', 'vélo', 'tapis', 'treadmill', 'elliptique',
    'stairmaster', 'ergomètre', 'concept2', 'rogue echo'
  ];
  if (cardioMachineKeywords.some(k => lowerName.includes(k) || lowerStation.includes(k))) {
    return 'cardio_machine';
  }
  
  // Running / locomotion
  const locomotionKeywords = [
    'course', 'running', 'sprint', 'jogging', 'footing', 'trail',
    'natation', 'nage', 'swim', 'vélo route', 'cycling'
  ];
  if (locomotionKeywords.some(k => lowerName.includes(k) || lowerStation.includes(k))) {
    return 'cardio_locomotion';
  }
  
  // Bodyweight / gymnastics
  const bodyweightKeywords = [
    'pull-up', 'push-up', 'dip', 'muscle-up', 'handstand', 'pistol',
    'toes to bar', 'l-sit', 'planche', 'hollow', 'ring', 'anneaux',
    'strict', 'kipping', 'butterfly'
  ];
  if (bodyweightKeywords.some(k => lowerName.includes(k))) {
    return 'bodyweight';
  }
  
  // Skill / technique
  const skillKeywords = [
    'drill', 'technique', 'mobilité', 'étirement', 'stretch',
    'échauffement', 'activation', 'coordination', 'agilité'
  ];
  if (skillKeywords.some(k => lowerName.includes(k) || lowerStation.includes(k))) {
    return 'skill';
  }
  
  // Default to strength
  return 'strength';
};

// Map old exercise type format to new format
export const mapLegacyExerciseType = (
  legacyType: 'strength' | 'cardio_machine' | 'running' | undefined,
  exerciseName: string,
  stationName?: string
): ExerciseType => {
  if (legacyType === 'cardio_machine') return 'cardio_machine';
  if (legacyType === 'running') return 'cardio_locomotion';
  if (legacyType === 'strength') return 'strength';
  
  // Fallback to inference
  return inferExerciseTypeFromName(exerciseName, stationName);
};

// Check if exercise should show CrossFit method variables
export const isInCrossFitMethod = (methodType?: string): boolean => {
  const crossfitMethods = ['amrap', 'emom', 'for_time', 'tabata', 'death_by', 'circuit'];
  return crossfitMethods.includes(methodType?.toLowerCase() || '');
};
