import { useMemo } from "react";
import type { MatchEvent } from "../live/types";
import { EVENT_LABELS } from "../live/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  events: MatchEvent[];
  homeName: string;
  awayName: string;
}

const EVENT_COLOR: Record<string, string> = {
  try: "bg-emerald-500",
  penalty_try: "bg-emerald-500",
  conversion: "bg-sky-500",
  penalty_kick: "bg-amber-500",
  drop: "bg-purple-500",
  yellow_card: "bg-yellow-400",
  red_card: "bg-rose-600",
  substitution: "bg-slate-400",
  injury: "bg-rose-400",
};

const KEY_EVENTS = new Set([
  "try",
  "penalty_try",
  "conversion",
  "penalty_kick",
  "drop",
  "yellow_card",
  "red_card",
  "substitution",
  "injury",
]);

export function MatchTimelineView({ events, homeName, awayName }: Props) {
  const halfMax = 40;
  const totalMax = 80;

  const filtered = useMemo(
    () => events.filter((e) => KEY_EVENTS.has(e.event_type)),
    [events],
  );

  const minuteOf = (e: MatchEvent) => Math.min(e.minute || 0, totalMax);

  const homeEvents = filtered.filter((e) => e.team_side === "home");
  const awayEvents = filtered.filter((e) => e.team_side === "away");

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
            Chronologie du match
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            {Object.entries(EVENT_COLOR)
              .filter(([k]) => ["try", "conversion", "penalty_kick", "drop", "yellow_card", "red_card"].includes(k))
              .map(([k, c]) => (
                <span key={k} className="inline-flex items-center gap-1 text-muted-foreground">
                  <span className={cn("h-2 w-2 rounded-full", c)} />
                  {EVENT_LABELS[k]}
                </span>
              ))}
          </div>
        </div>

        <TooltipProvider delayDuration={100}>
          <div className="space-y-3">
            {[
              { label: homeName, side: "home" as const, items: homeEvents },
              { label: awayName, side: "away" as const, items: awayEvents },
            ].map((row) => (
              <div key={row.side}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{row.label}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {row.items.length} évén.
                  </Badge>
                </div>
                <div className="relative h-9 rounded-xl bg-surface-sunken">
                  {/* Half-time marker */}
                  <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                    MT
                  </div>
                  {row.items.map((e) => {
                    const left = (minuteOf(e) / totalMax) * 100;
                    return (
                      <Tooltip key={e.id}>
                        <TooltipTrigger asChild>
                          <button
                            className={cn(
                              "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface transition-all hover:scale-150 hover:z-10",
                              EVENT_COLOR[e.event_type] ?? "bg-slate-500",
                              "h-3 w-3",
                            )}
                            style={{ left: `${left}%` }}
                            aria-label={EVENT_LABELS[e.event_type]}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <div className="font-semibold">{EVENT_LABELS[e.event_type] ?? e.event_type}</div>
                          <div className="text-muted-foreground">
                            {e.minute}'
                            {e.outcome ? ` · ${e.outcome}` : ""}
                            {e.points ? ` · +${e.points} pts` : ""}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>0'</span>
                  <span>{halfMax}'</span>
                  <span>{totalMax}'</span>
                </div>
              </div>
            ))}
          </div>
        </TooltipProvider>

        {filtered.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-surface-sunken/40 py-8 text-center text-sm text-muted-foreground">
            Aucun événement enregistré pour ce match
          </div>
        ) : null}
      </div>
    </div>
  );
}
