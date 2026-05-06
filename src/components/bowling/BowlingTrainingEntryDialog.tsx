import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Target, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { BowlingScoreSheet } from "@/components/athlete-portal/BowlingScoreSheet";
import { SPARE_EXERCISE_TYPES } from "@/lib/constants/bowlingBallBrands";

interface Props {
  open: boolean;
  onClose: () => void;
  playerId: string;
  categoryId: string;
  defaultDate?: string;
}

export function BowlingTrainingEntryDialog({ open, onClose, playerId, categoryId, defaultDate }: Props) {
  const [sessionDate, setSessionDate] = useState(defaultDate || format(new Date(), "yyyy-MM-dd"));
  const [tab, setTab] = useState("game");
  const [showSheet, setShowSheet] = useState(false);
  const [spareType, setSpareType] = useState("spare_pin_7");
  const [spareAttempts, setSpareAttempts] = useState("");
  const [spareSuccesses, setSpareSuccesses] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();

  // Today's parties for this player
  const { data: rounds = [] } = useQuery({
    queryKey: ["bowling-athlete-training-rounds", categoryId, playerId, sessionDate],
    enabled: open,
    queryFn: async () => {
      const { data: matches } = await supabase
        .from("matches")
        .select("id")
        .eq("category_id", categoryId)
        .eq("event_type", "training")
        .eq("match_date", sessionDate);
      if (!matches?.length) return [];
      const ids = matches.map(m => m.id);
      const { data } = await supabase
        .from("competition_rounds")
        .select("id, round_number, result, created_at")
        .in("match_id", ids)
        .eq("player_id", playerId)
        .order("round_number");
      return data || [];
    },
  });

  // Today's spares for this player
  const { data: spares = [] } = useQuery({
    queryKey: ["bowling-athlete-spares", categoryId, playerId, sessionDate],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("bowling_spare_training" as any)
        .select("*")
        .eq("player_id", playerId)
        .eq("category_id", categoryId)
        .eq("session_date", sessionDate)
        .order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  const callEdge = async (payload: any) => {
    const { data, error } = await supabase.functions.invoke("athlete-bowling-training", {
      body: { category_id: categoryId, player_id: playerId, session_date: sessionDate, ...payload },
    });
    if (error) return { success: false, error: error.message };
    return data;
  };

  const handleSaveGame = async (stats: any, frames: any, ballData?: any) => {
    setSubmitting(true);
    const result = await callEdge({ action: "save_game", stats, frames, ballData });
    setSubmitting(false);
    if (result?.success) {
      toast.success(`Partie enregistrée : ${stats.totalScore} pts`);
      setShowSheet(false);
      qc.invalidateQueries({ queryKey: ["bowling-athlete-training-rounds"] });
      qc.invalidateQueries({ queryKey: ["bowling_training_stats"] });
      qc.invalidateQueries({ queryKey: ["bowling-training-rounds"] });
      qc.invalidateQueries({ queryKey: ["bowling-training-match"] });
    } else {
      toast.error(result?.error || "Erreur lors de l'enregistrement");
    }
  };

  const handleSaveSpare = async () => {
    const a = parseInt(spareAttempts);
    const s = parseInt(spareSuccesses);
    if (isNaN(a) || a <= 0) return toast.error("Tentatives invalides");
    if (isNaN(s) || s < 0 || s > a) return toast.error("Réussites invalides");
    setSubmitting(true);
    const result = await callEdge({ action: "save_spare", exercise_type: spareType, attempts: a, successes: s });
    setSubmitting(false);
    if (result?.success) {
      toast.success("Exercice enregistré");
      setSpareAttempts("");
      setSpareSuccesses("");
      qc.invalidateQueries({ queryKey: ["bowling-athlete-spares"] });
      qc.invalidateQueries({ queryKey: ["bowling_spare_training"] });
      qc.invalidateQueries({ queryKey: ["bowling_training_stats"] });
    } else {
      toast.error(result?.error || "Erreur");
    }
  };

  const previewRate = (() => {
    const a = parseInt(spareAttempts);
    const s = parseInt(spareSuccesses);
    if (a > 0 && s >= 0 && s <= a) return ((s / a) * 100).toFixed(1);
    return null;
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl h-[92vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            Entraînement bowling
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-3 shrink-0">
          <Label className="text-xs">Date de l'entraînement</Label>
          <Input
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            className="mt-1 max-w-xs"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="game" className="gap-1.5">
                <Trophy className="h-4 w-4" /> Parties
              </TabsTrigger>
              <TabsTrigger value="spare" className="gap-1.5">
                <Target className="h-4 w-4" /> Précision
              </TabsTrigger>
            </TabsList>

            <TabsContent value="game" className="space-y-3">
              {!showSheet ? (
                <>
                  <Button onClick={() => setShowSheet(true)} className="w-full gap-2">
                    <Plus className="h-4 w-4" />
                    Nouvelle partie
                  </Button>
                  {rounds.length > 0 && (
                    <Card>
                      <CardContent className="pt-4 space-y-2">
                        <p className="text-sm font-medium">
                          Parties du {format(new Date(sessionDate), "d MMM yyyy", { locale: fr })}
                        </p>
                        {rounds.map((r: any) => (
                          <div key={r.id} className="flex items-center justify-between p-2.5 rounded-lg border">
                            <Badge variant="secondary" className="font-mono text-xs">#{r.round_number}</Badge>
                            <span className="text-lg font-bold text-primary">{r.result}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => setShowSheet(false)}>
                      Annuler
                    </Button>
                  </div>
                  <BowlingScoreSheet
                    playerId={playerId}
                    categoryId={categoryId}
                    onSave={handleSaveGame}
                    onCancel={() => setShowSheet(false)}
                  />
                  {submitting && <p className="text-xs text-muted-foreground text-center">Enregistrement…</p>}
                </div>
              )}
            </TabsContent>

            <TabsContent value="spare" className="space-y-3">
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div>
                    <Label>Type d'exercice</Label>
                    <Select value={spareType} onValueChange={setSpareType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SPARE_EXERCISE_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Lancers</Label>
                      <Input type="number" inputMode="numeric" value={spareAttempts}
                        onChange={(e) => setSpareAttempts(e.target.value)} placeholder="50" min="1" />
                    </div>
                    <div>
                      <Label>Réussis</Label>
                      <Input type="number" inputMode="numeric" value={spareSuccesses}
                        onChange={(e) => setSpareSuccesses(e.target.value)} placeholder="35" min="0" />
                    </div>
                  </div>
                  {previewRate && (
                    <div className="text-center p-3 rounded-lg bg-primary/10">
                      <p className="text-2xl font-bold text-primary">{previewRate}%</p>
                      <p className="text-xs text-muted-foreground">Taux de réussite</p>
                    </div>
                  )}
                  <Button className="w-full" onClick={handleSaveSpare} disabled={submitting}>
                    {submitting ? "Enregistrement…" : "Enregistrer l'exercice"}
                  </Button>
                </CardContent>
              </Card>

              {spares.length > 0 && (
                <Card>
                  <CardContent className="pt-4 space-y-2">
                    <p className="text-sm font-medium">Exercices du jour</p>
                    {spares.map((ex: any) => {
                      const label = SPARE_EXERCISE_TYPES.find(t => t.value === ex.exercise_type)?.label || ex.exercise_type;
                      const rate = ex.attempts > 0 ? ((ex.successes / ex.attempts) * 100).toFixed(1) : "0";
                      return (
                        <div key={ex.id} className="flex items-center justify-between p-2.5 rounded-lg border">
                          <div>
                            <Badge variant="secondary" className="text-xs">{label}</Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {ex.successes}/{ex.attempts}
                            </p>
                          </div>
                          <span className="text-lg font-bold text-primary">{rate}%</span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
