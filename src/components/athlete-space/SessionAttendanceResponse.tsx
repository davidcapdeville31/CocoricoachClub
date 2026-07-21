import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, X, Lock, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  sessionId: string;
  playerId: string;
  sessionDate: string; // yyyy-MM-dd
  sessionStartTime: string | null; // HH:mm(:ss)
}

type Status = "present" | "absent" | "no_response";

const LOCK_MINUTES = 30;

export function SessionAttendanceResponse({
  sessionId,
  playerId,
  sessionDate,
  sessionStartTime,
}: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");

  const { data: participant, isLoading } = useQuery({
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
    return { locked: new Date() >= lockAt, sessionStart: start };
  }, [sessionDate, sessionStartTime]);

  if (isLoading) return null;

  const status: Status = (participant?.attendance_status as Status) || "no_response";

  const respond = async (nextStatus: "present" | "absent", nextComment?: string) => {
    if (locked) {
      toast.error("La réponse ne peut plus être modifiée moins de 30 minutes avant la séance.");
      return;
    }
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
      toast.success(nextStatus === "present" ? "Présence confirmée" : "Absence enregistrée");
      qc.invalidateQueries({ queryKey: ["ep-attendance", sessionId, playerId] });
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Ta présence
          {status === "present" && (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 h-5 px-1.5 text-[10px]">
              Présent
            </Badge>
          )}
          {status === "absent" && (
            <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/40 h-5 px-1.5 text-[10px]">
              Absent
            </Badge>
          )}
          {status === "no_response" && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Sans réponse</Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={status === "present" ? "default" : "outline"}
            className={cn(
              "h-7 px-2 gap-1",
              status === "present" && "bg-emerald-600 hover:bg-emerald-700 text-white",
            )}
            disabled={saving || locked}
            onClick={(e) => {
              e.stopPropagation();
              setShowComment(false);
              respond("present");
            }}
          >
            <Check className="h-3.5 w-3.5" /> Présent
          </Button>
          <Button
            type="button"
            size="sm"
            variant={status === "absent" ? "default" : "outline"}
            className={cn(
              "h-7 px-2 gap-1",
              status === "absent" && "bg-rose-600 hover:bg-rose-700 text-white",
            )}
            disabled={saving || locked}
            onClick={(e) => {
              e.stopPropagation();
              setShowComment(true);
              if (status !== "absent") respond("absent");
            }}
          >
            <X className="h-3.5 w-3.5" /> Absent
          </Button>
        </div>
      </div>

      {status === "absent" && showComment && !locked && (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Raison de l'absence (facultatif)"
            className="min-h-[60px] text-xs"
          />
          <div className="flex justify-end mt-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2"
              disabled={saving}
              onClick={() => respond("absent", comment)}
            >
              Enregistrer le commentaire
            </Button>
          </div>
        </div>
      )}

      {locked && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" />
          La réponse ne peut plus être modifiée moins de 30 minutes avant la séance.
        </p>
      )}
    </div>
  );
}
