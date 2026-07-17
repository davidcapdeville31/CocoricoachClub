import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ColoredSubTabsList, ColoredSubTabsTrigger } from "@/components/ui/colored-subtabs";
import { TonnageDashboard } from "./TonnageDashboard";
import { PendingWeightLogsValidation } from "./PendingWeightLogsValidation";
import { PendingTestResultsValidation } from "@/components/category/tests/PendingTestResultsValidation";

import { BenchmarkPositionMatrix } from "./BenchmarkPositionMatrix";
import { Weight, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePendingWeightLogsCount } from "@/lib/hooks/usePendingWeightLogsCount";
import { usePendingTestResultsCount } from "@/lib/hooks/usePendingTestResultsCount";

interface EvolutionTestsMuscuTabProps {
  categoryId: string;
}

export function EvolutionTestsMuscuTab({ categoryId }: EvolutionTestsMuscuTabProps) {
  const { data: category } = useQuery({
    queryKey: ["category-sport-evolution", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("rugby_type")
        .eq("id", categoryId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const sportType = category?.rugby_type || "XV";
  const pendingCount = usePendingWeightLogsCount(categoryId);
  const pendingTestsCount = usePendingTestResultsCount(categoryId);

  return (
    <Card className="bg-gradient-card shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Évolution Tests / Muscu
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="tonnage" className="space-y-4">
          <ColoredSubTabsList colorKey="performance">
            <ColoredSubTabsTrigger colorKey="performance" value="tonnage" icon={<Weight className="h-3.5 w-3.5" />}>
              Tonnage Muscu
              {pendingCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                  {pendingCount}
                </span>
              )}
            </ColoredSubTabsTrigger>
            <ColoredSubTabsTrigger colorKey="performance" value="evolution" icon={<TrendingUp className="h-3.5 w-3.5" />}>
              Comparaison & Évolution
              {pendingTestsCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                  {pendingTestsCount}
                </span>
              )}
            </ColoredSubTabsTrigger>
          </ColoredSubTabsList>

          <TabsContent value="tonnage" className="space-y-4">
            <PendingWeightLogsValidation categoryId={categoryId} />
            <TonnageDashboard categoryId={categoryId} />
          </TabsContent>

          <TabsContent value="evolution" className="space-y-4">
            <PendingTestResultsValidation categoryId={categoryId} />
            <BenchmarkPositionMatrix categoryId={categoryId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
