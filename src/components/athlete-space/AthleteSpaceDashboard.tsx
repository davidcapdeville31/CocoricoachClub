import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Activity, TrendingUp, AlertTriangle, CheckCircle2, MapPin, Calendar as CalendarIcon } from "lucide-react";
import { calculateEWMASeries, transformToDailyLoadData } from "@/lib/trainingLoadCalculations";
import { format, subDays, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { NAV_COLORS } from "@/components/ui/colored-nav-tabs";
import { AthleteSpaceRpe } from "./AthleteSpaceRpe";
import { AthleteSpaceWellness } from "./AthleteSpaceWellness";
import { CurrentCyclesCard } from "./CurrentCyclesCard";
import { getTestLabel } from "@/lib/constants/testCategories";
import { parseTestsFromNotes } from "@/lib/utils/sessionNotes";
import { getTrainingTypeLabel } from "@/lib/constants/trainingTypes";
import { PlayerMedalsSection } from "@/components/player/PlayerMedalsSection";
import { useTranslation } from "react-i18next";

interface Props {
  playerId: string;
  categoryId: string;
  playerName: string;
  sportType?: string;
}

export function AthleteSpaceDashboard({ playerId, categoryId, playerName, sportType }: Props) {
  const { t } = useTranslation();
  const { data: awcrData } = useQuery({
    queryKey: ["athlete-space-awcr", playerId],
    queryFn: async () => {
      const startDate = subDays(new Date(), 56);
      const { data, error } = await supabase
        .from("awcr_tracking")
        .select("*")
        .eq("player_id", playerId)
        .gte("session_date", startDate.toISOString().split("T")[0])
        .order("session_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: todayWellness } = useQuery({
    queryKey: ["athlete-space-wellness-today", playerId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("wellness_tracking")
        .select("*")
        .eq("player_id", playerId)
        .eq("tracking_date", today)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: injuries } = useQuery({
    queryKey: ["athlete-space-injuries", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("injuries")
        .select("*")
        .eq("player_id", playerId)
        .in("status", ["active", "recovering"]);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: nextTests } = useQuery({
    queryKey: ["athlete-space-next-tests", categoryId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("training_sessions")
        .select("id, session_date, session_start_time, notes, test_reminder_id")
        .eq("category_id", categoryId)
        .eq("training_type", "test")
        .gte("session_date", today)
        .order("session_date", { ascending: true })
        .order("session_start_time", { ascending: true })
        .limit(20);
      if (error) throw error;
      if (!data || data.length === 0) return [];
      // Garder uniquement les sessions de la prochaine date contenant des tests
      const firstDate = data[0].session_date;
      const sameDay = data.filter((d: any) => d.session_date === firstDate);
      const reminderIds = sameDay.map((s: any) => s.test_reminder_id).filter(Boolean);
      const remindersMap: Record<string, string> = {};
      if (reminderIds.length > 0) {
        const { data: reminders } = await supabase
          .from("test_reminders")
          .select("id, test_type")
          .in("id", reminderIds);
        (reminders || []).forEach((r: any) => {
          remindersMap[r.id] = r.test_type;
        });
      }
      // Collect custom test IDs to resolve labels
      const customIds = new Set<string>();
      const collectCustom = (t: string | null | undefined) => {
        if (t && /^custom:/i.test(t)) customIds.add(t.slice("custom:".length).toLowerCase());
      };
      sameDay.forEach((session: any) => {
        if (session.test_reminder_id) collectCustom(remindersMap[session.test_reminder_id]);
        parseTestsFromNotes(session.notes).forEach((t: any) => collectCustom(t.test_type));
        const noteCustomCodes = String(session.notes || "").match(/custom:[0-9a-f-]{32,36}/gi) || [];
        noteCustomCodes.forEach((code) => collectCustom(code));
      });
      const customMap: Record<string, string> = {};
      if (customIds.size > 0) {
        const ids = Array.from(customIds);
        const direct = await supabase
          .from("custom_tests")
          .select("id, name")
          .in("id", ids);

        const rows = [...(direct.data || [])];
        if (direct.error || rows.length < ids.length) {
          const rpc = await supabase.rpc("get_custom_test_labels", { _ids: ids });
          if (!rpc.error && rpc.data) {
            const seen = new Set(rows.map((row: any) => String(row.id).toLowerCase()));
            (rpc.data || []).forEach((row: any) => {
              const id = String(row.id).toLowerCase();
              if (!seen.has(id)) rows.push(row);
            });
          }
        }
        rows.forEach((c: any) => { customMap[`custom:${String(c.id).toLowerCase()}`] = c.name; });
      }
      const resolve = (code: string) => {
        if (/^custom:/i.test(code || "")) {
          const id = code.slice("custom:".length).toLowerCase();
          return customMap[`custom:${id}`] || t("athleteSpace.dashboard.customTest");
        }
        return getTestLabel(code) || code;
      };


      return sameDay.map((session: any) => {
        let testLabel: string | null = null;
        if (session.test_reminder_id && remindersMap[session.test_reminder_id]) {
          testLabel = resolve(remindersMap[session.test_reminder_id]);
        }
        if (!testLabel) {
          const tests = parseTestsFromNotes(session.notes);
          if (tests.length > 0) {
            testLabel = tests.map((t: any) => resolve(t.test_type)).join(", ");
          }
        }
        if (!testLabel) {
          const legacy = (session.notes || "").match(/Test auto-planifi[ée]\s*:\s*([^\n<]+)/i);
          if (legacy) testLabel = legacy[1].trim().replace(/custom:[0-9a-f-]{32,36}/gi, (code: string) => resolve(code));
        }
        return { ...session, testLabel: testLabel || t("athleteSpace.dashboard.test") };
      });
    },
    enabled: !!categoryId,
  });
  const nextTest = nextTests && nextTests.length > 0 ? nextTests[0] : null;

  const { data: nextMatch } = useQuery({
    queryKey: ["athlete-space-next-match", categoryId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const weekEnd = format(endOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("category_id", categoryId)
        .gte("match_date", today)
        .lte("match_date", weekEnd)
        .order("match_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: upcomingSessions } = useQuery({
    queryKey: ["athlete-space-upcoming-sessions", categoryId, playerId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const in14 = format(addWeeks(new Date(), 2), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("training_sessions")
        .select("id, session_date, session_start_time, training_type, location, event_participants(player_id)")
        .eq("category_id", categoryId)
        .gt("session_date", today)
        .lte("session_date", in14)
        .order("session_date", { ascending: true })
        .order("session_start_time", { ascending: true })
        .limit(20);
      if (error) throw error;
      const filtered = (data || []).filter((s: any) => {
        const parts = s.event_participants || [];
        if (!parts.length) return true;
        return parts.some((p: any) => p.player_id === playerId);
      });
      return filtered.slice(0, 5);
    },
    enabled: !!categoryId && !!playerId,
  });

  const ewmaResults = awcrData && awcrData.length > 0
    ? calculateEWMASeries(transformToDailyLoadData(awcrData, []), "sRPE")
    : [];

  const latestEwma = ewmaResults.length > 0 ? ewmaResults[ewmaResults.length - 1] : null;

  const getDayStatus = () => {
    const hasInjury = injuries && injuries.length > 0;
    const ratioAlert = latestEwma && (latestEwma.ratio > 1.5 || latestEwma.ratio < 0.8);
    const wellnessLow = todayWellness && (
      (todayWellness.sleep_quality || 0) >= 4 || 
      (todayWellness.general_fatigue || 0) >= 4 || 
      (todayWellness.soreness_lower_body || 0) >= 4
    );

    if (hasInjury || ratioAlert) return { label: t("athleteSpace.dashboard.status.adaptation"), color: "bg-destructive text-destructive-foreground", icon: AlertTriangle };
    if (wellnessLow) return { label: t("athleteSpace.dashboard.status.toWatch"), color: "bg-warning text-warning-foreground", icon: Activity };
    return { label: t("athleteSpace.dashboard.status.ok"), color: "bg-status-optimal text-white", icon: CheckCircle2 };
  };

  const dayStatus = getDayStatus();

  const getFeedback = (): string[] => {
    const msgs: string[] = [];
    if (!latestEwma) {
      msgs.push(`📊 ${t("athleteSpace.dashboard.feedback.startTracking")}`);
      return msgs;
    }

    if (latestEwma.ratio >= 0.85 && latestEwma.ratio <= 1.3) {
      msgs.push(`✅ ${t("athleteSpace.dashboard.feedback.consistent")}`);
    } else if (latestEwma.ratio > 1.5) {
      msgs.push(`⚠️ ${t("athleteSpace.dashboard.feedback.overload")}`);
    } else if (latestEwma.ratio > 1.3) {
      msgs.push(`🔶 ${t("athleteSpace.dashboard.feedback.increasing")}`);
    } else if (latestEwma.ratio < 0.8) {
      msgs.push(`📉 ${t("athleteSpace.dashboard.feedback.decreasing")}`);
    }

    const last3 = ewmaResults.slice(-3);
    if (last3.length === 3 && last3.every(r => r.ratio > 1.3)) {
      msgs.push(`🚨 ${t("athleteSpace.dashboard.feedback.overload3weeks")}`);
    }

    if (todayWellness) {
      if ((todayWellness.sleep_quality || 0) >= 4) {
        msgs.push(`😴 ${t("athleteSpace.dashboard.feedback.poorSleep")}`);
      }
      if ((todayWellness.general_fatigue || 0) >= 4) {
        msgs.push(`🔋 ${t("athleteSpace.dashboard.feedback.highFatigue")}`);
      }
    } else {
      msgs.push(`💡 ${t("athleteSpace.dashboard.feedback.fillWellness")}`);
    }

    return msgs;
  };

  const feedback = getFeedback();

  const chartData = ewmaResults.slice(-14).map(r => ({
    date: format(new Date(r.date), "dd/MM", { locale: fr }),
    acute: Math.round(r.acute),
    chronic: Math.round(r.chronic),
  }));

  return (
    <div className="space-y-6">
      {/* Wellness du jour — hissé en haut pour saisie rapide sur mobile */}
      <AthleteSpaceWellness playerId={playerId} categoryId={categoryId} hideHistory />

      {/* RPE du jour — hissé en haut pour saisie rapide sur mobile */}
      <AthleteSpaceRpe playerId={playerId} categoryId={categoryId} hideHistory />

      {/* Cycle en cours — visibilité de la planification du coach */}
      <CurrentCyclesCard categoryId={categoryId} />

      {/* Status + EWMA */}
      <Card className="shadow-sm border" style={{ borderColor: `${NAV_COLORS.performance.base}40`, backgroundColor: `${NAV_COLORS.performance.base}08` }}>
        <CardContent className="py-2.5 px-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">{t("athleteSpace.dashboard.statusLabel")}</span>
              <Badge className={`text-xs px-2 py-0.5 ${dayStatus.color}`}>
                <dayStatus.icon className="h-3 w-3 mr-1" />
                {dayStatus.label}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">EWMA</span>
              <span className={`text-base font-bold ${
                latestEwma
                  ? latestEwma.ratio >= 0.85 && latestEwma.ratio <= 1.3
                    ? "text-status-optimal"
                    : latestEwma.ratio > 1.5 || latestEwma.ratio < 0.8
                    ? "text-destructive"
                    : "text-warning"
                  : "text-muted-foreground"
              }`}>
                {latestEwma ? latestEwma.ratio.toFixed(2) : "—"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Next match */}
      {nextMatch && (
        <Card className="shadow-md border-2" style={{ borderColor: `${NAV_COLORS.video.base}40`, backgroundColor: `${NAV_COLORS.video.base}08` }}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${NAV_COLORS.video.base}20` }}>
                <CalendarIcon className="h-6 w-6" style={{ color: NAV_COLORS.video.base }} />
              </div>
              <div className="flex-1">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">{t("athleteSpace.dashboard.nextMatch")}</p>
                <p className="font-bold text-base" style={{ color: NAV_COLORS.video.base }}>
                  {nextMatch.opponent || t("athleteSpace.dashboard.competition")}
                </p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    {format(new Date(nextMatch.match_date), "EEEE d MMMM", { locale: fr })}
                  </span>
                  {nextMatch.match_time && (
                    <span>{nextMatch.match_time.slice(0, 5)}</span>
                  )}
                  {nextMatch.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {nextMatch.location}
                    </span>
                  )}
                </div>
              </div>
              {nextMatch.is_home !== null && (
                <Badge variant="outline" className="text-xs" style={{ borderColor: NAV_COLORS.video.base, color: NAV_COLORS.video.base }}>
                  {nextMatch.is_home ? t("athleteSpace.dashboard.home") : t("athleteSpace.dashboard.away")}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="shadow-sm border-2" style={{ borderColor: `${NAV_COLORS.sante.base}40`, backgroundColor: `${NAV_COLORS.sante.base}08` }}>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">{t("athleteSpace.dashboard.load7d")}</p>
            <p className="text-xl font-bold" style={{ color: NAV_COLORS.sante.base }}>{latestEwma ? Math.round(latestEwma.acute) : "—"}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-2" style={{ borderColor: `${NAV_COLORS.programmation.base}40`, backgroundColor: `${NAV_COLORS.programmation.base}08` }}>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">{t("athleteSpace.dashboard.load28d")}</p>
            <p className="text-xl font-bold" style={{ color: NAV_COLORS.programmation.base }}>{latestEwma ? Math.round(latestEwma.chronic) : "—"}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-2" style={{ borderColor: `${NAV_COLORS.video.base}40`, backgroundColor: `${NAV_COLORS.video.base}08` }}>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">{t("athleteSpace.dashboard.injuries")}</p>
            <p className={`text-xl font-bold`} style={{ color: injuries && injuries.length > 0 ? NAV_COLORS.video.base : NAV_COLORS.sante.base }}>
              {injuries?.length || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-2" style={{ borderColor: `${NAV_COLORS.planification.base}40`, backgroundColor: `${NAV_COLORS.planification.base}08` }}>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
              {nextTests && nextTests.length > 1 ? t("athleteSpace.dashboard.nextTestsCount", { count: nextTests.length }) : t("athleteSpace.dashboard.nextTest")}
            </p>
            {nextTests && nextTests.length > 0 ? (
              <div className="space-y-1 mt-0.5">
                {nextTests.map((t: any) => (
                  <div key={t.id}>
                    <p className="text-sm font-semibold leading-tight" style={{ color: NAV_COLORS.planification.base }}>
                      {t.testLabel}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(t.session_date), "d MMM", { locale: fr })}
                      {t.session_start_time ? ` • ${t.session_start_time.slice(0, 5)}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-semibold" style={{ color: NAV_COLORS.planification.base }}>—</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Séances à venir (14 jours) */}
      {upcomingSessions && upcomingSessions.length > 0 && (
        <Card className="shadow-md border-2" style={{ borderColor: `${NAV_COLORS.planification.base}40`, backgroundColor: `${NAV_COLORS.planification.base}08` }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2" style={{ color: NAV_COLORS.planification.base }}>
              <CalendarIcon className="h-4 w-4" />
              {t("athleteSpace.dashboard.upcomingSessions")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingSessions.map((s: any) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border bg-background/60 px-3 py-2"
                >
                  <div className="flex flex-col items-center justify-center rounded-lg px-2 py-1 min-w-[48px]" style={{ backgroundColor: `${NAV_COLORS.planification.base}15` }}>
                    <span className="text-[10px] uppercase font-semibold leading-none" style={{ color: NAV_COLORS.planification.base }}>
                      {format(new Date(s.session_date), "MMM", { locale: fr })}
                    </span>
                    <span className="text-base font-bold leading-tight" style={{ color: NAV_COLORS.planification.base }}>
                      {format(new Date(s.session_date), "d", { locale: fr })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {getTrainingTypeLabel(s.training_type)}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                      {s.session_start_time && <span>{s.session_start_time.slice(0, 5)}</span>}
                      {s.location && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3" />
                          {s.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <PlayerMedalsSection playerId={playerId} />

    </div>
  );
}
