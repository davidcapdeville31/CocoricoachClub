import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AvailabilityScoreTab } from "./AvailabilityScoreTab";
import { InjuryRiskPrediction } from "@/components/analytics/InjuryRiskPrediction";
import { Activity } from "lucide-react";

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
            Disponibilité
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <AvailabilityScoreTab categoryId={categoryId} />
          <InjuryRiskPrediction categoryId={categoryId} />
        </CardContent>
      </Card>
    </div>
  );
}
