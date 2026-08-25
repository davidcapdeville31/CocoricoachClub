import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeasonFilteredPlayerIds, makePlayerIdFilter } from "@/hooks/use-season-filtered-players";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3, Repeat, ShieldCheck, CalendarIcon, Activity, Thermometer, Download, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { getExcelBranding, addBrandedHeader, styleDataHeaderRow, addZebraRows, addFooter, downloadWorkbook } from "@/lib/excelExport";
import { preparePdfWithSettings } from "@/lib/pdfExport";

interface InjuryStatsPanelProps {
  categoryId: string;
}

type PeriodKey = "30" | "90" | "180" | "season" | "all" | "custom";

function getPeriodLabels(t: (key: string) => string): Record<PeriodKey, string> {
  return {
    "30": t("health.injuryStatsPanel.periods.last30"),
    "90": t("health.injuryStatsPanel.periods.last90"),
    "180": t("health.injuryStatsPanel.periods.last180"),
    season: t("health.injuryStatsPanel.periods.season"),
    all: t("health.injuryStatsPanel.periods.all"),
    custom: t("health.injuryStatsPanel.periods.custom"),
  };
}

function getPeriodRange(period: PeriodKey, customFrom?: Date, customTo?: Date): { from: Date | null; to: Date } {
  const now = new Date();
  const to = new Date(now);
  if (period === "all") return { from: null, to };
  if (period === "custom") {
    return { from: customFrom ?? null, to: customTo ?? to };
  }
  if (period === "season") {
    const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return { from: new Date(year, 7, 1), to };
  }
  const days = parseInt(period, 10);
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  return { from, to };
}

function classifyInjury(injuryType: string): "musculaire" | "articulaire" | "ligamentaire" | "osseuse" | "tendineuse" | "autre" {
  const t = (injuryType || "").toLowerCase();
  if (/(ligament|lca|lcp|lli|lle|entorse genou)/.test(t)) return "ligamentaire";
  if (/(entorse|luxation|m[ée]niscale|m[ée]nisque|capsul|articul)/.test(t)) return "articulaire";
  if (/(fracture|fissure|os|stress osseux)/.test(t)) return "osseuse";
  if (/(tendin|tendon|aponevros|fasciite)/.test(t)) return "tendineuse";
  if (/(élong|elong|claquage|d[ée]chirure|contusion|muscul|ischio|quadri|mollet|adducteur|psoas|coiffe)/.test(t))
    return "musculaire";
  return "autre";
}

function getTypeLabels(t: (key: string) => string): Record<string, string> {
  return {
    musculaire: t("health.injuryStatsPanel.types.muscular"),
    articulaire: t("health.injuryStatsPanel.types.joint"),
    ligamentaire: t("health.injuryStatsPanel.types.ligament"),
    osseuse: t("health.injuryStatsPanel.types.bone"),
    tendineuse: t("health.injuryStatsPanel.types.tendon"),
    autre: t("health.injuryStatsPanel.types.other"),
  };
}

const TYPE_COLORS: Record<string, string> = {
  musculaire: "bg-orange-500/20 text-orange-700 dark:text-orange-400",
  articulaire: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  ligamentaire: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
  osseuse: "bg-red-500/20 text-red-700 dark:text-red-400",
  tendineuse: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  autre: "bg-muted text-muted-foreground",
};

