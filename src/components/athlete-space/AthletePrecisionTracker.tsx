import { PrecisionFieldTracker } from "@/components/rugby/PrecisionFieldTracker";

interface Props {
  categoryId: string;
  playerId: string;
}

/**
 * Wrapper de l'interface staff de précision (jeu au pied), verrouillée sur
 * l'athlète connecté. L'athlète ne peut saisir que pour lui-même.
 */
export function AthletePrecisionTracker({ categoryId, playerId }: Props) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-primary/5 p-3 text-xs text-muted-foreground">
        🦶 Saisissez vos séances individuelles de jeu au pied. Les données
        alimentent votre base personnelle de précision et sont uniquement les vôtres.
      </div>
      <PrecisionFieldTracker
        categoryId={categoryId}
        lockedPlayerId={playerId}
      />
    </div>
  );
}
