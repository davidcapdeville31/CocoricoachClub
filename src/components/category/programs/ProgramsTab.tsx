import { Tabs, TabsContent } from "@/components/ui/tabs";
import { FolderOpen, ShieldCheck, HeartPulse } from "lucide-react";
import { TrainingProgramsList } from "./TrainingProgramsList";
import { ProphylaxisTab } from "./ProphylaxisTab";
import { RehabProgramsList } from "./RehabProgramsList";
import { ColoredSubTabsList, ColoredSubTabsTrigger } from "@/components/ui/colored-subtabs";

interface ProgramsTabProps {
  categoryId: string;
}

export function ProgramsTab({ categoryId }: ProgramsTabProps) {
  return (
    <Tabs defaultValue="training" className="space-y-4">
      <div className="flex justify-center overflow-x-auto -mx-4 px-4 pb-2">
        <ColoredSubTabsList colorKey="programmation" className="inline-flex w-max">
          <ColoredSubTabsTrigger
            value="training"
            colorKey="programmation"
            icon={<FolderOpen className="h-4 w-4" />}
          >
            <span className="hidden sm:inline">Programmes d'entraînement</span>
            <span className="sm:hidden">Entraînement</span>
          </ColoredSubTabsTrigger>
          <ColoredSubTabsTrigger
            value="prophylaxis"
            colorKey="programmation"
            icon={<ShieldCheck className="h-4 w-4" />}
          >
            <span className="hidden sm:inline">Programme prophylaxie</span>
            <span className="sm:hidden">Prophylaxie</span>
          </ColoredSubTabsTrigger>
          <ColoredSubTabsTrigger
            value="rehab"
            colorKey="programmation"
            icon={<HeartPulse className="h-4 w-4" />}
          >
            <span className="hidden sm:inline">Programme de réhabilitation</span>
            <span className="sm:hidden">Réhabilitation</span>
          </ColoredSubTabsTrigger>
        </ColoredSubTabsList>
      </div>

      <TabsContent value="training">
        <TrainingProgramsList categoryId={categoryId} />
      </TabsContent>

      <TabsContent value="prophylaxis">
        <ProphylaxisTab categoryId={categoryId} />
      </TabsContent>

      <TabsContent value="rehab">
        <RehabProgramsList categoryId={categoryId} />
      </TabsContent>
    </Tabs>
  );
}
