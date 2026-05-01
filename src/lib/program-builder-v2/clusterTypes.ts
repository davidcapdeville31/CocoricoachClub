/**
 * Cluster Training Method Types and Configuration
 * Méthode de force/puissance consistant à diviser une série en mini-séries
 * avec de courts repos intra-cluster pour maintenir la qualité des répétitions
 */

import { SetData } from './variableSetsTypes';

// Load type for cluster method
export type ClusterLoadType = 'percentage' | 'weight_kg' | 'rpe';

// Individual cluster step within a set
export interface ClusterStep {
  reps: number | 'max'; // Number of reps or 'max' for failure
  restAfterSeconds?: number; // Rest after this cluster (undefined for the last cluster)
}

// Cluster configuration
export interface ClusterConfig {
  // Exercise info (stored separately in the block)
  exerciseId?: string;
  exerciseName?: string;
  
  // Cluster steps - each cluster can have different reps and rest
  clusterSteps: ClusterStep[];
  
  // Sets and inter-set recovery
  sets: number;
  interSetRestSeconds: number; // Rest between full cluster sets (2-3 min typically)
  
  // Load configuration
  loadType: ClusterLoadType;
  loadValue?: number; // % 1RM, kg, or RPE value
  
  // Variable sets support
  variableSets?: SetData[];
  useVariableSets?: boolean;
  
  // Target RPE (optional, separate from load)
  targetRpe?: number;
  
  // Coach notes
  coachNotes?: string;
}

// Athlete feedback for post-session tracking
export interface ClusterFeedback {
  // Actual values
  actualSets?: number;
  actualClusters?: number;
  actualRepsPerCluster?: number;
  actualWeightKg?: number;
  
  // Perceived exertion
  rpe?: number; // 1-10
  
  // Quality indicators
  barSpeedMaintained?: 'oui' | 'non' | 'partiel';
  
  // Free comment
  commentaire?: string;
}

// Load type labels
export const CLUSTER_LOAD_TYPES: Record<ClusterLoadType, { label: string; unit: string; placeholder: string }> = {
  percentage: { label: '% 1RM', unit: '%', placeholder: '85' },
  weight_kg: { label: 'Charge (kg)', unit: 'kg', placeholder: '100' },
  rpe: { label: 'RPE cible', unit: '/10', placeholder: '8' }
};

// Create default cluster step
export const createDefaultClusterStep = (restAfter: number = 20): ClusterStep => ({
  reps: 2,
  restAfterSeconds: restAfter,
});

// Default configuration with 3 clusters
export const getDefaultClusterConfig = (): ClusterConfig => ({
  clusterSteps: [
    { reps: 2, restAfterSeconds: 20 },
    { reps: 2, restAfterSeconds: 20 },
    { reps: 2, restAfterSeconds: undefined }, // Last cluster has no rest after
  ],
  sets: 4,
  interSetRestSeconds: 180,
  loadType: 'percentage',
  loadValue: 85,
});

// Format summary text for display
export const formatClusterSummary = (config: ClusterConfig): string => {
  const loadDisplay = config.loadType === 'percentage' 
    ? `${config.loadValue}% 1RM`
    : config.loadType === 'weight_kg'
      ? `${config.loadValue}kg`
      : `RPE ${config.loadValue}`;
  
  const clusterCount = config.clusterSteps.length;
  const repsDisplay = config.clusterSteps
    .map(s => s.reps === 'max' ? 'MAX' : s.reps)
    .join('/');
  
  return `${config.sets}×(${clusterCount} clusters: ${repsDisplay} reps) @ ${loadDisplay}`;
};

// Format for athlete display - clear and pedagogical
export const formatClusterForAthlete = (config: ClusterConfig): string => {
  const parts: string[] = [];
  
  config.clusterSteps.forEach((step, i) => {
    const repsText = step.reps === 'max' ? 'MAX' : `${step.reps} rep${(step.reps as number) > 1 ? 's' : ''}`;
    parts.push(repsText);
    
    if (i < config.clusterSteps.length - 1 && step.restAfterSeconds) {
      parts.push(`→ repos ${step.restAfterSeconds}s →`);
    }
  });
  
  const interSetMinutes = Math.round(config.interSetRestSeconds / 60);
  
  return `Série: ${parts.join(' ')}\nRepos ${interSetMinutes} min\n(×${config.sets} séries)`;
};

// Calculate total volume
export const calculateClusterVolume = (config: ClusterConfig): {
  totalReps: number | 'variable';
  totalSets: number;
  repsPerSet: number | 'variable';
  estimatedTonnage: number | null;
} => {
  // Check if any cluster has 'max' reps
  const hasMax = config.clusterSteps.some(s => s.reps === 'max');
  
  if (hasMax) {
    return {
      totalReps: 'variable',
      totalSets: config.sets,
      repsPerSet: 'variable',
      estimatedTonnage: null
    };
  }
  
  const repsPerSet = config.clusterSteps.reduce((sum, s) => sum + (s.reps as number), 0);
  const totalReps = repsPerSet * config.sets;
  
  // Estimate tonnage only if we have a weight in kg
  let estimatedTonnage: number | null = null;
  if (config.loadType === 'weight_kg' && config.loadValue) {
    estimatedTonnage = config.loadValue * totalReps;
  }
  
  return {
    totalReps,
    totalSets: config.sets,
    repsPerSet,
    estimatedTonnage
  };
};

// Validate configuration
export const validateClusterConfig = (config: ClusterConfig): string[] => {
  const errors: string[] = [];
  
  if (config.clusterSteps.length < 2 || config.clusterSteps.length > 10) {
    errors.push('Le nombre de clusters doit être entre 2 et 10');
  }
  
  config.clusterSteps.forEach((step, i) => {
    if (step.reps !== 'max' && step.reps < 0) {
      errors.push(`Cluster ${i + 1}: les répétitions doivent être positives (ou MAX)`);
    }
    if (i < config.clusterSteps.length - 1) {
      if (step.restAfterSeconds !== undefined && (step.restAfterSeconds < 5 || step.restAfterSeconds > 60)) {
        errors.push(`Cluster ${i + 1}: le repos doit être entre 5 et 60 secondes`);
      }
    }
  });
  
  if (config.sets < 1 || config.sets > 20) {
    errors.push('Le nombre de séries doit être entre 1 et 20');
  }
  
  if (config.interSetRestSeconds < 30 || config.interSetRestSeconds > 600) {
    errors.push('Le repos inter-séries doit être entre 30 secondes et 10 minutes');
  }
  
  if (config.loadType === 'percentage' && config.loadValue && (config.loadValue < 50 || config.loadValue > 100)) {
    errors.push('Le % 1RM doit être entre 50% et 100%');
  }
  
  if (config.loadType === 'rpe' && config.loadValue && (config.loadValue < 1 || config.loadValue > 10)) {
    errors.push('Le RPE doit être entre 1 et 10');
  }
  
  return errors;
};
