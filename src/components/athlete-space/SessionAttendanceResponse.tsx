import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, startOfDay } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, X, Lock, Clock } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface Props {
  sessionId: string;
  playerId: string;
  categoryId: string;
  sessionDate: string; // yyyy-MM-dd
  sessionStartTime: string | null; // HH:mm(:ss)
  /** Date de création de la séance : si elle est postérieure au début de la séance
   *  (séance ajoutée a posteriori par le staff), la réponse reste ouverte. */
  sessionCreatedAt?: string | null;
}

type Status = "present" | "absent" | "no_response";

const LOCK_MINUTES = 30;

export function SessionAttendanceResponse({
  sessionId,
  playerId,
  categoryId,
  sessionDate,
  sessionStartTime,
  sessionCreatedAt,
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");

  const { data: participant, isLoading, isError, refetch } = useQuery({
    queryKey: ["ep-attendance", sessionId, playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_participants")
        .select("id, attendance_status, absence_comment, responded_at")
        .eq("training_session_id", sessionId)
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

  const { locked, sessionStart } = useMemo(() => {
    const time = (sessionStartTime || "00:00").slice(0, 5);
    const start = new Date(`${sessionDate}T${time}:00`);
    const lockAt = new Date(start.getTime() - LOCK_MINUTES * 60_000);
    // Séance créée a posteriori (après son propre début) : la réponse reste ouverte
    const createdAt = sessionCreatedAt ? new Date(sessionCreatedAt) : null;
    const createdAfterStart = !!createdAt && createdAt.getTime() > lockAt.getTime();
    const catchupEndsAt = addDays(startOfDay(start), 15);
    const isPastButStillOpen = new Date() < catchupEndsAt;
    return {
      locked: !createdAfterStart && new Date() >= lockAt && !isPastButStillOpen,
      sessionStart: start,
    };
  }, [sessionDate, sessionStartTime, sessionCreatedAt]);

  if (isLoading) return <p role="status" className="text-xs text-muted-foreground min-h-11 flex items-center">Chargement de la présence…</p>;
  if (isError) return <div role="alert" className="text-xs text-destructive"><span>Présence indisponible. </span><Button variant="outline" size="sm" onClick={() => refetch()}>Réessayer</Button></div>;

  const status: Status = (participant?.attendance_status as Status) || "no_response";

  const respond = async (nextStatus: "present" | "absent", nextComment?: string) => {
    if (locked) {
      toast.error(t("athleteSpace.calendar.attendance.lockedSession"));
      return;
    }
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (participant) {
        const { error } = await supabase
          .from("event_participants")
          .update({
            attendance_status: nextStatus,
            absence_comment: nextStatus === "absent" ? (nextComment ?? comment) || null : null,
          })
          .eq("id", participant.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("event_participants")
          .insert({
            training_session_id: sessionId,
            player_id: playerId,
            attendance_status: nextStatus,
            absence_comment: nextStatus === "absent" ? (nextComment ?? comment) || null : null,
          });
        if (error) throw error;
      }

      const { error: attendanceError } = await supabase
        .from("training_attendance")
        .upsert(
          {
            training_session_id: sessionId,
            player_id: playerId,
            category_id: categoryId,
            attendance_date: sessionDate,
            status: nextStatus,
          },
          { onConflict: "training_session_id,player_id" },
        );
      if (attendanceError) throw attendanceError;

      toast.success(nextStatus === "present" ? t("athleteSpace.calendar.attendance.presentConfirmed") : t("athleteSpace.calendar.attendance.absentRecorded"));
      qc.invalidateQueries({ queryKey: ["ep-attendance", sessionId, playerId] });
      qc.invalidateQueries({ queryKey: ["athlete-calendar-upcoming-attendance", playerId] });
      qc.invalidateQueries({ queryKey: ["athlete-attendance-lock"] });
      qc.invalidateQueries({ queryKey: ["athlete-space-attendance-status"] });
      qc.invalidateQueries({ queryKey: ["athlete-space-sessions"] });
      qc.invalidateQueries({ queryKey: ["athlete-calendar-sessions"] });

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
          <Clock className="h-3.5 w-3.5" />
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
            aria-disabled={saving || locked}
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
            aria-disabled={saving || locked}
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

      {status === "absent" && showComment && !locked && (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <label htmlFor={"absence-ep-" + sessionId} className="block text-xs font-medium mb-1">Motif de l’absence (facultatif)</label>
          <Textarea
            id={"absence-ep-" + sessionId}
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
      {locked && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" />
          {t("athleteSpace.calendar.attendance.lockedSession")}
        </p>
      )}
    </div>
  );
}
