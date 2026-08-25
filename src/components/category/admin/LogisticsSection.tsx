import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ColoredSubTabsList, ColoredSubTabsTrigger } from "@/components/ui/colored-subtabs";
import { Building2, Package, Bus } from "lucide-react";
import { FacilitiesSection } from "./logistics/FacilitiesSection";
import { EquipmentSection } from "./logistics/EquipmentSection";
import { TripsSection } from "./logistics/TripsSection";

interface LogisticsSectionProps {
  categoryId: string;
}

export function LogisticsSection({ categoryId }: LogisticsSectionProps) {
  const { t } = useTranslation();
  return (
    <Tabs defaultValue="facilities" className="space-y-4">
      <ColoredSubTabsList colorKey="admin" className="justify-start">
        <ColoredSubTabsTrigger value="facilities" colorKey="admin" icon={<Building2 className="h-4 w-4" />}>
          {t("adminRecruitDocs.logistics.tabs.facilities")}
        </ColoredSubTabsTrigger>
        <ColoredSubTabsTrigger value="equipment" colorKey="admin" icon={<Package className="h-4 w-4" />}>
          {t("adminRecruitDocs.logistics.tabs.equipment")}
        </ColoredSubTabsTrigger>
        <ColoredSubTabsTrigger value="trips" colorKey="admin" icon={<Bus className="h-4 w-4" />}>
          {t("adminRecruitDocs.logistics.tabs.trips")}
        </ColoredSubTabsTrigger>
      </ColoredSubTabsList>

      <TabsContent value="facilities">
        <FacilitiesSection categoryId={categoryId} />
      </TabsContent>

      <TabsContent value="equipment">
        <EquipmentSection categoryId={categoryId} />
      </TabsContent>

      <TabsContent value="trips">
        <TripsSection categoryId={categoryId} />
      </TabsContent>
    </Tabs>
  );
}
