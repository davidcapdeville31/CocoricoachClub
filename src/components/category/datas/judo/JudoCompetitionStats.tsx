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
import { BarChart3, GitCompare, ChevronDown, Check, Trophy, Layers, Award, Gavel, Shield, Swords, Brain, Flame, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportJudoCompetitionPdf, type JudoPdfMode } from "@/lib/judo/judoCompetitionPdfExport";
import { extractFilledRoundStats, formatStatValue, resultLabel } from "@/lib/judo/roundDetail";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Premium theme per metric group — gradient bar, icon chip, colored header background & title.
type GroupTheme = {
  icon: React.ComponentType<{ className?: string }>;
  bar: string; // top gradient bar
  chip: string; // icon chip background
  chipIcon: string; // icon color
  title: string; // title text color
  headerBg: string; // subtle header background tint
  ring: string; // subtle border tint
  tableHead: string; // table header row tint
};

const GROUP_THEMES: Record<string, GroupTheme> = {
  "Bilan combats": {
    icon: Trophy,
    bar: "bg-gradient-to-r from-indigo-500 via-indigo-400 to-sky-400",
    chip: "bg-indigo-500/10 dark:bg-indigo-400/15",
    chipIcon: "text-indigo-600 dark:text-indigo-300",
    title: "text-indigo-700 dark:text-indigo-200",
    headerBg: "bg-indigo-500/[0.04] dark:bg-indigo-400/[0.06]",
    ring: "ring-1 ring-indigo-500/10 dark:ring-indigo-400/15",
    tableHead: "bg-indigo-500/[0.06] dark:bg-indigo-400/[0.08]",
  },
  "Scores": {
    icon: Award,
    bar: "bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-400",
    chip: "bg-amber-500/10 dark:bg-amber-400/15",
    chipIcon: "text-amber-600 dark:text-amber-300",
    title: "text-amber-700 dark:text-amber-200",
    headerBg: "bg-amber-500/[0.05] dark:bg-amber-400/[0.06]",
    ring: "ring-1 ring-amber-500/10 dark:ring-amber-400/15",
    tableHead: "bg-amber-500/[0.06] dark:bg-amber-400/[0.08]",
  },
  "Discipline": {
    icon: Gavel,
    bar: "bg-gradient-to-r from-rose-500 via-red-400 to-pink-400",
    chip: "bg-rose-500/10 dark:bg-rose-400/15",
    chipIcon: "text-rose-600 dark:text-rose-300",
    title: "text-rose-700 dark:text-rose-200",
    headerBg: "bg-rose-500/[0.05] dark:bg-rose-400/[0.06]",
    ring: "ring-1 ring-rose-500/10 dark:ring-rose-400/15",
    tableHead: "bg-rose-500/[0.06] dark:bg-rose-400/[0.08]",
  },
  "Ne-waza": {
    icon: Swords,
    bar: "bg-gradient-to-r from-violet-500 via-purple-400 to-fuchsia-400",
    chip: "bg-violet-500/10 dark:bg-violet-400/15",
    chipIcon: "text-violet-600 dark:text-violet-300",
    title: "text-violet-700 dark:text-violet-200",
    headerBg: "bg-violet-500/[0.05] dark:bg-violet-400/[0.06]",
    ring: "ring-1 ring-violet-500/10 dark:ring-violet-400/15",
    tableHead: "bg-violet-500/[0.06] dark:bg-violet-400/[0.08]",
  },
  "Défense": {
    icon: Shield,
    bar: "bg-gradient-to-r from-emerald-500 via-teal-400 to-green-400",
    chip: "bg-emerald-500/10 dark:bg-emerald-400/15",
    chipIcon: "text-emerald-600 dark:text-emerald-300",
    title: "text-emerald-700 dark:text-emerald-200",
    headerBg: "bg-emerald-500/[0.05] dark:bg-emerald-400/[0.06]",
    ring: "ring-1 ring-emerald-500/10 dark:ring-emerald-400/15",
    tableHead: "bg-emerald-500/[0.06] dark:bg-emerald-400/[0.08]",
  },
  "Tactique": {
    icon: Brain,
    bar: "bg-gradient-to-r from-cyan-500 via-sky-400 to-blue-400",
    chip: "bg-cyan-500/10 dark:bg-cyan-400/15",
    chipIcon: "text-cyan-600 dark:text-cyan-300",
    title: "text-cyan-700 dark:text-cyan-200",
    headerBg: "bg-cyan-500/[0.05] dark:bg-cyan-400/[0.06]",
    ring: "ring-1 ring-cyan-500/10 dark:ring-cyan-400/15",
    tableHead: "bg-cyan-500/[0.06] dark:bg-cyan-400/[0.08]",
  },
};

