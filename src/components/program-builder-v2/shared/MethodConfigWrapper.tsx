/**
 * ============================================================================
 * MethodConfigWrapper - Conteneur principal pour la configuration des méthodes
 * ============================================================================
 * 
 * Ce composant fournit une structure uniforme pour toutes les méthodes:
 * - En-tête avec titre, icône et bouton fermer
 * - Description de la méthode
 * - Zone de contenu (enfants)
 * - Boutons d'action (via MethodActionButtons)
 * 
 * UTILISATION:
 * ```tsx
 * <MethodConfigWrapper
 *   title="Configuration Cluster Set"
 *   description="Mini-séries avec repos courts..."
 *   icon={<Layers className="h-5 w-5" />}
 *   isEditing={isEditing}
 *   onValidate={() => handleValidate(config)}
 *   onEdit={enableEditing}
 *   onCancel={handleCancel}
 *   isValid={errors.length === 0}
 *   methodColor="orange"
 * >
 *   {/* Contenu de la configuration *\/}
 * </MethodConfigWrapper>
 * ```
 * 
 * GARANTIES:
 * - Structure visuelle cohérente sur toutes les méthodes
 * - Gestion uniforme des états édition/lecture seule
 * - Boutons d'action standardisés
 */

import React, { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MethodActionButtons } from "./MethodActionButtons";

/**
 * Configuration des couleurs par méthode
 */
const METHOD_COLORS = {
  orange: {
    border: "border-orange-500/30",
    bg: "bg-orange-500/5",
    icon: "text-orange-600",
    button: "bg-orange-600 hover:bg-orange-700",
  },
  violet: {
    border: "border-violet-500/30",
    bg: "bg-violet-500/5",
    icon: "text-violet-600",
    button: "bg-violet-600 hover:bg-violet-700",
  },
  green: {
    border: "border-green-500/30",
    bg: "bg-green-500/5",
    icon: "text-green-600",
    button: "bg-green-600 hover:bg-green-700",
  },
  blue: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    icon: "text-blue-600",
    button: "bg-blue-600 hover:bg-blue-700",
  },
  sky: {
    border: "border-sky-500/30",
    bg: "bg-sky-500/5",
    icon: "text-sky-600",
    button: "bg-sky-500 hover:bg-sky-600",
  },
  red: {
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    icon: "text-red-600",
    button: "bg-red-600 hover:bg-red-700",
  },
  amber: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    icon: "text-amber-600",
    button: "bg-amber-600 hover:bg-amber-700",
  },
  cyan: {
    border: "border-cyan-500/30",
    bg: "bg-cyan-500/5",
    icon: "text-cyan-600",
    button: "bg-cyan-600 hover:bg-cyan-700",
  },
  pink: {
    border: "border-pink-500/30",
    bg: "bg-pink-500/5",
    icon: "text-pink-600",
    button: "bg-pink-600 hover:bg-pink-700",
  },
  indigo: {
    border: "border-indigo-500/30",
    bg: "bg-indigo-500/5",
    icon: "text-indigo-600",
    button: "bg-indigo-600 hover:bg-indigo-700",
  },
} as const;

type MethodColorKey = keyof typeof METHOD_COLORS;

interface MethodConfigWrapperProps {
  /** Titre de la méthode */
  title: string;
  
  /** Description courte de la méthode */
  description: string;
  
  /** Icône de la méthode (élément React) */
  icon: ReactNode;
  
  /** Mode édition actif ou non */
  isEditing: boolean;
  
  /** Callback de validation */
  onValidate: () => void;
  
  /** Callback pour passer en mode édition */
  onEdit: () => void;
  
  /** Callback d'annulation */
  onCancel: () => void;
  
  /** La configuration est-elle valide? */
  isValid?: boolean;
  
  /** Couleur de la méthode (clé dans METHOD_COLORS) */
  methodColor?: MethodColorKey;
  
  /** Contenu de la configuration */
  children: ReactNode;
  
  /** Éléments supplémentaires dans le header (ex: badge exercice) */
  headerExtra?: ReactNode;
  
  /** Classes CSS additionnelles */
  className?: string;
  
  /** Masquer le bouton fermer (X) */
  hideCloseButton?: boolean;
}

/**
 * Conteneur principal pour la configuration des méthodes d'entraînement
 */
export const MethodConfigWrapper: React.FC<MethodConfigWrapperProps> = ({
  title,
  description,
  icon,
  isEditing,
  onValidate,
  onEdit,
  onCancel,
  isValid = true,
  methodColor = 'violet',
  children,
  headerExtra,
  className,
  hideCloseButton = false,
}) => {
  const colors = METHOD_COLORS[methodColor];
  
  return (
    <Card className={cn(colors.border, colors.bg, className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className={colors.icon}>{icon}</span>
            {title}
          </CardTitle>
          {!hideCloseButton && (
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <p className="text-sm text-muted-foreground">
          {description}
        </p>
        
        {headerExtra}
      </CardHeader>
      
      <CardContent className="space-y-6">
        {children}
        
        {/* Boutons d'action uniformisés */}
        <MethodActionButtons
          isEditing={isEditing}
          onValidate={onValidate}
          onEdit={onEdit}
          onCancel={onCancel}
          isValid={isValid}
          methodColor={colors.button}
        />
      </CardContent>
    </Card>
  );
};

export default MethodConfigWrapper;

// Export des couleurs pour usage externe
export { METHOD_COLORS };
export type { MethodColorKey };
