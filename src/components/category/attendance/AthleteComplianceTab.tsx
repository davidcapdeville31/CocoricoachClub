import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO, subDays } from "date-fns";
import { Activity, HeartPulse, Scale, ClipboardList, Gauge } from "lucide-react";
import {
  ALL_GROUPS,
  PlayerGroupFilter,
  useGroupPlayerIds,
} from "@/components/category/players/PlayerGroupFilter";

interface Props {
  categoryId: string;
}

const pct = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : null);

const rateColor = (value: number | null) => {
  if (value === null) return "text-muted-foreground";
  if (value >= 80) return "text-green-600";
  if (value >= 50) return "text-amber-600";
  return "text-red-600";
};

/**
 * Assiduité dans l'application : qui remplit son Wellness, son RPE,
 * ses tests et son poids. Filtrable par groupe d'athlètes.
 * Générique toutes disciplines.
 */
export function AthleteComplianceTab({ categoryId }: Props) {
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [groupFilter, setGroupFilter] = useState<string>(ALL_GROUPS);
  const groupPlayerIds = useGroupPlayerIds(categoryId, groupFilter);

  const { data: players = [] } = useQuery({
    queryKey: ["compliance-players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: wellness = [] } = useQuery({
    queryKey: ["compliance-wellness", categoryId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_tracking")
        .select("player_id, tracking_date, auto_filled")
        .eq("category_id", categoryId)
        .gte("tracking_date", startDate)
        .lte("tracking_date", endDate);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: loads = [] } = useQuery({
    queryKey: ["compliance-rpe", categoryId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("awcr_tracking")
        .select("player_id, session_date, auto_filled, rpe, training_session_id")
        .eq("category_id", categoryId)
        .gte("session_date", startDate)
        .lte("session_date", endDate);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: tests = [] } = useQuery({
    queryKey: ["compliance-tests", categoryId, startDate, endDate],
    queryFn: async () => {
      const tables = ["generic_tests", "speed_tests", "strength_tests", "jump_tests"] as const;
      const results = await Promise.all(
        tables.map(async (table) => {
          const { data, error } = await supabase
            .from(table)
            .select("player_id, test_date")
            .eq("category_id", categoryId)
            .gte("test_date", startDate)
            .lte("test_date", endDate);
          if (error) throw error;
          return data || [];
        }),
      );
      return results.flat();
    },
  });

  const { data: weights = [] } = useQuery({
    queryKey: ["compliance-weights", categoryId],
    queryFn: async () => {
      const [bc, pm, gt, ct] = await Promise.all([
        supabase
          .from("body_composition")
          .select("player_id, measurement_date, weight_kg, created_at")
          .eq("category_id", categoryId),
        supabase
          .from("player_measurements")
          .select("player_id, measurement_date, weight_kg, created_at")
          .eq("category_id", categoryId),
        supabase
          .from("generic_tests")
          .select("player_id, test_date, test_type, test_category, result_value, result_unit, created_at")
          .eq("category_id", categoryId),
        supabase.from("custom_tests").select("id, name, unit, test_category").eq("category_id", categoryId),
      ]);
      if (bc.error) throw bc.error;
      if (pm.error) throw pm.error;
      if (gt.error) throw gt.error;

      const entries = collectWeightHistory({
        bodyComps: bc.data || [],
        playerMeasurements: pm.data || [],
        genericTests: (gt.data || []) as any,
        customTests: (ct.data || []) as any,
      });

      // Format homogène avec l'ancien usage (measurement_date / weight_kg)
      return entries.map((e) => ({
        player_id: e.player_id,
        measurement_date: e.date,
        weight_kg: e.weight,
      }));
    },
  });

  const rows = useMemo(() => {
    const visible = players.filter((p: any) => !groupPlayerIds || groupPlayerIds.has(p.id));
    return visible
      .map((p: any) => {
        const w = wellness.filter((r: any) => r.player_id === p.id);
        const wDone = w.filter((r: any) => !r.auto_filled).length;
        const wRate = pct(wDone, w.length);

        const l = loads.filter((r: any) => r.player_id === p.id && r.training_session_id);
        const lDone = l.filter((r: any) => !r.auto_filled && Number(r.rpe) > 0).length;
        const lRate = pct(lDone, l.length);

        const testCount = tests.filter((r: any) => r.player_id === p.id).length;

        const playerWeights = weights
          .filter((r: any) => r.player_id === p.id)
          .sort(
            (a: any, b: any) =>
              new Date(b.measurement_date).getTime() - new Date(a.measurement_date).getTime(),
          );
        const lastWeight = playerWeights[0] || null;
        const weightsInPeriod = playerWeights.filter(
          (r: any) => r.measurement_date >= startDate && r.measurement_date <= endDate,
        ).length;

        const parts = [wRate, lRate].filter((v): v is number => v !== null);
        const global = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;

        return {
          id: p.id,
          name: [p.first_name, p.name].filter(Boolean).join(" ") || p.name,
          wDone,
          wTotal: w.length,
          wRate,
          lDone,
          lTotal: l.length,
          lRate,
          testCount,
          lastWeight,
          weightsInPeriod,
          global,
        };
      })
      .sort((a, b) => (b.global ?? -1) - (a.global ?? -1));
  }, [players, groupPlayerIds, wellness, loads, tests, weights, startDate, endDate]);

  const average = useMemo(() => {
    const vals = rows.map((r) => r.global).filter((v): v is number => v !== null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }, [rows]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Assiduité dans l'application
          </CardTitle>
          <CardDescription>
            Qui remplit bien son Wellness, son RPE, ses tests et son poids — filtrable par groupe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Du</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 w-[150px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Au</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-[150px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Groupe</Label>
              <PlayerGroupFilter
                categoryId={categoryId}
                value={groupFilter}
                onChange={setGroupFilter}
              />
            </div>
            {average !== null && (
              <div className="ml-auto text-right">
                <p className="text-xs text-muted-foreground">Assiduité moyenne</p>
                <p className={`text-2xl font-bold ${rateColor(average)}`}>{average}%</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Aucun athlète à afficher</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Athlète</TableHead>
                    <TableHead className="text-center">
                      <span className="inline-flex items-center gap-1">
                        <HeartPulse className="h-3.5 w-3.5" /> Wellness
                      </span>
                    </TableHead>
                    <TableHead className="text-center">
                      <span className="inline-flex items-center gap-1">
                        <Gauge className="h-3.5 w-3.5" /> RPE
                      </span>
                    </TableHead>
                    <TableHead className="text-center">
                      <span className="inline-flex items-center gap-1">
                        <ClipboardList className="h-3.5 w-3.5" /> Tests
                      </span>
                    </TableHead>
                    <TableHead className="text-center">
                      <span className="inline-flex items-center gap-1">
                        <Scale className="h-3.5 w-3.5" /> Poids
                      </span>
                    </TableHead>
                    <TableHead className="text-center">Assiduité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-center">
                        <span className={rateColor(r.wRate)}>
                          {r.wRate === null ? "—" : `${r.wRate}%`}
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          {r.wDone}/{r.wTotal} rempli{r.wDone > 1 ? "s" : ""}
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={rateColor(r.lRate)}>
                          {r.lRate === null ? "—" : `${r.lRate}%`}
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          {r.lDone}/{r.lTotal} séance{r.lTotal > 1 ? "s" : ""}
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        {r.testCount > 0 ? (
                          <Badge variant="outline">{r.testCount}</Badge>
                        ) : (
                          <span className="text-red-600">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.lastWeight ? (
                          <>
                            <span className="font-mono">{r.lastWeight.weight_kg} kg</span>
                            <p className="text-[11px] text-muted-foreground">
                              {format(parseISO(r.lastWeight.measurement_date), "dd/MM/yyyy")}
                              {r.weightsInPeriod > 0 ? ` · ${r.weightsInPeriod} sur la période` : ""}
                            </p>
                          </>
                        ) : (
                          <span className="text-red-600">Aucune pesée</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.global === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <Progress value={r.global} className="h-2 w-16" />
                            <span className={`text-sm font-semibold ${rateColor(r.global)}`}>
                              {r.global}%
                            </span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
