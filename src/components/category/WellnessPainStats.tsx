import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeasonFilteredPlayerIds, makePlayerIdFilter } from "@/hooks/use-season-filtered-players";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface WellnessPainStatsProps {
  categoryId: string;
}

export function WellnessPainStats({ categoryId }: WellnessPainStatsProps) {
  const { t } = useTranslation();
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

  if (isLoading) return <div className="text-muted-foreground text-sm">{t("health.wellnessPainStats.loading")}</div>;

  const totalPains = painData?.length || 0;

  if (totalPains === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("health.wellnessPainStats.title")}</CardTitle>
          <CardDescription>{t("health.wellnessPainStats.noPain")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Infer zone from location label when pain_zone is missing (legacy entries
  // or alternative entry paths that didn't persist the zone).
  const inferZone = (loc?: string | null): string => {
    if (!loc) return t("health.wellnessPainStats.unclassified");
    const s = loc.toLowerCase();
    if (/(t[êe]te|nuque|cr[âa]ne|cervical)/.test(s)) return t("health.wellnessPainStats.zoneHead");
    if (/(abdomen|abdo|oblique|ventre)/.test(s)) return t("health.wellnessPainStats.zoneAbdomen");
    if (/(épaule|epaule|pectoral|trap[èe]ze|dorsal|bras|biceps|triceps|coude|avant-bras|poignet|main|nuque)/.test(s)) return t("health.wellnessPainStats.zoneUpperBody");
    if (/(hanche|adducteur|cuisse|quadriceps|ischio|fessier|genou|tibia|mollet|cheville|tendon|achille|talon|pied|lombaire|dos)/.test(s)) return t("health.wellnessPainStats.zoneLowerBody");
    return t("health.wellnessPainStats.unclassified");
  };

  // Count by zone
  const zoneCounts: Record<string, number> = {};
  const locationCounts: Record<string, number> = {};

  painData?.forEach(entry => {
    const rawZone = (entry as any).pain_zone as string | null | undefined;
    const location = entry.pain_location || t("health.wellnessPainStats.unspecified");
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
            {t("health.wellnessPainStats.title")}
          </CardTitle>
          <CardDescription>
            {t("health.wellnessPainStats.countTotal", { count: totalPains })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* By zone */}
          <div>
            <h4 className="text-sm font-semibold mb-3">{t("health.wellnessPainStats.byZone")}</h4>
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
            <h4 className="text-sm font-semibold mb-3">{t("health.wellnessPainStats.topLocations")}</h4>
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
