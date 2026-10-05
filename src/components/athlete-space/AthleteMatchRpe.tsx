import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAthleteCompetitionEntry } from "@/hooks/useAthleteCompetitionEntry";

interface Props {
  matchId: string;
  playerId: string;
  categoryId: string;
  matchDate: string; // yyyy-MM-dd
}

/**
 * Lets the athlete enter her RPE + minutes for a competition, including
 * a posteriori (after the match). Stored in awcr_tracking with
 * training_session_id = null, like the staff MatchRpeDialog entry.
 * Only shown to convoked athletes once the match day is reached.
 */
export function AthleteMatchRpe({ matchId, playerId, categoryId, matchDate }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const entryEnabled = useAthleteCompetitionEntry(categoryId);
  const [saving, setSaving] = useState(false);
  const [rpe, setRpe] = useState("");
  const [duration, setDuration] = useState("");

  const todayStr = new Date().toISOString().slice(0, 10);
  const isMatchDayReached = matchDate <= todayStr;

  const { data: participant, isLoading: loadingParticipant } = useQuery({
    queryKey: ["mp-attendance", matchId, playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_participants")
        .select("id, attendance_status")
        .eq("match_id", matchId)
        .eq("player_id", playerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: existing, isLoading: loadingRpe } = useQuery({
    queryKey: ["athlete-match-rpe", matchId, playerId, matchDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("awcr_tracking")
        .select("id, rpe, duration_minutes")
        .eq("player_id", playerId)
        .eq("session_date", matchDate)
        .is("training_session_id", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: isMatchDayReached && !!participant,
  });

  useEffect(() => {
    if (existing) {
      setRpe(existing.rpe?.toString() ?? "");
      setDuration(existing.duration_minutes?.toString() ?? "");
    }
  }, [existing?.id, existing?.rpe, existing?.duration_minutes]);

  if (loadingParticipant || loadingRpe) return null;
  if (!entryEnabled) return null;
  // Not convoked, match not played yet, or athlete declared absent → no RPE entry
  if (!participant || !isMatchDayReached) return null;
  if (participant.attendance_status === "absent") return null;

  const save = async () => {
    const rpeNum = parseInt(rpe, 10);
    const durationNum = parseInt(duration, 10);
    if (Number.isNaN(rpeNum) || rpeNum < 0 || rpeNum > 10 || Number.isNaN(durationNum) || durationNum <= 0) {
      toast.error(t("athleteSpace.calendar.matchRpe.invalid"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        player_id: playerId,
        category_id: categoryId,
        session_date: matchDate,
        training_session_id: null,
        rpe: rpeNum,
        duration_minutes: durationNum,
        auto_filled: false,
      };
      if (existing) {
        const { error } = await supabase.from("awcr_tracking").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("awcr_tracking").insert(payload);
        if (error) throw error;
      }
      toast.success(t("athleteSpace.calendar.matchRpe.saved"));
      qc.invalidateQueries({ queryKey: ["athlete-match-rpe", matchId, playerId, matchDate] });
      qc.invalidateQueries({ queryKey: ["athlete-calendar-rpes", playerId] });
    } catch (e: any) {
      toast.error(e?.message || t("athleteSpace.calendar.matchRpe.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="mt-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
        <Activity className="h-3.5 w-3.5" />
        {t("athleteSpace.calendar.matchRpe.title")}
        {existing && (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
            ✓ RPE {existing.rpe} · {existing.duration_minutes} min
          </span>
        )}
      </div>
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground">{t("athleteSpace.calendar.matchRpe.rpe")}</Label>
          <Input
            type="number"
            min="0"
            max="10"
            value={rpe}
            onChange={(e) => setRpe(e.target.value)}
            className="w-16 h-8"
            placeholder="0-10"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground">{t("athleteSpace.calendar.matchRpe.duration")}</Label>
          <Input
            type="number"
            min="0"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-20 h-8"
            placeholder="min"
          />
        </div>
        <Button type="button" size="sm" className="h-8" disabled={saving} onClick={save}>
          {existing ? t("athleteSpace.calendar.matchRpe.update") : t("athleteSpace.calendar.matchRpe.save")}
        </Button>
      </div>
    </div>
  );
}
