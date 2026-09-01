import { getDateLocale } from "@/lib/i18n/dateLocale";
import { format, isToday as checkIsToday, isTomorrow, isYesterday } from "date-fns";
import { Plus, Clock, MapPin, ChevronRight, Zap, Calendar, Users, Trash2, Pencil, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TRAINING_TYPE_COLORS, ATHLETE_SESSION_COLOR_CLASS } from "@/lib/constants/trainingTypes";
import { isIndividualSport } from "@/lib/constants/sportTypes";
import { getCompetitionColor } from "@/lib/constants/competitionColors";

import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDisplayNotes, isSimplifiedSession, parseTestsFromNotes, getSessionTitleFromNotes } from "@/lib/utils/sessionNotes";
import { useCustomTestLabels, labelizeTestType } from "@/hooks/useCustomTestLabels";
import { useTranslation } from "react-i18next";

interface Session {
  id: string;
  session_date: string;
  session_start_time: string | null;
  session_end_time: string | null;
  training_type: string;
  notes: string | null;
  intensity?: number | null;
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


interface TestCampaign {
  id: string;
  start: string;
  end: string;
  label: string;
}

interface SessionBlock {
  id: string;
  training_type: string;
  block_order: number;
}

interface DailyCalendarViewProps {
  day: Date;
  sessions: Session[];
  matches: Match[];
  testCampaigns?: TestCampaign[];
  sportType: string | undefined;
  trainingTypeLabels: Record<string, string>;
  isViewer: boolean;
  onViewSession?: (session: Session) => void;
  onViewMatch?: (match: Match) => void;
  onEditMatch?: (match: Match) => void;
  onAddEvent?: (day: Date) => void;
  onDeleteMatch?: (matchId: string) => void;
  onLineupMatch?: (matchId: string) => void;
}

export function DailyCalendarView({
  day,
  sessions,
  matches,
  testCampaigns = [],
  sportType,
  trainingTypeLabels,
  isViewer,
  onViewSession,
  onViewMatch,
  onEditMatch,
  onAddEvent,
  onDeleteMatch,
  onLineupMatch,
}: DailyCalendarViewProps) {
  const { t } = useTranslation();
  const isToday = checkIsToday(day);
  const hasEvents = sessions.length > 0 || matches.length > 0 || testCampaigns.length > 0;

  // Readable names for tests embedded in test sessions
  const allSessionTestTypes = sessions.flatMap((s) => parseTestsFromNotes(s.notes).map((tt) => tt.test_type));
  const customTestLabels = useCustomTestLabels(allSessionTestTypes);
  const testNameForSession = (session: Session) => {
    const tests = parseTestsFromNotes(session.notes);
    if (tests.length === 0) return "";
    return tests.map((tt) => labelizeTestType(tt.test_type, customTestLabels)).join(" • ");
  };

  // Fetch session blocks
  const sessionIds = sessions.map(s => s.id);
  const { data: sessionBlocks } = useQuery({
    queryKey: ["daily-session-blocks", sessionIds],
    queryFn: async () => {
      if (sessionIds.length === 0) return {};
      const { data, error } = await supabase
        .from("training_session_blocks")
        .select("id, training_session_id, training_type, block_order")
        .in("training_session_id", sessionIds)
        .order("block_order");
      if (error) throw error;
      
      const blocksMap: Record<string, SessionBlock[]> = {};
      data?.forEach(block => {
        if (!blocksMap[block.training_session_id]) {
          blocksMap[block.training_session_id] = [];
        }
        blocksMap[block.training_session_id].push({
          id: block.id,
          training_type: block.training_type,
          block_order: block.block_order,
        });
      });
      return blocksMap;
    },
    enabled: sessionIds.length > 0,
  });

  const getRelativeDay = () => {
    if (checkIsToday(day)) return t("planning.calendarViews.daily.today");
    if (isTomorrow(day)) return t("planning.calendarViews.daily.tomorrow");
    if (isYesterday(day)) return t("planning.calendarViews.daily.yesterday");
    return null;
  };

  const formatTime = (time: string | null) => {
    if (!time) return null;
    return time.substring(0, 5);
  };

  // Sort events by time
  const allEvents = [
    ...sessions.map(s => ({ 
      type: 'session' as const, 
      data: s, 
      time: s.session_start_time || '00:00' 
    })),
    ...matches.map(m => ({ 
      type: 'match' as const, 
      data: m, 
      time: m.match_time || '00:00' 
    }))
  ].sort((a, b) => a.time.localeCompare(b.time));

  const relativeDay = getRelativeDay();

  return (
    <div className="space-y-4">
      {/* Modern Header Card */}
      <div className={cn(
        "relative overflow-hidden rounded-2xl",
        isToday 
          ? "bg-gradient-to-br from-nav-planification via-nav-planification/90 to-nav-planification/80" 
          : "bg-gradient-to-br from-nav-planification/80 via-nav-planification/70 to-nav-planification/60"
      )}>
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Large date number */}
              <div className="flex flex-col items-center justify-center h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-white/20 backdrop-blur-sm">
                <span className="text-2xl sm:text-3xl font-bold text-white">
                  {format(day, "d")}
                </span>
                <span className="text-[10px] sm:text-xs font-medium text-white/80 uppercase">
                  {format(day, "MMM", { locale: getDateLocale() })}
                </span>
              </div>
              
              <div>
                {relativeDay && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white mb-1">
                    {relativeDay}
                  </span>
                )}
                <p className="text-xl sm:text-2xl font-bold text-white capitalize">
                  {format(day, "EEEE", { locale: getDateLocale() })}
                </p>
                <p className="text-white/70 text-sm">
                  {format(day, "d MMMM yyyy", { locale: getDateLocale() })}
                </p>
              </div>
            </div>

