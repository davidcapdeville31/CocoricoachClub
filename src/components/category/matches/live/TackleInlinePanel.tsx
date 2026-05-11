import { useState } from "react";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchEvent, Period, TeamSide } from "../types";

interface PlayerOpt { id: string; label: string }

interface Props {
  players: PlayerOpt[];
  teamSide: TeamSide;
  period: Period;
  minute: number;
  second: number;
  onRecord: (payload: Partial<MatchEvent>) => void | Promise<void>;
  counts: Record<string, { tackles: number; missedTackles: number }>;
}

export function TackleInlinePanel({ players, teamSide, period, minute, second, onRecord, counts }: Props) {
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
    <Card className="p-3 mt-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Plaquages — 1 clic</h3>
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
          {String(minute).padStart(2, "0")}'{String(second).padStart(2, "0")} · {period}
        </span>
      </div>

      {players.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-4">Aucun joueur dans la feuille de match.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {/* Réussis */}
          <div className="space-y-1.5">
            <div className="sticky top-0 z-10 bg-green-600 text-white text-center py-1.5 rounded-lg font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Réussis
            </div>
            {players.map((p) => {
              const c = counts[p.id]?.tackles ?? 0;
              const isFlash = flash?.id === p.id && flash.kind === "success";
              return (
                <button
                  key={`s-${p.id}`}
                  onClick={() => record(p.id, "success")}
                  className={cn(
                    "w-full h-11 px-2 rounded-xl bg-green-600 hover:bg-green-500 active:bg-green-700",
                    "text-white font-semibold text-xs shadow transition-all",
                    "flex items-center justify-between gap-2 select-none",
                    isFlash && "ring-2 ring-green-300 scale-[0.97]"
                  )}
                >
                  <span className="truncate text-left">{p.label}</span>
                  <span className="font-mono text-[11px] bg-black/25 rounded px-1.5 py-0.5 tabular-nums shrink-0">{c}</span>
                </button>
              );
            })}
          </div>

          {/* Manqués */}
          <div className="space-y-1.5">
            <div className="sticky top-0 z-10 bg-red-600 text-white text-center py-1.5 rounded-lg font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1">
              <XCircle className="h-3.5 w-3.5" /> Manqués
            </div>
            {players.map((p) => {
              const c = counts[p.id]?.missedTackles ?? 0;
              const isFlash = flash?.id === p.id && flash.kind === "fail";
              return (
                <button
                  key={`f-${p.id}`}
                  onClick={() => record(p.id, "fail")}
                  className={cn(
                    "w-full h-11 px-2 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700",
                    "text-white font-semibold text-xs shadow transition-all",
                    "flex items-center justify-between gap-2 select-none",
                    isFlash && "ring-2 ring-red-300 scale-[0.97]"
                  )}
                >
                  <span className="truncate text-left">{p.label}</span>
                  <span className="font-mono text-[11px] bg-black/25 rounded px-1.5 py-0.5 tabular-nums shrink-0">{c}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
