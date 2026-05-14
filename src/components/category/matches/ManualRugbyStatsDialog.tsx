import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

interface ManualRugbyStatsDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  matchId: string;
  isHome: boolean;
  opponentName?: string;
  initialOpponentScore?: number | null;
  clubName?: string;
}

type StatRow = {
  tries: number;
  conversionsMade: number; conversionsMissed: number;
  penaltiesMade: number; penaltiesMissed: number;
  drops: number; dropsMissed: number;
  tackles: number; missedTackles: number;
  knockOns: number; fouls: number;
  yellowCards: number; redCards: number;
};

const EMPTY: StatRow = {
  tries: 0, conversionsMade: 0, conversionsMissed: 0,
  penaltiesMade: 0, penaltiesMissed: 0, drops: 0, dropsMissed: 0,
  tackles: 0, missedTackles: 0, knockOns: 0, fouls: 0,
  yellowCards: 0, redCards: 0,
};

const FIELDS: { key: keyof StatRow; label: string; short: string }[] = [
  { key: "tries", label: "Essais", short: "Essais" },
  { key: "conversionsMade", label: "Transformations réussies", short: "Tr ✓" },
  { key: "conversionsMissed", label: "Transformations manquées", short: "Tr ✗" },
  { key: "penaltiesMade", label: "Pénalités réussies", short: "Pén ✓" },
  { key: "penaltiesMissed", label: "Pénalités manquées", short: "Pén ✗" },
  { key: "drops", label: "Drops réussis", short: "Drop ✓" },
  { key: "dropsMissed", label: "Drops manqués", short: "Drop ✗" },
  { key: "tackles", label: "Plaquages", short: "Plaq" },
  { key: "missedTackles", label: "Plaquages manqués", short: "Plaq ✗" },
  { key: "knockOns", label: "En-avants", short: "En-av" },
  { key: "fouls", label: "Fautes", short: "Fautes" },
  { key: "yellowCards", label: "Cartons jaunes", short: "J" },
  { key: "redCards", label: "Cartons rouges", short: "R" },
];

