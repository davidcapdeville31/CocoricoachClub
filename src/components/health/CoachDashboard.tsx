import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
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
import { EditInjuryDialog } from "@/components/injuries/EditInjuryDialog";
import { EditIllnessDialog } from "@/components/injuries/EditIllnessDialog";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Cake,
  Syringe,
  HeartPulse,
  Pencil,
  Trash2,
} from "lucide-react";

import { format, differenceInDays, addDays, isSameMonth, parseISO, isValid } from "date-fns";

const safeFormat = (date: Date | string | null | undefined, fmt: string, options?: any): string => {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  return isValid(d) ? format(d, fmt, options) : "N/A";
};

const safeDiffDays = (dateLeft: Date | string | null | undefined, dateRight: Date): number => {
  if (!dateLeft) return 0;
  const d = typeof dateLeft === "string" ? new Date(dateLeft) : dateLeft;
  return isValid(d) ? differenceInDays(d, dateRight) : 0;
};
import { fr } from "date-fns/locale";

interface CoachDashboardProps {
  categoryId: string;
}

export function CoachDashboard({ categoryId }: CoachDashboardProps) {
  const queryClient = useQueryClient();
  const [editingInjury, setEditingInjury] = useState<any>(null);
  const [editingIllness, setEditingIllness] = useState<any>(null);

  const deleteInjury = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("injuries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active_injuries", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["injuries", categoryId] });
      toast.success("Blessure supprimée");
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  const deleteIllness = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("illnesses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active_illnesses", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["illnesses", categoryId] });
      toast.success("Maladie supprimée");
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  // Realtime sync for EWMA, wellness, and AWCR
  useRealtimeSync({
    tables: ["awcr_tracking", "wellness_tracking"],
    categoryId,
    queryKeys: [
      ["ewma_summary", categoryId],
      ["awcr-risk", categoryId],
      ["wellness_tracking", categoryId],
    ],
    channelName: `coach-dashboard-sync-${categoryId}`,
  });

  // Fetch players
  const { data: players } = useQuery({
    queryKey: ["players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch active injuries
  const { data: injuries } = useQuery({
    queryKey: ["active_injuries", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("injuries")
        .select("*, players(name)")
        .eq("category_id", categoryId)
        .neq("status", "healed")
        .order("injury_date", { ascending: false });
      if (error) {
        console.warn("Injuries query error:", error.message);
        return [];
      }
      return data;
    },
    retry: 1,
  });

  // Fetch active illnesses
  const { data: illnesses } = useQuery({
    queryKey: ["active_illnesses", categoryId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("illnesses")
        .select("*, players(name)")
        .eq("category_id", categoryId)
        .neq("status", "healed")
        .order("illness_date", { ascending: false });
      if (error) {
        console.warn("Illnesses query error:", error.message);
        return [];
      }
      return data || [];
    },
    retry: 1,
  });

  // Fetch EWMA data (replacing AWCR) - limit to last 60 days for performance
  const { data: ewmaData } = useQuery({
    queryKey: ["ewma_summary", categoryId],
    queryFn: async () => {
      const sixtyDaysAgo = format(addDays(new Date(), -60), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("awcr_tracking")
        .select("player_id, awcr, acute_load, chronic_load, players(name, first_name)")
        .eq("category_id", categoryId)
        .gte("session_date", sixtyDaysAgo)
        .order("session_date", { ascending: false });
      if (error) {
        console.warn("EWMA query error:", error.message);
        return {};
      }

      // Get latest EWMA per player - use the stored awcr field (correct EWMA ratio)
      const latestByPlayer: Record<string, { ewmaRatio: number; acute: number; chronic: number; name: string }> = {};
      data?.forEach((entry: any) => {
        if (!latestByPlayer[entry.player_id] && entry.awcr != null) {
          const playerName = [entry.players?.first_name, entry.players?.name].filter(Boolean).join(" ");
          latestByPlayer[entry.player_id] = {
            ewmaRatio: entry.awcr,
            acute: entry.acute_load || 0,
            chronic: entry.chronic_load || 0,
            name: playerName || "Unknown",
          };
        }
      });
      return latestByPlayer;
    },
    retry: 1,
  });

  // Fetch wellness data
  const { data: wellnessData } = useQuery({
    queryKey: ["wellness_summary", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_tracking")
        .select("*, players(name)")
        .eq("category_id", categoryId)
        .gte("tracking_date", format(addDays(new Date(), -7), "yyyy-MM-dd"))
        .order("tracking_date", { ascending: false });
      if (error) {
        console.warn("Wellness query error:", error.message);
        return [];
      }
      return data;
    },
    retry: 1,
  });

  // Fetch medical records due soon
  const { data: medicalRecords } = useQuery({
    queryKey: ["medical_due_soon", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medical_records")
        .select("*, players(name)")
        .eq("category_id", categoryId)
        .lte("next_due_date", format(addDays(new Date(), 30), "yyyy-MM-dd"))
        .order("next_due_date");
      if (error) {
        console.warn("Medical records query error:", error.message);
        return [];
      }
      return data;
    },
    retry: 1,
  });

  // Fetch RTP protocols in progress
  const { data: rtpProtocols } = useQuery({
    queryKey: ["rtp_in_progress", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("return_to_play_protocols")
        .select("*, players(name), injuries(injury_type)")
        .eq("category_id", categoryId)
        .eq("status", "in_progress");
      if (error) {
        console.warn("RTP query error:", error.message);
        return [];
      }
      return data;
    },
    retry: 1,
  });

  // Calculate stats — combine injuries + illnesses, dedup by player
  const totalPlayers = players?.length || 0;
  const injuredPlayers = injuries?.length || 0;
  const sickPlayers = illnesses?.length || 0;
  const unavailableIds = new Set<string>([
    ...((injuries || []).map((i: any) => i.player_id as string)),
    ...((illnesses || []).map((i: any) => i.player_id as string)),
  ]);
  const unavailableCount = unavailableIds.size;
  const availablePlayers = totalPlayers - unavailableCount;
  const availabilityRate = totalPlayers > 0 ? (availablePlayers / totalPlayers) * 100 : 0;

  // EWMA analysis (replacing AWCR)
  // Filter out players with insufficient chronic load data (< 50) to avoid misleading ratios
  const MIN_CHRONIC_LOAD = 50;
  const ewmaValues = Object.values(ewmaData || {}).filter((p) => p.chronic >= MIN_CHRONIC_LOAD);
  const highEwma = ewmaValues.filter((p) => p.ewmaRatio > 1.3);
  const lowEwma = ewmaValues.filter((p) => p.ewmaRatio < 0.8);
  const optimalEwma = ewmaValues.filter((p) => p.ewmaRatio >= 0.8 && p.ewmaRatio <= 1.3);

  // Wellness analysis - get latest per player
  const latestWellness: Record<string, any> = {};
  wellnessData?.forEach((entry: any) => {
    if (!latestWellness[entry.player_id]) {
      latestWellness[entry.player_id] = entry;
    }
  });
  
  const lowWellnessPlayers = Object.values(latestWellness).filter((w: any) => {
    // Normalize all metrics so that high = good (optimal)
    // All metrics use same polarity: 1=good, 5=bad → invert all (6 - value)
    const normalizedScore = (
      (6 - (w.sleep_quality || 3)) + 
      (6 - (w.general_fatigue || 3)) + 
      (6 - (w.stress_level || 3)) + 
      (6 - (w.soreness_upper_body || 3)) + 
      (6 - (w.soreness_lower_body || 3))
    ) / 5;
    return normalizedScore < 2.5;
  });

  // Birthdays this month
  const birthdaysThisMonth = players?.filter((p) => {
    if (!p.birth_date) return false;
    const birthDate = parseISO(p.birth_date);
    return isValid(birthDate) && isSameMonth(birthDate, new Date());
  });

  // Medical records stats
  const expiredMedical = medicalRecords?.filter((r) => {
    return safeDiffDays(r.next_due_date, new Date()) < 0;
  });
  const dueSoonMedical = medicalRecords?.filter((r) => {
    const days = safeDiffDays(r.next_due_date, new Date());
    return days >= 0 && days <= 30;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard Coach</h2>
        <p className="text-muted-foreground">Vue consolidée des indicateurs critiques</p>
      </div>

      {/* Main KPIs + Rappels */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
          <CardHeader className="pb-1 px-3 pt-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Disponibilité
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-2xl font-bold text-green-600">
              {availablePlayers}/{totalPlayers}
            </div>
            <Progress value={availabilityRate} className="mt-1.5 h-1.5" />
            <p className="text-[10px] text-muted-foreground mt-1">
              {availabilityRate.toFixed(0)}% disponibles
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/30">
          <CardHeader className="pb-1 px-3 pt-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Blessures / Maladies
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-2xl font-bold text-red-600">{injuredPlayers + sickPlayers}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {injuredPlayers} blessé{injuredPlayers > 1 ? "s" : ""} · {sickPlayers} malade{sickPlayers > 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-orange-500/30">
          <CardHeader className="pb-1 px-3 pt-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              EWMA élevé
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-2xl font-bold text-orange-600">{highEwma.length}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Risque de surcharge
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
          <CardHeader className="pb-1 px-3 pt-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <HeartPulse className="h-3.5 w-3.5" />
              Wellness faible
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-2xl font-bold text-blue-600">{lowWellnessPlayers.length}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Attention requise
            </p>
          </CardContent>
        </Card>

        {/* Rappels à venir - compact */}
        <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30">
          <CardHeader className="pb-1 px-3 pt-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Rappels à venir
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-2xl font-bold text-purple-600">
              {(dueSoonMedical?.length || 0) + (rtpProtocols?.length || 0) + (birthdaysThisMonth?.length || 0)}
            </div>
            <ScrollArea className="h-[90px] mt-1.5">
              <div className="space-y-1">
                {dueSoonMedical?.map((record) => (
                  <div key={record.id} className="flex items-center gap-1.5 text-[10px]">
                    <Syringe className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{record.players?.name}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                      {safeDiffDays(record.next_due_date, new Date())}j
                    </Badge>
                  </div>
                ))}
                {rtpProtocols?.map((protocol: any) => (
                  <div key={protocol.id} className="flex items-center gap-1.5 text-[10px]">
                    <Activity className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{protocol.players?.name}</span>
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">RTP</Badge>
                  </div>
                ))}
                {birthdaysThisMonth?.map((player) => (
                  <div key={player.id} className="flex items-center gap-1.5 text-[10px]">
                    <Cake className="h-3 w-3 text-pink-500 shrink-0" />
                    <span className="truncate flex-1">{player.name}</span>
                    <span className="text-[9px] text-muted-foreground">
                      {safeFormat(player.birth_date ? parseISO(player.birth_date) : null, "dd/MM", { locale: fr })}
                    </span>
                  </div>
                ))}
                {(!dueSoonMedical?.length && !rtpProtocols?.length && !birthdaysThisMonth?.length) && (
                  <p className="text-center text-[10px] text-muted-foreground py-2">
                    Aucun rappel
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Active injuries & illnesses detail */}
      {((injuries && injuries.length > 0) || (illnesses && illnesses.length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Blessures & Maladies en cours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {injuries?.map((injury: any) => {
                const injuryDate = injury.injury_date ? new Date(injury.injury_date) : null;
                const daysOut = injuryDate ? differenceInDays(new Date(), injuryDate) : null;
                return (
                  <div key={`inj-${injury.id}`} className="p-4 border rounded-lg space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-base">{injury.players?.name}</p>
                        <p className="text-sm text-destructive font-medium">{injury.injury_type}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant={injury.status === "active" ? "destructive" : "secondary"}>
                          {injury.status === "active" ? "Blessé" : "Réhab"}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingInjury(injury)} title="Modifier">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" title="Supprimer">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer cette blessure ?</AlertDialogTitle>
                              <AlertDialogDescription>Action irréversible.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteInjury.mutate(injury.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>

                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-foreground">Blessure le:</span>
                        <span>{safeFormat(injury.injury_date, "EEEE dd MMMM yyyy", { locale: fr })}</span>
                      </div>
                      {daysOut !== null && (
                        <p>Absent depuis <span className="font-medium text-foreground">{daysOut} jour{daysOut > 1 ? "s" : ""}</span></p>
                      )}
                      {injury.estimated_return_date && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-foreground">Retour estimé:</span>
                          <span>{safeFormat(injury.estimated_return_date, "EEEE dd MMMM yyyy", { locale: fr })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {illnesses?.map((illness: any) => {
                const ilDate = illness.illness_date ? new Date(illness.illness_date) : null;
                const daysOut = ilDate ? differenceInDays(new Date(), ilDate) : null;
                return (
                  <div key={`ill-${illness.id}`} className="p-4 border rounded-lg space-y-3 bg-orange-500/5 border-orange-500/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-base">{illness.players?.name}</p>
                        <p className="text-sm text-orange-600 font-medium">{illness.illness_type}</p>
                      </div>
                      <Badge className="bg-orange-500 text-white hover:bg-orange-500">Malade</Badge>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-foreground">Maladie le:</span>
                        <span>{safeFormat(illness.illness_date, "EEEE dd MMMM yyyy", { locale: fr })}</span>
                      </div>
                      {daysOut !== null && (
                        <p>Absent depuis <span className="font-medium text-foreground">{daysOut} jour{daysOut > 1 ? "s" : ""}</span></p>
                      )}
                      {illness.estimated_return_date && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-foreground">Retour estimé:</span>
                          <span>{safeFormat(illness.estimated_return_date, "EEEE dd MMMM yyyy", { locale: fr })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* EWMA distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Distribution EWMA</CardTitle>
        </CardHeader>
        <CardContent>
          {ewmaValues.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="font-medium">Aucune donnée EWMA disponible</p>
              <p className="text-sm mt-1">
                Les ratios EWMA sont calculés automatiquement lorsque les joueurs ont suffisamment de sessions RPE enregistrées (minimum 7 jours de données).
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Sous-entraînés */}
              <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20 flex flex-col">
                <div className="text-center mb-3">
                  <p className="text-2xl font-bold text-blue-600">{lowEwma.length}</p>
                  <p className="text-sm text-muted-foreground">Sous-entraînés (&lt;0.8)</p>
                </div>
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                  {lowEwma.length === 0 ? (
                    <p className="text-xs text-center text-muted-foreground italic py-2">Aucun joueur</p>
                  ) : (
                    [...lowEwma]
                      .sort((a, b) => a.ewmaRatio - b.ewmaRatio)
                      .map((p, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 bg-background/60 rounded-md text-xs"
                        >
                          <span className="font-medium truncate">{p.name}</span>
                          <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-600 shrink-0">
                            {p.ewmaRatio.toFixed(2)}
                          </Badge>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Zone optimale */}
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20 flex flex-col">
                <div className="text-center mb-3">
                  <p className="text-2xl font-bold text-green-600">{optimalEwma.length}</p>
                  <p className="text-sm text-muted-foreground">Zone optimale (0.8-1.3)</p>
                </div>
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                  {optimalEwma.length === 0 ? (
                    <p className="text-xs text-center text-muted-foreground italic py-2">Aucun joueur</p>
                  ) : (
                    [...optimalEwma]
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((p, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 bg-background/60 rounded-md text-xs"
                        >
                          <span className="font-medium truncate">{p.name}</span>
                          <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-600 shrink-0">
                            {p.ewmaRatio.toFixed(2)}
                          </Badge>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Surcharge */}
              <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/20 flex flex-col">
                <div className="text-center mb-3">
                  <p className="text-2xl font-bold text-orange-600">{highEwma.length}</p>
                  <p className="text-sm text-muted-foreground">Sur-entraînés (&gt;1.3)</p>
                </div>
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                  {highEwma.length === 0 ? (
                    <p className="text-xs text-center text-muted-foreground italic py-2">Aucun joueur</p>
                  ) : (
                    [...highEwma]
                      .sort((a, b) => b.ewmaRatio - a.ewmaRatio)
                      .map((p, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 bg-background/60 rounded-md text-xs"
                        >
                          <span className="font-medium truncate">{p.name}</span>
                          <Badge variant="outline" className="text-[10px] border-orange-500/40 text-orange-600 shrink-0">
                            {p.ewmaRatio.toFixed(2)}
                          </Badge>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
