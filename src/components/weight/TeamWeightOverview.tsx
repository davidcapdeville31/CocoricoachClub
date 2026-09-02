import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scale, TrendingDown, TrendingUp, Minus } from "lucide-react";
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


interface Props {
  categoryId: string;
}

/** Staff-wide view of every athlete's latest body weight and its evolution. */
export function TeamWeightOverview({ categoryId }: Props) {
  const { entries, isLoading } = useWeightHistory({ categoryId });
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const activeId = selectedId && withData.some((r) => r.id === selectedId) ? selectedId : withData[0]?.id || null;
  const activeName = withData.find((r) => r.id === activeId)?.name || "";
  const chartData = useMemo(
    () =>
      entries
        .filter((e) => e.player_id === activeId)
        .slice(-60)
        .map((e) => ({ date: format(new Date(e.date), "dd/MM"), fullDate: e.date, weight: e.weight })),
    [entries, activeId],
  );

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
                  return (
                    <TableRow
                      key={r.id}
                      onClick={() => r.trend && setSelectedId(r.id)}
                      className={`${r.trend ? "cursor-pointer" : "opacity-60"} ${
                        r.id === activeId ? "bg-primary/5" : ""
                      }`}
                    >
                      <TableCell className="font-medium">{r.name}</TableCell>
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
        {activeId && chartData.length > 1 && (
          <div className="mt-4 rounded-xl border bg-surface-sunken p-3">
            <p className="text-sm font-medium mb-2">Évolution du poids — {activeName}</p>
            <ResponsiveContainer width="100%" height={240}>
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
          </div>
        )}
        {activeId && chartData.length <= 1 && (
          <p className="text-[11px] text-muted-foreground mt-3">
            Une seule mesure pour {activeName} : la courbe s'affichera dès la deuxième pesée.
          </p>
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
