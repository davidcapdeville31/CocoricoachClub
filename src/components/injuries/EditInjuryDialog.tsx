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
import { useSeasonGuard } from "@/hooks/use-season-guard";
import { useTranslation } from "react-i18next";

interface EditInjuryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  injury: any;
}

export function EditInjuryDialog({ open, onOpenChange, injury }: EditInjuryDialogProps) {
  const { t } = useTranslation();
  const severityOptions = [
    { value: "légère", label: t("health.editInjuryDialog.severity.mild") },
    { value: "modérée", label: t("health.editInjuryDialog.severity.moderate") },
    { value: "grave", label: t("health.editInjuryDialog.severity.severe") },
  ];
  const qc = useQueryClient();
  const guard = useSeasonGuard(injury?.category_id);
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
      if (!guard.assertPlayer(injury?.player_id)) throw new Error("guard:player");
      if (!guard.assertDate(injuryDate)) throw new Error("guard:date");
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
      toast.success(t("health.editInjuryDialog.toastSuccess"));
      onOpenChange(false);
    },
    onError: (e: any) => {
      if (typeof e?.message === "string" && e.message.startsWith("guard:")) return;
      toast.error(e?.message || t("health.editInjuryDialog.toastError"));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("health.editInjuryDialog.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("health.editInjuryDialog.injuryType")}</Label>
            <Input value={injuryType} onChange={(e) => setInjuryType(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>{t("health.editInjuryDialog.date")}</Label>
            <Input type="date" value={injuryDate} onChange={(e) => setInjuryDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>{t("health.editInjuryDialog.severityLabel")}</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="mt-1"><SelectValue placeholder={t("health.editInjuryDialog.selectPlaceholder")} /></SelectTrigger>
              <SelectContent>
                {severityOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("health.editInjuryDialog.statusLabel")}</Label>
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
            <Label>{t("health.editInjuryDialog.estimatedReturn")}</Label>
            <Input type="date" value={estimatedReturnDate} onChange={(e) => setEstimatedReturnDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>{t("health.editInjuryDialog.description")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("health.editInjuryDialog.cancel")}</Button>
          <Button onClick={() => {
            if (!injuryType.trim()) { toast.error(t("health.editInjuryDialog.toastTypeRequired")); return; }
            if (!injuryDate) { toast.error(t("health.editInjuryDialog.toastDateRequired")); return; }
            update.mutate();
          }} disabled={update.isPending}>
            {t("health.editInjuryDialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
