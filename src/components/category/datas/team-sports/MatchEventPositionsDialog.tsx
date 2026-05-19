import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { RugbyFieldSvg } from "@/components/category/matches/RugbyFieldSvg";
import type { MatchEvent } from "@/components/category/matches/live/types";

const SVG_W = 600;
const SVG_H = 400;
const FIELD_LEFT = 20;
const FIELD_RIGHT = 580;
const FIELD_TOP = 14;
const FIELD_BOTTOM = 386;

export type PositionStatKind =
  | "try"
  | "conversion"
  | "penalty_kick"
  | "drop"
  | "lineout"
  | "scrum";

const KIND_CONFIG: Record<PositionStatKind, { title: string; eventTypes: string[]; shape: "circle" | "square" | "diamond" | "triangle"; color: string; isKick: boolean }> = {
  try:          { title: "Position des essais",            eventTypes: ["try", "penalty_try"],     shape: "triangle", color: "#10b981", isKick: false },
  conversion:   { title: "Position des transformations",   eventTypes: ["conversion"],             shape: "circle",   color: "#3b82f6", isKick: true },
  penalty_kick: { title: "Position des pénalités (tirs)",  eventTypes: ["penalty_kick"],           shape: "square",   color: "#f97316", isKick: true },
  drop:         { title: "Position des drops",             eventTypes: ["drop"],                   shape: "diamond",  color: "#8b5cf6", isKick: true },
  lineout:      { title: "Position des touches",           eventTypes: ["lineout"],                shape: "circle",   color: "#eab308", isKick: false },
  scrum:        { title: "Position des mêlées",            eventTypes: ["scrum"],                  shape: "square",   color: "#a855f7", isKick: false },
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: PositionStatKind;
  events: MatchEvent[];
  homeName: string;
  awayName: string;
}

type PeriodFilter = "all" | "H1" | "H2";
type TeamFilter = "home" | "away" | "all";

function getPos(e: MatchEvent): { x: number; y: number; side: "left" | "right" | null } | null {
  const m = (e.metadata || {}) as any;
  const x = typeof m.kickX === "number" ? m.kickX : m.position?.x;
  const y = typeof m.kickY === "number" ? m.kickY : m.position?.y;
  if (typeof x !== "number" || typeof y !== "number") return null;
  const side = m.kickingSide === "left" || m.kickingSide === "right" ? m.kickingSide : (m.position?.side ?? null);
  return { x, y, side };
}

function outcomeColor(e: MatchEvent, kind: PositionStatKind): string {
  if (kind === "try") return "#22c55e";
  if (kind === "lineout" || kind === "scrum") {
    if (e.outcome === "won") return "#22c55e";
    if (e.outcome === "lost") return "#ef4444";
    return "#94a3b8";
  }
  if (e.outcome === "success") return "#22c55e";
  if (e.outcome === "fail") return "#ef4444";
  return "#94a3b8";
}

function Marker({ cx, cy, fill, stroke, shape }: { cx: number; cy: number; fill: string; stroke: string; shape: string }) {
  const r = 9;
  if (shape === "circle") return <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={2.5} opacity={0.9} />;
  if (shape === "square") return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} rx={2} fill={fill} stroke={stroke} strokeWidth={2.5} opacity={0.9} />;
  if (shape === "triangle") return <polygon points={`${cx},${cy - r} ${cx + r},${cy + r} ${cx - r},${cy + r}`} fill={fill} stroke={stroke} strokeWidth={2.5} opacity={0.9} />;
  return <polygon points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} fill={fill} stroke={stroke} strokeWidth={2.5} opacity={0.9} />;
}

