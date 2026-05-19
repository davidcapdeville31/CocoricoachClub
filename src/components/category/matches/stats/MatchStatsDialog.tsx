import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Users, BarChart3, Activity, Play, ClipboardEdit, History } from "lucide-react";
import { useMatchEvents } from "../live/hooks/useMatchEvents";
import { useMatchStats } from "../live/hooks/useMatchStats";
import { MatchStatsHeader } from "./MatchStatsHeader";
import { MatchTeamStatsView } from "./MatchTeamStatsView";
import { CompetitionHistoryPanel } from "../CompetitionHistoryPanel";
import { MatchPlayerStatsView } from "./MatchPlayerStatsView";
import { MatchTimelineView } from "./MatchTimelineView";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  matchId: string;
  categoryId: string;
  onOpenLive?: () => void;
  onOpenManual?: () => void;
}

export function MatchStatsDialog({
  open,
  onOpenChange,
  matchId,
  categoryId,
  onOpenLive,
  onOpenManual,
}: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"team" | "players" | "timeline" | "history">("team");

  const { data: match } = useQuery({
    queryKey: ["match-stats-meta", matchId],
    enabled: open && !!matchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*, categories(name)")
        .eq("id", matchId)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { events } = useMatchEvents(matchId);
  const stats = useMatchStats(events);

  const homeName = match?.is_home
    ? match?.categories?.name ?? "Domicile"
    : match?.opponent ?? "Extérieur";
  const awayName = match?.is_home
    ? match?.opponent ?? "Extérieur"
    : match?.categories?.name ?? "Domicile";
  const clubSide: "home" | "away" = match?.is_home === false ? "away" : "home";

  const scoreHome = match?.score_home ?? stats.home.points ?? 0;
  const scoreAway = match?.score_away ?? stats.away.points ?? 0;

  const handleOpenLive = () => {
    onOpenChange(false);
    if (onOpenLive) onOpenLive();
    else navigate(`/categories/${categoryId}/match/${matchId}/live`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl gap-0 overflow-hidden p-0">
        {match ? (
          <MatchStatsHeader
            homeName={homeName}
            awayName={awayName}
            scoreHome={scoreHome}
            scoreAway={scoreAway}
            matchDate={match.match_date}
            matchTime={match.match_time}
            location={match.location}
            competition={match.competition}
            isFinalized={!!match.is_finalized}
            isHome={!!match.is_home}
            onClose={() => onOpenChange(false)}
            rightSlot={
              <div className="flex items-center gap-1.5">
                {onOpenManual ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1.5 bg-white/15 text-white hover:bg-white/25"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenManual();
                    }}
                  >
                    <ClipboardEdit className="h-3.5 w-3.5" />
                    Saisie
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  className="h-8 gap-1.5 bg-white text-brand-600 hover:bg-white/90"
                  onClick={handleOpenLive}
                >
                  <Play className="h-3.5 w-3.5" />
                  Mode live
                </Button>
              </div>
            }
          />
        ) : null}

        <div className="max-h-[calc(90vh-180px)] overflow-y-auto bg-background px-5 pb-5 pt-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
            <TabsList className="mb-4 grid w-full max-w-md grid-cols-3 bg-surface-sunken">
              <TabsTrigger value="team" className="gap-1.5 text-xs">
                <BarChart3 className="h-3.5 w-3.5" />
                Équipe
              </TabsTrigger>
              <TabsTrigger value="players" className="gap-1.5 text-xs">
                <Users className="h-3.5 w-3.5" />
                Joueurs
              </TabsTrigger>
              <TabsTrigger value="timeline" className="gap-1.5 text-xs">
                <Activity className="h-3.5 w-3.5" />
                Timeline
              </TabsTrigger>
            </TabsList>

            <TabsContent value="team" className="mt-0">
              <MatchTeamStatsView
                home={stats.home}
                away={stats.away}
                homeName={homeName}
                awayName={awayName}
                clubSide={clubSide}
              />
            </TabsContent>

            <TabsContent value="players" className="mt-0">
              <MatchPlayerStatsView
                matchId={matchId}
                events={events}
                players={stats.players}
                clubSide={clubSide}
              />
            </TabsContent>

            <TabsContent value="timeline" className="mt-0">
              <MatchTimelineView events={events} homeName={homeName} awayName={awayName} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
