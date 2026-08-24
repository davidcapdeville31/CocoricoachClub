import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, User, AlertTriangle, Calendar, Lock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, differenceInDays, isBefore } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ConcussionProtocolCardProps {
  protocol: any;
  categoryId: string;
}

// World Rugby GRTP Protocol - 6 phases with minimum delays
const getPhases = (t: (k: string) => string) => [
  { value: 1, label: t("health.concussionCard.phases.phase1Label"), minDays: 0, description: t("health.concussionCard.phases.phase1Description") },
  { value: 2, label: t("health.concussionCard.phases.phase2Label"), minDays: 1, description: t("health.concussionCard.phases.phase2Description") },
  { value: 3, label: t("health.concussionCard.phases.phase3Label"), minDays: 2, description: t("health.concussionCard.phases.phase3Description") },
  { value: 4, label: t("health.concussionCard.phases.phase4Label"), minDays: 3, description: t("health.concussionCard.phases.phase4Description") },
  { value: 5, label: t("health.concussionCard.phases.phase5Label"), minDays: 4, description: t("health.concussionCard.phases.phase5Description") },
  { value: 6, label: t("health.concussionCard.phases.phase6Label"), minDays: 5, description: t("health.concussionCard.phases.phase6Description") },
];

const getStatusOptions = (t: (k: string) => string) => [
  { value: "active", label: t("health.concussionCard.status.active") },
  { value: "recovery", label: t("health.concussionCard.status.recovery") },
  { value: "cleared", label: t("health.concussionCard.status.cleared") },
];

// Minimum rest days based on concussion history
const getMinRestDays = (concussionNumber: number) => {
  if (concussionNumber >= 3) return 21;
  if (concussionNumber === 2) return 14;
  return 7;
};

const getConcussionBadgeVariant = (number: number) => {
  if (number >= 3) return "destructive";
  if (number === 2) return "secondary";
  return "outline";
};

