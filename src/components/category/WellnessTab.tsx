import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { subDays } from "date-fns";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ColoredSubTabsList, ColoredSubTabsTrigger } from "@/components/ui/colored-subtabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, AlertTriangle, Calendar, X, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AddWellnessDialog } from "./AddWellnessDialog";
import { WellnessScheduleConfig } from "./wellness/WellnessScheduleConfig";
import { WellnessQuestionsEditor } from "./wellness/WellnessQuestionsEditor";
import { PainConfigEditor } from "./wellness/PainConfigEditor";
import { InjuryRiskAssessment } from "./InjuryRiskAssessment";
import { MenstrualCycleSection } from "./MenstrualCycleSection";
import { WellnessPainStats } from "./WellnessPainStats";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { sleepScoreLabel } from "@/lib/sleepConversion";

interface WellnessTabProps {
  categoryId: string;
  /** Restrict view to a single section. When omitted, all sub-tabs are shown. */
  view?: "tracking" | "pain-stats" | "risk";
}

const getScoreBadgeClass = (score: number) => {
  if (score <= 2) return "bg-status-optimal/15 text-status-optimal border-status-optimal/30";
  if (score <= 3) return "bg-status-attention/15 text-status-attention border-status-attention/30";
  return "bg-status-critical/15 text-status-critical border-status-critical/30";
};

