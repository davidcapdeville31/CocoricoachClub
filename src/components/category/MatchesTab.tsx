import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Calendar, Settings2, Camera, CalendarClock, History, Dumbbell } from "lucide-react";
import { AddMatchCalendarDialog } from "./matches/AddMatchCalendarDialog";
import { MatchCard } from "./matches/MatchCard";

import { CategoryPhotosTab } from "./photos/CategoryPhotosTab";
import { startOfDay, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";
import { isIndividualSport } from "@/lib/constants/sportTypes";
import { useViewerMatches } from "@/hooks/use-viewer-data";
import { StatPreferencesDialog } from "./settings/StatPreferencesDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSeasonRosterFilter } from "@/contexts/SeasonRosterFilterContext";
import { SeasonRosterFilterToggle } from "./SeasonRosterFilterToggle";

interface MatchesTabProps {
  categoryId: string;
  sportType?: string;
}

export function MatchesTab({ categoryId, sportType }: MatchesTabProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isStatPrefsOpen, setIsStatPrefsOpen] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [showPast, setShowPast] = useState(true);
  const { isViewer } = useViewerModeContext();
  const queryClient = useQueryClient();

  // Check if this is an individual sport (judo, bowling)
  const isIndividual = isIndividualSport(sportType || "");
  const isBowling = (sportType || "").toLowerCase().includes("bowling");
  const isTennis = (sportType || "").toLowerCase().includes("tennis");
  const showTrainingButton = isBowling || isTennis;

  const createTrainingMatch = useMutation({
    mutationFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const label = isTennis ? "Match d'entraînement" : "Entraînement";
      const { data: inserted, error } = await supabase
        .from("matches")
        .insert({
          category_id: categoryId,
          opponent: `${label} ${format(new Date(), "dd/MM/yyyy")}`,
          match_date: today,
          event_type: "training",
          is_home: true,
        })
        .select("id")
        .single();
      if (error) throw error;

      // For bowling training: auto-add all category players to the lineup
      // so they appear immediately in "Gestion des Parties"
      if (isBowling && inserted?.id) {
        const { data: players } = await supabase
          .from("players")
          .select("id")
          .eq("category_id", categoryId);

        if (players && players.length > 0) {
          await supabase.from("match_lineups").insert(
            players.map((p) => ({
              match_id: inserted.id,
              player_id: p.id,
            }))
          );
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches", categoryId] });
      const msg = isTennis
        ? "Match d'entraînement créé ! Ajoutez la composition puis saisissez les stats."
        : "Entraînement bowling créé avec tous les joueurs ! Cliquez sur Parties pour saisir les scores.";
      toast.success(msg);
    },
    onError: () => toast.error("Erreur lors de la création"),
  });
  
  // Labels adaptés selon le sport
  const itemLabel = isIndividual ? "compétition" : "match";
  const itemLabelPlural = isIndividual ? "compétitions" : "matchs";
  const itemLabelCapital = isIndividual ? "Compétition" : "Match";
  const itemLabelPluralCapital = isIndividual ? "Compétitions" : "Matchs";

  const { data: matches, isLoading } = useViewerMatches(categoryId);
  const { isDateInActiveSeason, activeSeasonOnly, activeSeasonName } = useSeasonRosterFilter();

  // Filter out sub-matches (they are displayed within their parent match)
  // and exclude training events — the Competition tab must only show real competitions.
  // Compare by calendar day so a match scheduled for "today" is considered upcoming
  const parentMatches =
    matches?.filter(
      (m) =>
        !m.parent_match_id &&
        (m as any).event_type !== "training" &&
        isDateInActiveSeason(m.match_date),
    ) || [];
  const today = startOfDay(new Date());
  const upcomingMatches = parentMatches.filter(
    (m) => startOfDay(new Date(m.match_date)).getTime() >= today.getTime()
  );
  const pastMatches = parentMatches.filter(
    (m) => startOfDay(new Date(m.match_date)).getTime() < today.getTime()
  );

  // Group past matches by month (most recent first)
  const pastMatchesByMonth = (() => {
    const sorted = [...pastMatches].sort(
      (a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime()
    );
    const groups = new Map<string, { label: string; matches: typeof sorted }>();
    sorted.forEach((m) => {
      const d = new Date(m.match_date);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      const label = format(d, "MMMM yyyy", { locale: fr });
      if (!groups.has(key)) groups.set(key, { label, matches: [] });
      groups.get(key)!.matches.push(m);
    });
    return Array.from(groups.entries()).map(([key, value]) => ({ key, ...value }));
  })();

  if (isLoading) {
    return <p className="text-muted-foreground">Chargement...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="w-full">
        <div>

          <Card className="overflow-hidden border border-border shadow-sm rounded-2xl bg-card">
            {/* Header solid */}
            <div className="relative overflow-hidden bg-amber-600 px-5 py-4">
              <div className="relative flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg ring-1 ring-white/30">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      Gestion des {itemLabelPlural}
                    </h2>
                    <p className="text-xs text-white/80">
                      {matches?.length || 0} {itemLabel}{(matches?.length || 0) > 1 ? "s" : ""} au total
                    </p>
                  </div>
                </div>
                {!isViewer && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {!isBowling && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsStatPrefsOpen(true)}
                        className="gap-1 bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur-sm"
                      >
                        <Settings2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Modifier les stats par défaut</span>
                      </Button>
                    )}
                    {showTrainingButton && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => createTrainingMatch.mutate()}
                        disabled={createTrainingMatch.isPending}
                        className="gap-2 bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur-sm"
                      >
                        <Dumbbell className="h-4 w-4" />
                        {isTennis ? "Match entraînement" : "Entraînement bowling"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => setIsAddDialogOpen(true)}
                      className="gap-2 bg-white text-amber-700 hover:bg-amber-50 shadow-lg font-semibold"
                    >
                      <Plus className="h-4 w-4" />
                      Ajouter {isIndividual ? "une" : "un"} {itemLabel}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <CardContent className="p-5">
              {(!matches || matches.length === 0) ? (
                <div className="text-center py-16 rounded-2xl bg-muted/30 border border-dashed border-border/60">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/40 mb-4">
                    <Calendar className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-base font-semibold text-foreground mb-1">
                    {isIndividual ? "Aucune compétition programmée" : "Aucun match programmé"}
                  </p>
                  <p className="text-sm text-muted-foreground mb-5">
                    Commencez par créer votre {isIndividual ? "première compétition" : "premier match"}
                  </p>
                  {!isViewer && (
                    <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
                      <Plus className="h-4 w-4" />
                      Créer {isIndividual ? "la première compétition" : "le premier match"}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Filter chips */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">Afficher :</span>
                    <button
                      type="button"
                      onClick={() => setShowUpcoming(!showUpcoming)}
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
                        showUpcoming
                          ? "bg-amber-600 text-white border-transparent"
                          : "bg-muted/50 text-muted-foreground border-border hover:bg-muted",
                      )}
                    >
                      <CalendarClock className="h-3.5 w-3.5" />
                      À venir
                      <span className={cn(
                        "ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                        showUpcoming ? "bg-white/25 text-white" : "bg-background text-foreground",
                      )}>
                        {upcomingMatches.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPast(!showPast)}
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
                        showPast
                          ? "bg-slate-700 text-white border-transparent"
                          : "bg-muted/50 text-muted-foreground border-border hover:bg-muted",
                      )}
                    >
                      <History className="h-3.5 w-3.5" />
                      Passé{isIndividual ? "e" : ""}s
                      <span className={cn(
                        "ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                        showPast ? "bg-white/25 text-white" : "bg-background text-foreground",
                      )}>
                        {pastMatches.length}
                      </span>
                    </button>
                  </div>

                  {/* === UPCOMING SECTION === */}
                  {showUpcoming && (
                    <section className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-amber-600 flex items-center justify-center">
                            <CalendarClock className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-foreground">
                              {itemLabelPluralCapital} à venir
                            </h3>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                              Prochains événements
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-amber-600 text-white text-xs font-bold">
                          {upcomingMatches.length}
                        </span>
                      </div>
                      {upcomingMatches.length > 0 ? (
                        <div className="space-y-2">
                          {upcomingMatches.map((match) => (
                            <MatchCard key={match.id} match={match} categoryId={categoryId} compact />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic text-center py-4">
                          Aucun{isIndividual ? "e" : ""} {itemLabel} à venir
                        </p>
                      )}
                    </section>
                  )}

                  {/* === PAST SECTION === */}
                  {showPast && (
                    <section className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-slate-700 flex items-center justify-center">
                            <History className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-foreground">
                              {itemLabelPluralCapital} passé{isIndividual ? "e" : ""}s
                            </h3>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                              Historique & résultats
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-slate-700 text-white text-xs font-bold">
                          {pastMatches.length}
                        </span>
                      </div>
                      {pastMatches.length > 0 ? (
                        <div className="space-y-4">
                          {pastMatchesByMonth.map((group) => (
                            <div key={group.key}>
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground capitalize">
                                  {group.label}
                                </h4>
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-800/60">
                                  {group.matches.length}
                                </span>
                              </div>
                              <div className="space-y-2">
                                {group.matches.map((match) => (
                                  <MatchCard key={match.id} match={match} categoryId={categoryId} compact />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic text-center py-4">
                          Aucun{isIndividual ? "e" : ""} {itemLabel} passé{isIndividual ? "e" : ""}
                        </p>
                      )}
                    </section>
                  )}

                  {!showUpcoming && !showPast && (
                    <div className="text-center py-10 rounded-2xl bg-muted/30 border border-dashed">
                      <p className="text-sm text-muted-foreground italic">
                        Cochez au moins un filtre pour afficher les {itemLabelPlural}.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AddMatchCalendarDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        categoryId={categoryId}
        sportType={sportType || "XV"}
      />

      {!isBowling && sportType && (
        <StatPreferencesDialog
          open={isStatPrefsOpen}
          onOpenChange={setIsStatPrefsOpen}
          categoryId={categoryId}
          sportType={sportType}
        />
      )}
    </div>
  );
}
