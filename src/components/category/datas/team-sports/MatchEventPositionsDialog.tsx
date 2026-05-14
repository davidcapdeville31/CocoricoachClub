import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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

const KIND_CONFIG: Record<PositionStatKind, { title: string; eventTypes: string[]; shape: "circle" | "square" | "diamond" | "triangle"; color: string }> = {
  try:          { title: "Position des essais",            eventTypes: ["try", "penalty_try"],     shape: "triangle", color: "#10b981" },
  conversion:   { title: "Position des transformations",   eventTypes: ["conversion"],             shape: "circle",   color: "#3b82f6" },
  penalty_kick: { title: "Position des pénalités (tirs)",  eventTypes: ["penalty_kick"],           shape: "square",   color: "#f97316" },
  drop:         { title: "Position des drops",             eventTypes: ["drop"],                   shape: "diamond",  color: "#8b5cf6" },
  lineout:      { title: "Position des touches",           eventTypes: ["lineout"],                shape: "circle",   color: "#eab308" },
  scrum:        { title: "Position des mêlées",            eventTypes: ["scrum"],                  shape: "square",   color: "#a855f7" },
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: PositionStatKind;
  events: MatchEvent[];
  homeName: string;
  awayName: string;
}

function getPos(e: MatchEvent): { x: number; y: number } | null {
  const m = e.metadata || {};
  const x = typeof (m as any).kickX === "number" ? (m as any).kickX : (m as any).position?.x;
  const y = typeof (m as any).kickY === "number" ? (m as any).kickY : (m as any).position?.y;
  if (typeof x !== "number" || typeof y !== "number") return null;
  return { x, y };
}

function outcomeColor(e: MatchEvent, kind: PositionStatKind): string {
  if (kind === "try") return "#22c55e";
  if (kind === "lineout" || kind === "scrum") {
    if (e.outcome === "won") return "#22c55e";
    if (e.outcome === "lost") return "#ef4444";
    return "#94a3b8";
  }
  // kicks
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

  const items = useMemo(() => {
    const filtered = events.filter(e => cfg.eventTypes.includes(e.event_type || ""));
    return filtered.map(e => {
      const pos = getPos(e);
      return { e, pos };
    });
  }, [events, cfg]);

  const positioned = items.filter(i => i.pos);
  const totalCount = items.length;
  const homeCount = items.filter(i => i.e.team_side === "home").length;
  const awayCount = items.filter(i => i.e.team_side === "away").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            {cfg.title}
          </DialogTitle>
          <DialogDescription>
            {totalCount} événement{totalCount > 1 ? "s" : ""} sur le match — {positioned.length} avec position enregistrée
          </DialogDescription>
        </DialogHeader>

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
            </>
          )}
        </div>

        <div className="relative w-full" style={{ aspectRatio: "3/2" }}>
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-full">
            <RugbyFieldSvg
              svgW={SVG_W} svgH={SVG_H}
              fieldLeft={FIELD_LEFT} fieldRight={FIELD_RIGHT}
              fieldTop={FIELD_TOP} fieldBottom={FIELD_BOTTOM}
            />
            {positioned.map(({ e, pos }, i) => {
              const cx = (pos!.x / 100) * SVG_W;
              const cy = (pos!.y / 100) * SVG_H;
              const fill = outcomeColor(e, kind);
              // Stroke distinguishes team: primary for home, dark for away
              const stroke = e.team_side === "home" ? "#6366f1" : "#1f2937";
              return <Marker key={i} cx={cx} cy={cy} fill={fill} stroke={stroke} shape={cfg.shape} />;
            })}
          </svg>
        </div>

        {positioned.length === 0 && totalCount > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Aucune position n'a été enregistrée pour ces événements. Utilisez le bouton 📍 lors de la saisie ou la saisie live pour les placer sur le terrain.
          </p>
        )}
        {totalCount === 0 && (
          <p className="text-xs text-muted-foreground text-center">Aucun événement de ce type sur le match.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
