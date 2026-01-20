import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getTrainingTypeLabel } from "@/lib/constants/trainingTypes";

interface SessionFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  sessionType: string;
  categoryId: string;
}

export function SessionFeedbackDialog({
  open,
  onOpenChange,
  sessionId,
  sessionType,
  categoryId,
}: SessionFeedbackDialogProps) {
  const [rpeValues, setRpeValues] = useState<Record<string, { rpe: string; duration: string }>>({});
  const queryClient = useQueryClient();

  // Fetch session details to get default duration
  const { data: session } = useQuery({
    queryKey: ["session-for-rpe", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("session_start_time, session_end_time, session_date")
        .eq("id", sessionId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Calculate default duration from session times
  const defaultDuration = useMemo(() => {
    if (session?.session_start_time && session?.session_end_time) {
      const start = session.session_start_time.split(":");
      const end = session.session_end_time.split(":");
      const startMinutes = parseInt(start[0]) * 60 + parseInt(start[1]);
      const endMinutes = parseInt(end[0]) * 60 + parseInt(end[1]);
      return Math.max(0, endMinutes - startMinutes);
    }
    return 60; // Default 60 minutes if no times set
  }, [session]);

  // Fetch players
  const { data: players } = useQuery({
    queryKey: ["players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch existing RPE data
  const { data: existingRpe } = useQuery({
    queryKey: ["awcr_tracking", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("awcr_tracking")
        .select("*")
        .eq("training_session_id", sessionId);
      if (error) throw error;
      return data;
    },
    enabled: open && !!sessionId,
  });

  // Fetch attendance
  const { data: attendance } = useQuery({
    queryKey: ["session-attendance", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_attendance")
        .select("player_id")
        .eq("training_session_id", sessionId);
      if (error) throw error;
      return data;
    },
    enabled: open && !!sessionId,
  });

  // Initialize RPE values with default duration when players load
  useEffect(() => {
    if (players && defaultDuration && open) {
      const initial: Record<string, { rpe: string; duration: string }> = {};
      players.forEach((player) => {
        // Don't overwrite existing values
        if (!rpeValues[player.id]) {
          initial[player.id] = { rpe: "", duration: defaultDuration.toString() };
        }
      });
      if (Object.keys(initial).length > 0) {
        setRpeValues((prev) => ({ ...initial, ...prev }));
      }
    }
  }, [players, defaultDuration, open]);

  // Reset values when dialog closes
  useEffect(() => {
    if (!open) {
      setRpeValues({});
    }
  }, [open]);

  // Calculate AWCR for a player
  const calculateAWCR = async (playerId: string, sessionDateStr: string, newLoad: number) => {
    const sevenDaysAgo = new Date(sessionDateStr);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const twentyEightDaysAgo = new Date(sessionDateStr);
    twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);

    const { data: recentSessions } = await supabase
      .from("awcr_tracking")
      .select("training_load")
      .eq("player_id", playerId)
      .gte("session_date", sevenDaysAgo.toISOString().split("T")[0])
      .lt("session_date", sessionDateStr);

    const { data: chronicSessions } = await supabase
      .from("awcr_tracking")
      .select("training_load")
      .eq("player_id", playerId)
      .gte("session_date", twentyEightDaysAgo.toISOString().split("T")[0])
      .lt("session_date", sessionDateStr);

    const acuteTotal = (recentSessions?.reduce((sum, s) => sum + (s.training_load || 0), 0) || 0) + newLoad;
    const chronicTotal = chronicSessions?.reduce((sum, s) => sum + (s.training_load || 0), 0) || 0;

    const acuteAvg = acuteTotal / 7;
    const chronicAvg = chronicTotal / 28;

    const awcr = chronicAvg > 0 ? acuteAvg / chronicAvg : 0;

    return { acuteLoad: acuteAvg, chronicLoad: chronicAvg, awcr };
  };

  const saveRpe = useMutation({
    mutationFn: async () => {
      if (!session?.session_date) throw new Error("Date de séance manquante");
      
      const playersToSave = players?.filter((p) => rpeValues[p.id]?.rpe && rpeValues[p.id]?.duration) || [];

      if (playersToSave.length === 0) {
        throw new Error("Aucun RPE à enregistrer");
      }

      // Calculate AWCR for each player and save
      for (const player of playersToSave) {
        const rpe = parseInt(rpeValues[player.id].rpe);
        const duration = parseInt(rpeValues[player.id].duration);
        const trainingLoad = rpe * duration;

        const { acuteLoad, chronicLoad, awcr } = await calculateAWCR(
          player.id,
          session.session_date,
          trainingLoad
        );

        const { error } = await supabase.from("awcr_tracking").insert({
          player_id: player.id,
          category_id: categoryId,
          training_session_id: sessionId,
          session_date: session.session_date,
          rpe,
          duration_minutes: duration,
          training_load: trainingLoad,
          acute_load: acuteLoad,
          chronic_load: chronicLoad,
          awcr: awcr,
        });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["awcr_tracking"] });
      queryClient.invalidateQueries({ queryKey: ["awcr-data"] });
      queryClient.invalidateQueries({ queryKey: ["training_sessions"] });
      toast.success(`RPE enregistrés avec calcul AWCR automatique`);
      setRpeValues({});
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erreur lors de l'enregistrement");
    },
  });

  const handleChange = (playerId: string, field: "rpe" | "duration", value: string) => {
    setRpeValues((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [field]: value,
      },
    }));
  };

  const attendedPlayerIds = new Set(attendance?.map((a) => a.player_id) || []);
  const playersWithRpe = new Set(existingRpe?.map((r) => r.player_id) || []);
  
  // Filter to only show players who attended (or all if no attendance recorded)
  const playersToShow = useMemo(() => {
    if (!players) return [];
    if (!attendance || attendance.length === 0) return players;
    return players.filter((p) => attendedPlayerIds.has(p.id));
  }, [players, attendance, attendedPlayerIds]);

  const hasNewValues = Object.entries(rpeValues).some(
    ([id, val]) => val.rpe && val.duration && !playersWithRpe.has(id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Saisie RPE - {getTrainingTypeLabel(sessionType)}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          RPE: Rate of Perceived Exertion (0-10). La durée est pré-remplie depuis les horaires de la séance.
        </p>

        <ScrollArea className="flex-1 max-h-[50vh] pr-2">
          <div className="space-y-2">
            {playersToShow.map((player) => {
              const existing = existingRpe?.find((r) => r.player_id === player.id);

              return (
                <div
                  key={player.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <Label className="w-32 font-medium truncate">{player.name}</Label>
                  {existing ? (
                    <span className="text-sm text-muted-foreground">
                      ✓ RPE {existing.rpe} - {existing.duration_minutes}min
                      <span className="text-xs ml-1">(charge: {existing.training_load})</span>
                    </span>
                  ) : (
                    <>
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">RPE</Label>
                        <Input
                          type="number"
                          min="0"
                          max="10"
                          placeholder="0-10"
                          className="w-16 h-8"
                          value={rpeValues[player.id]?.rpe || ""}
                          onChange={(e) => handleChange(player.id, "rpe", e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">Min</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Min"
                          className="w-20 h-8"
                          value={rpeValues[player.id]?.duration || ""}
                          onChange={(e) => handleChange(player.id, "duration", e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={() => saveRpe.mutate()}
            disabled={saveRpe.isPending || !hasNewValues}
          >
            Enregistrer les RPE
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
