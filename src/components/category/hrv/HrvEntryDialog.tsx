import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Heart, Loader2, Save } from "lucide-react";
import { HrvInputSection, emptyHrvData, type HrvData } from "./HrvInputSection";
import { fetchCategoryRosterPlayers } from "@/lib/categoryRoster";
import { useSeasonRosterFilter } from "@/contexts/SeasonRosterFilterContext";

interface HrvEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  defaultDate?: string;
  defaultType?: "session" | "test" | "competition" | "morning";
  defaultPlayerId?: string;
  trainingSessionId?: string;
  matchId?: string;
}

export function HrvEntryDialog({
  open,
  onOpenChange,
  categoryId,
  defaultDate,
  defaultType = "session",
  defaultPlayerId,
  trainingSessionId,
  matchId,
}: HrvEntryDialogProps) {
  const queryClient = useQueryClient();
  const [selectedPlayerId, setSelectedPlayerId] = useState(defaultPlayerId || "");
  const [recordDate, setRecordDate] = useState(defaultDate || new Date().toISOString().split("T")[0]);
  const [recordType, setRecordType] = useState(defaultType);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(trainingSessionId || "");
  const [hrvData, setHrvData] = useState<HrvData>(emptyHrvData);

  const { activeSeasonOnly, activeSeasonId } = useSeasonRosterFilter();
  const seasonScope = activeSeasonOnly && activeSeasonId ? activeSeasonId : "all";

  const { data: players = [], isLoading: playersLoading, error: playersError } = useQuery({
    queryKey: ["hrv-dialog-players", categoryId, seasonScope],
    queryFn: async () => {
      const roster = await fetchCategoryRosterPlayers(categoryId);
      const filtered = (roster || []).filter((p: any) => {
        if (!(activeSeasonOnly && activeSeasonId)) return true;
        // Exclude players without season_id when season filter is on
        return p.season_id === activeSeasonId;
      });
      return filtered
        .map((p: any) => ({ id: p.id, name: p.name, first_name: p.first_name, season_id: p.season_id }))
        .sort((a: any, b: any) =>
          `${a.first_name ?? ""} ${a.name ?? ""}`.localeCompare(`${b.first_name ?? ""} ${b.name ?? ""}`)
        );
    },
    enabled: open && !!categoryId,
  });

  // Fetch training sessions for the category (last 30 days + next 7) for session picker
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["hrv-dialog-sessions", categoryId, recordDate],
    queryFn: async () => {
      const base = new Date(recordDate);
      const from = new Date(base); from.setDate(from.getDate() - 30);
      const to = new Date(base); to.setDate(to.getDate() + 7);
      const fmt = (d: Date) => d.toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("training_sessions")
        .select("id, session_date, training_type, notes")
        .eq("category_id", categoryId)
        .gte("session_date", fmt(from))
        .lte("session_date", fmt(to))
        .order("session_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!categoryId && recordType === "session",
  });

  useEffect(() => {
    if (!open) return;
    setSelectedPlayerId(defaultPlayerId || "");
    setSelectedSessionId(trainingSessionId || "");
  }, [defaultPlayerId, trainingSessionId, open]);

  useEffect(() => {
    if (!selectedPlayerId) return;
    if (playersLoading) return;
    if (!players.some((p: any) => p.id === selectedPlayerId)) {
      setSelectedPlayerId(defaultPlayerId || "");
    }
  }, [defaultPlayerId, players, playersLoading, selectedPlayerId]);

  const emptyPlayersMessage = useMemo(() => {
    if (playersLoading) return "Chargement des athlètes...";
    if (playersError) return "Impossible de charger les athlètes";
    if (activeSeasonOnly && activeSeasonId) return "Aucun athlète disponible pour cette saison.";
    return "Aucun athlète dans cette catégorie";
  }, [activeSeasonId, activeSeasonOnly, playersError, playersLoading]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPlayerId) throw new Error("Veuillez sélectionner un athlète");

      if (activeSeasonOnly && activeSeasonId) {
        const player = players.find((p: any) => p.id === selectedPlayerId);
        if (!player || player.season_id !== activeSeasonId) {
          throw new Error("Athlète hors saison active");
        }
      }

      const hasData = Object.values(hrvData).some((v) => v !== "");
      if (!hasData) throw new Error("Veuillez saisir au moins une valeur");

      const { error } = await supabase.from("hrv_records").insert({
        player_id: selectedPlayerId,
        category_id: categoryId,
        record_date: recordDate,
        record_type: recordType,
        hrv_ms: hrvData.hrv_ms ? parseFloat(hrvData.hrv_ms) : null,
        resting_hr_bpm: hrvData.resting_hr_bpm ? parseFloat(hrvData.resting_hr_bpm) : null,
        avg_hr_bpm: hrvData.avg_hr_bpm ? parseFloat(hrvData.avg_hr_bpm) : null,
        max_hr_bpm: hrvData.max_hr_bpm ? parseFloat(hrvData.max_hr_bpm) : null,
        zone1_minutes: hrvData.zone1_minutes ? parseFloat(hrvData.zone1_minutes) : null,
        zone2_minutes: hrvData.zone2_minutes ? parseFloat(hrvData.zone2_minutes) : null,
        zone3_minutes: hrvData.zone3_minutes ? parseFloat(hrvData.zone3_minutes) : null,
        zone4_minutes: hrvData.zone4_minutes ? parseFloat(hrvData.zone4_minutes) : null,
        zone5_minutes: hrvData.zone5_minutes ? parseFloat(hrvData.zone5_minutes) : null,
        training_session_id: recordType === "session" ? (selectedSessionId || trainingSessionId || null) : null,
        match_id: matchId || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hrv_records", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["training-load-hrv", categoryId] });
      toast.success("Données HRV enregistrées !");
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de l'enregistrement");
    },
  });

  const resetForm = () => {
    setHrvData(emptyHrvData);
    if (!defaultPlayerId) setSelectedPlayerId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-destructive" />
            Saisie HRV & Zones cardiaques
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-4 py-2">
            {/* Player selection */}
            {!defaultPlayerId && (
              <div className="space-y-2">
                <Label>Athlète *</Label>
                <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder={playersLoading ? "Chargement des athlètes..." : "Sélectionner un athlète"} />
                  </SelectTrigger>
                  <SelectContent className="z-[9999] bg-background border">
                    {players.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        {emptyPlayersMessage}
                      </div>
                    ) : (
                      players.map((player: any) => {
                        const label = player.first_name ? `${player.first_name} ${player.name}` : player.name;
                        return (
                          <SelectItem key={player.id} value={player.id}>
                            {label}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  La liste reprend les athlètes présents dans l'effectif de cette catégorie.
                </p>
              </div>
            )}

            {/* Date & Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Contexte</Label>
                <Select value={recordType} onValueChange={(v) => setRecordType(v as any)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    <SelectItem value="morning">Matin (repos)</SelectItem>
                    <SelectItem value="session">Séance</SelectItem>
                    <SelectItem value="test">Test</SelectItem>
                    <SelectItem value="competition">Compétition</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Optional session picker when context = Séance */}
            {recordType === "session" && !trainingSessionId && (
              <div className="space-y-2">
                <Label>Séance liée (optionnel)</Label>
                <Select value={selectedSessionId || "none"} onValueChange={(v) => setSelectedSessionId(v === "none" ? "" : v)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder={sessionsLoading ? "Chargement..." : "Aucune séance liée"} />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-[9999] max-h-72">
                    <SelectItem value="none">Aucune séance liée</SelectItem>
                    {sessions.map((s: any) => {
                      const label = `${s.session_date} · ${s.training_type || "Séance"}${s.notes ? ` — ${String(s.notes).slice(0, 40)}` : ""}`;
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          {label}
                        </SelectItem>
                      );
                    })}
                    {!sessionsLoading && sessions.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Aucune séance autour de cette date
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Lier la mesure HRV à une séance précise est facultatif. Sans sélection, la donnée reste enregistrée pour la date choisie.
                </p>
              </div>
            )}

            {/* HRV Input Section */}
            <HrvInputSection data={hrvData} onChange={setHrvData} />

          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={() => {
              if (!selectedPlayerId) {
                toast.error("Veuillez sélectionner un athlète");
                return;
              }
              saveMutation.mutate();
            }}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Enregistrer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
