import { useQuery } from "@tanstack/react-query";
import { SessionAuthor } from "@/components/shared/SessionAuthor";
import { format, parseISO } from "date-fns";
import { ChevronRight, Clock, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { getDateLocale } from "@/lib/i18n/dateLocale";
import { getTrainingTypeLabel } from "@/lib/constants/trainingTypes";

interface Props {
  playerId: string;
  selectedDate: string | null;
  sessions: { id: string; session_date: string; training_type: string; created_by_player_id?: string | null }[];
  matches: { id: string; match_date: string; opponent: string; competition?: string | null; created_by_player_id?: string | null }[];
  onSelect: (date: Date) => void;
}
export function AthleteCalendarUpcoming({ playerId, selectedDate, sessions, matches, onSelect }: Props) {
  const today = format(new Date(), "yyyy-MM-dd");
  const events = [
    ...sessions.filter(s => !s.created_by_player_id && s.session_date >= today).map(s => ({ id: s.id, date: s.session_date, kind: "session", title: getTrainingTypeLabel(s.training_type) })),
    ...matches.filter(m => m.created_by_player_id !== playerId && m.match_date >= today).map(m => ({ id: m.id, date: m.match_date, kind: "match", title: m.competition || m.opponent })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["athlete-calendar-upcoming-attendance", playerId, events.map(e => e.id)],
    refetchInterval: 10_000,
    queryFn: async () => {
      const [sessionsResult, matchesResult] = await Promise.all([
        supabase.from("event_participants").select("training_session_id, attendance_status").eq("player_id", playerId).in("training_session_id", events.filter(e => e.kind === "session").map(e => e.id)),
        supabase.from("match_participants").select("match_id, attendance_status").eq("player_id", playerId).in("match_id", events.filter(e => e.kind === "match").map(e => e.id)),
      ]);
      if (sessionsResult.error) throw sessionsResult.error;
      if (matchesResult.error) throw matchesResult.error;
      const result = new Map<string, string | null>();
      sessionsResult.data?.forEach(row => result.set(`session-${row.training_session_id}`, row.attendance_status));
      matchesResult.data?.forEach(row => result.set(`match-${row.match_id}`, row.attendance_status));
      return result;
    },
    enabled: events.length > 0,
  });
  if (!events.length) return null;
  const pending = events.filter(event => !["present", "absent"].includes(data?.get(`${event.kind}-${event.id}`) || ""));
  const otherEvents = events.filter(event => event.date !== selectedDate).sort((a, b) => Number(["present", "absent"].includes(data?.get(`${a.kind}-${a.id}`) || "")) - Number(["present", "absent"].includes(data?.get(`${b.kind}-${b.id}`) || "")) || a.date.localeCompare(b.date));
  return <details className="athlete-calendar-upcoming border-t border-border pt-2">
    <summary className="min-h-11 flex items-center justify-between gap-2 cursor-pointer text-sm font-semibold"><span className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />{isLoading ? "Vérification des présences…" : isError ? "Présences indisponibles" : pending.length ? `${pending.length} présence${pending.length > 1 ? "s" : ""} à confirmer` : "Prochains événements"}</span><ChevronRight className="h-4 w-4 shrink-0" /></summary>
    {isError && <Button variant="outline" size="sm" onClick={() => refetch()}>Réessayer</Button>}
    <ul className="divide-y divide-border">{otherEvents.map(event => <li key={`${event.kind}-${event.id}`}><Button variant="ghost" className="h-auto min-h-11 w-full justify-start gap-2 whitespace-normal text-left px-1 py-2" onClick={() => { onSelect(parseISO(event.date)); requestAnimationFrame(() => document.querySelector(".athlete-calendar-day")?.scrollIntoView({ block: "start" })); }}>{event.kind === "match" ? <Trophy className="h-4 w-4 text-destructive shrink-0" /> : <Clock className="h-4 w-4 text-primary shrink-0" />}<span className="flex-1 min-w-0"><span className="block text-xs text-muted-foreground">{format(parseISO(event.date), "EEE d MMM", { locale: getDateLocale() })}</span><span className="block text-sm">{event.title}</span>{event.kind === "session" && <SessionAuthor sessionId={event.id} playerId={playerId} />}</span>{!isLoading && !isError && <span className="text-xs text-muted-foreground">{data?.get(`${event.kind}-${event.id}`) === "present" ? "Présent" : data?.get(`${event.kind}-${event.id}`) === "absent" ? "Absent" : "Sans réponse"}</span>}<ChevronRight className="h-4 w-4 shrink-0" /></Button></li>)}</ul>
  </details>;
}