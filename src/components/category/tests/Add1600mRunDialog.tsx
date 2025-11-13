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

interface Add1600mRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  players: Array<{ id: string; name: string }>;
}

export function Add1600mRunDialog({
  open,
  onOpenChange,
  categoryId,
  players,
}: Add1600mRunDialogProps) {
  const [playerId, setPlayerId] = useState("");
  const [date, setDate] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const queryClient = useQueryClient();

  const calculateVMA = (mins: number, secs: number) => {
    const totalSeconds = mins * 60 + secs;
    const totalHours = totalSeconds / 3600;
    const vmaKmh = 1.6 / totalHours;
    return vmaKmh;
  };

  const addTest = useMutation({
    mutationFn: async () => {
      const mins = parseInt(minutes);
      const secs = parseInt(seconds);
      const vmaKmh = calculateVMA(mins, secs);
      const totalSeconds = mins * 60 + secs;

      const { error } = await supabase.from("speed_tests").insert({
        player_id: playerId,
        category_id: categoryId,
        test_date: date,
        test_type: "1600m_run",
        time_1600m_minutes: mins,
        time_1600m_seconds: secs,
        vma_kmh: vmaKmh,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["speed_tests", categoryId, "1600m_run"] });
      toast.success("Test 1600m ajouté avec succès");
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
    setMinutes("");
    setSeconds("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerId && date && minutes && seconds) {
      addTest.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test 1600m Run</DialogTitle>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minutes">Minutes *</Label>
                <Input
                  id="minutes"
                  type="number"
                  min="0"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="Ex: 6"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seconds">Secondes *</Label>
                <Input
                  id="seconds"
                  type="number"
                  min="0"
                  max="59"
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value)}
                  placeholder="Ex: 30"
                  required
                />
              </div>
            </div>

            {minutes && seconds && (
              <p className="text-sm text-muted-foreground">
                VMA: {calculateVMA(parseInt(minutes), parseInt(seconds)).toFixed(2)} km/h
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!playerId || !date || !minutes || !seconds || addTest.isPending}
            >
              {addTest.isPending ? "Ajout..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
