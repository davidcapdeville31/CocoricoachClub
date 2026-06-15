import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from "recharts";
import { BarChart3, Activity, Dumbbell } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getTrainingTypeLabel } from "@/lib/constants/trainingTypes";

interface Props {
  playerId: string;
  categoryId: string;
}

export function AthleteSpaceRpeHistory({ playerId, categoryId }: Props) {
  const { data: rpeHistory = [], isLoading } = useQuery({
    queryKey: ["athlete-space-rpe-history", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("awcr_tracking")
        .select("id, session_date, rpe, duration_minutes, training_load, acute_load, chronic_load, awcr, training_session_id, training_sessions(training_type)")
        .eq("player_id", playerId)
        .order("session_date", { ascending: true })
        .limit(60);
      if (error) throw error;
      return data || [];
    },
  });

  // Tonnage history (musculation logs) — last 60 days
  const { data: tonnageLogs = [] } = useQuery({
    queryKey: ["athlete-space-tonnage", playerId, categoryId],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 60);
      const { data, error } = await supabase
        .from("athlete_exercise_logs")
        .select("tonnage, created_at, training_sessions!inner(session_date)")
        .eq("player_id", playerId)
        .eq("category_id", categoryId)
        .gte("created_at", since.toISOString());
      if (error) throw error;
      return data || [];
    },
  });

  const hasTonnage = (tonnageLogs as any[]).some((l) => Number(l.tonnage || 0) > 0);
  if (isLoading || (rpeHistory.length === 0 && !hasTonnage)) return null;

  // Tonnage aggregated per session date
  const tonnageByDate = new Map<string, number>();
  (tonnageLogs as any[]).forEach((l) => {
    const d = (l.training_sessions as any)?.session_date || l.created_at?.split("T")[0];
    if (!d) return;
    tonnageByDate.set(d, (tonnageByDate.get(d) || 0) + Number(l.tonnage || 0));
  });
  const tonnageChart = Array.from(tonnageByDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, tonnage]) => ({
      date: format(new Date(date), "dd/MM", { locale: fr }),
      fullDate: format(new Date(date), "dd MMM yyyy", { locale: fr }),
      tonnage: Math.round(tonnage),
    }));
  const totalTonnage = Math.round(
    (tonnageLogs as any[]).reduce((s, l) => s + Number(l.tonnage || 0), 0)
  );

  const chartData = rpeHistory.map((r: any) => ({
    date: format(new Date(r.session_date), "dd/MM", { locale: fr }),
    fullDate: format(new Date(r.session_date), "dd MMM yyyy", { locale: fr }),
    rpe: r.rpe,
    load: r.training_load || r.rpe * r.duration_minutes,
    duration: r.duration_minutes,
    type: getTrainingTypeLabel((r.training_sessions as any)?.training_type || ""),
    awcr: r.awcr ? parseFloat((r.awcr as number).toFixed(2)) : null,
  }));

  // Stats summary
  const avgRpe = (rpeHistory.reduce((s, r) => s + r.rpe, 0) / rpeHistory.length).toFixed(1);
  const avgLoad = Math.round(
    rpeHistory.reduce((s, r: any) => s + (r.training_load || r.rpe * r.duration_minutes), 0) / rpeHistory.length
  );
  const maxRpe = Math.max(...rpeHistory.map(r => r.rpe));

  const getRpeColor = (val: number) => {
    if (val <= 3) return "text-status-optimal";
    if (val <= 5) return "text-accent";
    if (val <= 7) return "text-warning";
    return "text-destructive";
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gradient-card">
          <CardContent className="py-3 text-center">
            <p className={`text-2xl font-bold ${getRpeColor(parseFloat(avgRpe))}`}>{avgRpe}</p>
            <p className="text-[10px] text-muted-foreground">RPE moyen</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card">
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-primary">{avgLoad}</p>
            <p className="text-[10px] text-muted-foreground">Charge moy.</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card">
          <CardContent className="py-3 text-center">
            <p className={`text-2xl font-bold ${getRpeColor(maxRpe)}`}>{maxRpe}</p>
            <p className="text-[10px] text-muted-foreground">RPE max</p>
          </CardContent>
        </Card>
      </div>

      {/* RPE evolution chart */}
      <Card className="bg-gradient-card shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent" />
            Évolution RPE
            <Badge variant="secondary" className="text-[10px]">{rpeHistory.length} séances</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-[10px]" />
              <YAxis domain={[0, 10]} className="text-[10px]" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  fontSize: "12px",
                  borderRadius: "8px",
                }}
                formatter={(value: number, name: string) => {
                  if (name === "rpe") return [`${value}/10`, "RPE"];
                  return [value, name];
                }}
                labelFormatter={(label: string, payload: any[]) => {
                  const item = payload?.[0]?.payload;
                  return item ? `${item.fullDate} — ${item.type}` : label;
                }}
              />
              <Line type="monotone" dataKey="rpe" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3 }} name="rpe" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Training load chart */}
      <Card className="bg-gradient-card shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Charge d'entraînement (RPE × Durée)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-[10px]" />
              <YAxis className="text-[10px]" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  fontSize: "12px",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => [`${value} UA`, "Charge"]}
                labelFormatter={(label: string, payload: any[]) => {
                  const item = payload?.[0]?.payload;
                  return item ? `${item.fullDate} — ${item.type} (${item.duration}min)` : label;
                }}
              />
              <Bar dataKey="load" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Charge" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tonnage (musculation) */}
      {hasTonnage && (
        <Card className="bg-gradient-card shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-primary" />
              Tonnage musculation
              <Badge variant="secondary" className="text-[10px]">
                {totalTonnage.toLocaleString()} kg cumulés
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={tonnageChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-[10px]" />
                <YAxis className="text-[10px]" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    fontSize: "12px",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [`${value.toLocaleString()} kg`, "Tonnage"]}
                  labelFormatter={(label: string, payload: any[]) => {
                    const item = payload?.[0]?.payload;
                    return item ? item.fullDate : label;
                  }}
                />
                <Bar dataKey="tonnage" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Tonnage" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
