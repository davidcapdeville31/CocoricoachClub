import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeftRight, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { MatchEvent, Period, TeamSide } from "../types";

export interface LineupRow {
  player_id: string;
  position: string | null;
  is_starter: boolean;
  players?: { id: string; name?: string | null; first_name?: string | null } | null;
}

interface SubstitutionDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  matchId: string;
  lineup: LineupRow[];
  teamSide: TeamSide;
  period: Period;
  defaultMinute: number;
  defaultSecond: number;
  onCreateEvent: (payload: Partial<MatchEvent>) => Promise<unknown> | void;
}

const fullName = (p?: LineupRow["players"]) =>
  [p?.first_name, p?.name].filter(Boolean).join(" ").trim() || "Joueur";

export function SubstitutionDialog({
  open, onOpenChange, matchId, lineup, teamSide, period, defaultMinute, defaultSecond, onCreateEvent,
}: SubstitutionDialogProps) {
  const qc = useQueryClient();
  const [minute, setMinute] = useState(defaultMinute);
  const [second, setSecond] = useState(defaultSecond);
  const [outId, setOutId] = useState<string | null>(null);
  const [inId, setInId] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("tactical");

  useEffect(() => {
    if (open) {
      setMinute(defaultMinute);
      setSecond(defaultSecond);
      setOutId(null);
      setInId(null);
      setReason("tactical");
    }
  }, [open, defaultMinute, defaultSecond]);

  const starters = useMemo(
    () => [...lineup.filter((l) => l.is_starter)].sort((a, b) => {
      const pa = parseInt(a.position ?? "99") || 99;
      const pb = parseInt(b.position ?? "99") || 99;
      return pa - pb;
    }),
    [lineup]
  );
  const bench = useMemo(
    () => [...lineup.filter((l) => !l.is_starter)].sort((a, b) => fullName(a.players).localeCompare(fullName(b.players))),
    [lineup]
  );

  const out = starters.find((s) => s.player_id === outId) ?? null;
  const incoming = bench.find((s) => s.player_id === inId) ?? null;

  const swap = useMutation({
    mutationFn: async () => {
      if (!out || !incoming) throw new Error("Sélectionne un titulaire et un remplaçant");
      // 1) Remplaçant prend la place du titulaire
      const { error: e1 } = await supabase
        .from("match_lineups")
        .update({ is_starter: true, position: out.position })
        .eq("match_id", matchId)
        .eq("player_id", incoming.player_id);
      if (e1) throw e1;
      // 2) Titulaire devient remplaçant (libère sa position)
      const { error: e2 } = await supabase
        .from("match_lineups")
        .update({ is_starter: false, position: null })
        .eq("match_id", matchId)
        .eq("player_id", out.player_id);
      if (e2) throw e2;
      // 3) Crée l'événement substitution
      await onCreateEvent({
        team_side: teamSide,
        minute,
        second,
        period,
        event_type: "substitution",
        player_id: incoming.player_id, // entrant comme acteur principal
        outcome: null,
        metadata: {
          player_out: out.player_id,
          player_out_name: fullName(out.players),
          player_in: incoming.player_id,
          player_in_name: fullName(incoming.players),
          position: out.position,
          reason,
        },
      });
    },
    onSuccess: () => {
      toast.success("Changement effectué");
      qc.invalidateQueries({ queryKey: ["match-live-lineup", matchId] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur lors du changement"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ArrowLeftRight className="h-5 w-5 text-primary" /> Remplacement
          </DialogTitle>
          <DialogDescription>
            Sélectionne le joueur à sortir, puis son remplaçant. La composition est mise à jour automatiquement.
          </DialogDescription>
        </DialogHeader>

        {/* Chrono */}
        <div className="grid grid-cols-[auto_auto_1fr] gap-3 items-end">
          <div>
            <Label className="text-xs">Min</Label>
            <Input type="number" min={0} max={120} value={minute}
              onChange={(e) => setMinute(parseInt(e.target.value) || 0)} className="h-10 mt-1 w-20" />
          </div>
          <div>
            <Label className="text-xs">Sec</Label>
            <Input type="number" min={0} max={59} value={second}
              onChange={(e) => setSecond(parseInt(e.target.value) || 0)} className="h-10 mt-1 w-20" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Motif</Label>
            <div className="grid grid-cols-3 gap-1.5 mt-1">
              {[
                { v: "tactical", l: "Tactique" },
                { v: "injury", l: "Blessure" },
                { v: "hia", l: "HIA / Sang" },
              ].map((o) => (
                <Button key={o.v} type="button" variant="outline"
                  onClick={() => setReason(o.v)}
                  className={`h-9 text-xs border-2 ${reason === o.v ? "bg-primary text-primary-foreground border-primary" : "bg-transparent"}`}>
                  {o.l}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Récap sélection */}
        <div className="flex items-center justify-center gap-3 rounded-lg bg-muted/50 p-3 my-2">
          <div className="flex-1 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Sort</div>
            {out ? (
              <Badge variant="destructive" className="text-sm py-1 px-3">
                {out.position ? `#${out.position} · ` : ""}{fullName(out.players)}
              </Badge>
            ) : (
              <div className="text-xs text-muted-foreground italic">Aucun joueur sélectionné</div>
            )}
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Entre</div>
            {incoming ? (
              <Badge className="text-sm py-1 px-3 bg-green-600 hover:bg-green-600">
                {fullName(incoming.players)}
                {out?.position ? ` → #${out.position}` : ""}
              </Badge>
            ) : (
              <div className="text-xs text-muted-foreground italic">Aucun remplaçant sélectionné</div>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Titulaires */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-wider">Titulaires ({starters.length})</h3>
            </div>
            <div className="space-y-1 max-h-[40vh] overflow-y-auto pr-1">
              {starters.length === 0 && (
                <div className="text-xs text-muted-foreground italic p-2">Aucun titulaire dans la composition.</div>
              )}
              {starters.map((s) => {
                const active = outId === s.player_id;
                return (
                  <button
                    key={s.player_id}
                    type="button"
                    onClick={() => setOutId(active ? null : s.player_id)}
                    className={`w-full flex items-center gap-2 rounded-md border-2 px-3 py-2 text-left text-sm transition-all
                      ${active
                        ? "bg-destructive/15 border-destructive ring-2 ring-destructive/30"
                        : "bg-card border-border hover:bg-accent"}`}
                  >
                    <span className="inline-flex items-center justify-center min-w-[2rem] h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      {s.position ?? "?"}
                    </span>
                    <span className="flex-1 truncate">{fullName(s.players)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Remplaçants */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ArrowRight className="h-4 w-4 text-green-600" />
              <h3 className="text-sm font-bold uppercase tracking-wider">Banc ({bench.length})</h3>
            </div>
            <div className="space-y-1 max-h-[40vh] overflow-y-auto pr-1">
              {bench.length === 0 && (
                <div className="text-xs text-muted-foreground italic p-2">Aucun remplaçant dans la composition.</div>
              )}
              {bench.map((s) => {
                const active = inId === s.player_id;
                return (
                  <button
                    key={s.player_id}
                    type="button"
                    onClick={() => setInId(active ? null : s.player_id)}
                    className={`w-full flex items-center gap-2 rounded-md border-2 px-3 py-2 text-left text-sm transition-all
                      ${active
                        ? "bg-green-600/15 border-green-600 ring-2 ring-green-600/30"
                        : "bg-card border-border hover:bg-accent"}`}
                  >
                    <span className="inline-flex items-center justify-center min-w-[2rem] h-7 rounded-full bg-muted text-muted-foreground text-xs font-bold">
                      R
                    </span>
                    <span className="flex-1 truncate">{fullName(s.players)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            onClick={() => swap.mutate()}
            disabled={!out || !incoming || swap.isPending}
            className="bg-primary"
          >
            <ArrowLeftRight className="h-4 w-4 mr-1" />
            {swap.isPending ? "Application…" : "Valider le changement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
