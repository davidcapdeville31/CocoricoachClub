import { useState } from "react";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchEvent, Period, TeamSide } from "./types";

interface PlayerOpt { id: string; label: string }

interface Props {
  players: PlayerOpt[];
  teamSide: TeamSide;
  period: Period;
  minute: number;
  second: number;
  onRecord: (payload: Partial<MatchEvent>) => void | Promise<void>;
  counts: Record<string, { passes: number; missedPasses: number }>;
}

export function PassInlinePanel({ players, teamSide, period, minute, second, onRecord, counts }: Props) {
  const [flash, setFlash] = useState<{ id: string; kind: "success" | "fail" } | null>(null);

  const record = (playerId: string, kind: "success" | "fail") => {
    setFlash({ id: playerId, kind });
    window.setTimeout(() => setFlash((f) => (f?.id === playerId && f.kind === kind ? null : f)), 250);
    onRecord({
      team_side: teamSide,
      event_type: "pass",
      outcome: kind,
      player_id: playerId,
      minute,
      second,
      period,
      points: 0,
    });
  };

  const half = Math.ceil(players.length / 2);
  const leftPlayers = players.slice(0, half);
  const rightPlayers = players.slice(half);

  return (
    <Card className="p-3 mt-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Passes — 1 clic</h3>
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
          {String(minute).padStart(2, "0")}'{String(second).padStart(2, "0")} · {period}
        </span>
      </div>

      {players.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-4">Aucun joueur dans la feuille de match.</p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {/* Réussies — colonne 1 */}
          <div className="space-y-1.5">
            <div className="sticky top-0 z-10 bg-green-600 text-white text-center py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Réussies 1
            </div>
            {leftPlayers.map((p) => {
              const c = counts[p.id]?.passes ?? 0;
              const isFlash = flash?.id === p.id && flash.kind === "success";
              return (
                <button
                  key={`ps1-${p.id}`}
                  onClick={() => record(p.id, "success")}
                  className={cn(
                    "w-full h-10 px-1.5 rounded-xl bg-green-600 hover:bg-green-500 active:bg-green-700",
                    "text-white font-semibold text-[11px] shadow transition-all",
                    "flex items-center justify-between gap-1 select-none",
                    isFlash && "ring-2 ring-green-300 scale-[0.97]"
                  )}
                >
                  <span className="truncate text-left leading-tight">{p.label}</span>
                  <span className="font-mono text-[10px] bg-black/25 rounded px-1 py-0.5 tabular-nums shrink-0">{c}</span>
                </button>
              );
            })}
          </div>

          {/* Réussies — colonne 2 */}
          <div className="space-y-1.5">
            <div className="sticky top-0 z-10 bg-green-600 text-white text-center py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Réussies 2
            </div>
            {rightPlayers.map((p) => {
              const c = counts[p.id]?.passes ?? 0;
              const isFlash = flash?.id === p.id && flash.kind === "success";
              return (
                <button
                  key={`ps2-${p.id}`}
                  onClick={() => record(p.id, "success")}
                  className={cn(
                    "w-full h-10 px-1.5 rounded-xl bg-green-600 hover:bg-green-500 active:bg-green-700",
                    "text-white font-semibold text-[11px] shadow transition-all",
                    "flex items-center justify-between gap-1 select-none",
                    isFlash && "ring-2 ring-green-300 scale-[0.97]"
                  )}
                >
                  <span className="truncate text-left leading-tight">{p.label}</span>
                  <span className="font-mono text-[10px] bg-black/25 rounded px-1 py-0.5 tabular-nums shrink-0">{c}</span>
                </button>
              );
            })}
          </div>

          {/* Ratées — colonne 1 */}
          <div className="space-y-1.5">
            <div className="sticky top-0 z-10 bg-red-600 text-white text-center py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1">
              <XCircle className="h-3 w-3" /> Ratées 1
            </div>
            {leftPlayers.map((p) => {
              const c = counts[p.id]?.missedPasses ?? 0;
              const isFlash = flash?.id === p.id && flash.kind === "fail";
              return (
                <button
                  key={`pf1-${p.id}`}
                  onClick={() => record(p.id, "fail")}
                  className={cn(
                    "w-full h-10 px-1.5 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700",
                    "text-white font-semibold text-[11px] shadow transition-all",
                    "flex items-center justify-between gap-1 select-none",
                    isFlash && "ring-2 ring-red-300 scale-[0.97]"
                  )}
                >
                  <span className="truncate text-left leading-tight">{p.label}</span>
                  <span className="font-mono text-[10px] bg-black/25 rounded px-1 py-0.5 tabular-nums shrink-0">{c}</span>
                </button>
              );
            })}
          </div>

          {/* Ratées — colonne 2 */}
          <div className="space-y-1.5">
            <div className="sticky top-0 z-10 bg-red-600 text-white text-center py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1">
              <XCircle className="h-3 w-3" /> Ratées 2
            </div>
            {rightPlayers.map((p) => {
              const c = counts[p.id]?.missedPasses ?? 0;
              const isFlash = flash?.id === p.id && flash.kind === "fail";
              return (
                <button
                  key={`pf2-${p.id}`}
                  onClick={() => record(p.id, "fail")}
                  className={cn(
                    "w-full h-10 px-1.5 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700",
                    "text-white font-semibold text-[11px] shadow transition-all",
                    "flex items-center justify-between gap-1 select-none",
                    isFlash && "ring-2 ring-red-300 scale-[0.97]"
                  )}
                >
                  <span className="truncate text-left leading-tight">{p.label}</span>
                  <span className="font-mono text-[10px] bg-black/25 rounded px-1 py-0.5 tabular-nums shrink-0">{c}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
