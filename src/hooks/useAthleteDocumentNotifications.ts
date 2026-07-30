import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Suit les notifications "athlete_document" non lues pour un athlète donné
 * (documents & certificats ajoutés par le staff, personnels ou d'équipe).
 * Renvoie le nombre + une fonction pour les marquer comme lues.
 */
export function useAthleteDocumentNotifications(playerId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ["athlete-document-notifications", playerId];

  const { data: count = 0 } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!playerId) return 0;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      const { count: c } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("notification_type", "athlete_document")
        .eq("is_read", false)
        .contains("metadata", { player_id: playerId });
      return c || 0;
    },
    enabled: !!playerId,
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (!playerId) return;
    const channel = supabase
      .channel(`athlete-documents-${playerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [playerId, queryClient]);

  const markAsRead = async () => {
    if (!playerId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("notification_type", "athlete_document")
      .eq("is_read", false)
      .contains("metadata", { player_id: playerId });
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  return { count, markAsRead };
}
