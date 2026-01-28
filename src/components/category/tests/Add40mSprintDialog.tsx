import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Stopwatch } from "./Stopwatch";
import { PlayerSelection } from "./PlayerSelection";
import { GpsDataSelector } from "./GpsDataSelector";
import { useBulkCreatePerformanceReferences, type CreateReferenceInput } from "@/hooks/use-performance-references";

interface GpsSession {
  id: string;
  player_id: string;
  max_speed_ms: number | null;
  accelerations: number | null;
  decelerations: number | null;
  sprint_distance_m: number | null;
  player_load: number | null;
  duration_minutes: number | null;
  high_speed_distance_m: number | null;
}

interface Add40mSprintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  players: Array<{ id: string; name: string }>;
}

export function Add40mSprintDialog({
  open,
  onOpenChange,
  categoryId,
  players,
}: Add40mSprintDialogProps) {
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState<"all" | "specific">("all");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [playerResults, setPlayerResults] = useState<Record<string, string>>({});
  const [inputMode, setInputMode] = useState<"manual" | "stopwatch">("manual");
  const [currentStopwatchPlayer, setCurrentStopwatchPlayer] = useState<string | null>(null);
  const [gpsData, setGpsData] = useState<Map<string, GpsSession>>(new Map());
  const [setAsReference, setSetAsReference] = useState(true);
  const queryClient = useQueryClient();
  
  const createReferences = useBulkCreatePerformanceReferences();

  const effectivePlayers = selectionMode === "all" ? players : players.filter(p => selectedPlayers.includes(p.id));

  const addTest = useMutation({
    mutationFn: async () => {
      const inserts = effectivePlayers
        .filter(player => playerResults[player.id])
        .map(player => {
          const time = parseFloat(playerResults[player.id]);
          const speedMs = 40 / time;
          const speedKmh = speedMs * 3.6;

          // Get GPS data if available
          const playerGps = gpsData.get(player.id);

          return {
            player_id: player.id,
            category_id: categoryId,
            test_date: date,
            test_type: "40m_sprint",
            time_40m_seconds: time,
            speed_ms: playerGps?.max_speed_ms || speedMs,
            speed_kmh: playerGps?.max_speed_ms ? playerGps.max_speed_ms * 3.6 : speedKmh,
          };
        });

      if (inserts.length === 0) {
        throw new Error("Aucun résultat saisi");
      }

      const { data: testResults, error } = await supabase
        .from("speed_tests")
        .insert(inserts)
        .select();
      
      if (error) throw error;
      
      return testResults;
    },
    onSuccess: async (testResults) => {
      // Create performance references if requested
      if (setAsReference && testResults) {
        const references: CreateReferenceInput[] = testResults.map(test => {
          const playerGps = gpsData.get(test.player_id);
          const durationMin = playerGps?.duration_minutes || 1;
          
          return {
            player_id: test.player_id,
            category_id: categoryId,
            test_date: date,
            source_type: playerGps ? "gps_session" : "speed_test",
            source_id: test.id,
            ref_vmax_ms: playerGps?.max_speed_ms || test.speed_ms,
            ref_vmax_kmh: playerGps?.max_speed_ms ? playerGps.max_speed_ms * 3.6 : test.speed_kmh,
            ref_acceleration_max: playerGps?.accelerations || null,
            ref_deceleration_max: playerGps?.decelerations || null,
            ref_sprint_distance_m: playerGps?.sprint_distance_m || null,
            ref_time_40m_seconds: test.time_40m_seconds,
            ref_player_load_per_min: playerGps?.player_load && durationMin > 0 
              ? playerGps.player_load / durationMin 
              : null,
            ref_high_intensity_distance_per_min: playerGps?.high_speed_distance_m && durationMin > 0
              ? playerGps.high_speed_distance_m / durationMin
              : null,
            notes: `Test 40m du ${date}${playerGps ? " avec données GPS" : ""}`,
          };
        });

        await createReferences.mutateAsync(references);
        toast.success(`${testResults.length} test(s) ajouté(s) et références mises à jour`);
      } else {
        toast.success("Tests 40m ajoutés avec succès");
      }
      
      queryClient.invalidateQueries({ queryKey: ["speed_tests", categoryId, "40m_sprint"] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erreur lors de l'ajout du test");
    },
  });

  const resetForm = () => {
    setSelectedPlayers([]);
    setSelectionMode("all");
    setDate(new Date().toISOString().split("T")[0]);
    setPlayerResults({});
    setGpsData(new Map());
    setSetAsReference(true);
  };

  const updatePlayerResult = (playerId: string, value: string) => {
    setPlayerResults(prev => ({ ...prev, [playerId]: value }));
  };

  const handleStopwatchRecord = (seconds: number) => {
    if (currentStopwatchPlayer) {
      updatePlayerResult(currentStopwatchPlayer, seconds.toFixed(2));
      toast.success(`Temps enregistré: ${seconds.toFixed(2)}s`);
      
      const currentIndex = effectivePlayers.findIndex(p => p.id === currentStopwatchPlayer);
      if (currentIndex < effectivePlayers.length - 1) {
        setCurrentStopwatchPlayer(effectivePlayers[currentIndex + 1].id);
      } else {
        setCurrentStopwatchPlayer(null);
        setInputMode("manual");
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTest.mutate();
  };

  const filledResultsCount = effectivePlayers.filter(p => playerResults[p.id]).length;
  const hasGpsData = gpsData.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Test 40m Sprint</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              <PlayerSelection
                categoryId={categoryId}
                selectedPlayers={selectedPlayers}
                onSelectionChange={setSelectedPlayers}
                selectionMode={selectionMode}
                onSelectionModeChange={setSelectionMode}
                players={players}
              />

              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              {/* GPS Data Selector */}
              <GpsDataSelector
                categoryId={categoryId}
                date={date}
                players={effectivePlayers}
                onGpsDataSelected={setGpsData}
              />

              {/* Reference checkbox */}
              <div className="flex items-center space-x-2 p-3 border rounded-lg bg-primary/5">
                <Checkbox
                  id="set-reference"
                  checked={setAsReference}
                  onCheckedChange={(checked) => setSetAsReference(checked === true)}
                />
                <Label htmlFor="set-reference" className="text-sm cursor-pointer">
                  <span className="font-medium">Définir comme référence de performance</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Les résultats de ce test{hasGpsData && " et les données GPS"} deviendront les références pour calculer les % en match
                  </p>
                </Label>
              </div>

              <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "manual" | "stopwatch")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual">Saisie manuelle</TabsTrigger>
                  <TabsTrigger value="stopwatch">Chronomètre</TabsTrigger>
                </TabsList>
                
                <TabsContent value="manual" className="space-y-2">
                  {effectivePlayers.length > 0 && (
                    <div className="space-y-2">
                      <Label>Temps (secondes) - {filledResultsCount}/{effectivePlayers.length} saisis</Label>
                      <div className="grid grid-cols-2 gap-2 p-3 border rounded-md bg-muted/30">
                        {effectivePlayers.map((player) => {
                          const time = playerResults[player.id];
                          const playerGps = gpsData.get(player.id);
                          const displaySpeed = playerGps?.max_speed_ms 
                            ? (playerGps.max_speed_ms * 3.6).toFixed(1)
                            : time ? ((40 / parseFloat(time)) * 3.6).toFixed(2) : null;

                          return (
                            <div key={player.id} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm flex-1 truncate">{player.name}</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={time || ""}
                                  onChange={(e) => updatePlayerResult(player.id, e.target.value)}
                                  placeholder="sec"
                                  className="w-20 h-8 text-sm"
                                />
                              </div>
                              <div className="flex items-center gap-1 pl-1">
                                {displaySpeed && (
                                  <p className="text-xs text-muted-foreground">
                                    {displaySpeed} km/h
                                  </p>
                                )}
                                {playerGps && (
                                  <span className="text-xs text-primary font-medium">(GPS)</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="stopwatch" className="space-y-4">
                  {effectivePlayers.length > 0 && (
                    <>
                      <div className="space-y-2">
                        <Label>Joueur en cours</Label>
                        <div className="flex flex-wrap gap-2">
                          {effectivePlayers.map((player) => (
                            <Button
                              key={player.id}
                              type="button"
                              variant={currentStopwatchPlayer === player.id ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentStopwatchPlayer(player.id)}
                              className={playerResults[player.id] ? "border-primary" : ""}
                            >
                              {player.name}
                              {playerResults[player.id] && ` (${playerResults[player.id]}s)`}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {currentStopwatchPlayer && (
                        <Stopwatch 
                          onTimeRecorded={handleStopwatchRecord}
                          title={`Chronomètre - ${effectivePlayers.find(p => p.id === currentStopwatchPlayer)?.name}`}
                        />
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={filledResultsCount === 0 || addTest.isPending || createReferences.isPending}
            >
              {(addTest.isPending || createReferences.isPending) 
                ? "Ajout..." 
                : `Ajouter ${filledResultsCount} test${filledResultsCount > 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
