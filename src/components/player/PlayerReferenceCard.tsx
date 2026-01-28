import { usePlayerReferences } from "@/hooks/use-performance-references";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Zap, Gauge, Activity, TrendingUp, TrendingDown } from "lucide-react";
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
          <p className="text-xs">Effectuez un test sprint avec données GPS pour définir les références</p>
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Vmax - Vitesse maximale */}
          {activeRef.ref_vmax_kmh && (
            <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
              <Gauge className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold text-primary">{activeRef.ref_vmax_kmh.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Vmax (km/h)</p>
            </div>
          )}
          
          {/* Temps 40m */}
          {activeRef.ref_time_40m_seconds && (
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Zap className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{activeRef.ref_time_40m_seconds.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">40m (sec)</p>
            </div>
          )}

          {/* Fmax - Accélérations (proxy pour force) */}
          {activeRef.ref_acceleration_max && (
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <TrendingUp className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{activeRef.ref_acceleration_max}</p>
              <p className="text-xs text-muted-foreground">Fmax (acc)</p>
            </div>
          )}

          {/* Décélérations */}
          {activeRef.ref_deceleration_max && (
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <TrendingDown className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{activeRef.ref_deceleration_max}</p>
              <p className="text-xs text-muted-foreground">Déc max</p>
            </div>
          )}

          {/* Player Load par minute */}
          {activeRef.ref_player_load_per_min && (
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Activity className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{activeRef.ref_player_load_per_min.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Load/min</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-2 border-t text-xs text-muted-foreground">
          <span>Source: {activeRef.source_type === "gps_session" ? "Test GPS" : "Test manuel"}</span>
          {activeRef.notes && <span className="truncate max-w-[200px]">{activeRef.notes}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
