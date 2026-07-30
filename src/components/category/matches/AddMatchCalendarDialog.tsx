import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getCompetitionsBySport, getCompetitionStagesBySport } from "@/lib/constants/competitions";
import { isIndividualSport, isBasket3x3 } from "@/lib/constants/sportTypes";
import { Info } from "lucide-react";
import { TOURNAMENT_LEVELS, SELECTION_TYPES } from "@/lib/judo/competitionAnalytics";
import { useSeasonGuard } from "@/hooks/use-season-guard";
import { MatchParticipantsSelector, syncMatchParticipants } from "./MatchParticipantsSelector";

interface AddMatchCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  sportType?: string;
  defaultDate?: Date;
  /** When set, the dialog runs in athlete self-planning mode and uses the
   *  `athlete-create-match` edge function instead of a direct insert. */
  athletePlayerId?: string;
}

const CUSTOM_COMPETITION_VALUE = "__custom__";

// Aviron boat types
const AVIRON_BOAT_TYPES = [
  { value: "1x", label: "1x (Skiff)" },
  { value: "2x", label: "2x (Double)" },
  { value: "2-", label: "2- (Deux sans barreur)" },
  { value: "4x", label: "4x (Quatre de couple)" },
  { value: "4-", label: "4- (Quatre sans barreur)" },
  { value: "4+", label: "4+ (Quatre avec barreur)" },
  { value: "8+", label: "8+ (Huit)" },
];

// Aviron distances
const AVIRON_DISTANCES = [
  { value: 500, label: "500m" },
  { value: 1000, label: "1000m" },
  { value: 1500, label: "1500m" },
  { value: 2000, label: "2000m" },
  { value: 6000, label: "6000m (Tête de rivière)" },
];

// Tennis match formats
const TENNIS_FORMATS = [
  { value: "simple", label: "Simple" },
  { value: "double", label: "Double" },
  { value: "double_mixte", label: "Double Mixte" },
];

// Age categories per sport
const AGE_CATEGORIES: Record<string, { value: string; label: string }[]> = {
  default: [
    { value: "U15", label: "U15 (Cadet)" },
    { value: "U17", label: "U17 (Junior)" },
    { value: "U19", label: "U19" },
    { value: "U23", label: "U23 (Espoir)" },
    { value: "senior", label: "Senior" },
    { value: "master", label: "Master" },
  ],
  surf: [
    { value: "grom_u12", label: "Grom (U12)" },
    { value: "benjamin_u14", label: "Benjamin (U14)" },
    { value: "minime_u16", label: "Minime (U16)" },
    { value: "cadet_u18", label: "Cadet (U18)" },
    { value: "junior", label: "Junior" },
    { value: "espoir", label: "Espoir" },
    { value: "open", label: "Open" },
    { value: "master", label: "Master" },
    { value: "grand_master", label: "Grand Master" },
  ],
};