export function ManualRugbyStatsDialog({
  open, onOpenChange, matchId, isHome,
  opponentName = "Adversaire", initialOpponentScore = null, clubName = "Notre équipe",
}: ManualRugbyStatsDialogProps) {
  const qc = useQueryClient();
  const clubSide: "home" | "away" = isHome ? "home" : "away";
  const [stats, setStats] = useState<Record<string, StatRow>>({});
  const [opponentScore, setOpponentScore] = useState<number>(initialOpponentScore ?? 0);
  const [saving, setSaving] = useState(false);
  const [confirmLiveOverwrite, setConfirmLiveOverwrite] = useState(false);

  // Sync opponent score when prop updates / dialog reopens
  useEffect(() => {
    if (open) setOpponentScore(initialOpponentScore ?? 0);
  }, [open, initialOpponentScore]);

  // Live computed club score from manual entries
  const clubScore = useMemo(() => {
    return Object.values(stats).reduce((sum, r) => sum +
      r.tries * 5 + r.conversionsMade * 2 + r.penaltiesMade * 3 + r.drops * 3, 0);
  }, [stats]);

  const { data: lineup = [], isLoading } = useQuery({
    queryKey: ["manual-stats-lineup", matchId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_lineups")
        .select("player_id, position, is_starter, players(id, name, first_name)")
        .eq("match_id", matchId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: existingEvents = [] } = useQuery({
    queryKey: ["manual-stats-events", matchId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_events" as any)
        .select("*")
        .eq("match_id", matchId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const hasLiveEvents = useMemo(
    () => existingEvents.some((e: any) => (e.metadata?.source ?? null) !== "manual"),
    [existingEvents]
  );

  // Detect live data on open
  useEffect(() => {
    if (open && hasLiveEvents) setConfirmLiveOverwrite(true);
  }, [open, hasLiveEvents]);

  // Pre-populate from existing events
  useEffect(() => {
    if (!open) return;
    const init: Record<string, StatRow> = {};
    lineup.forEach((l) => { init[l.player_id] = { ...EMPTY }; });
    existingEvents.forEach((e: any) => {
      if (!e.player_id || !init[e.player_id]) return;
      const r = init[e.player_id];
      switch (e.event_type) {
        case "try": case "penalty_try": r.tries += 1; break;
        case "conversion":
          if (e.outcome === "success") r.conversionsMade += 1;
          else if (e.outcome === "fail") r.conversionsMissed += 1;
          break;
        case "penalty_kick":
          if (e.outcome === "success") r.penaltiesMade += 1;
          else if (e.outcome === "fail") r.penaltiesMissed += 1;
          break;
        case "drop":
          if (e.outcome === "success") r.drops += 1;
          else if (e.outcome === "fail") r.dropsMissed += 1;
          break;
        case "tackle":
          if (e.outcome === "fail") r.missedTackles += 1; else r.tackles += 1;
          break;
        case "missed_tackle": r.missedTackles += 1; break;
        case "knock_on": r.knockOns += 1; break;
        case "foul": r.fouls += 1; break;
        case "yellow_card": r.yellowCards += 1; break;
        case "red_card": r.redCards += 1; break;
      }
    });
    setStats(init);
  }, [open, lineup, existingEvents]);

  const sortedLineup = useMemo(() => {
    return [...lineup].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  }, [lineup]);

  const updateStat = (playerId: string, key: keyof StatRow, value: number) => {
    setStats((prev) => ({
      ...prev,
      [playerId]: { ...(prev[playerId] ?? EMPTY), [key]: Math.max(0, value || 0) },
    }));
  };

  const buildEvents = () => {
    const events: any[] = [];
    const push = (player_id: string, event_type: string, outcome: string | null, points = 0) => {
      events.push({
        match_id: matchId, team_side: clubSide, player_id,
        minute: 0, second: 0, period: "H1", event_type, outcome, points,
        metadata: { source: "manual" },
      });
    };
    Object.entries(stats).forEach(([pid, r]) => {
      for (let i = 0; i < r.tries; i++) push(pid, "try", null, 5);
      for (let i = 0; i < r.conversionsMade; i++) push(pid, "conversion", "success", 2);
      for (let i = 0; i < r.conversionsMissed; i++) push(pid, "conversion", "fail", 0);
      for (let i = 0; i < r.penaltiesMade; i++) push(pid, "penalty_kick", "success", 3);
      for (let i = 0; i < r.penaltiesMissed; i++) push(pid, "penalty_kick", "fail", 0);
      for (let i = 0; i < r.drops; i++) push(pid, "drop", "success", 3);
      for (let i = 0; i < r.dropsMissed; i++) push(pid, "drop", "fail", 0);
      for (let i = 0; i < r.tackles; i++) push(pid, "tackle", "success", 0);
      for (let i = 0; i < r.missedTackles; i++) push(pid, "tackle", "fail", 0);
      for (let i = 0; i < r.knockOns; i++) push(pid, "knock_on", null, 0);
      for (let i = 0; i < r.fouls; i++) push(pid, "foul", null, 0);
      for (let i = 0; i < r.yellowCards; i++) push(pid, "yellow_card", null, 0);
      for (let i = 0; i < r.redCards; i++) push(pid, "red_card", null, 0);
    });
    return events;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error: delErr } = await supabase.from("match_events" as any).delete().eq("match_id", matchId);
      if (delErr) throw delErr;
      const events = buildEvents().map((e) => ({ ...e, created_by: u.user?.id ?? null }));
      if (events.length > 0) {
        const { error: insErr } = await supabase.from("match_events" as any).insert(events);
        if (insErr) throw insErr;
      }
      // Persist computed club score + opponent score on the match
      const scorePatch = isHome
        ? { score_home: clubScore, score_away: opponentScore }
        : { score_away: clubScore, score_home: opponentScore };
      const { error: matchErr } = await supabase.from("matches").update(scorePatch as any).eq("id", matchId);
      if (matchErr) throw matchErr;
      toast.success("Statistiques enregistrées");
      qc.invalidateQueries({ queryKey: ["match_events", matchId] });
      qc.invalidateQueries({ queryKey: ["analytics_match_events", matchId] });
      qc.invalidateQueries({ queryKey: ["manual-stats-events", matchId] });
      qc.invalidateQueries({ queryKey: ["matches"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] md:max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Saisie manuelle des statistiques</DialogTitle>
            <DialogDescription>
              Renseignez les totaux par joueur. À la sauvegarde, toutes les statistiques précédentes
              de ce match seront remplacées.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : sortedLineup.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                Aucun joueur dans la composition. Ajoutez d'abord la composition du match.
              </p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="border-b">
                    <th className="text-left px-2 py-2 sticky left-0 bg-background z-10 min-w-[160px]">Joueur</th>
                    {FIELDS.map((f) => (
                      <th key={f.key} className="px-1 py-2 text-center text-xs font-medium text-muted-foreground" title={f.label}>
                        {f.short}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedLineup.map((l) => {
                    const p = l.players;
                    const name = [p?.first_name, p?.name].filter(Boolean).join(" ") || "Joueur";
                    const row = stats[l.player_id] ?? EMPTY;
                    const isSub = !l.is_starter;
                    return (
                      <tr key={l.player_id} className={`border-b hover:bg-muted/30 ${isSub ? "bg-orange-50/30 dark:bg-orange-950/10" : ""}`}>
                        <td className="px-2 py-1.5 sticky left-0 bg-background z-10 border-r">
                          <div className="flex items-center gap-1.5">
                            <Badge variant={isSub ? "outline" : "default"} className="text-[10px] font-mono px-1.5 py-0 h-5">
                              {isSub ? `R` : `#${l.position ?? "?"}`}
                            </Badge>
                            <span className="text-xs font-medium truncate max-w-[140px]">{name}</span>
                          </div>
                        </td>
                        {FIELDS.map((f) => (
                          <td key={f.key} className="px-0.5 py-0.5 text-center">
                            <Input
                              type="number"
                              min={0}
                              value={row[f.key] === 0 ? "" : String(row[f.key])}
                              onChange={(e) => updateStat(l.player_id, f.key, parseInt(e.target.value) || 0)}
                              className="h-7 w-14 text-xs text-center mx-auto"
                              placeholder="0"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving || sortedLineup.length === 0} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmLiveOverwrite} onOpenChange={setConfirmLiveOverwrite}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Statistiques temps réel détectées</AlertDialogTitle>
            <AlertDialogDescription>
              Des statistiques ont déjà été saisies en temps réel pour ce match. Si vous validez
              une saisie manuelle, ces données seront <strong>remplacées</strong>. Souhaitez-vous
              continuer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setConfirmLiveOverwrite(false); onOpenChange(false); }}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => setConfirmLiveOverwrite(false)}>
              Continuer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
