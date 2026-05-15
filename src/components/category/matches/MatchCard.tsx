import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { MatchSheetsSection } from "@/components/category/admin/MatchSheetsSection";
import { fr } from "date-fns/locale";
import {
  Trash2,
  Users,
  BarChart3,
  MapPin,
  Home,
  Plane,
  Edit2,
  Check,
  X,
  Trophy,
  Swords,
  CheckCircle2,
  Settings,
  Plus,
  ChevronDown,
  ChevronUp,
  Lock,
  Bell,
  FileSpreadsheet,
  Award,
  Download,
} from "lucide-react";
import { MedalsDialog } from "./MedalsDialog";
import { MatchLineupDialog } from "./MatchLineupDialog";
import { isSurfCategory, isSkiCategory, getMainSportFromType, isRugbyType } from "@/lib/constants/sportTypes";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import { FisPreCompetitionForm } from "@/components/planning/FisPreCompetitionForm";
import { SurfConditionsForm } from "@/components/surf/SurfConditionsForm";
import { SkiConditionsForm } from "@/components/ski/SkiConditionsForm";
import { SessionEquipmentSection } from "@/components/shared/SessionEquipmentSection";
import { SportMatchStatsDialog } from "./SportMatchStatsDialog";
import { ManualRugbyStatsDialog } from "./ManualRugbyStatsDialog";
import { StatPreferencesDialog } from "@/components/category/settings/StatPreferencesDialog";
import { ClipboardEdit, Settings2 } from "lucide-react";
import { CompetitionRoundsDialog } from "./CompetitionRoundsDialog";
import { AggregatedRoundStatsDialog } from "./AggregatedRoundStatsDialog";
import { EditMatchDialog } from "./EditMatchDialog";
import { AddSubMatchDialog } from "./AddSubMatchDialog";
import { MatchExportDialog } from "./MatchExportDialog";
import { NotifyAthletesDialog } from "@/components/notifications/NotifyAthletesDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { isIndividualSport } from "@/lib/constants/sportTypes";
import { getCompetitionStageLabel as getCompetitionStageLabelUtil } from "@/lib/constants/competitions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Match {
  id: string;
  opponent: string;
  match_date: string;
  match_time: string | null;
  location: string | null;
  is_home: boolean;
  score_home: number | null;
  score_away: number | null;
  notes: string | null;
  category_id: string;
  competition: string | null;
  competition_stage: string | null;
  is_finalized?: boolean;
  event_type?: string | null;
  age_category?: string | null;
  distance_meters?: number | null;
  parent_match_id?: string | null;
  end_date?: string | null;
  match_format?: string | null;
}

interface MatchCardProps {
  match: Match;
  categoryId: string;
  isSubMatch?: boolean;
  compact?: boolean;
}

