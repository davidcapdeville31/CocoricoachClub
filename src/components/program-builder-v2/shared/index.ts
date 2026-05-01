/**
 * ============================================================================
 * Composants partagés pour les méthodes d'entraînement
 * ============================================================================
 * 
 * Ce module exporte tous les composants et hooks nécessaires pour créer
 * des méthodes d'entraînement avec un comportement uniforme:
 * 
 * - useMethodEditing: Hook pour gérer l'état édition/lecture seule
 * - MethodConfigWrapper: Conteneur principal avec structure cohérente
 * - MethodActionButtons: Boutons Valider/Modifier/Annuler uniformisés
 * - MethodFieldWrapper: Wrapper pour champs éditables/lecture seule
 * 
 * EXEMPLE D'IMPLÉMENTATION D'UNE NOUVELLE MÉTHODE:
 * ```tsx
 * import { 
 *   useMethodEditing, 
 *   MethodConfigWrapper,
 *   MethodFieldWrapper 
 * } from './shared';
 * 
 * export const NewMethodConfigSlots = ({ onValidate, onCancel, initialConfig }) => {
 *   const [config, setConfig] = useState(initialConfig || getDefaultConfig());
 *   
 *   const {
 *     isEditing,
 *     enableEditing,
 *     handleValidate,
 *     handleCancel,
 *   } = useMethodEditing({
 *     onValidate,
 *     onCancel,
 *     initialConfig,
 *   });
 *   
 *   return (
 *     <MethodConfigWrapper
 *       title="Nouvelle Méthode"
 *       description="Description de la méthode"
 *       icon={<Icon className="h-5 w-5" />}
 *       isEditing={isEditing}
 *       onValidate={() => handleValidate(config)}
 *       onEdit={enableEditing}
 *       onCancel={handleCancel}
 *       methodColor="violet"
 *     >
 *       <MethodFieldWrapper
 *         isEditing={isEditing}
 *         displayValue={`${config.sets} séries`}
 *       >
 *         <Input value={config.sets} onChange={...} />
 *       </MethodFieldWrapper>
 *     </MethodConfigWrapper>
 *   );
 * };
 * ```
 */

// Hook principal pour la gestion de l'édition
export { useMethodEditing } from '@/hooks/program-builder-v2/useMethodEditing';
export type { default as UseMethodEditingType } from '@/hooks/program-builder-v2/useMethodEditing';

// Composants de structure
export { MethodConfigWrapper, METHOD_COLORS } from './MethodConfigWrapper';
export type { MethodColorKey } from './MethodConfigWrapper';

// Composants d'action
export { MethodActionButtons } from './MethodActionButtons';

// Composants de champs
export { MethodFieldWrapper } from './MethodFieldWrapper';

// Composant UNIQUE d'affichage des exercices (source de vérité)
export { ExerciseFullDisplay, getExerciseType, formatDuration, formatPace, formatDistance, getInputLabelsForType } from './ExerciseFullDisplay';

// Composant d'affichage lecture seule des séries (Rest-Pause, Drop Set, Pyramides)
export { ReadOnlySeriesDisplay } from './ReadOnlySeriesDisplay';

// ============================================================================
// Architecture MODE_CREATION / MODE_LECTURE_SEULE
// ============================================================================
// Deux composants distincts montés/démontés selon methodViewMode:
// - "creation" → MethodCreationView (interface identique création/modification)
// - "readonly" → MethodReadOnlyView (aucun champ éditable, aucun indice visuel)
export { MethodCreationView } from './MethodCreationView';
export { MethodReadOnlyView } from './MethodReadOnlyView';
