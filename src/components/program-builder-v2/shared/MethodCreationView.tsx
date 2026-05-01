/**
 * ============================================================================
 * MethodCreationView - Interface de CRÉATION / MODIFICATION d'une méthode
 * ============================================================================
 * 
 * Ce composant est monté dans DEUX cas :
 * 1. Création initiale d'une méthode (valeurs vides)
 * 2. Modification après validation (valeurs pré-remplies)
 * 
 * L'interface est STRICTEMENT IDENTIQUE dans les deux cas.
 * Tous les champs sont éditables : variables, notes, séries spéciales.
 * 
 * Ce composant n'est JAMAIS monté en mode lecture seule.
 * Il est DÉMONTÉ quand l'utilisateur valide la méthode.
 */

import React, { ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TrainingVariablesManager } from "../TrainingVariablesManager";
import { WeightliftingPositionSelector } from "../WeightliftingPositionSelector";
import type { ExerciseType } from "@/lib/program-builder-v2/exerciseTypes";

/**
 * Props communes pour le rendu des variables d'entraînement en mode création.
 * Réutilisable pour SortableExerciseItem ET LinkedBlockExerciseItem.
 */
interface MethodCreationViewProps {
  /** ID de l'exercice */
  exerciseId: string;
  /** Nom de l'exercice */
  exerciseName: string;
  /** Données de la station (pour WeightliftingPositionSelector) */
  stationName: string;
  /** Position de départ haltéro */
  startingPosition?: string;
  /** Type d'exercice */
  exerciseType: ExerciseType;
  /** Valeurs actuelles des variables */
  values: Record<string, any>;
  /** Variables visibles */
  visibleVariables: string[];
  /** Variable sets (per-set customization) */
  variableSets?: any[];
  /** Callback de mise à jour d'un champ */
  onUpdate: (id: string, field: string, value: any) => void;
  /** Note pour l'athlète */
  notes?: string;
  /** Afficher le repos pour le groupe */
  showRestForGroup?: boolean;
  /** Est dans un groupe lié */
  isGrouped?: boolean;
  /** Afficher les variable sets */
  showVariableSets?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Contenu spécifique à la méthode (séries Rest-Pause, Drop Set, Pyramides) */
  methodSpecificContent?: ReactNode;
  /** Masquer les variables standards (pour Rest-Pause qui a ses propres séries) */
  hideStandardVariables?: boolean;
}

/**
 * Interface de création/modification d'une méthode.
 * 
 * GARANTIES :
 * - Tous les champs sont éditables (inputs, textarea)
 * - Aucun mode lecture seule
 * - Interface identique en création initiale et en modification
 */
export const MethodCreationView: React.FC<MethodCreationViewProps> = ({
  exerciseId,
  exerciseName,
  stationName,
  startingPosition,
  exerciseType,
  values,
  visibleVariables,
  variableSets,
  onUpdate,
  notes,
  showRestForGroup = true,
  isGrouped = false,
  showVariableSets = true,
  compact = false,
  methodSpecificContent,
  hideStandardVariables = false,
}) => {
  const isCardioMachine = exerciseType === 'cardio_machine';
  const isRunning = exerciseType === 'cardio_locomotion';

  return (
    <>
      {/* Weightlifting Position Selector */}
      <WeightliftingPositionSelector
        exerciseName={exerciseName}
        stationName={stationName}
        value={startingPosition}
        onChange={(value) => onUpdate(exerciseId, 'startingPosition', value)}
        compact
      />

      {/* Variables d'entraînement - TOUJOURS éditables, readOnly=false */}
      {!hideStandardVariables && (
        <TrainingVariablesManager
          exerciseType={exerciseType}
          values={values}
          onUpdate={(key, value) => onUpdate(exerciseId, key, value)}
          visibleVariables={visibleVariables}
          onVisibleVariablesChange={(vars) => onUpdate(exerciseId, "visibleVariables", vars)}
          showRestForGroup={showRestForGroup}
          isGrouped={isGrouped}
          variableSets={variableSets}
          onVariableSetsChange={(sets) => onUpdate(exerciseId, "variableSets", sets)}
          showVariableSets={showVariableSets && !isCardioMachine && !isRunning}
          compact={compact}
          readOnly={false}
        />
      )}

      {/* Contenu spécifique à la méthode (séries Rest-Pause, Drop Set, etc.) */}
      {methodSpecificContent}

      {/* Notes pour l'athlète supprimées ici — gérées au niveau méthode via AthleteNoteDisplay */}
    </>
  );
};

export default MethodCreationView;
