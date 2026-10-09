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
import { Activity, HeartPulse, Scale, ClipboardList, Gauge, Bell, Mail } from "lucide-react";
import {
  ALL_GROUPS,
  PlayerGroupFilter,
  useGroupPlayerIds,
} from "@/components/category/players/PlayerGroupFilter";
import { collectWeightHistory } from "@/lib/weight/weightHistory";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { generateCsv, downloadCsv } from "@/lib/csv";
import { usePlayerGroups } from "@/hooks/usePlayerGroups";

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
        .select("id, name, first_name, user_id")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const notifUserIds = useMemo(
    () => (players as any[]).map((p) => p.user_id).filter(Boolean).sort() as string[],
    [players],
  );
  // Statut réel des appareils (push) et e-mails, rafraîchi automatiquement
  const {
    data: notifStatus,
    isFetching: notifLoading,
    isError: notifError,
  } = useQuery({
    queryKey: ["compliance-notif-status", categoryId, notifUserIds.join(",")],
    enabled: notifUserIds.length > 0,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("check-onesignal-subscriptions", {
        body: { user_ids: notifUserIds },
      });
      if (error) throw error;
      return (data?.results || {}) as Record<string, { hasPush: boolean; hasEmail: boolean }>;
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
        supabase.from("custom_tests").select("id, name, unit, test_category"),
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
          hasAccount: !!p.user_id,
          notificationStatus: !p.user_id
            ? "no-account"
            : notifError
              ? "unavailable"
              : !notifStatus
                ? "checking"
                : "ready",
          hasPush: p.user_id ? (notifStatus as any)?.[p.user_id]?.hasPush === true : false,
          hasEmail: p.user_id ? (notifStatus as any)?.[p.user_id]?.hasEmail === true : false,
        };
      })
      .sort((a, b) => (b.global ?? -1) - (a.global ?? -1));
  }, [players, groupPlayerIds, wellness, loads, tests, weights, startDate, endDate, notifStatus, notifError]);

  const average = useMemo(() => {
    const vals = rows.map((r) => r.global).filter((v): v is number => v !== null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }, [rows]);

  // Détail hebdomadaire : une ligne par athlète et par semaine + total période
  const weekly = useMemo(() => {
    const out: { name: string; week: string; sessions: number; rpe: number; wel: number; rate: number | null; isTotal?: boolean }[] = [];
    rows.forEach((r) => {
      const realWellnessDates = new Set(
        wellness.filter((w: any) => w.player_id === r.id && !w.auto_filled).map((w: any) => w.tracking_date),
      );
      const sessions = new Map<string, { date: string; rpe: boolean }>();
      loads
        .filter((l: any) => l.player_id === r.id && l.training_session_id)
        .forEach((l: any) => {
          const prev = sessions.get(l.training_session_id);
          const real = !l.auto_filled && Number(l.rpe) > 0;
          sessions.set(l.training_session_id, { date: l.session_date, rpe: (prev?.rpe ?? false) || real });
        });
      const byWeek = new Map<string, { s: number; rpe: number; wel: number }>();
      sessions.forEach((s) => {
        const wk = format(startOfWeek(parseISO(s.date), { weekStartsOn: 1 }), "yyyy-MM-dd");
        const b = byWeek.get(wk) || { s: 0, rpe: 0, wel: 0 };
        b.s++;
        if (s.rpe) b.rpe++;
        if (realWellnessDates.has(s.date)) b.wel++;
        byWeek.set(wk, b);
      });
      const tot = { s: 0, rpe: 0, wel: 0 };
      [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([wk, b]) => {
        tot.s += b.s; tot.rpe += b.rpe; tot.wel += b.wel;
        out.push({ name: r.name, week: wk, sessions: b.s, rpe: b.rpe, wel: b.wel, rate: pct(b.rpe + b.wel, b.s * 2) });
      });
      out.push({ name: r.name, week: "TOTAL", sessions: tot.s, rpe: tot.rpe, wel: tot.wel, rate: pct(tot.rpe + tot.wel, tot.s * 2), isTotal: true });
    });
    return out;
  }, [rows, wellness, loads]);

  const weeklyHeaders = ["Athlète", "Semaine (lundi)", "Nb séances concernées", "Nb séances avec RPE saisi", "Nb séances avec wellness saisi", "% de saisie"];
  const weeklyExportRows = () =>
    weekly.map((w) => [
      w.name,
      w.isTotal ? `TOTAL ${periodLabel}` : format(parseISO(w.week), "dd/MM/yyyy"),
      String(w.sessions),
      String(w.rpe),
      String(w.wel),
      w.rate === null ? "—" : `${w.rate}%`,
    ]);
  const handleWeeklyCsv = () => {
    if (weekly.length === 0) return toast.error("Aucune donnée à exporter");
    downloadCsv(`${fileBase}_hebdo.csv`, generateCsv(weeklyHeaders, weeklyExportRows()));
  };
  const handleWeeklyPdf = () => {
    if (weekly.length === 0) return toast.error("Aucune donnée à exporter");
    const doc = new jsPDF({ orientation: "landscape" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(16);
    doc.text("Assiduité hebdomadaire", 14, 16);
    doc.setFontSize(10);
    doc.text(`${groupLabel}  •  Période : ${periodLabel}`, 14, 23);
    const widths = [60, 50, 40, 45, 50, 25];
    let y = 34;
    const drawRow = (cells: string[], bold = false) => {
      let x = 14;
      doc.setFont("helvetica", bold ? "bold" : "normal");
      cells.forEach((c, i) => {
        doc.text(doc.splitTextToSize(c, widths[i] - 2)[0] ?? "", x + 1, y);
        x += widths[i];
      });
      y += 7;
    };
    doc.setFillColor(34, 67, 120);
    doc.setTextColor(255, 255, 255);
    doc.rect(14, y - 5, pageW - 28, 7, "F");
    drawRow(weeklyHeaders, true);
    doc.setTextColor(0, 0, 0);
    weeklyExportRows().forEach((row, idx) => {
      if (y > pageH - 12) { doc.addPage(); y = 16; }
      if (weekly[idx].isTotal) {
        doc.setFillColor(226, 232, 240);
        doc.rect(14, y - 5, pageW - 28, 7, "F");
      }
      drawRow(row, !!weekly[idx].isTotal);
    });
    doc.save(`${fileBase}_hebdo.pdf`);
  };

  const { data: groups = [] } = usePlayerGroups(categoryId);
  const groupLabel =
    groupFilter === ALL_GROUPS
      ? "Effectif global"
      : (groups as any[]).find((g) => g.id === groupFilter)?.name || "Groupe";
  const periodLabel = `${format(parseISO(startDate), "dd/MM/yyyy")} – ${format(parseISO(endDate), "dd/MM/yyyy")}`;
  const fileBase = `assiduite_${groupLabel.replace(/\s+/g, "_")}_${startDate}_${endDate}`;

  const exportRows = () =>
    rows.map((r) => [
      r.name,
      r.wRate === null ? "—" : `${r.wRate}%`,
      `${r.wDone}/${r.wTotal}`,
      r.lRate === null ? "—" : `${r.lRate}%`,
      `${r.lDone}/${r.lTotal}`,
      String(r.testCount),
      r.lastWeight ? `${r.lastWeight.weight_kg} kg` : "Aucune pesée",
      r.lastWeight ? format(parseISO(r.lastWeight.measurement_date), "dd/MM/yyyy") : "",
      r.global === null ? "—" : `${r.global}%`,
      r.notificationStatus === "no-account"
        ? "Pas de compte"
        : r.notificationStatus === "checking"
          ? "Vérification…"
          : r.notificationStatus === "unavailable"
            ? "Statut indisponible"
            : r.hasPush
              ? "Push actif"
              : "Push inactif",
      r.notificationStatus === "no-account"
        ? "Pas de compte"
        : r.notificationStatus === "checking"
          ? "Vérification…"
          : r.notificationStatus === "unavailable"
            ? "Statut indisponible"
            : r.hasEmail
              ? "Mail actif"
              : "Mail inactif",
    ]);
  const headers = ["Athlète", "Wellness %", "Wellness remplis", "RPE %", "RPE séances", "Tests", "Dernier poids", "Date pesée", "Assiduité", "Push", "Mail"];

  const handleCsv = () => {
    if (rows.length === 0) return toast.error("Aucun athlète à exporter");
    downloadCsv(`${fileBase}.csv`, generateCsv(headers, exportRows()));
  };

  const handlePdf = () => {
    if (rows.length === 0) return toast.error("Aucun athlète à exporter");
    const doc = new jsPDF({ orientation: "landscape" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(16);
    doc.text("Assiduité dans l'application", 14, 16);
    doc.setFontSize(10);
    doc.text(`${groupLabel}  •  Période : ${periodLabel}  •  ${rows.length} athlète(s)`, 14, 23);
    if (average !== null) doc.text(`Assiduité moyenne : ${average}%`, 14, 29);
    const widths = [50, 20, 26, 18, 24, 14, 28, 24, 22, 20, 20];
    let y = 38;
    const drawRow = (cells: string[], bold = false) => {
      let x = 14;
      doc.setFont("helvetica", bold ? "bold" : "normal");
      cells.forEach((c, i) => {
        doc.text(doc.splitTextToSize(c, widths[i] - 2)[0] ?? "", x + 1, y);
        x += widths[i];
      });
      y += 7;
    };
    doc.setFillColor(34, 67, 120);
    doc.setTextColor(255, 255, 255);
    doc.rect(14, y - 5, pageW - 28, 7, "F");
    drawRow(headers, true);
    doc.setTextColor(0, 0, 0);
    exportRows().forEach((row, idx) => {
      if (y > pageH - 12) {
        doc.addPage();
        y = 16;
      }
      if (idx % 2 === 1) {
        doc.setFillColor(241, 245, 249);
        doc.rect(14, y - 5, pageW - 28, 7, "F");
      }
      drawRow(row);
    });
    doc.save(`${fileBase}.pdf`);
  };

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
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCsv}>
                <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handlePdf}>
                <FileText className="h-4 w-4 mr-1" /> PDF
              </Button>
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
                    <TableHead className="text-center">
                      <span className="inline-flex items-center gap-1">
                        <Bell className="h-3.5 w-3.5" /> Notifications
                        {notifLoading && <span className="text-[10px] text-muted-foreground">…</span>}
                      </span>
                    </TableHead>
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
                      <TableCell className="text-center">
                        {r.notificationStatus === "no-account" ? (
                          <span className="text-[11px] text-muted-foreground">Pas de compte</span>
                        ) : r.notificationStatus === "checking" ? (
                          <span className="text-[11px] text-muted-foreground">Vérification…</span>
                        ) : r.notificationStatus === "unavailable" ? (
                          <span className="text-[11px] text-destructive">Statut indisponible</span>
                        ) : (
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            <Badge variant={r.hasPush ? "default" : "outline"} className="gap-1">
                              <Bell className="h-3 w-3" /> {r.hasPush ? "Push actif" : "Push inactif"}
                            </Badge>
                            <Badge variant={r.hasEmail ? "default" : "outline"} className="gap-1">
                              <Mail className="h-3 w-3" /> {r.hasEmail ? "Mail actif" : "Mail inactif"}
                            </Badge>
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
