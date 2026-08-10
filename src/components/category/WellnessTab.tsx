import { useState, useMemo, useEffect, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { subDays } from "date-fns";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { supabase } from "@/integrations/supabase/client";
import { useSeasonFilteredPlayerIds, makePlayerIdFilter } from "@/hooks/use-season-filtered-players";
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
import { WellnessReminderButton } from "./wellness/WellnessReminderButton";
import { WellnessScheduleConfig } from "./wellness/WellnessScheduleConfig";
import { WellnessQuestionsEditor } from "./wellness/WellnessQuestionsEditor";
import { PainConfigEditor } from "./wellness/PainConfigEditor";
import { InjuryRiskAssessment } from "./InjuryRiskAssessment";
import { MenstrualCycleSection } from "./MenstrualCycleSection";
import { WellnessPainStats } from "./WellnessPainStats";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";
import { useMenuPermissions } from "@/hooks/useMenuPermissions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { sleepScoreLabel } from "@/lib/sleepConversion";
import { usePainConfig, DEFAULT_PAIN_CONFIG, useWellnessQuestions, DEFAULT_WELLNESS_QUESTIONS, type WellnessQuestion } from "@/lib/wellness/questionConfig";

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

/** Build an inline style from a customizable pain scale color (hsl(...) string). */
const getScaleStyle = (color: string | undefined): CSSProperties => {
  if (!color) return {};
  return {
    backgroundColor: `color-mix(in hsl, ${color} 18%, transparent)`,
    color,
    borderColor: `color-mix(in hsl, ${color} 45%, transparent)`,
  };
};

export function WellnessTab({ categoryId, view }: WellnessTabProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [filterFrom, setFilterFrom] = useState<Date | undefined>(new Date());
  const [filterTo, setFilterTo] = useState<Date | undefined>(new Date());
  const [filterPlayerId, setFilterPlayerId] = useState<string>("all");
  const { isViewer } = useViewerModeContext();

  // Fetch clubId so useMenuPermissions can detect club-level roles
  // (e.g. doctor / prepa_physique stored at club level, not category level).
  const { data: categoryClub } = useQuery({
    queryKey: ["wellness-category-club", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("club_id")
        .eq("id", categoryId)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const { userRole } = useMenuPermissions(categoryClub?.club_id, categoryId);

  // Global Radix pointer-events:none lock recovery is handled in App via
  // useRadixPointerEventsGuard.




  // Only Coach, Préparateur physique and Médecin (+ owners/super_admin) can customize.
  const STAFF_ROLES = new Set([
    "owner",
    "super_admin",
    "coach",
    "prepa_physique",
    "doctor",
  ]);
  const canCustomize = !!userRole && STAFF_ROLES.has(userRole);


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

  const { data: painConfig } = usePainConfig(categoryId);
  const { data: wellnessQuestions } = useWellnessQuestions(categoryId);
  const activeQuestions = (wellnessQuestions ?? DEFAULT_WELLNESS_QUESTIONS).filter((q) => q.enabled);

  /** Read the answer for a question: standard columns or custom_answers JSON. */
  const getAnswer = (entry: any, q: WellnessQuestion): number | null => {
    const raw = q.is_custom ? entry?.custom_answers?.[q.key] : entry?.[q.key];
    return raw == null ? null : Number(raw);
  };

  const scale = (painConfig ?? DEFAULT_PAIN_CONFIG).scale;
  /** Look up the configured color for an integer score 1..5 (lower = better, e.g. fatigue, stress, soreness, pain). */
  const styleFor = (value: number | null | undefined) => {
    if (value == null) return {} as CSSProperties;
    const rounded = Math.max(1, Math.min(5, Math.round(value)));
    return getScaleStyle(scale.find((s) => s.value === rounded)?.color);
  };
  /** Positive scale 1..5 (higher = better, e.g. sleep quality, sleep duration).
   *  We invert the value to look up the right color on the pain scale. */
  const styleForPositive = (value: number | null | undefined) => {
    if (value == null) return {} as CSSProperties;
    const rounded = Math.max(1, Math.min(5, Math.round(value)));
    const inverted = 6 - rounded; // 5→1 (best→green), 1→5 (worst→red)
    return getScaleStyle(scale.find((s) => s.value === inverted)?.color);
  };


  const { allowedIds } = useSeasonFilteredPlayerIds(categoryId);
  const keepPlayer = makePlayerIdFilter(allowedIds);

  const { data: wellnessDataRaw, isLoading } = useQuery({
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
  const wellnessData = useMemo(
    () => (wellnessDataRaw || []).filter((e: any) => keepPlayer(e.player_id)),
    [wellnessDataRaw, allowedIds],
  );

  if (isLoading) {
    return <div className="text-muted-foreground">Chargement...</div>;
  }

  const calculateWellnessScore = (entry: any) => {
    // Average over all active questions, normalised to the inverted convention
    // (1 = best, 5 = worst) so positive scales are flipped.
    const vals: number[] = [];
    for (const q of activeQuestions) {
      const v = getAnswer(entry, q);
      if (v == null) continue;
      // sleep_duration is stored 1 = >8h (best) → behaves like an inverted scale
      const isInverted = q.inverted || q.is_sleep_duration;
      vals.push(isInverted ? v : 6 - v);
    }
    if (vals.length === 0) return "0.0";
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
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
          {canCustomize && (
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
                    <>
                      <WellnessReminderButton categoryId={categoryId} />
                      <Button onClick={() => setIsDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nouvelle entrée
                      </Button>
                    </>
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
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Joueur</TableHead>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    {activeQuestions.map((q) => (
                      <TableHead key={q.key} className="text-center whitespace-nowrap">
                        {q.emoji ? `${q.emoji} ` : ""}{q.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-center whitespace-nowrap">Score Moyen</TableHead>
                    <TableHead className="whitespace-nowrap">Douleur Spécifique</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWellnessData.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {[entry.players?.first_name, entry.players?.name].filter(Boolean).join(" ")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(entry.tracking_date), "dd MMM yyyy", { locale: fr })}
                      </TableCell>

                      {activeQuestions.map((q) => {
                        const raw = getAnswer(entry, q);
                        return (
                          <TableCell key={q.key} className="text-center">
                            {raw == null ? (
                              <span className="text-muted-foreground text-sm">—</span>
                            ) : (
                              <Badge
                                variant="outline"
                                style={q.inverted || q.is_sleep_duration ? styleFor(raw) : styleForPositive(raw)}
                              >
                                {q.is_sleep_duration ? sleepScoreLabel(raw) : raw}
                              </Badge>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center">
                        <Badge variant="outline" style={styleFor(parseFloat(calculateWellnessScore(entry)))}>
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
              <h4 className="font-medium mb-2">Légende des couleurs (échelle 1-5)</h4>
              <div className="flex flex-wrap gap-3 text-sm">
                {scale.map((s) => (
                  <div key={s.value} className="flex items-center gap-2">
                    <Badge variant="outline" style={getScaleStyle(s.color)}>{s.value}</Badge>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                La couleur suit l'échelle personnalisée de la catégorie. Pour les questions à
                orientation positive (ex. qualité du sommeil, heures de sommeil), la valeur est
                inversée : 5 = optimal (vert), 1 = dégradé (rouge).
              </p>
              {activeQuestions.some((q) => !q.inverted && !q.is_sleep_duration) && (
                <p className="text-xs text-muted-foreground mt-1">
                  Questions positives :{" "}
                  {activeQuestions.filter((q) => !q.inverted && !q.is_sleep_duration).map((q) => q.label).join(" • ")}
                </p>
              )}
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
