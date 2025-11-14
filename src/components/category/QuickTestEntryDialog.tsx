import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface QuickTestEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  sessionDate: string;
}

export function QuickTestEntryDialog({
  open,
  onOpenChange,
  categoryId,
  sessionDate,
}: QuickTestEntryDialogProps) {
  const queryClient = useQueryClient();
  const [testResults, setTestResults] = useState<Record<string, any>>({});

  const { data: players } = useQuery({
    queryKey: ["players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: existingTests } = useQuery({
    queryKey: ["existing_tests", categoryId, sessionDate],
    queryFn: async () => {
      const [speedTests, strengthTests] = await Promise.all([
        supabase
          .from("speed_tests")
          .select("*")
          .eq("category_id", categoryId)
          .eq("test_date", sessionDate),
        supabase
          .from("strength_tests")
          .select("*")
          .eq("category_id", categoryId)
          .eq("test_date", sessionDate),
      ]);
      return {
        speedTests: speedTests.data || [],
        strengthTests: strengthTests.data || [],
      };
    },
    enabled: open,
  });

  const saveSpeedTests = useMutation({
    mutationFn: async (data: { testType: "40m_sprint" | "1600m_run" }) => {
      const entries = players
        ?.filter((p) => testResults[`speed_${data.testType}_${p.id}`])
        .map((p) => {
          const result = testResults[`speed_${data.testType}_${p.id}`];
          if (data.testType === "40m_sprint") {
            return {
              player_id: p.id,
              category_id: categoryId,
              test_date: sessionDate,
              test_type: "40m_sprint",
              time_40m_seconds: parseFloat(result.time),
              speed_ms: result.time ? 40 / parseFloat(result.time) : null,
              speed_kmh: result.time ? (40 / parseFloat(result.time)) * 3.6 : null,
            };
          } else {
            return {
              player_id: p.id,
              category_id: categoryId,
              test_date: sessionDate,
              test_type: "1600m_run",
              time_1600m_minutes: parseInt(result.minutes),
              time_1600m_seconds: parseInt(result.seconds),
              vma_kmh: result.minutes && result.seconds
                ? (1600 / 60 / (parseInt(result.minutes) + parseInt(result.seconds) / 60)) * 3.6
                : null,
            };
          }
        });

      if (!entries || entries.length === 0) {
        throw new Error("Aucun résultat à enregistrer");
      }

      const { error } = await supabase.from("speed_tests").insert(entries);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["speed_tests"] });
      toast.success("Résultats de vitesse enregistrés");
      setTestResults({});
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de l'enregistrement");
    },
  });

  const saveStrengthTests = useMutation({
    mutationFn: async (data: { testName: string }) => {
      const entries = players
        ?.filter((p) => testResults[`strength_${data.testName}_${p.id}`])
        .map((p) => ({
          player_id: p.id,
          category_id: categoryId,
          test_date: sessionDate,
          test_name: data.testName,
          weight_kg: parseFloat(testResults[`strength_${data.testName}_${p.id}`]),
        }));

      if (!entries || entries.length === 0) {
        throw new Error("Aucun résultat à enregistrer");
      }

      const { error } = await supabase.from("strength_tests").insert(entries);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strength_tests"] });
      toast.success("Résultats de musculation enregistrés");
      setTestResults({});
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de l'enregistrement");
    },
  });

  const handleSpeedResultChange = (
    playerId: string,
    testType: string,
    field: string,
    value: string
  ) => {
    setTestResults((prev) => ({
      ...prev,
      [`speed_${testType}_${playerId}`]: {
        ...prev[`speed_${testType}_${playerId}`],
        [field]: value,
      },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Saisie des tests - {format(new Date(sessionDate), "PPP", { locale: fr })}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="sprint" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sprint">Sprint 40m</TabsTrigger>
            <TabsTrigger value="endurance">1600m</TabsTrigger>
            <TabsTrigger value="strength">Musculation</TabsTrigger>
          </TabsList>

          <TabsContent value="sprint" className="space-y-4">
            <div className="space-y-3">
              {players?.map((player) => {
                const existing = existingTests?.speedTests.find(
                  (t) => t.player_id === player.id && t.test_type === "40m_sprint"
                );
                return (
                  <div key={player.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Label className="w-40 font-medium">{player.name}</Label>
                    {existing ? (
                      <span className="text-sm text-muted-foreground">
                        Déjà testé: {existing.time_40m_seconds}s
                      </span>
                    ) : (
                      <>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Temps (s)"
                          className="w-32"
                          value={testResults[`speed_40m_sprint_${player.id}`]?.time || ""}
                          onChange={(e) =>
                            handleSpeedResultChange(player.id, "40m_sprint", "time", e.target.value)
                          }
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <Button
              onClick={() => saveSpeedTests.mutate({ testType: "40m_sprint" })}
              disabled={saveSpeedTests.isPending}
            >
              Enregistrer les résultats
            </Button>
          </TabsContent>

          <TabsContent value="endurance" className="space-y-4">
            <div className="space-y-3">
              {players?.map((player) => {
                const existing = existingTests?.speedTests.find(
                  (t) => t.player_id === player.id && t.test_type === "1600m_run"
                );
                return (
                  <div key={player.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Label className="w-40 font-medium">{player.name}</Label>
                    {existing ? (
                      <span className="text-sm text-muted-foreground">
                        Déjà testé: {existing.time_1600m_minutes}'{existing.time_1600m_seconds}"
                      </span>
                    ) : (
                      <>
                        <Input
                          type="number"
                          placeholder="Min"
                          className="w-20"
                          value={testResults[`speed_1600m_run_${player.id}`]?.minutes || ""}
                          onChange={(e) =>
                            handleSpeedResultChange(player.id, "1600m_run", "minutes", e.target.value)
                          }
                        />
                        <Input
                          type="number"
                          placeholder="Sec"
                          className="w-20"
                          value={testResults[`speed_1600m_run_${player.id}`]?.seconds || ""}
                          onChange={(e) =>
                            handleSpeedResultChange(player.id, "1600m_run", "seconds", e.target.value)
                          }
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <Button
              onClick={() => saveSpeedTests.mutate({ testType: "1600m_run" })}
              disabled={saveSpeedTests.isPending}
            >
              Enregistrer les résultats
            </Button>
          </TabsContent>

          <TabsContent value="strength" className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Nom du test (ex: Développé Couché)</Label>
              <Input
                placeholder="Nom du test"
                value={testResults.strengthTestName || ""}
                onChange={(e) =>
                  setTestResults((prev) => ({ ...prev, strengthTestName: e.target.value }))
                }
              />
            </div>
            <div className="space-y-3">
              {players?.map((player) => {
                const existing = existingTests?.strengthTests.find(
                  (t) =>
                    t.player_id === player.id &&
                    t.test_name === testResults.strengthTestName
                );
                return (
                  <div key={player.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Label className="w-40 font-medium">{player.name}</Label>
                    {existing ? (
                      <span className="text-sm text-muted-foreground">
                        Déjà testé: {existing.weight_kg}kg
                      </span>
                    ) : (
                      <Input
                        type="number"
                        step="0.5"
                        placeholder="Poids (kg)"
                        className="w-32"
                        value={
                          testResults[`strength_${testResults.strengthTestName}_${player.id}`] || ""
                        }
                        onChange={(e) =>
                          setTestResults((prev) => ({
                            ...prev,
                            [`strength_${testResults.strengthTestName}_${player.id}`]: e.target.value,
                          }))
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <Button
              onClick={() =>
                saveStrengthTests.mutate({ testName: testResults.strengthTestName })
              }
              disabled={saveStrengthTests.isPending || !testResults.strengthTestName}
            >
              Enregistrer les résultats
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
