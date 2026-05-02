import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ColoredSubTabsList, ColoredSubTabsTrigger } from "@/components/ui/colored-subtabs";
import { Smile, Heart } from "lucide-react";
import { WellnessTab } from "./WellnessTab";
import { MedicalRecordsTab } from "@/components/health/MedicalRecordsTab";

interface WellnessWithHealthTabProps {
  categoryId: string;
}

export function WellnessWithHealthTab({ categoryId }: WellnessWithHealthTabProps) {
  return (
    <Tabs defaultValue="wellness" className="space-y-4">
      <div className="flex justify-center overflow-x-auto -mx-4 px-4 pb-2">
        <ColoredSubTabsList colorKey="sante" className="inline-flex w-max">
          <ColoredSubTabsTrigger
            value="wellness"
            colorKey="sante"
            icon={<Smile className="h-4 w-4" />}
            tooltip="Questionnaire de bien-être quotidien : sommeil, fatigue, stress, courbatures et score de récupération"
          >
            Wellness
          </ColoredSubTabsTrigger>
          <ColoredSubTabsTrigger
            value="health"
            colorKey="sante"
            icon={<Heart className="h-4 w-4" />}
            tooltip="Dossiers médicaux et historique de santé des athlètes"
          >
            Santé
          </ColoredSubTabsTrigger>
        </ColoredSubTabsList>
      </div>

      <TabsContent value="wellness">
        <WellnessTab categoryId={categoryId} />
      </TabsContent>

      <TabsContent value="health">
        <MedicalRecordsTab categoryId={categoryId} />
      </TabsContent>
    </Tabs>
  );
}