export function MatchEventPositionsDialog({ open, onOpenChange, kind, events, homeName, awayName }: Props) {
  const cfg = KIND_CONFIG[kind];
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [team, setTeam] = useState<TeamFilter>("home");

  const items = useMemo(() => {
    const filtered = events.filter(e => {
      if (!cfg.eventTypes.includes(e.event_type || "")) return false;
      if (period === "H1" && !(e.period === "H1" || e.period === "HT")) return false;
      if (period === "H2" && !(e.period === "H2" || e.period === "ET")) return false;
      if (team !== "all" && e.team_side !== team) return false;
      return true;
    });
    return filtered.map(e => ({ e, pos: getPos(e) }));
  }, [events, cfg, period, team]);

  const positioned = items.filter(i => i.pos);
  const totalCount = items.length;
  const homeCount = items.filter(i => i.e.team_side === "home").length;
  const awayCount = items.filter(i => i.e.team_side === "away").length;

  // Goal line X positions in SVG coordinates (5% and 95% inside the field box)
  const FIELD_W = FIELD_RIGHT - FIELD_LEFT;
  const goalLeftX = FIELD_LEFT + 0.05 * FIELD_W;
  const goalRightX = FIELD_LEFT + 0.95 * FIELD_W;
  const goalY = (FIELD_TOP + FIELD_BOTTOM) / 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            {cfg.title}
          </DialogTitle>
          <DialogDescription>
            {totalCount} événement{totalCount > 1 ? "s" : ""}{period !== "all" ? ` (${period === "H1" ? "1ère mi-temps" : "2ème mi-temps"})` : " sur le match"} — {positioned.length} avec position enregistrée
          </DialogDescription>
        </DialogHeader>

        {/* Period filter */}
        <div className="flex gap-1.5">
          <Button size="sm" variant={period === "H1" ? "default" : "outline"} className="h-7 text-xs" onClick={() => setPeriod("H1")}>1ère mi-temps</Button>
          <Button size="sm" variant={period === "H2" ? "default" : "outline"} className="h-7 text-xs" onClick={() => setPeriod("H2")}>2ème mi-temps</Button>
          <Button size="sm" variant={period === "all" ? "default" : "outline"} className="h-7 text-xs" onClick={() => setPeriod("all")}>Tout le match</Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />{homeName}: {homeCount}
          </Badge>
          <Badge variant="secondary" className="gap-1.5">
            <span className="h-2 w-2 rounded-full bg-foreground/40" />{awayName}: {awayCount}
          </Badge>
          {(kind === "try") ? null : (
            <>
              <Badge variant="outline" className="gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {kind === "lineout" || kind === "scrum" ? "Gagnée" : "Réussi"}
              </Badge>
              <Badge variant="outline" className="gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                {kind === "lineout" || kind === "scrum" ? "Perdue" : "Raté"}
              </Badge>
              {cfg.isKick && (
                <Badge variant="outline" className="gap-1.5">
                  → Direction du tir vers les poteaux
                </Badge>
              )}
            </>
          )}
        </div>

        <div className="relative w-full" style={{ aspectRatio: "3/2" }}>
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-full">
            <defs>
              <marker id="kick-arrow-success" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#22c55e" />
              </marker>
              <marker id="kick-arrow-fail" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
              </marker>
              <marker id="kick-arrow-neutral" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
              </marker>
            </defs>
            <RugbyFieldSvg
              svgW={SVG_W} svgH={SVG_H}
              fieldLeft={FIELD_LEFT} fieldRight={FIELD_RIGHT}
              fieldTop={FIELD_TOP} fieldBottom={FIELD_BOTTOM}
            />
            {positioned.map(({ e, pos }, i) => {
              const cx = (pos!.x / 100) * SVG_W;
              const cy = (pos!.y / 100) * SVG_H;
              const color = outcomeColor(e, kind);
              const stroke = e.team_side === "home" ? "#6366f1" : "#1f2937";

              // Direction line for kicks
              const elements: JSX.Element[] = [];
              if (cfg.isKick && pos!.side) {
                const targetX = pos!.side === "right" ? goalRightX : goalLeftX;
                const targetY = goalY;
                // Trim line so it doesn't cover the marker / posts
                const dx = targetX - cx;
                const dy = targetY - cy;
                const len = Math.sqrt(dx * dx + dy * dy);
                const startOffset = 11;
                const endOffset = 14;
                const sx = cx + (dx / len) * startOffset;
                const sy = cy + (dy / len) * startOffset;
                const ex = targetX - (dx / len) * endOffset;
                const ey = targetY - (dy / len) * endOffset;
                const markerId = e.outcome === "success" ? "kick-arrow-success" : e.outcome === "fail" ? "kick-arrow-fail" : "kick-arrow-neutral";
                elements.push(
                  <line
                    key={`l-${i}`}
                    x1={sx} y1={sy} x2={ex} y2={ey}
                    stroke={color}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    opacity={0.7}
                    markerEnd={`url(#${markerId})`}
                  />
                );
              }
              elements.push(
                <Marker key={`m-${i}`} cx={cx} cy={cy} fill={color} stroke={stroke} shape={cfg.shape} />
              );
              return <g key={i}>{elements}</g>;
            })}
          </svg>
        </div>

        {positioned.length === 0 && totalCount > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Aucune position n'a été enregistrée pour ces événements. Utilisez le bouton 📍 lors de la saisie ou la saisie live pour les placer sur le terrain.
          </p>
        )}
        {totalCount === 0 && (
          <p className="text-xs text-muted-foreground text-center">Aucun événement de ce type sur cette période.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
