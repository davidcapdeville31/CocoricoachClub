import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUnreadMatchStatsNotifications } from "@/lib/hooks/useUnreadMatchStatsNotifications";
import { toast } from "sonner";

/** Staff-only consultation: RLS is authoritative; read state belongs to each staff user. */
export function AthleteMatchFeedback({ matchId, categoryId, open }: { matchId: string; categoryId: string; open: boolean }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const { rows, countForMatch } = useUnreadMatchStatsNotifications(categoryId);
  const query = useQuery({
    queryKey: ["staff-athlete-match-feedback", matchId],
    enabled: open,
    refetchInterval: open ? 15_000 : false,
    queryFn: async () => {
      const { data, error } = await supabase.from("player_match_stats")
        .select("player_id, athlete_feedback, players(name, first_name)").eq("match_id", matchId);
      if (error) throw error;
      return data || [];
    },
  });
  const markRead = async () => {
    if (!user) return;
    const ids = rows.filter(r => {
      const m = r.metadata;
      return m && typeof m === "object" && !Array.isArray(m) && m.match_id === matchId;
    }).map(r => r.id);
    if (!ids.length) return;
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).in("id", ids);
    if (error) { toast.error("Impossible de marquer les retours comme lus"); return; }
    client.invalidateQueries({ queryKey: ["unread-match-stats"] });
    client.invalidateQueries({ queryKey: ["notifications"] });
  };
  const feedback = (query.data || []).filter(row => row.athlete_feedback?.trim());
  return (
    <section className="space-y-3 border-t border-border py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Retours des athlètes</h3>
        {countForMatch(matchId) > 0 && <Button size="sm" variant="outline" onClick={markRead}>
          Marquer comme lus <Badge variant="destructive" className="ml-2">{countForMatch(matchId)}</Badge>
        </Button>}
      </div>
      {query.isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p>
        : query.isError ? <Button variant="outline" size="sm" onClick={() => query.refetch()}>Réessayer</Button>
        : feedback.length === 0 ? <p className="text-sm text-muted-foreground">Aucun ressenti renseigné.</p>
        : feedback.map(row => <div key={row.player_id} className="border-l-2 border-primary pl-3">
          <p className="text-sm font-medium">{[row.players?.first_name, row.players?.name].filter(Boolean).join(" ") || "Athlète"}</p>
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{row.athlete_feedback}</p>
        </div>)}
    </section>
  );
}