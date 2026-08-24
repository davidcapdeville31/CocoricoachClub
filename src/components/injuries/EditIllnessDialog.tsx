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
import { useSeasonGuard } from "@/hooks/use-season-guard";
import { useTranslation } from "react-i18next";

interface EditIllnessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  illness: any;
}

export function EditIllnessDialog({ open, onOpenChange, illness }: EditIllnessDialogProps) {
  const { t } = useTranslation();
  const severityOptions = [
    { value: "légère", label: t("health.editIllnessDialog.severity.mild") },
    { value: "modérée", label: t("health.editIllnessDialog.severity.moderate") },
    { value: "grave", label: t("health.editIllnessDialog.severity.severe") },
  ];
  const qc = useQueryClient();
  const guard = useSeasonGuard(illness?.category_id);
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
      if (!guard.assertPlayer(illness?.player_id)) throw new Error("guard:player");
      if (!guard.assertDate(illnessDate)) throw new Error("guard:date");
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
      toast.success(t("health.editIllnessDialog.toastSuccess"));
      onOpenChange(false);
    },
    onError: (e: any) => {
      if (typeof e?.message === "string" && e.message.startsWith("guard:")) return;
      toast.error(e?.message || t("health.editIllnessDialog.toastError"));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("health.editIllnessDialog.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("health.editIllnessDialog.illnessType")}</Label>
            <Input value={illnessType} onChange={(e) => setIllnessType(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>{t("health.editIllnessDialog.date")}</Label>
            <Input type="date" value={illnessDate} onChange={(e) => setIllnessDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>{t("health.editIllnessDialog.severityLabel")}</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="mt-1"><SelectValue placeholder={t("health.editIllnessDialog.selectPlaceholder")} /></SelectTrigger>
              <SelectContent>
                {severityOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("health.editIllnessDialog.statusLabel")}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t("health.editIllnessDialog.status.active")}</SelectItem>
                <SelectItem value="recovering">{t("health.editIllnessDialog.status.recovering")}</SelectItem>
                <SelectItem value="healed">{t("health.editIllnessDialog.status.healed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("health.editIllnessDialog.estimatedReturn")}</Label>
            <Input type="date" value={estimatedReturnDate} onChange={(e) => setEstimatedReturnDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>{t("health.editIllnessDialog.description")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("health.editIllnessDialog.cancel")}</Button>
          <Button onClick={() => {
            if (!illnessType.trim()) { toast.error(t("health.editIllnessDialog.toastTypeRequired")); return; }
            if (!illnessDate) { toast.error(t("health.editIllnessDialog.toastDateRequired")); return; }
            update.mutate();
          }} disabled={update.isPending}>
            {t("health.editIllnessDialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
