import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { toast } from "sonner";
import { Stopwatch } from "./Stopwatch";
import { Textarea } from "@/components/ui/textarea";

interface Player {
  id: string;
  name: string;
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
  { value: "60m_sprint", label: "Sprint 60m", distance: 60 },
  { value: "100m_sprint", label: "Sprint 100m", distance: 100 },
  { value: "cooper_test", label: "Test de Cooper (12 min)", distance: null },
  { value: "beep_test", label: "Test Navette (Beep Test)", distance: null },
  { value: "yo_yo_test", label: "Yo-Yo Test", distance: null },
  { value: "custom", label: "Test personnalisé", distance: null },
];

export function AddRunningTestDialog({
  open,
  onOpenChange,
  categoryId,
  players,
}: AddRunningTestDialogProps) {
  const [playerId, setPlayerId] = useState("");
  const [date, setDate] = useState("");
  const [testType, setTestType] = useState("");
  const [timeSeconds, setTimeSeconds] = useState("");
  const [distanceMeters, setDistanceMeters] = useState("");
  const [level, setLevel] = useState("");
  const [notes, setNotes] = useState("");
  const [inputMode, setInputMode] = useState<"manual" | "stopwatch">("manual");
  const queryClient = useQueryClient();

  const selectedTest = TEST_TYPES.find((t) => t.value === testType);
  const isSprintTest = testType.includes("sprint");
  const isCustomTest = testType === "custom";
  const isLevelTest = testType === "beep_test" || testType === "yo_yo_test";
  const isCooperTest = testType === "cooper_test";

  const addTest = useMutation({
    mutationFn: async () => {
      let speedMs = null;
      let speedKmh = null;
      let vmaKmh = null;

      if (isSprintTest && selectedTest?.distance) {
        const time = parseFloat(timeSeconds);
        speedMs = selectedTest.distance / time;
        speedKmh = speedMs * 3.6;
      }

      if (isCooperTest && distanceMeters) {
        // VMA estimation from Cooper test: VMA = (distance / 1000) / 12 * 60 * 1.1
        const dist = parseFloat(distanceMeters);
        vmaKmh = (dist / 1000 / 12) * 60;
      }

      const { error } = await supabase.from("speed_tests").insert({
        player_id: playerId,
        category_id: categoryId,
        test_date: date,
        test_type: testType,
        time_40m_seconds: isSprintTest ? parseFloat(timeSeconds) : null,
        speed_ms: speedMs,
        speed_kmh: speedKmh,
        vma_kmh: vmaKmh,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["speed_tests", categoryId] });
      toast.success("Test ajouté avec succès");
      resetForm();
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Erreur lors de l'ajout du test");
    },
  });

  const resetForm = () => {
    setPlayerId("");
    setDate("");
    setTestType("");
    setTimeSeconds("");
    setDistanceMeters("");
    setLevel("");
    setNotes("");
  };

  const handleStopwatchTime = (time: number) => {
    setTimeSeconds(time.toFixed(2));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un test de course</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Joueur</Label>
            <Select value={playerId} onValueChange={setPlayerId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un joueur" />
              </SelectTrigger>
              <SelectContent>
                {players.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    {player.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Type de test</Label>
            <Select value={testType} onValueChange={setTestType}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un type de test" />
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
            <Label>Date du test</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {isSprintTest && (
            <>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={inputMode === "manual" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setInputMode("manual")}
                >
                  Saisie manuelle
                </Button>
                <Button
                  type="button"
                  variant={inputMode === "stopwatch" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setInputMode("stopwatch")}
                >
                  Chronomètre
                </Button>
              </div>

              {inputMode === "manual" ? (
                <div className="space-y-2">
                  <Label>Temps (secondes)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 5.45"
                    value={timeSeconds}
                    onChange={(e) => setTimeSeconds(e.target.value)}
                  />
                </div>
              ) : (
                <Stopwatch onTimeRecorded={handleStopwatchTime} />
              )}

              {timeSeconds && selectedTest?.distance && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p>Vitesse: {(selectedTest.distance / parseFloat(timeSeconds)).toFixed(2)} m/s</p>
                  <p>Vitesse: {((selectedTest.distance / parseFloat(timeSeconds)) * 3.6).toFixed(2)} km/h</p>
                </div>
              )}
            </>
          )}

          {isCooperTest && (
            <div className="space-y-2">
              <Label>Distance parcourue (mètres)</Label>
              <Input
                type="number"
                placeholder="Ex: 2800"
                value={distanceMeters}
                onChange={(e) => setDistanceMeters(e.target.value)}
              />
              {distanceMeters && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p>VMA estimée: {((parseFloat(distanceMeters) / 1000 / 12) * 60).toFixed(1)} km/h</p>
                </div>
              )}
            </div>
          )}

          {isLevelTest && (
            <div className="space-y-2">
              <Label>Palier atteint</Label>
              <Input
                type="text"
                placeholder="Ex: 12.5"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
              />
            </div>
          )}

          {isCustomTest && (
            <div className="space-y-2">
              <Label>Notes / Description du test</Label>
              <Textarea
                placeholder="Décrivez le test personnalisé..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          )}

          <Button
            onClick={() => addTest.mutate()}
            disabled={!playerId || !testType || !date || addTest.isPending}
            className="w-full"
          >
            Ajouter le test
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
