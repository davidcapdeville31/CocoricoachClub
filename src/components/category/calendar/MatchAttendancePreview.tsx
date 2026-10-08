import { useQuery } from "@tanstack/react-query";
import { Eye, Check, X, HelpCircle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function MatchAttendancePreviewButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  const label = t("planning.calendarViews.attendancePreview.open");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-foreground bg-background/90 hover:bg-accent" aria-label={label}
          onClick={(event) => { event.stopPropagation(); event.preventDefault(); onClick(); }}>
          <Eye className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="backdrop-blur-md">{label}</TooltipContent>
    </Tooltip>
  );
}

interface Props {
  match: { id: string; opponent: string; match_date: string; competition?: string | null };
  onOpenChange: (open: boolean) => void;
}

export function MatchAttendancePreview({ match, onOpenChange }: Props) {
  const { t } = useTranslation();
  const { data: participants = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["match-attendance-preview", match.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("match_participants")
        .select("player_id, attendance_status, absence_comment, players:player_id(name, first_name)")
        .eq("match_id", match.id);
      if (error) throw error;
      return (data || []).map((p) => ({
        ...p,
        name: [p.players?.first_name, p.players?.name].filter(Boolean).join(" ") || t("adminAttendance.participants.defaultAthlete"),
        status: p.attendance_status === "present" || p.attendance_status === "absent" ? p.attendance_status : "no_response",
      })).sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 0,
    refetchInterval: 15000,
  });
  const groups = [
    { status: "present", label: t("athleteSpace.calendar.attendance.present"), icon: Check, color: "text-success" },
    { status: "absent", label: t("athleteSpace.calendar.attendance.absent"), icon: X, color: "text-destructive" },
    { status: "no_response", label: t("athleteSpace.calendar.attendance.noResponse"), icon: HelpCircle, color: "text-muted-foreground" },
  ];
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("planning.calendarViews.attendancePreview.title")}</DialogTitle>
          <DialogDescription className="break-words">
            {[match.competition, match.opponent, format(parseISO(match.match_date), "dd/MM/yyyy")].filter(Boolean).join(" · ")}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" aria-label={t("common.loading")} /> : isError ? (
          <div className="space-y-2 text-sm text-destructive" role="alert">
            <p>{t("planning.calendarViews.attendancePreview.error")}</p>
            <Button variant="outline" onClick={() => refetch()}>{t("common.retry")}</Button>
          </div>
        ) : participants.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("planning.calendarViews.attendancePreview.empty")}</p>
        ) : (
          <div className="space-y-5">
            <p className="text-sm font-medium">{t("planning.calendarViews.attendancePreview.total", { count: participants.length })}</p>
            {groups.map(({ status, label, icon: Icon, color }) => {
              const members = participants.filter((p) => p.status === status);
              return (
                <section key={status} aria-label={label}>
                  <h3 className={cn("flex items-center gap-2 text-sm font-semibold mb-2", color)}><Icon className="h-4 w-4" />{label} · {members.length}</h3>
                  {members.length === 0 ? <p className="text-xs text-muted-foreground">—</p> : (
                    <ul className="divide-y divide-border">
                      {members.map((p) => <li key={p.player_id} className="py-2 text-sm break-words">
                        <span className="font-medium">{p.name}</span>
                        {status === "absent" && p.absence_comment && <p className="mt-1 text-xs text-muted-foreground">{p.absence_comment}</p>}
                      </li>)}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}