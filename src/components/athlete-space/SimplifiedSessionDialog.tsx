import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Loader2, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getTrainingTypesForSport } from "@/lib/constants/trainingTypes";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  categoryId: string;
  athletePlayerId: string;
  sportType?: string;
  /** Optionnel — verrouille le type de séance (ex: musculation). */
  lockedTrainingType?: string;
}

/**
 * Mode simplifié générique de création de séance côté athlète.
 * Saisie rapide : type de séance (filtré par sport), description libre,
 * durée (min), RPE (1-10). À la validation, crée la séance via
 * l'edge function `athlete-create-session` — la séance apparaît dans le
 * calendrier (athlète + staff) ET alimente automatiquement les stats de
 * charge d'entraînement (workload) grâce à `intensity = RPE` et aux
 * heures de début/fin calculées depuis la durée.
 */
export function SimplifiedSessionDialog({
  open,
  onOpenChange,
  date,
  categoryId,
  athletePlayerId,
  sportType,
  lockedTrainingType,
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  // Types de séance disponibles pour ce sport, hors bowling (flow dédié).
  const trainingTypes = useMemo(() => {
    const all = getTrainingTypesForSport(sportType);
    return all.filter((t) => !t.value.startsWith("bowling_"));
  }, [sportType]);

  const [trainingType, setTrainingType] = useState<string>(
    lockedTrainingType || trainingTypes[0]?.value || "musculation",
  );
  const [notes, setNotes] = useState("");
  const [durationMin, setDurationMin] = useState<number>(60);
  const [rpe, setRpe] = useState<number>(6);

  useEffect(() => {
    if (!open) {
      setNotes("");
      setDurationMin(60);
      setRpe(6);
      setTrainingType(lockedTrainingType || trainingTypes[0]?.value || "musculation");
    }
  }, [open, lockedTrainingType, trainingTypes]);

  const computeEndTime = (start: string, mins: number) => {
    const [h, m] = start.split(":").map(Number);
    const total = h * 60 + m + Math.max(0, mins || 0);
    const eh = String(Math.floor(total / 60) % 24).padStart(2, "0");
    const em = String(total % 60).padStart(2, "0");
    return `${eh}:${em}`;
  };

  const currentTypeLabel =
    trainingTypes.find((t) => t.value === trainingType)?.label || trainingType;

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!trainingType) throw new Error(t('athleteSpace.components.simplifiedSessionDialog.chooseSessionType'));
      if (!durationMin || durationMin <= 0) {
        throw new Error(t('athleteSpace.components.simplifiedSessionDialog.durationRequired'));
      }
      if (!rpe || rpe < 1 || rpe > 10) {
        throw new Error(t('athleteSpace.components.simplifiedSessionDialog.rpeRequired'));
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error(t('athleteSpace.components.simplifiedSessionDialog.sessionExpired'));
      }
      const start = "09:00";
      const end = computeEndTime(start, durationMin);
      const notesPayload = [
        "<!--SIMPLIFIED_SESSION-->",
        notes.trim() || t('athleteSpace.components.simplifiedSessionDialog.defaultDescription', { type: currentTypeLabel }),
        t('athleteSpace.components.simplifiedSessionDialog.durationRpe', { duration: durationMin, rpe }),
      ].join("\n");

      const { data, error } = await supabase.functions.invoke(
        "athlete-create-session",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          body: {
            category_id: categoryId,
            player_id: athletePlayerId,
            session_date: format(date, "yyyy-MM-dd"),
            session_start_time: start,
            session_end_time: end,
            training_type: trainingType,
            intensity: rpe,
            notes: notesPayload,
          },
        },
      );
      if (error) throw error;
      if (!data?.success || !data?.session_id) {
        throw new Error(data?.error || t('athleteSpace.components.simplifiedSessionDialog.createError'));
      }
      return data.session_id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["today_sessions", categoryId] });
      qc.invalidateQueries({ queryKey: ["training-stats"] });
      qc.invalidateQueries({ queryKey: ["athlete-calendar-sessions", categoryId] });
      toast.success(t('athleteSpace.components.simplifiedSessionDialog.added'));
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || t('athleteSpace.components.simplifiedSessionDialog.saveError')),
  });

  const rpeColors = [
    "bg-emerald-500",
    "bg-emerald-500",
    "bg-emerald-500",
    "bg-lime-500",
    "bg-lime-500",
    "bg-amber-500",
    "bg-amber-500",
    "bg-orange-500",
    "bg-orange-500",
    "bg-rose-500",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            {t('athleteSpace.components.simplifiedSessionDialog.title')}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {format(date, "EEEE d MMMM yyyy", { locale: fr })}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {!lockedTrainingType && trainingTypes.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t('athleteSpace.components.simplifiedSessionDialog.sessionType')}</Label>
              <Select value={trainingType} onValueChange={setTrainingType}>
                <SelectTrigger>
                  <SelectValue placeholder={t('athleteSpace.components.simplifiedSessionDialog.chooseType')} />
                </SelectTrigger>
                <SelectContent>
                  {trainingTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="simpl-notes">{t('athleteSpace.components.simplifiedSessionDialog.description')}</Label>
            <Textarea
              id="simpl-notes"
              placeholder={t('athleteSpace.components.simplifiedSessionDialog.descriptionPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="simpl-duration">{t('athleteSpace.components.simplifiedSessionDialog.duration')}</Label>
              <Input
                id="simpl-duration"
                type="number"
                min={1}
                max={600}
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="simpl-rpe">{t('athleteSpace.components.simplifiedSessionDialog.rpe')}</Label>
              <Input
                id="simpl-rpe"
                type="number"
                min={1}
                max={10}
                value={rpe}
                onChange={(e) =>
                  setRpe(Math.min(10, Math.max(1, Number(e.target.value) || 0)))
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-1">
            {Array.from({ length: 10 }).map((_, i) => {
              const value = i + 1;
              const active = value <= rpe;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRpe(value)}
                  className={cn(
                    "h-8 flex-1 rounded-md text-xs font-semibold text-white transition-opacity",
                    rpeColors[i],
                    active ? "opacity-100" : "opacity-25",
                  )}
                  aria-label={`RPE ${value}`}
                >
                  {value}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('athleteSpace.components.simplifiedSessionDialog.loadInfo')}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('athleteSpace.components.simplifiedSessionDialog.cancel')}
          </Button>
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {submitMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t('athleteSpace.components.simplifiedSessionDialog.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
