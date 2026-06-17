import { AlertCircle, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PresenceUser } from "@/hooks/useCompetitionRoundsPresence";

interface Props {
  open: boolean;
  others: PresenceUser[];
  onClose: () => void;
}

/**
 * Shows a non-modal overlay inside the parent Dialog when other coaches are
 * editing the same competition. We intentionally avoid nesting an AlertDialog
 * inside the parent Dialog — that triggers a known Radix bug where
 * `pointer-events: none` stays stuck on <body> after the inner modal closes,
 * freezing every click in the parent dialog.
 */
export function CompetitionRoundsPresenceBanner({ open, others, onClose }: Props) {
  const [acknowledged, setAcknowledged] = useState(false);

  // Reset acknowledgement each time the dialog closes
  useEffect(() => {
    if (!open) setAcknowledged(false);
  }, [open]);

  const showBlockingOverlay = open && others.length > 0 && !acknowledged;

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

      {showBlockingOverlay && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-sm rounded-lg p-4"
          role="alertdialog"
          aria-modal="false"
        >
          <div className="max-w-md w-full rounded-xl border bg-card shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold text-base">
                Compétition déjà en cours d'édition
              </h3>
            </div>
            <div className="text-sm text-muted-foreground space-y-2">
              {others.length === 1 ? (
                <p>
                  <strong className="text-foreground">{others[0].name}</strong>{" "}
                  est en train de saisir les statistiques de cette compétition.
                </p>
              ) : (
                <div>
                  <p>Les utilisateurs suivants sont en train de saisir&nbsp;:</p>
                  <ul className="list-disc list-inside mt-1">
                    {others.map((u) => (
                      <li key={u.user_id}>
                        <strong className="text-foreground">{u.name}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs">
                Pour éviter tout conflit ou perte de données, il est recommandé d'attendre qu'ils aient terminé.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Fermer
              </Button>
              <Button
                size="sm"
                onClick={() => setAcknowledged(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Continuer quand même
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
