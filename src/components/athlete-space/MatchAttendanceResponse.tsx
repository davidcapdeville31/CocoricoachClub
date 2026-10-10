import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, X, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface Props {
  matchId: string;
  playerId: string;
  matchDate: string; // yyyy-MM-dd
  matchTime: string | null; // HH:mm(:ss)
}

type Status = "present" | "absent" | "no_response";

export function MatchAttendanceResponse({ matchId, playerId, matchDate, matchTime }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");

  const { data: participant, isLoading, isError, refetch } = useQuery({
    queryKey: ["mp-attendance", matchId, playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_participants")
        .select("id, attendance_status, absence_comment, responded_at")
        .eq("match_id", matchId)
        .eq("player_id", playerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (participant?.absence_comment) setComment(participant.absence_comment);
    if (participant?.attendance_status === "absent") setShowComment(true);
  }, [participant?.absence_comment, participant?.attendance_status]);

  if (isLoading) return <p role="status" className="text-xs text-muted-foreground min-h-11 flex items-center">Chargement de la présence…</p>;
  if (isError) return <div role="alert" className="text-xs text-destructive"><span>Présence indisponible. </span><Button variant="outline" size="sm" onClick={() => refetch()}>Réessayer</Button></div>;
  // Athlete is not convoked to this competition → no attendance block
  if (!participant) return null;

  const status: Status = (participant.attendance_status as Status) || "no_response";

  // Athletes can answer present/absent at any time, including after the
  // competition (a posteriori), so late responses are always possible.
  const respond = async (nextStatus: "present" | "absent", nextComment?: string) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("match_participants")
        .update({
          attendance_status: nextStatus,
          absence_comment: nextStatus === "absent" ? (nextComment ?? comment) || null : null,
        })
        .eq("id", participant.id);
      if (error) throw error;
      toast.success(nextStatus === "present" ? t("athleteSpace.calendar.attendance.presentConfirmed") : t("athleteSpace.calendar.attendance.absentRecorded"));
      qc.invalidateQueries({ queryKey: ["mp-attendance", matchId, playerId] });
      qc.invalidateQueries({ queryKey: ["athlete-calendar-upcoming-attendance", playerId] });
    } catch (e: any) {
      toast.error(e?.message || t("athleteSpace.calendar.attendance.saveError"));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="athlete-attendance" aria-busy={saving}>
      <div className="athlete-attendance-toolbar">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Trophy className="h-3.5 w-3.5" />
          <span className="sr-only">{t("athleteSpace.calendar.attendance.yourAttendance")}</span>
          {status === "present" && (
            <Badge variant="outline" className="text-xs px-1.5 text-foreground">
              {t("athleteSpace.calendar.attendance.present")}
            </Badge>
          )}
          {status === "absent" && (
            <Badge variant="outline" className="text-xs px-1.5 text-foreground">
              {t("athleteSpace.calendar.attendance.absent")}
            </Badge>
          )}
          {status === "no_response" && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{t("athleteSpace.calendar.attendance.noResponse")}</Badge>
          )}
        </div>
        <div className="athlete-attendance-controls">
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-attendance="present"
            aria-pressed={status === "present"}
            className="min-h-11 px-3 gap-1"
            aria-disabled={saving}
            onClick={(e) => {
              e.stopPropagation();
              if (savingRef.current) return;
              setShowComment(false);
              respond("present");
            }}
          >
            <Check className="h-3.5 w-3.5" /> {t("athleteSpace.calendar.attendance.present")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-attendance="absent"
            aria-pressed={status === "absent"}
            className="min-h-11 px-3 gap-1"
            aria-disabled={saving}
            onClick={(e) => {
              e.stopPropagation();
              if (savingRef.current) return;
              setShowComment(true);
              if (status !== "absent") respond("absent");
            }}
          >
            <X className="h-3.5 w-3.5" /> {t("athleteSpace.calendar.attendance.absent")}
          </Button>
        </div>
      </div>

      {status === "absent" && showComment && (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <label htmlFor={"absence-mp-" + matchId} className="block text-xs font-medium mb-1">Motif de l’absence (facultatif)</label>
          <Textarea
            id={"absence-mp-" + matchId}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("athleteSpace.calendar.attendance.absenceReasonPlaceholder")}
            className="min-h-[60px] text-xs"
          />
          <div className="flex justify-end mt-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11 px-3"
              aria-disabled={saving}
              onClick={() => respond("absent", comment)}
            >
              {t("athleteSpace.calendar.attendance.saveComment")}
            </Button>
          </div>
        </div>
      )}
      <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{saving ? "Enregistrement…" : ""}</p>
    </div>
  );
}
