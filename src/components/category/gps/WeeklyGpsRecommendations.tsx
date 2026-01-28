import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Activity, 
  Zap, 
  Navigation,
  AlertTriangle,
  CheckCircle,
  Target
} from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek } from "date-fns";
import { fr } from "date-fns/locale";

interface WeeklyGpsRecommendationsProps {
  categoryId: string;
  playerId?: string;
}

interface GpsMetrics {
  totalDistance: number;
  hiDistance: number; // High Intensity >18 km/h
  thiDistance: number; // Very High Intensity >21 km/h
  sprintDistance: number; // >24 km/h
  playerLoad: number;
  maxSpeed: number;
  sessionCount: number;
}

interface WeeklyData {
  current: GpsMetrics;
  previous: GpsMetrics;
  averageReference: GpsMetrics | null;
}

function calculatePercentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function getLoadStatus(currentLoad: number, referenceLoad: number | null): {
  status: "optimal" | "low" | "high" | "very_high";
  icon: React.ReactNode;
  color: string;
  message: string;
} {
  if (!referenceLoad || referenceLoad === 0) {
    return {
      status: "optimal",
      icon: <Minus className="h-4 w-4" />,
      color: "text-muted-foreground",
      message: "Référence non disponible"
    };
  }

  const ratio = currentLoad / referenceLoad;

  if (ratio < 0.8) {
    return {
      status: "low",
      icon: <TrendingDown className="h-4 w-4" />,
      color: "text-amber-500",
      message: "Charge inférieure à la normale - risque de désentraînement"
    };
  }
  if (ratio <= 1.1) {
    return {
      status: "optimal",
      icon: <CheckCircle className="h-4 w-4" />,
      color: "text-primary",
      message: "Charge optimale"
    };
  }
  if (ratio <= 1.3) {
    return {
      status: "high",
      icon: <TrendingUp className="h-4 w-4" />,
      color: "text-amber-500",
      message: "Charge élevée - surveiller la récupération"
    };
  }
  return {
    status: "very_high",
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-destructive",
    message: "Surcharge détectée - réduire l'intensité"
  };
}

