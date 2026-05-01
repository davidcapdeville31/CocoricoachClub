/**
 * ============================================================================
 * useMethodEditing - Hook centralisé pour la gestion édition/lecture des méthodes
 * ============================================================================
 * 
 * Ce hook fournit une logique réutilisable pour:
 * - Gérer l'état d'édition (mode édition vs lecture seule)
 * - Gérer la validation et l'annulation
 * - Fournir un état cohérent pour toutes les méthodes d'entraînement
 * 
 * UTILISATION:
 * ```tsx
 * const {
 *   isEditing,
 *   enableEditing,
 *   disableEditing,
 *   handleValidate,
 *   handleCancel,
 *   isValidated,
 * } = useMethodEditing({
 *   onValidate: (config) => console.log('Validated:', config),
 *   onCancel: () => console.log('Cancelled'),
 *   initialEditMode: true, // Optionnel: commence en mode édition
 * });
 * ```
 * 
 * ARCHITECTURE:
 * - Toutes les méthodes utilisent ce hook pour garantir un comportement uniforme
 * - Le bouton "Valider la méthode" déclenche handleValidate
 * - Le bouton "Modifier la méthode" déclenche enableEditing
 * - Les champs sont en lecture seule quand isEditing === false
 */

import { useState, useCallback } from 'react';

/**
 * Options de configuration du hook
 */
interface UseMethodEditingOptions<TConfig> {
  /** Callback appelé lors de la validation de la méthode */
  onValidate: (config: TConfig) => void;
  
  /** Callback appelé lors de l'annulation */
  onCancel: () => void;
  
  /** Mode édition initial (défaut: true pour nouvelle méthode, false si déjà validée) */
  initialEditMode?: boolean;
  
  /** Configuration initiale (si fournie, indique une méthode déjà validée) */
  initialConfig?: TConfig;
}

/**
 * État et actions retournés par le hook
 */
interface UseMethodEditingResult<TConfig> {
  /** Indique si on est en mode édition */
  isEditing: boolean;
  
  /** Indique si la méthode a été validée au moins une fois */
  isValidated: boolean;
  
  /** Passe en mode édition */
  enableEditing: () => void;
  
  /** Quitte le mode édition (sans sauvegarder) */
  disableEditing: () => void;
  
  /** Valide la méthode et passe en mode lecture seule */
  handleValidate: (config: TConfig) => void;
  
  /** Annule les modifications et quitte */
  handleCancel: () => void;
  
  /** Réinitialise l'état (utile pour les nouvelles méthodes) */
  reset: () => void;
}

/**
 * Hook principal pour la gestion de l'édition des méthodes
 * 
 * @template TConfig - Type de la configuration de la méthode
 * @param options - Options de configuration
 * @returns État et actions pour gérer l'édition
 */
export function useMethodEditing<TConfig>({
  onValidate,
  onCancel,
  initialEditMode,
  initialConfig,
}: UseMethodEditingOptions<TConfig>): UseMethodEditingResult<TConfig> {
  // Déterminer le mode initial:
  // - Si une config initiale est fournie, on est en mode lecture seule (méthode déjà validée)
  // - Sinon, on est en mode édition (nouvelle méthode)
  const defaultEditMode = initialEditMode ?? !initialConfig;
  
  const [isEditing, setIsEditing] = useState<boolean>(defaultEditMode);
  const [isValidated, setIsValidated] = useState<boolean>(!!initialConfig);
  
  /**
   * Passe en mode édition
   * Permet à l'utilisateur de modifier les paramètres de la méthode
   */
  const enableEditing = useCallback(() => {
    setIsEditing(true);
  }, []);
  
  /**
   * Quitte le mode édition sans sauvegarder
   * Les modifications non validées sont perdues
   */
  const disableEditing = useCallback(() => {
    setIsEditing(false);
  }, []);
  
  /**
   * Valide la méthode avec la configuration actuelle
   * - Appelle le callback onValidate
   * - Passe en mode lecture seule
   * - Marque la méthode comme validée
   */
  const handleValidate = useCallback((config: TConfig) => {
    onValidate(config);
    setIsEditing(false);
    setIsValidated(true);
  }, [onValidate]);
  
  /**
   * Annule les modifications
   * - Appelle le callback onCancel
   * - Quitte le composant de configuration
   */
  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);
  
  /**
   * Réinitialise l'état du hook
   * Utile pour créer une nouvelle méthode du même type
   */
  const reset = useCallback(() => {
    setIsEditing(true);
    setIsValidated(false);
  }, []);
  
  return {
    isEditing,
    isValidated,
    enableEditing,
    disableEditing,
    handleValidate,
    handleCancel,
    reset,
  };
}

export default useMethodEditing;
