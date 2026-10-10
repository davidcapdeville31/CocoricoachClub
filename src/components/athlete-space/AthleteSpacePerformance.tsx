import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlaskConical, Weight, BarChart3, Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AthleteSpaceTests } from "./AthleteSpaceTests";
import { AthleteSpaceProgression } from "./AthleteSpaceProgression";
import { AthleteSpaceObjectives } from "./AthleteSpaceObjectives";
import { TonnageDashboard } from "@/components/tonnage/TonnageDashboard";
import { PlayerMedalsSection } from "@/components/player/PlayerMedalsSection";

interface Props {
  playerId: string;
  categoryId: string;
  sportType?: string;
}

export function AthleteSpacePerformance({ playerId, categoryId, sportType }: Props) {
  const { t } = useTranslation();
  const triggerClass =
    "text-xs sm:text-sm gap-1 flex-1 min-w-0 whitespace-normal min-h-11 rounded-lg transition-colors " +
    "data-[state=active]:bg-accent/10 data-[state=active]:text-accent " +
    "data-[state=active]:shadow-md";

  return (
    <div className="space-y-4">
      <Tabs defaultValue="tests" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 w-full bg-muted/40 rounded-xl p-1">
          <TabsTrigger value="tests" className={triggerClass}>
            <FlaskConical className="h-3.5 w-3.5" />
            <span>{t("athleteSpace.performance.testsAndProgression")}</span>
          </TabsTrigger>
          <TabsTrigger value="tonnage" className={triggerClass}>
            <Weight className="h-3.5 w-3.5" />
            <span>{t("athleteSpace.performance.tonnage")}</span>
          </TabsTrigger>
          <TabsTrigger value="objectives" className={triggerClass}>
            <Target className="h-3.5 w-3.5" />
            <span>{t("athleteSpace.performance.objectives")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tests" className="mt-4 space-y-6">
          {/* Ordre demandé : Derniers résultats → Comparatif tests → Historique complet → Palmarès */}
          <AthleteSpaceProgression
            playerId={playerId}
            categoryId={categoryId}
            sportType={sportType}
          />
          <AthleteSpaceTests
            playerId={playerId}
            categoryId={categoryId}
            sportType={sportType}
          />
          <PlayerMedalsSection playerId={playerId} />
        </TabsContent>

        <TabsContent value="tonnage" className="mt-4">
          <TonnageDashboard
            categoryId={categoryId}
            playerId={playerId}
          />
        </TabsContent>

        <TabsContent value="objectives" className="mt-4">
          <AthleteSpaceObjectives
            playerId={playerId}
            categoryId={categoryId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
