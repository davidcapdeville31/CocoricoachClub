import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, Minus, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export interface PlayingTimeRow {
  player_id: string;
  position: string | null;
  is_starter: boolean;
  players?: { id: string; name?: string | null; first_name?: string | null } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  matchId: string;
  lineup: PlayingTimeRow[];
}

const fullName = (p?: PlayingTimeRow["players"]) =>
  [p?.first_name, p?.name].filter(Boolean).join(" ").trim() || "Joueur";

const storageKey = (matchId: string) => `match-playing-time-${matchId}`;

function loadTimes(matchId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(storageKey(matchId));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveTimes(matchId: string, t: Record<string, number>) {
  try { localStorage.setItem(storageKey(matchId), JSON.stringify(t)); } catch { /* noop */ }
}

const positionOrder = (pos: any): number => {
  if (pos == null) return 99;
  const s = String(pos).trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const sub = s.match(/^SUB(\d+)$/i);
  if (sub) return 15 + parseInt(sub[1], 10);
  return 99;
};

export function PlayingTimeDialog({ open, onOpenChange, matchId, lineup }: Props) {
  const [times, setTimes] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open) setTimes(loadTimes(matchId));
  }, [open, matchId]);

  const sorted = useMemo(
    () => [...lineup].sort((a, b) => {
      // Titulaires d'abord, puis remplaçants
      if (a.is_starter !== b.is_starter) return a.is_starter ? -1 : 1;
      return positionOrder(a.position) - positionOrder(b.position);
    }),
    [lineup]
  );

  const update = (id: string, val: number) => {
    const v = Math.max(0, Math.min(999, Math.round(val)));
    setTimes((t) => ({ ...t, [id]: v }));
  };

  const handleSave = () => {
    saveTimes(matchId, times);
    toast.success("Temps de jeu enregistrés");
    onOpenChange(false);
  };

  const resetAll = () => {
    const cleared: Record<string, number> = {};
    sorted.forEach((p) => { cleared[p.player_id] = 0; });
    setTimes(cleared);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Clock className="h-5 w-5 text-primary" /> Temps de jeu
          </DialogTitle>
          <DialogDescription>
            Saisis manuellement le nombre de minutes jouées par chaque joueur de la composition.
            Idéal pour les formats courts (U14 : 2×11', U16 : 2×30', etc.).
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 pb-2 border-b">
          <div className="text-xs text-muted-foreground">
            {sorted.length} joueur{sorted.length > 1 ? "s" : ""} dans la composition
          </div>
          <Button variant="ghost" size="sm" onClick={resetAll} className="h-7 text-xs gap-1">
            <RotateCcw className="h-3 w-3" /> Tout remettre à 0
          </Button>
        </div>

        <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
          {sorted.length === 0 && (
            <div className="text-sm text-muted-foreground italic p-4 text-center">
              Aucun joueur dans la composition.
            </div>
          )}
          {sorted.map((p) => {
            const value = times[p.player_id] ?? 0;
            return (
              <div
                key={p.player_id}
                className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5"
              >
                <span className={`inline-flex items-center justify-center min-w-[2rem] h-7 rounded-full text-xs font-bold ${
                  p.is_starter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {p.is_starter ? (p.position ?? "?") : "R"}
                </span>
                <span className="flex-1 truncate text-sm">{fullName(p.players)}</span>
                <Button
                  type="button" size="icon" variant="outline" className="h-7 w-7"
                  onClick={() => update(p.player_id, value - 1)}
                  disabled={value <= 0}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  type="number" min={0} max={999} inputMode="numeric"
                  value={value}
                  onChange={(e) => update(p.player_id, parseInt(e.target.value || "0", 10) || 0)}
                  className="h-7 w-16 text-center font-mono text-sm"
                />
                <span className="text-[10px] uppercase text-muted-foreground w-6">min</span>
                <Button
                  type="button" size="icon" variant="outline" className="h-7 w-7"
                  onClick={() => update(p.player_id, value + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>

        <DialogFooter className="mt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