            {!isViewer && onAddEvent && (
              <Button 
                onClick={() => onAddEvent(day)}
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("planning.calendarViews.daily.add")}
              </Button>
            )}
          </div>

          {/* Quick stats */}
          <div className="flex gap-4 mt-4 pt-4 border-t border-white/20">
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <Calendar className="h-4 w-4" />
              <span>{t("planning.calendarViews.daily.sessionsCount", { count: sessions.length, plural: sessions.length !== 1 ? "s" : "" })}</span>
            </div>
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <Zap className="h-4 w-4" />
              <span>{t("planning.calendarViews.daily.matchesCount", { count: matches.length, label: isIndividualSport(sportType || "") ? t("planning.calendarViews.competition").toLowerCase() : t("planning.calendarViews.match").toLowerCase(), plural: matches.length !== 1 ? "s" : "" })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Events Timeline */}
      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
        {hasEvents ? (
          <div className="divide-y">
            {testCampaigns.map((campaign) => (
              <div key={campaign.id} className="flex items-center gap-3 p-4">
                <div className="w-1.5 self-stretch rounded-full bg-training-test" />
                <div className="flex items-center gap-2 min-w-0">
                  <FlaskConical className="h-4 w-4 shrink-0 text-training-test" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground">{t("planning.calendarViews.testCampaign")}</p>
                    <p className="truncate font-medium text-foreground">{campaign.label}</p>
                    <p className="text-xs text-muted-foreground">{campaign.start} → {campaign.end}</p>
                  </div>
                </div>
              </div>
            ))}
            {allEvents.map((event, idx) => {
              if (event.type === 'match') {
                const match = event.data as Match;
                const compColor = getCompetitionColor(match.competition);
                const compLabel = match.competition?.trim();
                return (
                  <div
                    key={`match-${match.id}`}
                    onClick={() => onViewMatch?.(match)}
                    className="group flex items-stretch cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    {/* Time column */}
                    <div className="w-24 flex-shrink-0 p-4 flex flex-col justify-center items-center border-r bg-muted/30">
                      <span className="text-xl font-bold text-foreground">
                        {formatTime(match.match_time) || "—"}
                      </span>
                    </div>

                    {/* Color indicator */}
                    <div className={cn("w-1.5 flex-shrink-0", compColor.bg)} />

                    {/* Content */}
                    <div className="flex-1 p-4 flex items-center justify-between">
                      <div>
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold mb-1",
                          compColor.soft,
                          compColor.softText
                        )}>
                          {compLabel || (isIndividualSport(sportType || "") ? t("planning.calendarViews.competition") : t("planning.calendarViews.match"))}
                        </span>
                        <p className="font-semibold text-foreground">
                          {isIndividualSport(sportType || "") ? t("planning.calendarViews.competition") : `vs ${match.opponent}`}
                        </p>

                        {match.location && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {match.location}
                          </p>
                        )}
                      </div>
                      {!isViewer && (
                        <div className="flex items-center gap-1 shrink-0">
                          {onEditMatch && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              title={t("planning.calendarViews.daily.editMatchTooltip")}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditMatch(match);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {onLineupMatch && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              title={t("planning.calendarViews.daily.lineupTooltip")}
                              onClick={(e) => {
                                e.stopPropagation();
                                onLineupMatch(match.id);
                              }}
                            >
                              <Users className="h-4 w-4" />
                            </Button>
                          )}
                          {onDeleteMatch && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              title={t("planning.calendarViews.daily.delete")}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(t("planning.calendarViews.daily.deleteMatchConfirm"))) {
                                  onDeleteMatch(match.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                      <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                );
              } else {
                const session = event.data as Session;
                const blocks = sessionBlocks?.[session.id] || [];
                const hasBlocks = blocks.length > 0;
                const mainColor = (session as any).created_by_player_id
                  ? ATHLETE_SESSION_COLOR_CLASS
                  : (TRAINING_TYPE_COLORS[session.training_type] || "bg-primary");
                
                return (
                  <div
                    key={`session-${session.id}`}
                    onClick={() => onViewSession?.(session)}
                    className="group flex items-stretch cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    {/* Time column */}
                    <div className="w-24 flex-shrink-0 p-4 flex flex-col justify-center items-center border-r bg-muted/30">
                      <span className="text-xl font-bold text-foreground">
                        {formatTime(session.session_start_time) || "—"}
                      </span>
                      {session.session_end_time && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(session.session_end_time)}
                        </span>
                      )}
                    </div>

                    {/* Multi-block color indicator */}
                    <div className="flex flex-shrink-0">
                      {hasBlocks ? (
                        blocks.slice(0, 4).map((block) => (
                          <div
                            key={block.id}
                            className={cn("w-1.5", TRAINING_TYPE_COLORS[block.training_type] || "bg-primary")}
                          />
                        ))
                      ) : (
                        <div className={cn("w-1.5", mainColor)} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-4 flex items-center justify-between">
                      <div>
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold mb-1",
                          mainColor.replace("bg-", "bg-") + "/20",
                          "text-foreground"
                        )}>
                          {(session.training_type === "mental" && getSessionTitleFromNotes(session.notes)) || trainingTypeLabels[session.training_type] || session.training_type}
                        </span>
                        {session.training_type === "test" && testNameForSession(session) && (
                          <p className="text-sm font-semibold">{testNameForSession(session)}</p>
                        )}
                        
                        {/* Show blocks if present */}
                        {hasBlocks && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {blocks.map((block) => (
                              <span 
                                key={block.id}
                                className="text-xs text-muted-foreground"
                              >
                                {trainingTypeLabels[block.training_type] || block.training_type}
                                {block.block_order < blocks.length && " •"}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {session.notes && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                            {isSimplifiedSession(session.notes)
                              ? t("athleteSpace.rpe.simplifiedSessionLabel")
                              : getDisplayNotes(session.notes)}
                          </p>
                        )}
                        
                        {session.intensity && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <div className="flex gap-0.5">
                              {Array.from({ length: 10 }).map((_, i) => (
                                <div
                                  key={i}
                                  className={cn(
                                    "w-2 h-2 rounded-full",
                                    i < session.intensity! 
                                      ? session.intensity! <= 3 ? "bg-emerald-500"
                                        : session.intensity! <= 6 ? "bg-amber-500"
                                        : "bg-rose-500"
                                      : "bg-muted"
                                  )}
                                />
                              ))}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {session.intensity}/10
                            </span>
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                );
              }
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Calendar className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-medium text-muted-foreground mb-2">
              {t("planning.calendarViews.daily.noEventsTitle")}
            </p>
            <p className="text-sm text-muted-foreground/70 mb-4">
              {t("planning.calendarViews.daily.noEventsSubtitle")}
            </p>
            {!isViewer && onAddEvent && (
              <Button 
                variant="outline" 
                onClick={() => onAddEvent(day)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {t("planning.calendarViews.daily.addEvent")}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