export function AddMatchCalendarDialog({
  open,
  onOpenChange,
  categoryId,
  sportType = "XV",
  defaultDate,
  athletePlayerId,
}: AddMatchCalendarDialogProps) {
  const competitions = getCompetitionsBySport(sportType);
  const isIndividual = isIndividualSport(sportType);
  const isSurf = sportType.toLowerCase().includes("surf");
  const isAviron = sportType.toLowerCase().includes("aviron");
  const isTennis = sportType.toLowerCase().includes("tennis");
  const isPadel = sportType.toLowerCase().includes("padel");
  const is3x3 = isBasket3x3(sportType);
  const hasTournamentBracket = isPadel || isTennis;
  
  const baseSport = sportType.split('_')[0].toLowerCase();
  const ageCategories = AGE_CATEGORIES[baseSport] || AGE_CATEGORIES.default;
  const [opponent, setOpponent] = useState("");
  const [competition, setCompetition] = useState("");
  const [customCompetition, setCustomCompetition] = useState("");
  const [competitionStage, setCompetitionStage] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [matchTime, setMatchTime] = useState("");
  const [location, setLocation] = useState("");
  const [isHome, setIsHome] = useState(true);
  const [notes, setNotes] = useState("");
  const [tournamentLevel, setTournamentLevel] = useState<string>("");
  const [selectionType, setSelectionType] = useState<string>("club");
  
  // Aviron specific fields
  const [eventType, setEventType] = useState<string>("individual");
  const [ageCategory, setAgeCategory] = useState("");
  const [distanceMeters, setDistanceMeters] = useState<number | undefined>();
  
  // Tennis specific fields
  const [matchFormat, setMatchFormat] = useState<string>("simple");
  
  // Basketball 3x3 (FIBA): format unique = 1ère équipe à 21 pts OU 10 min max (selon ce qui arrive en premier)
  const format3x3 = "fiba_standard";

  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  const queryClient = useQueryClient();
  const guard = useSeasonGuard(categoryId);

  const COMPETITION_STAGES = getCompetitionStagesBySport(sportType || "XV");

  const isCustomSelected = competition === CUSTOM_COMPETITION_VALUE;
  const finalCompetition = isCustomSelected ? customCompetition : competition;

  const addMatch = useMutation({
    mutationFn: async () => {
      if (!guard.assertDate(matchDate)) throw new Error("guard:date");
      if (endDate && !guard.assertDate(endDate)) throw new Error("guard:date");
      if (athletePlayerId && !guard.assertPlayer(athletePlayerId)) throw new Error("guard:player");
      const payload = {
        category_id: categoryId,
        opponent: isIndividual ? (opponent || (hasTournamentBracket ? "Tournoi" : "Compétition")) : opponent,
        competition: finalCompetition || null,
        competition_stage: competitionStage === "none" ? null : (competitionStage || null),
        match_date: matchDate,
        end_date: endDate || null,
        match_time: matchTime || null,
        location: location || null,
        is_home: isHome,
        notes: notes || null,
        event_type: isAviron ? eventType : (isIndividual ? "individual" : "team"),
        age_category: ageCategory || null,
        distance_meters: distanceMeters || null,
        match_format: isPadel
          ? "double"
          : isTennis
          ? matchFormat
          : is3x3
          ? format3x3
          : null,
        tournament_level: tournamentLevel || null,
        selection_type: selectionType || "club",
      } as any;

      if (athletePlayerId) {
        const personalPayload = { ...payload, is_personal: true, created_by_player_id: athletePlayerId };
        const { data, error } = await supabase.functions.invoke("athlete-create-match", {
          body: { category_id: categoryId, player_id: athletePlayerId, match: personalPayload },
        });
        if (error) throw new Error(error.message);
        if (!data?.success) throw new Error(data?.error || "Erreur");
        return;
      }

      const { data: created, error } = await supabase
        .from("matches")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      // Convoke selected athletes → they get a notification and answer present/absent
      if (created?.id && selectedParticipants.length > 0) {
        await syncMatchParticipants(supabase, created.id, selectedParticipants, []);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["match_participants"] });
      toast.success(hasTournamentBracket ? "Tournoi ajouté avec succès" : (isIndividual ? "Compétition ajoutée avec succès" : "Match ajouté avec succès"));
      resetForm();
      onOpenChange(false);
    },
    onError: (err: any) => {
      if (typeof err?.message === "string" && err.message.startsWith("guard:")) return;
      toast.error(isIndividual ? "Erreur lors de l'ajout de la compétition" : "Erreur lors de l'ajout du match");
    },
  });

  // Initialize date when dialog opens with defaultDate
  useEffect(() => {
    if (open && defaultDate) {
      setMatchDate(format(defaultDate, "yyyy-MM-dd"));
    }
  }, [open, defaultDate]);

  const resetForm = () => {
    setOpponent("");
    setCompetition("");
    setCustomCompetition("");
    setCompetitionStage("");
    setMatchDate(defaultDate ? format(defaultDate, "yyyy-MM-dd") : "");
    setEndDate("");
    setMatchTime("");
    setLocation("");
    setIsHome(true);
    setNotes("");
    setEventType("individual");
    setAgeCategory("");
    setDistanceMeters(undefined);
    setMatchFormat("simple");
    setTournamentLevel("");
    setSelectionType("club");
    setSelectedParticipants([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchDate) {
      toast.error("Veuillez remplir les champs obligatoires");
      return;
    }
    // For individual sports, opponent is optional
    if (!isIndividual && !opponent) {
      toast.error("Veuillez remplir les champs obligatoires");
      return;
    }
    // If custom is selected, require the custom field
    if (isCustomSelected && !customCompetition.trim()) {
      toast.error("Veuillez saisir le nom de la compétition");
      return;
    }
    addMatch.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {hasTournamentBracket ? "Ajouter un tournoi" : (isIndividual ? "Ajouter une compétition" : "Ajouter un match")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tennis specific: Match format */}
          {isTennis && (
            <div className="space-y-2">
              <Label>Format de jeu *</Label>
              <div className="flex gap-4 flex-wrap">
                {TENNIS_FORMATS.map((fmt) => (
                  <label key={fmt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="matchFormat"
                      value={fmt.value}
                      checked={matchFormat === fmt.value}
                      onChange={(e) => setMatchFormat(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span>{fmt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Basketball 3x3 specific: FIBA ruleset info (format unique, pas de choix) */}
          {is3x3 && (
            <div className="space-y-2 rounded-lg border border-orange-200 bg-orange-50/50 p-3 dark:border-orange-900/50 dark:bg-orange-950/20">
              <Label className="flex items-center gap-2 text-orange-900 dark:text-orange-200">
                Format de match 3x3 (FIBA)
              </Label>
              <p className="text-sm font-medium">1ère équipe à <strong>21 points</strong> · ou <strong>10 min max</strong></p>
              <div className="flex items-start gap-2 mt-1 text-xs text-muted-foreground border-t border-orange-200/60 dark:border-orange-900/40 pt-2">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-orange-600 dark:text-orange-400" />
                <span>
                  <strong>Règles FIBA 3x3 :</strong> 1 pt à l'intérieur de l'arc, 2 pts derrière l'arc · Possession 12s · Check-ball après chaque panier encaissé · Bonus à 7 fautes · Prolongation : 1ère équipe à +2 pts. La durée réelle du match est saisie dans les statistiques après le match.
                </span>
              </div>
            </div>
          )}

          {/* Aviron specific: Event type (Individual/Team) */}
          {isAviron && (
            <div className="space-y-2">
              <Label>Type d'épreuve *</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="eventType"
                    value="individual"
                    checked={eventType === "individual"}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>Individuel</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="eventType"
                    value="team"
                    checked={eventType === "team"}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>Équipage</span>
                </label>
              </div>
            </div>
          )}

          {/* Age category (for Aviron and other individual sports) */}
          {isIndividual && (
            <div className="space-y-2">
              <Label>Catégorie d'âge</Label>
              <Select value={ageCategory} onValueChange={setAgeCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {ageCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Aviron: Distance */}
          {isAviron && (
            <div className="space-y-2">
              <Label>Distance</Label>
              <Select 
                value={distanceMeters?.toString() || ""} 
                onValueChange={(v) => setDistanceMeters(v ? parseInt(v) : undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une distance" />
                </SelectTrigger>
                <SelectContent>
                  {AVIRON_DISTANCES.map((dist) => (
                    <SelectItem key={dist.value} value={dist.value.toString()}>
                      {dist.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!isIndividual && (
            <div className="space-y-2">
              <Label htmlFor="opponent">Adversaire *</Label>
              <Input
                id="opponent"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                placeholder="Nom de l'équipe adverse"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="competition">
              {isIndividual ? "Type de compétition *" : "Championnat"}
            </Label>
            <Select value={competition} onValueChange={setCompetition}>
              <SelectTrigger>
                <SelectValue placeholder={isIndividual ? "Sélectionner une compétition" : "Sélectionner un championnat"} />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {competitions.map((category) => (
                  <SelectGroup key={category.label}>
                    <SelectLabel className="text-xs font-semibold text-muted-foreground">
                      {category.label}
                    </SelectLabel>
                    {category.options.map((comp) => (
                      <SelectItem key={comp} value={comp}>
                        {comp}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
                <SelectGroup>
                  <SelectLabel className="text-xs font-semibold text-muted-foreground">
                    Personnalisé
                  </SelectLabel>
                  <SelectItem value={CUSTOM_COMPETITION_VALUE}>
                    ✏️ Autre (saisie libre)
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {isCustomSelected && (
            <div className="space-y-2">
              <Label htmlFor="customCompetition">Nom de la compétition *</Label>
              <Input
                id="customCompetition"
                value={customCompetition}
                onChange={(e) => setCustomCompetition(e.target.value)}
                placeholder="Saisissez le nom de la compétition..."
                required
              />
            </div>
          )}

          {/* Phase finale dropdown — masqué pour les sports individuels (saisi par épreuve/tour) */}
          {!isIndividual && (
            <div className="space-y-2">
              <Label htmlFor="competitionStage">Phase de compétition</Label>
              <Select value={competitionStage} onValueChange={setCompetitionStage}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une phase (optionnel)" />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  {COMPETITION_STAGES.map((stage) => (
                    <SelectItem key={stage.value} value={stage.value || "none"}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isIndividual && (
            <div className="space-y-2">
              <Label htmlFor="opponent">{hasTournamentBracket ? "Nom du tournoi" : "Nom de l'événement"}</Label>
              <Input
                id="opponent"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                placeholder={hasTournamentBracket ? "Ex: Open de France, Tournoi du Club..." : (isSurf ? "Ex: Lacanau Pro, Biarritz Surf Festival..." : "Ex: Tournoi de Paris, Régates Nationales...")}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tournamentLevel">Niveau du tournoi</Label>
              <Select value={tournamentLevel || "none"} onValueChange={(v) => setTournamentLevel(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un niveau (optionnel)" />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  <SelectItem value="none">Non défini</SelectItem>
                  {TOURNAMENT_LEVELS.map((lvl) => (
                    <SelectItem key={lvl.value} value={lvl.value}>{lvl.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="selectionType">Participation</Label>
              <Select value={selectionType} onValueChange={setSelectionType}>
                <SelectTrigger>
                  <SelectValue placeholder="Type de participation" />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  {SELECTION_TYPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className={`grid ${isIndividual ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
            <div className="space-y-2">
              <Label htmlFor="matchDate">{isIndividual ? "Date début *" : "Date *"}</Label>
              <Input
                id="matchDate"
                type="date"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                required
              />
            </div>
            {isIndividual && (
              <div className="space-y-2">
                <Label htmlFor="endDate">Date fin</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={matchDate}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="matchTime">Heure</Label>
              <Input
                id="matchTime"
                type="time"
                value={matchTime}
                onChange={(e) => setMatchTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Lieu</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={isAviron ? "Plan d'eau, bassin..." : isSurf ? "Spot, plage..." : isIndividual ? "Salle, bowling, dojo..." : "Stade, ville..."}
            />
          </div>

          {!isIndividual && (
            <div className="flex items-center justify-between">
              <Label htmlFor="isHome">Match à domicile</Label>
              <Switch
                id="isHome"
                checked={isHome}
                onCheckedChange={setIsHome}
              />
            </div>
          )}

          {!athletePlayerId && (
            <MatchParticipantsSelector
              categoryId={categoryId}
              value={selectedParticipants}
              onChange={setSelectedParticipants}
            />
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informations complémentaires..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={addMatch.isPending}>
              {addMatch.isPending ? "Ajout..." : "Ajouter"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
