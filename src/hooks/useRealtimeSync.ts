import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type TableName = 
  | "training_sessions"
  | "training_session_blocks"
  | "awcr_tracking"
  | "wellness_tracking";

interface RealtimeSyncConfig {
  /** Tables to listen to */
  tables: TableName[];
  /** Category ID to filter events (optional) */
  categoryId?: string;
  /** Query key prefixes to invalidate when changes occur */
  queryKeys: string[][];
  /** Channel name (must be unique per component instance) */
  channelName: string;
}

/**
 * Hook that subscribes to Supabase realtime changes and automatically
 * invalidates react-query caches for the specified query keys.
 */
export function useRealtimeSync({ tables, categoryId, queryKeys, channelName }: RealtimeSyncConfig) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!categoryId && tables.length === 0) return;

    const channel = supabase.channel(channelName);

    tables.forEach((table) => {
      const filter = categoryId ? `category_id=eq.${categoryId}` : undefined;

      channel.on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        () => {
          // Invalidate all specified query keys
          queryKeys.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: key });
          });
        }
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [categoryId, channelName, queryClient, tables.join(","), queryKeys.map(k => k.join("-")).join(",")]);
}
