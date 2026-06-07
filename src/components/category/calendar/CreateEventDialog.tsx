import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dumbbell, 
  Stethoscope, 
  Video, 
  ClipboardList, 
  Users, 
  Calendar,
  Swords,
  Clock,
  MapPin,
  ChevronLeft,
  CheckCircle2,
  Sparkles,
  Settings2,
  Brain,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSessionNotifications } from "@/lib/hooks/useSessionNotifications";

export interface EditingMentalSession {
  id: string;
  title: string;
  durationMin: number;
  theme: string;
  notes: string;
}

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  categoryId: string;
  onAddSession: () => void;
  onAddMatch: () => void;
  onSelectExternalType?: (type: "session" | "match" | "test" | "field_session") => void;
  /** Called when the user picks the simplified bowling creation mode. */
  onSelectBowlingSimplified?: () => void;
  /** Called when the user picks the advanced bowling creation mode. */
  onSelectBowlingAdvanced?: () => void;
  /** Restrict the event type picker to a subset of EVENT_TYPES (by id). */
  allowedTypeIds?: string[];
  /** When set, this is an athlete creating an event for themselves only. Hides the participants picker. */
  athletePlayerId?: string;
  /** When set, the dialog opens directly in mental-session edit mode and updates the existing row instead of creating. */
  editingMentalSession?: EditingMentalSession | null;
}


const EVENT_TYPES = [
  {
    id: "session",
    label: "Séance musculation / course",
    description: "Programme d'exercices avec charges et séries",
    icon: Dumbbell,
    iconColor: "text-emerald-700 dark:text-emerald-300",
    iconBgColor: "bg-emerald-100 dark:bg-emerald-500/15",
    accentBorderColor: "border-l-emerald-500",
    hoverBorderColor: "hover:border-emerald-400 dark:hover:border-emerald-500",
    useExistingDialog: true,
  },
  {
    id: "field_session",
    label: "Séance terrain",
    description: "Blocs thématiques (collectif, technique, fitness game...)",
    icon: Dumbbell,
    iconColor: "text-lime-700 dark:text-lime-300",
    iconBgColor: "bg-lime-100 dark:bg-lime-500/15",
    accentBorderColor: "border-l-lime-500",
    hoverBorderColor: "hover:border-lime-400 dark:hover:border-lime-500",
    useExistingDialog: true,
  },
  {
    id: "match",
    label: "Match / Compétition",
    description: "Ajouter un match ou une compétition officielle",
    icon: Swords,
    iconColor: "text-rose-700 dark:text-rose-300",
    iconBgColor: "bg-rose-100 dark:bg-rose-500/15",
    accentBorderColor: "border-l-rose-500",
    hoverBorderColor: "hover:border-rose-400 dark:hover:border-rose-500",
    useExistingDialog: true,
  },
  {
    id: "medical",
    label: "Rendez-vous médical",
    description: "Consultation, bilan de santé, suivi kiné",
    icon: Stethoscope,
    iconColor: "text-sky-700 dark:text-sky-300",
    iconBgColor: "bg-sky-100 dark:bg-sky-500/15",
    accentBorderColor: "border-l-sky-500",
    hoverBorderColor: "hover:border-sky-400 dark:hover:border-sky-500",
    useExistingDialog: false,
  },
  {
    id: "video",
    label: "Analyse vidéo",
    description: "Session d'analyse vidéo collective ou individuelle",
    icon: Video,
    iconColor: "text-purple-700 dark:text-purple-300",
    iconBgColor: "bg-purple-100 dark:bg-purple-500/15",
    accentBorderColor: "border-l-purple-500",
    hoverBorderColor: "hover:border-purple-400 dark:hover:border-purple-500",
    useExistingDialog: false,
  },
  {
    id: "test",
    label: "Test physique",
    description: "Évaluation et tests de performance",
    icon: ClipboardList,
    iconColor: "text-amber-700 dark:text-amber-300",
    iconBgColor: "bg-amber-100 dark:bg-amber-500/15",
    accentBorderColor: "border-l-amber-500",
    hoverBorderColor: "hover:border-amber-400 dark:hover:border-amber-500",
    useExistingDialog: true,
  },
  {
    id: "team_meeting",
    label: "Réunion d'équipe",
    description: "Briefing, débriefing, réunion tactique",
    icon: Users,
    iconColor: "text-indigo-700 dark:text-indigo-300",
    iconBgColor: "bg-indigo-100 dark:bg-indigo-500/15",
    accentBorderColor: "border-l-indigo-500",
    hoverBorderColor: "hover:border-indigo-400 dark:hover:border-indigo-500",
    useExistingDialog: false,
  },
  {
    id: "mental",
    label: "Séance mental",
    description: "Préparation mentale, sophrologie, visualisation",
    icon: Brain,
    iconColor: "text-fuchsia-700 dark:text-fuchsia-300",
    iconBgColor: "bg-fuchsia-100 dark:bg-fuchsia-500/15",
    accentBorderColor: "border-l-fuchsia-500",
    hoverBorderColor: "hover:border-fuchsia-400 dark:hover:border-fuchsia-500",
    useExistingDialog: false,
  },
];

