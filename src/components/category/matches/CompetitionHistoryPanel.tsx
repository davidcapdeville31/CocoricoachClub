import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Trophy, Video, ChevronDown, ChevronUp, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { VideoCompanionDock } from "@/components/shared/VideoCompanionPanel";

interface CompetitionHistoryPanelProps {
  categoryId: string;
  currentMatchId: string;
  competition?: string | null;
  sportType?: string;
}

/**
 * Read-only panel that lists OTHER matches/competitions of the same
 * `competition` (e.g. "Coupe du Monde") for the given category, with
 * stats summary and persisted video link replayable inline.
 *
 * Excluded for bowling (separate flow).
 */
export function CompetitionHistoryPanel({
  categoryId,
  currentMatchId,
  competition,
  sportType,
}: CompetitionHistoryPanelProps) {
  const isBowling = (sportType || "").toLowerCase().includes("bowling");

  const { data: relatedMatches, isLoading } = useQuery({
    queryKey: ["competition-history", categoryId, competition, currentMatchId],
    enabled: !!categoryId && !!competition && !isBowling,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("id, match_date, match_time, opponent, competition, score_home, score_away, is_home, is_finalized, location, video_url")
        .eq("category_id", categoryId)
        .eq("competition", competition!)
        .neq("id", currentMatchId)
        .order("match_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  if (isBowling) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Historique compétition non disponible pour le bowling.
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Cette rencontre n'est rattachée à aucune compétition.
        <br />
        Renseigne le champ « Compétition » pour voir l'historique des autres matchs/combats.
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-6 text-center text-sm text-muted-foreground">Chargement…</div>;
  }

  if (!relatedMatches || relatedMatches.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Aucune autre rencontre dans <b>{competition}</b> pour le moment.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Trophy className="h-4 w-4 text-brand-600" />
        <h3 className="text-sm font-semibold">
          {competition}{" "}
          <span className="text-muted-foreground font-normal">
            ({relatedMatches.length} autre{relatedMatches.length > 1 ? "s" : ""} rencontre
            {relatedMatches.length > 1 ? "s" : ""})
          </span>
        </h3>
      </div>

      {relatedMatches.map((m: any) => (
        <RelatedMatchCard key={m.id} match={m} sportType={sportType} />
      ))}
    </div>
  );
}

interface RelatedMatchCardProps {
  match: {
    id: string;
    match_date: string;
    match_time: string | null;
    opponent: string;
    score_home: number | null;
    score_away: number | null;
    is_home: boolean;
    is_finalized: boolean;
    location: string | null;
    video_url: string | null;
  };
  sportType?: string;
}

function RelatedMatchCard({ match, sportType }: RelatedMatchCardProps) {
  const [showVideo, setShowVideo] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const isJudo = (sportType || "").toLowerCase().includes("judo");
  const isAthletics = (sportType || "").toLowerCase().includes("athle");
  const isAviron = (sportType || "").toLowerCase().includes("aviron");
  const isIndividual = isJudo || isAthletics || isAviron;

  return (
    <Card className="border-l-4 border-l-brand-500">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="space-y-1">
            <CardTitle className="text-sm flex items-center gap-2">
              <span>vs {match.opponent}</span>
              {match.is_finalized && (
                <Badge variant="outline" className="text-[10px]">Finalisé</Badge>
              )}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(match.match_date), "dd MMM yyyy", { locale: fr })}
                {match.match_time ? ` à ${match.match_time.slice(0, 5)}` : ""}
              </span>
              {match.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {match.location}
                </span>
              )}
            </div>
          </div>
          {!isIndividual && (
            <Badge className="text-sm tabular-nums">
              {match.score_home ?? 0} – {match.score_away ?? 0}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-2">
        <div className="flex flex-wrap gap-2">
          {match.video_url ? (
            <>
              <Button
                size="sm"
                variant={showVideo ? "default" : "outline"}
                className="h-7 gap-1.5 text-xs"
                onClick={() => setShowVideo((v) => !v)}
              >
                <Video className="h-3.5 w-3.5" />
                {showVideo ? "Masquer la vidéo" : "Voir la vidéo"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={() => window.open(match.video_url!, "_blank", "noopener,noreferrer")}
                title="Ouvrir la vidéo dans un nouvel onglet (recommandé pour VEO/Hudl)"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ouvrir
              </Button>
            </>
          ) : (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Video className="h-3 w-3" />
              Pas de vidéo
            </Badge>
          )}

          <Button
            size="sm"
            variant={showStats ? "default" : "outline"}
            className="h-7 gap-1.5 text-xs"
            onClick={() => setShowStats((v) => !v)}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            {showStats ? "Masquer les stats" : "Voir les stats"}
            {showStats ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>

        {showVideo && match.video_url && (
          <div className="mt-2 border rounded-lg overflow-hidden bg-surface-sunken">
            <VideoCompanionDock
              open
              onClose={() => setShowVideo(false)}
              storageKey={`history-${match.id}`}
              initialUrl={match.video_url}
              title={`Vidéo vs ${match.opponent}`}
            />
          </div>
        )}

        {showStats && (
          <MatchStatsSummary matchId={match.id} isIndividual={isIndividual} />
        )}
      </CardContent>
    </Card>
  );
}

function MatchStatsSummary({ matchId, isIndividual }: { matchId: string; isIndividual: boolean }) {
  // Team sports: aggregate match_events. Individual sports: aggregate competition_rounds.
  const { data: events } = useQuery({
    queryKey: ["history-match-events", matchId],
    enabled: !isIndividual,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_events")
        .select("event_type, team_side, outcome, points")
        .eq("match_id", matchId);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: rounds } = useQuery({
    queryKey: ["history-rounds", matchId],
    enabled: isIndividual,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_rounds")
        .select("round_number, opponent_name, result, phase, ranking, final_time_seconds")
        .eq("match_id", matchId)
        .order("round_number");
      if (error) throw error;
      return data || [];
    },
  });

  if (isIndividual) {
    if (!rounds || rounds.length === 0) {
      return (
        <p className="mt-2 text-xs text-muted-foreground italic">
          Aucun round/épreuve enregistré.
        </p>
      );
    }
    const wins = rounds.filter((r: any) => r.result === "win").length;
    const losses = rounds.filter((r: any) => r.result === "loss").length;
    const bestRank = rounds
      .map((r: any) => r.ranking)
      .filter((n: any) => typeof n === "number" && n > 0)
      .sort((a: number, b: number) => a - b)[0];

    return (
      <div className="mt-2 space-y-2 rounded-md bg-surface-sunken p-2">
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <Badge variant="outline">{rounds.length} round(s)</Badge>
          {wins > 0 && <Badge className="bg-emerald-600 hover:bg-emerald-600">V {wins}</Badge>}
          {losses > 0 && <Badge variant="destructive">D {losses}</Badge>}
          {bestRank && <Badge variant="secondary">Meilleur classement : {bestRank}</Badge>}
        </div>
        <ul className="space-y-1 text-xs">
          {rounds.slice(0, 8).map((r: any) => (
            <li key={r.round_number} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                R{r.round_number}
                {r.phase ? ` · ${r.phase}` : ""}
                {r.opponent_name ? ` · ${r.opponent_name}` : ""}
              </span>
              <span className="font-medium">
                {r.result || (r.ranking ? `${r.ranking}e` : "—")}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <p className="mt-2 text-xs text-muted-foreground italic">
        Aucun événement enregistré.
      </p>
    );
  }

  // Aggregate counts by event_type per side
  const byType: Record<string, { home: number; away: number }> = {};
  for (const e of events as any[]) {
    const key = e.event_type;
    if (!byType[key]) byType[key] = { home: 0, away: 0 };
    if (e.team_side === "home") byType[key].home += 1;
    else if (e.team_side === "away") byType[key].away += 1;
  }
  const top = Object.entries(byType)
    .sort((a, b) => b[1].home + b[1].away - (a[1].home + a[1].away))
    .slice(0, 8);

  return (
    <div className="mt-2 rounded-md bg-surface-sunken p-2">
      <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">
        {events.length} événement(s)
      </div>
      <ul className="space-y-1 text-xs">
        {top.map(([type, c]) => (
          <li key={type} className="flex items-center justify-between gap-2">
            <span className="capitalize text-muted-foreground">{type.replace(/_/g, " ")}</span>
            <span className="font-medium tabular-nums">
              {c.home} <span className="text-muted-foreground">–</span> {c.away}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
