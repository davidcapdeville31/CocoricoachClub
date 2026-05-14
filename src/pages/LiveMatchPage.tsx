import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, ListOrdered, BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LiveScoreboard } from "@/components/category/matches/live/LiveScoreboard";
import { PeriodControls } from "@/components/category/matches/live/PeriodControls";
import { LiveTimeline } from "@/components/category/matches/live/LiveTimeline";
import { LiveQuickActions } from "@/components/category/matches/live/LiveQuickActions";
import { LiveStatsPanel } from "@/components/category/matches/live/LiveStatsPanel";
import { EventDialog } from "@/components/category/matches/live/dialogs/EventDialog";
import { TacklePanel } from "@/components/category/matches/live/dialogs/TacklePanel";
import { SubstitutionDialog } from "@/components/category/matches/live/dialogs/SubstitutionDialog";
import { TackleInlinePanel } from "@/components/category/matches/live/TackleInlinePanel";
import { PassInlinePanel } from "@/components/category/matches/live/PassInlinePanel";
import { TeamColorsDialog } from "@/components/category/matches/live/dialogs/TeamColorsDialog";
import { useMatchEvents } from "@/components/category/matches/live/hooks/useMatchEvents";
import { useMatchStats } from "@/components/category/matches/live/hooks/useMatchStats";
import type { EventType, MatchEvent, Period } from "@/components/category/matches/live/types";
import { toast } from "sonner";

