import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus, Target, Wrench, Save, Circle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { SimplifiedTacticalBlockEditor } from "./simplified/SimplifiedTacticalBlockEditor";
import { SimplifiedTechnicalBlockEditor } from "./simplified/SimplifiedTechnicalBlockEditor";
import { SimplifiedGamesBlockEditor } from "./simplified/SimplifiedGamesBlockEditor";
import { LockedBlockSummary } from "./simplified/LockedBlockSummary";
import {
  newTacticalBlock,
  newTechnicalBlock,
  newGamesBlock,
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
  athletePlayerId,
}: BowlingSimplifiedDialogProps) {
  const [blocks, setBlocks] = useState<SimplifiedBlock[]>([]);
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());

  const addTactical = () => {
    const b = newTacticalBlock();
    setBlocks((prev) => [...prev, b]);
  };

  const addTechnical = () => {
    const b = newTechnicalBlock();
    setBlocks((prev) => [...prev, b]);
  };

  const addGames = () => {
    const b = newGamesBlock();
    setBlocks((prev) => [...prev, b]);
  };

  const updateBlock = (id: string, next: SimplifiedBlock) =>
    setBlocks((prev) => prev.map((b) => (b.id === id ? next : b)));

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setLockedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const validateBlock = (b: SimplifiedBlock): string | null => {
    if (b.type === "tactical" || b.type === "technical") {
      if (b.duration_min <= 0) return "La durée doit être supérieure à 0";
    }
    if (b.type === "technical") {
      if (b.theme === "other" && !b.custom_theme?.trim())
        return "Précisez la thématique";
      if (!b.description.trim())
        return "Décrivez ce que vous avez travaillé";
    }
    if (b.type === "games") {
      const saved = b.parties.filter((p) => p.stats !== null).length;
      if (saved === 0)
        return "Enregistrez au moins une partie avant de verrouiller le bloc";
    }
    return null;
  };

  const lockBlock = (id: string) => {
    const b = blocks.find((x) => x.id === id);
    if (!b) return;
    const err = validateBlock(b);
    if (err) {
      toast.error(err);
      return;
    }
    setLockedIds((prev) => new Set(prev).add(id));
    toast.success("Bloc enregistré");
  };

  const unlockBlock = (id: string) =>
    setLockedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const handleSave = () => {
    if (blocks.length === 0) {
      toast.error("Ajoutez au moins un bloc avant d'enregistrer");
      return;
    }
    const unlocked = blocks.filter((b) => !lockedIds.has(b.id));
    if (unlocked.length > 0) {
      toast.error("Enregistrez d'abord chaque bloc avant de valider la séance");
      return;
    }
    toast.info("Enregistrement bientôt disponible — la séance n'est pas encore persistée.");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setBlocks([]);
      setLockedIds(new Set());
    }
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

          {blocks.map((b, posIdx) => {
            const locked = lockedIds.has(b.id);
            if (locked) {
              return (
                <LockedBlockSummary
                  key={b.id}
                  block={b}
                  index={posIdx}
                  categoryId={categoryId}
                  playerId={athletePlayerId}
                  onEdit={() => unlockBlock(b.id)}
                  onRemove={() => removeBlock(b.id)}
                />
              );
            }

            const editor =
              b.type === "tactical" ? (
                <SimplifiedTacticalBlockEditor
                  value={b}
                  index={tacticalIndexById.get(b.id) ?? 0}
                  categoryId={categoryId}
                  playerId={athletePlayerId}
                  onChange={(next) => updateBlock(b.id, next)}
                  onRemove={() => removeBlock(b.id)}
                />
              ) : (
                <SimplifiedTechnicalBlockEditor
                  value={b}
                  index={technicalIndexById.get(b.id) ?? 0}
                  categoryId={categoryId}
                  playerId={athletePlayerId}
                  onChange={(next) => updateBlock(b.id, next)}
                  onRemove={() => removeBlock(b.id)}
                />
              );

            return (
              <div key={b.id} className="space-y-2">
                {editor}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => lockBlock(b.id)}
                    className="gap-2"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Enregistrer le bloc
                  </Button>
                </div>
              </div>
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
