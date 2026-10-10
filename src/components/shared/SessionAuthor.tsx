import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { isOwnSession, type SessionAuthorship } from "@/lib/sessionAuthor";

const queues = new Map<string, Map<string, { resolve: (value: SessionAuthorship | null) => void; reject: (reason: unknown) => void }[]>>();
function loadAuthor(sessionId: string, userId: string): Promise<SessionAuthorship | null> {
  return new Promise((resolve, reject) => {
    let queue = queues.get(userId);
    if (!queue) {
      queue = new Map();
      queues.set(userId, queue);
      setTimeout(async () => {
        const pending = queues.get(userId);
        queues.delete(userId);
        if (!pending) return;
        try {
          const ids = [...pending.keys()];
          const rows: SessionAuthorship[] = [];
          for (let start = 0; start < ids.length; start += 200) {
            const { data, error } = await supabase.rpc("get_session_authorship", { session_ids: ids.slice(start, start + 200) });
            if (error) throw error;
            rows.push(...(data || []));
          }
          const byId = new Map(rows.map(row => [row.session_id, row]));
          pending.forEach((callbacks, id) => callbacks.forEach(callback => callback.resolve(byId.get(id) || null)));
        } catch (error) {
          pending.forEach(callbacks => callbacks.forEach(callback => callback.reject(error)));
        }
      }, 20);
    }
    const callbacks = queue.get(sessionId) || [];
    callbacks.push({ resolve, reject });
    queue.set(sessionId, callbacks);
  });
}

export function SessionAuthor({ sessionId, playerId, className }: { sessionId?: string; playerId?: string; className?: string }) {
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["session-author", user?.id, sessionId],
    enabled: !!sessionId && !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: () => sessionId && user?.id ? loadAuthor(sessionId, user.id) : Promise.resolve(null),
  });
  if (!sessionId) return null;
  const mine = data && isOwnSession(data, user?.id, playerId);
  const name = data?.author_name?.trim();
  const text = isLoading ? "Auteur…" : isError ? "Auteur indisponible" : mine ? "par moi" : name ? `par ${name}` : "Auteur non renseigné";
  return <span data-session-author={sessionId} className={cn("block min-w-0 break-words text-xs font-normal leading-snug text-muted-foreground", className)}>{text}</span>;
}