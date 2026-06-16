import { AlertCircle, Users } from "lucide-react";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { PresenceUser } from "@/hooks/useCompetitionRoundsPresence";

interface Props {
  open: boolean;
  others: PresenceUser[];
  onClose: () => void;
}

/**
 * Shows a banner inside the dialog when other coaches are editing
 * the same competition, and a blocking confirmation when the dialog
 * opens with other people already there.
 */
export function CompetitionRoundsPresenceBanner({ open, others, onClose }: Props) {
  const [acknowledged, setAcknowledged] = useState(false);

  // Reset acknowledgement each time the dialog closes
  useEffect(() => {
    if (!open) setAcknowledged(false);
  }, [open]);

  const showBlockingDialog = open && others.length > 0 && !acknowledged;

  return (
    <>
      {open && others.length > 0 && acknowledged && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          <Users className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="leading-tight">
            <strong>Édition en cours par&nbsp;:</strong>{" "}
            {others.map((u) => u.name).join(", ")}
            <div className="text-xs opacity-80 mt-0.5">
              Évitez de saisir les mêmes parties en même temps pour ne pas écraser leur travail.
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={showBlockingDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Compétition déjà en cours d'édition
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {others.length === 1 ? (
                  <><strong>{others[0].name}</strong> est en train de saisir les statistiques de cette compétition.</>
                ) : (
                  <>
                    Les utilisateurs suivants sont en train de saisir les statistiques de cette compétition&nbsp;:
                    <ul className="list-disc list-inside mt-1">
                      {others.map((u) => (
                        <li key={u.user_id}><strong>{u.name}</strong></li>
                      ))}
                    </ul>
                  </>
                )}
              </span>
              <span className="block text-sm">
                Pour éviter tout conflit ou perte de données, il est recommandé d'attendre qu'ils aient terminé avant d'ouvrir cette compétition.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onClose}>Fermer</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => setAcknowledged(true)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Continuer quand même
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
