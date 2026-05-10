import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trophy, Medal, BarChart3, Shield } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  TOURNAMENT_LEVELS,
  SELECTION_TYPES,
  summarizeByLevel,
  summarizeBySelection,
  type MatchForAnalytics,
} from "@/lib/judo/competitionAnalytics";

interface Props {
  categoryId: string;
}

export function AthleticsCompetitionAnalyticsTab({ categoryId }: Props) {
  const [playerId, setPlayerId] = useState<string>("all");
  const [selectionFilter, setSelectionFilter] = useState<string>("all");

  const { data: players = [] } = useQuery({
    queryKey: ["athle_analytics_players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: rawMatches = [], isLoading } = useQuery({
    queryKey: ["athle_analytics_matches", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select(`
          id, match_date, competition, opponent, tournament_level, selection_type,
          competition_rounds(result, ranking, phase, opponent_name, player_id)
        `)
        .eq("category_id", categoryId)
        .order("match_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const matches: MatchForAnalytics[] = useMemo(() => {
    return rawMatches
      .filter((m: any) => selectionFilter === "all" || (m.selection_type || "club") === selectionFilter)
      .map((m: any) => ({
        id: m.id,
        match_date: m.match_date,
        competition: m.competition,
        opponent: m.opponent,
        tournament_level: m.tournament_level,
        selection_type: m.selection_type,
        rounds: (m.competition_rounds || []).filter(
          (r: any) => playerId === "all" || r.player_id === playerId,
        ),
      }))
      .filter((m) => m.rounds.length > 0 || playerId === "all");
  }, [rawMatches, playerId, selectionFilter]);

  const levelSummaries = useMemo(() => summarizeByLevel(matches), [matches]);
  const selectionSummaries = useMemo(() => summarizeBySelection(matches), [matches]);

  const levelColor = (lvl: string) =>
    TOURNAMENT_LEVELS.find((l) => l.value === lvl)?.color ||
    "bg-muted text-muted-foreground border-border";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Bilan compétitions
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="w-full sm:w-56">
              <Select value={selectionFilter} onValueChange={setSelectionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Participation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes participations</SelectItem>
                  {SELECTION_TYPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-56">
              <Select value={playerId} onValueChange={setPlayerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Athlète" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les athlètes</SelectItem>
                  {players.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {(p.name || "").toUpperCase()} {p.first_name || ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : levelSummaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune compétition enregistrée.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {levelSummaries.map((s) => (
                <Card key={s.level} className="border">
                  <CardHeader className="pb-2">
                    <Badge variant="outline" className={`w-fit ${levelColor(s.level)}`}>
                      {s.label}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">{s.tournamentsCount}</span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        compétitions
                      </span>
                    </div>
                    <div className="space-y-1 pt-2 border-t">
                      <div className="flex items-center gap-2 text-sm">
                        <Trophy className="h-4 w-4 text-amber-500" />
                        <span className="text-muted-foreground">Meilleure :</span>
                        <span className="font-semibold">
                          {s.bestPerformance?.label || "—"}
                        </span>
                      </div>
                      {s.bestPerformance && (
                        <p className="text-[11px] text-muted-foreground pl-6 truncate">
                          {s.bestPerformance.tournament} ·{" "}
                          {format(parseISO(s.bestPerformance.date), "dd MMM yyyy", { locale: fr })}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Medal className="h-4 w-4 text-blue-500" />
                        <span className="text-muted-foreground">Moyenne :</span>
                        <span className="font-semibold">{s.averageRankLabel}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectionSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Par type de participation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {selectionSummaries.map((s) => (
                <Card key={s.selection} className="border">
                  <CardHeader className="pb-2">
                    <Badge variant="outline" className={`w-fit ${s.color}`}>
                      {s.label}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">{s.tournamentsCount}</span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        compétitions
                      </span>
                    </div>
                    <div className="space-y-1 pt-2 border-t">
                      <div className="flex items-center gap-2 text-sm">
                        <Trophy className="h-4 w-4 text-amber-500" />
                        <span className="text-muted-foreground">Meilleure :</span>
                        <span className="font-semibold">
                          {s.bestPerformance?.label || "—"}
                        </span>
                      </div>
                      {s.bestPerformance && (
                        <p className="text-[11px] text-muted-foreground pl-6 truncate">
                          {s.bestPerformance.tournament} ·{" "}
                          {format(parseISO(s.bestPerformance.date), "dd MMM yyyy", { locale: fr })}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Medal className="h-4 w-4 text-blue-500" />
                        <span className="text-muted-foreground">Moyenne :</span>
                        <span className="font-semibold">{s.averageRankLabel}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
