import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RugbyFieldSVG } from "@/components/rugby/RugbyFieldSVG";
import { MapPin, Trash2, Clock, History } from "lucide-react";
import { toast } from "sonner";

// In-goal zone bounds in % (matches FIELD_LEFT=20, FIELD_RIGHT=580, in-play 0.05→0.95 of FIELD_W=560)
const INGOAL_LEFT_X = [20 / 600 * 100, (20 + 0.05 * 560) / 600 * 100] as const; // ~3.33% → 8%
const INGOAL_RIGHT_X = [(20 + 0.95 * 560) / 600 * 100, 580 / 600 * 100] as const; // ~92% → 96.67%
const FIELD_Y = [14 / 400 * 100, 386 / 400 * 100] as const; // 3.5% → 96.5%

export type FieldPosition = {
  kickX: number;
  kickY: number;
  kickingSide: "left" | "right";
  minute?: number | null;
};

export type PositionableKind =
  | "try"
  | "conversion"
  | "penalty_kick"
  | "drop"
  | "scrum_won"
  | "scrum_lost"
  | "lineout_won"
  | "lineout_lost";

const TITLES: Record<PositionableKind, string> = {
  try: "Position des essais",
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
  missed?: boolean;
}

export function ManualRugbyPositionDialog({
  open, onOpenChange, kind, count, positions: initial, onSave, contextLabel, missed = false,
}: Props) {
  const [side, setSide] = useState<"left" | "right">("right");
  const [list, setList] = useState<FieldPosition[]>([]);
  // Conserve la liste à jour pour pouvoir auto-sauvegarder à la fermeture
  const listRef = useRef<FieldPosition[]>([]);
  const initialCountRef = useRef(0);
  useEffect(() => { listRef.current = list; }, [list]);

  useEffect(() => {
    if (!open) return;
    setList(initial.slice());
    setSide(initial[0]?.kickingSide ?? "right");
    initialCountRef.current = initial.length;
  }, [open, initial]);

  // count agit comme objectif indicatif ; on autorise toujours le placement libre
  const target = Math.max(count, list.length);
  const remaining = Math.max(0, target - list.length);
  const kick = isKick(kind);
  const lineout = isLineout(kind);

  // Persiste automatiquement la liste lors de toute fermeture (croix, clic extérieur, Échap)
  const handleOpenChange = (o: boolean) => {
    if (!o) onSave(listRef.current);
    onOpenChange(o);
  };

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
    // Pour les essais : restreindre à la zone d'en-but adverse (côté attaqué)
    if (kind === "try") {
      const [xMin, xMax] = side === "right" ? INGOAL_RIGHT_X : INGOAL_LEFT_X;
      const [yMin, yMax] = FIELD_Y;
      if (xPct < xMin || xPct > xMax || yPct < yMin || yPct > yMax) {
        toast.error("Un essai doit être marqué dans la zone d'en-but (derrière les poteaux).");
        return;
      }
      setList((prev) => [...prev, { kickX: xPct, kickY: yPct, kickingSide: side }]);
      return;
    }
    const { x, y } = snapToTouchline(xPct, yPct);
    setList((prev) => [...prev, { kickX: x, kickY: y, kickingSide: side }]);
  };

  const removeAt = (i: number) => setList((prev) => prev.filter((_, idx) => idx !== i));
  const clearAll = () => setList([]);

  const markerColor = useMemo(() => {
    if (missed) return "#ef4444";
    switch (kind) {
      case "try": return "#16a34a";
      case "conversion": return "#22c55e";
      case "penalty_kick": return "#3b82f6";
      case "drop": return "#a855f7";
      case "scrum_won":
      case "lineout_won": return "#10b981";
      case "scrum_lost":
      case "lineout_lost": return "#ef4444";
    }
  }, [kind, missed]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {TITLES[kind]}
          </DialogTitle>
          <DialogDescription>
            {contextLabel ? <span className="block text-xs">{contextLabel}</span> : null}
            <span className="inline-flex items-center gap-2 mt-1">
              <span>{list.length} placée{list.length > 1 ? "s" : ""}{count > 0 ? ` / ${count} attendue${count > 1 ? "s" : ""}` : ""}.</span>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ring-1"
                style={{ background: `${markerColor}20`, color: markerColor, borderColor: markerColor }}
              >
                <MapPin className="h-3 w-3" />
                Prochain : <span className="tabular-nums">{list.length + 1}</span>
              </span>
              {initialCountRef.current > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <History className="h-3 w-3" />
                  {initialCountRef.current} déjà placé{initialCountRef.current > 1 ? "s" : ""}
                </span>
              )}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {kind === "try"
              ? "Cliquez dans la zone d'en-but adverse (surlignée) pour placer l'essai."
              : lineout ? "Cliquez près d'une ligne de touche : la position se calera dessus." : kick ? "Sens du tir : choisir le côté des poteaux." : "Choisir le sens du jeu."}
          </div>
          <div className="flex gap-1">
            <Button type="button" variant={side === "left" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setSide("left")}>← Gauche</Button>
            <Button type="button" variant={side === "right" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setSide("right")}>Droite →</Button>
          </div>
        </div>

        <div className="relative w-full">
          <RugbyFieldSVG goalsOnRight={side === "right"} showCursorTracker onClick={handleClick}>
            {kind === "try" && (() => {
              const x = side === "right" ? (20 + 0.95 * 560) : 20;
              const w = 0.05 * 560;
              return (
                <g pointerEvents="none">
                  <rect x={x} y={14} width={w} height={372} fill="#16a34a" opacity={0.28} />
                  <rect x={x} y={14} width={w} height={372} fill="none" stroke="#16a34a" strokeWidth={2} strokeDasharray="6 4" opacity={0.9} />
                  <text x={x + w / 2} y={200} textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" opacity={0.85} style={{ writingMode: "vertical-rl" } as any}>
                    EN-BUT
                  </text>
                </g>
              );
            })()}
            {list.map((p, i) => {
              const cx = (p.kickX / 100) * 600;
              const cy = (p.kickY / 100) * 400;
              return (
                <g key={i} style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); removeAt(i); }}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={14}
                    fill={markerColor}
                    opacity={0.85}
                    stroke="white"
                    strokeWidth={3}
                  />
                  <text x={cx} y={cy + 4} textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
                    {i + 1}
                  </text>
                  {missed && (
                    <text x={cx + 12} y={cy - 9} textAnchor="middle" fill="#ef4444" stroke="white" strokeWidth={0.6} fontSize="13" fontWeight="bold">
                      ✗
                    </text>
                  )}
                </g>
              );
            })}
          </RugbyFieldSVG>
        </div>

        <div className="flex items-center justify-between text-xs">
          <Button type="button" size="sm" variant="ghost" onClick={clearAll} disabled={list.length === 0} className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5" /> Tout effacer
          </Button>
          <span className="text-muted-foreground">Astuce : cliquez un marqueur pour le supprimer.</span>
        </div>

        {list.length > 0 && (
          <div className="rounded-md border bg-muted/30 p-2 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <Clock className="h-3 w-3" /> Minute du match (optionnel)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
              {list.map((p, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: markerColor }}
                  >
                    {i + 1}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={120}
                    value={p.minute ?? ""}
                    placeholder="min"
                    onChange={(e) => {
                      const v = e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0);
                      setList((prev) => prev.map((x, idx) => (idx === i ? { ...x, minute: v } : x)));
                    }}
                    className="h-7 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => { onSave(list); onOpenChange(false); }}>Valider</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
