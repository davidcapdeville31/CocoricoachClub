import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ClipboardCheck, Calendar, Users, TrendingUp, ChevronRight, Filter, Clock, AlertCircle, CheckCircle, Check, X, HelpCircle, FileText, FileSpreadsheet } from "lucide-react";
import { exportAttendancePdf, exportAttendanceExcel, type AttendanceExportRow } from "@/lib/attendanceExport";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, subMonths, subDays, isWithinInterval, parseISO } from "date-fns";
import { SessionAttendanceDialog } from "./SessionAttendanceDialog";
import { ParticipantsAttendanceList, type ParticipantWithAttendance } from "./ParticipantsAttendanceList";

import { useTranslation } from "react-i18next";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AttendanceTabProps {
  categoryId: string;
}

type AttendanceSession = {
  id: string;
  session_date: string;
  training_type: string;
  session_start_time?: string | null;
  session_end_time?: string | null;
  intensity?: number | null;
  notes?: string | null;
  created_by_player_id?: string | null;
};


type EventParticipantRow = ParticipantWithAttendance & {
  id?: string;
  training_session_id: string;
};

const EVENT_PARTICIPANTS_PAGE_SIZE = 1000;
const EVENT_PARTICIPANTS_SELECT =
  "id, training_session_id, player_id, attendance_status, absence_comment, responded_at, players:player_id(id, name, first_name, avatar_url)";

async function fetchEventParticipantsBySessionIds(sessionIds: string[]): Promise<EventParticipantRow[]> {
  if (sessionIds.length === 0) return [];

  const rows: EventParticipantRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("event_participants")
      .select(EVENT_PARTICIPANTS_SELECT)
      .in("training_session_id", sessionIds)
      .order("training_session_id", { ascending: true })
      .order("player_id", { ascending: true })
      .range(from, from + EVENT_PARTICIPANTS_PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data || []) as EventParticipantRow[];
    rows.push(...page);

    if (page.length < EVENT_PARTICIPANTS_PAGE_SIZE) break;
    from += EVENT_PARTICIPANTS_PAGE_SIZE;
  }

  return rows;
}

