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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface AddIllnessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  playerId?: string;
}

const COMMON_ILLNESSES = [
  "Grippe",
  "Gastro-entérite",
  "COVID-19",
  "Angine",
  "Rhinopharyngite",
  "Bronchite",
  "Sinusite",
  "Otite",
  "Fièvre",
  "Fatigue / surmenage",
  "Migraine",
  "Allergie",
  "Mononucléose",
  "Autre",
];

const SEVERITY = [
  { value: "légère", label: "Légère" },
  { value: "modérée", label: "Modérée" },
  { value: "grave", label: "Grave" },
];

export function AddIllnessDialog({ open, onOpenChange, categoryId, playerId }: AddIllnessDialogProps) {
  const qc = useQueryClient();
  const [selectedPlayerId, setSelectedPlayerId] = useState(playerId || "");
  const [illnessType, setIllnessType] = useState("");
  const [customType, setCustomType] = useState("");
  const [illnessDate, setIllnessDate] = useState(new Date().toISOString().split("T")[0]);
  const [severity, setSeverity] = useState("légère");
  const [estimatedReturn, setEstimatedReturn] = useState("");
  const [description, setDescription] = useState("");

  const { data: players } = useQuery({
    queryKey: ["players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !playerId,
  });

  const add = useMutation({
    mutationFn: async () => {
      const finalType = illnessType === "Autre" ? customType : illnessType;
      const { error } = await (supabase as any).from("illnesses").insert([{
        player_id: selectedPlayerId,
        category_id: categoryId,
        illness_type: finalType,
        illness_date: illnessDate,
        severity,
        estimated_return_date: estimatedReturn || null,
        description: description || null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["illnesses", categoryId] });
      qc.invalidateQueries({ queryKey: ["illness-stats", categoryId] });
      toast.success("Maladie enregistrée");
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(`Erreur: ${e?.message || "enregistrement impossible"}`),
  });

  const reset = () => {
    if (!playerId) setSelectedPlayerId("");
    setIllnessType("");
    setCustomType("");
    setIllnessDate(new Date().toISOString().split("T")[0]);
    setSeverity("légère");
    setEstimatedReturn("");
    setDescription("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalType = illnessType === "Autre" ? customType : illnessType;
    if (!selectedPlayerId) return toast.error("Sélectionnez un athlète");
    if (!finalType) return toast.error("Précisez la maladie");
    add.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enregistrer une maladie</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {!playerId && (
              <div className="space-y-2">
                <Label>Athlète *</Label>
                <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un athlète" /></SelectTrigger>
                  <SelectContent>
                    {players?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Type de maladie *</Label>
              <Select value={illnessType} onValueChange={setIllnessType}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {COMMON_ILLNESSES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {illnessType === "Autre" && (
                <Input
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="Décrire la maladie..."
                  className="mt-2"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date de début *</Label>
                <Input type="date" value={illnessDate} onChange={(e) => setIllnessDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Gravité *</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEVERITY.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Date de retour estimée</Label>
              <Input type="date" value={estimatedReturn} onChange={(e) => setEstimatedReturn(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Symptômes, contexte..." />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
