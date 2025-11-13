import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PerformanceChartProps {
  categoryIds: string[];
}

export function PerformanceChart({ categoryIds }: PerformanceChartProps) {
  const { data: chartData, isLoading } = useQuery({
    queryKey: ["performance-chart", categoryIds],
    queryFn: async () => {
      if (categoryIds.length === 0) return [];

      const { data, error } = await supabase
        .from("awcr_tracking")
        .select("session_date, training_load, awcr")
        .in("category_id", categoryIds)
        .not("awcr", "is", null)
        .order("session_date", { ascending: true })
        .limit(30);

      if (error) throw error;

      const grouped = data.reduce((acc, row) => {
        const date = row.session_date;
        if (!acc[date]) {
          acc[date] = { date, loads: [], awcrs: [] };
        }
        if (row.training_load) acc[date].loads.push(row.training_load);
        if (row.awcr) acc[date].awcrs.push(Number(row.awcr));
        return acc;
      }, {} as Record<string, { date: string; loads: number[]; awcrs: number[] }>);

      return Object.values(grouped).map((item) => ({
        date: format(new Date(item.date), "dd MMM", { locale: fr }),
        charge: item.loads.length > 0
          ? Math.round(item.loads.reduce((sum, l) => sum + l, 0) / item.loads.length)
          : 0,
        awcr: item.awcrs.length > 0
          ? Number((item.awcrs.reduce((sum, a) => sum + a, 0) / item.awcrs.length).toFixed(2))
          : 0,
      }));
    },
    enabled: categoryIds.length > 0,
  });

  if (isLoading) {
    return (
      <Card className="bg-gradient-card shadow-md">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-card shadow-md">
      <CardHeader>
        <CardTitle>Évolution des Performances</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis yAxisId="left" className="text-xs" />
              <YAxis yAxisId="right" orientation="right" className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="charge"
                stroke="hsl(var(--primary))"
                name="Charge Moyenne"
                strokeWidth={2}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="awcr"
                stroke="hsl(var(--accent))"
                name="AWCR Moyen"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            Aucune donnée disponible pour les 30 dernières entrées
          </p>
        )}
      </CardContent>
    </Card>
  );
}