export function ConcussionProtocolCard({ protocol, categoryId }: ConcussionProtocolCardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Get total concussion count for this player
  const { data: allPlayerConcussions } = useQuery({
    queryKey: ["player_concussions_count", protocol.player_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("concussion_protocols")
        .select("id, incident_date")
        .eq("player_id", protocol.player_id)
        .order("incident_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Calculate which concussion number this is
  const concussionNumber = allPlayerConcussions
    ? allPlayerConcussions.findIndex((c: any) => c.id === protocol.id) + 1
    : 1;
  const totalConcussions = allPlayerConcussions?.length || 1;

  // Calculate timeline dates based on incident date and concussion history
  const PHASES = getPhases(t);
  const STATUS_OPTIONS = getStatusOptions(t);
  const incidentDate = new Date(protocol.incident_date);
  const minRestDays = getMinRestDays(concussionNumber);
  
  const getPhaseTargetDate = (phaseValue: number) => {
    const phase = PHASES.find(p => p.value === phaseValue);
    if (!phase) return null;
    // Each phase requires minimum 24h after the previous
    const baseDays = minRestDays + (phaseValue - 1);
    return addDays(incidentDate, baseDays);
  };

  const canAdvanceToPhase = (targetPhase: number) => {
    const currentPhase = protocol.return_to_play_phase || 1;
    if (targetPhase <= currentPhase) return true;
    
    const targetDate = getPhaseTargetDate(targetPhase);
    if (!targetDate) return false;
    
    return !isBefore(new Date(), targetDate);
  };

  const getDaysUntilPhase = (phaseValue: number) => {
    const targetDate = getPhaseTargetDate(phaseValue);
    if (!targetDate) return 0;
    const diff = differenceInDays(targetDate, new Date());
    return Math.max(0, diff);
  };

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase
        .from("concussion_protocols")
        .update(updates)
        .eq("id", protocol.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["concussion_protocols", categoryId] });
      queryClient.invalidateQueries({ predicate: (q) => {
        const k = String(q.queryKey?.[0] ?? "");
        return k.includes("injur") || k.includes("availability") || k.includes("health");
      }});
      toast.success(t("health.concussionCard.toastUpdated"));
    },
    onError: () => {
      toast.error(t("health.concussionCard.toastUpdateError"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("concussion_protocols").delete().eq("id", protocol.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["concussion_protocols", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["player_concussions_count", protocol.player_id] });
      queryClient.invalidateQueries({ predicate: (q) => {
        const k = String(q.queryKey?.[0] ?? "");
        return k.includes("injur") || k.includes("availability") || k.includes("health");
      }});
      toast.success(t("health.concussionCard.toastDeleted"));
    },
    onError: () => {
      toast.error(t("health.concussionCard.toastDeleteError"));
    },
  });

  const handlePhaseChange = (phase: string) => {
    const targetPhase = parseInt(phase);
    
    // Validate delay
    if (!canAdvanceToPhase(targetPhase)) {
      const daysRemaining = getDaysUntilPhase(targetPhase);
      toast.error(t("health.concussionCard.toastDelayNotRespected", { days: daysRemaining }));
      return;
    }

    const updates: any = { return_to_play_phase: targetPhase };
    if (targetPhase === 6) {
      updates.status = "cleared";
      updates.clearance_date = new Date().toISOString().split("T")[0];
    } else if (targetPhase > 1) {
      updates.status = "recovery";
    }
    updateMutation.mutate(updates);
  };

  const handleStatusChange = (status: string) => {
    const updates: any = { status };
    if (status === "cleared") {
      // Check if all phases completed
      if ((protocol.return_to_play_phase || 1) < 6) {
        toast.error(t("health.concussionCard.toastAllPhasesRequired"));
        return;
      }
      updates.clearance_date = new Date().toISOString().split("T")[0];
    }
    updateMutation.mutate(updates);
  };

  // Check if protocol can be deleted (only active protocols, not cleared ones)
  const canDelete = protocol.status !== "cleared";

  return (
    <Card className={`bg-card/50 ${totalConcussions >= 3 ? "border-destructive/50" : totalConcussions === 2 ? "border-yellow-500/50" : ""}`}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{protocol.players?.name}</span>
            <Badge 
              variant={getConcussionBadgeVariant(totalConcussions)} 
              className={`text-xs ${totalConcussions === 2 ? "bg-yellow-500/20 text-yellow-600 border-yellow-500" : ""}`}
            >
              {totalConcussions >= 3 && <AlertTriangle className="h-3 w-3 mr-1" />}
              {t("health.concussionCard.concussionCount", { number: concussionNumber, total: totalConcussions })}
            </Badge>
          </div>
          {canDelete ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("health.concussionCard.deleteDialogTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("health.concussionCard.deleteDialogDescription")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("health.concussionCard.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground">
                    {t("health.concussionCard.delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <Lock className="h-3 w-3" />
              <span>{t("health.concussionCard.historyProtected")}</span>
            </div>
          )}
        </div>

        <div className="grid gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("health.concussionCard.incidentDate")}</span>
            <span>{format(incidentDate, "dd/MM/yyyy", { locale: fr })}</span>
          </div>

          {/* Timeline automatique */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {t("health.concussionCard.timelineTitle", { number: concussionNumber })}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">{t("health.concussionCard.minRest")}</span>
                <span className="ml-1 font-medium">{t("health.concussionCard.minRestDays", { days: minRestDays })}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("health.concussionCard.estimatedRestEnd")}</span>
                <span className="ml-1 font-medium">{format(addDays(incidentDate, minRestDays), "dd/MM", { locale: fr })}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("health.concussionCard.estimatedReturn")}</span>
                <span className="ml-1 font-medium">{format(getPhaseTargetDate(6) || new Date(), "dd/MM", { locale: fr })}</span>
              </div>
              {protocol.status !== "cleared" && (
                <div>
                  <span className="text-muted-foreground">{t("health.concussionCard.nextPhase")}</span>
                  <span className={`ml-1 font-medium ${canAdvanceToPhase((protocol.return_to_play_phase || 1) + 1) ? "text-green-600" : "text-orange-500"}`}>
                    {canAdvanceToPhase((protocol.return_to_play_phase || 1) + 1) 
                      ? t("health.concussionCard.available") 
                      : t("health.concussionCard.inDays", { days: getDaysUntilPhase((protocol.return_to_play_phase || 1) + 1) })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {protocol.incident_description && (
            <div>
              <span className="text-muted-foreground">{t("health.concussionCard.description")}</span>
              <p className="mt-1">{protocol.incident_description}</p>
            </div>
          )}

          {protocol.symptoms && protocol.symptoms.length > 0 && (
            <div>
              <span className="text-muted-foreground">{t("health.concussionCard.symptoms")}</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {protocol.symptoms.map((symptom: string) => (
                  <Badge key={symptom} variant="outline" className="text-xs">
                    {symptom}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t("health.concussionCard.phase")}</span>
            <Select
              value={protocol.return_to_play_phase?.toString()}
              onValueChange={handlePhaseChange}
              disabled={protocol.status === "cleared"}
            >
              <SelectTrigger className="w-[280px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PHASES.map((phase) => {
                  const canAdvance = canAdvanceToPhase(phase.value);
                  const daysRemaining = getDaysUntilPhase(phase.value);
                  return (
                    <SelectItem 
                      key={phase.value} 
                      value={phase.value.toString()}
                      disabled={!canAdvance && phase.value > (protocol.return_to_play_phase || 1)}
                    >
                      <div className="flex items-center gap-2">
                        {phase.value <= (protocol.return_to_play_phase || 1) && (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        )}
                        <span>{phase.label}</span>
                        {!canAdvance && phase.value > (protocol.return_to_play_phase || 1) && (
                          <span className="text-xs text-muted-foreground ml-1">({daysRemaining}j)</span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground italic">
            {PHASES.find(p => p.value === (protocol.return_to_play_phase || 1))?.description}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t("health.concussionCard.statusLabel")}</span>
            <Select value={protocol.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {protocol.clearance_date && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("health.concussionCard.returnDate")}</span>
              <span className="text-green-600">
                {format(new Date(protocol.clearance_date), "dd/MM/yyyy", { locale: fr })}
              </span>
            </div>
          )}

          {protocol.medical_notes && (
            <div>
              <span className="text-muted-foreground">{t("health.concussionCard.medicalNotes")}</span>
              <p className="mt-1 text-xs bg-muted p-2 rounded">{protocol.medical_notes}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}