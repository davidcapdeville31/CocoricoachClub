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
import { RUGBY_INJURY_TYPES } from "@/lib/constants/rugbyInjuries";
import { Badge } from "@/components/ui/badge";
import { useSeasonGuard } from "@/hooks/use-season-guard";
import { useTranslation } from "react-i18next";

interface AddInjuryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  playerId?: string;
}

export function AddInjuryDialog({
  open,
  onOpenChange,
  categoryId,
  playerId,
}: AddInjuryDialogProps) {
  const { t } = useTranslation();
  const severityOptions = [
    { value: "légère", label: t("health.addInjuryDialog.severity.mild") },
    { value: "modérée", label: t("health.addInjuryDialog.severity.moderate") },
    { value: "grave", label: t("health.addInjuryDialog.severity.severe") },
  ];
  const [selectedPlayerId, setSelectedPlayerId] = useState(playerId || "");
  const [injuryType, setInjuryType] = useState("");
  const [customInjuryType, setCustomInjuryType] = useState("");
  const [injuryDate, setInjuryDate] = useState(new Date().toISOString().split("T")[0]);
  const [severity, setSeverity] = useState<string>("");
  const [estimatedReturnDate, setEstimatedReturnDate] = useState("");
  const [description, setDescription] = useState("");
  const [protocolNotes, setProtocolNotes] = useState("");
  const queryClient = useQueryClient();
  const guard = useSeasonGuard(categoryId);

  const selectedInjury = RUGBY_INJURY_TYPES.find(i => i.name === injuryType);

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

  const addInjury = useMutation({
    mutationFn: async () => {
      if (!guard.assertPlayer(selectedPlayerId)) throw new Error("guard:player");
      if (!guard.assertDate(injuryDate)) throw new Error("guard:date");
      const finalInjuryType = injuryType === "other" ? customInjuryType : injuryType;
      const { error } = await supabase.from("injuries").insert([
        {
          player_id: selectedPlayerId,
          category_id: categoryId,
          injury_type: finalInjuryType,
          injury_date: injuryDate,
          severity: severity as any,
          estimated_return_date: estimatedReturnDate || null,
          description: description || null,
          protocol_notes: protocolNotes || null,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["injuries"] });
      toast.success(t("health.addInjuryDialog.toastSuccess"));
      resetForm();
      onOpenChange(false);
    },
    onError: (err: any) => {
      if (typeof err?.message === "string" && err.message.startsWith("guard:")) return;
      toast.error(t("health.addInjuryDialog.toastError"));
    },
  });

  const resetForm = () => {
    if (!playerId) setSelectedPlayerId("");
    setInjuryType("");
    setCustomInjuryType("");
    setInjuryDate(new Date().toISOString().split("T")[0]);
    setSeverity("");
    setEstimatedReturnDate("");
    setDescription("");
    setProtocolNotes("");
  };

  // Auto-calculate estimated return date based on injury type
  const handleInjuryTypeChange = (value: string) => {
    setInjuryType(value);
    const injury = RUGBY_INJURY_TYPES.find(i => i.name === value);
    if (injury && !estimatedReturnDate) {
      const returnDate = new Date(injuryDate);
      returnDate.setDate(returnDate.getDate() + injury.durationMin);
      setEstimatedReturnDate(returnDate.toISOString().split("T")[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalInjuryType = injuryType === "other" ? customInjuryType : injuryType;
    if (selectedPlayerId && finalInjuryType && severity) {
      addInjury.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("health.addInjuryDialog.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {!playerId && (
              <div className="space-y-2">
                <Label htmlFor="player">{t("health.addInjuryDialog.player")}</Label>
                <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("health.addInjuryDialog.selectPlayerPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {players?.map((player: any) => (
                      <SelectItem key={player.id} value={player.id}>
                        {player.name?.toUpperCase()}{player.first_name ? ` ${player.first_name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="injuryType">{t("health.addInjuryDialog.injuryType")}</Label>
              <Select value={injuryType} onValueChange={handleInjuryTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t("health.addInjuryDialog.selectInjuryTypePlaceholder")} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {RUGBY_INJURY_TYPES.map((injury) => (
                    <SelectItem key={injury.name} value={injury.name}>
                      <div className="flex items-center gap-2">
                        <span>{injury.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {injury.category}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="other">{t("health.addInjuryDialog.otherCustom")}</SelectItem>
                </SelectContent>
              </Select>
              {injuryType === "other" && (
                <Input
                  value={customInjuryType}
                  onChange={(e) => setCustomInjuryType(e.target.value)}
                  placeholder={t("health.addInjuryDialog.customTypePlaceholder")}
                  className="mt-2"
                />
              )}
              {selectedInjury && (
                <p className="text-xs text-muted-foreground">
                  {t("health.addInjuryDialog.typicalDuration", { min: selectedInjury.durationMin, max: selectedInjury.durationMax })}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="injuryDate">{t("health.addInjuryDialog.injuryDate")}</Label>
                <Input
                  id="injuryDate"
                  type="date"
                  value={injuryDate}
                  onChange={(e) => setInjuryDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="severity">{t("health.addInjuryDialog.severityLabel")}</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("health.addInjuryDialog.selectPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {severityOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedReturnDate">{t("health.addInjuryDialog.estimatedReturnDate")}</Label>
              <Input
                id="estimatedReturnDate"
                type="date"
                value={estimatedReturnDate}
                onChange={(e) => setEstimatedReturnDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("health.addInjuryDialog.description")}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("health.addInjuryDialog.descriptionPlaceholder")}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="protocolNotes">{t("health.addInjuryDialog.protocolNotes")}</Label>
              <Textarea
                id="protocolNotes"
                value={protocolNotes}
                onChange={(e) => setProtocolNotes(e.target.value)}
                placeholder={t("health.addInjuryDialog.protocolNotesPlaceholder")}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("health.addInjuryDialog.cancel")}
            </Button>
            <Button type="submit" disabled={addInjury.isPending}>
              {addInjury.isPending ? t("health.addInjuryDialog.saving") : t("health.addInjuryDialog.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