export function WeeklyGpsRecommendations({ categoryId, playerId }: WeeklyGpsRecommendationsProps) {
  const today = new Date();
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const previousWeekStart = subDays(currentWeekStart, 7);
  const previousWeekEnd = subDays(currentWeekStart, 1);

  const { data: weeklyData, isLoading } = useQuery({
    queryKey: ["weekly_gps_metrics", categoryId, playerId],
    queryFn: async () => {
      // Fetch current week GPS data
      let currentQuery = supabase
        .from("gps_sessions")
        .select("*")
        .eq("category_id", categoryId)
        .gte("session_date", format(currentWeekStart, "yyyy-MM-dd"))
        .lte("session_date", format(currentWeekEnd, "yyyy-MM-dd"));

      let previousQuery = supabase
        .from("gps_sessions")
        .select("*")
        .eq("category_id", categoryId)
        .gte("session_date", format(previousWeekStart, "yyyy-MM-dd"))
        .lte("session_date", format(previousWeekEnd, "yyyy-MM-dd"));

      if (playerId) {
        currentQuery = currentQuery.eq("player_id", playerId);
        previousQuery = previousQuery.eq("player_id", playerId);
      }

      const [currentRes, previousRes] = await Promise.all([
        currentQuery,
        previousQuery
      ]);

      if (currentRes.error) throw currentRes.error;
      if (previousRes.error) throw previousRes.error;

      const aggregateMetrics = (sessions: typeof currentRes.data): GpsMetrics => {
        return sessions.reduce((acc, s) => ({
          totalDistance: acc.totalDistance + (s.total_distance_m || 0),
          hiDistance: acc.hiDistance + (s.high_speed_distance_m || 0),
          thiDistance: acc.thiDistance + ((s.high_speed_distance_m || 0) * 0.6), // Approximation
          sprintDistance: acc.sprintDistance + (s.sprint_distance_m || 0),
          playerLoad: acc.playerLoad + (s.player_load || 0),
          maxSpeed: Math.max(acc.maxSpeed, s.max_speed_ms || 0),
          sessionCount: acc.sessionCount + 1,
        }), {
          totalDistance: 0,
          hiDistance: 0,
          thiDistance: 0,
          sprintDistance: 0,
          playerLoad: 0,
          maxSpeed: 0,
          sessionCount: 0,
        });
      };

      // Fetch reference from performance_references if available
      let referenceMetrics: GpsMetrics | null = null;
      if (playerId) {
        const { data: refData } = await supabase
          .from("player_performance_references")
          .select("*")
          .eq("category_id", categoryId)
          .eq("player_id", playerId)
          .eq("is_active", true)
          .maybeSingle();

        if (refData) {
          referenceMetrics = {
            totalDistance: 0,
            hiDistance: (refData.ref_high_intensity_distance_per_min || 0) * 60, // Per session estimate
            thiDistance: 0,
            sprintDistance: refData.ref_sprint_distance_m || 0,
            playerLoad: (refData.ref_player_load_per_min || 0) * 60,
            maxSpeed: refData.ref_vmax_ms || 0,
            sessionCount: 1,
          };
        }
      }

      return {
        current: aggregateMetrics(currentRes.data || []),
        previous: aggregateMetrics(previousRes.data || []),
        averageReference: referenceMetrics,
      } as WeeklyData;
    },
    enabled: !!categoryId,
  });

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-32 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!weeklyData || weeklyData.current.sessionCount === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center text-muted-foreground">
          <Navigation className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Aucune donnée GPS cette semaine</p>
          <p className="text-xs">Importez des données GPS pour voir les préconisations</p>
        </CardContent>
      </Card>
    );
  }

  const { current, previous, averageReference } = weeklyData;
  const loadStatus = getLoadStatus(current.playerLoad, previous.playerLoad || averageReference?.playerLoad || null);

  const metrics = [
    {
      label: "Distance totale",
      current: current.totalDistance,
      previous: previous.totalDistance,
      unit: "m",
      icon: <Navigation className="h-4 w-4" />,
      format: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)} km` : `${Math.round(v)} m`,
    },
    {
      label: "Haute Intensité (>18 km/h)",
      current: current.hiDistance,
      previous: previous.hiDistance,
      unit: "m",
      icon: <Activity className="h-4 w-4" />,
      format: (v: number) => `${Math.round(v)} m`,
    },
    {
      label: "Sprint (>24 km/h)",
      current: current.sprintDistance,
      previous: previous.sprintDistance,
      unit: "m",
      icon: <Zap className="h-4 w-4" />,
      format: (v: number) => `${Math.round(v)} m`,
    },
    {
      label: "Player Load",
      current: current.playerLoad,
      previous: previous.playerLoad,
      unit: "AU",
      icon: <Target className="h-4 w-4" />,
      format: (v: number) => v.toFixed(0),
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-primary" />
            Préconisations GPS hebdomadaires
          </span>
          <Badge variant="outline" className="text-xs font-normal">
            {format(currentWeekStart, "d MMM", { locale: fr })} - {format(currentWeekEnd, "d MMM", { locale: fr })}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Load Status Banner */}
        <div className={`flex items-center gap-3 p-3 rounded-lg bg-muted/50 ${loadStatus.color}`}>
          {loadStatus.icon}
          <div className="flex-1">
            <p className="text-sm font-medium">{loadStatus.message}</p>
            {previous.sessionCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {current.sessionCount} session(s) vs {previous.sessionCount} semaine dernière
              </p>
            )}
          </div>
        </div>

        {/* Vmax Display */}
        {current.maxSpeed > 0 && (
          <div className="flex items-center justify-between p-2 bg-primary/5 rounded">
            <span className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Vmax atteinte
            </span>
            <span className="font-bold text-primary">
              {(current.maxSpeed * 3.6).toFixed(1)} km/h
            </span>
            {averageReference?.maxSpeed && (
              <Badge variant={current.maxSpeed >= averageReference.maxSpeed * 0.95 ? "default" : "secondary"}>
                {Math.round((current.maxSpeed / averageReference.maxSpeed) * 100)}% réf
              </Badge>
            )}
          </div>
        )}

        {/* Metrics Grid */}
        <div className="space-y-3">
          {metrics.map((metric) => {
            const change = calculatePercentChange(metric.current, metric.previous);
            
            return (
              <div key={metric.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {metric.icon}
                    {metric.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{metric.format(metric.current)}</span>
                    {change !== null && (
                      <Badge 
                        variant={change > 10 ? "default" : change < -10 ? "secondary" : "outline"}
                        className="text-xs"
                      >
                        {change > 0 ? "+" : ""}{change}%
                      </Badge>
                    )}
                  </div>
                </div>
                {metric.previous > 0 && (
                  <Progress 
                    value={Math.min(100, (metric.current / metric.previous) * 50)} 
                    className="h-1"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Recommendations */}
        <div className="space-y-2 pt-2 border-t">
          <p className="text-xs font-medium text-muted-foreground">Recommandations:</p>
          <ul className="text-xs space-y-1 text-muted-foreground">
            {loadStatus.status === "low" && (
              <>
                <li>• Augmenter progressivement le volume d'entraînement</li>
                <li>• Intégrer plus de travail haute intensité</li>
              </>
            )}
            {loadStatus.status === "optimal" && (
              <>
                <li>• Maintenir le rythme actuel</li>
                <li>• Varier les intensités pour continuer la progression</li>
              </>
            )}
            {loadStatus.status === "high" && (
              <>
                <li>• Prévoir une session de récupération active</li>
                <li>• Surveiller les indicateurs de fatigue</li>
              </>
            )}
            {loadStatus.status === "very_high" && (
              <>
                <li className="text-destructive">• Réduire immédiatement le volume</li>
                <li className="text-destructive">• Privilégier la récupération (48-72h)</li>
                <li>• Évaluer le wellness avant reprise intensive</li>
              </>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
