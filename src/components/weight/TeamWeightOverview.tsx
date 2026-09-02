import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scale, TrendingDown, TrendingUp, Minus, LineChart as LineChartIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { fetchCategoryRosterPlayers } from "@/lib/categoryRoster";
import { useSeasonFilteredPlayerIds } from "@/hooks/use-season-filtered-players";
import { useWeightHistory } from "@/lib/hooks/useWeightData";
import { weightTrend } from "@/lib/weight/weightHistory";
import { downloadCsv, generateCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { NAV_COLORS } from "@/components/ui/colored-nav-tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";


interface Props {
  categoryId: string;
}

/** Staff-wide view of every athlete's latest body weight and its evolution. */
export function TeamWeightOverview({ categoryId }: Props) {
  const { entries, isLoading } = useWeightHistory({ categoryId });
  const [focusPlayer, setFocusPlayer] = useState<{ id: string; name: string } | null>(null);
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

  const chartData = useMemo(() => {
    if (!focusPlayer) return [];
    return entries
      .filter((e) => e.player_id === focusPlayer.id)
      .slice(-60)
      .map((e) => ({ date: format(new Date(e.date), "dd/MM"), fullDate: e.date, weight: e.weight }));
  }, [entries, focusPlayer]);

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
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun athlète dans cette catégorie.</p>
        ) : (
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Athlète</TableHead>
                  <TableHead className="text-right">Dernier poids</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Évolution</TableHead>
                  <TableHead className="text-right">Sur 30 jours</TableHead>
                  <TableHead className="text-right">Mesures</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const d = r.trend?.deltaPrev ?? null;
                  const Icon = !d ? Minus : d > 0 ? TrendingUp : TrendingDown;
                  const color = !d ? "text-muted-foreground" : d > 0 ? "text-warning" : "text-status-optimal";
                  const hasChart = (r.trend?.count || 0) >= 2;
                  return (
                    <TableRow
                      key={r.id}
                      className={r.trend ? "" : "opacity-60"}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {hasChart ? (
                            <button
                              type="button"
                              onClick={() => setFocusPlayer({ id: r.id, name: r.name })}
                              className="hover:text-primary hover:underline underline-offset-2 text-left"
                              title="Voir la courbe de poids"
                            >
                              {r.name}
                            </button>
                          ) : (
                            <span>{r.name}</span>
                          )}
                          {hasChart && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 -ml-0.5 text-primary hover:text-primary"
                              title="Voir la courbe de poids"
                              onClick={() => setFocusPlayer({ id: r.id, name: r.name })}
                            >
                              <LineChartIcon className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {r.trend ? `${r.trend.current} kg` : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {r.trend ? format(new Date(r.trend.currentDate), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell className={`text-right ${color}`}>
                        {r.trend ? (
                          <span className="inline-flex items-center gap-1 justify-end">
                            <Icon className="h-3 w-3" />
                            {d == null ? "—" : `${d > 0 ? "+" : ""}${d} kg`}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {r.trend ? `${r.trend.delta30 > 0 ? "+" : ""}${r.trend.delta30} kg` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.trend ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {r.trend.count}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {rows.length - withData.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-3">
            {rows.length - withData.length} athlète(s) sans poids enregistré.
          </p>
        )}

        {/* DIALOG COURBE INDIVIDUELLE */}
        <Dialog open={!!focusPlayer} onOpenChange={(o) => !o && setFocusPlayer(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LineChartIcon className="h-4 w-4 text-primary" />
                Évolution du poids — {focusPlayer?.name}
              </DialogTitle>
            </DialogHeader>
            {(() => {
              if (!focusPlayer) return null;
              if (chartData.length <= 1) {
                return (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Au moins 2 pesées sont nécessaires pour tracer une courbe.
                  </p>
                );
              }
              return (
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                        domain={[
                          (dataMin: number) => Math.floor(dataMin - 2),
                          (dataMax: number) => Math.ceil(dataMax + 2),
                        ]}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(v: number) => [`${v} kg`, "Poids"]}
                        labelFormatter={(_, payload: any[]) => payload?.[0]?.payload?.fullDate || ""}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke={NAV_COLORS.sante.base}
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 7 }}
                        name="Poids"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
