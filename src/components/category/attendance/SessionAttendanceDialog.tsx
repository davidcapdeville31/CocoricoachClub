import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { 
  Users, Check, X, Clock, AlertCircle, CheckCircle2
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSeasonGuard } from "@/hooks/use-season-guard";
import { useTranslation } from "react-i18next";

interface SessionAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: {
    id: string;
    session_date: string;
    training_type: string;
    session_start_time?: string;
    session_end_time?: string;
    intensity?: number;
    notes?: string;
  } | null;
  categoryId: string;
  onAttendanceSaved?: (presentPlayerIds: string[]) => void;
}

import i18n from "@/i18n";

const ATTENDANCE_STATUS = [
  { value: "present", label: () => i18n.t("adminAttendance.dialog.present"), icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-100" },
  { value: "absent", label: () => i18n.t("adminAttendance.dialog.absent"), icon: X, color: "text-red-600", bgColor: "bg-red-100" },
  { value: "excused", label: () => i18n.t("adminAttendance.dialog.excused"), icon: AlertCircle, color: "text-amber-600", bgColor: "bg-amber-100" },
  { value: "late", label: () => i18n.t("adminAttendance.dialog.late"), icon: Clock, color: "text-orange-600", bgColor: "bg-orange-100" },
];

interface PlayerAttendanceData {
  status: string;
  reason: string;
  lateMinutes: number;
  lateJustified: boolean;
}

export function SessionAttendanceDialog({ 
  open, 
  onOpenChange, 
  session, 
  categoryId,
  onAttendanceSaved 
}: SessionAttendanceDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const guard = useSeasonGuard(categoryId);
  const [attendance, setAttendance] = useState<Record<string, PlayerAttendanceData>>({});

  // Fetch all players for the category
  const { data: allPlayers } = useQuery({
    queryKey: ["players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name, position, avatar_url")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing attendance for this session
  const { data: existingAttendance } = useQuery({
    queryKey: ["session-attendance", session?.id, session?.session_date],
    queryFn: async () => {
      if (!session) return [];
      const { data, error } = await supabase
        .from("training_attendance")
        .select("*")
        .eq("category_id", categoryId)
        .eq("attendance_date", session.session_date)
        .eq("training_session_id", session.id);
      if (error) throw error;
      return data;
    },
    enabled: !!session,
  });

  // Filter players: only show those assigned to this session
  // If attendance records exist, show only those players
  // If no records exist, show all players (session for everyone)
  const players = (() => {
    if (!allPlayers) return [];
    if (existingAttendance && existingAttendance.length > 0) {
      const assignedIds = new Set(existingAttendance.map(a => a.player_id));
      return allPlayers.filter(p => assignedIds.has(p.id));
    }
    return allPlayers;
  })();

  // Initialize attendance state
  useEffect(() => {
    if (players && session) {
      const initial: Record<string, PlayerAttendanceData> = {};
      players.forEach((p) => {
        const existingAtt = existingAttendance?.find((a) => a.player_id === p.id);
        
        initial[p.id] = {
          status: existingAtt?.status || "present",
          reason: existingAtt?.absence_reason || existingAtt?.late_reason || "",
          lateMinutes: existingAtt?.late_minutes || 0,
          lateJustified: existingAtt?.late_justified || false,
        };
      });
      setAttendance(initial);
    }
  }, [players, session, existingAttendance]);

  const saveAttendance = useMutation({
    mutationFn: async () => {
      if (!session) return;
      if (!guard.assertDate(session.session_date)) throw new Error("guard:date");
      const playerIds = Object.keys(attendance);
      if (playerIds.length > 0 && !guard.assertPlayers(playerIds)) throw new Error("guard:players");

      // Delete existing attendance for this session
      await supabase
        .from("training_attendance")
        .delete()
        .eq("category_id", categoryId)
        .eq("attendance_date", session.session_date)
        .eq("training_session_id", session.id);

      // Insert new attendance
      const attendanceEntries = Object.entries(attendance).map(([playerId, data]) => ({
        player_id: playerId,
        category_id: categoryId,
        attendance_date: session.session_date,
        training_session_id: session.id,
        status: data.status,
        absence_reason: data.status !== "present" && data.status !== "late" ? data.reason : null,
        late_minutes: data.status === "late" ? data.lateMinutes : null,
        late_justified: data.status === "late" ? data.lateJustified : null,
        late_reason: data.status === "late" ? data.reason : null,
      }));

      const { error: attError } = await supabase.from("training_attendance").insert(attendanceEntries);
      if (attError) throw attError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_attendance"] });
      queryClient.invalidateQueries({ queryKey: ["session-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["training_attendance_stats"] });
      
      const counts = getStatusCounts();
      const parts: string[] = [];
      if (counts.present > 0) parts.push(counts.present > 1 ? t("adminAttendance.dialog.presentCountPlural", { count: counts.present }) : t("adminAttendance.dialog.presentCount", { count: counts.present }));
      if (counts.late > 0) parts.push(counts.late > 1 ? t("adminAttendance.dialog.lateCountPlural", { count: counts.late }) : t("adminAttendance.dialog.lateCount", { count: counts.late }));
      if (counts.absent > 0) parts.push(counts.absent > 1 ? t("adminAttendance.dialog.absentCountPlural", { count: counts.absent }) : t("adminAttendance.dialog.absentCount", { count: counts.absent }));
      if (counts.excused > 0) parts.push(counts.excused > 1 ? t("adminAttendance.dialog.excusedCountPlural", { count: counts.excused }) : t("adminAttendance.dialog.excusedCount", { count: counts.excused }));
      
      toast.success(t("adminAttendance.dialog.attendanceSaved", { summary: parts.join(', ') }));

      const presentPlayerIds = Object.entries(attendance)
        .filter(([_, data]) => data.status === "present")
        .map(([playerId]) => playerId);
      
      onOpenChange(false);
      
      if (onAttendanceSaved && presentPlayerIds.length > 0) {
        onAttendanceSaved(presentPlayerIds);
      }
    },
    onError: (err: any) => {
      if (typeof err?.message === "string" && err.message.startsWith("guard:")) return;
      toast.error(t("adminAttendance.dialog.saveError"));
    },
  });

  const setAllStatus = (status: string) => {
    const updated: Record<string, PlayerAttendanceData> = {};
    players?.forEach((p) => {
      updated[p.id] = { 
        ...attendance[p.id], 
        status, 
        reason: attendance[p.id]?.reason || "",
        lateMinutes: attendance[p.id]?.lateMinutes || 0,
        lateJustified: attendance[p.id]?.lateJustified || false,
      };
    });
    setAttendance(updated);
  };

  const getStatusInfo = (status: string) => {
    return ATTENDANCE_STATUS.find((s) => s.value === status) || ATTENDANCE_STATUS[0];
  };

  const getStatusCounts = () => {
    const values = Object.values(attendance);
    return {
      present: values.filter((a) => a.status === "present").length,
      absent: values.filter((a) => a.status === "absent").length,
      excused: values.filter((a) => a.status === "excused").length,
      late: values.filter((a) => a.status === "late").length,
    };
  };

  const counts = getStatusCounts();

  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t("adminAttendance.dialog.rollCall", { date: format(new Date(session.session_date), "EEEE d MMMM", { locale: getDateLocale() }) })}
          </DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{session.training_type}</Badge>
            {session.session_start_time && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {session.session_start_time.slice(0, 5)}
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Summary */}
        <div className="flex gap-2 flex-wrap flex-shrink-0">
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <Check className="h-3 w-3 mr-1" />
            {counts.present > 1 ? t("adminAttendance.dialog.presentCountPlural", { count: counts.present }) : t("adminAttendance.dialog.presentCount", { count: counts.present })}
          </Badge>
          {counts.late > 0 && (
            <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
              <Clock className="h-3 w-3 mr-1" />
              {counts.late > 1 ? t("adminAttendance.dialog.lateCountPlural", { count: counts.late }) : t("adminAttendance.dialog.lateCount", { count: counts.late })}
            </Badge>
          )}
          {counts.absent > 0 && (
            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
              <X className="h-3 w-3 mr-1" />
              {counts.absent > 1 ? t("adminAttendance.dialog.absentCountPlural", { count: counts.absent }) : t("adminAttendance.dialog.absentCount", { count: counts.absent })}
            </Badge>
          )}
          {counts.excused > 0 && (
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
              <AlertCircle className="h-3 w-3 mr-1" />
              {counts.excused > 1 ? t("adminAttendance.dialog.excusedCountPlural", { count: counts.excused }) : t("adminAttendance.dialog.excusedCount", { count: counts.excused })}
            </Badge>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap items-center gap-2 p-3 bg-muted rounded-lg flex-shrink-0">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAllStatus("present")}>
              {t("adminAttendance.dialog.allPresent")}
            </Button>
          </div>
        </div>

        {/* Player list */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-2 pr-4">
            {players?.map((player) => {
              const playerData = attendance[player.id] || { 
                status: "present", 
                reason: "", 
                lateMinutes: 0,
                lateJustified: false,
              };
              const statusInfo = getStatusInfo(playerData.status);
              const StatusIcon = statusInfo.icon;

              return (
                <div key={player.id}>
                  <div
                    className={cn(
                      "p-3 rounded-lg border transition-colors",
                      playerData.status === "absent" && "border-red-200 bg-red-50",
                      playerData.status === "excused" && "border-amber-200 bg-amber-50",
                      playerData.status === "late" && "border-orange-200 bg-orange-50",
                      playerData.status === "present" && "border-green-200 bg-green-50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusIcon className={cn("h-5 w-5 flex-shrink-0", statusInfo.color)} />
                        <span className="font-medium truncate">{player.first_name ? `${player.first_name} ${player.name}` : player.name}</span>
                        {player.position && (
                          <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                            {player.position}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={playerData.status}
                          onValueChange={(value) =>
                            setAttendance({
                              ...attendance,
                              [player.id]: { ...playerData, status: value },
                            })
                          }
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ATTENDANCE_STATUS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                <div className="flex items-center gap-2">
                                  <s.icon className={cn("h-4 w-4", s.color)} />
                                  {s.label()}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Late details */}
                    {playerData.status === "late" && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder={t("adminAttendance.dialog.lateMinutesPlaceholder")}
                            value={playerData.lateMinutes || ""}
                            onChange={(e) =>
                              setAttendance({
                                ...attendance,
                                [player.id]: { ...playerData, lateMinutes: parseInt(e.target.value) || 0 },
                              })
                            }
                            className="w-32 bg-background"
                          />
                          <span className="text-sm text-muted-foreground">{t("adminAttendance.dialog.minutesUnit")}</span>
                          <div className="flex items-center gap-2 ml-4">
                            <Switch
                              id={`justified-${player.id}`}
                              checked={playerData.lateJustified}
                              onCheckedChange={(checked) =>
                                setAttendance({
                                  ...attendance,
                                  [player.id]: { ...playerData, lateJustified: checked },
                                })
                              }
                            />
                            <Label htmlFor={`justified-${player.id}`} className="text-sm">
                              {playerData.lateJustified ? t("adminAttendance.dialog.justifiedLabel") : t("adminAttendance.dialog.unjustifiedLabel")}
                            </Label>
                          </div>
                        </div>
                        <Input
                          placeholder={t("adminAttendance.dialog.lateReasonPlaceholder")}
                          value={playerData.reason}
                          onChange={(e) =>
                            setAttendance({
                              ...attendance,
                              [player.id]: { ...playerData, reason: e.target.value },
                            })
                          }
                          className="bg-background"
                        />
                      </div>
                    )}

                    {/* Absence/Excused reason */}
                    {(playerData.status === "absent" || playerData.status === "excused") && (
                      <div className="mt-2">
                        <Input
                          placeholder={t("adminAttendance.dialog.reasonPlaceholder")}
                          value={playerData.reason}
                          onChange={(e) =>
                            setAttendance({
                              ...attendance,
                              [player.id]: { ...playerData, reason: e.target.value },
                            })
                          }
                          className="bg-background"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("adminAttendance.dialog.cancel")}
          </Button>
          <Button onClick={() => saveAttendance.mutate()} disabled={saveAttendance.isPending}>
            {saveAttendance.isPending ? t("adminAttendance.dialog.saving") : t("adminAttendance.dialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
