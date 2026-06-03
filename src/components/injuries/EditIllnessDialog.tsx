import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface EditIllnessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  illness: any;
}

const severityOptions = [
  { value: "légère", label: "Légère" },
  { value: "modérée", label: "Modérée" },
  { value: "grave", label: "Grave" },
];

export function EditIllnessDialog({ open, onOpenChange, illness }: EditIllnessDialogProps) {
  const qc = useQueryClient();
  const [illnessType, setIllnessType] = useState("");
  const [illnessDate, setIllnessDate] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [estimatedReturnDate, setEstimatedReturnDate] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (illness) {
      setIllnessType(illness.illness_type || "");
      setIllnessDate(illness.illness_date || "");
      setSeverity(illness.severity || "");
      setStatus(illness.status || "active");
      setEstimatedReturnDate(illness.estimated_return_date || "");
      setDescription(illness.description || "");
    }
  }, [illness]);

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("illnesses")
        .update({
          illness_type: illnessType,
          illness_date: illnessDate,
          severity,
          status,
          estimated_return_date: estimatedReturnDate || null,
          description: description || null,
        })
        .eq("id", illness.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Maladie mise à jour");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erreur de mise à jour"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier la maladie</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Type de maladie</Label>
            <Input value={illnessType} onChange={(e) => setIllnessType(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={illnessDate} onChange={(e) => setIllnessDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Gravité</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                {severityOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Statut</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="recovering">En convalescence</SelectItem>
                <SelectItem value="healed">Guérie</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Retour estimé</Label>
            <Input type="date" value={estimatedReturnDate} onChange={(e) => setEstimatedReturnDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => {
            if (!illnessType.trim()) { toast.error("Type requis"); return; }
            if (!illnessDate) { toast.error("Date requise"); return; }
            update.mutate();
          }} disabled={update.isPending}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