export function InjuryStatsPanel({ categoryId }: InjuryStatsPanelProps) {
  const { t } = useTranslation();
  const PERIOD_LABELS = useMemo(() => getPeriodLabels(t), [t]);
  const TYPE_LABELS = useMemo(() => getTypeLabels(t), [t]);
  const [period, setPeriod] = useState<PeriodKey>("season");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);
  const { from, to } = useMemo(() => getPeriodRange(period, customFrom, customTo), [period, customFrom, customTo]);

  const { allowedIds } = useSeasonFilteredPlayerIds(categoryId);
  const keepPlayer = makePlayerIdFilter(allowedIds);

  const { data: injuriesRaw } = useQuery({
    queryKey: ["injury-stats", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("injuries")
        .select("id, player_id, injury_type, injury_date, actual_return_date, status, players(name)")
        .eq("category_id", categoryId);
      if (error) throw error;
      return data || [];
    },
  });
  const injuries = useMemo(
    () => (injuriesRaw || []).filter((i: any) => keepPlayer(i.player_id)),
    [injuriesRaw, allowedIds],
  );

  const { data: illnessesRaw } = useQuery({
    queryKey: ["illness-stats", categoryId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("illnesses")
        .select("id, player_id, illness_type, illness_date, actual_return_date, status, players(name)")
        .eq("category_id", categoryId);
      if (error) throw error;
      return (data || []) as any[];
    },
  });
  const illnesses = useMemo(
    () => (illnessesRaw || []).filter((i: any) => keepPlayer(i.player_id)),
    [illnessesRaw, allowedIds],
  );

  const { data: playersCountRaw } = useQuery({
    queryKey: ["injury-stats-players-count", categoryId, !!allowedIds],
    queryFn: async () => {
      if (allowedIds) return allowedIds.size;
      const { count, error } = await supabase
        .from("players")
        .select("id", { count: "exact", head: true })
        .eq("category_id", categoryId);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const playersCount = playersCountRaw;

  const stats = useMemo(() => {
    const list = (injuries || []).filter((i: any) => {
      const d = new Date(i.injury_date);
      if (from && d < from) return false;
      if (d > to) return false;
      return true;
    });

    const counts: Record<string, number> = {};
    for (const i of list) {
      const cat = classifyInjury(i.injury_type);
      counts[cat] = (counts[cat] || 0) + 1;
    }
    const total = list.length;
    const distribution = Object.entries(counts)
      .map(([key, n]) => ({ key, n, pct: total ? (n / total) * 100 : 0 }))
      .sort((a, b) => b.n - a.n);

    const grouped = new Map<string, { player: string; type: string; count: number }>();
    for (const i of list) {
      const key = `${i.player_id}::${(i.injury_type || "").toLowerCase().trim()}`;
      const playerName = (i as any).players?.name || "Athlète";
      const cur = grouped.get(key);
      if (cur) cur.count += 1;
      else grouped.set(key, { player: playerName, type: i.injury_type, count: 1 });
    }
    const relapses = Array.from(grouped.values())
      .filter((g) => g.count >= 2)
      .sort((a, b) => b.count - a.count);

    const durations: number[] = [];
    for (const i of list) {
      const start = new Date(i.injury_date);
      const end = i.actual_return_date ? new Date(i.actual_return_date) : to;
      const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      durations.push(days);
    }
    const avgDuration = durations.length
      ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
      : 0;

    // Illnesses on same period
    const illList = (illnesses || []).filter((i: any) => {
      const d = new Date(i.illness_date);
      if (from && d < from) return false;
      if (d > to) return false;
      return true;
    });
    const illTotal = illList.length;
    const illDurations: number[] = [];
    for (const i of illList) {
      const start = new Date(i.illness_date);
      const end = i.actual_return_date ? new Date(i.actual_return_date) : to;
      illDurations.push(Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))));
    }
    const illAvgDuration = illDurations.length
      ? Math.round(illDurations.reduce((s, d) => s + d, 0) / illDurations.length)
      : 0;

    const allDates = [
      ...list.map((i: any) => new Date(i.injury_date).getTime()),
      ...illList.map((i: any) => new Date(i.illness_date).getTime()),
      to.getTime(),
    ];
    const windowStart = from ?? new Date(Math.min(...allDates));
    const windowDays = Math.max(1, Math.round((to.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24)));
    let injuryDays = 0;
    for (const i of list) {
      const s = new Date(i.injury_date);
      const e = i.actual_return_date ? new Date(i.actual_return_date) : to;
      const start = s < windowStart ? windowStart : s;
      const end = e > to ? to : e;
      injuryDays += Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    }
    let illnessDays = 0;
    for (const i of illList) {
      const s = new Date(i.illness_date);
      const e = i.actual_return_date ? new Date(i.actual_return_date) : to;
      const start = s < windowStart ? windowStart : s;
      const end = e > to ? to : e;
      illnessDays += Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    }
    const unavailableDays = injuryDays + illnessDays;
    const denom = windowDays * Math.max(1, playersCount || 0);
    const availabilityPct = playersCount && denom > 0 ? Math.max(0, Math.min(100, 100 - (unavailableDays / denom) * 100)) : 100;

    return { total, distribution, relapses, avgDuration, availabilityPct, injuryDays, illnessDays, illTotal, illAvgDuration };
  }, [injuries, illnesses, from, to, playersCount]);

  const periodLabel =
    period === "custom"
      ? customFrom && customTo
        ? t("health.injuryStatsPanel.customPeriodRange", { from: format(customFrom, "dd/MM/yyyy"), to: format(customTo, "dd/MM/yyyy") })
        : t("health.injuryStatsPanel.customPeriodLabel")
      : PERIOD_LABELS[period];

  const filteredInjuries = useMemo(
    () =>
      (injuries || []).filter((i: any) => {
        const d = new Date(i.injury_date);
        if (from && d < from) return false;
        if (d > to) return false;
        return true;
      }),
    [injuries, from, to]
  );
  const filteredIllnesses = useMemo(
    () =>
      (illnesses || []).filter((i: any) => {
        const d = new Date(i.illness_date);
        if (from && d < from) return false;
        if (d > to) return false;
        return true;
      }),
    [illnesses, from, to]
  );

  const fmtDate = (d?: string | null) => (d ? format(new Date(d), "dd/MM/yyyy") : "-");
  const daysBetween = (start: string, end?: string | null) => {
    const s = new Date(start);
    const e = end ? new Date(end) : to;
    return Math.max(0, Math.round((e.getTime() - s.getTime()) / 86400000));
  };

  const handleExportExcel = async () => {
    try {
      const branding = await getExcelBranding(categoryId);
      const wb = new ExcelJS.Workbook();

      // Sheet 1: Résumé
      const ws0 = wb.addWorksheet(t("health.injuryStatsPanel.excel.sheetSummary"));
      ws0.columns = [{ width: 32 }, { width: 22 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }];
      const r0 = addBrandedHeader(ws0, t("health.injuryStatsPanel.excel.title"), branding, [
        [t("health.injuryStatsPanel.excel.period"), periodLabel],
      ]);
      styleDataHeaderRow(ws0, r0, 2, branding.headerColor);
      ws0.getRow(r0).values = [t("health.injuryStatsPanel.excel.indicator"), t("health.injuryStatsPanel.excel.value")];
      const summary: [string, string | number][] = [
        [t("health.injuryStatsPanel.excel.availability"), `${stats.availabilityPct.toFixed(1)}%`],
        [t("health.injuryStatsPanel.excel.injuryDays"), stats.injuryDays],
        [t("health.injuryStatsPanel.excel.injuryCount"), stats.total],
        [t("health.injuryStatsPanel.excel.avgInjuryDuration"), stats.avgDuration],
        [t("health.injuryStatsPanel.excel.illnessDays"), stats.illnessDays],
        [t("health.injuryStatsPanel.excel.illnessCount"), stats.illTotal],
        [t("health.injuryStatsPanel.excel.avgIllnessDuration"), stats.illAvgDuration],
        [t("health.injuryStatsPanel.excel.relapsesDetected"), stats.relapses.length],
      ];
      summary.forEach((row, i) => {
        const r = ws0.getRow(r0 + 1 + i);
        r.values = row;
      });
      addZebraRows(ws0, r0 + 1, r0 + summary.length, 2);

      // Sheet 2: Répartition
      if (stats.distribution.length > 0) {
        const wsR = wb.addWorksheet(t("health.injuryStatsPanel.excel.sheetDistribution"));
        wsR.columns = [{ width: 24 }, { width: 14 }, { width: 14 }];
        const sr = addBrandedHeader(wsR, t("health.injuryStatsPanel.excel.distributionTitle"), branding);
        styleDataHeaderRow(wsR, sr, 3, branding.headerColor);
        wsR.getRow(sr).values = [t("health.injuryStatsPanel.excel.type"), t("health.injuryStatsPanel.excel.number"), "%"];
        stats.distribution.forEach((d, i) => {
          wsR.getRow(sr + 1 + i).values = [TYPE_LABELS[d.key] || d.key, d.n, `${d.pct.toFixed(1)}%`];
        });
        addZebraRows(wsR, sr + 1, sr + stats.distribution.length, 3);
      }

      // Sheet 3: Blessures
      if (filteredInjuries.length > 0) {
        const ws1 = wb.addWorksheet(t("health.injuryStatsPanel.excel.sheetInjuries"));
        ws1.columns = [
          { width: 24 }, { width: 28 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 14 },
        ];
        const sr = addBrandedHeader(ws1, t("health.injuryStatsPanel.excel.injuriesDetailTitle"), branding);
        styleDataHeaderRow(ws1, sr, 6, branding.headerColor);
        ws1.getRow(sr).values = [t("health.injuryStatsPanel.excel.athlete"), t("health.injuryStatsPanel.excel.type"), t("health.injuryStatsPanel.excel.category"), t("health.injuryStatsPanel.excel.date"), t("health.injuryStatsPanel.excel.returnDate"), t("health.injuryStatsPanel.excel.durationDays")];
        filteredInjuries.forEach((i: any, idx: number) => {
          ws1.getRow(sr + 1 + idx).values = [
            i.players?.name || "-",
            i.injury_type || "-",
            TYPE_LABELS[classifyInjury(i.injury_type)] || "-",
            fmtDate(i.injury_date),
            fmtDate(i.actual_return_date),
            daysBetween(i.injury_date, i.actual_return_date),
          ];
        });
        addZebraRows(ws1, sr + 1, sr + filteredInjuries.length, 6);
      }

      // Sheet 4: Maladies
      if (filteredIllnesses.length > 0) {
        const ws2 = wb.addWorksheet(t("health.injuryStatsPanel.excel.sheetIllnesses"));
        ws2.columns = [
          { width: 24 }, { width: 28 }, { width: 14 }, { width: 14 }, { width: 14 },
        ];
        const sr = addBrandedHeader(ws2, t("health.injuryStatsPanel.excel.illnessesDetailTitle"), branding);
        styleDataHeaderRow(ws2, sr, 5, branding.headerColor);
        ws2.getRow(sr).values = [t("health.injuryStatsPanel.excel.athlete"), t("health.injuryStatsPanel.excel.type"), t("health.injuryStatsPanel.excel.date"), t("health.injuryStatsPanel.excel.returnDate"), t("health.injuryStatsPanel.excel.durationDays")];
        filteredIllnesses.forEach((i: any, idx: number) => {
          ws2.getRow(sr + 1 + idx).values = [
            i.players?.name || "-",
            i.illness_type || "-",
            fmtDate(i.illness_date),
            fmtDate(i.actual_return_date),
            daysBetween(i.illness_date, i.actual_return_date),
          ];
        });
        addZebraRows(ws2, sr + 1, sr + filteredIllnesses.length, 5);
      }

      // Sheet 5: Rechutes
      if (stats.relapses.length > 0) {
        const ws3 = wb.addWorksheet(t("health.injuryStatsPanel.excel.sheetRelapses"));
        ws3.columns = [{ width: 24 }, { width: 28 }, { width: 14 }];
        const sr = addBrandedHeader(ws3, t("health.injuryStatsPanel.excel.relapsesTitle"), branding);
        styleDataHeaderRow(ws3, sr, 3, branding.headerColor);
        ws3.getRow(sr).values = [t("health.injuryStatsPanel.excel.athlete"), t("health.injuryStatsPanel.excel.injury"), t("health.injuryStatsPanel.excel.occurrences")];
        stats.relapses.forEach((r, i) => {
          ws3.getRow(sr + 1 + i).values = [r.player, r.type, r.count];
        });
        addZebraRows(ws3, sr + 1, sr + stats.relapses.length, 3);
      }

      addFooter(ws0, r0 + summary.length + 1, 2, branding.footerText);
      await downloadWorkbook(wb, `stats-blessures-maladies-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast.success(t("health.injuryStatsPanel.excel.toastSuccess"));
    } catch (e) {
      console.error(e);
      toast.error(t("health.injuryStatsPanel.excel.toastError"));
    }
  };

  const handleExportPdf = async () => {
    try {
      const { settings, clubName, categoryName, seasonName } = await preparePdfWithSettings(categoryId);
      const doc = new jsPDF({ orientation: "portrait" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      // Header
      const hc = (settings?.header_color || "#224378").replace("#", "");
      doc.setFillColor(parseInt(hc.substring(0, 2), 16), parseInt(hc.substring(2, 4), 16), parseInt(hc.substring(4, 6), 16));
      doc.rect(0, 0, pageW, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15);
      doc.text(t("health.injuryStatsPanel.pdf.title"), 14, 12);
      doc.setFontSize(9);
      doc.text(`${clubName || ""} • ${categoryName || ""} • ${seasonName || ""}`, 14, 19);
      doc.text(t("health.injuryStatsPanel.pdf.period", { period: periodLabel }), 14, 25);
      doc.text(format(new Date(), "dd/MM/yyyy"), pageW - 14, 25, { align: "right" });

      let y = 36;
      const ensure = (need: number) => {
        if (y + need > pageH - 12) { doc.addPage(); y = 15; }
      };
      const section = (title: string) => {
        ensure(10);
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(title, 14, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
      };
      const drawRow = (cells: string[], cols: number[]) => {
        ensure(7);
        doc.setTextColor(30, 41, 59);
        cells.forEach((c, i) => doc.text(c.substring(0, 40), cols[i], y + 4));
        y += 6;
      };
      const drawHeader = (cells: string[], cols: number[]) => {
        ensure(9);
        doc.setFillColor(241, 245, 249);
        doc.rect(14, y, pageW - 28, 7, "F");
        doc.setFont("helvetica", "bold");
        cells.forEach((c, i) => doc.text(c, cols[i], y + 5));
        y += 8;
        doc.setFont("helvetica", "normal");
      };

      // Résumé
      section(t("health.injuryStatsPanel.pdf.keyIndicators"));
      const kpis: [string, string][] = [
        [t("health.injuryStatsPanel.pdf.availability"), `${stats.availabilityPct.toFixed(1)}%`],
        [t("health.injuryStatsPanel.pdf.injuryUnavailability"), t("health.injuryStatsPanel.pdf.injuryUnavailabilityValue", { days: stats.injuryDays, count: stats.total, avg: stats.avgDuration })],
        [t("health.injuryStatsPanel.pdf.illnessUnavailability"), t("health.injuryStatsPanel.pdf.illnessUnavailabilityValue", { days: stats.illnessDays, count: stats.illTotal, avg: stats.illAvgDuration })],
        [t("health.injuryStatsPanel.pdf.relapsesDetected"), String(stats.relapses.length)],
      ];
      kpis.forEach(([k, v]) => drawRow([k, v], [16, 90]));
      y += 4;

      // Répartition
      if (stats.distribution.length > 0) {
        section(t("health.injuryStatsPanel.pdf.distributionTitle"));
        drawHeader([t("health.injuryStatsPanel.pdf.type"), t("health.injuryStatsPanel.pdf.number"), "%"], [16, 90, 130]);
        stats.distribution.forEach((d) => drawRow([TYPE_LABELS[d.key] || d.key, String(d.n), `${d.pct.toFixed(1)}%`], [16, 90, 130]));
        y += 4;
      }

      // Blessures
      if (filteredInjuries.length > 0) {
        section(t("health.injuryStatsPanel.pdf.injuriesDetailTitle"));
        drawHeader([t("health.injuryStatsPanel.pdf.athlete"), t("health.injuryStatsPanel.pdf.type"), t("health.injuryStatsPanel.pdf.date"), t("health.injuryStatsPanel.pdf.returnDate"), t("health.injuryStatsPanel.pdf.duration")], [16, 70, 125, 150, 180]);
        filteredInjuries.forEach((i: any) =>
          drawRow(
            [
              i.players?.name || "-",
              (i.injury_type || "-").substring(0, 28),
              fmtDate(i.injury_date),
              fmtDate(i.actual_return_date),
              t("health.injuryStatsPanel.pdf.durationValue", { days: daysBetween(i.injury_date, i.actual_return_date) }),
            ],
            [16, 70, 125, 150, 180]
          )
        );
        y += 4;
      }

      // Maladies
      if (filteredIllnesses.length > 0) {
        section(t("health.injuryStatsPanel.pdf.illnessesDetailTitle"));
        drawHeader([t("health.injuryStatsPanel.pdf.athlete"), t("health.injuryStatsPanel.pdf.type"), t("health.injuryStatsPanel.pdf.date"), t("health.injuryStatsPanel.pdf.returnDate"), t("health.injuryStatsPanel.pdf.duration")], [16, 70, 125, 150, 180]);
        filteredIllnesses.forEach((i: any) =>
          drawRow(
            [
              i.players?.name || "-",
              (i.illness_type || "-").substring(0, 28),
              fmtDate(i.illness_date),
              fmtDate(i.actual_return_date),
              t("health.injuryStatsPanel.pdf.durationValue", { days: daysBetween(i.illness_date, i.actual_return_date) }),
            ],
            [16, 70, 125, 150, 180]
          )
        );
        y += 4;
      }

      // Rechutes
      if (stats.relapses.length > 0) {
        section(t("health.injuryStatsPanel.pdf.relapsesTitle"));
        drawHeader([t("health.injuryStatsPanel.pdf.athlete"), t("health.injuryStatsPanel.excel.injury"), t("health.injuryStatsPanel.excel.occurrences")], [16, 90, 160]);
        stats.relapses.forEach((r) => drawRow([r.player, r.type.substring(0, 30), t("health.injuryStatsPanel.pdf.occurrencesValue", { count: r.count })], [16, 90, 160]));
      }

      doc.save(`stats-blessures-maladies-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success(t("health.injuryStatsPanel.pdf.toastSuccess"));
    } catch (e) {
      console.error(e);
      toast.error(t("health.injuryStatsPanel.pdf.toastError"));
    }
  };

  return (
    <Card className="bg-gradient-card shadow-md">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            {t("health.injuryStatsPanel.title")}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">{t("health.injuryStatsPanel.excelButton")}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} className="gap-1">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">{t("health.injuryStatsPanel.pdfButton")}</span>
            </Button>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {PERIOD_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {period === "custom" && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[160px] justify-start text-left font-normal",
                        !customFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customFrom ? format(customFrom, "dd/MM/yyyy") : t("health.injuryStatsPanel.fromPlaceholder")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customFrom}
                      onSelect={setCustomFrom}
                      locale={getDateLocale()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[160px] justify-start text-left font-normal",
                        !customTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customTo ? format(customTo, "dd/MM/yyyy") : t("health.injuryStatsPanel.toPlaceholder")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customTo}
                      onSelect={setCustomTo}
                      locale={getDateLocale()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-surface">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("health.injuryStatsPanel.kpis.availability")}</CardTitle>
              <ShieldCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.availabilityPct.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("health.injuryStatsPanel.kpis.overPeriod", { period: periodLabel })}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-surface">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("health.injuryStatsPanel.kpis.injuryUnavailability")}</CardTitle>
              <Activity className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.injuryDays} j</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("health.injuryStatsPanel.kpis.teamTotalInjuries", { count: stats.total, plural: stats.total > 1 ? "s" : "", avg: stats.avgDuration })}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-surface">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("health.injuryStatsPanel.kpis.illnessUnavailability")}</CardTitle>
              <Thermometer className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{stats.illnessDays} j</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("health.injuryStatsPanel.kpis.teamTotalIllnesses", { count: stats.illTotal, plural: stats.illTotal > 1 ? "s" : "", avg: stats.illAvgDuration })}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-surface">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("health.injuryStatsPanel.kpis.relapsesDetected")}</CardTitle>
              <Repeat className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.relapses.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("health.injuryStatsPanel.kpis.relapsesHint")}
              </p>
            </CardContent>
          </Card>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-3">{t("health.injuryStatsPanel.distributionTitle")}</h3>
          {stats.total === 0 ? (
            <p className="text-sm text-muted-foreground">{t("health.injuryStatsPanel.noInjuriesInPeriod")}</p>
          ) : (
            <div className="space-y-2">
              {stats.distribution.map(({ key, n, pct }) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge className={TYPE_COLORS[key]}>{TYPE_LABELS[key] || key}</Badge>
                      <span className="text-muted-foreground">
                        {t("health.injuryStatsPanel.injuriesCount", { count: n, plural: n > 1 ? "s" : "" })}
                      </span>
                    </div>
                    <span className="font-semibold">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Repeat className="h-4 w-4" />
            {t("health.injuryStatsPanel.relapsesDetailTitle")}
          </h3>
          {stats.relapses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("health.injuryStatsPanel.noRelapses")}
            </p>
          ) : (
            <div className="space-y-2">
              {stats.relapses.map((r, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface border"
                >
                  <div>
                    <div className="font-medium">{r.player}</div>
                    <div className="text-sm text-muted-foreground">{r.type}</div>
                  </div>
                  <Badge variant="destructive">{t("health.injuryStatsPanel.relapsesOnPeriod", { count: r.count })}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
