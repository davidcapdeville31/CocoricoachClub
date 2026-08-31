import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Scale, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { NAV_COLORS } from "@/components/ui/colored-nav-tabs";
import { useWeightHistory } from "@/lib/hooks/useWeightData";
import { weightTrend, isPlausibleWeight } from "@/lib/weight/weightHistory";

interface Props {
  playerId: string;
  categoryId: string;
  /** Allow logging a new weight (athlete space / staff). */
  canLog?: boolean;
}

export function AthleteWeightSection({ playerId, categoryId, canLog = true }: Props) {
  const qc = useQueryClient();
  const { entries, isLoading } = useWeightHistory({ playerId });
  const [value, setValue] = useState("");

  const trend = weightTrend(entries);

  const addWeight = useMutation({
    mutationFn: async () => {
      const weight = Number(value.replace(",", "."));
      if (!isPlausibleWeight(weight)) throw new Error("Poids invalide (20 à 200 kg)");
      const { error } = await supabase.from("body_composition").insert({
        player_id: playerId,
        category_id: categoryId,
        measurement_date: format(new Date(), "yyyy-MM-dd"),
        weight_kg: weight,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setValue("");
      toast.success("Poids enregistré");
      qc.invalidateQueries({ queryKey: ["weight-history"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur lors de l'enregistrement"),
  });

  const chartData = entries.slice(-60).map((e) => ({
    date: format(new Date(e.date), "dd/MM"),
    fullDate: e.date,
    weight: e.weight,
  }));

  const DeltaIcon = !trend?.deltaPrev ? Minus : trend.deltaPrev > 0 ? TrendingUp : TrendingDown;
  const deltaColor = !trend?.deltaPrev
    ? "text-muted-foreground"
    : trend.deltaPrev > 0
    ? "text-warning"
    : "text-status-optimal";

  return (
    <Card className="bg-gradient-card shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Scale className="h-4 w-4" style={{ color: NAV_COLORS.sante.base }} />
          Poids
          {trend && <Badge variant="secondary" className="text-[10px]">{trend.count} mesures</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canLog && (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="Poids du jour (kg)"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <Button onClick={() => addWeight.mutate()} disabled={addWeight.isPending}>
              Enregistrer
            </Button>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : !trend ? (
          <p className="text-sm text-muted-foreground">Aucune mesure de poids enregistrée pour le moment.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-surface-sunken p-3 text-center">
                <p className="text-xl font-bold">{trend.current} kg</p>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(trend.currentDate), "dd/MM/yyyy")}
                </p>
              </div>
              <div className="rounded-xl bg-surface-sunken p-3 text-center">
                <p className={`text-xl font-bold flex items-center justify-center gap-1 ${deltaColor}`}>
                  <DeltaIcon className="h-4 w-4" />
                  {trend.deltaPrev == null ? "—" : `${trend.deltaPrev > 0 ? "+" : ""}${trend.deltaPrev} kg`}
                </p>
                <p className="text-[10px] text-muted-foreground">vs mesure précédente</p>
              </div>
              <div className="rounded-xl bg-surface-sunken p-3 text-center">
                <p className="text-xl font-bold">
                  {trend.delta30 > 0 ? "+" : ""}{trend.delta30} kg
                </p>
                <p className="text-[10px] text-muted-foreground">sur 30 jours</p>
              </div>
            </div>

            {chartData.length > 1 && (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-[10px]" />
                  <YAxis
                    domain={[
                      (dataMin: number) => Math.floor(dataMin - 2),
                      (dataMax: number) => Math.ceil(dataMax + 2),
                    ]}
                    className="text-[10px]"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      fontSize: "12px",
                      borderRadius: "8px",
                    }}
                    formatter={(v: number) => [`${v} kg`, "Poids"]}
                    labelFormatter={(_, payload: any[]) => payload?.[0]?.payload?.fullDate || ""}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke={NAV_COLORS.sante.base}
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                    name="Poids"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