export default function LiveMatchPage() {
  const { categoryId, matchId } = useParams<{ categoryId: string; matchId: string }>();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("H1");
  const [minute, setMinute] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [openType, setOpenType] = useState<EventType | null>(null);
  const [editing, setEditing] = useState<MatchEvent | null>(null);
  const [chainNext, setChainNext] = useState<EventType | null>(null);
  const [tacklePanelOpen, setTacklePanelOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const colorsKey = `match-team-colors-${matchId}`;
  const [teamColors, setTeamColors] = useState<{ home: string; away: string } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(`match-team-colors-${matchId}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [colorsOpen, setColorsOpen] = useState(false);
  useEffect(() => {
    if (matchId && !teamColors) setColorsOpen(true);
  }, [matchId, teamColors]);

  const { data: match } = useQuery({
    queryKey: ["match-live", matchId],
    enabled: !!matchId,
    queryFn: async () => {
      const { data, error } = await supabase.from("matches").select("*, categories(name)").eq("id", matchId!).single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: lineup } = useQuery({
    queryKey: ["match-live-lineup", matchId],
    enabled: !!matchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_lineups").select("player_id, position, is_starter, players(id, name, first_name)").eq("match_id", matchId!);
      if (error) throw error;
      return data as any[];
    },
  });

  const { events, create, update, remove } = useMatchEvents(matchId!);
  const stats = useMatchStats(events);

  const homeName = match?.is_home ? (match?.categories?.name ?? "Domicile") : (match?.opponent ?? "Extérieur");
  const awayName = match?.is_home ? (match?.opponent ?? "Extérieur") : (match?.categories?.name ?? "Domicile");
  const clubSide: "home" | "away" = match?.is_home === false ? "away" : "home";

  const homePlayers = useMemo(
    () => (lineup ?? [])
      .slice()
      .sort((a: any, b: any) => (a.position ?? 99) - (b.position ?? 99))
      .map((l: any) => ({
        id: l.player_id,
        label: `${l.position ? `#${l.position} ` : ""}${[l.players?.first_name, l.players?.name].filter(Boolean).join(" ")}`,
      })),
    [lineup]
  );
  // Pour les plaquages : prénom + numéro uniquement (boutons compacts)
  const tacklePlayers = useMemo(
    () => (lineup ?? [])
      .slice()
      .sort((a: any, b: any) => (a.position ?? 99) - (b.position ?? 99))
      .map((l: any) => ({
        id: l.player_id,
        label: `${l.players?.first_name ?? ""}${l.position ? ` #${l.position}` : ""}`.trim(),
      })),
    [lineup]
  );
  const playerNames = useMemo(() => {
    const m: Record<string, string> = {};
    (lineup ?? []).forEach((l: any) => {
      m[l.player_id] = [l.players?.first_name, l.players?.name].filter(Boolean).join(" ");
    });
    return m;
  }, [lineup]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/)) return;
      const map: Record<string, EventType> = {
        e: "try", p: "penalty_kick", t: "lineout", m: "scrum", c: "yellow_card", d: "drop",
      };
      const t = map[e.key.toLowerCase()];
      if (t) { e.preventDefault(); setEditing(null); setOpenType(t); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const [chainSide, setChainSide] = useState<"home" | "away" | null>(null);

  // After try, chain conversion
  useEffect(() => {
    if (chainNext && !openType) {
      const t = chainNext;
      setChainNext(null);
      setEditing(null);
      setOpenType(t);
    }
  }, [chainNext, openType]);

  const handleSubmit = async (payload: Partial<MatchEvent>, chain?: { type: EventType }) => {
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: payload });
        toast.success("Événement modifié");
      } else {
        await create.mutateAsync(payload);
        toast.success("Événement enregistré");
      }
      setOpenType(null); setEditing(null);
      if (chain) {
        setChainSide((payload.team_side as "home" | "away") ?? null);
        setChainNext(chain.type);
      } else {
        setChainSide(null);
      }
    } catch {/* toast handled */}
  };

  if (!matchId || !categoryId) return null;

  return (
    <div className="min-h-screen bg-background">
      <LiveScoreboard
        homeName={homeName} awayName={awayName}
        homeScore={stats.home.points} awayScore={stats.away.points}
        period={period} onPeriodChange={setPeriod}
        minute={minute} onMinuteChange={setMinute}
        seconds={seconds} onSecondsChange={setSeconds}
        homeColor={teamColors?.home} awayColor={teamColors?.away}
        running={isRunning} onRunningChange={setIsRunning}
      />

      <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/categories/${categoryId}?tab=competition`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour
        </Button>
        <PeriodControls
          matchId={matchId}
          period={period}
          onPeriodChange={setPeriod}
          onResetClock={(m = 0) => { setMinute(m); setSeconds(0); }}
          isFinalized={!!match?.is_finalized}
          homeScore={stats.home.points}
          awayScore={stats.away.points}
          onStartClock={() => setIsRunning(true)}
          onStopClock={() => setIsRunning(false)}
        />
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setTimelineOpen(true)} className="gap-1.5">
            <ListOrdered className="h-4 w-4" />
            Timeline
            {events.length > 0 && (
              <span className="ml-1 rounded-full bg-primary/15 text-primary text-[10px] font-mono px-1.5 py-0.5">
                {events.length}
              </span>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setStatsOpen(true)} className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Stats live
          </Button>
          <div className="text-xs text-muted-foreground hidden lg:block">
            Mode analyste · raccourcis : <kbd className="bg-muted rounded px-1">E</kbd> essai · <kbd className="bg-muted rounded px-1">P</kbd> pénalité · <kbd className="bg-muted rounded px-1">T</kbd> touche · <kbd className="bg-muted rounded px-1">M</kbd> mêlée · <kbd className="bg-muted rounded px-1">C</kbd> carton · <kbd className="bg-muted rounded px-1">D</kbd> drop
          </div>
        </div>
      </div>

      {/* Layout unifié — Stats déplacées dans un dialog */}
      <div className="px-4 pb-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider mb-2 text-muted-foreground">Plaquages</h2>
            <TackleInlinePanel
              players={tacklePlayers}
              teamSide={clubSide}
              period={period}
              minute={minute}
              second={seconds}
              counts={Object.fromEntries(Object.entries(stats.players).map(([id, s]) => [id, { tackles: s.tackles, missedTackles: s.missedTackles }]))}
              onRecord={(payload) => create.mutate(payload)}
            />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider mb-2 text-muted-foreground">Passes</h2>
            <PassInlinePanel
              players={tacklePlayers}
              teamSide={clubSide}
              period={period}
              minute={minute}
              second={seconds}
              counts={Object.fromEntries(Object.entries(stats.players).map(([id, s]) => [id, { passes: s.passes, missedPasses: s.missedPasses }]))}
              onRecord={(payload) => create.mutate(payload)}
            />
          </div>
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-2 text-muted-foreground">Actions rapides</h2>
          <LiveQuickActions onSelect={(t) => { setEditing(null); if (t === "substitution") { setSubOpen(true); } else { setOpenType(t); } }} />
        </div>
      </div>

      {/* Stats live dialog */}
      <Dialog open={statsOpen} onOpenChange={setStatsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Statistiques live
            </DialogTitle>
          </DialogHeader>
          <LiveStatsPanel home={stats.home} away={stats.away} homeH1={stats.homeH1} awayH1={stats.awayH1} homeH2={stats.homeH2} awayH2={stats.awayH2} />
        </DialogContent>
      </Dialog>

      {/* Timeline dialog (déclenché via le bouton "Timeline") */}
      <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListOrdered className="h-5 w-5" />
              Timeline · {events.length} événement{events.length > 1 ? "s" : ""}
            </DialogTitle>
          </DialogHeader>
          <LiveTimeline
            events={events}
            homeName={homeName} awayName={awayName}
            playerNames={playerNames}
            onEdit={(e) => { setTimelineOpen(false); setEditing(e); setOpenType(e.event_type as EventType); }}
            onDelete={(e) => remove.mutate(e.id)}
            onDuplicate={(e) => create.mutate({
              team_side: e.team_side, player_id: e.player_id, minute: e.minute, second: e.second,
              period: e.period, event_type: e.event_type, event_subtype: e.event_subtype,
              outcome: e.outcome as any, metadata: e.metadata,
            })}
          />
        </DialogContent>
      </Dialog>

      {openType && (
        <EventDialog
          open={!!openType}
          onOpenChange={(o) => { if (!o) { setOpenType(null); setEditing(null); setChainSide(null); } }}
          defaultSide={chainSide ?? clubSide}
          eventType={openType}
          defaultMinute={minute}
          defaultSecond={seconds}
          defaultPeriod={period}
          homeName={homeName} awayName={awayName}
          homeColor={teamColors?.home} awayColor={teamColors?.away}
          homePlayers={match?.is_home ? homePlayers : []}
          awayPlayers={match?.is_home ? [] : homePlayers}
          initial={editing}
          onSubmit={handleSubmit}
        />
      )}

      <TacklePanel
        open={tacklePanelOpen}
        onOpenChange={setTacklePanelOpen}
        players={tacklePlayers}
        teamSide={clubSide}
        period={period}
        minute={minute}
        second={seconds}
        counts={Object.fromEntries(Object.entries(stats.players).map(([id, s]) => [id, { tackles: s.tackles, missedTackles: s.missedTackles }]))}
        onRecord={(payload) => create.mutate(payload)}
      />

      <SubstitutionDialog
        open={subOpen}
        onOpenChange={setSubOpen}
        matchId={matchId!}
        lineup={(lineup ?? []) as any}
        teamSide={clubSide}
        period={period}
        defaultMinute={minute}
        defaultSecond={seconds}
        onCreateEvent={(payload) => create.mutateAsync(payload)}
      />

      <TeamColorsDialog
        open={colorsOpen}
        onOpenChange={setColorsOpen}
        homeName={homeName}
        awayName={awayName}
        initialHome={teamColors?.home}
        initialAway={teamColors?.away}
        onConfirm={(c) => {
          setTeamColors(c);
          try { localStorage.setItem(colorsKey, JSON.stringify(c)); } catch {}
        }}
      />
    </div>
  );
}
