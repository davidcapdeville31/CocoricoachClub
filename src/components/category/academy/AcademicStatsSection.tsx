import { getLocaleTag } from "@/lib/i18n/dateLocale";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, TrendingUp, TrendingDown, Minus, BarChart3, Users, User } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import ExcelJS from "exceljs";
import { cn } from "@/lib/utils";
import { useSeasonRosterFilter } from "@/contexts/SeasonRosterFilterContext";
import { useTranslation } from "react-i18next";

interface AcademicStatsSectionProps {
  categoryId: string;
}

interface TrackingEntry {
  id: string;
  player_id: string;
  tracking_date: string;
  academic_grade: number | null;
  grade_scale: string | null;
  subject: string | null;
  school_absence_hours: number | null;
  notes: string | null;
  players: { name: string; first_name: string | null } | null;
}

function normalizeGrade(grade: number | null, scale: string | null): number | null {
  if (grade === null) return null;
  const s = scale || "20";
  if (s === "letter") return null;
  const max = parseFloat(s);
  if (max <= 0) return null;
  return (grade / max) * 20;
}

export function AcademicStatsSection({ categoryId }: AcademicStatsSectionProps) {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const { activeSeasonOnly, activeSeasonId, isDateInActiveSeason } = useSeasonRosterFilter();
  const scopeKey = activeSeasonOnly && activeSeasonId ? activeSeasonId : "all";

  const { data: allData } = useQuery({
    queryKey: ["academic_stats_all", categoryId, scopeKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_academic_tracking")
        .select("id, player_id, tracking_date, academic_grade, grade_scale, subject, school_absence_hours, notes, players(name, first_name)")
        .eq("category_id", categoryId)
        .order("tracking_date", { ascending: true });
      if (error) throw error;
      return data as TrackingEntry[];
    },
  });

  // Fetch players visible in the current roster scope
  const { data: allPlayers } = useQuery({
    queryKey: ["category_players_for_stats", categoryId, scopeKey],
    queryFn: async () => {
      const query: any = supabase
        .from("players")
        .select("id, name, first_name, season_id")
        .eq("category_id", categoryId)
        .order("name");
      if (activeSeasonOnly && activeSeasonId) {
        query.eq("season_id", activeSeasonId).not("season_id", "is", null);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as { id: string; name: string; first_name: string | null; season_id: string | null }[];
    },
  });

  const visiblePlayerIds = useMemo(() => new Set((allPlayers || []).map((p) => p.id)), [allPlayers]);

  useEffect(() => {
    if (selectedPlayerId && allPlayers && !visiblePlayerIds.has(selectedPlayerId)) {
      setSelectedPlayerId(null);
    }
  }, [allPlayers, selectedPlayerId, visiblePlayerIds]);

  const scopedData = useMemo(() => {
    if (!allData) return [];
    if (!activeSeasonOnly || !activeSeasonId) return allData;
    return allData.filter((d) => visiblePlayerIds.has(d.player_id) && isDateInActiveSeason(d.tracking_date));
  }, [allData, activeSeasonOnly, activeSeasonId, visiblePlayerIds, isDateInActiveSeason]);

  const availableYears = useMemo(() => {
    const years = new Set(scopedData.map(d => new Date(d.tracking_date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [scopedData]);

  // Filter by year then by player
  const filteredData = useMemo(() => {
    let data = scopedData;
    if (selectedYear !== "all") {
      data = data.filter(d => new Date(d.tracking_date).getFullYear() === parseInt(selectedYear));
    }
    if (selectedPlayerId) {
      data = data.filter(d => d.player_id === selectedPlayerId);
    }
    return data;
  }, [scopedData, selectedYear, selectedPlayerId]);

  const gradeEntries = useMemo(() => {
    return filteredData.filter(d => d.academic_grade !== null && (d.grade_scale || "20") !== "letter");
  }, [filteredData]);

  const globalStats = useMemo(() => {
    if (gradeEntries.length === 0) return null;
    const normalized = gradeEntries.map(e => normalizeGrade(e.academic_grade, e.grade_scale)!).filter(n => n !== null);
    if (normalized.length === 0) return null;
    const avg = normalized.reduce((a, b) => a + b, 0) / normalized.length;
    const min = Math.min(...normalized);
    const max = Math.max(...normalized);
    const totalAbsences = filteredData.reduce((s, d) => s + (d.school_absence_hours || 0), 0);
    return { avg: Math.round(avg * 100) / 100, min: Math.round(min * 100) / 100, max: Math.round(max * 100) / 100, count: normalized.length, totalAbsences };
  }, [gradeEntries, filteredData]);

  const subjectStats = useMemo(() => {
    const subjects: Record<string, { grades: number[]; name: string }> = {};
    gradeEntries.forEach(e => {
      const subj = e.subject || "Non spécifié";
      if (!subjects[subj]) subjects[subj] = { grades: [], name: subj };
      const n = normalizeGrade(e.academic_grade, e.grade_scale);
      if (n !== null) subjects[subj].grades.push(n);
    });
    return Object.values(subjects).map(s => ({
      name: s.name,
      avg: Math.round((s.grades.reduce((a, b) => a + b, 0) / s.grades.length) * 100) / 100,
      min: Math.round(Math.min(...s.grades) * 100) / 100,
      max: Math.round(Math.max(...s.grades) * 100) / 100,
      count: s.grades.length,
    })).sort((a, b) => b.avg - a.avg);
  }, [gradeEntries]);

  const subjectEvolutionData = useMemo(() => {
    const subjectEntries: Record<string, { date: string; grade: number }[]> = {};
    gradeEntries.forEach(e => {
      const subj = e.subject || "Non spécifié";
      const n = normalizeGrade(e.academic_grade, e.grade_scale);
      if (n !== null) {
        if (!subjectEntries[subj]) subjectEntries[subj] = [];
        subjectEntries[subj].push({ date: e.tracking_date, grade: Math.round(n * 100) / 100 });
      }
    });
    const allDates = [...new Set(gradeEntries.map(e => e.tracking_date))].sort();
    const subjects = Object.keys(subjectEntries).sort();
    const chartData = allDates.map(date => {
      const row: Record<string, any> = {
        date,
        label: new Date(date).toLocaleDateString(getLocaleTag(), { day: "2-digit", month: "short" }),
      };
      subjects.forEach(subj => {
        const entry = subjectEntries[subj]?.find(e => e.date === date);
        row[subj] = entry ? entry.grade : null;
      });
      return row;
    });
    return { chartData, subjects };
  }, [gradeEntries]);

  const evolutionData = useMemo(() => {
    const months: Record<string, { grades: number[]; label: string; absences: number }> = {};
    filteredData.forEach(e => {
      const d = new Date(e.tracking_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = new Date(d.getFullYear(), d.getMonth()).toLocaleDateString(getLocaleTag(), { month: "short", year: "2-digit" });
      if (!months[key]) months[key] = { grades: [], label, absences: 0 };
      months[key].absences += e.school_absence_hours || 0;
      const n = normalizeGrade(e.academic_grade, e.grade_scale);
      if (n !== null) months[key].grades.push(n);
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({
        label: v.label,
        moyenne: v.grades.length > 0 ? Math.round((v.grades.reduce((a, b) => a + b, 0) / v.grades.length) * 100) / 100 : null,
        absences: v.absences,
        nbNotes: v.grades.length,
      }));
  }, [filteredData]);

  const yearComparison = useMemo(() => {
    let data = scopedData;
    if (selectedPlayerId) {
      data = data.filter(d => d.player_id === selectedPlayerId);
    }
    const years: Record<number, { grades: number[]; absences: number }> = {};
    data.forEach(e => {
      const y = new Date(e.tracking_date).getFullYear();
      if (!years[y]) years[y] = { grades: [], absences: 0 };
      years[y].absences += e.school_absence_hours || 0;
      const n = normalizeGrade(e.academic_grade, e.grade_scale);
      if (n !== null) years[y].grades.push(n);
    });
    return Object.entries(years)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([year, v]) => ({
        year,
        moyenne: v.grades.length > 0 ? Math.round((v.grades.reduce((a, b) => a + b, 0) / v.grades.length) * 100) / 100 : null,
        absences: v.absences,
        nbNotes: v.grades.length,
      }));
  }, [scopedData, selectedPlayerId]);

  const exportToExcel = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      const ws1 = wb.addWorksheet(t("academy.stats.export_.globalStatsSheet"));
      ws1.columns = [
        { header: t("academy.stats.export_.indicator"), key: "indicator", width: 25 },
        { header: t("academy.stats.export_.value"), key: "value", width: 15 },
      ];
      ws1.getRow(1).font = { bold: true };
      if (globalStats) {
        ws1.addRow({ indicator: t("academy.stats.export_.overallAverage"), value: globalStats.avg });
        ws1.addRow({ indicator: t("academy.stats.export_.minGrade"), value: globalStats.min });
        ws1.addRow({ indicator: t("academy.stats.export_.maxGrade"), value: globalStats.max });
        ws1.addRow({ indicator: t("academy.stats.export_.gradeCount"), value: globalStats.count });
        ws1.addRow({ indicator: t("academy.stats.export_.totalAbsenceHours"), value: globalStats.totalAbsences });
      }
      const ws2 = wb.addWorksheet(t("academy.stats.export_.bySubjectSheet"));
      ws2.columns = [
        { header: t("academy.stats.export_.subject"), key: "name", width: 20 },
        { header: t("academy.stats.export_.averageOn20"), key: "avg", width: 15 },
        { header: t("academy.stats.export_.minOn20"), key: "min", width: 12 },
        { header: t("academy.stats.export_.maxOn20"), key: "max", width: 12 },
        { header: t("academy.stats.export_.gradeCountShort"), key: "count", width: 12 },
      ];
      ws2.getRow(1).font = { bold: true };
      subjectStats.forEach(s => ws2.addRow(s));
      const ws4 = wb.addWorksheet(t("academy.stats.export_.monthlyEvolutionSheet"));
      ws4.columns = [
        { header: t("academy.stats.export_.month"), key: "label", width: 15 },
        { header: t("academy.stats.export_.averageOn20"), key: "moyenne", width: 15 },
        { header: t("academy.stats.export_.gradeCountShort"), key: "nbNotes", width: 12 },
        { header: t("academy.stats.export_.absenceHoursShort"), key: "absences", width: 15 },
      ];
      ws4.getRow(1).font = { bold: true };
      evolutionData.forEach(e => ws4.addRow(e));
      const ws5 = wb.addWorksheet(t("academy.stats.export_.yearlyComparisonSheet"));
      ws5.columns = [
        { header: t("academy.stats.export_.year"), key: "year", width: 12 },
        { header: t("academy.stats.export_.averageOn20"), key: "moyenne", width: 15 },
        { header: t("academy.stats.export_.gradeCountShort"), key: "nbNotes", width: 12 },
        { header: t("academy.stats.export_.absenceHoursShort"), key: "absences", width: 15 },
      ];
      ws5.getRow(1).font = { bold: true };
      yearComparison.forEach(y => ws5.addRow(y));
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `statistiques_scolaires_${selectedYear === "all" ? t("academy.stats.export_.fileNameAllYears") : selectedYear}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("academy.stats.export_.toastSuccess"));
    } catch {
      toast.error(t("academy.stats.export_.toastError"));
    }
  };

  const getTrendIcon = (values: { moyenne: number | null }[]) => {
    if (values.length < 2) return <Minus className="h-4 w-4 text-muted-foreground" />;
    const first = values.find(v => v.moyenne !== null)?.moyenne;
    const last = [...values].reverse().find(v => v.moyenne !== null)?.moyenne;
    if (first === undefined || last === undefined) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (last > first) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (last < first) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const selectedPlayerName = useMemo(() => {
    if (!selectedPlayerId || !allPlayers) return null;
    const p = allPlayers.find(p => p.id === selectedPlayerId);
    return p ? `${p.first_name || ""} ${p.name}`.trim() : null;
  }, [selectedPlayerId, allPlayers]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t("academy.stats.title")}
              {selectedPlayerName && (
                <span className="text-sm font-normal text-muted-foreground">— {selectedPlayerName}</span>
              )}
            </CardTitle>
            <CardDescription>
              {selectedPlayerId ? t("academy.stats.individualStats") : t("academy.stats.selectPlayerPrompt")}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t("academy.stats.periodPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("academy.stats.allYears")}</SelectItem>
                {availableYears.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}/{y + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportToExcel} disabled={!allData || allData.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              {t("academy.stats.export")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Player selector */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {t("academy.stats.selectAthlete")}
          </p>
          <Select
            value={selectedPlayerId ?? ""}
            onValueChange={(v) => setSelectedPlayerId(v || null)}
          >
            <SelectTrigger className="w-full md:w-80">
              <SelectValue placeholder={t("academy.stats.chooseAthlete")} />
            </SelectTrigger>
            <SelectContent>
              {allPlayers?.map((player) => {
                const fullName = `${player.first_name || ""} ${player.name}`.trim();
                return (
                  <SelectItem key={player.id} value={player.id}>
                    {fullName}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {!selectedPlayerId ? (
          <p className="text-center text-muted-foreground py-8">
            {t("academy.stats.clickPlayerPrompt")}
          </p>
        ) : filteredData.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{t("academy.stats.noDataForPlayer")}</p>
        ) : (
          <>
            {globalStats && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">{t("academy.stats.cards.average")}</p>
                  <p className="text-2xl font-bold text-primary">{globalStats.avg}/20</p>
                </div>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">{t("academy.stats.cards.minGrade")}</p>
                  <p className="text-2xl font-bold">{globalStats.min}/20</p>
                </div>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">{t("academy.stats.cards.maxGrade")}</p>
                  <p className="text-2xl font-bold">{globalStats.max}/20</p>
                </div>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">{t("academy.stats.cards.gradeCount")}</p>
                  <p className="text-2xl font-bold">{globalStats.count}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">{t("academy.stats.cards.absenceHours")}</p>
                  <p className="text-2xl font-bold text-destructive">{globalStats.totalAbsences}h</p>
                </div>
              </div>
            )}

            <Tabs defaultValue="evolution" className="space-y-4">
              <TabsList>
                <TabsTrigger value="evolution">{t("academy.stats.tabs.evolution")}</TabsTrigger>
                <TabsTrigger value="subjects">{t("academy.stats.tabs.subjects")}</TabsTrigger>
                <TabsTrigger value="years">{t("academy.stats.tabs.years")}</TabsTrigger>
              </TabsList>

              <TabsContent value="evolution">
                {evolutionData.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{t("academy.stats.trend")}</span>
                      {getTrendIcon(evolutionData)}
                    </div>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={evolutionData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" fontSize={12} />
                          <YAxis domain={[(dataMin: number) => Math.max(0, Math.floor(dataMin) - 2), 20]} fontSize={12} allowDecimals={false} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="moyenne" name={t("academy.stats.chart.average")} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={evolutionData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="absences" name={t("academy.stats.chart.absences")} fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">{t("academy.stats.noEvolutionData")}</p>
                )}
              </TabsContent>

              <TabsContent value="subjects">
                {subjectStats.length > 0 ? (
                  <div className="space-y-4">
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={subjectEvolutionData.chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" fontSize={12} />
                          <YAxis domain={[(dataMin: number) => Math.max(0, Math.floor(dataMin) - 2), 20]} fontSize={12} allowDecimals={false} />
                          <Tooltip />
                          <Legend />
                          {subjectEvolutionData.subjects.map((subj, i) => {
                            const colors = [
                              "hsl(var(--primary))", "#e11d48", "#2563eb", "#16a34a", "#d97706",
                              "#7c3aed", "#0891b2", "#be185d", "#65a30d", "#dc2626",
                              "#4f46e5", "#059669", "#ca8a04", "#9333ea", "#0284c7"
                            ];
                            return (
                              <Line
                                key={subj}
                                type="monotone"
                                dataKey={subj}
                                name={subj}
                                stroke={colors[i % colors.length]}
                                strokeWidth={2}
                                dot={{ r: 5 }}
                                connectNulls
                              />
                            );
                          })}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("academy.stats.table.subject")}</TableHead>
                            <TableHead className="text-center">{t("academy.stats.table.average")}</TableHead>
                            <TableHead className="text-center">{t("academy.stats.table.min")}</TableHead>
                            <TableHead className="text-center">{t("academy.stats.table.max")}</TableHead>
                            <TableHead className="text-center">{t("academy.stats.table.gradeCount")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {subjectStats.map(s => (
                            <TableRow key={s.name}>
                              <TableCell className="font-medium">{s.name}</TableCell>
                              <TableCell className="text-center font-bold">{s.avg}/20</TableCell>
                              <TableCell className="text-center">{s.min}/20</TableCell>
                              <TableCell className="text-center">{s.max}/20</TableCell>
                              <TableCell className="text-center">{s.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">{t("academy.stats.noSubjectData")}</p>
                )}
              </TabsContent>

              <TabsContent value="years">
                {yearComparison.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{t("academy.stats.yearlyTrend")}</span>
                      {getTrendIcon(yearComparison)}
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={yearComparison}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="year" fontSize={12} />
                          <YAxis domain={[(dataMin: number) => Math.max(0, Math.floor(dataMin) - 2), 20]} fontSize={12} allowDecimals={false} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="moyenne" name={t("academy.stats.chart.average")} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={60} maxBarSize={80} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("academy.stats.table.year")}</TableHead>
                            <TableHead className="text-center">{t("academy.stats.table.averageOn20")}</TableHead>
                            <TableHead className="text-center">{t("academy.stats.table.gradeCount")}</TableHead>
                            <TableHead className="text-center">{t("academy.stats.table.absenceHours")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {yearComparison.map(y => (
                            <TableRow key={y.year}>
                              <TableCell className="font-medium">{y.year}/{parseInt(y.year) + 1}</TableCell>
                              <TableCell className="text-center font-bold">{y.moyenne !== null ? `${y.moyenne}/20` : "-"}</TableCell>
                              <TableCell className="text-center">{y.nbNotes}</TableCell>
                              <TableCell className="text-center">{y.absences > 0 ? <span className="text-destructive">{y.absences}h</span> : "0h"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">{t("academy.stats.noYearData")}</p>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
}
