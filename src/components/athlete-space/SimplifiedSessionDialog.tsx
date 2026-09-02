import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles, Users } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getTrainingTypesForSport } from "@/lib/constants/trainingTypes";
import { useTranslation } from "react-i18next";
import { AthletePartnersSelector } from "@/components/athlete-space/AthletePartnersSelector";

interface EditableSession {
  id: string;
  session_date: string;
  training_type: string;
  session_start_time?: string | null;
  session_end_time?: string | null;
  intensity?: number | null;
  notes?: string | null;
  event_participants?: Array<{ player_id: string }>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  categoryId: string;
  /** Required in athlete mode; omitted for staff-created sessions. */
  athletePlayerId?: string;
  sportType?: string;
  /** Staff mode creates the session directly and enables category participant selection. */
  staffMode?: boolean;
  /** Optionnel — verrouille le type de séance (ex: musculation). */
  lockedTrainingType?: string;
  /** Séance personnelle existante à modifier. */
  session?: EditableSession | null;
}

/**
 * Mode simplifié générique de création de séance.
 * Il est partagé par l'espace athlète et le calendrier staff afin de garder
 * exactement les mêmes champs, tout en conservant leurs règles de sécurité.
 */
export function SimplifiedSessionDialog({
  open,
  onOpenChange,
  date,
  categoryId,
  athletePlayerId,
  sportType,
  staffMode = false,
  lockedTrainingType,
  session,
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEditing = Boolean(session);
  const isStaffMode = staffMode && !athletePlayerId;

  const trainingTypes = useMemo(() => {
    const all = getTrainingTypesForSport(sportType);
    return all.filter((type) => !type.value.startsWith("bowling_"));
  }, [sportType]);

  const [trainingType, setTrainingType] = useState<string>(
    lockedTrainingType || trainingTypes[0]?.value || "musculation",
  );
  const [notes, setNotes] = useState("");
  const [durationMin, setDurationMin] = useState<number>(60);
  const [rpe, setRpe] = useState<number>(6);
  const [partnerIds, setPartnerIds] = useState<string[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [sessionDate, setSessionDate] = useState(format(date, "yyyy-MM-dd"));
  const [sessionStartTime, setSessionStartTime] = useState("09:00");

  const { data: players } = useQuery({
    queryKey: ["simplified-session-players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open && isStaffMode,
  });

  useEffect(() => {
    if (session) {
      setSessionDate(session.session_date);
      setTrainingType(session.training_type);
      const cleanNotes = (session.notes || "")
        .replace(/^\[Séance athlète\]\s*/, "")
        .replace(/^<!--SIMPLIFIED_SESSION-->\n?/, "");
      setNotes(cleanNotes.split("\n").slice(0, -1).join("\n"));
      const start = session.session_start_time?.slice(0, 5) || "09:00";
      setSessionStartTime(start);
      const end = session.session_end_time;
      if (end) {
        const [sh, sm] = start.split(":").map(Number);
        const [eh, em] = end.split(":").map(Number);
        setDurationMin(Math.max(1, eh * 60 + em - (sh * 60 + sm)));
      } else setDurationMin(60);
      setRpe(Math.min(10, Math.max(1, Number(session.intensity) || 6)));
      const participantIds = (session.event_participants || []).map((participant) => participant.player_id);
      if (athletePlayerId) {
        setPartnerIds(participantIds.filter((id) => id !== athletePlayerId));
      } else {
        setSelectedPlayers(participantIds);
      }
    } else if (!open) {
      setSessionDate(format(date, "yyyy-MM-dd"));
      setSessionStartTime("09:00");
      setNotes("");
      setDurationMin(60);
      setRpe(6);
      setPartnerIds([]);
      setSelectedPlayers([]);
      setTrainingType(lockedTrainingType || trainingTypes[0]?.value || "musculation");
    }
  }, [open, lockedTrainingType, trainingTypes, session, athletePlayerId, date]);

  const computeEndTime = (start: string, mins: number) => {
    const [h, m] = start.split(":").map(Number);
    const total = h * 60 + m + Math.max(0, mins || 0);
    return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };

  const currentTypeLabel = trainingTypes.find((type) => type.value === trainingType)?.label || trainingType;

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!trainingType) throw new Error(t("athleteSpace.components.simplifiedSessionDialog.chooseSessionType"));
      if (!durationMin || durationMin <= 0) throw new Error(t("athleteSpace.components.simplifiedSessionDialog.durationRequired"));
      if (!rpe || rpe < 1 || rpe > 10) throw new Error(t("athleteSpace.components.simplifiedSessionDialog.rpeRequired"));

      const start = sessionStartTime || "09:00";
      const end = computeEndTime(start, durationMin);
      const notesPayload = [
        "<!--SIMPLIFIED_SESSION-->",
        notes.trim() || t("athleteSpace.components.simplifiedSessionDialog.defaultDescription", { type: currentTypeLabel }),
        t("athleteSpace.components.simplifiedSessionDialog.durationRpe", { duration: durationMin, rpe }),
      ].join("\n");

      if (isStaffMode) {
        const { data: created, error } = await supabase
          .from("training_sessions")
          .insert({
            category_id: categoryId,
            session_date: sessionDate,
            session_start_time: start,
            session_end_time: end,
            training_type: trainingType,
            intensity: rpe,
            notes: notesPayload,
          })
          .select("id")
          .single();
        if (error) throw error;

        if (selectedPlayers.length > 0) {
          const { error: participantsError } = await supabase
            .from("event_participants")
            .insert(selectedPlayers.map((playerId) => ({ training_session_id: created.id, player_id: playerId })));
          if (participantsError) throw participantsError;
        }
        return created.id as string;
      }

      if (!athletePlayerId) throw new Error(t("athleteSpace.components.simplifiedSessionDialog.sessionExpired"));
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error(t("athleteSpace.components.simplifiedSessionDialog.sessionExpired"));

      const functionName = isEditing ? "athlete-update-session" : "athlete-create-session";
      const { data, error } = await supabase.functions.invoke(functionName, {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          category_id: categoryId,
          player_id: athletePlayerId,
          session_id: session?.id,
          session_date: sessionDate,
          session_start_time: start,
          session_end_time: end,
          training_type: trainingType,
          intensity: rpe,
          notes: isEditing ? `[Séance athlète] ${notesPayload}` : notesPayload,
          partner_player_ids: partnerIds,
        },
      });
      if (error) throw error;
      if (!data?.success || !data?.session_id) {
        throw new Error(data?.error || t("athleteSpace.components.simplifiedSessionDialog.createError"));
      }
      return data.session_id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["today_sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["training-stats"] });
      qc.invalidateQueries({ queryKey: ["athlete-calendar-sessions", categoryId] });
      if (athletePlayerId) qc.invalidateQueries({ queryKey: ["athlete-calendar-sessions", categoryId, athletePlayerId] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(isEditing ? "Séance modifiée" : t("athleteSpace.components.simplifiedSessionDialog.added"));
      onOpenChange(false);
    },
    onError: (error: any) => toast.error(error?.message || t("athleteSpace.components.simplifiedSessionDialog.saveError")),
  });

  const rpeColors = [
    "bg-emerald-500", "bg-emerald-500", "bg-emerald-500", "bg-lime-500", "bg-lime-500",
    "bg-amber-500", "bg-amber-500", "bg-orange-500", "bg-orange-500", "bg-rose-500",
  ];

  const togglePlayer = (playerId: string) => {
    setSelectedPlayers((current) => current.includes(playerId)
      ? current.filter((id) => id !== playerId)
      : [...current, playerId]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            {isStaffMode ? "Séance musculation simplifiée" : isEditing ? "Modifier ma séance" : t("athleteSpace.components.simplifiedSessionDialog.title")}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {format(date, "EEEE d MMMM yyyy", { locale: getDateLocale() })}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {!lockedTrainingType && trainingTypes.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t("athleteSpace.components.simplifiedSessionDialog.sessionType")}</Label>
              <Select value={trainingType} onValueChange={setTrainingType}>
                <SelectTrigger><SelectValue placeholder={t("athleteSpace.components.simplifiedSessionDialog.chooseType")} /></SelectTrigger>
                <SelectContent>
                  {trainingTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="simpl-start-time">Heure de début</Label>
              <Input id="simpl-start-time" type="time" value={sessionStartTime} onChange={(event) => setSessionStartTime(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="simpl-duration">{t("athleteSpace.components.simplifiedSessionDialog.duration")}</Label>
              <Input id="simpl-duration" type="number" min={1} max={600} value={durationMin} onChange={(event) => setDurationMin(Number(event.target.value) || 0)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="simpl-notes">{t("athleteSpace.components.simplifiedSessionDialog.description")}</Label>
            <Textarea id="simpl-notes" placeholder={t("athleteSpace.components.simplifiedSessionDialog.descriptionPlaceholder")} value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="simpl-rpe">{t("athleteSpace.components.simplifiedSessionDialog.rpe")}</Label>
            <Input id="simpl-rpe" type="number" min={1} max={10} value={rpe} onChange={(event) => setRpe(Math.min(10, Math.max(1, Number(event.target.value) || 0)))} />
          </div>

          <div className="flex items-center gap-1">
            {Array.from({ length: 10 }).map((_, index) => {
              const value = index + 1;
              return <button key={value} type="button" onClick={() => setRpe(value)} className={cn("h-8 flex-1 rounded-md text-xs font-semibold text-white transition-opacity", rpeColors[index], value <= rpe ? "opacity-100" : "opacity-25")} aria-label={`RPE ${value}`}>{value}</button>;
            })}
          </div>

          {isStaffMode ? (
            <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs"><Users className="h-3.5 w-3.5" />Participants</Label>
                <span className="text-[11px] text-muted-foreground">{selectedPlayers.length === 0 ? "Toute la catégorie" : `${selectedPlayers.length} sélectionné${selectedPlayers.length > 1 ? "s" : ""}`}</span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {(players || []).map((player) => (
                  <label key={player.id} className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs hover:bg-accent/50">
                    <Checkbox checked={selectedPlayers.includes(player.id)} onCheckedChange={() => togglePlayer(player.id)} />
                    <span className="truncate">{player.first_name ? `${player.first_name} ${player.name}` : player.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">Si aucun athlète n'est sélectionné, la séance est créée pour toute la catégorie.</p>
            </div>
          ) : athletePlayerId ? (
            <AthletePartnersSelector categoryId={categoryId} selfPlayerId={athletePlayerId} value={partnerIds} onChange={setPartnerIds} />
          ) : null}

          {!isStaffMode && <p className="text-xs text-muted-foreground">{t("athleteSpace.components.simplifiedSessionDialog.loadInfo")}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("athleteSpace.components.simplifiedSessionDialog.cancel")}</Button>
          <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
            {submitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isStaffMode ? "Créer la séance" : isEditing ? "Enregistrer les modifications" : t("athleteSpace.components.simplifiedSessionDialog.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
