import { useEffect, useMemo, useState } from "react";
import { finalRankingLabel, isPodium } from "@/lib/judo/finalRanking";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { getDateLocale } from "@/lib/i18n/dateLocale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy, MapPin, CalendarDays, Swords, BarChart3, FileDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { exportAthleteMatchStatsPdf } from "@/lib/athleteMatchStatsPdfExport";
import { CompetitionRoundsDialog } from "@/components/category/matches/CompetitionRoundsDialog";
import { AthleteMatchStats } from "@/components/athlete-space/AthleteMatchStats";
import { isIndividualSport } from "@/lib/constants/sportTypes";
import { toast } from "sonner";
import { useAthleteCompetitionEntry } from "@/hooks/useAthleteCompetitionEntry";

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
  const [statsMatch, setStatsMatch] = useState<AthleteMatch | null>(null);
  const [exportSelection, setExportSelection] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const entryEnabled = useAthleteCompetitionEntry(categoryId);

  // Nom de l'athlète pour l'en-tête du PDF
  const { data: playerName = "" } = useQuery({
    queryKey: ["athlete-space-player-name", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("first_name, last_name")
        .eq("id", playerId)
        .single();
      if (error) throw error;
      return `${(data as any).first_name || ""} ${(data as any).last_name || ""}`.trim();
    },
    enabled: !!playerId,
  });

  // Matchs où l'athlète est dans la composition d'équipe (match_lineups)
  const { data: lineupMatchIds = new Set<string>() } = useQuery({
    queryKey: ["athlete-space-lineup-matches", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_lineups")
        .select("match_id")
        .eq("player_id", playerId);
      if (error) throw error;
      return new Set((data || []).map((r: any) => r.match_id as string));
    },
    enabled: !!playerId,
  });

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
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // Synchronisation instantanée : dès que le staff ajoute l'athlète à une
  // composition ou une convocation, la compétition apparaît ici.
  useEffect(() => {
    if (!playerId) return;
    const channel = supabase
      .channel(`athlete-competitions-${playerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_participants", filter: `player_id=eq.${playerId}` }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "match_lineups", filter: `player_id=eq.${playerId}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [playerId, refetch]);


  const { data: roundCounts = {} } = useQuery({
    queryKey: ["athlete-space-competition-rounds-count", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_rounds")
        .select("match_id")
        .eq("player_id", playerId);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((r: any) => { counts[r.match_id] = (counts[r.match_id] || 0) + 1; });
      return counts;
    },
    enabled: !!playerId,
  });

  // Classement final = donnée de participation (indépendante des combats)
  const { data: finalRankings = {} } = useQuery({
    queryKey: ["competition-final-rankings", "athlete", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_results")
        .select("match_id, final_ranking")
        .eq("player_id", playerId);
      if (error) throw error;
      const out: Record<string, string | null> = {};
      (data || []).forEach((r: any) => { out[r.match_id] = r.final_ranking; });
      return out;
    },
    enabled: !!playerId,
  });

  const isJudo = (sportType || "").toLowerCase().includes("judo");
  const isTeamSport = !isJudo && !isIndividualSport(sportType || "");

  const { upcoming, past } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const up: AthleteMatch[] = [];
    const pa: AthleteMatch[] = [];
    // Sports collectifs : seules les compétitions où l'athlète est dans la
    // composition d'équipe (match_lineups) sont affichées — les simples
    // convocations sans assignation n'apparaissent pas.
    const visible = isTeamSport
      ? matches.filter((m) => lineupMatchIds.has(m.id))
      : matches;
    visible.forEach((m) => {
      const d = m.match_date ? parseISO(m.match_date) : null;
      if (d && d >= today) up.push(m);
      else pa.push(m);
    });
    up.sort((a, b) => a.match_date.localeCompare(b.match_date));
    return { upcoming: up, past: pa };
  }, [matches, isTeamSport, lineupMatchIds]);

  const toggleExportSelection = (matchId: string, checked: boolean) => {
    setExportSelection((prev) => {
      const next = new Set(prev);
      if (checked) next.add(matchId);
      else next.delete(matchId);
      return next;
    });
  };

  const handleExportPdf = async () => {
    const selectedMatches = past.filter((m) => exportSelection.has(m.id));
    if (selectedMatches.length === 0) return;
    setExporting(true);
    try {
      await exportAthleteMatchStatsPdf({
        playerId,
        playerName,
        categoryId,
        sportType: sportType || "",
        matches: selectedMatches,
      });
      toast.success("Ton PDF a été téléchargé");
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la génération du PDF");
    } finally {
      setExporting(false);
    }
  };

  const renderMatch = (match: AthleteMatch) => {
    const count = roundCounts[match.id] || 0;
    const finalRanking = finalRankings[match.id] ?? null;
    const rankLabel = finalRankingLabel(finalRanking);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const matchDay = match.match_date ? parseISO(match.match_date) : null;
    if (matchDay) matchDay.setHours(0, 0, 0, 0);
    const notYetOpen = !!matchDay && matchDay > today;

    const handleOpen = () => {
      if (!entryEnabled) {
        toast.info("La saisie des compétitions est gérée par ton staff.");
        return;
      }
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
        className="judo-competition-card flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        {isTeamSport && entryEnabled && !notYetOpen && lineupMatchIds.has(match.id) && (
          <label
            className="flex items-center gap-2 self-start sm:self-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={exportSelection.has(match.id)}
              onCheckedChange={(c) => toggleExportSelection(match.id, c === true)}
              aria-label={`Sélectionner ${match.competition || match.opponent || "cette compétition"} pour l'export PDF`}
            />
            <span className="text-[11px] text-muted-foreground">PDF</span>
          </label>
        )}
        <div className="space-y-1 flex-1">
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
            {isJudo && !notYetOpen && (
              <Badge variant={isPodium(finalRanking) ? "default" : "outline"}>
                {rankLabel || "Classement non renseigné"}
              </Badge>
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
        <div className="flex flex-wrap items-center gap-2">
          {isTeamSport && entryEnabled && !notYetOpen && lineupMatchIds.has(match.id) && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setStatsMatch(match)}
            >
              <BarChart3 className="h-4 w-4" />
              Mes stats
            </Button>
          )}
          <Button
            size="sm"
            className="gap-1.5"
            variant={notYetOpen ? "outline" : "default"}
            onClick={handleOpen}
          >
            <Swords className="h-4 w-4" />
            {count > 0 ? "Voir / modifier" : isTeamSport ? "Voir la compétition" : "Saisir mes combats"}
          </Button>
        </div>
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
    <div className={isJudo ? "athlete-judo-competitions space-y-6" : "space-y-6"}>
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Passées</p>
                {isTeamSport && entryEnabled && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={exportSelection.size === 0 || exporting}
                    onClick={handleExportPdf}
                  >
                    {exporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4" />
                    )}
                    Exporter mes stats{exportSelection.size > 0 ? ` (${exportSelection.size})` : ""}
                  </Button>
                )}
              </div>
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

      {statsMatch && (
        <AthleteMatchStats
          open={!!statsMatch}
          onOpenChange={(open) => {
            if (!open) setStatsMatch(null);
          }}
          matchId={statsMatch.id}
          playerId={playerId}
          categoryId={statsMatch.category_id || categoryId}
          sportType={sportType || ""}
          matchLabel={statsMatch.competition || statsMatch.opponent || "Compétition"}
        />
      )}
    </div>
  );
}
