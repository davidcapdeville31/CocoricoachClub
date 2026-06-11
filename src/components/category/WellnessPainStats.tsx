import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeasonFilteredPlayerIds, makePlayerIdFilter } from "@/hooks/use-season-filtered-players";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle } from "lucide-react";

interface WellnessPainStatsProps {
  categoryId: string;
}

export function WellnessPainStats({ categoryId }: WellnessPainStatsProps) {
  const { allowedIds } = useSeasonFilteredPlayerIds(categoryId);
  const keepPlayer = makePlayerIdFilter(allowedIds);

  const { data: painDataRaw, isLoading } = useQuery({
    queryKey: ["wellness-pain-stats", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_tracking")
        .select("player_id, pain_location, pain_zone, has_specific_pain, players(name)")
        .eq("category_id", categoryId)
        .eq("has_specific_pain", true);
      if (error) throw error;
      return data;
    },
  });
  const painData = useMemo(
    () => (painDataRaw || []).filter((p: any) => keepPlayer(p.player_id)),
    [painDataRaw, allowedIds],
  );

  if (isLoading) return <div className="text-muted-foreground text-sm">Chargement...</div>;

  const totalPains = painData?.length || 0;

  if (totalPains === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Statistiques des douleurs</CardTitle>
          <CardDescription>Aucune douleur signalée pour le moment</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Infer zone from location label when pain_zone is missing (legacy entries
  // or alternative entry paths that didn't persist the zone).
  const inferZone = (loc?: string | null): string => {
    if (!loc) return "Non classé";
    const s = loc.toLowerCase();
    if (/(t[êe]te|nuque|cr[âa]ne|cervical)/.test(s)) return "Tête";
    if (/(abdomen|abdo|oblique|ventre)/.test(s)) return "Abdomen";
    if (/(épaule|epaule|pectoral|trap[èe]ze|dorsal|bras|biceps|triceps|coude|avant-bras|poignet|main|nuque)/.test(s)) return "Haut du corps";
    if (/(hanche|adducteur|cuisse|quadriceps|ischio|fessier|genou|tibia|mollet|cheville|tendon|achille|talon|pied|lombaire|dos)/.test(s)) return "Bas du corps";
    return "Non classé";
  };

  // Count by zone
  const zoneCounts: Record<string, number> = {};
  const locationCounts: Record<string, number> = {};

  painData?.forEach(entry => {
    const rawZone = (entry as any).pain_zone as string | null | undefined;
    const location = entry.pain_location || "Non précisé";
    const zone = rawZone && rawZone.trim().length > 0 ? rawZone : inferZone(entry.pain_location);

    zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
    locationCounts[location] = (locationCounts[location] || 0) + 1;
  });

  const sortedZones = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1]);
  const sortedLocations = Object.entries(locationCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Statistiques des douleurs
          </CardTitle>
          <CardDescription>
            {totalPains} douleur{totalPains > 1 ? "s" : ""} signalée{totalPains > 1 ? "s" : ""} au total
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* By zone */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Par zone du corps</h4>
            <div className="space-y-3">
              {sortedZones.map(([zone, count]) => {
                const pct = Math.round((count / totalPains) * 100);
                return (
                  <div key={zone}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">{zone}</span>
                      <Badge variant="secondary" className="text-xs">
                        {count} ({pct}%)
                      </Badge>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* By specific location */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Top localisations précises</h4>
            <div className="space-y-3">
              {sortedLocations.map(([location, count]) => {
                const pct = Math.round((count / totalPains) * 100);
                return (
                  <div key={location}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">{location}</span>
                      <Badge variant="secondary" className="text-xs">
                        {count} ({pct}%)
                      </Badge>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