export function WellnessTab({ categoryId, view }: WellnessTabProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [filterFrom, setFilterFrom] = useState<Date | undefined>(new Date());
  const [filterTo, setFilterTo] = useState<Date | undefined>(new Date());
  const [filterPlayerId, setFilterPlayerId] = useState<string>("all");
  const { isViewer } = useViewerModeContext();

  useRealtimeSync({
    tables: ["wellness_tracking"],
    categoryId,
    queryKeys: [
      ["wellness_tracking", categoryId],
      ["wellness_decision", categoryId],
    ],
    channelName: `wellness-sync-${categoryId}`,
  });

  const { data: category } = useQuery({
    queryKey: ["category", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("gender")
        .eq("id", categoryId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const isFeminine = category?.gender === "feminine";

  const { data: wellnessData, isLoading } = useQuery({
    queryKey: ["wellness_tracking", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_tracking")
        .select("*, players(name, first_name)")
        .eq("category_id", categoryId)
        .order("tracking_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="text-muted-foreground">Chargement...</div>;
  }

  const calculateWellnessScore = (entry: NonNullable<typeof wellnessData>[0]) => {
    const avg = (
      entry.sleep_quality +
      entry.sleep_duration +
      entry.general_fatigue +
      entry.stress_level +
      entry.soreness_upper_body +
      entry.soreness_lower_body
    ) / 6;
    return avg.toFixed(1);
  };

  // Filter wellness data by date range
  const fromStr = filterFrom ? format(filterFrom, "yyyy-MM-dd") : null;
  const toStr = filterTo ? format(filterTo, "yyyy-MM-dd") : null;
  const filteredWellnessData = wellnessData?.filter(entry => {
    if (fromStr && entry.tracking_date < fromStr) return false;
    if (toStr && entry.tracking_date > toStr) return false;
    if (filterPlayerId !== "all" && entry.player_id !== filterPlayerId) return false;
    return true;
  });

  // Unique players list from wellness data for the dropdown
  const playersList = Array.from(
    new Map(
      (wellnessData || [])
        .filter(e => e.player_id && e.players)
        .map(e => [e.player_id, { id: e.player_id as string, label: [e.players?.first_name, e.players?.name].filter(Boolean).join(" ") }])
    ).values()
  ).sort((a, b) => a.label.localeCompare(b.label));

  const hasActiveFilter = !!filterFrom || !!filterTo || filterPlayerId !== "all";

  return (
    <div className="space-y-6">
      <Tabs value={view ?? undefined} defaultValue={view ?? "tracking"} className="space-y-4">
        {!view && (
          <div className="flex justify-center overflow-x-auto -mx-4 px-4 pb-2">
            <ColoredSubTabsList colorKey="sante" className="inline-flex w-max">
              <ColoredSubTabsTrigger value="tracking" colorKey="sante">Suivi Wellness</ColoredSubTabsTrigger>
              <ColoredSubTabsTrigger value="pain-stats" colorKey="sante">Statistiques Douleurs</ColoredSubTabsTrigger>
              <ColoredSubTabsTrigger value="risk" colorKey="sante">Risque Blessure (EWMA + AWCR + Wellness)</ColoredSubTabsTrigger>
              {isFeminine && (
                <ColoredSubTabsTrigger value="menstrual" colorKey="sante">Cycle Menstruel</ColoredSubTabsTrigger>
              )}
            </ColoredSubTabsList>
          </div>
        )}

        <TabsContent value="tracking" className="space-y-4">
          {!isViewer && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setIsCustomizeOpen(true)}
                title="Personnaliser les questions, le barème et les natures de douleur"
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Personnaliser Wellness
              </Button>
            </div>
          )}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Wellness & Soreness</CardTitle>
                  <CardDescription>
                    Suivi du bien-être et des douleurs musculaires des joueurs
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Player filter */}
                  <Select value={filterPlayerId} onValueChange={setFilterPlayerId}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Tous les athlètes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les athlètes</SelectItem>
                      {playersList.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Date range: from */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !filterFrom && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {filterFrom ? format(filterFrom, "dd MMM yyyy", { locale: fr }) : "Date de début"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <CalendarComponent
                        mode="single"
                        selected={filterFrom}
                        onSelect={setFilterFrom}
                        locale={fr}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-sm text-muted-foreground">à</span>
                  {/* Date range: to */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !filterTo && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {filterTo ? format(filterTo, "dd MMM yyyy", { locale: fr }) : "Date de fin"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <CalendarComponent
                        mode="single"
                        selected={filterTo}
                        onSelect={setFilterTo}
                        locale={fr}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  {hasActiveFilter && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setFilterFrom(undefined); setFilterTo(undefined); setFilterPlayerId("all"); }}
                      title="Effacer les filtres"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {!isViewer && (
                    <Button onClick={() => setIsDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nouvelle entrée
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
        {!filteredWellnessData || filteredWellnessData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>{hasActiveFilter ? "Aucune donnée wellness pour les filtres sélectionnés." : "Aucune donnée wellness enregistrée."}</p>
            {!isViewer && !hasActiveFilter && (
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setIsDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter la première entrée
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Joueur</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center whitespace-nowrap">Sommeil Qualité</TableHead>
                    <TableHead className="text-center whitespace-nowrap">Sommeil Durée</TableHead>
                    <TableHead className="text-center whitespace-nowrap">Fatigue</TableHead>
                    <TableHead className="text-center whitespace-nowrap">Stress</TableHead>
                    <TableHead className="text-center whitespace-nowrap">Soreness Haut</TableHead>
                    <TableHead className="text-center whitespace-nowrap">Soreness Bas</TableHead>
                    <TableHead className="text-center whitespace-nowrap">Score Moyen</TableHead>
                    <TableHead>Douleur Spécifique</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWellnessData.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {[entry.players?.first_name, entry.players?.name].filter(Boolean).join(" ")}
                      </TableCell>
                      <TableCell>
                        {format(new Date(entry.tracking_date), "dd MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={getScoreBadgeClass(entry.sleep_quality)}>
                          {entry.sleep_quality}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={getScoreBadgeClass(entry.sleep_duration)}>
                          {sleepScoreLabel(entry.sleep_duration)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={getScoreBadgeClass(entry.general_fatigue)}>
                          {entry.general_fatigue}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={getScoreBadgeClass(entry.stress_level)}>
                          {entry.stress_level}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={getScoreBadgeClass(entry.soreness_upper_body)}>
                          {entry.soreness_upper_body}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={getScoreBadgeClass(entry.soreness_lower_body)}>
                          {entry.soreness_lower_body}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={getScoreBadgeClass(parseFloat(calculateWellnessScore(entry)))}>
                          {calculateWellnessScore(entry)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {entry.has_specific_pain ? (
                          <div className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm">{entry.pain_location || "Oui"}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Non</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Légende des scores (1-5)</h4>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="default">1-2</Badge>
                  <span>Bon état</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">3</Badge>
                  <span>À surveiller</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">4-5</Badge>
                  <span>Attention requise</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Pour Soreness: 1 = aucune gêne • 5 = douleur limitante
              </p>
            </div>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="pain-stats">
        <WellnessPainStats categoryId={categoryId} />
      </TabsContent>

      <TabsContent value="risk">
        <InjuryRiskAssessment categoryId={categoryId} />
      </TabsContent>

      {isFeminine && (
        <TabsContent value="menstrual">
          <MenstrualCycleSection categoryId={categoryId} />
        </TabsContent>
      )}
    </Tabs>

    <AddWellnessDialog
      open={isDialogOpen}
      onOpenChange={setIsDialogOpen}
      categoryId={categoryId}
    />

    <Dialog open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Personnaliser le Wellness</DialogTitle>
          <DialogDescription>
            Gérez la fréquence et les questions du wellness pour cette catégorie. Les modifications sont appliquées uniquement à cette catégorie.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <WellnessScheduleConfig categoryId={categoryId} />
          <WellnessQuestionsEditor categoryId={categoryId} />
          <PainConfigEditor categoryId={categoryId} />
        </div>
      </DialogContent>
    </Dialog>
  </div>
  );
}
