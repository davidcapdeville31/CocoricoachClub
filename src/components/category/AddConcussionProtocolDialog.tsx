import { getLocaleTag } from "@/lib/i18n/dateLocale";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface AddConcussionProtocolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  players: { id: string; name: string }[];
}

const getCommonSymptoms = (t: (k: string) => string) => [
  t("health.addConcussionDialog.symptomsList.headache"),
  t("health.addConcussionDialog.symptomsList.dizziness"),
  t("health.addConcussionDialog.symptomsList.nausea"),
  t("health.addConcussionDialog.symptomsList.blurredVision"),
  t("health.addConcussionDialog.symptomsList.lightSensitivity"),
  t("health.addConcussionDialog.symptomsList.noiseSensitivity"),
  t("health.addConcussionDialog.symptomsList.confusion"),
  t("health.addConcussionDialog.symptomsList.memoryLoss"),
  t("health.addConcussionDialog.symptomsList.concentrationDifficulty"),
  t("health.addConcussionDialog.symptomsList.fatigue"),
  t("health.addConcussionDialog.symptomsList.sleepDisorders"),
  t("health.addConcussionDialog.symptomsList.irritability"),
];

const getRestRecommendations = (t: (k: string) => string) => ({
  1: {
    minDays: 7,
    description: t("health.addConcussionDialog.restRecommendations.first"),
  },
  2: {
    minDays: 14,
    description: t("health.addConcussionDialog.restRecommendations.second"),
  },
  3: {
    minDays: 21,
    description: t("health.addConcussionDialog.restRecommendations.thirdOrMore"),
  },
});

export function AddConcussionProtocolDialog({ open, onOpenChange, categoryId, players }: AddConcussionProtocolDialogProps) {
  const { t } = useTranslation();
  const [playerId, setPlayerId] = useState("");
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [medicalNotes, setMedicalNotes] = useState("");
  const queryClient = useQueryClient();

  // Fetch previous concussions for the selected player
  const { data: previousConcussions } = useQuery({
    queryKey: ["player_concussions", playerId],
    queryFn: async () => {
      if (!playerId) return [];
      const { data, error } = await supabase
        .from("concussion_protocols")
        .select("*")
        .eq("player_id", playerId)
        .order("incident_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!playerId,
  });

  const COMMON_SYMPTOMS = getCommonSymptoms(t);
  const REST_RECOMMENDATIONS = getRestRecommendations(t);
  const concussionNumber = (previousConcussions?.length || 0) + 1;
  const restRecommendation = REST_RECOMMENDATIONS[Math.min(concussionNumber, 3) as 1 | 2 | 3];

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("concussion_protocols").insert({
        player_id: playerId,
        category_id: categoryId,
        incident_date: incidentDate,
        incident_description: description || null,
        symptoms: selectedSymptoms.length > 0 ? selectedSymptoms : null,
        medical_notes: medicalNotes || null,
        status: "active",
        return_to_play_phase: 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["concussion_protocols", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["player_concussions", playerId] });
      // La commotion crée automatiquement une blessure : rafraîchir santé/disponibilité
      queryClient.invalidateQueries({ predicate: (q) => {
        const k = String(q.queryKey?.[0] ?? "");
        return k.includes("injur") || k.includes("availability") || k.includes("blessure") || k.includes("health");
      }});
      toast.success(t("health.addConcussionDialog.toastSuccess"));
      resetForm();
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t("health.addConcussionDialog.toastError"));
    },
  });

  const resetForm = () => {
    setPlayerId("");
    setDescription("");
    setSelectedSymptoms([]);
    setMedicalNotes("");
  };

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerId) {
      toast.error(t("health.addConcussionDialog.toastPlayerRequired"));
      return;
    }
    mutation.mutate();
  };

  const selectedPlayer = players.find(p => p.id === playerId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("health.addConcussionDialog.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("health.addConcussionDialog.player")}</Label>
            <Select value={playerId} onValueChange={setPlayerId}>
              <SelectTrigger>
                <SelectValue placeholder={t("health.addConcussionDialog.selectPlayerPlaceholder")} />
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

          {/* Warning for repeated concussions */}
          {playerId && previousConcussions && previousConcussions.length > 0 && (
            <Alert variant={concussionNumber >= 3 ? "destructive" : "default"} className={concussionNumber === 2 ? "border-yellow-500 bg-yellow-500/10" : ""}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="flex items-center gap-2">
                {concussionNumber >= 3 ? t("health.addConcussionDialog.criticalAlert") : t("health.addConcussionDialog.attentionAlert")}
                {t("health.addConcussionDialog.concussionCountFor", { number: concussionNumber, name: selectedPlayer?.name })}
              </AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                <p className="font-medium">{restRecommendation.description}</p>
                <div className="text-sm mt-2">
                  <p className="font-semibold">{t("health.addConcussionDialog.historyTitle")}</p>
                  <ul className="list-disc list-inside mt-1">
                    {previousConcussions.map((c: any, idx: number) => (
                      <li key={c.id}>
                        {new Date(c.incident_date).toLocaleDateString(getLocaleTag())}
                        {c.status === "cleared" ? t("health.addConcussionDialog.statusCleared") : c.status === "recovery" ? t("health.addConcussionDialog.statusRecovery") : t("health.addConcussionDialog.statusActive")}
                      </li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* First concussion info */}
          {playerId && previousConcussions && previousConcussions.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t("health.addConcussionDialog.firstConcussionTitle")}</AlertTitle>
              <AlertDescription>
                {restRecommendation.description}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>{t("health.addConcussionDialog.incidentDate")}</Label>
            <Input type="date" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t("health.addConcussionDialog.incidentDescription")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("health.addConcussionDialog.incidentDescriptionPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("health.addConcussionDialog.symptomsObserved")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {COMMON_SYMPTOMS.map((symptom) => (
                <div key={symptom} className="flex items-center space-x-2">
                  <Checkbox
                    id={symptom}
                    checked={selectedSymptoms.includes(symptom)}
                    onCheckedChange={() => toggleSymptom(symptom)}
                  />
                  <label htmlFor={symptom} className="text-sm cursor-pointer">
                    {symptom}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("health.addConcussionDialog.medicalNotes")}</Label>
            <Textarea
              value={medicalNotes}
              onChange={(e) => setMedicalNotes(e.target.value)}
              placeholder={t("health.addConcussionDialog.medicalNotesPlaceholder")}
            />
          </div>

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? t("health.addConcussionDialog.creating") : t("health.addConcussionDialog.createProtocol")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
