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
import { toast } from "sonner";

interface AddStrengthTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  players: Array<{ id: string; name: string }>;
}

export function AddStrengthTestDialog({
  open,
  onOpenChange,
  categoryId,
  players,
}: AddStrengthTestDialogProps) {
  const [playerId, setPlayerId] = useState("");
  const [date, setDate] = useState("");
  const [testName, setTestName] = useState("");
  const [weight, setWeight] = useState("");
  const queryClient = useQueryClient();

  const addTest = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("strength_tests").insert({
        player_id: playerId,
        category_id: categoryId,
        test_date: date,
        test_name: testName,
        weight_kg: parseFloat(weight),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strength_tests", categoryId] });
      toast.success("Test de musculation ajouté avec succès");
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
    setTestName("");
    setWeight("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerId && date && testName && weight) {
      addTest.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test de Musculation</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="player">Joueur *</Label>
              <Select value={playerId} onValueChange={setPlayerId} required>
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
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="testName">Nom de l'exercice *</Label>
              <Input
                id="testName"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="Ex: Bench Press, Squat, Deadlift"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weight">Poids (kg) *</Label>
              <Input
                id="weight"
                type="number"
                step="0.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="Ex: 80"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!playerId || !date || !testName || !weight || addTest.isPending}
            >
              {addTest.isPending ? "Ajout..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
