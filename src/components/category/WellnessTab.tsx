import { useState, useMemo, useEffect, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { subDays } from "date-fns";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { supabase } from "@/integrations/supabase/client";
import { useSeasonFilteredPlayerIds, makePlayerIdFilter } from "@/hooks/use-season-filtered-players";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ColoredSubTabsList, ColoredSubTabsTrigger } from "@/components/ui/colored-subtabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, AlertTriangle, Calendar, X, Settings2, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AddWellnessDialog } from "./AddWellnessDialog";
import { WellnessReminderButton } from "./wellness/WellnessReminderButton";
import { WellnessScheduleConfig } from "./wellness/WellnessScheduleConfig";
import { WellnessQuestionsEditor } from "./wellness/WellnessQuestionsEditor";
import { PainConfigEditor } from "./wellness/PainConfigEditor";
import { InjuryRiskAssessment } from "./InjuryRiskAssessment";
import { MenstrualCycleSection } from "./MenstrualCycleSection";
import { WellnessPainStats } from "./WellnessPainStats";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";
import { useMenuPermissions } from "@/hooks/useMenuPermissions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { sleepScoreLabel } from "@/lib/sleepConversion";
import { usePainConfig, DEFAULT_PAIN_CONFIG, useWellnessQuestions, DEFAULT_WELLNESS_QUESTIONS, type WellnessQuestion } from "@/lib/wellness/questionConfig";
import { generateCsv, downloadCsv } from "@/lib/csv";


interface WellnessTabProps {
  categoryId: string;
  /** Restrict view to a single section. When omitted, all sub-tabs are shown. */
  view?: "tracking" | "pain-stats" | "risk";
}

const getScoreBadgeClass = (score: number) => {
  if (score <= 2) return "bg-status-optimal/15 text-status-optimal border-status-optimal/30";
  if (score <= 3) return "bg-status-attention/15 text-status-attention border-status-attention/30";
  return "bg-status-critical/15 text-status-critical border-status-critical/30";
};

/** Build an inline style from a customizable pain scale color (hsl(...) string). */
const getScaleStyle = (color: string | undefined): CSSProperties => {
  if (!color) return {};
  return {
    backgroundColor: `color-mix(in hsl, ${color} 18%, transparent)`,
    color,
    borderColor: `color-mix(in hsl, ${color} 45%, transparent)`,
  };
};

