/**
 * Variable Sets System - Types and utilities
 * Allows each set to have different values for weight, reps, RPE, %1RM, etc.
 */

export interface SetClusterStep {
  reps: number | 'max';
  restAfterSeconds?: number;
}

export interface SetData {
  setNumber: number;
  reps?: string | number;
  weight_kg?: number;
  percentage?: number;
  rpe?: number;
  tempo?: string;
  rir?: number;
  rest_seconds?: number;
  clusterSteps?: SetClusterStep[];
  completed?: boolean;
  actualReps?: number;
  actualWeight_kg?: number;
  notes?: string;
}

export interface VariableSetsConfig {
  enabled: boolean;
  sets: SetData[];
}

export interface SetsTableColumn {
  key: keyof SetData;
  label: string;
  placeholder: string;
  type: 'number' | 'text';
  width?: string;
  min?: number;
  max?: number;
  step?: number;
}

export const STRENGTH_SET_COLUMNS: SetsTableColumn[] = [
  { key: 'reps', label: 'Reps', placeholder: '8', type: 'text', width: '120px' },
  { key: 'weight_kg', label: 'Charge', placeholder: '70', type: 'number', width: '90px', step: 0.5 },
  { key: 'percentage', label: '%1RM', placeholder: '75', type: 'number', width: '80px', max: 100 },
  { key: 'rpe', label: 'RPE', placeholder: '8', type: 'number', width: '70px', min: 1, max: 10, step: 0.5 },
  { key: 'rir', label: 'RIR', placeholder: '2', type: 'number', width: '70px', min: 0, max: 5 },
  { key: 'tempo', label: 'Tempo', placeholder: '3-0-1-0', type: 'text', width: '100px' },
  { key: 'rest_seconds', label: 'Repos', placeholder: '01:30', type: 'text', width: '90px', min: 0 },
];

export const formatTempo = (value: string): string => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (value.includes('-') && /^\d-\d-\d-\d$/.test(value)) return value;
  if (digits.length >= 4) return `${digits[0]}-${digits[1]}-${digits[2]}-${digits[3]}`;
  return digits;
};

export const parseTempo = (value: string): string => {
  if (!value) return '';
  return value.replace(/\D/g, '').slice(0, 4);
};

export const generateSetId = (): string =>
  `set_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const createDefaultSet = (setNumber: number): SetData => ({ setNumber });

export const createInitialSets = (count: number): SetData[] =>
  Array.from({ length: count }, (_, i) => createDefaultSet(i + 1));

export const convertToVariableSets = (params: {
  sets?: number;
  reps?: string | number;
  weight_kg?: number;
  percentage?: number;
  rpe?: number;
  tempo?: string;
}): SetData[] => {
  const count = params.sets || 3;
  return Array.from({ length: count }, (_, i) => ({
    setNumber: i + 1,
    reps: params.reps,
    weight_kg: params.weight_kg,
    percentage: params.percentage,
    rpe: params.rpe,
    tempo: params.tempo,
  }));
};

export const summarizeVariableSets = (sets: SetData[]) => {
  if (sets.length === 0) {
    return { setsCount: 0, repsRange: '-', weightRange: '-', percentageRange: '-', rpeRange: '-' };
  }
  const getRange = (values: (number | undefined)[]): string => {
    const defined = values.filter((v): v is number => v !== undefined);
    if (defined.length === 0) return '-';
    const min = Math.min(...defined);
    const max = Math.max(...defined);
    return min === max ? `${min}` : `${min}-${max}`;
  };
  const repsValues = sets.map(s => {
    if (typeof s.reps === 'number') return s.reps;
    if (typeof s.reps === 'string') {
      const num = parseInt(s.reps);
      return isNaN(num) ? undefined : num;
    }
    return undefined;
  });
  return {
    setsCount: sets.length,
    repsRange: sets.every(s => s.reps === sets[0]?.reps) && sets[0]?.reps
      ? String(sets[0].reps)
      : getRange(repsValues),
    weightRange: getRange(sets.map(s => s.weight_kg)),
    percentageRange: getRange(sets.map(s => s.percentage)),
    rpeRange: getRange(sets.map(s => s.rpe)),
  };
};

export const hasVariableValues = (sets: SetData[]): boolean => {
  if (sets.length <= 1) return false;
  const checkVariation = <K extends keyof SetData>(key: K): boolean => {
    const firstValue = sets[0]?.[key];
    return sets.some(s => s[key] !== firstValue && (s[key] !== undefined || firstValue !== undefined));
  };
  return (
    checkVariation('reps') || checkVariation('weight_kg') || checkVariation('percentage') ||
    checkVariation('rpe') || checkVariation('tempo') || checkVariation('rest_seconds')
  );
};

export const formatSetsSummary = (sets: SetData[]): string => {
  if (sets.length === 0) return '';
  const summary = summarizeVariableSets(sets);
  const parts: string[] = [`${summary.setsCount}×`];
  if (summary.repsRange !== '-') parts.push(`${summary.repsRange} reps`);
  if (summary.weightRange !== '-') parts.push(`@ ${summary.weightRange}kg`);
  else if (summary.percentageRange !== '-') parts.push(`@ ${summary.percentageRange}%`);
  if (summary.rpeRange !== '-') parts.push(`RPE ${summary.rpeRange}`);
  return parts.join(' ');
};
