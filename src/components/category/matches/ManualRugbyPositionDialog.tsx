import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RugbyFieldSVG } from "@/components/rugby/RugbyFieldSVG";
import { MapPin, Trash2 } from "lucide-react";

export type FieldPosition = {
  kickX: number;
  kickY: number;
  kickingSide: "left" | "right";
};

export type PositionableKind =
  | "conversion"
  | "penalty_kick"
  | "drop"
  | "scrum_won"
  | "scrum_lost"
  | "lineout_won"
  | "lineout_lost";

const TITLES: Record<PositionableKind, string> = {
  conversion: "Position des transformations",
  penalty_kick: "Position des pénalités tirées au pied",
  drop: "Position des drops",
  scrum_won: "Position des mêlées gagnées",
  scrum_lost: "Position des mêlées perdues",
  lineout_won: "Position des touches gagnées",
  lineout_lost: "Position des touches perdues",
};

const isKick = (k: PositionableKind) => k === "conversion" || k === "penalty_kick" || k === "drop";
const isLineout = (k: PositionableKind) => k === "lineout_won" || k === "lineout_lost";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: PositionableKind;
  count: number;
  positions: FieldPosition[];
  onSave: (positions: FieldPosition[]) => void;
  contextLabel?: string;
}

export function ManualRugbyPositionDialog({
  open, onOpenChange, kind, count, positions: initial, onSave, contextLabel,
}: Props) {
  const [side, setSide] = useState<"left" | "right">("right");
  const [list, setList] = useState<FieldPosition[]>([]);

  useEffect(() => {
    if (!open) return;
    setList(initial.slice());
    setSide(initial[0]?.kickingSide ?? "right");
  }, [open, initial]);

  // count agit comme objectif indicatif ; on autorise toujours le placement libre
  const target = Math.max(count, list.length);
  const remaining = Math.max(0, target - list.length);
  const kick = isKick(kind);
  const lineout = isLineout(kind);

  const snapToTouchline = (x: number, y: number) => {
    if (!lineout) return { x, y };
    const topPct = (14 / 400) * 100;
    const bottomPct = (386 / 400) * 100;
    const leftPct = (20 / 600) * 100;
    const rightPct = (580 / 600) * 100;
    const cx = Math.min(Math.max(x, leftPct), rightPct);
    const cy = Math.min(Math.max(y, topPct), bottomPct);
    const dTop = Math.abs(cy - topPct);
    const dBot = Math.abs(cy - bottomPct);
    const dLeft = Math.abs(cx - leftPct);
    const dRight = Math.abs(cx - rightPct);
    const minD = Math.min(dTop, dBot, dLeft, dRight);
    if (minD === dTop) return { x: cx, y: topPct };
    if (minD === dBot) return { x: cx, y: bottomPct };
    if (minD === dLeft) return { x: leftPct, y: cy };
    return { x: rightPct, y: cy };
  };

  const handleClick = (xPct: number, yPct: number) => {
    const { x, y } = snapToTouchline(xPct, yPct);
    setList((prev) => [...prev, { kickX: x, kickY: y, kickingSide: side }]);
  };

  const removeAt = (i: number) => setList((prev) => prev.filter((_, idx) => idx !== i));
  const clearAll = () => setList([]);

  const markerColor = useMemo(() => {
    switch (kind) {
      case "conversion": return "#22c55e";
      case "penalty_kick": return "#3b82f6";
      case "drop": return "#a855f7";
      case "scrum_won":
      case "lineout_won": return "#10b981";
      case "scrum_lost":
      case "lineout_lost": return "#ef4444";
    }
  }, [kind]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {TITLES[kind]}
          </DialogTitle>
          <DialogDescription>
            {contextLabel ? <span className="block text-xs">{contextLabel}</span> : null}
            Cliquez sur le terrain pour placer la position. {list.length} placée{list.length > 1 ? "s" : ""}{count > 0 ? ` / ${count} attendue${count > 1 ? "s" : ""}` : ""}.
            {remaining > 0 ? ` (${remaining} restante${remaining > 1 ? "s" : ""})` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {lineout ? "Cliquez près d'une ligne de touche : la position se calera dessus." : kick ? "Sens du tir : choisir le côté des poteaux." : "Choisir le sens du jeu."}
          </div>
          <div className="flex gap-1">
            <Button type="button" variant={side === "left" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setSide("left")}>← Gauche</Button>
            <Button type="button" variant={side === "right" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setSide("right")}>Droite →</Button>
          </div>
        </div>

        <div className="relative w-full">
          <RugbyFieldSVG goalsOnRight={side === "right"} showCursorTracker onClick={handleClick}>
            {list.map((p, i) => (
              <g key={i} style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); removeAt(i); }}>
                <circle
                  cx={(p.kickX / 100) * 600}
                  cy={(p.kickY / 100) * 400}
                  r={14}
                  fill={markerColor}
                  opacity={0.85}
                  stroke="white"
                  strokeWidth={3}
                />
                <text x={(p.kickX / 100) * 600} y={(p.kickY / 100) * 400 + 4} textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
                  {i + 1}
                </text>
              </g>
            ))}
          </RugbyFieldSVG>
        </div>

        <div className="flex items-center justify-between text-xs">
          <Button type="button" size="sm" variant="ghost" onClick={clearAll} disabled={list.length === 0} className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5" /> Tout effacer
          </Button>
          <span className="text-muted-foreground">Astuce : cliquez un marqueur pour le supprimer.</span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => { onSave(list); onOpenChange(false); }}>Valider</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
