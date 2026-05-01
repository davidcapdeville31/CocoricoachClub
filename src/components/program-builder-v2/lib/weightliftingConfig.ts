/**
 * Configuration for Olympic weightlifting starting positions and training variables
 */

export interface StartingPosition {
  key: string;
  labelFr: string;
  labelEn: string;
  description: string;
  applicableTo: ('snatch' | 'clean' | 'jerk')[];
  color: string;
}

export interface PullType {
  key: string;
  labelFr: string;
  labelEn: string;
  description: string;
  applicableTo: ('snatch' | 'clean')[];
}

export const WEIGHTLIFTING_STARTING_POSITIONS: StartingPosition[] = [
  { key: 'floor', labelFr: 'Du sol', labelEn: 'From Floor', description: 'Départ classique avec la barre au sol', applicableTo: ['snatch', 'clean'], color: 'bg-slate-500' },
  { key: 'low_hang', labelFr: 'Suspension basse', labelEn: 'Below Knee Hang', description: 'Barre en dessous des genoux', applicableTo: ['snatch', 'clean'], color: 'bg-blue-500' },
  { key: 'high_hang', labelFr: 'Suspension haute', labelEn: 'Above Knee Hang', description: 'Barre au-dessus des genoux', applicableTo: ['snatch', 'clean'], color: 'bg-cyan-500' },
  { key: 'power_position_half', labelFr: 'Point de puissance 1/2 cuisse', labelEn: 'Power Position Mid-Thigh', description: 'Barre à mi-cuisse', applicableTo: ['snatch', 'clean'], color: 'bg-violet-500' },
  { key: 'power_position_3_4', labelFr: 'Point de puissance 3/4 cuisse', labelEn: 'Power Position High Thigh', description: 'Barre sur la partie haute des cuisses', applicableTo: ['snatch', 'clean'], color: 'bg-purple-500' },
  { key: 'hip', labelFr: 'Départ des hanches', labelEn: 'Hip Start', description: 'Barre au niveau du pli de hanche', applicableTo: ['snatch', 'clean'], color: 'bg-teal-500' },
  { key: 'blocks_below_knee', labelFr: 'Blocs (sous genoux)', labelEn: 'Blocks Below Knee', description: 'Barre sur blocks, position sous les genoux', applicableTo: ['snatch', 'clean'], color: 'bg-amber-500' },
  { key: 'blocks_above_knee', labelFr: 'Blocs (dessus genoux)', labelEn: 'Blocks Above Knee', description: 'Barre sur blocks, position au-dessus des genoux', applicableTo: ['snatch', 'clean'], color: 'bg-orange-500' },
  { key: 'jerk_blocks', labelFr: 'Plots / Jerk Blocks', labelEn: 'Jerk Blocks', description: 'Barre sur plots', applicableTo: ['snatch', 'clean', 'jerk'], color: 'bg-red-500' },
  { key: 'rack', labelFr: 'Du rack', labelEn: 'From Rack', description: 'Barre sur le rack', applicableTo: ['snatch', 'clean', 'jerk'], color: 'bg-rose-500' },
];

export const WEIGHTLIFTING_PULL_TYPES: PullType[] = [
  { key: 'none', labelFr: 'Sans tirage', labelEn: 'No Pull', description: 'Mouvement complet sans tirage séparé', applicableTo: ['snatch', 'clean'] },
  { key: 'heavy_pull', labelFr: 'Tirage lourd', labelEn: 'Heavy Pull / Deadlift', description: 'Tirage jusqu\'à l\'extension complète', applicableTo: ['snatch', 'clean'] },
  { key: 'high_pull', labelFr: 'Tirage haut', labelEn: 'High Pull', description: 'Tirage avec extension complète et montée haute des coudes', applicableTo: ['snatch', 'clean'] },
  { key: 'arm_pull', labelFr: 'Tirage de bras', labelEn: 'Arm Pull', description: 'Tirage avec accent sur les bras', applicableTo: ['snatch', 'clean'] },
];

export const getPositionsForExercise = (exerciseName: string): StartingPosition[] => {
  const lowerName = exerciseName.toLowerCase();
  const hasSnatchKeyword = lowerName.includes('arraché') || lowerName.includes('snatch');
  const hasCleanKeyword = lowerName.includes('épaulé') || lowerName.includes('clean');
  const hasJerkKeyword = lowerName.includes('jeté') || lowerName.includes('jerk');
  const isSnatch = hasSnatchKeyword && !hasCleanKeyword;
  const isClean = hasCleanKeyword && !hasJerkKeyword;
  const isJerk = hasJerkKeyword && !hasCleanKeyword;
  const isCombined = lowerName.includes('épaulé-jeté') || lowerName.includes('clean & jerk') ||
    lowerName.includes('clean and jerk') || (hasCleanKeyword && hasJerkKeyword);
  const isFixedPositionExercise = lowerName.includes('passage') || lowerName.includes('chute') ||
    lowerName.includes('tall') || lowerName.includes('drop') || lowerName.includes('balance') ||
    lowerName.includes('sots') || lowerName.includes('squat avant') || lowerName.includes('front squat');
  if ((!isSnatch && !isClean && !isJerk) || isFixedPositionExercise || isCombined) return [];
  return WEIGHTLIFTING_STARTING_POSITIONS.filter(pos => {
    if (isSnatch && pos.applicableTo.includes('snatch')) return true;
    if (isClean && pos.applicableTo.includes('clean')) return true;
    if (isJerk && pos.applicableTo.includes('jerk')) return true;
    return false;
  });
};

export const getPullTypesForExercise = (exerciseName: string): PullType[] => {
  const lowerName = exerciseName.toLowerCase();
  const isSnatch = lowerName.includes('arraché') || lowerName.includes('snatch');
  const isClean = lowerName.includes('épaulé') || lowerName.includes('clean');
  const isMainMovement = !lowerName.includes('force') && !lowerName.includes('muscle') &&
    !lowerName.includes('passage') && !lowerName.includes('chute') &&
    !lowerName.includes('tall') && !lowerName.includes('drop');
  if ((!isSnatch && !isClean) || !isMainMovement) return [];
  return WEIGHTLIFTING_PULL_TYPES;
};

export const isWeightliftingExercise = (stationName: string, exerciseName: string): boolean => {
  const lowerStation = stationName.toLowerCase();
  const lowerName = exerciseName.toLowerCase();
  if (lowerStation.includes('haltéro') || lowerStation.includes('halterophilie') ||
      lowerStation.includes('olympic') || lowerStation === 'haltérophilie') return true;
  const keywords = ['arraché', 'snatch', 'épaulé', 'clean', 'jeté', 'jerk'];
  return keywords.some(k => lowerName.includes(k));
};

export const getPullTypeLabel = (pullKey: string): string => {
  const pullType = WEIGHTLIFTING_PULL_TYPES.find(p => p.key === pullKey);
  return pullType?.labelFr || pullKey;
};

export const getPositionLabel = (positionKey: string): string => {
  const position = WEIGHTLIFTING_STARTING_POSITIONS.find(p => p.key === positionKey);
  return position?.labelFr || positionKey;
};
