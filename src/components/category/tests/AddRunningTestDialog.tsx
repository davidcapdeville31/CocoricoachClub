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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PlayerSelection } from "./PlayerSelection";
import { GpsDataSelector } from "./GpsDataSelector";
import { useBulkCreatePerformanceReferences, type CreateReferenceInput } from "@/hooks/use-performance-references";
import { Satellite } from "lucide-react";

interface Player {
  id: string;
  name: string;
}

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

interface AddRunningTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  players: Player[];
}

const TEST_TYPES = [
  { value: "10m_sprint", label: "Sprint 10m", distance: 10 },
  { value: "20m_sprint", label: "Sprint 20m", distance: 20 },
  { value: "30m_sprint", label: "Sprint 30m", distance: 30 },
  { value: "40m_sprint", label: "Sprint 40m", distance: 40 },
  { value: "60m_sprint", label: "Sprint 60m", distance: 60 },
  { value: "100m_sprint", label: "Sprint 100m", distance: 100 },
  { value: "cooper_test", label: "Test de Cooper (12 min)", distance: null },
  { value: "beep_test", label: "Test Navette (Beep Test)", distance: null },
  { value: "yo_yo_test", label: "Yo-Yo Test", distance: null },
];

export function AddRunningTestDialog({
  open,
  onOpenChange,
  categoryId,
  players,
}: AddRunningTestDialogProps) {
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState<"all" | "specific">("all");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [testType, setTestType] = useState("");
  const [playerResults, setPlayerResults] = useState<Record<string, string>>({});
  const [gpsData, setGpsData] = useState<Map<string, GpsSession>>(new Map());
  const [setAsReference, setSetAsReference] = useState(true);
  const queryClient = useQueryClient();
  const createReferences = useBulkCreatePerformanceReferences();

  const effectivePlayers = selectionMode === "all" ? players : players.filter(p => selectedPlayers.includes(p.id));

  const selectedTest = TEST_TYPES.find((t) => t.value === testType);
  const isSprintTest = testType.includes("sprint");
  const isCooperTest = testType === "cooper_test";
  const isLevelTest = testType === "beep_test" || testType === "yo_yo_test";

  const addTest = useMutation({
    mutationFn: async () => {
      const inserts = effectivePlayers
        .filter(player => playerResults[player.id])
        .map(player => {
          let speedMs = null;
          let speedKmh = null;
          let vmaKmh = null;

          const value = parseFloat(playerResults[player.id]);
          const playerGps = gpsData.get(player.id);

          if (isSprintTest && selectedTest?.distance) {
            // Use GPS Vmax if available, otherwise calculate from time
            speedMs = playerGps?.max_speed_ms || (selectedTest.distance / value);
            speedKmh = speedMs * 3.6;
          }

          if (isCooperTest) {
            vmaKmh = (value / 1000 / 12) * 60;
          }

          return {
            player_id: player.id,
            category_id: categoryId,
            test_date: date,
            test_type: testType,
            time_40m_seconds: isSprintTest ? value : null,
            speed_ms: speedMs,
            speed_kmh: speedKmh,
            vma_kmh: vmaKmh,
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
      // Create performance references for sprint tests if requested
      if (setAsReference && isSprintTest && testResults) {
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
            ref_time_40m_seconds: isSprintTest ? test.time_40m_seconds : null,
            ref_player_load_per_min: playerGps?.player_load && durationMin > 0 
              ? playerGps.player_load / durationMin 
              : null,
            ref_high_intensity_distance_per_min: playerGps?.high_speed_distance_m && durationMin > 0
              ? playerGps.high_speed_distance_m / durationMin
              : null,
            notes: `Test ${selectedTest?.label} du ${date}${playerGps ? " avec données GPS" : ""}`,
          };
        });

        await createReferences.mutateAsync(references);
        toast.success(`${testResults.length} test(s) ajouté(s) et références mises à jour`);
      } else {
        toast.success("Tests ajoutés avec succès");
      }
      
      queryClient.invalidateQueries({ queryKey: ["speed_tests", categoryId] });
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
    setTestType("");
    setPlayerResults({});
    setGpsData(new Map());
    setSetAsReference(true);
  };

  const updatePlayerResult = (playerId: string, value: string) => {
    setPlayerResults(prev => ({ ...prev, [playerId]: value }));
  };

  const getPlaceholder = () => {
    if (isSprintTest) return "sec";
    if (isCooperTest) return "m";
    if (isLevelTest) return "palier";
    return "";
  };

  const getLabel = () => {
    if (isSprintTest) return "Temps (secondes)";
    if (isCooperTest) return "Distance (mètres)";
    if (isLevelTest) return "Palier atteint";
    return "Résultat";
  };

  const filledResultsCount = effectivePlayers.filter(p => playerResults[p.id]).length;
  const hasGpsData = gpsData.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Ajouter un test de course</DialogTitle>
        </DialogHeader>

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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type de test *</Label>
                <Select value={testType} onValueChange={setTestType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEST_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date du test *</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            {/* GPS Data Selector - only for sprint tests */}
            {isSprintTest && (
              <GpsDataSelector
                categoryId={categoryId}
                date={date}
                players={effectivePlayers}
                onGpsDataSelected={setGpsData}
              />
            )}

            {/* Reference checkbox - only for sprint tests */}
            {isSprintTest && (
              <div className="flex items-center space-x-2 p-3 border rounded-lg bg-primary/5">
                <Checkbox
                  id="set-reference"
                  checked={setAsReference}
                  onCheckedChange={(checked) => setSetAsReference(checked === true)}
                />
                <Label htmlFor="set-reference" className="text-sm cursor-pointer">
                  <span className="font-medium">Définir comme référence de performance</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Vmax{hasGpsData && ", accélérations, charge GPS"} deviendront les références pour les % en match
                  </p>
                </Label>
              </div>
            )}

            {effectivePlayers.length > 0 && testType && (
              <div className="space-y-2">
                <Label>{getLabel()} - {filledResultsCount}/{effectivePlayers.length} saisis</Label>
                <div className="grid grid-cols-2 gap-2 p-3 border rounded-md bg-muted/30">
                  {effectivePlayers.map((player) => {
                    const value = playerResults[player.id];
                    const playerGps = gpsData.get(player.id);
                    let extraInfo = null;

                    if (value && isSprintTest && selectedTest?.distance) {
                      const speedKmh = playerGps?.max_speed_ms 
                        ? (playerGps.max_speed_ms * 3.6).toFixed(1)
                        : ((selectedTest.distance / parseFloat(value)) * 3.6).toFixed(2);
                      extraInfo = `${speedKmh} km/h`;
                    }
                    if (value && isCooperTest) {
                      const vma = ((parseFloat(value) / 1000 / 12) * 60).toFixed(1);
                      extraInfo = `VMA: ${vma} km/h`;
                    }

                    return (
                      <div key={player.id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm flex-1 truncate">{player.name}</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={value || ""}
                            onChange={(e) => updatePlayerResult(player.id, e.target.value)}
                            placeholder={getPlaceholder()}
                            className="w-20 h-8 text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-1 pl-1">
                          {extraInfo && (
                            <p className="text-xs text-muted-foreground">{extraInfo}</p>
                          )}
                          {playerGps && (
                            <Badge variant="outline" className="text-xs h-4 px-1">
                              <Satellite className="h-2.5 w-2.5 mr-1" />
                              GPS
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={() => addTest.mutate()}
            disabled={!testType || !date || filledResultsCount === 0 || addTest.isPending || createReferences.isPending}
          >
            {(addTest.isPending || createReferences.isPending) 
              ? "Ajout..." 
              : `Ajouter ${filledResultsCount} test${filledResultsCount > 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
