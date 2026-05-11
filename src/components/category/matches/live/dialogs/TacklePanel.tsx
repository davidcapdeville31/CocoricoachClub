import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchEvent, Period, TeamSide } from "../types";

interface PlayerOpt { id: string; label: string }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  players: PlayerOpt[];
  teamSide: TeamSide;
  period: Period;
  minute: number;
  second: number;
  onRecord: (payload: Partial<MatchEvent>) => void | Promise<void>;
  // counts per player from current match stats
  counts: Record<string, { tackles: number; missedTackles: number }>;
}

export function TacklePanel({ open, onOpenChange, players, teamSide, period, minute, second, onRecord, counts }: Props) {
  const [flash, setFlash] = useState<{ id: string; kind: "success" | "fail" } | null>(null);

  const record = (playerId: string, kind: "success" | "fail") => {
    setFlash({ id: playerId, kind });
    window.setTimeout(() => setFlash((f) => (f?.id === playerId && f.kind === kind ? null : f)), 250);
    onRecord({
      team_side: teamSide,
      event_type: "tackle",
      outcome: kind,
      player_id: playerId,
      minute,
      second,
      period,
      points: 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>Plaquages — Mode rapide</span>
            <span className="text-xs font-normal text-muted-foreground font-mono tabular-nums">
              {String(minute).padStart(2, "0")}'{String(second).padStart(2, "0")} · {period}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 flex-1 min-h-0">
          {/* RÉUSSIS */}
          <div className="flex flex-col min-h-0 border-r">
            <div className="sticky top-0 z-10 bg-green-600 text-white px-4 py-3 font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shrink-0">
              <CheckCircle2 className="h-5 w-5" /> Plaquages réussis
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {players.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">Aucun joueur dans la feuille de match.</p>
              )}
              {players.map((p) => {
                const c = counts[p.id]?.tackles ?? 0;
                const isFlash = flash?.id === p.id && flash.kind === "success";
                return (
                  <button
                    key={`s-${p.id}`}
                    onClick={() => record(p.id, "success")}
                    className={cn(
                      "w-full h-16 px-4 rounded-2xl bg-green-600 hover:bg-green-500 active:bg-green-700",
                      "text-white font-bold text-lg shadow-md transition-all",
                      "flex items-center justify-between gap-3 select-none",
                      isFlash && "ring-4 ring-green-300 scale-[0.98]"
                    )}
                  >
                    <span className="truncate text-left">{p.label}</span>
                    <span className="font-mono text-base bg-black/25 rounded-lg px-3 py-1 tabular-nums shrink-0">{c}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* MANQUÉS */}
          <div className="flex flex-col min-h-0">
            <div className="sticky top-0 z-10 bg-red-600 text-white px-4 py-3 font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shrink-0">
              <XCircle className="h-5 w-5" /> Plaquages manqués
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {players.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">Aucun joueur dans la feuille de match.</p>
              )}
              {players.map((p) => {
                const c = counts[p.id]?.missedTackles ?? 0;
                const isFlash = flash?.id === p.id && flash.kind === "fail";
                return (
                  <button
                    key={`f-${p.id}`}
                    onClick={() => record(p.id, "fail")}
                    className={cn(
                      "w-full h-16 px-4 rounded-2xl bg-red-600 hover:bg-red-500 active:bg-red-700",
                      "text-white font-bold text-lg shadow-md transition-all",
                      "flex items-center justify-between gap-3 select-none",
                      isFlash && "ring-4 ring-red-300 scale-[0.98]"
                    )}
                  >
                    <span className="truncate text-left">{p.label}</span>
                    <span className="font-mono text-base bg-black/25 rounded-lg px-3 py-1 tabular-nums shrink-0">{c}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-4 py-2 border-t text-center text-xs text-muted-foreground shrink-0">
          1 clic = 1 plaquage enregistré · les compteurs et la timeline se mettent à jour en direct.
        </div>
      </DialogContent>
    </Dialog>
  );
}
