/**
 * ============================================================================
 * MethodReadOnlyView - Interface de LECTURE SEULE après validation
 * ============================================================================
 * 
 * Ce composant est monté UNIQUEMENT après validation d'une méthode.
 * 
 * GARANTIES :
 * - AUCUN champ éditable (pas d'input, pas de textarea)
 * - AUCUN indice visuel d'interactivité (pas de curseur texte, pas de cadre vert)
 * - Aucune logique conditionnelle d'édition
 * - Les valeurs sont affichées en badges statiques et divs non interactifs
 * 
 * Ce composant est DÉMONTÉ quand l'utilisateur clique "Modifier la méthode".
 * Il n'existe AUCUNE logique "readOnly=false" dans ce composant.
 */

import React, { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { TrainingVariablesManager } from "../TrainingVariablesManager";
import type { ExerciseType } from "@/lib/exerciseTypes";

interface MethodReadOnlyViewProps {
  /** Type d'exercice */
  exerciseType: ExerciseType;
  /** Valeurs actuelles des variables (affichées en badges) */
  values: Record<string, any>;
  /** Variables visibles */
  visibleVariables: string[];
  /** Note pour l'athlète (affichée en texte statique) */
  notes?: string;
  /** Afficher le repos pour le groupe */
  showRestForGroup?: boolean;
  /** Est dans un groupe lié */
  isGrouped?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Contenu spécifique à la méthode en lecture seule (ReadOnlySeriesDisplay) */
  methodSpecificContent?: ReactNode;
  /** Masquer les variables standards (pour Rest-Pause) */
  hideStandardVariables?: boolean;
}

/**
 * Interface de lecture seule après validation.
 * 
 * INTERDICTIONS :
 * - Pas d'input
 * - Pas de textarea
 * - Pas de curseur text
 * - Pas de cadre de focus
 * - Pas de logique readOnly={false}
 */
export const MethodReadOnlyView: React.FC<MethodReadOnlyViewProps> = ({
  exerciseType,
  values,
  visibleVariables,
  notes,
  showRestForGroup = true,
  isGrouped = false,
  compact = false,
  methodSpecificContent,
  hideStandardVariables = false,
}) => {
  const isCardioMachine = exerciseType === 'cardio_machine';
  const isRunning = exerciseType === 'cardio_locomotion';

  return (
    <>
      {/* Variables d'entraînement - TOUJOURS en lecture seule (badges statiques) */}
      {!hideStandardVariables && (
        <TrainingVariablesManager
          exerciseType={exerciseType}
          values={values}
          onUpdate={() => {}} // Noop - jamais appelé en lecture seule
          visibleVariables={visibleVariables}
          onVisibleVariablesChange={() => {}} // Noop
          showRestForGroup={showRestForGroup}
          isGrouped={isGrouped}
          compact={compact}
          readOnly={true}
        />
      )}

      {/* Contenu spécifique à la méthode en lecture seule (ReadOnlySeriesDisplay) */}
      {methodSpecificContent}

      {/* Notes pour l'athlète supprimées ici — gérées au niveau méthode via AthleteNoteDisplay */}
    </>
  );
};

export default MethodReadOnlyView;
