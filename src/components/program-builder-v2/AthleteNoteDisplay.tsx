/**
 * AthleteNoteDisplay — Affichage de la note pour l'athlète
 * 
 * MODES :
 * - Lecture seule (readOnly=true, défaut) : affiche la note sans édition
 * - Éditable (readOnly=false) : le coach peut modifier le texte généré
 * 
 * LOGIQUE :
 * - Si customNote est fourni et non vide → affiche customNote (note personnalisée)
 * - Sinon → affiche generatedNote (note auto-générée)
 * - Bouton "Régénérer" pour écraser la note personnalisée par la note auto
 */

import React, { useState } from "react";
import { FileText, RefreshCw, Pencil, Check } from "lucide-react";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AthleteNoteDisplayProps {
  /** Note auto-générée par le moteur */
  note: string;
  /** Note personnalisée par le coach (écrase la note auto si présente) */
  customNote?: string;
  /** Callback quand le coach modifie la note */
  onCustomNoteChange?: (value: string) => void;
  /** Mode lecture seule (défaut: true) */
  readOnly?: boolean;
  className?: string;
}

export const AthleteNoteDisplay: React.FC<AthleteNoteDisplayProps> = ({
  note: rawNote,
  customNote: rawCustomNote,
  onCustomNoteChange,
  readOnly = true,
  className = "",
}) => {
  const [isEditing, setIsEditing] = useState(false);

  // Sanitize: notes can be objects from JSONB
  const note = typeof rawNote === 'string' ? rawNote : (rawNote ? String(rawNote) : "");
  const customNote = typeof rawCustomNote === 'string' ? rawCustomNote : (rawCustomNote ? String(rawCustomNote) : undefined);

  const displayedNote = (customNote && customNote.trim() !== "") ? customNote : note;
  const isCustomized = !!(customNote && customNote.trim() !== "");
  
  if (!displayedNote || displayedNote.trim() === "") return null;

  // Read-only mode (athlete view, shared view, feedback view)
  if (readOnly || !onCustomNoteChange) {
    return (
      <div className={`mt-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 ${className}`}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
            Note pour l'athlète
          </span>
        </div>
        <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">
          {displayedNote}
        </pre>
      </div>
    );
  }

  const handleRegenerate = () => {
    onCustomNoteChange("");
    setIsEditing(false);
  };

  return (
    <div className={`mt-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 ${className}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
            Note pour l'athlète
          </span>
          {isCustomized && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 font-medium">
              Personnalisée
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isCustomized && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRegenerate}
                    className="h-6 px-2 text-[10px] gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-500/10"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Régénérer
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">Remplacer par la note automatique</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {isEditing ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(false)}
              className="h-6 px-2 text-[10px] gap-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-500/10"
            >
              <Check className="h-3 w-3" />
              Enregistrer
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-6 px-2 text-[10px] gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-500/10"
            >
              <Pencil className="h-3 w-3" />
              Modifier
            </Button>
          )}
        </div>
      </div>
      {isEditing ? (
        <AutoTextarea
          value={displayedNote}
          onChange={(e) => onCustomNoteChange(e.target.value)}
          minRows={3}
          maxRows={12}
          className="text-xs bg-background/50 font-sans leading-relaxed"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        />
      ) : (
        <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">
          {displayedNote}
        </pre>
      )}
    </div>
  );
};

export default AthleteNoteDisplay;