export function AttendanceTab({ categoryId }: AttendanceTabProps) {
  const { t } = useTranslation();
  const { isViewer } = useViewerModeContext();
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDay, setDetailDay] = useState<string | null>(null);
  
  // Date range filter
  const [startDate, setStartDate] = useState(() => {
    const date = subMonths(new Date(), 1);
    return format(date, "yyyy-MM-dd");
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return format(date, "yyyy-MM-dd");
  });

  // Fetch sessions within selected period (bounded to the period so stats reflect the filter exactly)
  const { data: sessions } = useQuery({
    queryKey: ["training_sessions_attendance", categoryId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("*")
        .eq("category_id", categoryId)
        .gte("session_date", startDate)
        .lte("session_date", endDate)
        .order("session_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch players
  const { data: players } = useQuery({
    queryKey: ["players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, position")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch all attendance data for the category
  const { data: attendance } = useQuery({
    queryKey: ["training_attendance", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_attendance")
        .select("*, training_sessions(training_type)")
        .eq("category_id", categoryId)
        .order("attendance_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch event_participants (athlete self-response) for this category's sessions
  const sessionIds = (sessions || []).map((s) => s.id);
  const { data: eventParticipants } = useQuery({
    queryKey: ["event_participants_attendance", categoryId, sessionIds.join(",")],
    enabled: sessionIds.length > 0,
    queryFn: () => fetchEventParticipantsBySessionIds(sessionIds),
  });

  const daySessions = (sessions || []).filter((s) => s.session_date === detailDay);
  const daySessionIds = daySessions.map((s) => s.id);

  const { data: detailEventParticipants, isLoading: detailParticipantsLoading } = useQuery({
    queryKey: ["event_participants_attendance_detail", detailDay, daySessionIds.join(",")],
    enabled: !!detailDay && daySessionIds.length > 0,
    queryFn: async () => fetchEventParticipantsBySessionIds(daySessionIds),
  });

  // Athlete-created private sessions are not roster-wide: never complete them with the roster
  const isAthletePrivateSession = (session: AttendanceSession) =>
    !!session.created_by_player_id || (session.notes || "").includes("[Séance athlète]");

  // Some sessions (e.g. recurring test reminders) have no pre-created event_participants rows.
  // Complete them with the roster so missing athletes count as "no response" instead of disappearing.
  const completeWithRoster = (
    session: AttendanceSession,
    rows: EventParticipantRow[],
  ): EventParticipantRow[] => {
    if (isAthletePrivateSession(session)) return rows;
    const responded = new Set(rows.map((r) => r.player_id));
    const missing: EventParticipantRow[] = (players || [])
      .filter((p) => !responded.has(p.id))
      .map((p) => ({
        training_session_id: session.id,
        player_id: p.id,
        attendance_status: "no_response" as const,
        absence_comment: null,
        responded_at: null,
        players: { id: p.id, name: p.name },
      }));
    return [...rows, ...missing];
  };


  // Filter sessions by date range
  const filteredSessions = sessions?.filter((session) => {
    const sessionDate = parseISO(session.session_date);
    return isWithinInterval(sessionDate, {
      start: parseISO(startDate),
      end: parseISO(endDate),
    });
  });

  // Filter attendance by date range
  const filteredAttendance = attendance?.filter((a) => {
    const attendanceDate = parseISO(a.attendance_date);
    return isWithinInterval(attendanceDate, {
      start: parseISO(startDate),
      end: parseISO(endDate),
    });
  });

  // Calculate stats per player with date filtering
  const playerStats = players?.map((player) => {
    const playerAttendance = filteredAttendance?.filter((a) => a.player_id === player.id) || [];
    const present = playerAttendance.filter((a) => a.status === "present").length;
    const late = playerAttendance.filter((a) => a.status === "late").length;
    const lateJustified = playerAttendance.filter((a) => a.status === "late" && a.late_justified).length;
    const lateUnjustified = late - lateJustified;
    const absent = playerAttendance.filter((a) => a.status === "absent").length;
    const excused = playerAttendance.filter((a) => a.status === "excused").length;
    const total = playerAttendance.length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return {
      ...player,
      present,
      late,
      lateJustified,
      lateUnjustified,
      absent,
      excused,
      total,
      rate,
    };
  }).sort((a, b) => b.rate - a.rate);

  // Get detailed attendance counts for a session
  const getSessionAttendanceSummary = (sessionId: string, sessionDate: string) => {
    const sessionAtt = attendance?.filter(
      (a) => a.training_session_id === sessionId || 
            (a.attendance_date === sessionDate && !a.training_session_id)
    ) || [];
    return {
      total: sessionAtt.length,
      present: sessionAtt.filter(a => a.status === "present").length,
      absent: sessionAtt.filter(a => a.status === "absent").length,
      excused: sessionAtt.filter(a => a.status === "excused").length,
      late: sessionAtt.filter(a => a.status === "late").length,
    };
  };

  const handleOpenAttendance = (session: AttendanceSession) => {
    setSelectedSession(session);
    setDialogOpen(true);
  };


  const getSessionLabel = (session: AttendanceSession) => {
    const cleanTitle = (session.notes || "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .split("\n")
      .map((line: string) => line.trim())
      .find((line: string) => line && !line.startsWith("📋") && !line.startsWith("📍"));
    const title = cleanTitle || session.training_type || "Séance";

    if (session.session_start_time && session.session_end_time) {
      return `${title} · ${session.session_start_time.slice(0, 5)} - ${session.session_end_time.slice(0, 5)}`;
    } else if (session.session_start_time) {
      return `${title} · ${session.session_start_time.slice(0, 5)}`;
    }
    return title;
  };

  const handleExportDetail = async (
    kind: "pdf" | "excel",
    session: AttendanceSession,
    participants: EventParticipantRow[],
  ) => {
    try {
      const rows: AttendanceExportRow[] = (participants || [])
        .map((p) => {
          const pl = p.players || {};
          const name = pl.first_name ? `${pl.first_name} ${pl.name ?? ""}`.trim() : pl.name || "-";
          const status = (p.attendance_status === "present" || p.attendance_status === "absent"
            ? p.attendance_status
            : "no_response") as AttendanceExportRow["status"];
          return {
            name,
            status,
            comment: status === "absent" ? p.absence_comment : null,
            respondedAt: p.responded_at ? format(new Date(p.responded_at), "dd/MM/yyyy HH:mm") : null,
          };
        })
        .sort((a, b) => {
          const order = { present: 0, absent: 1, no_response: 2 } as const;
          return order[a.status] - order[b.status] || a.name.localeCompare(b.name);
        });

      const ctx = {
        categoryId,
        sessionLabel: getSessionLabel(session),
        sessionDate: format(parseISO(session.session_date), "dd/MM/yyyy"),
        rows,
        labels: {
          title: t("admin.attendance.detailBySession"),
          athlete: t("adminAttendance.participants.defaultAthlete"),
          status: t("admin.attendance.status", { defaultValue: "Statut" }),
          reason: t("admin.attendance.reason", { defaultValue: "Motif" }),
          respondedAt: t("admin.attendance.respondedAt", { defaultValue: "Réponse le" }),
          present: t("admin.attendance.present"),
          absent: t("admin.attendance.absent"),
          noResponse: t("admin.attendance.noResponse"),
          session: t("admin.attendance.sessionLabel", { defaultValue: "Séance" }),
          date: t("admin.attendance.dateLabel", { defaultValue: "Date" }),
        },
      };

      if (kind === "pdf") await exportAttendancePdf(ctx);
      else await exportAttendanceExcel(ctx);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Export error");
    }
  };



  const getRateColor = (rate: number) => {
    if (rate >= 90) return "text-green-600";
    if (rate >= 75) return "text-amber-600";
    return "text-red-600";
  };

  const getRateBadge = (rate: number) => {
    if (rate >= 90) return <Badge className="bg-green-100 text-green-700">{rate}%</Badge>;
    if (rate >= 75) return <Badge className="bg-amber-100 text-amber-700">{rate}%</Badge>;
    return <Badge className="bg-red-100 text-red-700">{rate}%</Badge>;
  };

  // Calculate overall stats
  const totalFilteredSessions = filteredSessions?.length || 0;
  const sessionsWithAttendance = filteredSessions?.filter(
    (s) => getSessionAttendanceSummary(s.id, s.session_date).total > 0
  ).length || 0;
  const averageRate = playerStats?.length 
    ? Math.round(playerStats.reduce((acc, p) => acc + p.rate, 0) / playerStats.length)
    : 0;
  const totalLate = playerStats?.reduce((acc, p) => acc + p.late, 0) || 0;
  const totalLateJustified = playerStats?.reduce((acc, p) => acc + p.lateJustified, 0) || 0;
  const totalLateUnjustified = totalLate - totalLateJustified;

  const setDatePreset = (preset: string) => {
    const now = new Date();
    let start = now;
    let end = now;
    switch (preset) {
      case "week":
        start = subDays(now, 7);
        break;
      case "month":
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case "3months":
        start = subMonths(now, 3);
        break;
      case "season": {
        const seasonStart = new Date(now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1, 8, 1);
        start = seasonStart;
        break;
      }
    }
    setStartDate(format(start, "yyyy-MM-dd"));
    setEndDate(format(end, "yyyy-MM-dd"));
  };

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t("admin.attendance.period")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
              <span className="text-muted-foreground">{t("admin.attendance.to")}</span>
              <Input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setDatePreset("week")}>
                {t("admin.attendance.preset7d")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDatePreset("month")}>
                {t("admin.attendance.presetMonth")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDatePreset("3months")}>
                {t("admin.attendance.preset3m")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDatePreset("season")}>
                {t("admin.attendance.presetSeason")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("admin.attendance.sessions")}</p>
                <p className="text-2xl font-bold">{sessionsWithAttendance}/{totalFilteredSessions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("admin.attendance.trackedPlayers")}</p>
                <p className="text-2xl font-bold">{players?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("admin.attendance.avgRate")}</p>
                <p className={`text-2xl font-bold ${getRateColor(averageRate)}`}>{averageRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("admin.attendance.lateArrivals")}</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-orange-600">{totalLate}</span>
                  <div className="text-xs">
                    <div className="text-green-600">✓ {totalLateJustified}</div>
                    <div className="text-red-600">✗ {totalLateUnjustified}</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Global Presence Response Stats (athlete self-responses) */}
      {(() => {
        const todayStr = format(new Date(), "yyyy-MM-dd");
        const rowsBySession = new Map<string, EventParticipantRow[]>();
        for (const p of eventParticipants || []) {
          const list = rowsBySession.get(p.training_session_id) || [];
          list.push(p);
          rowsBySession.set(p.training_session_id, list);
        }
        const filteredParticipants = (filteredSessions || []).flatMap((s) =>
          completeWithRoster(s as AttendanceSession, rowsBySession.get(s.id) || []),
        );
        const presentCount = filteredParticipants.filter((p) => p.attendance_status === "present").length;
        const absentCount = filteredParticipants.filter((p) => p.attendance_status === "absent").length;
        const noResponseCount = filteredParticipants.filter(
          (p) => !p.attendance_status || p.attendance_status === "no_response",
        ).length;
        const totalParticipants = filteredParticipants.length;
        const futureSessionsCount = (filteredSessions || []).filter((s) => s.session_date > todayStr).length;

        const sessionOptions = (filteredSessions || [])
          .slice()
          .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());

        const detailSession = detailSessionId
          ? sessionOptions.find((s) => s.id === detailSessionId)
          : null;
        const detailParticipants = detailSession
          ? completeWithRoster(detailSession as AttendanceSession, detailEventParticipants || [])
          : [];


        return (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {t("admin.attendance.responseStatsExplanation", {
                from: format(parseISO(startDate), "dd/MM/yyyy"),
                to: format(parseISO(endDate), "dd/MM/yyyy"),
                total: totalParticipants,
              })}
              {futureSessionsCount > 0 && (
                <> {t("admin.attendance.futureSessionsNote", { count: futureSessionsCount })}</>
              )}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-emerald-500/40">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/15 rounded-lg">
                      <Check className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("admin.attendance.present")}</p>
                      <p className="text-2xl font-bold text-emerald-600">{presentCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-rose-500/40">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-500/15 rounded-lg">
                      <X className="h-5 w-5 text-rose-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("admin.attendance.absent")}</p>
                      <p className="text-2xl font-bold text-rose-600">{absentCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <HelpCircle className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("admin.attendance.noResponse")}</p>
                      <p className="text-2xl font-bold">{noResponseCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ClipboardCheck className="h-5 w-5" />
                      {t("admin.attendance.detailBySession")}
                    </CardTitle>
                    <CardDescription>
                      {t("admin.attendance.selectSessionHint")}
                    </CardDescription>
                  </div>
                  {detailSession && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => handleExportDetail("pdf", detailSession, detailParticipants)}
                      >
                        <FileText className="h-4 w-4" /> PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => handleExportDetail("excel", detailSession, detailParticipants)}
                      >
                        <FileSpreadsheet className="h-4 w-4" /> Excel
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {sessionOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t("admin.attendance.noSessionsInPeriod")}
                  </p>
                ) : (
                  <>
                    <Select value={detailSessionId ?? ""} onValueChange={(v) => setDetailSessionId(v || null)}>
                      <SelectTrigger className="w-full sm:w-[420px]">
                        <SelectValue placeholder={t("admin.attendance.chooseSession")} />
                      </SelectTrigger>
                      <SelectContent>
                        {sessionOptions.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {format(parseISO(s.session_date), "dd MMM yyyy", { locale: getDateLocale() })} — {getSessionLabel(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {detailSession && detailParticipantsLoading ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {t("common.loading", { defaultValue: "Chargement..." })}
                      </p>
                    ) : detailSession && totalParticipants >= 0 && (
                      <ParticipantsAttendanceList
                        participants={detailParticipants}
                        title={t("admin.attendance.sessionOn", { date: format(parseISO(detailSession.session_date), "dd/MM/yyyy", { locale: getDateLocale() }) })}
                        emptyLabel={t("admin.attendance.noAthleteAssignedToSession")}
                      />
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })()}


      {(() => {
        const today = format(new Date(), "yyyy-MM-dd");
        const todaySessions = filteredSessions?.filter(s => s.session_date === today) || [];
        const pastSessions = filteredSessions?.filter(s => s.session_date < today).sort((a, b) => 
          new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
        ) || [];
        const upcomingSessions = filteredSessions?.filter(s => s.session_date > today).sort((a, b) => 
          new Date(a.session_date).getTime() - new Date(b.session_date).getTime()
        ) || [];

        const renderSessionItem = (session: AttendanceSession) => {
          const summary = getSessionAttendanceSummary(session.id, session.session_date);
          const hasAttendance = summary.total > 0;
          const isToday = session.session_date === today;
          const isPast = session.session_date < today;

          return (
            <div
              key={session.id}
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                isToday ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => !isViewer && handleOpenAttendance(session)}
            >
              <div className="flex items-center gap-3">
                <div className="text-center min-w-[60px]">
                  <p className="text-sm font-medium">
                    {format(new Date(session.session_date), "dd MMM", { locale: getDateLocale() })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(session.session_date), "EEE", { locale: getDateLocale() })}
                  </p>
                </div>
                <div>
                  <p className="font-medium">{getSessionLabel(session)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {hasAttendance ? (
                  <>
                    <Badge className="bg-green-100 text-green-700 text-xs">
                      {summary.present} P
                    </Badge>
                    {summary.late > 0 && (
                      <Badge className="bg-orange-100 text-orange-700 text-xs">
                        {summary.late} R
                      </Badge>
                    )}
                    {summary.absent > 0 && (
                      <Badge className="bg-red-100 text-red-700 text-xs">
                        {summary.absent} A
                      </Badge>
                    )}
                    {summary.excused > 0 && (
                      <Badge className="bg-amber-100 text-amber-700 text-xs">
                        {summary.excused} E
                      </Badge>
                    )}
                  </>
                ) : isPast ? (
                  <Badge variant="outline" className="text-muted-foreground">
                    Non renseigné
                  </Badge>
                ) : (
                  <Badge variant="outline">À venir</Badge>
                )}
                {!isViewer && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>
          );
        };

        return (
          <Tabs defaultValue="today" className="space-y-4">
            <TabsList>
              <TabsTrigger value="today" className="gap-2">
                <ClipboardCheck className="h-4 w-4" />
                Aujourd'hui ({todaySessions.length})
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="gap-2">
                <Calendar className="h-4 w-4" />
                À venir ({upcomingSessions.length})
              </TabsTrigger>
              <TabsTrigger value="past" className="gap-2">
                <Clock className="h-4 w-4" />
                Passées ({pastSessions.length})
              </TabsTrigger>
              <TabsTrigger value="players" className="gap-2">
                <Users className="h-4 w-4" />
                Par joueur
              </TabsTrigger>
            </TabsList>

            <TabsContent value="today">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5" />
                    Séances du jour
                  </CardTitle>
                  <CardDescription>
                    Cliquez sur une séance pour faire l'appel
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {todaySessions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Aucune séance aujourd'hui
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {todaySessions.map(renderSessionItem)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="upcoming">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Séances à venir ({upcomingSessions.length})
                  </CardTitle>
                  <CardDescription>
                    Planifiez vos prochaines séances
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {upcomingSessions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Aucune séance à venir sur cette période
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {upcomingSessions.map(renderSessionItem)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="past">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Séances passées ({pastSessions.length})
                  </CardTitle>
                  <CardDescription>
                    Historique des présences
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pastSessions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Aucune séance passée sur cette période
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {pastSessions.map(renderSessionItem)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="players">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Statistiques par joueur
                  </CardTitle>
                  <CardDescription>
                    Du {format(parseISO(startDate), "dd/MM/yyyy")} au {format(parseISO(endDate), "dd/MM/yyyy")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!playerStats || playerStats.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Aucun joueur dans cette catégorie
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Joueur</TableHead>
                            <TableHead className="text-center">Présent</TableHead>
                            <TableHead className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Clock className="h-3 w-3" />
                                Retards
                              </div>
                            </TableHead>
                            <TableHead className="text-center">Excusé</TableHead>
                            <TableHead className="text-center">Absent</TableHead>
                            <TableHead className="text-center">Taux</TableHead>
                            <TableHead className="text-center">Détail</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {playerStats.map((player) => (
                            <TableRow key={player.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{player.name}</p>
                                  {player.position && (
                                    <p className="text-xs text-muted-foreground">{player.position}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-green-600 font-medium">{player.present}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                {player.late > 0 ? (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-auto p-1">
                                        <span className="text-orange-600 font-medium">{player.late}</span>
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-72 p-3">
                                      <h4 className="font-medium mb-2 flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> Retards ({player.late})
                                      </h4>
                                      <div className="space-y-1 text-sm mb-2">
                                        <div className="flex items-center gap-2 text-green-600">
                                          <CheckCircle className="h-3 w-3" />
                                          Justifiés: {player.lateJustified}
                                        </div>
                                        <div className="flex items-center gap-2 text-red-600">
                                          <AlertCircle className="h-3 w-3" />
                                          Non justifiés: {player.lateUnjustified}
                                        </div>
                                      </div>
                                      <div className="border-t pt-2 space-y-1 max-h-32 overflow-y-auto">
                                        {filteredAttendance
                                          ?.filter(a => a.player_id === player.id && a.status === "late")
                                          .map(a => (
                                            <div key={a.id} className="text-xs flex justify-between">
                                              <span>{format(parseISO(a.attendance_date), "dd/MM/yyyy")}</span>
                                              <span className="text-muted-foreground">
                                                {a.late_minutes ? `${a.late_minutes}min` : ""} 
                                                {a.late_justified ? " ✓" : " ✗"}
                                                {a.late_reason ? ` - ${a.late_reason}` : ""}
                                              </span>
                                            </div>
                                          ))
                                        }
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {player.excused > 0 ? (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-auto p-1">
                                        <span className="text-amber-600 font-medium">{player.excused}</span>
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-72 p-3">
                                      <h4 className="font-medium mb-2">Excusés ({player.excused})</h4>
                                      <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {filteredAttendance
                                          ?.filter(a => a.player_id === player.id && a.status === "excused")
                                          .map(a => (
                                            <div key={a.id} className="text-xs flex justify-between">
                                              <span>{format(parseISO(a.attendance_date), "dd/MM/yyyy")}</span>
                                              <span className="text-muted-foreground">{a.absence_reason || "—"}</span>
                                            </div>
                                          ))
                                        }
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {player.absent > 0 ? (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-auto p-1">
                                        <span className="text-red-600 font-medium">{player.absent}</span>
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-72 p-3">
                                      <h4 className="font-medium mb-2">Absences ({player.absent})</h4>
                                      <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {filteredAttendance
                                          ?.filter(a => a.player_id === player.id && a.status === "absent")
                                          .map(a => (
                                            <div key={a.id} className="text-xs flex justify-between">
                                              <span>{format(parseISO(a.attendance_date), "dd/MM/yyyy")}</span>
                                              <span className="text-muted-foreground">{a.absence_reason || "—"}</span>
                                            </div>
                                          ))
                                        }
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex flex-col items-center gap-1">
                                  {player.total > 0 ? getRateBadge(player.rate) : "-"}
                                  {player.total > 0 && (
                                    <Progress value={player.rate} className="h-1.5 w-20" />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                {(() => {
                                  const playerSessions = (filteredSessions || [])
                                    .slice()
                                    .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())
                                    .map((s) => {
                                      const coachRow = filteredAttendance?.find(
                                        (a) => a.player_id === player.id &&
                                          (a.training_session_id === s.id || (a.attendance_date === s.session_date && !a.training_session_id)),
                                      );
                                      const selfRow = (eventParticipants || []).find(
                                        (p) => p.training_session_id === s.id && p.player_id === player.id,
                                      );
                                      return { session: s, coach: coachRow, self: selfRow };
                                    })
                                    .filter((row) => row.coach || row.self);
                                  if (playerSessions.length === 0) {
                                    return <span className="text-muted-foreground text-xs">—</span>;
                                  }
                                  return (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                                          Voir ({playerSessions.length})
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-96 p-3">
                                        <h4 className="font-medium mb-2 text-sm">Détail des séances — {player.name}</h4>
                                        <div className="space-y-1 max-h-72 overflow-y-auto">
                                          {playerSessions.map(({ session, coach, self }) => {
                                            const coachStatus = coach?.status as string | undefined;
                                            const selfStatus = self?.attendance_status as string | undefined;
                                            const statusLabel =
                                              coachStatus === "present" ? { label: "Présent", cls: "text-green-600" } :
                                              coachStatus === "late" ? { label: `Retard${coach?.late_minutes ? ` ${coach.late_minutes}min` : ""}`, cls: "text-orange-600" } :
                                              coachStatus === "excused" ? { label: "Excusé", cls: "text-amber-600" } :
                                              coachStatus === "absent" ? { label: "Absent", cls: "text-red-600" } :
                                              selfStatus === "present" ? { label: "Présent (auto)", cls: "text-green-600" } :
                                              selfStatus === "absent" ? { label: "Absent (auto)", cls: "text-red-600" } :
                                              { label: "Pas renseigné", cls: "text-muted-foreground" };
                                            const comment = coach?.absence_reason || coach?.late_reason || self?.absence_comment;
                                            return (
                                              <div key={session.id} className="text-xs flex justify-between gap-2 border-b border-border/40 pb-1 last:border-0">
                                                <div className="flex flex-col">
                                                  <span>{format(parseISO(session.session_date), "dd/MM/yyyy", { locale: getDateLocale() })} — {getSessionLabel(session)}</span>
                                                  {comment && <span className="italic text-muted-foreground">{comment}</span>}
                                                </div>
                                                <span className={`font-medium whitespace-nowrap ${statusLabel.cls}`}>{statusLabel.label}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  );
                                })()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        );
      })()}

      <SessionAttendanceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        session={selectedSession}
        categoryId={categoryId}
      />
    </div>
  );
}
