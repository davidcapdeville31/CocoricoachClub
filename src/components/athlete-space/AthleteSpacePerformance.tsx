import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlaskConical, Weight, BarChart3, Target } from "lucide-react";
import { AthleteSpaceTests } from "./AthleteSpaceTests";
import { AthleteSpaceProgression } from "./AthleteSpaceProgression";
import { AthleteSpaceObjectives } from "./AthleteSpaceObjectives";
import { TonnageDashboard } from "@/components/tonnage/TonnageDashboard";

interface Props {
  playerId: string;
  categoryId: string;
  sportType?: string;
}

export function AthleteSpacePerformance({ playerId, categoryId, sportType }: Props) {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="tests" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 w-full">
          <TabsTrigger value="tests" className="text-xs sm:text-sm gap-1 flex-1">
            <FlaskConical className="h-3.5 w-3.5" />
            <span>Tests & Progression</span>
          </TabsTrigger>
          <TabsTrigger value="tonnage" className="text-xs sm:text-sm gap-1 flex-1">
            <Weight className="h-3.5 w-3.5" />
            <span>Tonnage</span>
          </TabsTrigger>
          <TabsTrigger value="objectives" className="text-xs sm:text-sm gap-1 flex-1">
            <Target className="h-3.5 w-3.5" />
            <span>Objectifs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tests" className="mt-4 space-y-6">
          <AthleteSpaceTests
            playerId={playerId}
            categoryId={categoryId}
            sportType={sportType}
          />
          <AthleteSpaceProgression
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
