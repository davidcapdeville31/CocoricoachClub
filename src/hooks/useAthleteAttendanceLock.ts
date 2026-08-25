import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns whether the athlete declared himself absent for a given training session.
 * When absent, data entry (RPE, test results, weights…) must be locked until the
 * athlete switches back to "present". Works for every discipline.
 */
export function useAthleteAttendanceLock(sessionId?: string | null, playerId?: string | null) {
  const { data, isLoading } = useQuery({
    queryKey: ["athlete-attendance-lock", sessionId, playerId],
    queryFn: async () => {
      if (!sessionId || !playerId) return null;
      const { data, error } = await supabase
        .from("event_participants")
        .select("attendance_status")
        .eq("training_session_id", sessionId)
        .eq("player_id", playerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId && !!playerId,
    staleTime: 5_000,
  });

  return {
    isAbsent: data?.attendance_status === "absent",
    isLoading,
  };
}
