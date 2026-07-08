import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to realtime changes on club_members, category_members
 * and their invitation tables so that staff/membership lists refresh
 * instantly when someone accepts an invitation.
 */
export function useRealtimeMembers(scopeKey: string = "global") {
  const queryClient = useQueryClient();

  useEffect(() => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const channel = supabase
      .channel(`members-realtime-${scopeKey}-${suffix}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "club_members" }, () => {
        queryClient.invalidateQueries({ queryKey: ["club-members"] });
        queryClient.invalidateQueries({ queryKey: ["club-members-full"] });
        queryClient.invalidateQueries({ queryKey: ["club-members-for-category"] });
        queryClient.invalidateQueries({ queryKey: ["conv-candidates"] });
        queryClient.invalidateQueries({ queryKey: ["conv-participants-manage"] });
        queryClient.invalidateQueries({ queryKey: ["conversation-participant-names"] });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "category_members" }, () => {
        queryClient.invalidateQueries({ queryKey: ["category-members"] });
        queryClient.invalidateQueries({ queryKey: ["players"] });
        queryClient.invalidateQueries({ queryKey: ["conv-candidates"] });
        queryClient.invalidateQueries({ queryKey: ["conv-participants-manage"] });
        queryClient.invalidateQueries({ queryKey: ["conversation-participant-names"] });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "club_invitations" }, () => {
        queryClient.invalidateQueries({ queryKey: ["club-invitations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "category_invitations" }, () => {
        queryClient.invalidateQueries({ queryKey: ["category-invitations"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, scopeKey]);
}
