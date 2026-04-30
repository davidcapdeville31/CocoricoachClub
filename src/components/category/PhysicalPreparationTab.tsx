import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvailabilityScoreTab } from "./AvailabilityScoreTab";
import { InjuryRiskPrediction } from "@/components/analytics/InjuryRiskPrediction";
import { Activity, AlertTriangle } from "lucide-react";

interface PhysicalPreparationTabProps {
  categoryId: string;
}

export function PhysicalPreparationTab({ categoryId }: PhysicalPreparationTabProps) {
  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Préparation Physique
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="disponibilite" className="space-y-4">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="disponibilite" className="text-xs sm:text-sm">
                <Activity className="h-3.5 w-3.5 mr-1" />
                Disponibilité
              </TabsTrigger>
              <TabsTrigger value="risques" className="text-xs sm:text-sm">
                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                Risques & Alertes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="disponibilite">
              <AvailabilityScoreTab categoryId={categoryId} />
            </TabsContent>

            <TabsContent value="risques">
              <InjuryRiskPrediction categoryId={categoryId} />
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
