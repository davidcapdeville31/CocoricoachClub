import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Save, Shield } from "lucide-react";

interface ManualRugbyStatsDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  matchId: string;
  isHome: boolean;
  opponentName?: string;
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

type Period = "H1" | "H2";
type PeriodStats = { H1: StatRow; H2: StatRow };

const EMPTY: StatRow = {
  tries: 0, conversionsMade: 0, conversionsMissed: 0,
  penaltiesMade: 0, penaltiesMissed: 0, drops: 0, dropsMissed: 0,
  tackles: 0, missedTackles: 0, knockOns: 0, fouls: 0,
  yellowCards: 0, redCards: 0,
};

const emptyPeriodStats = (): PeriodStats => ({ H1: { ...EMPTY }, H2: { ...EMPTY } });

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

const computePoints = (r: StatRow) =>
  r.tries * 5 + r.conversionsMade * 2 + r.penaltiesMade * 3 + r.drops * 3;

const sumPeriods = (ps: PeriodStats, fn: (r: StatRow) => number) => fn(ps.H1) + fn(ps.H2);

export function ManualRugbyStatsDialog({
  open, onOpenChange, matchId, isHome,
  opponentName = "Adversaire", clubName = "Notre équipe",
}: ManualRugbyStatsDialogProps) {
  const qc = useQueryClient();
  const clubSide: "home" | "away" = isHome ? "home" : "away";
  const oppSide: "home" | "away" = isHome ? "away" : "home";

  const [period, setPeriod] = useState<Period>("H1");
  const [stats, setStats] = useState<Record<string, PeriodStats>>({});
  const [opponent, setOpponent] = useState<PeriodStats>(emptyPeriodStats());
  const [saving, setSaving] = useState(false);
  const [confirmLiveOverwrite, setConfirmLiveOverwrite] = useState(false);

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

  useEffect(() => {
    if (open && hasLiveEvents) setConfirmLiveOverwrite(true);
  }, [open, hasLiveEvents]);

  // Pre-populate from existing events
  useEffect(() => {
    if (!open) return;
    const init: Record<string, PeriodStats> = {};
    lineup.forEach((l) => { init[l.player_id] = emptyPeriodStats(); });
    const opp: PeriodStats = emptyPeriodStats();

    const applyEvent = (target: StatRow, e: any) => {
      switch (e.event_type) {
        case "try": case "penalty_try": target.tries += 1; break;
        case "conversion":
          if (e.outcome === "success") target.conversionsMade += 1;
          else if (e.outcome === "fail") target.conversionsMissed += 1;
          break;
        case "penalty_kick":
          if (e.outcome === "success") target.penaltiesMade += 1;
          else if (e.outcome === "fail") target.penaltiesMissed += 1;
          break;
        case "drop":
          if (e.outcome === "success") target.drops += 1;
          else if (e.outcome === "fail") target.dropsMissed += 1;
          break;
        case "tackle":
          if (e.outcome === "fail") target.missedTackles += 1; else target.tackles += 1;
          break;
        case "missed_tackle": target.missedTackles += 1; break;
        case "knock_on": target.knockOns += 1; break;
        case "foul": target.fouls += 1; break;
        case "yellow_card": target.yellowCards += 1; break;
        case "red_card": target.redCards += 1; break;
      }
    };

    existingEvents.forEach((e: any) => {
      const per: Period = (e.period === "H2" || e.period === "ET") ? "H2" : "H1";
      if (e.team_side === oppSide) {
        applyEvent(opp[per], e);
      } else if (e.player_id && init[e.player_id]) {
        applyEvent(init[e.player_id][per], e);
      }
    });
    setStats(init);
    setOpponent(opp);
    setPeriod("H1");
  }, [open, lineup, existingEvents, oppSide]);

  const sortedLineup = useMemo(
    () => [...lineup].sort((a, b) => (a.position ?? 99) - (b.position ?? 99)),
    [lineup]
  );

  const updatePlayerStat = (playerId: string, key: keyof StatRow, value: number) => {
    setStats((prev) => {
      const cur = prev[playerId] ?? emptyPeriodStats();
      return {
        ...prev,
        [playerId]: { ...cur, [period]: { ...cur[period], [key]: Math.max(0, value || 0) } },
      };
    });
  };

  const updateOpponentStat = (key: keyof StatRow, value: number) => {
    setOpponent((prev) => ({
      ...prev,
      [period]: { ...prev[period], [key]: Math.max(0, value || 0) },
    }));
  };

  // Live computed scores (sum of both halves)
  const clubScore = useMemo(
    () => Object.values(stats).reduce((s, ps) => s + sumPeriods(ps, computePoints), 0),
    [stats]
  );
  const opponentScore = useMemo(() => sumPeriods(opponent, computePoints), [opponent]);

  const buildEvents = () => {
    const events: any[] = [];
    const push = (
      side: "home" | "away", player_id: string | null, per: Period,
      event_type: string, outcome: string | null, points = 0
    ) => {
      events.push({
        match_id: matchId, team_side: side, player_id,
        minute: 0, second: 0, period: per, event_type, outcome, points,
        metadata: { source: "manual" },
      });
    };
    const pushAll = (side: "home" | "away", pid: string | null, per: Period, r: StatRow) => {
      for (let i = 0; i < r.tries; i++) push(side, pid, per, "try", null, 5);
      for (let i = 0; i < r.conversionsMade; i++) push(side, pid, per, "conversion", "success", 2);
      for (let i = 0; i < r.conversionsMissed; i++) push(side, pid, per, "conversion", "fail", 0);
      for (let i = 0; i < r.penaltiesMade; i++) push(side, pid, per, "penalty_kick", "success", 3);
      for (let i = 0; i < r.penaltiesMissed; i++) push(side, pid, per, "penalty_kick", "fail", 0);
      for (let i = 0; i < r.drops; i++) push(side, pid, per, "drop", "success", 3);
      for (let i = 0; i < r.dropsMissed; i++) push(side, pid, per, "drop", "fail", 0);
      for (let i = 0; i < r.tackles; i++) push(side, pid, per, "tackle", "success", 0);
      for (let i = 0; i < r.missedTackles; i++) push(side, pid, per, "tackle", "fail", 0);
      for (let i = 0; i < r.knockOns; i++) push(side, pid, per, "knock_on", null, 0);
      for (let i = 0; i < r.fouls; i++) push(side, pid, per, "foul", null, 0);
      for (let i = 0; i < r.yellowCards; i++) push(side, pid, per, "yellow_card", null, 0);
      for (let i = 0; i < r.redCards; i++) push(side, pid, per, "red_card", null, 0);
    };

    Object.entries(stats).forEach(([pid, ps]) => {
      pushAll(clubSide, pid, "H1", ps.H1);
      pushAll(clubSide, pid, "H2", ps.H2);
    });
    pushAll(oppSide, null, "H1", opponent.H1);
    pushAll(oppSide, null, "H2", opponent.H2);
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
              Renseignez les totaux par mi-temps. Les scores sont calculés automatiquement à partir
              des essais, transformations, pénalités et drops des deux équipes.
            </DialogDescription>
          </DialogHeader>

          {/* Live score header (sum of both halves) */}
          <div className="rounded-lg border bg-muted/40 p-3 flex items-center justify-around gap-4">
            <div className="text-center">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{clubName}</div>
              <div className="text-3xl font-bold tabular-nums text-primary">{clubScore}</div>
            </div>
            <div className="text-2xl font-bold text-muted-foreground">–</div>
            <div className="text-center">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{opponentName}</div>
              <div className="text-3xl font-bold tabular-nums text-rose-600 dark:text-rose-400">{opponentScore}</div>
            </div>
          </div>

          {/* Period selector */}
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="H1">1ʳᵉ mi-temps</TabsTrigger>
              <TabsTrigger value="H2">2ᵉ mi-temps</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex-1 overflow-auto space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : sortedLineup.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                Aucun joueur dans la composition. Ajoutez d'abord la composition du match.
              </p>
            ) : (
              <>
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
                      const row = (stats[l.player_id] ?? emptyPeriodStats())[period];
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
                                onChange={(e) => updatePlayerStat(l.player_id, f.key, parseInt(e.target.value) || 0)}
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

                {/* Opponent block */}
                <div className="rounded-lg border-2 border-rose-300 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    <h3 className="text-sm font-semibold">Équipe adverse — {opponentName}</h3>
                    <span className="text-xs text-muted-foreground ml-auto">{period === "H1" ? "1ʳᵉ MT" : "2ᵉ MT"}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-2">
                    {FIELDS.map((f) => (
                      <div key={f.key} className="flex flex-col items-center gap-1">
                        <label className="text-[10px] text-muted-foreground text-center" title={f.label}>{f.short}</label>
                        <Input
                          type="number"
                          min={0}
                          value={opponent[period][f.key] === 0 ? "" : String(opponent[period][f.key])}
                          onChange={(e) => updateOpponentStat(f.key, parseInt(e.target.value) || 0)}
                          className="h-8 w-16 text-xs text-center"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
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
