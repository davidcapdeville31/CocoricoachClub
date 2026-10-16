import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUnreadMatchStatsNotifications } from "@/lib/hooks/useUnreadMatchStatsNotifications";
import { toast } from "sonner";
import { format } from "date-fns";
import { getDateLocale } from "@/lib/i18n/dateLocale";

/** Staff consultation of athlete-authored competition feedback; read state is per staff user. */
export function AthleteMatchFeedback({ categoryId }: { categoryId: string }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const { rows, count, countForMatch } = useUnreadMatchStatsNotifications(categoryId);
  const query = useQuery({
    queryKey: ["staff-athlete-match-feedback", categoryId],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("player_match_stats")
        .select("match_id, player_id, athlete_feedback, players(name, first_name), matches!inner(opponent, match_date, category_id)")
        .eq("matches.category_id", categoryId).not("athlete_feedback", "is", null)
        .order("match_date", { referencedTable: "matches", ascending: false }).limit(50);
      if (error) throw error;
      return (data || []).filter(r => r.athlete_feedback?.trim());
    },
  });
  const markRead = async () => {
    if (!user || !rows.length) return;
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).in("id", rows.map(r => r.id));
    if (error) { toast.error("Impossible de marquer les nouveautés comme lues"); return; }
    client.invalidateQueries({ queryKey: ["unread-match-stats"] });
    client.invalidateQueries({ queryKey: ["notifications"] });
  };
  if (!query.isLoading && !query.isError && !query.data?.length && count === 0) return null;
  return (
    <section className="mb-4 space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Retours des athlètes {count > 0 && <Badge variant="destructive" className="ml-1">{count} nouveau{count > 1 ? "x" : ""}</Badge>}</h3>
        {count > 0 && <Button size="sm" variant="outline" onClick={markRead}>Marquer comme lus</Button>}
      </div>
      {query.isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p>
        : query.isError ? <Button variant="outline" size="sm" onClick={() => query.refetch()}>Réessayer</Button>
        : !query.data?.length ? <p className="text-sm text-muted-foreground">Nouvelles statistiques saisies, sans ressenti écrit.</p>
        : <div className="max-h-80 space-y-3 overflow-y-auto pr-1">{query.data.map(row => {
          const m = row.matches; const isNew = countForMatch(row.match_id) > 0;
          return <article key={`${row.match_id}-${row.player_id}`} className="border-l-2 border-primary pl-3">
            <p className="text-sm font-medium">{[row.players?.first_name, row.players?.name].filter(Boolean).join(" ") || "Athlète"}{isNew && <Badge variant="destructive" className="ml-2">Nouveau</Badge>}</p>
            <p className="text-xs text-muted-foreground">{m?.opponent || "Compétition"}{m?.match_date ? ` · ${format(new Date(m.match_date), "d MMM yyyy", { locale: getDateLocale() })}` : ""}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{row.athlete_feedback}</p>
          </article>;
        })}</div>}
    </section>
  );
}
