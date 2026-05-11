import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LiveScoreboard } from "@/components/category/matches/live/LiveScoreboard";
import { LiveTimeline } from "@/components/category/matches/live/LiveTimeline";
import { LiveQuickActions } from "@/components/category/matches/live/LiveQuickActions";
import { LiveStatsPanel } from "@/components/category/matches/live/LiveStatsPanel";
import { EventDialog } from "@/components/category/matches/live/dialogs/EventDialog";
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
        .from("match_lineups").select("player_id, players(id, name, first_name, jersey_number)").eq("match_id", matchId!);
      if (error) throw error;
      return data as any[];
    },
  });

  const { events, create, update, remove } = useMatchEvents(matchId!);
  const stats = useMatchStats(events);

  const homeName = match?.is_home ? (match?.categories?.name ?? "Domicile") : (match?.opponent ?? "Extérieur");
  const awayName = match?.is_home ? (match?.opponent ?? "Extérieur") : (match?.categories?.name ?? "Domicile");

  const homePlayers = useMemo(
    () => (lineup ?? []).map((l: any) => ({
      id: l.player_id,
      label: `${l.players?.jersey_number ? `#${l.players.jersey_number} ` : ""}${[l.players?.first_name, l.players?.name].filter(Boolean).join(" ")}`,
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
      />

      <div className="px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/categories/${categoryId}?tab=competition`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour
        </Button>
        <div className="text-xs text-muted-foreground">
          Mode analyste · raccourcis : <kbd className="bg-muted rounded px-1">E</kbd> essai · <kbd className="bg-muted rounded px-1">P</kbd> pénalité · <kbd className="bg-muted rounded px-1">T</kbd> touche · <kbd className="bg-muted rounded px-1">M</kbd> mêlée · <kbd className="bg-muted rounded px-1">C</kbd> carton · <kbd className="bg-muted rounded px-1">D</kbd> drop
        </div>
      </div>

      {/* Desktop / tablet layout */}
      <div className="px-4 pb-8 hidden md:grid md:grid-cols-12 gap-4">
        <div className="md:col-span-5 lg:col-span-5">
          <h2 className="text-sm font-bold uppercase tracking-wider mb-2 text-muted-foreground">Timeline</h2>
          <LiveTimeline
            events={events}
            homeName={homeName} awayName={awayName}
            playerNames={playerNames}
            onEdit={(e) => { setEditing(e); setOpenType(e.event_type as EventType); }}
            onDelete={(e) => remove.mutate(e.id)}
            onDuplicate={(e) => create.mutate({
              team_side: e.team_side, player_id: e.player_id, minute: e.minute, second: e.second,
              period: e.period, event_type: e.event_type, event_subtype: e.event_subtype,
              outcome: e.outcome as any, metadata: e.metadata,
            })}
          />
        </div>
        <div className="md:col-span-4 lg:col-span-4">
          <h2 className="text-sm font-bold uppercase tracking-wider mb-2 text-muted-foreground">Actions rapides</h2>
          <LiveQuickActions onSelect={(t) => { setEditing(null); setOpenType(t); }} />
        </div>
        <div className="md:col-span-3 lg:col-span-3">
          <h2 className="text-sm font-bold uppercase tracking-wider mb-2 text-muted-foreground">Stats</h2>
          <LiveStatsPanel home={stats.home} away={stats.away} />
        </div>
      </div>

      {/* Mobile layout */}
      <div className="px-4 pb-8 md:hidden">
        <Tabs defaultValue="actions">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="actions">Actions</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
          </TabsList>
          <TabsContent value="actions"><LiveQuickActions onSelect={(t) => { setEditing(null); setOpenType(t); }} /></TabsContent>
          <TabsContent value="timeline">
            <LiveTimeline events={events} homeName={homeName} awayName={awayName} playerNames={playerNames}
              onEdit={(e) => { setEditing(e); setOpenType(e.event_type as EventType); }}
              onDelete={(e) => remove.mutate(e.id)}
              onDuplicate={(e) => create.mutate({
                team_side: e.team_side, player_id: e.player_id, minute: e.minute, second: e.second,
                period: e.period, event_type: e.event_type, event_subtype: e.event_subtype,
                outcome: e.outcome as any, metadata: e.metadata,
              })}
            />
          </TabsContent>
          <TabsContent value="stats"><LiveStatsPanel home={stats.home} away={stats.away} /></TabsContent>
        </Tabs>
      </div>

      {openType && (
        <EventDialog
          open={!!openType}
          onOpenChange={(o) => { if (!o) { setOpenType(null); setEditing(null); setChainSide(null); } }}
          defaultSide={chainSide ?? undefined}
          eventType={openType}
          defaultMinute={minute}
          defaultSecond={seconds}
          defaultPeriod={period}
          homeName={homeName} awayName={awayName}
          homeColor={teamColors?.home} awayColor={teamColors?.away}
          homePlayers={homePlayers}
          awayPlayers={[]}
          initial={editing}
          onSubmit={handleSubmit}
        />
      )}

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
