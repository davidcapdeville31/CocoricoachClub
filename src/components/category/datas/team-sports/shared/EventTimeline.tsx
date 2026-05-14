import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { EVENT_LABELS, type MatchEvent } from "@/components/category/matches/live/types";

interface Props {
  events: MatchEvent[];
  homeLabel?: string;
  awayLabel?: string;
}

export function EventTimeline({ events, homeLabel = "Domicile", awayLabel = "Extérieur" }: Props) {
  if (!events.length) {
    return <div className="text-sm text-muted-foreground py-6 text-center">Aucun événement</div>;
  }
  const sorted = [...events].sort((a, b) => (a.minute - b.minute) || (a.second - b.second));
  return (
    <ScrollArea className="h-[280px] rounded-xl border bg-surface-sunken">
      <div className="p-3 space-y-1">
        {sorted.map((e) => (
          <div key={e.id} className="flex items-center gap-3 text-sm py-1 border-b last:border-0">
            <span className="font-mono text-xs text-muted-foreground w-12">
              {String(e.minute).padStart(2, "0")}'{String(e.second).padStart(2, "0")}
            </span>
            <Badge variant={e.team_side === "home" ? "default" : "destructive"} className="text-[10px]">
              {e.team_side === "home" ? homeLabel : awayLabel}
            </Badge>
            <span className="flex-1 truncate">
              {EVENT_LABELS[e.event_type] || e.event_type}
              {e.outcome ? <span className="text-muted-foreground"> · {e.outcome}</span> : null}
            </span>
            {e.points ? <span className="font-semibold text-primary">+{e.points}</span> : null}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
