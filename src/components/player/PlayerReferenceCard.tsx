import { usePlayerReferences } from "@/hooks/use-performance-references";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Zap, Gauge, Activity } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PlayerReferenceCardProps {
  categoryId: string;
  playerId: string;
  playerName?: string;
}

export function PlayerReferenceCard({
  categoryId,
  playerId,
  playerName,
}: PlayerReferenceCardProps) {
  const { data: references, isLoading } = usePlayerReferences(categoryId, playerId);
  
  const activeRef = references?.find(r => r.is_active);

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-4">
          <div className="h-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!activeRef) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 text-center text-muted-foreground">
          <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Pas de référence définie</p>
          <p className="text-xs">Effectuez un test 40m pour définir les références</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Références de performance
            {playerName && <span className="text-muted-foreground font-normal">- {playerName}</span>}
          </span>
          <Badge variant="outline" className="text-xs font-normal">
            {format(new Date(activeRef.test_date), "d MMM yyyy", { locale: fr })}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {activeRef.ref_vmax_kmh && (
            <div className="text-center p-2 bg-muted/50 rounded">
              <Gauge className="h-4 w-4 mx-auto mb-1 text-primary" />
              <p className="text-lg font-bold">{activeRef.ref_vmax_kmh.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Vmax km/h</p>
            </div>
          )}
          
          {activeRef.ref_time_40m_seconds && (
            <div className="text-center p-2 bg-muted/50 rounded">
              <Zap className="h-4 w-4 mx-auto mb-1 text-primary" />
              <p className="text-lg font-bold">{activeRef.ref_time_40m_seconds.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">40m (sec)</p>
            </div>
          )}

          {activeRef.ref_acceleration_max && (
            <div className="text-center p-2 bg-muted/50 rounded">
              <Activity className="h-4 w-4 mx-auto mb-1 text-primary" />
              <p className="text-lg font-bold">{activeRef.ref_acceleration_max}</p>
              <p className="text-xs text-muted-foreground">Accélérations</p>
            </div>
          )}

          {activeRef.ref_player_load_per_min && (
            <div className="text-center p-2 bg-muted/50 rounded">
              <Activity className="h-4 w-4 mx-auto mb-1 text-primary" />
              <p className="text-lg font-bold">{activeRef.ref_player_load_per_min.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Load/min</p>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-2 text-center">
          Source: {activeRef.source_type === "gps_session" ? "Test GPS" : "Test manuel"}
        </p>
      </CardContent>
    </Card>
  );
}
