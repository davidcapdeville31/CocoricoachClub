import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface InjuryAlertsProps {
  categoryIds: string[];
}

export function InjuryAlerts({ categoryIds }: InjuryAlertsProps) {
  const { data: alerts, isLoading } = useQuery({
    queryKey: ["injury-alerts", categoryIds],
    queryFn: async () => {
      if (categoryIds.length === 0) return [];

      const [injuriesRes, awcrRes] = await Promise.all([
        supabase
          .from("injuries")
          .select(`
            id,
            injury_type,
            injury_date,
            severity,
            status,
            player_id,
            players!inner(name)
          `)
          .in("category_id", categoryIds)
          .eq("status", "active")
          .order("injury_date", { ascending: false })
          .limit(5),
        supabase
          .from("awcr_tracking")
          .select(`
            awcr,
            session_date,
            player_id,
            players!inner(name)
          `)
          .in("category_id", categoryIds)
          .not("awcr", "is", null)
          .order("session_date", { ascending: false })
          .limit(50),
      ]);

      const injuries = injuriesRes.data || [];
      const awcrData = awcrRes.data || [];

      const highRiskPlayers = awcrData
        .filter((row) => {
          const awcr = Number(row.awcr);
          return awcr > 1.5 || awcr < 0.7;
        })
        .slice(0, 3)
        .map((row) => ({
          type: "awcr_risk" as const,
          player: row.players.name,
          value: Number(row.awcr).toFixed(2),
          date: row.session_date,
        }));

      return [
        ...injuries.map((injury) => ({
          type: "injury" as const,
          player: injury.players.name,
          injury: injury.injury_type,
          severity: injury.severity,
          date: injury.injury_date,
        })),
        ...highRiskPlayers,
      ];
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
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-card shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Alertes et Recommandations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts && alerts.length > 0 ? (
          <div className="space-y-4">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className="flex items-start justify-between p-3 rounded-lg border border-border bg-card"
              >
                <div className="space-y-1">
                  {alert.type === "injury" ? (
                    <>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        <p className="font-medium">{alert.player}</p>
                        <Badge
                          variant={
                            alert.severity === "grave"
                              ? "destructive"
                              : alert.severity === "modérée"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Blessure: {alert.injury}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(alert.date), "dd MMMM yyyy", { locale: fr })}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-red-500" />
                        <p className="font-medium">{alert.player}</p>
                        <Badge variant="destructive">AWCR: {alert.value}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Risque de blessure élevé - Réduire la charge
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(alert.date), "dd MMMM yyyy", { locale: fr })}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            Aucune alerte pour le moment
          </p>
        )}
      </CardContent>
    </Card>
  );
}
