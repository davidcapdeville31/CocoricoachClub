import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PeriodizationCalendar } from "./PeriodizationCalendar";
import { PeriodsSection } from "./PeriodsSection";
import { CyclesSection } from "./CyclesSection";

interface PeriodizationTabProps {
  categoryId: string;
}

export function PeriodizationTab({ categoryId }: PeriodizationTabProps) {
  return (
    <Card className="bg-gradient-card shadow-md">
      <CardHeader>
        <CardTitle>Gestion de la Périodisation</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="calendar" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calendar">Calendrier</TabsTrigger>
            <TabsTrigger value="periods">Périodes</TabsTrigger>
            <TabsTrigger value="cycles">Cycles</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar">
            <PeriodizationCalendar categoryId={categoryId} />
          </TabsContent>

          <TabsContent value="periods">
            <PeriodsSection categoryId={categoryId} />
          </TabsContent>

          <TabsContent value="cycles">
            <CyclesSection categoryId={categoryId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