export function CreateEventDialog({
  open,
  onOpenChange,
  date,
  categoryId,
  onAddSession,
  onAddMatch,
  onSelectExternalType,
  onSelectBowlingSimplified,
  onSelectBowlingAdvanced,
  allowedTypeIds,
  athletePlayerId,
  editingMentalSession,
}: CreateEventDialogProps) {

  const [step, setStep] = useState<"type" | "bowling_mode" | "details">("type");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(athletePlayerId ? [athletePlayerId] : []);
  const [selectAll, setSelectAll] = useState(false);
  const [mentalDuration, setMentalDuration] = useState<number>(30);
  const [mentalTheme, setMentalTheme] = useState<string>("");

  const queryClient = useQueryClient();
  const { notify } = useSessionNotifications();

  // When opening in edit mode for a mental session, pre-fill and jump to details step.
  useEffect(() => {
    if (open && editingMentalSession) {
      setStep("details");
      setSelectedType("mental");
      setTitle(editingMentalSession.title || "Séance mental");
      setMentalDuration(editingMentalSession.durationMin || 30);
      setMentalTheme(editingMentalSession.theme || "");
      setNotes(editingMentalSession.notes || "");
    }
  }, [open, editingMentalSession]);

  // Fetch players
  const { data: players } = useQuery({
    queryKey: ["players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name, position")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch category sport to label "Séance terrain" dynamically per sport
  const { data: categorySport } = useQuery({
    queryKey: ["category_sport_for_event", categoryId],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("rugby_type")
        .eq("id", categoryId)
        .maybeSingle();
      return (data?.rugby_type as string) || "XV";
    },
  });

  const getFieldSessionLabel = (sport: string | undefined): string => {
    if (!sport) return "Séance terrain";
    const map: Record<string, string> = {
      rugby: "Séance rugby",
      football: "Séance football",
      handball: "Séance handball",
      volleyball: "Séance volley",
      basketball: "Séance basket",
      judo: "Séance judo",
      bowling: "Séance bowling",
      aviron: "Séance aviron",
      athletisme: "Séance athlétisme",
      crossfit: "Séance CrossFit",
      padel: "Séance padel",
      natation: "Séance natation",
      surf: "Séance surf",
      ski: "Séance ski / snow",
      triathlon: "Séance triathlon",
      tennis: "Séance tennis",
    };
    const main = (() => {
      if (["XV","7","XIII","touch","15","academie","national_team"].includes(sport)) return "rugby";
      if (sport.startsWith("snow") || sport.startsWith("ski")) return "ski";
      const prefixes = Object.keys(map);
      return prefixes.find(p => sport === p || sport.startsWith(p + "_")) || "rugby";
    })();
    return map[main] || "Séance terrain";
  };

  const fieldSessionLabel = getFieldSessionLabel(categorySport);
  const isBowlingCategory = (() => {
    const s = (categorySport || "").toLowerCase();
    return s === "bowling" || s.startsWith("bowling_");
  })();
  const eventTypes = EVENT_TYPES
    .filter((t) => !allowedTypeIds || allowedTypeIds.includes(t.id))
    .map((t) => {
      if (t.id === "field_session") return { ...t, label: fieldSessionLabel };
      if (t.id === "match" && isBowlingCategory) {
        return { ...t, label: "Compétition", description: "Ajouter une compétition" };
      }
      return t;
    });


  const resetForm = () => {
    setStep("type");
    setSelectedType(null);
    setTitle("");
    setStartTime("09:00");
    setEndTime("10:00");
    setLocation("");
    setNotes("");
    setSelectedPlayers([]);
    setSelectAll(false);
    setMentalDuration(30);
    setMentalTheme("");
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  const isBowlingSport = (() => {
    const s = (categorySport || "").toLowerCase();
    return s === "bowling" || s.startsWith("bowling_");
  })();

  const handleTypeSelect = (typeId: string) => {
    const eventType = EVENT_TYPES.find(t => t.id === typeId);

    // Bowling: insert a mode picker (Simplifié / Avancé) before opening the editor
    if (typeId === "field_session" && isBowlingSport) {
      setStep("bowling_mode");
      return;
    }

    if (eventType?.useExistingDialog && onSelectExternalType) {
      const action: "session" | "match" | "test" | "field_session" =
        typeId === "test" ? "test"
          : typeId === "match" ? "match"
          : typeId === "field_session" ? "field_session"
          : "session";
      resetForm();
      onSelectExternalType(action);
    } else if (eventType?.useExistingDialog) {
      // Fallback if no onSelectExternalType
      resetForm();
      onOpenChange(false);
      if (typeId === "session") {
        onAddSession();
      } else if (typeId === "match") {
        onAddMatch();
      } else if (typeId === "test") {
        // No external handler — fallback to session flow
        onAddSession();
      }
    } else {
      setSelectedType(typeId);
      setStep("details");
      // Set default title based on type
      if (typeId === "medical") setTitle("Rendez-vous médical");
      if (typeId === "video") setTitle("Analyse vidéo");
      if (typeId === "team_meeting") setTitle("Réunion d'équipe");
      if (typeId === "mental") setTitle("Séance mental");
    }
  };

  const handleSelectAll = (checked: boolean | string) => {
    const isChecked = Boolean(checked);
    setSelectAll(isChecked);
    if (isChecked && players) {
      setSelectedPlayers(players.map(p => p.id));
    } else {
      setSelectedPlayers([]);
    }
  };

  const togglePlayer = (playerId: string) => {
    setSelectedPlayers(prev => 
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
    setSelectAll(false);
  };

  // Create event mutation (for custom events not using existing dialogs)
  const createEvent = useMutation({
    mutationFn: async () => {
      // Événements administratifs (rdv médical, analyse vidéo, réunion) :
      // PAS de RPE, PAS d'intensité — simple ajout au calendrier des athlètes assignés.
      const isAdminEvent =
        selectedType === "medical" || selectedType === "video" || selectedType === "team_meeting" || selectedType === "mental";
      const isMental = selectedType === "mental";
      // For mental sessions: keep a default 09:00 start, compute end from duration (minutes).
      const computeMentalEnd = (start: string, mins: number) => {
        const [h, m] = start.split(":").map(Number);
        const total = h * 60 + m + (mins || 0);
        const eh = String(Math.floor(total / 60) % 24).padStart(2, "0");
        const em = String(total % 60).padStart(2, "0");
        return `${eh}:${em}`;
      };
      const effectiveStart = isMental ? "09:00" : startTime;
      const effectiveEnd = isMental ? computeMentalEnd("09:00", mentalDuration) : endTime;
      const mentalMeta = isMental
        ? `<!--MENTAL:${JSON.stringify({ duration_min: mentalDuration, theme: mentalTheme })}-->\n`
        : "";
      const notesPayload = `${mentalMeta}${title}${isMental && mentalTheme ? ` - ${mentalTheme}` : ""}${location ? ` - ${location}` : ""}${notes ? `\n${notes}` : ""}`;

      // EDIT MODE — update existing mental session and stop early.
      if (editingMentalSession) {
        const { data: updated, error: upErr } = await supabase
          .from("training_sessions")
          .update({
            session_start_time: effectiveStart,
            session_end_time: effectiveEnd,
            notes: notesPayload,
          })
          .eq("id", editingMentalSession.id)
          .select("id")
          .single();
        if (upErr) throw upErr;
        return updated;
      }

      const { data: session, error } = await supabase
        .from("training_sessions")
        .insert({
          category_id: categoryId,
          session_date: format(date, "yyyy-MM-dd"),
          session_start_time: effectiveStart,
          session_end_time: effectiveEnd,
          training_type: selectedType === "medical" ? "medical" : 
                         selectedType === "video" ? "video_analyse" :
                         selectedType === "team_meeting" ? "reunion" :
                         selectedType === "mental" ? "mental" : "autre",
          notes: notesPayload,
          intensity: isAdminEvent ? null : 1,
          planned_intensity: isAdminEvent ? null : null,
          created_by_player_id: athletePlayerId ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;


      // Save participants
      if (selectedPlayers.length > 0 && session) {
        const { error: partError } = await supabase
          .from("event_participants")
          .insert(
            selectedPlayers.map(playerId => ({
              training_session_id: session.id,
              player_id: playerId,
            }))
          );
        if (partError) console.error("Error saving participants:", partError);
      }

      // Auto-notify: push + email + cloche (in-app bell).
      // Si aucun joueur n'est sélectionné, on broadcast à toute la catégorie
      // afin que les athlètes voient quand même la pastille rouge dans la cloche.
      if (session) {
        try {
          await notify({
            action: "created",
            sessionId: session.id,
            categoryId,
            sessionDate: format(date, "yyyy-MM-dd"),
            sessionStartTime: startTime || null,
            sessionType: selectedType === "medical" ? "medical" :
                         selectedType === "video" ? "video_analyse" :
                         selectedType === "team_meeting" ? "reunion" :
                         selectedType === "mental" ? "mental" : "autre",
            location: location || null,
            participantPlayerIds: selectedPlayers.length > 0 ? selectedPlayers : undefined,
          });
          console.log(`[CreateEvent] Notifications sent (push + email + bell) for session ${session.id}`);
        } catch (notifError) {
          console.warn("[CreateEvent] Auto-notification failed:", notifError);
          // Don't block event creation if notification fails
        }
      }


      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["today_sessions", categoryId] });
      toast.success(editingMentalSession ? "Séance mise à jour" : "Événement créé avec succès");
      handleClose(false);
    },
    onError: () => {
      toast.error("Erreur lors de la création de l'événement");
    },
  });

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error("Veuillez saisir un titre");
      return;
    }
    createEvent.mutate();
  };

  const selectedEventType = EVENT_TYPES.find(t => t.id === selectedType);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden border-border/70 bg-background/95 p-0 shadow-2xl backdrop-blur-md">
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            {(step === "details" || step === "bowling_mode") && (
              <Button variant="ghost" size="icon" className="h-8 w-8 mr-1" onClick={() => setStep("type")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <Calendar className="h-5 w-5 text-primary" />
            {step === "type"
              ? "Ajouter un événement"
              : step === "bowling_mode"
                ? "Nouvelle séance bowling"
                : selectedEventType?.label}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {format(date, "EEEE d MMMM yyyy", { locale: fr })}
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
          {step === "type" ? (
            <div className="grid grid-cols-2 gap-2">
              {eventTypes.map((event) => {
                const Icon = event.icon;
                return (
                  <Card
                    key={event.id}
                    className={cn(
                      "cursor-pointer border border-border/70 border-l-4 bg-card/95 transition-all duration-200 hover:scale-[1.02] hover:bg-accent/50 hover:shadow-md dark:bg-card dark:hover:bg-muted/70",
                      event.accentBorderColor,
                      event.hoverBorderColor,
                    )}
                    onClick={() => handleTypeSelect(event.id)}
                  >
                    <CardContent className="p-2.5">
                      <div className="flex items-center gap-2">
                        <div className={cn("rounded-md p-1.5 shrink-0", event.iconBgColor)}>
                          <Icon className={cn("h-4 w-4", event.iconColor)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold leading-tight text-foreground line-clamp-1">
                            {event.label}
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-muted-foreground dark:text-foreground/80">
                            {event.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : step === "bowling_mode" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Choisis le mode de création de la séance bowling.
              </p>
              <Card
                className="cursor-pointer border border-border/70 border-l-4 border-l-cyan-500 bg-card/95 transition-all duration-200 hover:scale-[1.01] hover:bg-accent/50 hover:shadow-md hover:border-cyan-400 dark:bg-card dark:hover:bg-muted/70"
                onClick={() => {
                  resetForm();
                  onSelectBowlingSimplified?.();
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md p-2 shrink-0 bg-cyan-100 dark:bg-cyan-500/15">
                      <Sparkles className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        Mode simplifié
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground dark:text-foreground/80">
                        Création rapide d'une séance bowling (à venir).
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer border border-border/70 border-l-4 border-l-violet-500 bg-card/95 transition-all duration-200 hover:scale-[1.01] hover:bg-accent/50 hover:shadow-md hover:border-violet-400 dark:bg-card dark:hover:bg-muted/70"
                onClick={() => {
                  resetForm();
                  if (onSelectBowlingAdvanced) {
                    onSelectBowlingAdvanced();
                  } else {
                    onSelectExternalType?.("field_session");
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md p-2 shrink-0 bg-violet-100 dark:bg-violet-500/15">
                      <Settings2 className="h-5 w-5 text-violet-700 dark:text-violet-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        Mode avancé
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground dark:text-foreground/80">
                        Blocs thématiques, configuration DTN, lancers, objectifs détaillés...
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Event details form */}
              <div className="space-y-2">
                <Label htmlFor="title">Titre</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nom de l'événement"
                />
              </div>

              {selectedType === "mental" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="mentalDuration" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Temps de travail (minutes)
                    </Label>
                    <Input
                      id="mentalDuration"
                      type="number"
                      min={5}
                      step={5}
                      value={mentalDuration}
                      onChange={(e) => setMentalDuration(Math.max(1, Number(e.target.value) || 0))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Brain className="h-3 w-3" /> Thématique
                    </Label>
                    <Select value={mentalTheme} onValueChange={setMentalTheme}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir une thématique" />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "Respiration",
                          "Visualisation",
                          "Routines",
                          "Confiance en soi",
                          "Gestion des émotions",
                          "Concentration",
                          "Récupération",
                        ].map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startTime" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Début
                    </Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Fin
                    </Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {selectedType !== "mental" && (
                <div className="space-y-2">
                  <Label htmlFor="location" className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Lieu (optionnel)
                  </Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Salle de réunion, cabinet..."
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optionnel)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informations complémentaires..."
                  rows={2}
                />
              </div>

              {/* Player selection (hidden when athlete creates for themselves) */}
              {!athletePlayerId && (
              <div className="space-y-2">


                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> Participants
                  </Label>
                  <div
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => handleSelectAll(!selectAll)}
                    role="checkbox"
                    aria-checked={selectAll}
                  >
                    <Checkbox
                      checked={selectAll}
                      className="pointer-events-none"
                    />
                    <span className="text-xs pointer-events-none">
                      Tous
                    </span>
                  </div>
                </div>
                
                <div className="max-h-[200px] overflow-y-auto rounded-lg border border-border/70 bg-muted/20 p-2 dark:bg-muted/10">
                  <div className="grid grid-cols-2 gap-2">
                    {players?.map((player) => {
                      const isSelected = selectedPlayers.includes(player.id);
                      return (
                        <div
                          key={player.id}
                          onClick={() => togglePlayer(player.id)}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all",
                            isSelected 
                              ? "bg-primary/10 border-2 border-primary" 
                              : "bg-muted/50 border-2 border-transparent hover:bg-muted"
                          )}
                        >
                          <div className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 pointer-events-none",
                            isSelected ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20"
                          )}>
                            {(player.first_name || player.name).charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0 pointer-events-none">
                            <p className="text-sm font-medium truncate">{player.first_name ? `${player.first_name} ${player.name}` : player.name}</p>
                            {player.position && (
                              <p className="text-xs text-muted-foreground">{player.position}</p>
                            )}
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 pointer-events-none" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {selectedPlayers.length > 0 && (
                  <Badge variant="secondary" className="w-fit">
                    {selectedPlayers.length} participant{selectedPlayers.length > 1 ? "s" : ""} sélectionné{selectedPlayers.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              )}

            </div>
          )}
        </div>

        {step === "details" && (
          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button variant="outline" onClick={() => handleClose(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={createEvent.isPending}>
              {createEvent.isPending ? (editingMentalSession ? "Mise à jour..." : "Création...") : (editingMentalSession ? "Mettre à jour" : "Créer l'événement")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
