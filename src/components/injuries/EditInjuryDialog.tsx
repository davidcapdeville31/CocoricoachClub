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
import { INJURY_STATUS, INJURY_STATUS_LABELS } from "@/lib/constants/injury";

interface EditInjuryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  injury: any;
}

const severityOptions = [
  { value: "légère", label: "Légère" },
  { value: "modérée", label: "Modérée" },
  { value: "grave", label: "Grave" },
];

export function EditInjuryDialog({ open, onOpenChange, injury }: EditInjuryDialogProps) {
  const qc = useQueryClient();
  const [injuryType, setInjuryType] = useState("");
  const [injuryDate, setInjuryDate] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [estimatedReturnDate, setEstimatedReturnDate] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (injury) {
      setInjuryType(injury.injury_type || "");
      setInjuryDate(injury.injury_date || "");
      setSeverity(injury.severity || "");
      setStatus(injury.status || INJURY_STATUS.ACTIVE);
      setEstimatedReturnDate(injury.estimated_return_date || "");
      setDescription(injury.description || "");
    }
  }, [injury]);

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("injuries")
        .update({
          injury_type: injuryType,
          injury_date: injuryDate,
          severity: severity as any,
          status: status as any,
          estimated_return_date: estimatedReturnDate || null,
          description: description || null,
        })
        .eq("id", injury.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Blessure mise à jour");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erreur de mise à jour"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier la blessure</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Type de blessure</Label>
            <Input value={injuryType} onChange={(e) => setInjuryType(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Date de la blessure</Label>
            <Input type="date" value={injuryDate} onChange={(e) => setInjuryDate(e.target.value)} className="mt-1" />
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
                <SelectItem value={INJURY_STATUS.ACTIVE}>{INJURY_STATUS_LABELS[INJURY_STATUS.ACTIVE]}</SelectItem>
                <SelectItem value={INJURY_STATUS.REHABILITATION}>{INJURY_STATUS_LABELS[INJURY_STATUS.REHABILITATION]}</SelectItem>
                <SelectItem value={INJURY_STATUS.HEALED}>{INJURY_STATUS_LABELS[INJURY_STATUS.HEALED]}</SelectItem>
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
            if (!injuryType.trim()) { toast.error("Type requis"); return; }
            if (!injuryDate) { toast.error("Date requise"); return; }
            update.mutate();
          }} disabled={update.isPending}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
