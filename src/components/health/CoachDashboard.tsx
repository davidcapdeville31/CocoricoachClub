import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EditInjuryDialog } from "@/components/injuries/EditInjuryDialog";
import { EditIllnessDialog } from "@/components/injuries/EditIllnessDialog";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Cake,
  Syringe,
  HeartPulse,
  Pencil,
  Trash2,
} from "lucide-react";

import { format, differenceInDays, addDays, isSameMonth, parseISO, isValid } from "date-fns";

const safeFormat = (date: Date | string | null | undefined, fmt: string, options?: any): string => {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  return isValid(d) ? format(d, fmt, options) : "N/A";
};

const formatPlayerName = (player: any): string => {
  if (!player) return "—";
  const first = (player.first_name || "").trim();
  const last = (player.name || "").trim();
  if (!first && !last) return "—";
  return [last, first].filter(Boolean).join(" ").trim();
};

const safeDiffDays = (dateLeft: Date | string | null | undefined, dateRight: Date): number => {
  if (!dateLeft) return 0;
  const d = typeof dateLeft === "string" ? new Date(dateLeft) : dateLeft;
  return isValid(d) ? differenceInDays(d, dateRight) : 0;
};

interface CoachDashboardProps {
  categoryId: string;
}

// Clickable stat card: shows the list of athletes belonging to the block
const ClickableStatCard = ({
  title,
  names,
  children,
}: {
  title: string;
  names: string[];
  children: ReactNode;
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <button type="button" className="text-left w-full h-full cursor-pointer rounded-xl transition-shadow hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        {children}
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-80 p-0 overflow-hidden" align="start">
      <div className="p-3 border-b bg-muted/30">
        <p className="font-semibold text-sm">{title}</p>
      </div>
      <div className="h-80 overflow-y-auto p-3">
        {names.length > 0 ? (
          <ul className="space-y-1.5">
            {names.map((n, i) => (
              <li key={`${n}-${i}`} className="text-sm py-1.5 px-2 rounded bg-muted/50">{n}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">—</p>
        )}
      </div>
    </PopoverContent>
  </Popover>
);

import { useSeasonFilteredPlayerIds, makePlayerIdFilter } from "@/hooks/use-season-filtered-players";
import { useMemo as useMemoCoachDash } from "react";

export function CoachDashboard({ categoryId }: CoachDashboardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingInjury, setEditingInjury] = useState<any>(null);
  const [editingIllness, setEditingIllness] = useState<any>(null);
  const { allowedIds } = useSeasonFilteredPlayerIds(categoryId);
  const keepPlayer = makePlayerIdFilter(allowedIds);

  const deleteInjury = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("injuries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active_injuries", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["injuries", categoryId] });
      toast.success(t("health.coachDashboard.toastInjuryDeleted"));
    },
    onError: (e: any) => toast.error(e?.message || t("health.coachDashboard.toastError")),
  });

  const deleteIllness = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("illnesses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active_illnesses", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["illnesses", categoryId] });
      toast.success(t("health.coachDashboard.toastIllnessDeleted"));
    },
    onError: (e: any) => toast.error(e?.message || t("health.coachDashboard.toastError")),
  });

  // Realtime sync for EWMA, wellness, and AWCR
  useRealtimeSync({
    tables: ["awcr_tracking", "wellness_tracking"],
    categoryId,
    queryKeys: [
      ["ewma_summary", categoryId],
      ["awcr-risk", categoryId],
      ["wellness_tracking", categoryId],
    ],
    channelName: `coach-dashboard-sync-${categoryId}`,
  });

  // Fetch players
  const { data: playersRaw } = useQuery({
    queryKey: ["players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  const players = useMemoCoachDash(
    () => (playersRaw || []).filter((p: any) => keepPlayer(p.id)),
    [playersRaw, allowedIds],
  );

  // Fetch active injuries
  const { data: injuriesRaw } = useQuery({
    queryKey: ["active_injuries", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("injuries")
        .select("*, players(name)")
        .eq("category_id", categoryId)
        .neq("status", "healed")
        .order("injury_date", { ascending: false });
      if (error) {
        console.warn("Injuries query error:", error.message);
        return [];
      }
      return data;
    },
    retry: 1,
  });
  const injuries = useMemoCoachDash(
    () => (injuriesRaw || []).filter((i: any) => keepPlayer(i.player_id)),
    [injuriesRaw, allowedIds],
  );

  // Fetch active illnesses
  const { data: illnessesRaw } = useQuery({
    queryKey: ["active_illnesses", categoryId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("illnesses")
        .select("*, players(name)")
        .eq("category_id", categoryId)
        .neq("status", "healed")
        .order("illness_date", { ascending: false });
      if (error) {
        console.warn("Illnesses query error:", error.message);
        return [];
      }
      return data || [];
    },
    retry: 1,
  });
  const illnesses = useMemoCoachDash(
    () => (illnessesRaw || []).filter((i: any) => keepPlayer(i.player_id)),
    [illnessesRaw, allowedIds],
  );

  // Fetch EWMA data (replacing AWCR) - limit to last 60 days for performance
  const { data: ewmaDataRaw } = useQuery({
    queryKey: ["ewma_summary", categoryId],
    queryFn: async () => {
      const sixtyDaysAgo = format(addDays(new Date(), -60), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("awcr_tracking")
        .select("player_id, session_date, awcr, acute_load, chronic_load, players(name, first_name)")
        .eq("category_id", categoryId)
        .gte("session_date", sixtyDaysAgo)
        .order("session_date", { ascending: false });
      if (error) {
        console.warn("EWMA query error:", error.message);
        return {};
      }

      // Get latest EWMA per player - use the stored awcr field (correct EWMA ratio)
      const latestByPlayer: Record<
        string,
        { ewmaRatio: number; acute: number; chronic: number; name: string; date: string; historyDays: number }
      > = {};
      const daysByPlayer: Record<string, Set<string>> = {};
      data?.forEach((entry: any) => {
        (daysByPlayer[entry.player_id] ||= new Set()).add(entry.session_date);
        if (!latestByPlayer[entry.player_id] && entry.awcr != null) {
          const playerName = formatPlayerName(entry.players);
          latestByPlayer[entry.player_id] = {
            ewmaRatio: Number(entry.awcr),
            acute: Number(entry.acute_load) || 0,
            chronic: Number(entry.chronic_load) || 0,
            name: playerName,
            date: entry.session_date,
            historyDays: 0,
          };
        }
      });
      Object.keys(latestByPlayer).forEach((pid) => {
        latestByPlayer[pid].historyDays = daysByPlayer[pid]?.size || 0;
      });
      return latestByPlayer;
    },
    retry: 1,
  });

  const ewmaData = useMemoCoachDash(() => {
    if (!ewmaDataRaw) return ewmaDataRaw;
    if (!allowedIds) return ewmaDataRaw;
    const out: Record<string, any> = {};
    Object.entries(ewmaDataRaw).forEach(([pid, v]) => {
      if (keepPlayer(pid)) out[pid] = v;
    });
    return out;
  }, [ewmaDataRaw, allowedIds]);

  // Fetch wellness data
  const { data: wellnessDataRaw } = useQuery({
    queryKey: ["wellness_summary", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_tracking")
        .select("*, players(name)")
        .eq("category_id", categoryId)
        .gte("tracking_date", format(addDays(new Date(), -7), "yyyy-MM-dd"))
        .order("tracking_date", { ascending: false });
      if (error) {
        console.warn("Wellness query error:", error.message);
        return [];
      }
      return data;
    },
    retry: 1,
  });
  const wellnessData = useMemoCoachDash(
    () => (wellnessDataRaw || []).filter((w: any) => keepPlayer(w.player_id)),
    [wellnessDataRaw, allowedIds],
  );

  // Fetch medical records due soon
  const { data: medicalRecordsRaw } = useQuery({
    queryKey: ["medical_due_soon", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medical_records")
        .select("*, players(name)")
        .eq("category_id", categoryId)
        .lte("next_due_date", format(addDays(new Date(), 30), "yyyy-MM-dd"))
        .order("next_due_date");
      if (error) {
        console.warn("Medical records query error:", error.message);
        return [];
      }
      return data;
    },
    retry: 1,
  });
  const medicalRecords = useMemoCoachDash(
    () => (medicalRecordsRaw || []).filter((m: any) => keepPlayer(m.player_id)),
    [medicalRecordsRaw, allowedIds],
  );

  // Fetch RTP protocols in progress
  const { data: rtpProtocolsRaw } = useQuery({
    queryKey: ["rtp_in_progress", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("return_to_play_protocols")
        .select("*, players(name), injuries(injury_type)")
        .eq("category_id", categoryId)
        .eq("status", "in_progress");
      if (error) {
        console.warn("RTP query error:", error.message);
        return [];
      }
      return data;
    },
    retry: 1,
  });
  const rtpProtocols = useMemoCoachDash(
    () => (rtpProtocolsRaw || []).filter((r: any) => keepPlayer(r.player_id)),
    [rtpProtocolsRaw, allowedIds],
  );

  // Calculate stats — combine injuries + illnesses, dedup by player
  const totalPlayers = players?.length || 0;
  const injuredPlayers = injuries?.length || 0;
  const sickPlayers = illnesses?.length || 0;
  const unavailableIds = new Set<string>([
    ...((injuries || []).map((i: any) => i.player_id as string)),
    ...((illnesses || []).map((i: any) => i.player_id as string)),
  ]);
  const unavailableCount = unavailableIds.size;
  const availablePlayers = totalPlayers - unavailableCount;
  const availabilityRate = totalPlayers > 0 ? (availablePlayers / totalPlayers) * 100 : 0;

  // EWMA analysis (replacing AWCR)
  // Only keep reliable ratios: enough chronic load, at least 21 days of history,
  // and a recent data point (< 10 days) so stale values don't pollute the buckets.
  const MIN_CHRONIC_LOAD = 50;
  const MIN_HISTORY_DAYS = 21;
  const MAX_STALE_DAYS = 10;
  const staleLimit = format(addDays(new Date(), -MAX_STALE_DAYS), "yyyy-MM-dd");
  const allEwmaEntries = Object.values(ewmaData || {}) as any[];
  const ewmaValues = allEwmaEntries.filter(
    (p) =>
      p.chronic >= MIN_CHRONIC_LOAD &&
      (p.historyDays ?? 0) >= MIN_HISTORY_DAYS &&
      (!p.date || p.date >= staleLimit),
  );
  const excludedEwmaCount = allEwmaEntries.length - ewmaValues.length;
  const highEwma = ewmaValues.filter((p) => p.ewmaRatio > 1.3);
  const lowEwma = ewmaValues.filter((p) => p.ewmaRatio < 0.85);
  const optimalEwma = ewmaValues.filter((p) => p.ewmaRatio >= 0.85 && p.ewmaRatio <= 1.3);


  // Wellness analysis - get latest per player
  const latestWellness: Record<string, any> = {};
  wellnessData?.forEach((entry: any) => {
    if (!latestWellness[entry.player_id]) {
      latestWellness[entry.player_id] = entry;
    }
  });
  
  const lowWellnessPlayers = Object.values(latestWellness).filter((w: any) => {
    // Normalize all metrics so that high = good (optimal)
    // All metrics use same polarity: 1=good, 5=bad → invert all (6 - value)
    const normalizedScore = (
      (6 - (w.sleep_quality || 3)) + 
      (6 - (w.general_fatigue || 3)) + 
      (6 - (w.stress_level || 3)) + 
      (6 - (w.soreness_upper_body || 3)) + 
      (6 - (w.soreness_lower_body || 3))
    ) / 5;
    return normalizedScore < 2.5;
  });

  // Athlete name lists for each clickable stat block
  const playerNameById = new Map<string, string>((players || []).map((p: any) => [p.id, formatPlayerName(p)]));
  const resolveName = (id: string | undefined, fallback?: any) =>
    (id && playerNameById.get(id)) || formatPlayerName(fallback) || "—";
  const availableNames = (players || [])
    .filter((p: any) => !unavailableIds.has(p.id))
    .map((p: any) => formatPlayerName(p))
    .sort((a: string, b: string) => a.localeCompare(b, "fr"));
  const injuredSickNames = [
    ...((injuries || []).map((i: any) => resolveName(i.player_id, i.players))),
    ...((illnesses || []).map((i: any) => resolveName(i.player_id, i.players))),
  ];
  const highEwmaNames = highEwma.map((p: any) => p.name || "—");
  const lowWellnessNames = lowWellnessPlayers.map((w: any) => resolveName(w.player_id, w.players));

  // Birthdays this month
  const birthdaysThisMonth = players?.filter((p) => {
    if (!p.birth_date) return false;
    const birthDate = parseISO(p.birth_date);
    return isValid(birthDate) && isSameMonth(birthDate, new Date());
  });

  // Medical records stats
  const expiredMedical = medicalRecords?.filter((r) => {
    return safeDiffDays(r.next_due_date, new Date()) < 0;
  });
  const dueSoonMedical = medicalRecords?.filter((r) => {
    const days = safeDiffDays(r.next_due_date, new Date());
    return days >= 0 && days <= 30;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t("health.coachDashboard.title")}</h2>
        <p className="text-muted-foreground">{t("health.coachDashboard.subtitle")}</p>
      </div>

      {/* Main KPIs + Rappels */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <ClickableStatCard title={t("health.coachDashboard.availability")} names={availableNames}>
        <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30 h-full">
          <CardHeader className="pb-1 px-3 pt-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {t("health.coachDashboard.availability")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-2xl font-bold text-green-600">
              {availablePlayers}/{totalPlayers}
            </div>
            <Progress value={availabilityRate} className="mt-1.5 h-1.5" />
            <p className="text-[10px] text-muted-foreground mt-1">
              {t("health.coachDashboard.availablePercent", { percent: availabilityRate.toFixed(0) })}
            </p>
          </CardContent>
        </Card>
        </ClickableStatCard>

        <ClickableStatCard title={t("health.coachDashboard.injuriesIllnesses")} names={injuredSickNames}>
        <Card className="bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/30 h-full">
          <CardHeader className="pb-1 px-3 pt-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              {t("health.coachDashboard.injuriesIllnesses")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-2xl font-bold text-red-600">{injuredPlayers + sickPlayers}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {t("health.coachDashboard.injuredCount", { count: injuredPlayers, plural: injuredPlayers > 1 ? "s" : "" })} · {t("health.coachDashboard.sickCount", { count: sickPlayers, plural: sickPlayers > 1 ? "s" : "" })}
            </p>
          </CardContent>
        </Card>
        </ClickableStatCard>

        <ClickableStatCard title={t("health.coachDashboard.highEwma")} names={highEwmaNames}>
        <Card className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-orange-500/30 h-full">
          <CardHeader className="pb-1 px-3 pt-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              {t("health.coachDashboard.highEwma")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-2xl font-bold text-orange-600">{highEwma.length}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {t("health.coachDashboard.overloadRisk")}
            </p>
          </CardContent>
        </Card>
        </ClickableStatCard>

        <ClickableStatCard title={t("health.coachDashboard.lowWellness")} names={lowWellnessNames}>
        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30 h-full">
          <CardHeader className="pb-1 px-3 pt-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <HeartPulse className="h-3.5 w-3.5" />
              {t("health.coachDashboard.lowWellness")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-2xl font-bold text-blue-600">{lowWellnessPlayers.length}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {t("health.coachDashboard.attentionRequired")}
            </p>
          </CardContent>
        </Card>
        </ClickableStatCard>

        {/* Rappels à venir - compact */}
        <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30">
          <CardHeader className="pb-1 px-3 pt-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {t("health.coachDashboard.upcomingReminders")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-2xl font-bold text-purple-600">
              {(dueSoonMedical?.length || 0) + (rtpProtocols?.length || 0) + (birthdaysThisMonth?.length || 0)}
            </div>
            <ScrollArea className="h-[90px] mt-1.5">
              <div className="space-y-1">
                {dueSoonMedical?.map((record) => (
                  <div key={record.id} className="flex items-center gap-1.5 text-[10px]">
                    <Syringe className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{formatPlayerName(record.players)}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                      {safeDiffDays(record.next_due_date, new Date())}j
                    </Badge>
                  </div>
                ))}
                {rtpProtocols?.map((protocol: any) => (
                  <div key={protocol.id} className="flex items-center gap-1.5 text-[10px]">
                    <Activity className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{formatPlayerName(protocol.players)}</span>
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">RTP</Badge>
                  </div>
                ))}
                {birthdaysThisMonth?.map((player) => (
                  <div key={player.id} className="flex items-center gap-1.5 text-[10px]">
                    <Cake className="h-3 w-3 text-pink-500 shrink-0" />
                    <span className="truncate flex-1">{formatPlayerName(player)}</span>
                    <span className="text-[9px] text-muted-foreground">
                      {safeFormat(player.birth_date ? parseISO(player.birth_date) : null, "dd/MM", { locale: getDateLocale() })}
                    </span>
                  </div>
                ))}
                {(!dueSoonMedical?.length && !rtpProtocols?.length && !birthdaysThisMonth?.length) && (
                  <p className="text-center text-[10px] text-muted-foreground py-2">
                    {t("health.coachDashboard.noReminders")}
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Active injuries & illnesses detail */}
      {((injuries && injuries.length > 0) || (illnesses && illnesses.length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("health.coachDashboard.activeInjuriesIllnesses")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {injuries?.map((injury: any) => {
                const injuryDate = injury.injury_date ? new Date(injury.injury_date) : null;
                const daysOut = injuryDate ? differenceInDays(new Date(), injuryDate) : null;
                return (
                  <div key={`inj-${injury.id}`} className="p-4 border rounded-lg space-y-3">
                    <div className="flex justify-between items-start">
                    <div>
                        <p className="font-semibold text-base">{formatPlayerName(injury.players)}</p>
                        <p className="text-sm text-destructive font-medium">{injury.injury_type}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant={injury.status === "active" ? "destructive" : "secondary"}>
                          {injury.status === "active" ? t("health.coachDashboard.injured") : t("health.coachDashboard.rehab")}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingInjury(injury)} title={t("health.coachDashboard.edit")}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" title={t("health.coachDashboard.delete")}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("health.coachDashboard.deleteInjuryTitle")}</AlertDialogTitle>
                              <AlertDialogDescription>{t("health.coachDashboard.deleteIrreversible")}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("health.coachDashboard.cancel")}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteInjury.mutate(injury.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("health.coachDashboard.delete")}</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>

                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-foreground">{t("health.coachDashboard.injuredOn")}</span>
                        <span>{safeFormat(injury.injury_date, "EEEE dd MMMM yyyy", { locale: getDateLocale() })}</span>
                      </div>
                      {daysOut !== null && (
                        <p>{t("health.coachDashboard.absentSince", { days: daysOut, plural: daysOut > 1 ? "s" : "" })}</p>
                      )}
                      {injury.estimated_return_date && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-foreground">{t("health.coachDashboard.estimatedReturn")}</span>
                          <span>{safeFormat(injury.estimated_return_date, "EEEE dd MMMM yyyy", { locale: getDateLocale() })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {illnesses?.map((illness: any) => {
                const ilDate = illness.illness_date ? new Date(illness.illness_date) : null;
                const daysOut = ilDate ? differenceInDays(new Date(), ilDate) : null;
                return (
                  <div key={`ill-${illness.id}`} className="p-4 border rounded-lg space-y-3 bg-orange-500/5 border-orange-500/30">
                    <div className="flex justify-between items-start">
                    <div>
                        <p className="font-semibold text-base">{formatPlayerName(illness.players)}</p>
                        <p className="text-sm text-orange-600 font-medium">{illness.illness_type}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge className="bg-orange-500 text-white hover:bg-orange-500">{t("health.coachDashboard.sick")}</Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingIllness(illness)} title={t("health.coachDashboard.edit")}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" title={t("health.coachDashboard.delete")}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("health.coachDashboard.deleteIllnessTitle")}</AlertDialogTitle>
                              <AlertDialogDescription>{t("health.coachDashboard.deleteIrreversible")}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("health.coachDashboard.cancel")}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteIllness.mutate(illness.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("health.coachDashboard.delete")}</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>

                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-foreground">{t("health.coachDashboard.illOn")}</span>
                        <span>{safeFormat(illness.illness_date, "EEEE dd MMMM yyyy", { locale: getDateLocale() })}</span>
                      </div>
                      {daysOut !== null && (
                        <p>{t("health.coachDashboard.absentSince", { days: daysOut, plural: daysOut > 1 ? "s" : "" })}</p>
                      )}
                      {illness.estimated_return_date && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-foreground">{t("health.coachDashboard.estimatedReturn")}</span>
                          <span>{safeFormat(illness.estimated_return_date, "EEEE dd MMMM yyyy", { locale: getDateLocale() })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* EWMA distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("health.coachDashboard.ewmaDistribution")}</CardTitle>
        </CardHeader>
        <CardContent>
          {ewmaValues.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="font-medium">{t("health.coachDashboard.noEwmaData")}</p>
              <p className="text-sm mt-1">
                {t("health.coachDashboard.noEwmaDataHint")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Sous-entraînés */}
              <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20 flex flex-col">
                <div className="text-center mb-3">
                  <p className="text-2xl font-bold text-blue-600">{lowEwma.length}</p>
                  <p className="text-sm text-muted-foreground">{t("health.coachDashboard.undertrained")}</p>
                </div>
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                  {lowEwma.length === 0 ? (
                    <p className="text-xs text-center text-muted-foreground italic py-2">{t("health.coachDashboard.noPlayer")}</p>
                  ) : (
                    [...lowEwma]
                      .sort((a, b) => a.ewmaRatio - b.ewmaRatio)
                      .map((p, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 bg-background/60 rounded-md text-xs"
                        >
                          <span className="font-medium truncate">{p.name}</span>
                          <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-600 shrink-0">
                            {p.ewmaRatio.toFixed(2)}
                          </Badge>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Zone optimale */}
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20 flex flex-col">
                <div className="text-center mb-3">
                  <p className="text-2xl font-bold text-green-600">{optimalEwma.length}</p>
                  <p className="text-sm text-muted-foreground">{t("health.coachDashboard.optimalZone")}</p>
                </div>
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                  {optimalEwma.length === 0 ? (
                    <p className="text-xs text-center text-muted-foreground italic py-2">{t("health.coachDashboard.noPlayer")}</p>
                  ) : (
                    [...optimalEwma]
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((p, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 bg-background/60 rounded-md text-xs"
                        >
                          <span className="font-medium truncate">{p.name}</span>
                          <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-600 shrink-0">
                            {p.ewmaRatio.toFixed(2)}
                          </Badge>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Surcharge */}
              <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/20 flex flex-col">
                <div className="text-center mb-3">
                  <p className="text-2xl font-bold text-orange-600">{highEwma.length}</p>
                  <p className="text-sm text-muted-foreground">{t("health.coachDashboard.overtrained")}</p>
                </div>
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                  {highEwma.length === 0 ? (
                    <p className="text-xs text-center text-muted-foreground italic py-2">{t("health.coachDashboard.noPlayer")}</p>
                  ) : (
                    [...highEwma]
                      .sort((a, b) => b.ewmaRatio - a.ewmaRatio)
                      .map((p, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 bg-background/60 rounded-md text-xs"
                        >
                          <span className="font-medium truncate">{p.name}</span>
                          <Badge variant="outline" className="text-[10px] border-orange-500/40 text-orange-600 shrink-0">
                            {p.ewmaRatio.toFixed(2)}
                          </Badge>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          )}
          {ewmaValues.length > 0 && (
            <p className="text-xs text-muted-foreground mt-4">
              {ewmaValues.length} athlète{ewmaValues.length > 1 ? "s" : ""} analysé
              {ewmaValues.length > 1 ? "s" : ""} · zone optimale 0.85 – 1.30
              {excludedEwmaCount > 0 && (
                <> · {excludedEwmaCount} exclu{excludedEwmaCount > 1 ? "s" : ""} (moins de 21 jours d'historique, charge chronique insuffisante ou données de plus de 10 jours)</>
              )}
            </p>
          )}

        </CardContent>
      </Card>

      {editingInjury && (
        <EditInjuryDialog
          open={!!editingInjury}
          onOpenChange={(o) => !o && setEditingInjury(null)}
          injury={editingInjury}
        />
      )}
      {editingIllness && (
        <EditIllnessDialog
          open={!!editingIllness}
          onOpenChange={(o) => !o && setEditingIllness(null)}
          illness={editingIllness}
        />
      )}
    </div>
  );
}

