import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ColoredSubTabsList, ColoredSubTabsTrigger } from "@/components/ui/colored-subtabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3, GitCompare, ChevronDown, Check, Trophy, Layers } from "lucide-react";
import { KpiCard } from "@/components/category/datas/team-sports/shared/KpiCard";
import { TrendIndicator } from "@/components/ui/trend-indicator";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  summarizeTournamentRounds,
  JUDO_METRIC_GROUPS,
  formatMetric,
  type JudoTournamentSummary,
} from "@/lib/judo/tournamentStats";
import { TOURNAMENT_LEVELS, tournamentLevelLabel } from "@/lib/judo/competitionAnalytics";
import { useSeasonRosterFilter } from "@/contexts/SeasonRosterFilterContext";

interface Props {
  categoryId: string;
}

interface JudoMatchRow {
  id: string;
  match_date: string;
  competition: string | null;
  opponent: string | null;
  tournament_level: string | null;
  rounds: {
    result: string | null;
    stats: Record<string, number> | null;
    player_id: string | null;
    competition_round_stats?: {
      stat_data: Record<string, number> | null;
    }[] | null;
  }[];
}

export function JudoCompetitionStats({ categoryId }: Props) {
  const { isDateInActiveSeason } = useSeasonRosterFilter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("general");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [playerId, setPlayerId] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");

  const { data: players = [] } = useQuery({
    queryKey: ["judo_comp_stats_players", categoryId],
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
    queryKey: ["judo_comp_stats_matches", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select(`
          id, match_date, competition, opponent, tournament_level,
          rounds:competition_rounds(result, player_id, competition_round_stats(stat_data))
        `)
        .eq("category_id", categoryId)
        .eq("is_personal", false)
        .order("match_date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as JudoMatchRow[];
    },
  });

  // Realtime: invalidate on any change to matches or competition_rounds for this category
  useEffect(() => {
    const channel = supabase
      .channel(`judo-comp-stats-${categoryId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `category_id=eq.${categoryId}` },
        () => queryClient.invalidateQueries({ queryKey: ["judo_comp_stats_matches", categoryId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "competition_rounds" },
        () => queryClient.invalidateQueries({ queryKey: ["judo_comp_stats_matches", categoryId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [categoryId, queryClient]);

  const allAthleteTournaments = useMemo(() => {
    return rawMatches
      .filter((m) => isDateInActiveSeason(m.match_date))
      .map((m) => ({
        ...m,
        rounds: (m.rounds || [])
          .filter((r) => playerId === "all" || r.player_id === playerId)
          .map((r) => ({
            ...r,
            stats: r.stats || r.competition_round_stats?.[0]?.stat_data || {},
          })),
      }))
      .filter((m) => m.rounds.length > 0);
  }, [rawMatches, isDateInActiveSeason, playerId]);

  const tournaments = useMemo(() => {
    if (levelFilter === "all") return allAthleteTournaments;
    return allAthleteTournaments.filter(
      (m) => (m.tournament_level || "unknown") === levelFilter,
    );
  }, [allAthleteTournaments, levelFilter]);

  useEffect(() => {
    if (tournaments.length > 0 && selectedIds.length === 0) {
      setSelectedIds([tournaments[0].id]);
    }
    // If filter changes and selection becomes invalid, reset to first
    if (tournaments.length > 0 && selectedIds.length > 0) {
      const valid = selectedIds.filter((id) => tournaments.some((t) => t.id === id));
      if (valid.length === 0) setSelectedIds([tournaments[0].id]);
      else if (valid.length !== selectedIds.length) setSelectedIds(valid);
    }
  }, [tournaments, selectedIds]);

  const selected = useMemo(
    () => tournaments.filter((t) => selectedIds.includes(t.id)),
    [tournaments, selectedIds],
  );

  const toggleId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const tournamentLabel = (t: JudoMatchRow) =>
    `${format(new Date(t.match_date), "d MMM yyyy", { locale: fr })} · ${t.competition || t.opponent || "Tournoi"}`;

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p>;
  }

  if (tournaments.length === 0) {
    return (
      <div className="rounded-2xl border bg-surface p-12 text-center">
        <BarChart3 className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <p className="font-medium">Aucun tournoi enregistré</p>
        <p className="text-sm text-muted-foreground mt-1">
          Les statistiques apparaîtront ici dès que vous saisirez les combats d'un tournoi.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex justify-center overflow-x-auto -mx-4 px-4 pb-2">
          <ColoredSubTabsList colorKey="competition" className="inline-flex w-max">
            <ColoredSubTabsTrigger
              value="general"
              colorKey="competition"
              icon={<BarChart3 className="h-4 w-4" />}
              tooltip="Statistiques cumulées des combats du/des tournoi(s) sélectionné(s)"
            >
              Général
            </ColoredSubTabsTrigger>
            <ColoredSubTabsTrigger
              value="compare"
              colorKey="competition"
              icon={<GitCompare className="h-4 w-4" />}
              tooltip="Comparer plusieurs tournois avec évolution (flèches et %)"
            >
              Comparer les tournois
            </ColoredSubTabsTrigger>
            <ColoredSubTabsTrigger
              value="by-level"
              colorKey="competition"
              icon={<Layers className="h-4 w-4" />}
              tooltip="Positionnement de l'athlète par niveau de compétition (local, départemental, régional, national, international)"
            >
              Par niveau
            </ColoredSubTabsTrigger>
          </ColoredSubTabsList>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-2 flex-wrap">
          <div className="w-full sm:w-56">
            <Select value={playerId} onValueChange={setPlayerId}>
              <SelectTrigger className="rounded-2xl">
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

          {activeTab !== "by-level" && (
            <div className="w-full sm:w-56">
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Niveau" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les niveaux</SelectItem>
                  {TOURNAMENT_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {activeTab !== "by-level" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full max-w-md rounded-2xl justify-between">
                  <span className="truncate text-left">
                    {selected.length === 0
                      ? "Sélectionnez un ou plusieurs tournois"
                      : selected.length === 1
                      ? tournamentLabel(selected[0])
                      : `${selected.length} tournois sélectionnés`}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {selected.length > 1 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {activeTab === "general" ? "cumul" : "compare"}
                      </Badge>
                    )}
                    <ChevronDown className="h-4 w-4 opacity-60" />
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(92vw,28rem)] p-0" align="center">
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <span className="text-xs text-muted-foreground">
                    {selectedIds.length} / {tournaments.length} sélectionné(s)
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSelectedIds(tournaments.map((t) => t.id))}
                    >
                      Tout
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSelectedIds(tournaments[0] ? [tournaments[0].id] : [])}
                    >
                      Aucun
                    </Button>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                  {tournaments.map((t) => {
                    const checked = selectedIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleId(t.id)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-accent text-left"
                      >
                        <Checkbox checked={checked} onCheckedChange={() => toggleId(t.id)} />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{tournamentLabel(t)}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {t.rounds.length} combat(s) · {tournamentLevelLabel(t.tournament_level)}
                          </div>
                        </div>
                        {checked && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        <TabsContent value="general">
          <GeneralView tournaments={selected} />
        </TabsContent>

        <TabsContent value="compare">
          <CompareView
            tournaments={selected.map((t) => ({
              id: t.id,
              label: tournamentLabel(t),
              summary: summarizeTournamentRounds(t.rounds),
            }))}
          />
        </TabsContent>

        <TabsContent value="by-level">
          <ByLevelView tournaments={allAthleteTournaments} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GeneralView({ tournaments }: { tournaments: JudoMatchRow[] }) {
  if (tournaments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Sélectionnez au moins un tournoi.
      </p>
    );
  }

  const allRounds = tournaments.flatMap((t) => t.rounds);
  const summary = summarizeTournamentRounds(allRounds);
  const isCumul = tournaments.length > 1;

  return (
    <div className="space-y-6">
      {isCumul && (
        <div className="text-center text-sm text-muted-foreground">
          Cumul de <span className="font-semibold text-foreground">{tournaments.length}</span> tournois
          — <span className="font-semibold text-foreground">{allRounds.length}</span> combats
        </div>
      )}

      {/* KPI headline */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Combats" value={summary.combats} accent="primary" />
        <KpiCard label="Victoires" value={summary.wins} accent="success" />
        <KpiCard label="Défaites" value={summary.losses} accent="danger" />
        <KpiCard label="% Victoires" value={`${summary.winRate}%`} accent="primary" />
        <KpiCard
          label="Golden Score"
          value={summary.goldenScoreCount}
          sub="combats joués en prolongation"
        />
      </div>

      {/* Metric groups */}
      {JUDO_METRIC_GROUPS.filter((g) => g.title !== "Bilan combats").map((group) => (
        <Card key={group.title} className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              {group.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {group.metrics.map((m) => (
                <KpiCard
                  key={m.key}
                  label={m.label}
                  value={formatMetric(summary[m.key] as number, m.format)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface CompareRow {
  id: string;
  label: string;
  summary: JudoTournamentSummary;
}

function CompareView({ tournaments }: { tournaments: CompareRow[] }) {
  if (tournaments.length < 2) {
    return (
      <div className="rounded-2xl border bg-surface p-8 text-center">
        <GitCompare className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Sélectionnez au moins 2 tournois pour comparer.
        </p>
      </div>
    );
  }

  // Reference tournament for delta = the OLDEST selected (earliest date).
  // As they arrive sorted DESC by date, the reference is the last item.
  // Use it as baseline; compare each other tournament's metric vs baseline.
  // Order the display so the reference is on the LEFT and progress reads left → right.
  const ordered = [...tournaments].reverse(); // oldest first
  const reference = ordered[0];

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground text-center">
        Référence : <span className="font-semibold text-foreground">{reference.label}</span>
        {" "}— évolution en % vs cette référence
      </div>

      {JUDO_METRIC_GROUPS.map((group) => (
        <Card key={group.title} className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{group.title}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-3 font-medium text-muted-foreground">
                    Statistique
                  </th>
                  {ordered.map((t, i) => (
                    <th
                      key={t.id}
                      className="text-center py-2 px-2 font-medium min-w-[140px]"
                    >
                      <div className="truncate max-w-[180px] mx-auto" title={t.label}>
                        {t.label}
                      </div>
                      {i === 0 && (
                        <Badge variant="secondary" className="mt-1 text-[10px]">
                          référence
                        </Badge>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.metrics.map((m) => {
                  const refVal = reference.summary[m.key] as number;
                  return (
                    <tr key={m.key} className="border-b last:border-0">
                      <td className="py-2 pr-3">{m.label}</td>
                      {ordered.map((t, i) => {
                        const val = t.summary[m.key] as number;
                        return (
                          <td key={t.id} className="text-center py-2 px-2">
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-semibold tabular-nums">
                                {formatMetric(val, m.format)}
                              </span>
                              {i > 0 && (
                                <TrendIndicator
                                  current={val}
                                  previous={refVal}
                                  higherIsBetter={m.higherIsBetter}
                                  showPercentage
                                />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ByLevelView({ tournaments }: { tournaments: JudoMatchRow[] }) {
  // Group by tournament_level, ordered from local → international.
  const groups = useMemo(() => {
    const map = new Map<string, JudoMatchRow[]>();
    for (const t of tournaments) {
      const key = t.tournament_level || "unknown";
      const list = map.get(key) || [];
      list.push(t);
      map.set(key, list);
    }
    const order = [
      ...TOURNAMENT_LEVELS.map((l) => l.value),
      "unknown",
    ];
    return order
      .filter((lvl) => map.has(lvl))
      .map((lvl) => {
        const list = map.get(lvl)!;
        const rounds = list.flatMap((t) => t.rounds);
        return {
          id: lvl,
          label:
            lvl === "unknown"
              ? "Non défini"
              : tournamentLevelLabel(lvl),
          tournamentsCount: list.length,
          combatsCount: rounds.length,
          summary: summarizeTournamentRounds(rounds),
        };
      });
  }, [tournaments]);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Aucun tournoi disponible.
      </p>
    );
  }

  if (groups.length === 1) {
    return (
      <div className="rounded-2xl border bg-surface p-8 text-center">
        <Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Un seul niveau ({groups[0].label}) enregistré. Renseignez des tournois d'autres niveaux
          pour comparer le positionnement de l'athlète.
        </p>
      </div>
    );
  }

  const reference = groups[0]; // lowest level present = baseline

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground text-center">
        Référence : <span className="font-semibold text-foreground">{reference.label}</span>
        {" "}— comment l'athlète se positionne quand le niveau monte
      </div>

      {/* Volume by level */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {groups.map((g) => (
          <KpiCard
            key={g.id}
            label={g.label}
            value={g.tournamentsCount}
            sub={`${g.combatsCount} combat(s)`}
            accent="primary"
          />
        ))}
      </div>

      {JUDO_METRIC_GROUPS.map((group) => (
        <Card key={group.title} className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{group.title}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-3 font-medium text-muted-foreground">
                    Statistique
                  </th>
                  {groups.map((g, i) => (
                    <th
                      key={g.id}
                      className="text-center py-2 px-2 font-medium min-w-[140px]"
                    >
                      <div className="truncate max-w-[180px] mx-auto" title={g.label}>
                        {g.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {g.tournamentsCount} tournoi(s)
                      </div>
                      {i === 0 && (
                        <Badge variant="secondary" className="mt-1 text-[10px]">
                          référence
                        </Badge>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.metrics.map((m) => {
                  const refVal = reference.summary[m.key] as number;
                  return (
                    <tr key={m.key} className="border-b last:border-0">
                      <td className="py-2 pr-3">{m.label}</td>
                      {groups.map((g, i) => {
                        const val = g.summary[m.key] as number;
                        return (
                          <td key={g.id} className="text-center py-2 px-2">
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-semibold tabular-nums">
                                {formatMetric(val, m.format)}
                              </span>
                              {i > 0 && (
                                <TrendIndicator
                                  current={val}
                                  previous={refVal}
                                  higherIsBetter={m.higherIsBetter}
                                  showPercentage
                                />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
