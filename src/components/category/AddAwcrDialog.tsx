import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

interface AddAwcrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
}

export function AddAwcrDialog({
  open,
  onOpenChange,
  categoryId,
}: AddAwcrDialogProps) {
  const [playerId, setPlayerId] = useState("");
  const [date, setDate] = useState("");
  const [rpe, setRpe] = useState("");
  const [duration, setDuration] = useState("");
  const queryClient = useQueryClient();

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

  const calculateAWCR = async (playerId: string, sessionDate: string) => {
    const sevenDaysAgo = new Date(sessionDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const twentyEightDaysAgo = new Date(sessionDate);
    twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);

    const { data: recentSessions } = await supabase
      .from("awcr_tracking")
      .select("training_load")
      .eq("player_id", playerId)
      .gte("session_date", sevenDaysAgo.toISOString().split("T")[0])
      .lt("session_date", sessionDate);

    const { data: chronicSessions } = await supabase
      .from("awcr_tracking")
      .select("training_load")
      .eq("player_id", playerId)
      .gte("session_date", twentyEightDaysAgo.toISOString().split("T")[0])
      .lt("session_date", sessionDate);

    const acuteLoad = recentSessions?.reduce((sum, s) => sum + s.training_load, 0) || 0;
    const chronicLoad = chronicSessions?.reduce((sum, s) => sum + s.training_load, 0) || 0;

    const acuteAvg = recentSessions && recentSessions.length > 0 ? acuteLoad / 7 : 0;
    const chronicAvg = chronicSessions && chronicSessions.length > 0 ? chronicLoad / 28 : 0;

    const awcr = chronicAvg > 0 ? acuteAvg / chronicAvg : 0;

    return { acuteLoad: acuteAvg, chronicLoad: chronicAvg, awcr };
  };

  const addEntry = useMutation({
    mutationFn: async () => {
      const { acuteLoad, chronicLoad, awcr } = await calculateAWCR(playerId, date);

      const { error } = await supabase.from("awcr_tracking").insert({
        player_id: playerId,
        category_id: categoryId,
        session_date: date,
        rpe: parseInt(rpe),
        duration_minutes: parseInt(duration),
        acute_load: acuteLoad,
        chronic_load: chronicLoad,
        awcr: awcr,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["awcr_tracking", categoryId] });
      toast.success("Entrée AWCR ajoutée avec succès");
      resetForm();
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Erreur lors de l'ajout de l'entrée");
    },
  });

  const resetForm = () => {
    setPlayerId("");
    setDate("");
    setRpe("");
    setDuration("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerId && date && rpe && duration) {
      addEntry.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une entrée AWCR</DialogTitle>
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
                  {players?.map((player) => (
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
              <Label htmlFor="rpe">RPE (0-10) *</Label>
              <Input
                id="rpe"
                type="number"
                min="0"
                max="10"
                value={rpe}
                onChange={(e) => setRpe(e.target.value)}
                placeholder="Rating of Perceived Exertion"
                required
              />
              <p className="text-xs text-muted-foreground">
                0 = Repos, 10 = Effort maximal
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Durée (minutes) *</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Durée de la séance"
                required
              />
            </div>

            {rpe && duration && (
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-sm">
                  <strong>Charge d'entraînement:</strong>{" "}
                  {parseInt(rpe) * parseInt(duration)}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!playerId || !date || !rpe || !duration || addEntry.isPending}
            >
              {addEntry.isPending ? "Calcul..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
