/**
 * Cluster Training Method Types and Configuration
 */
import { SetData } from './variableSetsTypes';

export type ClusterLoadType = 'percentage' | 'weight_kg' | 'rpe';

export interface ClusterStep {
  reps: number | 'max';
  restAfterSeconds?: number;
}

export interface ClusterConfig {
  exerciseId?: string;
  exerciseName?: string;
  clusterSteps: ClusterStep[];
  sets: number;
  interSetRestSeconds: number;
  loadType: ClusterLoadType;
  loadValue?: number;
  variableSets?: SetData[];
  useVariableSets?: boolean;
  targetRpe?: number;
  coachNotes?: string;
}

export interface ClusterFeedback {
  actualSets?: number;
  actualClusters?: number;
  actualRepsPerCluster?: number;
  actualWeightKg?: number;
  rpe?: number;
  barSpeedMaintained?: 'oui' | 'non' | 'partiel';
  commentaire?: string;
}

export const CLUSTER_LOAD_TYPES: Record<ClusterLoadType, { label: string; unit: string; placeholder: string }> = {
  percentage: { label: '% 1RM', unit: '%', placeholder: '85' },
  weight_kg: { label: 'Charge (kg)', unit: 'kg', placeholder: '100' },
  rpe: { label: 'RPE cible', unit: '/10', placeholder: '8' },
};

export const createDefaultClusterStep = (restAfter: number = 20): ClusterStep => ({
  reps: 2,
  restAfterSeconds: restAfter,
});

export const getDefaultClusterConfig = (): ClusterConfig => ({
  clusterSteps: [
    { reps: 2, restAfterSeconds: 20 },
    { reps: 2, restAfterSeconds: 20 },
    { reps: 2, restAfterSeconds: undefined },
  ],
  sets: 4,
  interSetRestSeconds: 180,
  loadType: 'percentage',
  loadValue: 85,
});

export const formatClusterSummary = (config: ClusterConfig): string => {
  const loadDisplay = config.loadType === 'percentage'
    ? `${config.loadValue}% 1RM`
    : config.loadType === 'weight_kg'
      ? `${config.loadValue}kg`
      : `RPE ${config.loadValue}`;
  const clusterCount = config.clusterSteps.length;
  const repsDisplay = config.clusterSteps.map(s => s.reps === 'max' ? 'MAX' : s.reps).join('/');
  return `${config.sets}×(${clusterCount} clusters: ${repsDisplay} reps) @ ${loadDisplay}`;
};