/** Parse a yyyy-MM-dd string into a local Date (avoids UTC shift). */
const parseLocalDate = (value: string | null): Date | undefined => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export function WellnessTab({ categoryId, view }: WellnessTabProps) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const urlWellnessDate = searchParams.get("wellnessDate");
  const initialDate = parseLocalDate(urlWellnessDate) || new Date();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [filterFrom, setFilterFrom] = useState<Date | undefined>(initialDate);
  const [filterTo, setFilterTo] = useState<Date | undefined>(initialDate);
  const [filterPlayerId, setFilterPlayerId] = useState<string>("all");
  const { isViewer } = useViewerModeContext();

  // Sync filters when arriving from a notification link (?wellnessDate=YYYY-MM-DD)
  useEffect(() => {
    const d = parseLocalDate(urlWellnessDate);
    if (d) {
      setFilterFrom(d);
      setFilterTo(d);
      setFilterPlayerId("all");
    }
  }, [urlWellnessDate]);

  // Fetch clubId so useMenuPermissions can detect club-level roles
  // (e.g. doctor / prepa_physique stored at club level, not category level).
  const { data: categoryClub } = useQuery({
    queryKey: ["wellness-category-club", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("club_id")
        .eq("id", categoryId)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const { userRole } = useMenuPermissions(categoryClub?.club_id, categoryId);

  // Global Radix pointer-events:none lock recovery is handled in App via
  // useRadixPointerEventsGuard.




  // Only Coach, Préparateur physique and Médecin (+ owners/super_admin) can customize.
  const STAFF_ROLES = new Set([
    "owner",
    "super_admin",
    "coach",
    "prepa_physique",
    "doctor",
  ]);
  const canCustomize = !!userRole && STAFF_ROLES.has(userRole);


  useRealtimeSync({
    tables: ["wellness_tracking"],
    categoryId,
    queryKeys: [
      ["wellness_tracking", categoryId],
      ["wellness_decision", categoryId],
    ],
    channelName: `wellness-sync-${categoryId}`,
  });

  const { data: category } = useQuery({
    queryKey: ["category", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("gender")
        .eq("id", categoryId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const isFeminine = category?.gender === "feminine";

  const { data: painConfig } = usePainConfig(categoryId);
  const { data: wellnessQuestions } = useWellnessQuestions(categoryId);
  const activeQuestions = (wellnessQuestions ?? DEFAULT_WELLNESS_QUESTIONS).filter((q) => q.enabled);

  // Fetch wellness schedule to highlight planned days in date pickers
  const { data: wellnessSchedule } = useQuery({
    queryKey: ["wellness_schedule", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_schedules")
        .select("days_of_week")
        .eq("category_id", categoryId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const plannedDays = useMemo(() => {
    const days = wellnessSchedule?.days_of_week as number[] | undefined;
    if (!days || days.length === 0) return [];
    return days.map((d) => Number(d));
  }, [wellnessSchedule]);

  const isWellnessPlanned = (date: Date) => plannedDays.includes(date.getDay());

  /** Read the answer for a question: standard columns or custom_answers JSON. */
  const getAnswer = (entry: any, q: WellnessQuestion): number | null => {
    const raw = q.is_custom ? entry?.custom_answers?.[q.key] : entry?.[q.key];
    return raw == null ? null : Number(raw);
  };

  const scale = (painConfig ?? DEFAULT_PAIN_CONFIG).scale;
  /** Look up the configured color for an integer score 1..5 (lower = better, e.g. fatigue, stress, soreness, pain). */
  const styleFor = (value: number | null | undefined) => {
    if (value == null) return {} as CSSProperties;
    const rounded = Math.max(1, Math.min(5, Math.round(value)));
    return getScaleStyle(scale.find((s) => s.value === rounded)?.color);
  };
  /** Positive scale 1..5 (higher = better, e.g. sleep quality, sleep duration).
   *  We invert the value to look up the right color on the pain scale. */
  const styleForPositive = (value: number | null | undefined) => {
    if (value == null) return {} as CSSProperties;
    const rounded = Math.max(1, Math.min(5, Math.round(value)));
    const inverted = 6 - rounded; // 5→1 (best→green), 1→5 (worst→red)
    return getScaleStyle(scale.find((s) => s.value === inverted)?.color);
  };
  /** Color a question answer using its OWN scale bounds + orientation.
   *  Works for 0..5 custom questions (0 = aucun symptôme → vert). */

  const styleForQuestion = (q: WellnessQuestion, value: number | null | undefined) => {
    if (value == null) return {} as CSSProperties;
    // sleep_duration is ALWAYS stored as a 1-5 score where 1 = >8h (optimal)
    // and 5 = <5h (worst), whatever the display scale configured by the coach.
    if (q.is_sleep_duration) return styleFor(value);
    // 1) Respect the colour configured by the coach for this exact value
    const exact = (q.scale ?? []).find((s) => Number(s.value) === Math.round(value));
    if (exact?.color) return getScaleStyle(exact.color);
    // 2) Fallback: normalise on the question's own bounds + orientation
    const values = (q.scale ?? []).map((s) => s.value).filter((n) => Number.isFinite(n));
    const min = values.length ? Math.min(...values) : 1;
    const max = values.length ? Math.max(...values) : 5;
    if (max === min) return {} as CSSProperties;
    const clamped = Math.max(min, Math.min(max, value));
    const isInverted = q.inverted;
    const ratio = isInverted ? (clamped - min) / (max - min) : (max - clamped) / (max - min);
    return styleFor(1 + ratio * 4);
  };





  const { allowedIds } = useSeasonFilteredPlayerIds(categoryId);
  const keepPlayer = makePlayerIdFilter(allowedIds);

  const { data: wellnessDataRaw, isLoading } = useQuery({
    queryKey: ["wellness_tracking", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_tracking")
        .select("*, players(name, first_name)")
        .eq("category_id", categoryId)
        .order("tracking_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const wellnessData = useMemo(
    () => (wellnessDataRaw || []).filter((e: any) => keepPlayer(e.player_id)),
    [wellnessDataRaw, allowedIds],
  );

  if (isLoading) {
    return <div className="text-muted-foreground">{t("health.wellness.loading")}</div>;
  }

  const calculateWellnessScore = (entry: any) => {
    // Each question can have its own scale (0..5, 1..5, custom) and its own
    // orientation (higher = better for sleep, higher = worse for fatigue).
    // We normalise every answer to a 0..1 "concern" ratio using its own
    // min/max bounds, then map the average back onto the 1..5 display scale.
    const ratios: number[] = [];
    for (const q of activeQuestions) {
      const v = getAnswer(entry, q);
      if (v == null) continue;
      // sleep_duration: always a 1-5 score, 1 = >8h (optimal) → 5 = <5h (worst)
      if (q.is_sleep_duration) {
        const s = Math.max(1, Math.min(5, v));
        ratios.push((s - 1) / 4);
        continue;
      }
      const values = (q.scale ?? []).map((s) => s.value).filter((n) => Number.isFinite(n));
      const min = values.length ? Math.min(...values) : 1;
      const max = values.length ? Math.max(...values) : 5;
      if (max === min) continue;
      const clamped = Math.max(min, Math.min(max, v));
      const ratio = q.inverted
        ? (clamped - min) / (max - min) // high value = high concern
        : (max - clamped) / (max - min); // high value = low concern
      ratios.push(ratio);
    }
    if (ratios.length === 0) return "0.0";
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    return (1 + avg * 4).toFixed(1); // 1 = optimal, 5 = très dégradé
  };


  // Filter wellness data by date range
  const fromStr = filterFrom ? format(filterFrom, "yyyy-MM-dd") : null;
  const toStr = filterTo ? format(filterTo, "yyyy-MM-dd") : null;
  const filteredWellnessData = wellnessData
    ?.filter(entry => {
      if (fromStr && entry.tracking_date < fromStr) return false;
      if (toStr && entry.tracking_date > toStr) return false;
      if (filterPlayerId !== "all" && entry.player_id !== filterPlayerId) return false;
      return true;
    })
    // Most recent date first, then real answers before auto-filled ones, then name
    .sort((a: any, b: any) => {
      if (a.tracking_date !== b.tracking_date) return a.tracking_date < b.tracking_date ? 1 : -1;
      const autoA = a.auto_filled ? 1 : 0;
      const autoB = b.auto_filled ? 1 : 0;
      if (autoA !== autoB) return autoA - autoB;
      const nameA = [a.players?.first_name, a.players?.name].filter(Boolean).join(" ");
      const nameB = [b.players?.first_name, b.players?.name].filter(Boolean).join(" ");
      return nameA.localeCompare(nameB);
    });


  // Unique players list from wellness data for the dropdown
  const playersList = Array.from(
    new Map(
      (wellnessData || [])
        .filter(e => e.player_id && e.players)
        .map(e => [e.player_id, { id: e.player_id as string, label: [e.players?.first_name, e.players?.name].filter(Boolean).join(" ") }])
    ).values()
  ).sort((a, b) => a.label.localeCompare(b.label));

  const hasActiveFilter = !!filterFrom || !!filterTo || filterPlayerId !== "all";

  const handleExportCsv = () => {
    const rows = (filteredWellnessData || []).map((entry: any) => [
      [entry.players?.first_name, entry.players?.name].filter(Boolean).join(" "),
      format(new Date(entry.tracking_date), "dd/MM/yyyy"),
      ...activeQuestions.map((q) => {
        const raw = getAnswer(entry, q);
        if (raw == null) return "";
        return q.is_sleep_duration ? sleepScoreLabel(raw) : String(raw);
      }),
      calculateWellnessScore(entry).replace(".", ","),
      entry.has_specific_pain ? (entry.pain_location || t("health.wellness.csv.yes")) : t("health.wellness.csv.no"),
    ]);
    const headers = [
      t("health.wellness.csv.player"),
      t("health.wellness.csv.date"),
      ...activeQuestions.map((q) => q.label),
      t("health.wellness.csv.averageScore"),
      t("health.wellness.csv.specificPain"),
    ];
    const period = [
      filterFrom ? format(filterFrom, "yyyy-MM-dd") : null,
      filterTo ? format(filterTo, "yyyy-MM-dd") : null,
    ].filter(Boolean).join("_");
    downloadCsv(`wellness${period ? `_${period}` : ""}.csv`, generateCsv(headers, rows));
  };


  return (
    <div className="space-y-6">
      <Tabs value={view ?? undefined} defaultValue={view ?? "tracking"} className="space-y-4">
        {!view && (
          <div className="flex justify-center overflow-x-auto -mx-4 px-4 pb-2">
            <ColoredSubTabsList colorKey="sante" className="inline-flex w-max">
              <ColoredSubTabsTrigger value="tracking" colorKey="sante">{t("health.wellness.tabs.tracking")}</ColoredSubTabsTrigger>
              <ColoredSubTabsTrigger value="pain-stats" colorKey="sante">{t("health.wellness.tabs.painStats")}</ColoredSubTabsTrigger>
              <ColoredSubTabsTrigger value="risk" colorKey="sante">{t("health.wellness.tabs.risk")}</ColoredSubTabsTrigger>
              {isFeminine && (
                <ColoredSubTabsTrigger value="menstrual" colorKey="sante">{t("health.wellness.tabs.menstrual")}</ColoredSubTabsTrigger>
              )}
            </ColoredSubTabsList>
          </div>
        )}

        <TabsContent value="tracking" className="space-y-4">
          {canCustomize && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setIsCustomizeOpen(true)}
                title={t("health.wellness.customizeTooltip")}
              >
                <Settings2 className="h-4 w-4 mr-2" />
                {t("health.wellness.customizeButton")}
              </Button>
            </div>
          )}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>{t("health.wellness.cardTitle")}</CardTitle>
                  <CardDescription>
                    {t("health.wellness.cardDescription")}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Player filter */}
                  <Select value={filterPlayerId} onValueChange={setFilterPlayerId}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder={t("health.wellness.allAthletes")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("health.wellness.allAthletes")}</SelectItem>
                      {playersList.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Date range: from */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !filterFrom && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {filterFrom ? format(filterFrom, "dd MMM yyyy", { locale: fr }) : t("health.wellness.startDate")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <CalendarComponent
                        mode="single"
                        selected={filterFrom}
                        onSelect={setFilterFrom}
                        locale={fr}
                        initialFocus
                        className="p-3 pointer-events-auto"
                        modifiers={{ wellnessPlanned: isWellnessPlanned }}
                        modifiersClassNames={{ wellnessPlanned: "relative after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:h-1.5 after:w-1.5 after:rounded-full after:bg-primary" }}
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-sm text-muted-foreground">{t("health.wellness.to")}</span>
                  {/* Date range: to */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !filterTo && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {filterTo ? format(filterTo, "dd MMM yyyy", { locale: fr }) : t("health.wellness.endDate")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <CalendarComponent
                        mode="single"
                        selected={filterTo}
                        onSelect={setFilterTo}
                        locale={fr}
                        initialFocus
                        className="p-3 pointer-events-auto"
                        modifiers={{ wellnessPlanned: isWellnessPlanned }}
                        modifiersClassNames={{ wellnessPlanned: "relative after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:h-1.5 after:w-1.5 after:rounded-full after:bg-primary" }}
                      />
                    </PopoverContent>
                  </Popover>
                  {hasActiveFilter && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setFilterFrom(undefined); setFilterTo(undefined); setFilterPlayerId("all"); }}
                      title={t("health.wellness.clearFilters")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleExportCsv}
                    disabled={!filteredWellnessData || filteredWellnessData.length === 0}
                    title={t("health.wellness.exportCsvTooltip")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {t("health.wellness.exportCsv")}
                  </Button>
                  {!isViewer && (

                    <>
                      <WellnessReminderButton categoryId={categoryId} />
                      <Button onClick={() => setIsDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        {t("health.wellness.newEntry")}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
        {!filteredWellnessData || filteredWellnessData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>{hasActiveFilter ? t("health.wellness.emptyFiltered") : t("health.wellness.emptyNone")}</p>
            {!isViewer && !hasActiveFilter && (
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setIsDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("health.wellness.addFirstEntry")}
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">{t("health.wellness.table.player")}</TableHead>
                    <TableHead className="whitespace-nowrap">{t("health.wellness.table.date")}</TableHead>
                    {activeQuestions.map((q) => (
                      <TableHead key={q.key} className="text-center whitespace-nowrap">
                        {q.emoji ? `${q.emoji} ` : ""}{q.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-center whitespace-nowrap">{t("health.wellness.table.averageScore")}</TableHead>
                    <TableHead className="whitespace-nowrap">{t("health.wellness.table.specificPain")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWellnessData.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          {[entry.players?.first_name, entry.players?.name].filter(Boolean).join(" ")}
                          {entry.auto_filled && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              {t("health.wellness.table.auto")}
                            </Badge>
                          )}
                        </span>
                      </TableCell>

                      <TableCell className="whitespace-nowrap">
                        {format(new Date(entry.tracking_date), "dd MMM yyyy", { locale: fr })}
                      </TableCell>

                      {activeQuestions.map((q) => {
                        const raw = getAnswer(entry, q);
                        return (
                          <TableCell key={q.key} className="text-center">
                            {raw == null ? (
                              <span className="text-muted-foreground text-sm">—</span>
                            ) : (
                              <Badge
                                variant="outline"
                                style={styleForQuestion(q, raw)}
                              >
                                {q.is_sleep_duration ? sleepScoreLabel(raw) : raw}
                              </Badge>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center">
                        <Badge variant="outline" style={styleFor(parseFloat(calculateWellnessScore(entry)))}>
                          {calculateWellnessScore(entry)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {entry.has_specific_pain ? (
                          <div className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm">{entry.pain_location || t("health.wellness.table.yes")}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">{t("health.wellness.table.no")}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">{t("health.wellness.legend.title")}</h4>
              <div className="flex flex-wrap gap-3 text-sm">
                {scale.map((s) => (
                  <div key={s.value} className="flex items-center gap-2">
                    <Badge variant="outline" style={getScaleStyle(s.color)}>{s.value}</Badge>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {t("health.wellness.legend.explanation")}
              </p>
              {activeQuestions.some((q) => !q.inverted && !q.is_sleep_duration) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("health.wellness.legend.positiveQuestions")}{" "}
                  {activeQuestions.filter((q) => !q.inverted && !q.is_sleep_duration).map((q) => q.label).join(" • ")}
                </p>
              )}
            </div>

              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="pain-stats">
        <WellnessPainStats categoryId={categoryId} />
      </TabsContent>

      <TabsContent value="risk">
        <InjuryRiskAssessment categoryId={categoryId} />
      </TabsContent>

      {isFeminine && (
        <TabsContent value="menstrual">
          <MenstrualCycleSection categoryId={categoryId} />
        </TabsContent>
      )}
    </Tabs>

    <AddWellnessDialog
      open={isDialogOpen}
      onOpenChange={setIsDialogOpen}
      categoryId={categoryId}
    />

    <Dialog open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("health.wellness.customizeDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("health.wellness.customizeDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <WellnessScheduleConfig categoryId={categoryId} />
          <WellnessQuestionsEditor categoryId={categoryId} />
          <PainConfigEditor categoryId={categoryId} />
        </div>
      </DialogContent>
    </Dialog>
  </div>
  );
}
