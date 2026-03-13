import { useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Heart, Loader2, Save } from "lucide-react";
import { HrvInputSection, emptyHrvData, type HrvData } from "./HrvInputSection";

interface HrvEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  defaultDate?: string;
  defaultType?: "session" | "test" | "competition" | "morning";
  defaultPlayerId?: string;
  trainingSessionId?: string;
  matchId?: string;
}

export function HrvEntryDialog({
  open,
  onOpenChange,
  categoryId,
  defaultDate,
  defaultType = "session",
  defaultPlayerId,
  trainingSessionId,
  matchId,
}: HrvEntryDialogProps) {
  const queryClient = useQueryClient();
  const [selectedPlayerId, setSelectedPlayerId] = useState(defaultPlayerId || "");
  const [recordDate, setRecordDate] = useState(defaultDate || new Date().toISOString().split("T")[0]);
  const [recordType, setRecordType] = useState(defaultType);
  const [hrvData, setHrvData] = useState<HrvData>(emptyHrvData);

  const { data: players } = useQuery({
    queryKey: ["players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPlayerId) throw new Error("Veuillez sélectionner un athlète");

      const hasData = Object.values(hrvData).some((v) => v !== "");
      if (!hasData) throw new Error("Veuillez saisir au moins une valeur");

      const { error } = await supabase.from("hrv_records").insert({
        player_id: selectedPlayerId,
        category_id: categoryId,
        record_date: recordDate,
        record_type: recordType,
        hrv_ms: hrvData.hrv_ms ? parseFloat(hrvData.hrv_ms) : null,
        resting_hr_bpm: hrvData.resting_hr_bpm ? parseFloat(hrvData.resting_hr_bpm) : null,
        avg_hr_bpm: hrvData.avg_hr_bpm ? parseFloat(hrvData.avg_hr_bpm) : null,
        max_hr_bpm: hrvData.max_hr_bpm ? parseFloat(hrvData.max_hr_bpm) : null,
        zone1_minutes: hrvData.zone1_minutes ? parseFloat(hrvData.zone1_minutes) : null,
        zone2_minutes: hrvData.zone2_minutes ? parseFloat(hrvData.zone2_minutes) : null,
        zone3_minutes: hrvData.zone3_minutes ? parseFloat(hrvData.zone3_minutes) : null,
        zone4_minutes: hrvData.zone4_minutes ? parseFloat(hrvData.zone4_minutes) : null,
        zone5_minutes: hrvData.zone5_minutes ? parseFloat(hrvData.zone5_minutes) : null,
        training_session_id: trainingSessionId || null,
        match_id: matchId || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hrv_records", categoryId] });
      toast.success("Données HRV enregistrées !");
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de l'enregistrement");
    },
  });

  const resetForm = () => {
    setHrvData(emptyHrvData);
    if (!defaultPlayerId) setSelectedPlayerId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-destructive" />
            Saisie HRV & Zones cardiaques
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-4 py-2">
            {/* Player selection */}
            {!defaultPlayerId && (
              <div className="space-y-2">
                <Label>Athlète *</Label>
                <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Sélectionner un athlète" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50 max-h-[300px]">
                    {players?.map((player) => (
                      <SelectItem key={player.id} value={player.id}>
                        {player.first_name ? `${player.first_name} ${player.name}` : player.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date & Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Contexte</Label>
                <Select value={recordType} onValueChange={(v) => setRecordType(v as any)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    <SelectItem value="morning">Matin (repos)</SelectItem>
                    <SelectItem value="session">Séance</SelectItem>
                    <SelectItem value="test">Test</SelectItem>
                    <SelectItem value="competition">Compétition</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* HRV Input Section */}
            <HrvInputSection data={hrvData} onChange={setHrvData} />
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!selectedPlayerId || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Enregistrer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
