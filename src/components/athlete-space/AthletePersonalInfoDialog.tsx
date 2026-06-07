import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlayerPersonalInfoSection } from "@/components/player/PlayerPersonalInfoSection";
import { AthleteIdentityEditor } from "@/components/player/AthleteIdentityEditor";
import { PlayerAdditionalInfoSection } from "@/components/player/PlayerAdditionalInfoSection";
import { PlayerCoachesSection } from "@/components/player/PlayerCoachesSection";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId: string;
  categoryId: string;
  sportType?: string;
  playerName: string;
}

export function AthletePersonalInfoDialog({
  open,
  onOpenChange,
  playerId,
  categoryId,
  sportType,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Informations personnelles</DialogTitle>
          <DialogDescription>
            Gère ta fiche personnelle, ton identité athlète et tes informations complémentaires.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PlayerPersonalInfoSection
              playerId={playerId}
              categoryId={categoryId}
              isViewer={false}
              sportType={sportType || "XV"}
            />
            <AthleteIdentityEditor playerId={playerId} sportType={sportType} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PlayerAdditionalInfoSection playerId={playerId} isViewer={false} />
            <PlayerCoachesSection playerId={playerId} categoryId={categoryId} isViewer />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
