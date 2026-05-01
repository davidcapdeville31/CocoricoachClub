/**
 * ============================================================================
 * MethodActionButtons - Boutons d'action uniformisés pour toutes les méthodes
 * ============================================================================
 * 
 * Ce composant fournit des boutons cohérents pour:
 * - Valider la méthode (mode édition)
 * - Modifier la méthode (mode lecture seule)
 * - Annuler
 * 
 * UTILISATION:
 * ```tsx
 * <MethodActionButtons
 *   isEditing={isEditing}
 *   onValidate={() => handleValidate(config)}
 *   onEdit={enableEditing}
 *   onCancel={handleCancel}
 *   isValid={errors.length === 0}
 *   methodColor="bg-violet-600 hover:bg-violet-700"
 * />
 * ```
 * 
 * GARANTIES:
 * - Le texte du bouton de validation est toujours "Valider la méthode"
 * - Le texte du bouton de modification est toujours "Modifier la méthode"
 * - Les styles sont cohérents sur toutes les méthodes
 */

import React from 'react';
import { Button } from "@/components/ui/button";
import { Check, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MethodActionButtonsProps {
  /** Mode édition actif ou non */
  isEditing: boolean;
  
  /** Callback de validation (mode édition uniquement) */
  onValidate: () => void;
  
  /** Callback pour passer en mode édition (mode lecture seule uniquement) */
  onEdit: () => void;
  
  /** Callback d'annulation */
  onCancel: () => void;
  
  /** Indique si la configuration est valide (désactive le bouton si false) */
  isValid?: boolean;
  
  /** Couleur personnalisée du bouton de validation (ex: "bg-violet-600 hover:bg-violet-700") */
  methodColor?: string;
  
  /** Classes CSS additionnelles pour le container */
  className?: string;
  
  /** Texte personnalisé pour le bouton de validation (par défaut: "Valider la méthode") */
  validateText?: string;
  
  /** Texte personnalisé pour le bouton de modification (par défaut: "Modifier la méthode") */
  editText?: string;
}

/**
 * Boutons d'action uniformisés pour les méthodes d'entraînement
 * 
 * Affiche:
 * - En mode édition: [Annuler] [Valider la méthode]
 * - En mode lecture: [Modifier la méthode]
 */
export const MethodActionButtons: React.FC<MethodActionButtonsProps> = ({
  isEditing,
  onValidate,
  onEdit,
  onCancel,
  isValid = true,
  methodColor = "bg-primary hover:bg-primary/90",
  className,
  validateText = "Valider la méthode",
  editText = "Modifier la méthode",
}) => {
  if (isEditing) {
    // Mode édition: afficher Annuler + Valider
    return (
      <div className={cn("flex gap-2 pt-2", className)}>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
        >
          <X className="h-4 w-4 mr-2" />
          Annuler
        </Button>
        <Button
          type="button"
          onClick={onValidate}
          disabled={!isValid}
          className={cn("flex-1", methodColor)}
        >
          <Check className="h-4 w-4 mr-2" />
          {validateText}
        </Button>
      </div>
    );
  }
  
  // Mode lecture seule: afficher Modifier
  return (
    <div className={cn("flex gap-2 pt-2", className)}>
      <Button
        type="button"
        variant="outline"
        onClick={onEdit}
        className="flex-1"
      >
        <Pencil className="h-4 w-4 mr-2" />
        {editText}
      </Button>
    </div>
  );
};

export default MethodActionButtons;
