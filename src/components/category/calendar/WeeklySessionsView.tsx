import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, Clock, Swords, Dumbbell, Printer, User } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { TRAINING_TYPE_COLORS, getTrainingTypeLabel } from "@/lib/constants/trainingTypes";
import { isIndividualSport } from "@/lib/constants/sportTypes";
import { getCompetitionColor } from "@/lib/constants/competitionColors";
import { printElement } from "@/lib/pdfExport";
import { useTranslation } from "react-i18next";

interface Session {
  id: string;
  session_date: string;
  session_start_time: string | null;
  session_end_time: string | null;
  training_type: string;
  intensity: number | null;
  notes: string | null;
  created_by_player_id?: string | null;
}

interface Match {
  id: string;
  match_date: string;
  match_time: string | null;
  opponent: string;
  location: string | null;
  is_home: boolean | null;
  competition?: string | null;
}

interface WeeklySessionsViewProps {
  sessions: Session[];
  matches: Match[];
  sportType: string | undefined;
  currentWeek: Date;
  onWeekChange: (date: Date) => void;
  onViewSession: (session: Session) => void;
  onViewMatch: (match: Match) => void;
  playerNamesMap?: Record<string, string>;
}

export function WeeklySessionsView({
  sessions,
  matches,
  sportType,
  currentWeek,
  onWeekChange,
  onViewSession,
  onViewMatch,
  playerNamesMap,
}: WeeklySessionsViewProps) {
  const { t } = useTranslation();
  const DAYS_OF_WEEK_RAW = t("planning.calendarViews.daysFull", { returnObjects: true });
  const DAYS_OF_WEEK = Array.isArray(DAYS_OF_WEEK_RAW) ? (DAYS_OF_WEEK_RAW as string[]) : ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Calculate week number
  const weekNumber = useMemo(() => {
    const yearStart = new Date(currentWeek.getFullYear(), 0, 1);
    return Math.ceil(((currentWeek.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
  }, [currentWeek]);

  const getSessionsForDay = (day: Date) => {
    return sessions.filter((session) => isSameDay(new Date(session.session_date), day));
  };

  const getMatchesForDay = (day: Date) => {
    return matches.filter((match) => isSameDay(new Date(match.match_date), day));
  };

  const weeklyCalendarRef = useRef<HTMLDivElement>(null);

  const handlePrintWeekly = () => {
    if (weeklyCalendarRef.current) {
      printElement(weeklyCalendarRef.current, t("planning.calendarViews.weekly.printTitle", { number: weekNumber }));
    }
  };

  return (
    <Card className="bg-gradient-card shadow-md mt-4">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">{t("planning.calendarViews.weekly.titlePrefix")}</span> {t("planning.calendarViews.weekly.weekLabel", { number: weekNumber })}
          </CardTitle>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handlePrintWeekly}
              title={t("planning.calendarViews.weekly.printWeek")}
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onWeekChange(subWeeks(currentWeek, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs sm:text-sm font-medium min-w-[140px] sm:min-w-[180px] text-center">
              {format(weekStart, "d", { locale: getDateLocale() })} - {format(weekEnd, "d MMMM yyyy", { locale: getDateLocale() })}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onWeekChange(addWeeks(currentWeek, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={weeklyCalendarRef} className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 print:grid-cols-7 print:gap-1">
          {weekDays.map((day, index) => {
            const daySessions = getSessionsForDay(day);
            const dayMatches = getMatchesForDay(day);
            const isToday = isSameDay(day, new Date());
            const hasEvents = daySessions.length > 0 || dayMatches.length > 0;

            return (
              <div
                key={index}
                className={cn(
                  "min-h-[120px] p-2 rounded-lg border transition-colors",
                  isToday ? "border-primary bg-primary/5" : "border-border",
                  !hasEvents && "bg-muted/20"
                )}
              >
                {/* Day header */}
                <div className="text-center mb-2">
                  <p className={cn(
                    "text-xs font-medium",
                    isToday ? "text-primary" : "text-muted-foreground"
                  )}>
                    {DAYS_OF_WEEK[index].slice(0, 3)}
                  </p>
                  <p className={cn(
                    "text-lg font-bold",
                    isToday ? "text-primary" : "text-foreground"
                  )}>
                    {format(day, "d")}
                  </p>
                </div>

                {/* Events */}
                <div className="space-y-1.5">
                  {/* Matches */}
                  {dayMatches.map((match) => {
                    const compColor = getCompetitionColor(match.competition);
                    const compLabel = match.competition?.trim() || null;
                    return (
                    <div
                      key={match.id}
                      onClick={() => onViewMatch(match)}
                      className={cn(
                        "p-1.5 rounded cursor-pointer transition-colors text-white",
                        compColor.bg,
                        compColor.bgHover
                      )}
                      title={compLabel ? `${compLabel} · ${match.opponent}` : match.opponent}
                    >
                      <div className="flex items-center gap-1 text-xs">
                        <Swords className="h-3 w-3 shrink-0" />
                        <span className="font-medium truncate">
                          {compLabel ? compLabel : `${match.is_home ? "vs" : "@"} ${match.opponent.slice(0, 10)}`}
                        </span>
                      </div>
                      {match.match_time && (
                        <p className="text-[10px] opacity-90 mt-0.5">
                          {match.match_time.slice(0, 5)}
                        </p>
                      )}
                    </div>
                    );
                  })}

                  {/* Sessions */}
                  {daySessions.map((session) => {
                    const bgColor = TRAINING_TYPE_COLORS[session.training_type] || "bg-primary";
                    const label = getTrainingTypeLabel(session.training_type);
                    return (
                      <div
                        key={session.id}
                        onClick={() => onViewSession(session)}
                        className={cn(
                          "p-1.5 rounded cursor-pointer hover:opacity-80 transition-opacity",
                          bgColor.replace("bg-", "bg-") + "/20",
                          "border",
                          bgColor.replace("bg-", "border-") + "/40"
                        )}
                      >
                        <div className="flex items-center gap-1 text-xs">
                          {(session as any).created_by_player_id && (
                            <User className="h-2.5 w-2.5 text-violet-500 shrink-0" />
                          )}
                          <div className={cn(
                            "h-2 w-2 rounded-full shrink-0",
                            (session as any).created_by_player_id ? "bg-violet-500" : bgColor
                          )} />
                          <span className="font-medium truncate">
                            {(session as any).created_by_player_id && playerNamesMap?.[(session as any).created_by_player_id]
                              ? `${playerNamesMap[(session as any).created_by_player_id].split(' ')[0]} · `
                              : ""}
                            {label.slice(0, 12)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                          {session.session_start_time && (
                            <span>{session.session_start_time.slice(0, 5)}</span>
                          )}
                          {session.intensity && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                              I{session.intensity}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {!hasEvents && (
                    <p className="text-[10px] text-muted-foreground text-center pt-4">
                      —
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
