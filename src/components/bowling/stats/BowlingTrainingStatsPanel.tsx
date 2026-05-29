// Vue stats d'entraînement basées sur bowling_throw_results.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { computeKpis, statsByZone, statsByBall, type ThrowRow } from "@/lib/bowling/trainingStatsAggregator";
import { TACTICAL_ZONES, zoneShort } from "@/lib/constants/bowlingTacticalZones";
import { cn } from "@/lib/utils";

interface Props {
  playerId: string;
  categoryId: string;
  /** ISO yyyy-mm-dd */
  from?: string;
  to?: string;
}

const Kpi = ({ label, value, accent }: { label: string; value: string | number; accent?: string }) => (
  <Card className={cn("p-3", accent)}>
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
    <p className="text-xl font-bold">{value}</p>
  </Card>
);

export function BowlingTrainingStatsPanel({ playerId, categoryId, from, to }: Props) {
  const { data: throws = [], isLoading } = useQuery({
    queryKey: ["bowling_throws_stats", playerId, categoryId, from, to],
    queryFn: async () => {
      let q = supabase
        .from("bowling_throw_results")
        .select("*, bowling_training_blocks!inner(category_id, created_at)")
        .eq("athlete_id", playerId)
        .eq("bowling_training_blocks.category_id", categoryId);
      if (from) q = q.gte("bowling_training_blocks.created_at", from);
      if (to) q = q.lte("bowling_training_blocks.created_at", to);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as ThrowRow[];
    },
  });

  const { data: balls = [] } = useQuery({
    queryKey: ["player_bowling_arsenal_names", playerId],
    queryFn: async () => {
      const { data } = await supabase.from("player_bowling_arsenal").select("id, custom_ball_name").eq("player_id", playerId);
      return data || [];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!throws.length) return <p className="text-sm text-muted-foreground italic">Aucun lancer enregistré sur la période.</p>;

  const k = computeKpis(throws);
  const zoneStats = statsByZone(throws, TACTICAL_ZONES).filter((z) => z.count > 0);
  const ballStats = statsByBall(throws);
  const ballName = (id: string) => balls.find((b: any) => b.id === id)?.custom_ball_name || "Boule";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Kpi label="Lancers" value={k.total} />
        <Kpi label="% Poche" value={`${k.pocketPct}%`} />
        <Kpi label="% Strike" value={`${k.strikePct}%`} accent="bg-amber-500/5" />
        <Kpi label="% Poche + Strike" value={`${k.pocketStrikePct}%`} accent="bg-emerald-500/5" />
        <Kpi label="% Spare" value={`${k.sparePct}%`} />
        <Kpi label="% Axe" value={`${k.axisPct}%`} />
        <Kpi label="% Point de sortie" value={`${k.breakpointPct}%`} />
        <Kpi label="Meilleure série" value={k.bestStreak} accent="bg-primary/5" />
      </div>

      {zoneStats.length > 0 && (
        <Card className="p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Heatmap par zone</p>
          <div className="space-y-1">
            {zoneStats.map((z) => (
              <div key={z.zone} className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="text-[10px] w-14 justify-center">{zoneShort(z.zone)}</Badge>
                <div className="flex-1 h-5 bg-muted rounded relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-emerald-500/60" style={{ width: `${z.pocketStrikePct}%` }} />
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold">
                    {z.pocketStrikePct}% PS · {z.count} lancers
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {ballStats.length > 0 && (
        <Card className="p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Performance par boule</p>
          <div className="space-y-1">
            {ballStats.map((b) => (
              <div key={b.ball_id} className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="text-[10px]">{ballName(b.ball_id)}</Badge>
                <span className="text-muted-foreground">{b.count} lancers</span>
                <span className="ml-auto">Poche {b.pocketPct}% · Strike {b.strikePct}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
