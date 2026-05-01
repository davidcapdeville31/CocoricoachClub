/**
 * Variable Sets Synchronization Utilities
 * 
 * Handles syncing main training parameters (RPE, weight, percentage, tempo, reps)
 * to variable sets table rows when the main input values change.
 */

import { SetData, createInitialSets, formatTempo } from './variableSetsTypes';

// Fields that should be synced from main params to variable sets
export const SYNCABLE_FIELDS: (keyof SetData)[] = ['reps', 'weight_kg', 'percentage', 'rpe', 'tempo', 'rest_seconds'];

/**
 * Synchronizes a single field change to all sets in the variable sets array.
 * Only updates sets where the value hasn't been individually customized yet (undefined).
 * 
 * @param currentSets - Current variable sets array
 * @param field - The field being changed (e.g., 'rpe', 'weight_kg', 'percentage')
 * @param value - The new value from the main input
 * @param forceSync - If true, updates ALL sets regardless of existing values
 * @returns Updated sets array
 */
export const syncFieldToSets = (
  currentSets: SetData[],
  field: keyof SetData,
  value: string | number | undefined,
  forceSync: boolean = true
): SetData[] => {
  if (!SYNCABLE_FIELDS.includes(field)) {
    return currentSets;
  }

  // Auto-format tempo values
  const processedValue = field === 'tempo' && typeof value === 'string' 
    ? formatTempo(value) 
    : value;

  return currentSets.map(set => {
    // If forceSync is true, always update. Otherwise, only update if undefined
    if (forceSync || set[field] === undefined) {
      return { ...set, [field]: processedValue };
    }
    return set;
  });
};

/**
 * Ensures sets array has the correct count, syncing default values from main params.
 * 
 * @param currentSets - Current sets array
 * @param targetCount - Desired number of sets
 * @param defaultValues - Default values to apply to new sets
 * @returns Updated sets array with correct count
 */
export const syncSetsCount = (
  currentSets: SetData[] | undefined,
  targetCount: number,
  defaultValues: Partial<SetData> = {}
): SetData[] => {
  const count = Math.max(1, targetCount);
  
  if (!currentSets || currentSets.length === 0) {
    // Create new sets with default values
    return Array.from({ length: count }, (_, i) => ({
      setNumber: i + 1,
      ...defaultValues,
    }));
  }

  if (currentSets.length === count) {
    return currentSets;
  }

  if (currentSets.length > count) {
    // Reduce sets - keep first N
    return currentSets.slice(0, count).map((s, i) => ({
      ...s,
      setNumber: i + 1,
    }));
  }

  // Add more sets, copying values from the last set
  const lastSet = currentSets[currentSets.length - 1];
  const newSets = Array.from(
    { length: count - currentSets.length },
    (_, i) => ({
      ...lastSet,
      ...defaultValues,
      setNumber: currentSets.length + i + 1,
    })
  );

  return [...currentSets, ...newSets];
};

/**
 * Mapping from common parameter names to SetData field names.
 * Used to translate between different naming conventions in the codebase.
 */
export const PARAM_TO_SET_FIELD: Record<string, keyof SetData> = {
  // Direct mappings
  reps: 'reps',
  percentage: 'percentage',
  rpe: 'rpe',
  rir: 'rir',
  tempo: 'tempo',
  rest_seconds: 'rest_seconds',
  // Alternative names
  load: 'weight_kg',
  weight: 'weight_kg',
  weight_kg: 'weight_kg',
  charge: 'weight_kg',
  rest: 'rest_seconds',
  repos: 'rest_seconds',
};

/**
 * Converts a param field name to the corresponding SetData field.
 */
export const getSetFieldFromParam = (paramName: string): keyof SetData | null => {
  return PARAM_TO_SET_FIELD[paramName] || null;
};

/**
 * Creates synced params update that propagates a field change to variable sets.
 * 
 * @param currentParams - Current exercise parameters
 * @param field - Field being updated
 * @param value - New value
 * @returns Updated params with synced variableSets
 */
export const createSyncedParamsUpdate = <T extends { 
  variableSets?: SetData[]; 
  sets?: number;
  useVariableSets?: boolean;
}>(
  currentParams: T,
  field: string,
  value: string | number | undefined
): T => {
  const setField = getSetFieldFromParam(field);
  
  // If this is a syncable field and we have variable sets, sync them
  if (setField && currentParams.variableSets && currentParams.variableSets.length > 0) {
    const syncedSets = syncFieldToSets(currentParams.variableSets, setField, value);
    return {
      ...currentParams,
      [field]: value,
      variableSets: syncedSets,
    };
  }

  // If sets count changes, sync that too
  if (field === 'sets' && typeof value === 'number') {
    const defaultValues: Partial<SetData> = {};
    if (currentParams.variableSets?.[0]) {
      // Copy values from first set
      const first = currentParams.variableSets[0];
      defaultValues.reps = first.reps;
      defaultValues.weight_kg = first.weight_kg;
      defaultValues.percentage = first.percentage;
      defaultValues.rpe = first.rpe;
      defaultValues.tempo = first.tempo;
    }
    
    return {
      ...currentParams,
      sets: value,
      variableSets: syncSetsCount(currentParams.variableSets, value, defaultValues),
    };
  }

  return {
    ...currentParams,
    [field]: value,
  };
};
