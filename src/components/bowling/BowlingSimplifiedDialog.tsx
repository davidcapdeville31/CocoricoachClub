import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface BowlingSimplifiedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  categoryId: string;
  athletePlayerId?: string;
}

/**
 * Mode SIMPLIFIÉ de création de séance bowling.
 * Pour l'instant vide — le contenu sera défini ultérieurement.
 */
export function BowlingSimplifiedDialog({
  open,
  onOpenChange,
  date,
}: BowlingSimplifiedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border/70 bg-background/95 shadow-2xl backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Nouvelle séance bowling — Mode simplifié
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {format(date, "EEEE d MMMM yyyy", { locale: fr })}
          </p>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <div className="rounded-full bg-muted p-4">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            Bientôt disponible
          </h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Le mode simplifié sera bientôt configuré. En attendant, utilisez le
            mode avancé pour créer une séance bowling complète.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
