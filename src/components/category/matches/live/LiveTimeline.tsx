import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Edit2, Copy } from "lucide-react";
import { EVENT_LABELS, type MatchEvent } from "./types";

interface Props {
  events: MatchEvent[];
  homeName: string;
  awayName: string;
  playerNames: Record<string, string>;
  onEdit: (e: MatchEvent) => void;
  onDelete: (e: MatchEvent) => void;
  onDuplicate: (e: MatchEvent) => void;
}

export function LiveTimeline({ events, homeName, awayName, playerNames, onEdit, onDelete, onDuplicate }: Props) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Aucun événement enregistré.</p>
        <p className="text-xs mt-1">Utilisez les actions rapides à droite pour démarrer.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {events.map((e) => {
        const team = e.team_side === "home" ? homeName : awayName;
        const player = e.player_id ? playerNames[e.player_id] : null;
        const isHome = e.team_side === "home";
        const accent = e.points > 0 ? "border-l-green-500" : isHome ? "border-l-blue-500" : "border-l-orange-500";
        return (
          <Card key={e.id} className={`p-3 border-l-4 ${accent} flex items-center justify-between gap-3`}>
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
      })}
    </div>
  );
}
