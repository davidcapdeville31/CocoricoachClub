import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { getDateLocale } from "@/lib/i18n/dateLocale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy, MapPin, CalendarDays, Swords } from "lucide-react";
import { CompetitionRoundsDialog } from "@/components/category/matches/CompetitionRoundsDialog";

interface AthleteSpaceCompetitionsProps {
  playerId: string;
  categoryId: string;
  sportType?: string;
}

interface AthleteMatch {
  id: string;
  match_date: string;
  opponent: string | null;
  competition: string | null;
  location: string | null;
  category_id: string;
}

export function AthleteSpaceCompetitions({ playerId, categoryId, sportType }: AthleteSpaceCompetitionsProps) {
  const [selected, setSelected] = useState<AthleteMatch | null>(null);

  const { data: matches = [], isLoading, refetch } = useQuery({
    queryKey: ["athlete-space-competitions", playerId],
    queryFn: async () => {
      const [lineupsRes, participantsRes] = await Promise.all([
        supabase.from("match_lineups").select("match_id").eq("player_id", playerId),
        supabase.from("match_participants").select("match_id").eq("player_id", playerId),
      ]);
      if (lineupsRes.error) throw lineupsRes.error;
      if (participantsRes.error) throw participantsRes.error;

      const matchIds = Array.from(
        new Set([
          ...(lineupsRes.data || []).map((r: any) => r.match_id),
          ...(participantsRes.data || []).map((r: any) => r.match_id),
        ]),
      ).filter(Boolean);

      if (matchIds.length === 0) return [] as AthleteMatch[];

      const { data, error } = await supabase
        .from("matches")
        .select("id, match_date, opponent, competition, location, category_id")
        .in("id", matchIds)
        .order("match_date", { ascending: false });
      if (error) throw error;
      return (data || []) as AthleteMatch[];
    },
    enabled: !!playerId,
  });

  const { data: roundCounts = {} } = useQuery({
    queryKey: ["athlete-space-competition-rounds-count", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_rounds")
        .select("match_id")
        .eq("player_id", playerId);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        counts[r.match_id] = (counts[r.match_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!playerId,
  });

  const { upcoming, past } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const up: AthleteMatch[] = [];
    const pa: AthleteMatch[] = [];
    matches.forEach((m) => {
      const d = m.match_date ? parseISO(m.match_date) : null;
      if (d && d >= today) up.push(m);
      else pa.push(m);
    });
    up.sort((a, b) => a.match_date.localeCompare(b.match_date));
    return { upcoming: up, past: pa };
  }, [matches]);

  const renderMatch = (match: AthleteMatch) => {
    const count = roundCounts[match.id] || 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const matchDay = match.match_date ? parseISO(match.match_date) : null;
    if (matchDay) matchDay.setHours(0, 0, 0, 0);
    const notYetOpen = !!matchDay && matchDay > today;

    const handleOpen = () => {
      if (notYetOpen) {
        toast.info(
          `Tu pourras saisir tes résultats à partir du ${format(matchDay!, "EEEE d MMMM", { locale: getDateLocale() })}, jour de la compétition.`,
        );
        return;
      }
      setSelected(match);
    };
    return (
      <div
        key={match.id}
        className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="font-semibold">{match.competition || match.opponent || "Compétition"}</span>
            {count > 0 ? (
              <Badge variant="secondary">{count} combat{count > 1 ? "s" : ""}</Badge>
            ) : notYetOpen ? (
              <Badge variant="outline">Saisie ouverte le jour J</Badge>
            ) : (
              <Badge variant="outline">À renseigner</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {match.match_date
                ? format(parseISO(match.match_date), "EEEE d MMMM yyyy", { locale: getDateLocale() })
                : "-"}
            </span>
            {match.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {match.location}
              </span>
            )}
          </div>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setSelected(match)}>
          <Swords className="h-4 w-4" />
          {count > 0 ? "Voir / modifier" : "Saisir mes combats"}
        </Button>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Mes compétitions
          </CardTitle>
          <CardDescription>
            Retrouve les compétitions où tu es inscrit(e) et saisis tes combats : adversaire, score, résultat et lien vidéo.
            Tes saisies alimentent directement tes statistiques.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {matches.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              Aucune compétition ne t'est assignée pour l'instant.
            </p>
          )}

          {upcoming.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">À venir</p>
              {upcoming.map(renderMatch)}
            </div>
          )}

          {past.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Passées</p>
              {past.map(renderMatch)}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <CompetitionRoundsDialog
          open={!!selected}
          onOpenChange={(open) => {
            if (!open) {
              setSelected(null);
              refetch();
            }
          }}
          matchId={selected.id}
          categoryId={selected.category_id || categoryId}
          sportType={sportType || ""}
          restrictToPlayerId={playerId}
        />
      )}
    </div>
  );
}
