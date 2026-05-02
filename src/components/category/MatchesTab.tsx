import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Calendar, BarChart3, Settings2, Camera, CalendarClock, History, Dumbbell } from "lucide-react";
import { AddMatchCalendarDialog } from "./matches/AddMatchCalendarDialog";
import { MatchCard } from "./matches/MatchCard";
import { PlayerCumulativeStats } from "./matches/PlayerCumulativeStats";
import { BowlingCumulativeStats } from "@/components/bowling/BowlingCumulativeStats";

import { CategoryPhotosTab } from "./photos/CategoryPhotosTab";
import { startOfDay, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ColoredSubTabsList, ColoredSubTabsTrigger } from "@/components/ui/colored-subtabs";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";
import { isIndividualSport } from "@/lib/constants/sportTypes";
import { useViewerMatches } from "@/hooks/use-viewer-data";
import { StatPreferencesDialog } from "./settings/StatPreferencesDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

  // Filter out sub-matches (they are displayed within their parent match)
  // Compare by calendar day so a match scheduled for "today" is considered upcoming
  const parentMatches = matches?.filter((m) => !m.parent_match_id) || [];
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
      <Tabs defaultValue="matches" className="w-full">
        <div className="flex justify-center overflow-x-auto -mx-4 px-4 pb-2">
          <ColoredSubTabsList colorKey="competition" className="inline-flex w-max p-0.5">
            <ColoredSubTabsTrigger value="matches" colorKey="competition" icon={<Calendar className="h-3 w-3" />} className="text-[11px] px-2 py-1">
              Gestion
            </ColoredSubTabsTrigger>
            <ColoredSubTabsTrigger value="stats" colorKey="competition" icon={<BarChart3 className="h-3 w-3" />} className="text-[11px] px-2 py-1">
              Stats
            </ColoredSubTabsTrigger>
          </ColoredSubTabsList>
        </div>

        <TabsContent value="matches">
          <Card className="bg-gradient-card shadow-md">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Gestion des {itemLabelPlural}
                </CardTitle>
                {!isViewer && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {!isBowling && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setIsStatPrefsOpen(true)}
                        className="gap-1"
                      >
                        <Settings2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Personnaliser stats</span>
                      </Button>
                    )}
                    {showTrainingButton && (
                      <Button
                        variant="outline"
                        onClick={() => createTrainingMatch.mutate()}
                        disabled={createTrainingMatch.isPending}
                        className="gap-2"
                      >
                        <Dumbbell className="h-4 w-4" />
                        {isTennis ? "Match entraînement" : "Entraînement bowling"}
                      </Button>
                    )}
                    <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Ajouter {isIndividual ? "une" : "un"} {itemLabel}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {(!matches || matches.length === 0) ? (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    {isIndividual ? "Aucune compétition programmée" : "Aucun match programmé"} pour cette catégorie
                  </p>
                  {!isViewer && (
                    <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Créer {isIndividual ? "la première compétition" : "le premier match"}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Filter row */}
                  <div className="flex items-center gap-4 flex-wrap p-2 rounded-lg bg-muted/40">
                    <span className="text-xs font-medium text-muted-foreground">Afficher :</span>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="filter-upcoming"
                        checked={showUpcoming}
                        onCheckedChange={(v) => setShowUpcoming(v === true)}
                      />
                      <Label htmlFor="filter-upcoming" className="text-xs cursor-pointer flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5 text-primary" />
                        À venir
                        <span className="text-muted-foreground">({upcomingMatches.length})</span>
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="filter-past"
                        checked={showPast}
                        onCheckedChange={(v) => setShowPast(v === true)}
                      />
                      <Label htmlFor="filter-past" className="text-xs cursor-pointer flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5 text-muted-foreground" />
                        Passé{isIndividual ? "e" : ""}s
                        <span className="text-muted-foreground">({pastMatches.length})</span>
                      </Label>
                    </div>
                  </div>

                  {/* === UPCOMING SECTION === */}
                  {showUpcoming && (
                    <section className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <CalendarClock className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-bold text-primary">
                            {itemLabelPluralCapital} à venir
                          </h3>
                        </div>
                        <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                          {upcomingMatches.length}
                        </span>
                      </div>
                      {upcomingMatches.length > 0 ? (
                        <div className="space-y-1.5">
                          {upcomingMatches.map((match) => (
                            <MatchCard key={match.id} match={match} categoryId={categoryId} compact />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic text-center py-3">
                          Aucun{isIndividual ? "e" : ""} {itemLabel} à venir
                        </p>
                      )}
                    </section>
                  )}

                  {/* === PAST SECTION === */}
                  {showPast && (
                    <section className="rounded-xl border border-border bg-muted/30 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <History className="h-4 w-4 text-muted-foreground" />
                          <h3 className="text-sm font-bold text-foreground/80">
                            {itemLabelPluralCapital} passé{isIndividual ? "e" : ""}s
                          </h3>
                        </div>
                        <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded-full bg-muted-foreground/20 text-foreground text-[11px] font-bold">
                          {pastMatches.length}
                        </span>
                      </div>
                      {pastMatches.length > 0 ? (
                        <div className="space-y-3">
                          {pastMatchesByMonth.map((group) => (
                            <div key={group.key}>
                              <div className="flex items-center gap-2 mb-1.5">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground capitalize">
                                  {group.label}
                                </h4>
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-[10px] font-semibold text-muted-foreground">
                                  {group.matches.length}
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                {group.matches.map((match) => (
                                  <MatchCard key={match.id} match={match} categoryId={categoryId} compact />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic text-center py-3">
                          Aucun{isIndividual ? "e" : ""} {itemLabel} passé{isIndividual ? "e" : ""}
                        </p>
                      )}
                    </section>
                  )}

                  {!showUpcoming && !showPast && (
                    <p className="text-sm text-muted-foreground italic text-center py-6">
                      Cochez au moins un filtre pour afficher les {itemLabelPlural}.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          {isBowling ? (
            <BowlingCumulativeStats categoryId={categoryId} />
          ) : (
            <PlayerCumulativeStats categoryId={categoryId} sportType={sportType} />
          )}
        </TabsContent>



      </Tabs>

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
