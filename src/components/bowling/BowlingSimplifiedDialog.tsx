import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus, Target, Wrench } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { SimplifiedTacticalBlockEditor } from "./simplified/SimplifiedTacticalBlockEditor";
import { SimplifiedTechnicalBlockEditor } from "./simplified/SimplifiedTechnicalBlockEditor";
import {
  newTacticalBlock,
  newTechnicalBlock,
  type SimplifiedBlock,
} from "./simplified/types";

interface BowlingSimplifiedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  categoryId: string;
  athletePlayerId?: string;
}

/**
 * Mode SIMPLIFIÉ de création de séance bowling.
 * Blocs disponibles : Tactique, Technique.
 * La persistance en base sera ajoutée dans un second temps.
 */
export function BowlingSimplifiedDialog({
  open,
  onOpenChange,
  date,
  categoryId,
}: BowlingSimplifiedDialogProps) {
  const [blocks, setBlocks] = useState<SimplifiedBlock[]>([]);

  const addTactical = () =>
    setBlocks((prev) => [...prev, newTacticalBlock()]);

  const addTechnical = () =>
    setBlocks((prev) => [...prev, newTechnicalBlock()]);

  const updateBlock = (id: string, next: SimplifiedBlock) =>
    setBlocks((prev) => prev.map((b) => (b.id === id ? next : b)));

  const removeBlock = (id: string) =>
    setBlocks((prev) => prev.filter((b) => b.id !== id));

  const handleSave = () => {
    if (blocks.length === 0) {
      toast.error("Ajoutez au moins un bloc avant d'enregistrer");
      return;
    }
    toast.info("Enregistrement bientôt disponible — la séance n'est pas encore persistée.");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setBlocks([]);
    onOpenChange(next);
  };

  // Indices typés par bloc pour conserver la numérotation par catégorie
  const tacticalIndexById = new Map<string, number>();
  const technicalIndexById = new Map<string, number>();
  let tCount = 0;
  let techCount = 0;
  blocks.forEach((b) => {
    if (b.type === "tactical") tacticalIndexById.set(b.id, tCount++);
    if (b.type === "technical") technicalIndexById.set(b.id, techCount++);
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl border-border/70 bg-background/95 shadow-2xl backdrop-blur-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Nouvelle séance bowling — Mode simplifié
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {format(date, "EEEE d MMMM yyyy", { locale: fr })}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {blocks.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 py-10 text-center">
              <div className="rounded-full bg-muted p-4">
                <Sparkles className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                Construisez votre séance
              </h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Ajoutez un bloc pour commencer.
              </p>
            </div>
          )}

          {blocks.map((b) => {
            if (b.type === "tactical") {
              return (
                <SimplifiedTacticalBlockEditor
                  key={b.id}
                  value={b}
                  index={tacticalIndexById.get(b.id) ?? 0}
                  categoryId={categoryId}
                  onChange={(next) => updateBlock(b.id, next)}
                  onRemove={() => removeBlock(b.id)}
                />
              );
            }
            return (
              <SimplifiedTechnicalBlockEditor
                key={b.id}
                value={b}
                index={technicalIndexById.get(b.id) ?? 0}
                onChange={(next) => updateBlock(b.id, next)}
                onRemove={() => removeBlock(b.id)}
              />
            );
          })}

          {/* Add block buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addTactical}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              <Target className="h-3.5 w-3.5 text-blue-500" />
              Ajouter un bloc Tactique
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addTechnical}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              <Wrench className="h-3.5 w-3.5 text-emerald-600" />
              Ajouter un bloc Technique
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              className="gap-2 opacity-60"
            >
              <Plus className="h-4 w-4" />
              Parties (à venir)
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={blocks.length === 0}>
            Enregistrer la séance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