export function MatchCard({ match, categoryId, isSubMatch = false, compact = false }: MatchCardProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [isLineupOpen, setIsLineupOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isManualRugbyOpen, setIsManualRugbyOpen] = useState(false);
  const [isMatchStatPrefsOpen, setIsMatchStatPrefsOpen] = useState(false);
  const [isAggregatedStatsOpen, setIsAggregatedStatsOpen] = useState(false);
  const [isRoundsOpen, setIsRoundsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddSubMatchOpen, setIsAddSubMatchOpen] = useState(false);
  const [isSubMatchesExpanded, setIsSubMatchesExpanded] = useState(false);
  const [isEditingScore, setIsEditingScore] = useState(false);
  const [isNotifyOpen, setIsNotifyOpen] = useState(false);
  const [isMatchSheetOpen, setIsMatchSheetOpen] = useState(false);
  const [isMedalsOpen, setIsMedalsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportScope, setExportScope] = useState<"single" | "competition">("single");
  const [scoreHome, setScoreHome] = useState(match.score_home?.toString() || "");
  const [scoreAway, setScoreAway] = useState(match.score_away?.toString() || "");
  const queryClient = useQueryClient();

  const navigate = useNavigate();

  const stopCardAction = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const { data: category } = useQuery({
    queryKey: ["category-sport", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("rugby_type")
        .eq("id", categoryId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: lineupCount } = useQuery({
    queryKey: ["match_lineup_count", match.id],
    queryFn: async () => {
      // Athletics: a single athlete can be registered on multiple events
      // (= multiple rows). We must count DISTINCT athletes, not rows.
      const { data, error } = await supabase
        .from("match_lineups")
        .select("player_id")
        .eq("match_id", match.id);
      if (error) throw error;
      const uniquePlayerIds = new Set((data || []).map((r: any) => r.player_id));
      return uniquePlayerIds.size;
    },
  });

  // Fetch lineup player names for pair display (Padel/Tennis doubles)
  const { data: lineupPlayers } = useQuery({
    queryKey: ["match_lineup_players", match.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_lineups")
        .select("player_id, players(id, name, first_name)")
        .eq("match_id", match.id);
      if (error) throw error;
      return data;
    },
  });

  // Fetch competition rounds count for Judo/Bowling/Aviron/Athletics
  // On ne compte que les rounds qui ont effectivement des stats saisies (ou un résultat
  // / temps / classement) — un round vide ne doit pas être présenté comme un résultat.
  const { data: roundsCount } = useQuery({
    queryKey: ["competition_rounds_count", match.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_rounds")
        .select("id, result, final_time_seconds, ranking, competition_round_stats(id)")
        .eq("match_id", match.id);
      if (error) throw error;
      const meaningful = (data || []).filter((r: any) => {
        const hasStats = Array.isArray(r.competition_round_stats) && r.competition_round_stats.length > 0;
        const hasResult = !!r.result || r.final_time_seconds != null || r.ranking != null;
        return hasStats || hasResult;
      });
      return meaningful.length;
    },
  });

  // For individual sports: distinct phases actually saved across all athletes' rounds.
  // En athlétisme, chaque athlète peut avoir son propre parcours (séries, demi, finale...)
  // donc on agrège ici les phases distinctes pour les afficher en badges dynamiques.
  const { data: distinctRoundPhases } = useQuery({
    queryKey: ["competition_rounds_phases", match.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_rounds")
        .select("phase")
        .eq("match_id", match.id)
        .not("phase", "is", null);
      if (error) throw error;
      const set = new Set<string>();
      (data || []).forEach((r: any) => {
        if (r.phase) set.add(r.phase);
      });
      return Array.from(set);
    },
  });

  // Fetch sub-matches for this match (only if not already a sub-match)
  const { data: subMatches } = useQuery({
    queryKey: ["sub_matches", match.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("parent_match_id", match.id)
        .order("match_date", { ascending: true });
      if (error) throw error;
      return data as Match[];
    },
    enabled: !isSubMatch && !match.parent_match_id,
  });

  // Fetch players for notifications
  const { data: players } = useQuery({
    queryKey: ["players-for-notify", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, email, phone")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: isNotifyOpen,
  });

  const sportType = category?.rugby_type || "XV";
  const isIndividual = isIndividualSport(sportType);
  const isPadel = sportType.toLowerCase().includes("padel");
  const isTennis = sportType.toLowerCase().includes("tennis");
  const isSkiSport = getMainSportFromType(sportType) === "ski";
  const hasTournamentBracket = isPadel || isTennis;
  const isDoublesMatch = isPadel || (isTennis && (match.match_format === "double" || match.match_format === "double_mixte"));
  const hasSubMatches = subMatches && subMatches.length > 0;
  const canHaveSubMatches = (!isIndividual || hasTournamentBracket) && !isSubMatch && !match.parent_match_id;
  const isTeamSport = !isIndividual;
  const isRugby = isRugbyType(sportType);
  const isJudo = sportType.toLowerCase().includes("judo");
  const isAthletics = sportType.toLowerCase().includes("athl");
  // Export available for team sports + Judo + Athletics (per user request).
  // Sub-matches/parents are kept consistent so the menu always appears.
  const canExport = (isTeamSport || isJudo || isAthletics) && !isSubMatch;
  const competitionLabel = match.competition || match.opponent || "Compétition";
  // Check if match is within 3 days (for pre-competition form)
  const fisMatchDate = new Date(match.match_date);
  const now = new Date();
  const daysDiff = Math.ceil((fisMatchDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const showPreCompetition = isSkiSport && daysDiff <= 3 && !match.is_finalized;
  
  // Check if this is a sport that uses rounds (Judo, Bowling, Aviron, Athletics)
  const hasRoundBasedStats = sportType.toLowerCase().includes("judo") || 
    sportType.toLowerCase().includes("bowling") ||
    sportType.toLowerCase().includes("athletisme") ||
    sportType.toLowerCase().includes("athlétisme") ||
    sportType.toLowerCase().includes("aviron");


  const getCompetitionStageLabel = (stage: string): string => {
    return getCompetitionStageLabelUtil(stage);
  };

  const deleteMatch = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("matches").delete().eq("id", match.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches", categoryId] });
      toast.success(isIndividual ? "Compétition supprimée" : "Match supprimé");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression");
    },
  });

  const updateScore = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("matches")
        .update({
          score_home: scoreHome ? parseInt(scoreHome) : null,
          score_away: scoreAway ? parseInt(scoreAway) : null,
        })
        .eq("id", match.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches", categoryId] });
      toast.success("Score mis à jour");
      setIsEditingScore(false);
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });

  const finalizeMatch = useMutation({
    mutationFn: async (finalized: boolean) => {
      const { error } = await supabase
        .from("matches")
        .update({ is_finalized: finalized } as any)
        .eq("id", match.id);
      if (error) throw error;

      // When finalizing, auto-inject RPE 10/10 from match lineups (minutes played)
      if (finalized) {
        const matchDate = match.match_date?.split("T")[0] || new Date().toISOString().split("T")[0];

        // Check if RPE already exists from stats dialog
        const { data: existingRpe } = await supabase
          .from("awcr_tracking")
          .select("id")
          .eq("category_id", categoryId)
          .eq("session_date", matchDate)
          .is("training_session_id", null)
          .gte("rpe", 10)
          .limit(1);

        // Only inject if no match RPE exists yet
        if (!existingRpe || existingRpe.length === 0) {
          const { data: lineups } = await supabase
            .from("match_lineups")
            .select("player_id, minutes_played")
            .eq("match_id", match.id);

          if (lineups && lineups.length > 0) {
            const rpeEntries = lineups
              .filter(l => l.minutes_played && l.minutes_played > 0)
              .map(l => ({
                player_id: l.player_id,
                category_id: categoryId,
                session_date: matchDate,
                rpe: 10,
                duration_minutes: l.minutes_played!,
                training_load: 10 * l.minutes_played!,
              }));

            if (rpeEntries.length > 0) {
              const { error: rpeError } = await supabase.from("awcr_tracking").insert(rpeEntries);
              if (rpeError) console.error("Error inserting match RPE from lineups:", rpeError);
            }
          }
        }
      }
    },
    onSuccess: (_, finalized) => {
      queryClient.invalidateQueries({ queryKey: ["matches", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["awcr_tracking"] });
      toast.success(finalized ? "Compétition finalisée" : "Compétition réouverte");
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });

  const matchDate = new Date(match.match_date);
  // Compare dates only (not time) so same-day matches don't appear as "Terminé"
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const matchDay = new Date(matchDate);
  matchDay.setHours(0, 0, 0, 0);
  const isPast = matchDay < today;
  const isFinalized = match.is_finalized === true;
  const isTrainingMatch = match.event_type === "training";

  // Result highlight removed per user request — keep neutral card background
  const resultClass = "";

  return (
    <>
      <div className={`${compact ? 'p-2.5' : 'p-4'} rounded-lg border transition-colors ${isTrainingMatch ? 'bg-muted/50 border-muted opacity-75' : resultClass ? resultClass : isFinalized ? 'border-primary/50 bg-primary/5' : 'bg-card hover:bg-accent/5'}`}>
        {compact && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setIsExpanded((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIsExpanded((v) => !v);
              }
            }}
            className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {isFinalized && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
              {!isIndividual && (
                match.is_home
                  ? <Home className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  : <Plane className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="font-medium text-sm truncate">
                {isIndividual
                  ? (match.competition || match.opponent || "Compétition")
                  : `${match.is_home ? "vs" : "@"} ${match.opponent}`}
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                {format(matchDate, "d MMM yyyy", { locale: fr })}
                {match.match_time && ` · ${match.match_time.slice(0, 5)}`}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!isIndividual && match.score_home !== null && match.score_away !== null && (
                <span className="font-bold text-sm tabular-nums">
                  {match.score_home}-{match.score_away}
                </span>
              )}
              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        )}
        {isExpanded && (
        <div className={compact ? 'mt-3' : ''}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {isTrainingMatch && (
                <Badge variant="outline" className="text-xs border-muted-foreground/50 text-muted-foreground">
                  🎳 Entraînement — Scores via Planification
                </Badge>
              )}
              {isFinalized && (
                <Badge variant="default" className="text-xs bg-primary">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Finalisé
                </Badge>
              )}
              {!isIndividual && (
                <Badge variant={match.is_home ? "default" : "secondary"} className="text-xs">
                  {match.is_home ? (
                    <><Home className="h-3 w-3 mr-1" /> Domicile</>
                  ) : (
                    <><Plane className="h-3 w-3 mr-1" /> Extérieur</>
                  )}
                </Badge>
              )}
              {isPast && !isFinalized && (
                <Badge variant="outline" className="text-xs">
                  Terminé
                </Badge>
              )}
            </div>

            <h4 className="font-semibold text-lg">
              {isIndividual 
                ? (match.competition || match.opponent || "Compétition")
                : `${match.is_home ? "vs" : "@"} ${match.opponent}`
              }
            </h4>

            <div className="text-sm text-muted-foreground mt-1 space-y-1">
              <p>
                {format(matchDate, "EEEE d MMMM yyyy", { locale: fr })}
                {match.end_date && match.end_date !== match.match_date && (
                  <> → {format(new Date(match.end_date), "EEEE d MMMM yyyy", { locale: fr })}</>
                )}
                {match.match_time && ` à ${match.match_time.slice(0, 5)}`}
              </p>
              {/* For individual sports, show event name if different from competition */}
              {isIndividual && match.opponent && match.opponent !== match.competition && (
                <p className="flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  {match.opponent}
                </p>
              )}
              {/* For team sports, show competition */}
              {!isIndividual && match.competition && (
                <p className="flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  {match.competition}
                  {match.competition_stage && (
                    <Badge variant="outline" className="ml-1 text-[10px] py-0 px-1.5">
                      {getCompetitionStageLabel(match.competition_stage)}
                    </Badge>
                  )}
                </p>
              )}
              {/* Show stage(s) for individual sports — only when actually saved per round.
                  La phase prévue au niveau du match a été supprimée pour les sports
                  individuels : chaque épreuve/tour porte désormais sa propre phase. */}
              {isIndividual && distinctRoundPhases && distinctRoundPhases.length > 0 && (
                <p className="flex items-center gap-1 flex-wrap">
                  <Trophy className="h-3 w-3" />
                  {distinctRoundPhases.map((p) => (
                    <Badge
                      key={p}
                      variant="outline"
                      className="text-xs py-0 px-1.5"
                    >
                      {getCompetitionStageLabel(p)}
                    </Badge>
                  ))}
                </p>
              )}
              {match.location && (
                <p className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {match.location}
                </p>
              )}
              {/* Age category */}
              {match.age_category && (
                <p className="text-xs text-muted-foreground/80">
                  Catégorie : {match.age_category}
                </p>
              )}
              {/* Distance for individual sports */}
              {isIndividual && match.distance_meters && match.distance_meters > 0 && (
                <p className="text-xs text-muted-foreground/80">
                  Distance : {match.distance_meters >= 1000 ? `${(match.distance_meters / 1000).toFixed(1)} km` : `${match.distance_meters} m`}
                </p>
              )}
              {/* Pair display for Padel / Tennis doubles */}
              {isDoublesMatch && lineupPlayers && lineupPlayers.length > 0 && (
                <p className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span className="font-medium">
                    Paire : {lineupPlayers.map((lp: any) => {
                      const p = lp.players;
                      return [p?.first_name, p?.name].filter(Boolean).join(" ");
                    }).join(" & ")}
                  </span>
                </p>
              )}
              {/* Tennis format badge */}
              {isTennis && match.match_format && (
                <Badge variant="outline" className="text-xs w-fit">
                  {match.match_format === "simple" ? "Simple" : match.match_format === "double" ? "Double" : "Double Mixte"}
                </Badge>
              )}
              {/* Inline stats badges */}
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                {lineupCount !== undefined && lineupCount > 0 && (
                  <Badge variant="outline" className="text-[10px] gap-1 py-0">
                    <Users className="h-2.5 w-2.5" />
                    {lineupCount} {isIndividual ? "participant(s)" : "joueur(s)"}
                  </Badge>
                )}
                {hasRoundBasedStats && roundsCount !== undefined && roundsCount > 0 && (() => {
                  const st = sportType.toLowerCase();
                  const unitLabel = st.includes("judo")
                    ? "combat"
                    : st.includes("aviron")
                    ? "course"
                    : st.includes("athletisme") || st.includes("athlétisme")
                    ? "résultat"
                    : "partie";
                  return (
                    <Badge variant="outline" className="text-[10px] gap-1 py-0">
                      <BarChart3 className="h-2.5 w-2.5" />
                      {roundsCount} {unitLabel}{roundsCount > 1 ? "s" : ""}
                    </Badge>
                  );
                })()}
                {match.notes && (
                  <Badge variant="outline" className="text-[10px] gap-1 py-0 text-muted-foreground">
                    📝 Note
                  </Badge>
                )}
              </div>
            </div>
            {!isIndividual && (
              <div className="mt-3">
                {isEditingScore ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={scoreHome}
                      onChange={(e) => setScoreHome(e.target.value)}
                      placeholder="Nous"
                      className="w-16 h-8"
                      min={0}
                    />
                    <span>-</span>
                    <Input
                      type="number"
                      value={scoreAway}
                      onChange={(e) => setScoreAway(e.target.value)}
                      placeholder="Eux"
                      className="w-16 h-8"
                      min={0}
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => updateScore.mutate()}>
                      <Check className="h-4 w-4 text-green-500" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditingScore(false)}>
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {match.score_home !== null && match.score_away !== null ? (() => {
                      const ourScore = match.is_home ? match.score_home : match.score_away;
                      const theirScore = match.is_home ? match.score_away : match.score_home;
                      const colorClass =
                        ourScore! > theirScore!
                          ? "text-green-500"
                          : ourScore! < theirScore!
                          ? "text-destructive"
                          : "text-muted-foreground";
                      return (
                        <span className={`font-bold text-xl ${colorClass}`}>
                          {match.score_home} - {match.score_away}
                        </span>
                      );
                    })() : (
                      <span className="text-muted-foreground text-sm">Score non renseigné</span>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => setIsEditingScore(true)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            )}

          </div>

          <div className="relative z-20 flex shrink-0 flex-col gap-1.5 items-end pointer-events-auto">
            {isRugby && (
              <>
                <Button
                  size="lg"
                  className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-600/30"
                  onPointerDown={stopCardAction}
                  onClick={(e) => {
                    stopCardAction(e);
                    navigate(`/categories/${categoryId}/match/${match.id}/live`);
                  }}
                >
                  <Play className="h-5 w-5 fill-white" />
                  Démarrer (temps réel)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2 border-primary/40 text-primary hover:bg-primary/10"
                  onPointerDown={stopCardAction}
                  onClick={(e) => { stopCardAction(e); setIsManualRugbyOpen(true); }}
                >
                  <ClipboardEdit className="h-4 w-4" />
                  Saisie manuelle
                </Button>
              </>
            )}
            {/* Direct action buttons */}
            <div className="flex items-center gap-1.5 w-full">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs flex-1 justify-start" onPointerDown={stopCardAction} onClick={(e) => { stopCardAction(e); setIsEditOpen(true); }}>
                <Edit2 className="h-3.5 w-3.5" />
                Modifier
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                onPointerDown={stopCardAction}
                onClick={(e) => { stopCardAction(e); setIsDeleteOpen(true); }}
                title={isIndividual ? "Supprimer la compétition" : "Supprimer le match"}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs w-full justify-start" onPointerDown={stopCardAction} onClick={(e) => { stopCardAction(e); setIsLineupOpen(true); }}>
              <Users className="h-3.5 w-3.5" />
              {isDoublesMatch ? `Paire (${lineupCount || 0}/2)` : isIndividual ? `Participants (${lineupCount || 0})` : `Composition (${lineupCount || 0})`}
            </Button>
            {hasRoundBasedStats ? (
              <>
                {isTrainingMatch && !sportType.toLowerCase().includes("bowling") ? (
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs w-full justify-start opacity-50 cursor-not-allowed" disabled>
                    <Lock className="h-3.5 w-3.5" />
                    {`Épreuves (${roundsCount || 0})`}
                  </Button>
                ) : (
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs w-full justify-start relative z-20" onPointerDown={stopCardAction} onClick={(e) => { stopCardAction(e); setIsRoundsOpen(true); }}>
                    <Swords className="h-3.5 w-3.5" />
                    {sportType.toLowerCase().includes("judo") ? `Combats (${roundsCount || 0})` : 
                     sportType.toLowerCase().includes("bowling") ? `Parties (${roundsCount || 0})` : 
                     sportType.toLowerCase().includes("aviron") ? `Courses (${roundsCount || 0})` : 
                     (sportType.toLowerCase().includes("athletisme") || sportType.toLowerCase().includes("athlétisme")) ? `Ajouter résultats (${roundsCount || 0})` :
                     `Épreuves (${roundsCount || 0})`}
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs w-full justify-start relative z-20" onPointerDown={stopCardAction} onClick={(e) => { stopCardAction(e); setIsAggregatedStatsOpen(true); }}>
                  <BarChart3 className="h-3.5 w-3.5" />
                  Statistiques
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs w-full justify-start relative z-20"
                onPointerDown={stopCardAction}
                onClick={(e) => {
                  stopCardAction(e);
                  if (isRugby) {
                    navigate(`/categories/${categoryId}/match/${match.id}/live`);
                    return;
                  }
                  setIsStatsOpen(true);
                }}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Statistiques
              </Button>
            )}
            {canHaveSubMatches && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs w-full justify-start" onPointerDown={stopCardAction} onClick={(e) => { stopCardAction(e); setIsAddSubMatchOpen(true); }}>
                <Plus className="h-3.5 w-3.5" />
                Ajouter un match
              </Button>
            )}
            {/* Secondary actions menu */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs w-full justify-start text-muted-foreground">
                  <Settings className="h-3.5 w-3.5" />
                  Plus
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {isFinalized ? (
                  <DropdownMenuItem onClick={() => finalizeMatch.mutate(false)}>
                    <X className="h-4 w-4 mr-2" />
                    Réouvrir
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem 
                    onClick={() => finalizeMatch.mutate(true)}
                    className="text-primary"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Finaliser
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsMedalsOpen(true)} className="text-amber-600 dark:text-amber-400">
                  <Award className="h-4 w-4 mr-2" />
                  Médailles & palmarès
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsNotifyOpen(true)} className="text-primary">
                  <Bell className="h-4 w-4 mr-2" />
                  Notifier les athlètes
                </DropdownMenuItem>
                {canExport && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { setExportScope("single"); setIsExportOpen(true); }}>
                      <Download className="h-4 w-4 mr-2" />
                      Exporter ce match (PDF / Excel)
                    </DropdownMenuItem>
                    {hasSubMatches && (
                      <DropdownMenuItem onClick={() => { setExportScope("competition"); setIsExportOpen(true); }}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Exporter toute la compétition ({(subMatches?.length || 0) + 1})
                      </DropdownMenuItem>
                    )}
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => {
                    if (confirm(isIndividual ? "Supprimer cette compétition ?" : "Supprimer ce match ?")) {
                      deleteMatch.mutate();
                    }
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Surf conditions */}
        {isSurfCategory(sportType) && (
          <div className="mt-3">
            <SurfConditionsForm matchId={match.id} categoryId={categoryId} />
          </div>
        )}

        {/* FIS Pre-competition form (ski sports, 3 days before) */}
        {showPreCompetition && (
          <div className="mt-3">
            <FisPreCompetitionForm
              matchId={match.id}
              categoryId={categoryId}
              currentData={match as any}
            />
          </div>
        )}
        {/* Ski conditions */}
        {isSkiCategory(sportType) && (
          <div className="mt-3">
            <SkiConditionsForm matchId={match.id} categoryId={categoryId} />
          </div>
        )}

        {/* Equipment selection per player */}
        {(isSurfCategory(sportType) || isSkiCategory(sportType) || isPadel) && (
          <div className="mt-3">
            <SessionEquipmentSection
              categoryId={categoryId}
              sportType={sportType}
              matchId={match.id}
            />
          </div>
        )}

        {/* Sub-matches section */}
        {hasSubMatches && (
          <Collapsible open={isSubMatchesExpanded} onOpenChange={setIsSubMatchesExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full mt-3 gap-2 justify-between">
                <span className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  {subMatches?.length} match{subMatches && subMatches.length > 1 ? "s" : ""} dans {hasTournamentBracket ? "ce tournoi" : "cette compétition"}
                </span>
                {isSubMatchesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-2 pl-4 border-l-2 border-primary/20">
              {subMatches?.map((subMatch) => (
                <MatchCard 
                  key={subMatch.id} 
                  match={subMatch} 
                  categoryId={categoryId} 
                  isSubMatch={true}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
        </div>
        )}
      </div>

      <EditMatchDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        match={match}
        sportType={sportType}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isIndividual ? "Supprimer cette compétition ?" : "Supprimer ce match ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les données associées (composition, statistiques, épreuves) seront également supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMatch.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MatchLineupDialog
        open={isLineupOpen}
        onOpenChange={setIsLineupOpen}
        matchId={match.id}
        categoryId={categoryId}
        matchFormat={match.match_format}
      />

      {/* For non-round-based sports, use SportMatchStatsDialog */}
      {!hasRoundBasedStats && !isRugby && (
        <SportMatchStatsDialog
          open={isStatsOpen}
          onOpenChange={setIsStatsOpen}
          matchId={match.id}
          categoryId={categoryId}
          sportType={category?.rugby_type || "XV"}
        />
      )}

      {isRugby && (
        <ManualRugbyStatsDialog
          open={isManualRugbyOpen}
          onOpenChange={setIsManualRugbyOpen}
          matchId={match.id}
          isHome={match.is_home}
          opponentName={match.opponent || "Adversaire"}
          clubName="Notre équipe"
        />
      )}


      {/* For round-based sports, use AggregatedRoundStatsDialog */}
      {hasRoundBasedStats && (
        <AggregatedRoundStatsDialog
          open={isAggregatedStatsOpen}
          onOpenChange={setIsAggregatedStatsOpen}
          matchId={match.id}
          categoryId={categoryId}
          sportType={sportType}
          competitionName={match.competition || match.opponent || "Compétition"}
          competitionDate={match.match_date}
        />
      )}

      {hasRoundBasedStats && (
        <CompetitionRoundsDialog
          open={isRoundsOpen}
          onOpenChange={setIsRoundsOpen}
          matchId={match.id}
          categoryId={categoryId}
          sportType={sportType}
        />
      )}

      {canHaveSubMatches && (
        <AddSubMatchDialog
          open={isAddSubMatchOpen}
          onOpenChange={setIsAddSubMatchOpen}
          parentMatch={{
            id: match.id,
            category_id: match.category_id,
            competition: match.competition,
            match_format: match.match_format,
          }}
        />
      )}

      {/* Notify Athletes Dialog */}
      <NotifyAthletesDialog
        open={isNotifyOpen}
        onOpenChange={setIsNotifyOpen}
        athletes={players || []}
        eventType="match"
        defaultSubject={isIndividual 
          ? `Compétition: ${match.competition || match.opponent || "Compétition"}`
          : `Match ${match.is_home ? "vs" : "@"} ${match.opponent}`
        }
        eventDetails={{
          date: format(new Date(match.match_date), "EEEE d MMMM yyyy", { locale: fr }),
          time: match.match_time ? match.match_time.slice(0, 5) : undefined,
          location: match.location || undefined,
        }}
      />

      {/* Match Sheet Dialog */}
      {isTeamSport && isMatchSheetOpen && (
        <Dialog open={isMatchSheetOpen} onOpenChange={setIsMatchSheetOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Feuille de match — {match.opponent}</DialogTitle>
            </DialogHeader>
            <MatchSheetsSection categoryId={categoryId} preSelectedMatchId={match.id} />
          </DialogContent>
        </Dialog>
      )}

      {/* Medals Dialog */}
      <MedalsDialog
        open={isMedalsOpen}
        onOpenChange={setIsMedalsOpen}
        matchId={match.id}
        categoryId={categoryId}
        competitionName={isIndividual ? (match.competition || match.opponent || "Compétition") : `${match.is_home ? "vs" : "@"} ${match.opponent}`}
        competitionDate={match.match_date}
      />
      {canExport && isExportOpen && (
        <MatchExportDialog
          open={isExportOpen}
          onOpenChange={setIsExportOpen}
          categoryId={categoryId}
          sportType={sportType}
          matchIds={exportScope === "competition" && hasSubMatches
            ? [match.id, ...(subMatches || []).map(s => s.id)]
            : [match.id]}
          title={exportScope === "competition"
            ? `${competitionLabel} (${(subMatches?.length || 0) + 1} matchs)`
            : `vs ${match.opponent || competitionLabel}`}
          subtitle={format(new Date(match.match_date), "EEEE d MMMM yyyy", { locale: fr })}
        />
      )}
    </>
  );
}
