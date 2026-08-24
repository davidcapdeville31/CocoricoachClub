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
import { useSeasonGuard } from "@/hooks/use-season-guard";
import { useTranslation } from "react-i18next";

interface AddIllnessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  playerId?: string;
}

const ILLNESS_KEYS = [
  "flu",
  "gastro",
  "covid",
  "angina",
  "rhinopharyngitis",
  "bronchitis",
  "sinusitis",
  "otitis",
  "fever",
  "fatigue",
  "migraine",
  "allergy",
  "mononucleosis",
  "other",
];

export function AddIllnessDialog({ open, onOpenChange, categoryId, playerId }: AddIllnessDialogProps) {
  const { t } = useTranslation();
  const COMMON_ILLNESSES = ILLNESS_KEYS.map((key) => t(`health.addIllnessDialog.illnesses.${key}`));
  const SEVERITY = [
    { value: "légère", label: t("health.addIllnessDialog.severity.mild") },
    { value: "modérée", label: t("health.addIllnessDialog.severity.moderate") },
    { value: "grave", label: t("health.addIllnessDialog.severity.severe") },
  ];
  const qc = useQueryClient();
  const guard = useSeasonGuard(categoryId);
  const [selectedPlayerId, setSelectedPlayerId] = useState(playerId || "");
  const [illnessType, setIllnessType] = useState("");
  const [customType, setCustomType] = useState("");
  const [illnessDate, setIllnessDate] = useState(new Date().toISOString().split("T")[0]);
  const [severity, setSeverity] = useState("légère");
  const [estimatedReturn, setEstimatedReturn] = useState("");
  const [description, setDescription] = useState("");

  const { data: playersAll } = useQuery({
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
    enabled: !playerId,
  });
  const players = (playersAll || []).filter((p: any) => guard.isPlayerAllowed(p.id));

  const add = useMutation({
    mutationFn: async () => {
      if (!guard.assertPlayer(selectedPlayerId)) throw new Error("guard:player");
      if (!guard.assertDate(illnessDate)) throw new Error("guard:date");
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
      toast.success(t("health.addIllnessDialog.toastSuccess"));
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => {
      if (typeof e?.message === "string" && e.message.startsWith("guard:")) return;
      toast.error(`${t("health.addIllnessDialog.toastErrorPrefix")}${e?.message || t("health.addIllnessDialog.toastGenericError")}`);
    },
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
    if (!selectedPlayerId) return toast.error(t("health.addIllnessDialog.toastPlayerRequired"));
    if (!finalType) return toast.error(t("health.addIllnessDialog.toastTypeRequired"));
    add.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("health.addIllnessDialog.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {!playerId && (
              <div className="space-y-2">
                <Label>{t("health.addIllnessDialog.athlete")}</Label>
                <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                  <SelectTrigger><SelectValue placeholder={t("health.addIllnessDialog.selectAthletePlaceholder")} /></SelectTrigger>
                  <SelectContent>
                    {players?.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name?.toUpperCase()}{p.first_name ? ` ${p.first_name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t("health.addIllnessDialog.illnessType")}</Label>
              <Select value={illnessType} onValueChange={setIllnessType}>
                <SelectTrigger><SelectValue placeholder={t("health.addIllnessDialog.selectPlaceholder")} /></SelectTrigger>
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
                  placeholder={t("health.addIllnessDialog.customTypePlaceholder")}
                  className="mt-2"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("health.addIllnessDialog.startDate")}</Label>
                <Input type="date" value={illnessDate} onChange={(e) => setIllnessDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>{t("health.addIllnessDialog.severityLabel")}</Label>
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
              <Label>{t("health.addIllnessDialog.estimatedReturnDate")}</Label>
              <Input type="date" value={estimatedReturn} onChange={(e) => setEstimatedReturn(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>{t("health.addIllnessDialog.description")}</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={t("health.addIllnessDialog.descriptionPlaceholder")} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("health.addIllnessDialog.cancel")}</Button>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? t("health.addIllnessDialog.saving") : t("health.addIllnessDialog.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
