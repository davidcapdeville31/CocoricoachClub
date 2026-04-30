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
import { getTestLabel } from "@/lib/constants/testCategories";
import { parseTestsFromNotes } from "@/lib/utils/sessionNotes";
import { getTrainingTypeLabel } from "@/lib/constants/trainingTypes";

interface Props {
  playerId: string;
  categoryId: string;
  playerName: string;
  sportType?: string;
}

export function AthleteSpaceDashboard({ playerId, categoryId, playerName, sportType }: Props) {
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

  const { data: nextTest } = useQuery({
    queryKey: ["athlete-space-next-test", categoryId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("training_sessions")
        .select("id, session_date, session_start_time, notes, test_reminder_id")
        .eq("category_id", categoryId)
        .eq("training_type", "test")
        .gte("session_date", today)
        .order("session_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      let testLabel: string | null = null;
      if (data.test_reminder_id) {
        const { data: reminder } = await supabase
          .from("test_reminders")
          .select("test_type")
          .eq("id", data.test_reminder_id)
          .maybeSingle();
        if (reminder?.test_type) {
          testLabel = getTestLabel(reminder.test_type) || reminder.test_type;
        }
      }
      if (!testLabel) {
        const tests = parseTestsFromNotes((data as any).notes);
        if (tests.length > 0) {
          testLabel = tests.map(t => getTestLabel(t.test_type) || t.test_type).join(", ");
        }
      }
      if (!testLabel) {
        const legacy = ((data as any).notes || "").match(/Test auto-planifi[ée]\s*:\s*([^\n<]+)/i);
        if (legacy) testLabel = legacy[1].trim();
      }
      return { ...data, testLabel };
    },
    enabled: !!categoryId,
  });

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
        .select("id, session_date, session_start_time, training_type, theme, location")
        .eq("category_id", categoryId)
        .gt("session_date", today)
        .lte("session_date", in14)
        .order("session_date", { ascending: true })
        .order("session_start_time", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!categoryId,
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

    if (hasInjury || ratioAlert) return { label: "Adaptation", color: "bg-destructive text-destructive-foreground", icon: AlertTriangle };
    if (wellnessLow) return { label: "À surveiller", color: "bg-warning text-warning-foreground", icon: Activity };
    return { label: "OK", color: "bg-status-optimal text-white", icon: CheckCircle2 };
  };

  const dayStatus = getDayStatus();

  const getFeedback = (): string[] => {
    const msgs: string[] = [];
    if (!latestEwma) {
      msgs.push("📊 Commence à enregistrer tes séances pour recevoir un suivi personnalisé.");
      return msgs;
    }

    if (latestEwma.ratio >= 0.85 && latestEwma.ratio <= 1.3) {
      msgs.push("✅ Ta charge d'entraînement est cohérente avec ta capacité. Continue comme ça !");
    } else if (latestEwma.ratio > 1.5) {
      msgs.push("⚠️ Attention : surcharge détectée. Pense à optimiser ta récupération (sommeil, nutrition, hydratation).");
    } else if (latestEwma.ratio > 1.3) {
      msgs.push("🔶 Ta charge augmente. Reste attentif à tes sensations et communique avec ton staff.");
    } else if (latestEwma.ratio < 0.8) {
      msgs.push("📉 Charge en baisse — risque de désentraînement. Parle à ton préparateur physique.");
    }

    const last3 = ewmaResults.slice(-3);
    if (last3.length === 3 && last3.every(r => r.ratio > 1.3)) {
      msgs.push("🚨 Surcharge détectée sur 3 semaines consécutives. Une période de récupération est recommandée.");
    }

    if (todayWellness) {
      if ((todayWellness.sleep_quality || 0) >= 4) {
        msgs.push("😴 Ton sommeil était insuffisant. Essaye de dormir 8h+ cette nuit.");
      }
      if ((todayWellness.general_fatigue || 0) >= 4) {
        msgs.push("🔋 Niveau de fatigue élevé. Privilégie la récupération active aujourd'hui.");
      }
    } else {
      msgs.push("💡 N'oublie pas de remplir ton wellness quotidien pour un suivi optimal.");
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

      {/* Status + EWMA */}
      <Card className="shadow-md border-2" style={{ borderColor: `${NAV_COLORS.performance.base}40`, backgroundColor: `${NAV_COLORS.performance.base}08` }}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Statut du jour</p>
              <Badge className={`text-base px-4 py-1.5 ${dayStatus.color}`}>
                <dayStatus.icon className="h-4 w-4 mr-1.5" />
                {dayStatus.label}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Ratio EWMA</p>
              <p className={`text-3xl font-bold ${
                latestEwma
                  ? latestEwma.ratio >= 0.85 && latestEwma.ratio <= 1.3
                    ? "text-status-optimal"
                    : latestEwma.ratio > 1.5 || latestEwma.ratio < 0.8
                    ? "text-destructive"
                    : "text-warning"
                  : "text-muted-foreground"
              }`}>
                {latestEwma ? latestEwma.ratio.toFixed(2) : "—"}
              </p>
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
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Prochain match</p>
                <p className="font-bold text-base" style={{ color: NAV_COLORS.video.base }}>
                  {nextMatch.opponent || "Compétition"}
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
                  {nextMatch.is_home ? "Dom." : "Ext."}
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
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Charge 7j</p>
            <p className="text-xl font-bold" style={{ color: NAV_COLORS.sante.base }}>{latestEwma ? Math.round(latestEwma.acute) : "—"}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-2" style={{ borderColor: `${NAV_COLORS.programmation.base}40`, backgroundColor: `${NAV_COLORS.programmation.base}08` }}>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Charge 28j</p>
            <p className="text-xl font-bold" style={{ color: NAV_COLORS.programmation.base }}>{latestEwma ? Math.round(latestEwma.chronic) : "—"}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-2" style={{ borderColor: `${NAV_COLORS.video.base}40`, backgroundColor: `${NAV_COLORS.video.base}08` }}>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Blessures</p>
            <p className={`text-xl font-bold`} style={{ color: injuries && injuries.length > 0 ? NAV_COLORS.video.base : NAV_COLORS.sante.base }}>
              {injuries?.length || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-2" style={{ borderColor: `${NAV_COLORS.planification.base}40`, backgroundColor: `${NAV_COLORS.planification.base}08` }}>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Prochain test</p>
            {nextTest ? (
              <>
                <p className="text-sm font-semibold leading-tight" style={{ color: NAV_COLORS.planification.base }}>
                  {nextTest.testLabel || "Test"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {format(new Date(nextTest.session_date), "d MMM", { locale: fr })}
                  {nextTest.session_start_time ? ` • ${nextTest.session_start_time.slice(0, 5)}` : ""}
                </p>
              </>
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
              Séances à venir
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
                      {s.theme || getTrainingTypeLabel(s.training_type)}
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

      {/* Feedback */}
      <Card className="shadow-md border-2" style={{ borderColor: `${NAV_COLORS.gps.base}40`, backgroundColor: `${NAV_COLORS.gps.base}08` }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2" style={{ color: NAV_COLORS.gps.base }}>
            <TrendingUp className="h-4 w-4" />
            Feedback personnalisé
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {feedback.map((msg, i) => (
              <p key={i} className="text-sm leading-relaxed">{msg}</p>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
