import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Check, X, HelpCircle, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export type ParticipantWithAttendance = {
  player_id: string;
  attendance_status?: "present" | "absent" | "no_response" | null;
  absence_comment?: string | null;
  responded_at?: string | null;
  players?: {
    id?: string;
    name?: string | null;
    first_name?: string | null;
    avatar_url?: string | null;
  } | null;
};

interface Props {
  participants: ParticipantWithAttendance[];
  title?: string;
  emptyLabel?: string;
}

function getStatus(p: ParticipantWithAttendance): "present" | "absent" | "no_response" {
  return (p.attendance_status as any) || "no_response";
}

export function ParticipantsAttendanceList({
  participants,
  title = "Participants",
  emptyLabel = "Aucun athlète attribué à cette séance.",
}: Props) {
  const counts = participants.reduce(
    (acc, p) => {
      const s = getStatus(p);
      acc[s] += 1;
      return acc;
    },
    { present: 0, absent: 0, no_response: 0 },
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="text-sm font-semibold">
          {title} ({participants.length})
        </h4>
        {participants.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 h-5 px-1.5 text-[10px] gap-1">
              <Check className="h-3 w-3" />
              {counts.present} présent{counts.present > 1 ? "s" : ""}
            </Badge>
            <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/40 h-5 px-1.5 text-[10px] gap-1">
              <X className="h-3 w-3" />
              {counts.absent} absent{counts.absent > 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-1">
              <HelpCircle className="h-3 w-3" />
              {counts.no_response} sans réponse
            </Badge>
          </div>
        )}
      </div>

      {participants.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {participants.map((p) => {
            const name = p.players?.first_name
              ? `${p.players.first_name} ${p.players.name ?? ""}`.trim()
              : p.players?.name || "Athlète";
            const initials = (p.players?.first_name || p.players?.name || "A")
              .slice(0, 2)
              .toUpperCase();
            const status = getStatus(p);
            return (
              <div
                key={p.player_id}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border bg-background p-2 text-sm",
                  status === "present" && "border-emerald-500/40",
                  status === "absent" && "border-rose-500/40",
                )}
              >
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={p.players?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="truncate flex-1">{name}</span>
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
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                      Sans réponse
                    </Badge>
                  )}
                </div>
                {status === "absent" && p.absence_comment && (
                  <p className="flex items-start gap-1 text-[11px] text-muted-foreground pl-9">
                    <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span className="italic">{p.absence_comment}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
