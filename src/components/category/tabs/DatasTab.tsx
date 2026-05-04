import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Trophy, Target } from "lucide-react";
import { ColoredSubTabsList, ColoredSubTabsTrigger } from "@/components/ui/colored-subtabs";
import { PlayerCumulativeStats } from "@/components/category/matches/PlayerCumulativeStats";
import { BowlingCumulativeStats } from "@/components/bowling/BowlingCumulativeStats";
import { BowlingTrainingStats } from "@/components/bowling/BowlingTrainingStats";
import { TennisTrainingStats } from "@/components/tennis/TennisTrainingStats";
import { PrecisionTrainingStats } from "@/components/training/PrecisionTrainingStats";
import { PrecisionFieldTracker } from "@/components/rugby/PrecisionFieldTracker";
import { AthleticsThrowingStats } from "@/components/athletics/AthleticsThrowingStats";
import { AthleticsSprintStats } from "@/components/athletics/AthleticsSprintStats";
import { isRugbyType, isAthletismeCategory } from "@/lib/constants/sportTypes";

interface DatasTabProps {
  categoryId: string;
  sportType?: string;
}

export function DatasTab({ categoryId, sportType }: DatasTabProps) {
  const isBowling = (sportType || "").toLowerCase().includes("bowling");
  const isTennis = (sportType || "").toLowerCase().includes("tennis");
  const isRugby = isRugbyType(sportType || "");
  const isAthletics = isAthletismeCategory(sportType || "");

  return (
    <Tabs defaultValue="competition" className="space-y-4">
      <div className="flex justify-center overflow-x-auto -mx-4 px-4 pb-2">
        <ColoredSubTabsList colorKey="competition" className="inline-flex w-max">
          <ColoredSubTabsTrigger
            value="competition"
            colorKey="competition"
            icon={<Trophy className="h-4 w-4" />}
            tooltip="Statistiques cumulées issues des compétitions"
          >
            <span className="hidden sm:inline">Datas de compétition</span>
            <span className="sm:hidden">Compét.</span>
          </ColoredSubTabsTrigger>
          <ColoredSubTabsTrigger
            value="training"
            colorKey="competition"
            icon={<Target className="h-4 w-4" />}
            tooltip="Statistiques détaillées des entraînements : précision, drills et exercices spécifiques au sport"
          >
            <span className="hidden sm:inline">Datas d'entraînement</span>
            <span className="sm:hidden">Entr.</span>
          </ColoredSubTabsTrigger>
        </ColoredSubTabsList>
      </div>

      <TabsContent value="competition">
        {isBowling ? (
          <BowlingCumulativeStats categoryId={categoryId} />
        ) : (
          <PlayerCumulativeStats categoryId={categoryId} sportType={sportType} />
        )}
      </TabsContent>

      <TabsContent value="training">
        {isBowling ? (
          <BowlingTrainingStats categoryId={categoryId} />
        ) : isTennis ? (
          <TennisTrainingStats categoryId={categoryId} />
        ) : isAthletics ? (
          <div className="space-y-6">
            <AthleticsSprintStats categoryId={categoryId} />
            <AthleticsThrowingStats categoryId={categoryId} />
          </div>
        ) : isRugby ? (
          // PrecisionFieldTracker affiche désormais : cartographie + stats du jour
          // (vierge chaque jour) + panneau de statistiques cumulées (filtres thème
          // & période) — même expérience que côté espace athlète.
          <PrecisionFieldTracker categoryId={categoryId} />
        ) : (
          <PrecisionTrainingStats categoryId={categoryId} />
        )}
      </TabsContent>
    </Tabs>
  );
}
