import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, HelpCircle, Filter, Trophy, Users } from "lucide-react";
import { format, parseISO, subMonths, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ParticipantsAttendanceList } from "./ParticipantsAttendanceList";
import { useTranslation } from "react-i18next";

interface MatchAttendanceTabProps {
  categoryId: string;
}

export function MatchAttendanceTab({ categoryId }: MatchAttendanceTabProps) {
  const { t } = useTranslation();
  const [detailMatchId, setDetailMatchId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => format(subMonths(new Date(), 1), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return format(d, "yyyy-MM-dd");
  });

  const { data: matches } = useQuery({
    queryKey: ["matches_attendance", categoryId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("id, match_date, match_time, opponent, competition, is_home")
        .eq("category_id", categoryId)
        .gte("match_date", startDate)
        .lte("match_date", endDate)
        .order("match_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const matchIds = useMemo(() => (matches || []).map((m) => m.id), [matches]);

  const { data: participants } = useQuery({
    queryKey: ["match_participants_attendance", categoryId, matchIds.join(",")],
    enabled: matchIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_participants")
        .select(
          "id, match_id, player_id, attendance_status, absence_comment, responded_at, players:player_id(id, name, first_name, avatar_url)",
        )
        .in("match_id", matchIds);
      if (error) throw error;
      return data || [];
    },
  });

  const all = participants || [];
  const presentCount = all.filter((p) => p.attendance_status === "present").length;
  const absentCount = all.filter((p) => p.attendance_status === "absent").length;
  const noResponseCount = all.filter((p) => !p.attendance_status || p.attendance_status === "no_response").length;

  const matchLabel = (m: any) =>
    `${format(parseISO(m.match_date), "dd MMM yyyy", { locale: getDateLocale() })} — ${m.opponent}${
      m.competition ? ` (${m.competition})` : ""
    }${m.is_home === true ? " 🏠" : m.is_home === false ? " ✈️" : ""}`;

  const detailMatch = (matches || []).find((m) => m.id === detailMatchId) || null;
  const detailParticipants = detailMatchId ? all.filter((p) => p.match_id === detailMatchId) : [];

  // Per-player aggregation
  const playerStats = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; present: number; absent: number; noResponse: number; total: number }
    >();
    all.forEach((p: any) => {
      const name = p.players?.first_name
        ? `${p.players.first_name} ${p.players.name ?? ""}`.trim()
        : p.players?.name || t("adminAttendance.participants.defaultAthlete");
      const entry = map.get(p.player_id) || {
        id: p.player_id,
        name,
        present: 0,
        absent: 0,
        noResponse: 0,
        total: 0,
      };
      if (p.attendance_status === "present") entry.present += 1;
      else if (p.attendance_status === "absent") entry.absent += 1;
      else entry.noResponse += 1;
      entry.total += 1;
      map.set(p.player_id, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.present - a.present);
  }, [all]);

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
        start = new Date(now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1, 8, 1);
        break;
      }
    }
    setStartDate(format(start, "yyyy-MM-dd"));
    setEndDate(format(end, "yyyy-MM-dd"));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t("adminAttendance.match.period")}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
              <span className="text-muted-foreground">{t("adminAttendance.match.to")}</span>
              <Input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setDatePreset("week")}>{t("adminAttendance.match.preset7d")}</Button>
              <Button variant="outline" size="sm" onClick={() => setDatePreset("month")}>{t("adminAttendance.match.presetMonth")}</Button>
              <Button variant="outline" size="sm" onClick={() => setDatePreset("3months")}>{t("adminAttendance.match.preset3m")}</Button>
              <Button variant="outline" size="sm" onClick={() => setDatePreset("season")}>{t("adminAttendance.match.presetSeason")}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Trophy className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("adminAttendance.match.competitions")}</p>
                <p className="text-2xl font-bold">{matches?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/15 rounded-lg">
                <Check className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("adminAttendance.match.present")}</p>
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
                <p className="text-sm text-muted-foreground">{t("adminAttendance.match.absent")}</p>
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
                <p className="text-sm text-muted-foreground">{t("adminAttendance.match.noResponse")}</p>
                <p className="text-2xl font-bold">{noResponseCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-5 w-5" />
            {t("adminAttendance.match.detailByCompetition")}
          </CardTitle>
          <CardDescription>
            {t("adminAttendance.match.selectCompetitionHint")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!matches || matches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("adminAttendance.match.noCompetitionInPeriod")}</p>
          ) : (
            <>
              <Select value={detailMatchId ?? ""} onValueChange={(v) => setDetailMatchId(v || null)}>
                <SelectTrigger className="w-full sm:w-[460px]">
                  <SelectValue placeholder={t("adminAttendance.match.chooseCompetition")} />
                </SelectTrigger>
                <SelectContent>
                  {matches.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {matchLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {detailMatch && (
                <ParticipantsAttendanceList
                  participants={detailParticipants as any}
                  title={t("adminAttendance.match.convocatedFor", { opponent: detailMatch.opponent })}
                  emptyLabel={t("adminAttendance.match.noAthleteConvocated")}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" />
            {t("adminAttendance.match.playerStats")}
          </CardTitle>
          <CardDescription>
            {t("adminAttendance.match.fromTo", { from: format(parseISO(startDate), "dd/MM/yyyy"), to: format(parseISO(endDate), "dd/MM/yyyy") })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {playerStats.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("adminAttendance.match.noConvocationInPeriod")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("adminAttendance.match.athlete")}</TableHead>
                    <TableHead className="text-center">{t("adminAttendance.match.present2")}</TableHead>
                    <TableHead className="text-center">{t("adminAttendance.match.absent2")}</TableHead>
                    <TableHead className="text-center">{t("adminAttendance.match.noResponse2")}</TableHead>
                    <TableHead className="text-center">{t("adminAttendance.match.convocations")}</TableHead>
                    <TableHead className="text-center">{t("adminAttendance.match.rate")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {playerStats.map((p) => {
                    const rate = p.total > 0 ? Math.round((p.present / p.total) * 100) : 0;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-center text-emerald-600 font-medium">{p.present}</TableCell>
                        <TableCell className="text-center text-rose-600 font-medium">{p.absent}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{p.noResponse}</TableCell>
                        <TableCell className="text-center">{p.total}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={
                              rate >= 90
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                : rate >= 75
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                  : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                            }
                          >
                            {rate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
