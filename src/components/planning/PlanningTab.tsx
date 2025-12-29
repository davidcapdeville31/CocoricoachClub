import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SessionTemplatesSection } from "./SessionTemplatesSection";
import { WeeklyPlanningCalendar } from "./WeeklyPlanningCalendar";
import { LayoutTemplate, Calendar } from "lucide-react";

interface PlanningTabProps {
  categoryId: string;
}

export function PlanningTab({ categoryId }: PlanningTabProps) {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="weekly" className="space-y-4">
        <TabsList>
          <TabsTrigger value="weekly" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Planning hebdo
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weekly">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <WeeklyPlanningCalendar categoryId={categoryId} />
            </div>
            <div className="lg:col-span-1">
              <SessionTemplatesSection categoryId={categoryId} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <div className="max-w-2xl">
            <SessionTemplatesSection categoryId={categoryId} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
