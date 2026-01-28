import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Satellite, Link2 } from "lucide-react";

interface GpsSession {
  id: string;
  player_id: string;
  session_date: string;
  max_speed_ms: number | null;
  accelerations: number | null;
  decelerations: number | null;
  sprint_distance_m: number | null;
  player_load: number | null;
  duration_minutes: number | null;
  high_speed_distance_m: number | null;
}

interface GpsDataSelectorProps {
  categoryId: string;
  date: string;
  players: Array<{ id: string; name: string }>;
  onGpsDataSelected: (data: Map<string, GpsSession>) => void;
}

export function GpsDataSelector({
  categoryId,
  date,
  players,
  onGpsDataSelected,
}: GpsDataSelectorProps) {
  const [mode, setMode] = useState<"none" | "existing">("none");

  // Fetch existing GPS sessions for the date
  const { data: existingGpsSessions } = useQuery({
    queryKey: ["gps_sessions_for_test", categoryId, date],
    queryFn: async () => {
      const playerIds = players.map(p => p.id);
      const { data, error } = await supabase
        .from("gps_sessions")
        .select("*")
        .eq("category_id", categoryId)
        .eq("session_date", date)
        .in("player_id", playerIds);
      
      if (error) throw error;
      return data as GpsSession[];
    },
    enabled: !!categoryId && !!date && players.length > 0,
  });

  const handleModeChange = (newMode: string) => {
    setMode(newMode as "none" | "existing");
    
    if (newMode === "existing" && existingGpsSessions) {
      const dataMap = new Map<string, GpsSession>();
      existingGpsSessions.forEach(session => {
        dataMap.set(session.player_id, session);
      });
      onGpsDataSelected(dataMap);
    } else if (newMode === "none") {
      onGpsDataSelected(new Map());
    }
  };

  const matchedPlayersCount = existingGpsSessions?.length || 0;

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
      <div className="flex items-center gap-2">
        <Satellite className="h-4 w-4 text-primary" />
        <Label className="font-medium">Données GPS (optionnel)</Label>
      </div>
      
      <p className="text-xs text-muted-foreground">
        Enrichissez le test avec les données GPS pour définir automatiquement les références de performance (Vmax, accélérations).
      </p>

      <RadioGroup value={mode} onValueChange={handleModeChange} className="space-y-2">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="none" id="gps-none" />
          <Label htmlFor="gps-none" className="text-sm font-normal cursor-pointer">
            Sans données GPS
          </Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="existing" id="gps-existing" />
          <Label htmlFor="gps-existing" className="text-sm font-normal cursor-pointer flex items-center gap-2">
            <Link2 className="h-3 w-3" />
            Lier aux sessions GPS existantes du {date}
            {matchedPlayersCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {matchedPlayersCount} joueur{matchedPlayersCount > 1 ? "s" : ""} trouvé{matchedPlayersCount > 1 ? "s" : ""}
              </Badge>
            )}
          </Label>
        </div>
      </RadioGroup>

      {mode === "existing" && matchedPlayersCount === 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          Aucune session GPS trouvée pour cette date. Importez d'abord les données via l'onglet GPS.
        </p>
      )}

      {mode === "existing" && matchedPlayersCount > 0 && existingGpsSessions && (
        <div className="text-xs space-y-1 p-2 bg-background rounded border">
          <p className="font-medium text-primary">
            ✓ Données GPS liées :
          </p>
          <ul className="space-y-0.5 text-muted-foreground">
            {existingGpsSessions.slice(0, 5).map(session => {
              const player = players.find(p => p.id === session.player_id);
              return (
                <li key={session.id}>
                  {player?.name}: Vmax {session.max_speed_ms ? `${(session.max_speed_ms * 3.6).toFixed(1)} km/h` : "-"}
                  {session.accelerations ? `, ${session.accelerations} acc` : ""}
                </li>
              );
            })}
            {existingGpsSessions.length > 5 && (
              <li>+ {existingGpsSessions.length - 5} autres...</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
