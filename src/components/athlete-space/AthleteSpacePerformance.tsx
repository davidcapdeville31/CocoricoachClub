import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlaskConical, Weight, BarChart3, Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AthleteSpaceTests } from "./AthleteSpaceTests";
import { AthleteSpaceProgression } from "./AthleteSpaceProgression";
import { AthleteSpaceObjectives } from "./AthleteSpaceObjectives";
import { TonnageDashboard } from "@/components/tonnage/TonnageDashboard";
import { NAV_COLORS } from "@/components/ui/colored-nav-tabs";

interface Props {
  playerId: string;
  categoryId: string;
  sportType?: string;
}

export function AthleteSpacePerformance({ playerId, categoryId, sportType }: Props) {
  const { t } = useTranslation();
  const accent = NAV_COLORS.performance.base;
  const triggerStyle = {
    ["--tab-accent" as any]: accent,
  } as React.CSSProperties;
  const triggerClass =
    "text-xs sm:text-sm gap-1 flex-1 rounded-lg transition-colors " +
    "data-[state=active]:bg-[var(--tab-accent)] data-[state=active]:text-white " +
    "data-[state=active]:shadow-md";

  return (
    <div className="space-y-4">
      <Tabs defaultValue="tests" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 w-full bg-muted/40 rounded-xl p-1">
          <TabsTrigger value="tests" style={triggerStyle} className={triggerClass}>
            <FlaskConical className="h-3.5 w-3.5" />
            <span>{t("athleteSpace:performance.testsAndProgression")}</span>
          </TabsTrigger>
          <TabsTrigger value="tonnage" style={triggerStyle} className={triggerClass}>
            <Weight className="h-3.5 w-3.5" />
            <span>{t("athleteSpace:performance.tonnage")}</span>
          </TabsTrigger>
          <TabsTrigger value="objectives" style={triggerStyle} className={triggerClass}>
            <Target className="h-3.5 w-3.5" />
            <span>{t("athleteSpace:performance.objectives")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tests" className="mt-4 space-y-6">
          {/* Ordre demandé : Derniers résultats → Comparatif tests → Historique complet */}
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