const DEFAULT_THEME: GroupTheme = {
  icon: Flame,
  bar: "bg-gradient-to-r from-slate-400 to-slate-300",
  chip: "bg-slate-500/10",
  chipIcon: "text-slate-600 dark:text-slate-300",
  title: "text-foreground",
  headerBg: "bg-muted/30",
  ring: "ring-1 ring-border",
  tableHead: "bg-muted/40",
};

function themeFor(title: string): GroupTheme {
  return GROUP_THEMES[title] || DEFAULT_THEME;
}

function GroupCardHeader({ theme, title, subtitle }: { theme: GroupTheme; title: string; subtitle?: string }) {
  const Icon = theme.icon;
  return (
    <>
      <div className={`h-1 w-full ${theme.bar}`} />
      <div className={`flex items-center gap-3 px-4 py-3 ${theme.headerBg}`}>
        <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${theme.chip}`}>
          <Icon className={`h-3.5 w-3.5 ${theme.chipIcon}`} />
        </div>
        <div className="min-w-0">
          <div className={`text-sm font-semibold tracking-tight ${theme.title}`}>{title}</div>
          {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
    </>
  );
}
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

export interface JudoRoundDetail {
  id: string;
  round_number: number | null;
  result: string | null;
  phase: string | null;
  opponent_name: string | null;
  stats: Record<string, number> | null;
  player_id: string | null;
  opponent_profile?: {
    id: string;
    first_name: string | null;
    last_name: string;
    photo_url: string | null;
    weight_category: string | null;
  } | null;
  competition_round_stats?: {
    stat_data: Record<string, number> | null;
  }[] | null;
}

interface JudoMatchRow {
  id: string;
  match_date: string;
  competition: string | null;
  opponent: string | null;
  location: string | null;
  tournament_level: string | null;
  rounds: JudoRoundDetail[];
}

export function JudoCompetitionStats({ categoryId }: Props) {
  const { isDateInActiveSeason } = useSeasonRosterFilter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("general");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [playerId, setPlayerId] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [exporting, setExporting] = useState(false);

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
          id, match_date, competition, opponent, location, tournament_level,
          rounds:competition_rounds(
            id, round_number, result, phase, opponent_name, player_id,
            opponent_profile:opponent_profiles(id, first_name, last_name, photo_url, weight_category),
            competition_round_stats(stat_data)
          )
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

  const tournamentLabel = (t: JudoMatchRow) => {
    const date = format(new Date(t.match_date), "d MMM yyyy", { locale: fr });
    // For judo individual competitions, opponent usually stores the actual tournament name.
    const name = t.opponent || t.competition || tournamentLevelLabel(t.tournament_level) || "Tournoi";
    const parts = [name, date];
    if (t.location) parts.push(t.location);
    return parts.join(" · ");
  };

  const handleExportPdf = async () => {
    const mode = activeTab as JudoPdfMode;
    if (playerId === "all") {
      toast.error("Sélectionne un athlète pour exporter le rapport PDF");
      return;
    }
    // For general/compare, use the currently selected tournaments; for by-level use all
    const source = mode === "by-level" ? allAthleteTournaments : selected;
    if (source.length === 0) {
      toast.error("Aucun tournoi disponible pour l'export");
      return;
    }
    if (mode === "compare" && source.length < 2) {
      toast.error("Sélectionne au moins 2 tournois pour la comparaison");
      return;
    }
    setExporting(true);
    try {
      await exportJudoCompetitionPdf({
        categoryId,
        playerId,
        mode,
        tournaments: source.map((t) => ({
          id: t.id,
          label: tournamentLabel(t),
          matchDate: t.match_date,
          location: t.location,
          competition: t.competition,
          tournamentLevel: t.tournament_level,
          rounds: t.rounds,
        })),
      });
      toast.success("Rapport PDF généré");
    } catch (e: any) {
      console.error(e);
      toast.error(`Erreur lors de l'export : ${e?.message || "inconnue"}`);
    } finally {
      setExporting(false);
    }
  };

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
                          {t.competition && t.competition !== t.opponent ? `${t.competition} · ` : ""}
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

          <Button
            onClick={handleExportPdf}
            disabled={exporting || playerId === "all"}
            className="rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-sky-500 text-white hover:from-indigo-700 hover:to-sky-600 shadow-sm"
            title={playerId === "all" ? "Sélectionne un athlète pour exporter" : "Exporter en PDF"}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            Exporter PDF
          </Button>
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
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-5">
        <KpiCard label="Combats" value={summary.combats} accent="primary" compact />
        <KpiCard label="Victoires" value={summary.wins} accent="success" compact />
        <KpiCard label="Défaites" value={summary.losses} accent="danger" compact />
        <KpiCard label="% Victoires" value={`${summary.winRate}%`} accent="primary" compact />
        <KpiCard
          label="Golden Score"
          value={summary.goldenScoreCount}
          sub="combats en prolongation"
          compact
        />
      </div>

      {/* Metric groups */}
      {JUDO_METRIC_GROUPS.filter((g) => g.title !== "Bilan combats").map((group) => {
        const theme = themeFor(group.title);
        return (
          <Card key={group.title} className={`rounded-2xl overflow-hidden border-0 shadow-sm ${theme.ring}`}>
            <GroupCardHeader theme={theme} title={group.title} />
            <CardContent className="pt-3">
              <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 lg:grid-cols-5">
                {group.metrics.map((m) => (
                  <KpiCard
                    key={m.key}
                    label={m.label}
                    value={formatMetric(summary[m.key] as number, m.format)}
                    compact
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Détails par combat */}
      <CombatsDetailSection tournaments={tournaments} />
    </div>
  );
}

function CombatsDetailSection({ tournaments }: { tournaments: JudoMatchRow[] }) {
  // Flatten rounds, keep tournament context.
  const combats = tournaments.flatMap((t) =>
    t.rounds.map((r) => ({ tournament: t, round: r })),
  );
  const enriched = combats
    .map((c) => ({ ...c, entries: extractFilledRoundStats(c.round.stats) }))
    // Show combats even if no stats filled — but they must have a result or opponent.
    .filter((c) => c.entries.length > 0 || c.round.result || c.round.opponent_name || c.round.opponent_profile);

  if (enriched.length === 0) return null;

  const opponentDisplayName = (r: JudoRoundDetail) => {
    const op = r.opponent_profile;
    if (op) {
      return `${(op.last_name || "").toUpperCase()} ${op.first_name || ""}`.trim();
    }
    return r.opponent_name || "Adversaire inconnu";
  };

  return (
    <Card className="rounded-2xl overflow-hidden border-0 shadow-sm ring-1 ring-slate-500/10">
      <div className="h-1 w-full bg-gradient-to-r from-slate-500 via-slate-400 to-slate-300" />
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-500/[0.04]">
        <div className="h-8 w-8 rounded-xl flex items-center justify-center bg-slate-500/10">
          <Swords className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight">Détails par combat</div>
          <div className="text-[11px] text-muted-foreground">
            {enriched.length} combat(s) — uniquement les statistiques renseignées sont affichées
          </div>
        </div>
      </div>
      <CardContent className="pt-3 space-y-3">
        {enriched.map(({ tournament, round, entries }) => {
          const res = resultLabel(round.result);
          const opName = opponentDisplayName(round);
          const opPhoto = round.opponent_profile?.photo_url || null;
          const weight = round.opponent_profile?.weight_category?.replace(/^judo_/i, "").replace(/_/g, " ");
          return (
            <div
              key={round.id}
              className="rounded-xl border bg-card/50 p-3 flex flex-col sm:flex-row sm:items-start gap-3"
            >
              <div className="flex items-center gap-3 sm:min-w-[220px]">
                <Avatar className="h-11 w-11 ring-1 ring-border">
                  {opPhoto && <AvatarImage src={opPhoto} alt={opName} />}
                  <AvatarFallback className="text-xs">
                    {opName
                      .split(" ")
                      .map((s) => s[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join("")
                      .toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{opName}</div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <Badge
                      className={
                        res.kind === "win"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0"
                          : res.kind === "loss"
                          ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-0"
                          : "bg-muted text-muted-foreground border-0"
                      }
                    >
                      {res.label}
                    </Badge>
                    {round.phase && (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {round.phase}
                      </Badge>
                    )}
                    {weight && (
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {weight}
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 truncate">
                    {tournament.opponent || tournament.competition || "Tournoi"} ·{" "}
                    {format(new Date(tournament.match_date), "d MMM yyyy", { locale: fr })}
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                {entries.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Aucune statistique détaillée renseignée pour ce combat.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                    {entries.map((e) => (
                      <div
                        key={e.key}
                        className={`rounded-lg px-2 py-1.5 text-xs border ${
                          e.polarity === "for"
                            ? "bg-emerald-500/5 border-emerald-500/20"
                            : e.polarity === "against"
                            ? "bg-rose-500/5 border-rose-500/20"
                            : "bg-muted/40 border-border"
                        }`}
                      >
                        <div className="text-[10px] text-muted-foreground truncate">{e.label}</div>
                        <div className="font-semibold tabular-nums">
                          {formatStatValue(e.value, e.format)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
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

      {JUDO_METRIC_GROUPS.map((group) => {
        const theme = themeFor(group.title);
        return (
          <Card key={group.title} className={`rounded-2xl overflow-hidden border-0 shadow-sm ${theme.ring}`}>
            <GroupCardHeader theme={theme} title={group.title} />
            <CardContent className="overflow-x-auto pt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`${theme.tableHead} rounded-lg`}>
                    <th className="text-left py-1.5 pr-3 pl-2 font-medium text-muted-foreground">
                      Statistique
                    </th>
                    {ordered.map((t, i) => (
                      <th
                        key={t.id}
                        className="text-center py-1.5 px-2 font-medium min-w-[140px]"
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
                  {group.metrics.map((m, rowIdx) => {
                    const refVal = reference.summary[m.key] as number;
                    return (
                      <tr key={m.key} className={`border-b last:border-0 ${rowIdx % 2 === 1 ? "bg-muted/20" : ""}`}>
                        <td className="py-1.5 pr-3 pl-2">{m.label}</td>
                        {ordered.map((t, i) => {
                          const val = t.summary[m.key] as number;
                          return (
                            <td key={t.id} className="text-center py-1.5 px-2">
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
        );
      })}
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
      <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 lg:grid-cols-5">
        {groups.map((g) => (
          <KpiCard
            key={g.id}
            label={g.label}
            value={g.tournamentsCount}
            sub={`${g.combatsCount} combat(s)`}
            accent="primary"
            compact
          />
        ))}
      </div>

      {JUDO_METRIC_GROUPS.map((group) => {
        const theme = themeFor(group.title);
        return (
          <Card key={group.title} className={`rounded-2xl overflow-hidden border-0 shadow-sm ${theme.ring}`}>
            <GroupCardHeader theme={theme} title={group.title} />
            <CardContent className="overflow-x-auto pt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className={theme.tableHead}>
                    <th className="text-left py-1.5 pr-3 pl-2 font-medium text-muted-foreground">
                      Statistique
                    </th>
                    {groups.map((g, i) => (
                      <th
                        key={g.id}
                        className="text-center py-1.5 px-2 font-medium min-w-[140px]"
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
                  {group.metrics.map((m, rowIdx) => {
                    const refVal = reference.summary[m.key] as number;
                    return (
                      <tr key={m.key} className={`border-b last:border-0 ${rowIdx % 2 === 1 ? "bg-muted/20" : ""}`}>
                        <td className="py-1.5 pr-3 pl-2">{m.label}</td>
                        {groups.map((g, i) => {
                          const val = g.summary[m.key] as number;
                          return (
                            <td key={g.id} className="text-center py-1.5 px-2">
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
        );
      })}
    </div>
  );
}
