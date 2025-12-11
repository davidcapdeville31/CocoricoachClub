import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  AlertTriangle, 
  Calendar, 
  Activity,
  TrendingUp,
  Heart
} from "lucide-react";
import { format, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";

interface WidgetData {
  totalPlayers: number;
  activeInjuries: number;
  upcomingTrainings: number;
  upcomingMatches: number;
  awcrAlerts: number;
  recentWellnessLow: number;
}

export function DashboardWidgets() {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const { data: widgetData, isLoading } = useQuery({
    queryKey: ["dashboard-widgets"],
    queryFn: async (): Promise<WidgetData> => {
      // Fetch total players
      const { count: playersCount } = await supabase
        .from("players")
        .select("*", { count: "exact", head: true });

      // Fetch active injuries
      const { count: injuriesCount } = await supabase
        .from("injuries")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      // Fetch upcoming trainings this week
      const { data: trainings } = await supabase
        .from("training_sessions")
        .select("session_date")
        .gte("session_date", format(weekStart, "yyyy-MM-dd"))
        .lte("session_date", format(weekEnd, "yyyy-MM-dd"));

      // Fetch upcoming matches this week
      const { data: matches } = await supabase
        .from("matches")
        .select("match_date")
        .gte("match_date", format(weekStart, "yyyy-MM-dd"))
        .lte("match_date", format(weekEnd, "yyyy-MM-dd"));

      // Fetch AWCR alerts (players with AWCR > 1.5 or < 0.8)
      const { data: awcrData } = await supabase
        .from("awcr_tracking")
        .select("player_id, awcr")
        .not("awcr", "is", null)
        .order("session_date", { ascending: false });

      // Get unique players with concerning AWCR
      const playerAwcr = new Map<string, number>();
      awcrData?.forEach(entry => {
        if (!playerAwcr.has(entry.player_id) && entry.awcr !== null) {
          playerAwcr.set(entry.player_id, entry.awcr);
        }
      });
      const awcrAlerts = Array.from(playerAwcr.values()).filter(
        awcr => awcr > 1.5 || awcr < 0.8
      ).length;

      // Fetch recent wellness with low scores (average < 3)
      const { data: wellnessData } = await supabase
        .from("wellness_tracking")
        .select("player_id, sleep_quality, general_fatigue, stress_level")
        .gte("tracking_date", format(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));

      // Count players with concerning wellness
      const playerWellness = new Map<string, number[]>();
      wellnessData?.forEach(entry => {
        const scores = [entry.sleep_quality, entry.general_fatigue, entry.stress_level];
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        if (!playerWellness.has(entry.player_id)) {
          playerWellness.set(entry.player_id, []);
        }
        playerWellness.get(entry.player_id)?.push(avg);
      });
      
      const wellnessLow = Array.from(playerWellness.values()).filter(scores => {
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        return avgScore > 3.5; // Higher is worse for fatigue/stress
      }).length;

      return {
        totalPlayers: playersCount || 0,
        activeInjuries: injuriesCount || 0,
        upcomingTrainings: trainings?.length || 0,
        upcomingMatches: matches?.length || 0,
        awcrAlerts,
        recentWellnessLow: wellnessLow,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-8 bg-muted rounded mb-2" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const widgets = [
    {
      title: "Joueurs",
      value: widgetData?.totalPlayers || 0,
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Blessures actives",
      value: widgetData?.activeInjuries || 0,
      icon: AlertTriangle,
      color: widgetData?.activeInjuries ? "text-red-500" : "text-green-500",
      bgColor: widgetData?.activeInjuries ? "bg-red-500/10" : "bg-green-500/10",
    },
    {
      title: "Entraînements",
      value: widgetData?.upcomingTrainings || 0,
      icon: Activity,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      subtitle: "cette semaine",
    },
    {
      title: "Matchs",
      value: widgetData?.upcomingMatches || 0,
      icon: Calendar,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      subtitle: "cette semaine",
    },
    {
      title: "Alertes AWCR",
      value: widgetData?.awcrAlerts || 0,
      icon: TrendingUp,
      color: widgetData?.awcrAlerts ? "text-orange-500" : "text-green-500",
      bgColor: widgetData?.awcrAlerts ? "bg-orange-500/10" : "bg-green-500/10",
    },
    {
      title: "Wellness faible",
      value: widgetData?.recentWellnessLow || 0,
      icon: Heart,
      color: widgetData?.recentWellnessLow ? "text-amber-500" : "text-green-500",
      bgColor: widgetData?.recentWellnessLow ? "bg-amber-500/10" : "bg-green-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      {widgets.map((widget, index) => (
        <Card 
          key={widget.title} 
          className="hover:shadow-md transition-shadow animate-fade-in"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${widget.bgColor}`}>
                <widget.icon className={`h-5 w-5 ${widget.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{widget.value}</p>
                <p className="text-xs text-muted-foreground">{widget.title}</p>
                {widget.subtitle && (
                  <p className="text-[10px] text-muted-foreground/70">{widget.subtitle}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
