/**
 * ============================================================================
 * MethodFieldWrapper - Wrapper pour les champs en mode édition/lecture seule
 * ============================================================================
 * 
 * Ce composant enveloppe les champs de saisie pour:
 * - Afficher un champ éditable en mode édition
 * - Afficher une valeur statique en mode lecture seule
 * 
 * UTILISATION:
 * ```tsx
 * <MethodFieldWrapper
 *   isEditing={isEditing}
 *   value={config.sets}
 *   displayValue={`${config.sets} séries`}
 *   label="Nombre de séries"
 * >
 *   <Input
 *     type="number"
 *     value={config.sets}
 *     onChange={(e) => setConfig({...config, sets: e.target.value})}
 *   />
 * </MethodFieldWrapper>
 * ```
 * 
 * COMPORTEMENT:
 * - isEditing=true: affiche les children (champ éditable)
 * - isEditing=false: affiche displayValue dans un badge/texte statique
 */

import React, { ReactNode } from 'react';
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface MethodFieldWrapperProps {
  /** Mode édition actif ou non */
  isEditing: boolean;
  
  /** Valeur à afficher en mode lecture seule */
  displayValue: string | number | ReactNode;
  
  /** Champ éditable (rendu seulement en mode édition) */
  children: ReactNode;
  
  /** Label du champ (optionnel, affiché en mode lecture) */
  label?: string;
  
  /** Classes CSS additionnelles */
  className?: string;
  
  /** Variante d'affichage en lecture seule */
  readOnlyVariant?: 'badge' | 'text' | 'box';
  
  /** Couleur du badge en mode lecture (par défaut: outline) */
  badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive';
}

/**
 * Wrapper qui bascule entre champ éditable et valeur en lecture seule
 */
export const MethodFieldWrapper: React.FC<MethodFieldWrapperProps> = ({
  isEditing,
  displayValue,
  children,
  label,
  className,
  readOnlyVariant = 'box',
  badgeVariant = 'outline',
}) => {
  // Mode édition: afficher le champ éditable
  if (isEditing) {
    return <div className={className}>{children}</div>;
  }
  
  // Mode lecture seule: afficher la valeur statique
  switch (readOnlyVariant) {
    case 'badge':
      return (
        <div className={className}>
          {label && <span className="text-xs text-muted-foreground mr-1">{label}:</span>}
          <Badge variant={badgeVariant} className="font-medium">
            {displayValue}
          </Badge>
        </div>
      );
      
    case 'text':
      return (
        <div className={cn("text-sm", className)}>
          {label && <span className="text-muted-foreground mr-1">{label}:</span>}
          <span className="font-medium">{displayValue}</span>
        </div>
      );
      
    case 'box':
    default:
      return (
        <div className={className}>
          {label && (
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
          )}
          <div className="h-9 px-3 py-2 rounded-lg border bg-muted/50 flex items-center text-sm font-medium">
            {displayValue}
          </div>
        </div>
      );
  }
};

export default MethodFieldWrapper;
