import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Edit2, Copy, ChevronDown, ChevronRight } from "lucide-react";
import { EVENT_LABELS, type MatchEvent, type Period } from "./types";

interface Props {
  events: MatchEvent[];
  homeName: string;
  awayName: string;
  playerNames: Record<string, string>;
  onEdit: (e: MatchEvent) => void;
  onDelete: (e: MatchEvent) => void;
  onDuplicate: (e: MatchEvent) => void;
}

const PERIOD_LABEL: Record<Period, string> = {
  H1: "1ère mi-temps",
  HT: "Mi-temps",
  H2: "2ème mi-temps",
  ET: "Prolongation",
};

const PERIOD_ORDER: Period[] = ["H1", "HT", "H2", "ET"];

function EventRow({ e, homeName, awayName, playerNames, onEdit, onDelete, onDuplicate }: { e: MatchEvent } & Omit<Props, "events">) {
  const team = e.team_side === "home" ? homeName : awayName;
  const player = e.player_id ? playerNames[e.player_id] : null;
  const isHome = e.team_side === "home";
  const accent = e.points > 0 ? "border-l-green-500" : isHome ? "border-l-blue-500" : "border-l-orange-500";
  return (
    <Card className={`p-3 border-l-4 ${accent} flex items-center justify-between gap-3`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="font-mono font-bold text-sm w-12 text-center bg-muted rounded-md py-1">{e.minute}'</div>
        <div className="min-w-0">
          <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
            {EVENT_LABELS[e.event_type] ?? e.event_type}
            {e.outcome === "success" && <Badge className="bg-green-600 text-[10px] py-0">Réussi</Badge>}
            {e.outcome === "fail" && <Badge variant="destructive" className="text-[10px] py-0">Manqué</Badge>}
            {e.outcome === "won" && <Badge className="bg-green-600 text-[10px] py-0">Gagnée</Badge>}
            {e.outcome === "lost" && <Badge variant="destructive" className="text-[10px] py-0">Perdue</Badge>}
            {e.points > 0 && <Badge className="bg-amber-500 text-[10px] py-0">+{e.points}</Badge>}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {team}{player ? ` · ${player}` : ""}{e.event_subtype ? ` · ${e.event_subtype}` : ""}
          </div>
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(e)}><Edit2 className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDuplicate(e)}><Copy className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(e)}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    </Card>
  );
}

export function LiveTimeline({ events, homeName, awayName, playerNames, onEdit, onDelete, onDuplicate }: Props) {
  // H1 collapsed by default once H2 events exist
  const hasH2 = events.some((e) => e.period === "H2" || e.period === "ET");
  const [collapsed, setCollapsed] = useState<Record<Period, boolean>>({
    H1: hasH2, HT: false, H2: false, ET: false,
  });

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Aucun événement enregistré.</p>
        <p className="text-xs mt-1">Utilisez les actions rapides à droite pour démarrer.</p>
      </div>
    );
  }

  const grouped: Record<Period, MatchEvent[]> = { H1: [], HT: [], H2: [], ET: [] };
  events.forEach((e) => { (grouped[e.period as Period] ||= []).push(e); });

  return (
    <div className="space-y-4">
      {PERIOD_ORDER.map((p) => {
        const list = grouped[p];
        if (!list || list.length === 0) return null;
        const isCollapsed = collapsed[p];
        const periodColor = p === "H1" ? "bg-blue-500/15 text-blue-600 border-blue-500/30"
          : p === "H2" ? "bg-purple-500/15 text-purple-600 border-purple-500/30"
          : "bg-muted text-muted-foreground border-border";
        return (
          <div key={p} className="space-y-2">
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [p]: !c[p] }))}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ${periodColor} hover:opacity-90 transition`}
            >
              <span className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {PERIOD_LABEL[p]}
              </span>
              <Badge variant="secondary" className="text-[10px]">{list.length} évén.</Badge>
            </button>
            {!isCollapsed && (
              <div className="space-y-2">
                {list.map((e) => (
                  <EventRow key={e.id} e={e} homeName={homeName} awayName={awayName} playerNames={playerNames}
                    onEdit={onEdit} onDelete={onDelete} onDuplicate={onDuplicate} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
