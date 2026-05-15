import { ScrollArea } from "@/components/ui/scroll-area";
import { EVENT_LABELS, type MatchEvent } from "@/components/category/matches/live/types";
import { cn } from "@/lib/utils";
import {
  Trophy, Target, Crosshair, Square, ArrowLeftRight, HeartPulse,
  ChevronsRight, Hand, Swords, AlertTriangle, Footprints, Circle,
} from "lucide-react";

interface Props {
  events: MatchEvent[];
  homeLabel?: string;
  awayLabel?: string;
}

type Visual = { icon: JSX.Element; tone: "success" | "info" | "warning" | "danger" | "neutral"; major?: boolean };

const VISUAL: Record<string, Visual> = {
  try:           { icon: <Trophy className="h-3.5 w-3.5" />, tone: "success", major: true },
  penalty_try:   { icon: <Trophy className="h-3.5 w-3.5" />, tone: "success", major: true },
  conversion:    { icon: <Target className="h-3.5 w-3.5" />, tone: "info" },
  penalty_kick:  { icon: <Crosshair className="h-3.5 w-3.5" />, tone: "warning" },
  drop:          { icon: <Crosshair className="h-3.5 w-3.5" />, tone: "info" },
  yellow_card:   { icon: <Square className="h-3.5 w-3.5 fill-current" />, tone: "warning", major: true },
  red_card:      { icon: <Square className="h-3.5 w-3.5 fill-current" />, tone: "danger", major: true },
  substitution:  { icon: <ArrowLeftRight className="h-3.5 w-3.5" />, tone: "neutral" },
  injury:        { icon: <HeartPulse className="h-3.5 w-3.5" />, tone: "danger" },
  line_break:    { icon: <ChevronsRight className="h-3.5 w-3.5" />, tone: "success" },
  turnover:      { icon: <Swords className="h-3.5 w-3.5" />, tone: "info" },
  knock_on:      { icon: <Hand className="h-3.5 w-3.5" />, tone: "warning" },
  missed_tackle: { icon: <AlertTriangle className="h-3.5 w-3.5" />, tone: "danger" },
  foul:          { icon: <AlertTriangle className="h-3.5 w-3.5" />, tone: "warning" },
  tackle:        { icon: <Footprints className="h-3.5 w-3.5" />, tone: "neutral" },
  kick:          { icon: <Footprints className="h-3.5 w-3.5" />, tone: "neutral" },
};

const TONE_CLASS: Record<Visual["tone"], string> = {
  success: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/30",
  info:    "bg-sky-500/15 text-sky-500 ring-sky-500/30",
  warning: "bg-amber-500/15 text-amber-500 ring-amber-500/30",
  danger:  "bg-rose-500/15 text-rose-500 ring-rose-500/30",
  neutral: "bg-muted text-muted-foreground ring-border",
};

export function EventTimeline({ events, homeLabel = "Domicile", awayLabel = "Extérieur" }: Props) {
  if (!events.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-sunken/40 py-8 text-center text-sm text-muted-foreground">
        Aucun événement enregistré pour ce match
      </div>
    );
  }
  const sorted = [...events].sort((a, b) => (a.minute - b.minute) || (a.second - b.second));

  return (
    <ScrollArea className="h-[320px] rounded-xl border border-border bg-surface-sunken/60">
      <div className="p-2.5 space-y-1">
        {sorted.map((e, idx) => {
          const v = VISUAL[e.event_type] || { icon: <Circle className="h-3 w-3" />, tone: "neutral" as const };
          const isHome = e.team_side === "home";
          return (
            <div
              key={e.id}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors",
                "hover:bg-surface-elevated/60",
                v.major && "bg-surface/50 ring-1 ring-border/60",
              )}
            >
              {/* Minute pill */}
              <span className="shrink-0 inline-flex items-center justify-center min-w-[42px] h-6 px-1.5 rounded-md bg-surface text-[11px] font-mono font-bold text-foreground/80 border border-border/60">
                {String(e.minute).padStart(2, "0")}'
              </span>

              {/* Team chip */}
              <span className={cn(
                "shrink-0 inline-flex items-center gap-1 px-1.5 h-6 rounded-md text-[10px] font-semibold uppercase tracking-wide ring-1",
                isHome ? "bg-primary/15 text-primary ring-primary/30" : "bg-foreground/10 text-foreground/70 ring-border",
              )}>
                <span className={cn("h-1.5 w-1.5 rounded-full", isHome ? "bg-primary" : "bg-foreground/50")} />
                {isHome ? homeLabel : awayLabel}
              </span>

              {/* Event icon */}
              <span className={cn(
                "shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-md ring-1",
                TONE_CLASS[v.tone],
              )}>
                {v.icon}
              </span>

              {/* Label */}
              <span className={cn(
                "flex-1 truncate",
                v.major ? "font-semibold text-foreground" : "text-foreground/85",
              )}>
                {EVENT_LABELS[e.event_type] || e.event_type}
                {e.outcome ? <span className="text-muted-foreground font-normal"> · {e.outcome}</span> : null}
              </span>

              {/* Points */}
              {e.points ? (
                <span className="shrink-0 inline-flex items-center justify-center min-w-[32px] h-6 px-1.5 rounded-md bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/30 text-[11px] font-bold tabular-nums">
                  +{e.points}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
