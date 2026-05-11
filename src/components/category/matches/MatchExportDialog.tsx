import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlayerCumulativeStats } from "./PlayerCumulativeStats";

interface MatchExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  sportType: string;
  matchIds: string[];
  /** Free-text title — e.g. "vs Espagne", "Jeux Olympiques (3 matchs)", "Sélection (5 matchs)" */
  title: string;
  /** Optional short context (date, lieu, scope) shown under the title. */
  subtitle?: string;
}

/**
 * Generic export dialog that reuses the canonical PlayerCumulativeStats UI
 * with a locked match selection. Works for all team sports + Judo + Athletics
 * (PlayerCumulativeStats already merges player_match_stats and competition_rounds
 * for individual sports). PDF + Excel export buttons are provided by that component.
 */
export function MatchExportDialog({
  open,
  onOpenChange,
  categoryId,
  sportType,
  matchIds,
  title,
  subtitle,
}: MatchExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] p-0 flex flex-col">
        <DialogHeader className="p-6 pb-3 border-b">
          <DialogTitle>Export — {title}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
          <DialogDescription className="text-xs">
            Utilise les boutons <strong>Excel</strong> ou <strong>PDF</strong> en haut à droite pour télécharger
            les statistiques de cette {matchIds.length > 1 ? "sélection" : "rencontre"}.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1">
          <div className="p-4">
            {matchIds.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune rencontre sélectionnée.
              </p>
            ) : (
              <PlayerCumulativeStats
                categoryId={categoryId}
                sportType={sportType}
                showTeamView={true}
                initialMatchIds={matchIds}
                lockMatchSelection={true}
              />
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
