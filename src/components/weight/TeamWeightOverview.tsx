import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scale, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { format } from "date-fns";
import { fetchCategoryRosterPlayers } from "@/lib/categoryRoster";
import { useSeasonFilteredPlayerIds } from "@/hooks/use-season-filtered-players";
import { useWeightHistory } from "@/lib/hooks/useWeightData";
import { weightTrend } from "@/lib/weight/weightHistory";
import { downloadCsv, generateCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { NAV_COLORS } from "@/components/ui/colored-nav-tabs";


interface Props {
  categoryId: string;
}

/** Staff-wide view of every athlete's latest body weight and its evolution. */
export function TeamWeightOverview({ categoryId }: Props) {
  const { entries, isLoading } = useWeightHistory({ categoryId });
  const { allowedIds } = useSeasonFilteredPlayerIds(categoryId);

  const { data: players = [] } = useQuery({
    queryKey: ["category-roster-weight", categoryId],
    queryFn: () => fetchCategoryRosterPlayers(categoryId),
    enabled: !!categoryId,
  });

  const rows = useMemo(() => {
    const byPlayer = new Map<string, typeof entries>();
    for (const e of entries) {
      const list = byPlayer.get(e.player_id) || [];
      list.push(e);
      byPlayer.set(e.player_id, list);
    }
    return (players as any[])
      .filter((p) => !allowedIds || allowedIds.has(p.id))
      .map((p) => {
        const trend = weightTrend(byPlayer.get(p.id) || []);
        return {
          id: p.id,
          name: `${p.last_name || ""} ${p.first_name || ""}`.trim(),
          trend,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, players, allowedIds]);

  const withData = rows.filter((r) => r.trend);

  const exportCsv = () => {
    downloadCsv(
      "poids_effectif.csv",
      generateCsv(
        ["athlete", "poids_kg", "date", "variation_precedente_kg", "variation_30j_kg", "nb_mesures"],
        withData.map((r) => [
          r.name,
          r.trend!.current,
          r.trend!.currentDate,
          r.trend!.deltaPrev ?? "",
          r.trend!.delta30,
          r.trend!.count,
        ]),
      ),
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Poids de l'effectif
            </CardTitle>
            <CardDescription>
              Dernier poids saisi par athlète (wellness, pesée, anthropométrie ou composition corporelle).
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={withData.length === 0}>
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : withData.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun poids enregistré pour cette catégorie.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {withData.map((r) => {
              const d = r.trend!.deltaPrev;
              const Icon = !d ? Minus : d > 0 ? TrendingUp : TrendingDown;
              const color = !d ? "text-muted-foreground" : d > 0 ? "text-warning" : "text-status-optimal";
              return (
                <div key={r.id} className="rounded-xl border bg-surface-sunken p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {r.trend!.count}
                    </Badge>
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-lg font-bold">{r.trend!.current} kg</span>
                    <span className={`text-xs flex items-center gap-0.5 ${color}`}>
                      <Icon className="h-3 w-3" />
                      {d == null ? "—" : `${d > 0 ? "+" : ""}${d}`}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(r.trend!.currentDate), "dd/MM/yyyy")} · 30j :{" "}
                    {r.trend!.delta30 > 0 ? "+" : ""}
                    {r.trend!.delta30} kg
                  </p>
                </div>
              );
            })}
          </div>
        )}
        {rows.length - withData.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-3">
            {rows.length - withData.length} athlète(s) sans poids enregistré.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
