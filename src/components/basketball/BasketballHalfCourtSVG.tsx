import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { BasketballPrecisionExercise } from "@/lib/constants/basketballPrecisionExercises";

/**
 * Cliquable half-court basketball SVG.
 * viewBox: 100 (x) x 70 (y). Origin top-left. Basket at top center.
 * Real-world half-court ≈ 15m wide x 14m long.
 *  → x scale ≈ 0.15 m/unit, y scale ≈ 0.20 m/unit.
 */

export interface BasketCourtPoint {
  x: number;
  y: number;
  attempts: number;
  successes: number;
  exerciseLabel?: string;
  id?: string;
}

export type PendingResult = "success" | "miss" | null;

interface Props {
  exercise: BasketballPrecisionExercise;
  points?: BasketCourtPoint[];
  onClickZone?: (x: number, y: number, zoneLabel: string) => void;
  highlightedExerciseValue?: string;
  className?: string;
  /** Disable interactions (read-only) */
  readOnly?: boolean;
  /** Pending shot to render with a dashed circle */
  pending?: { x: number; y: number } | null;
  /** Result chosen for the pending shot (colors the circle) */
  pendingResult?: PendingResult;
  /** Show cursor crosshair + distances (default true) */
  showCursorTracker?: boolean;
}

const COURT_FILL = "hsl(28 60% 88%)";
const LINE = "hsl(220 25% 25%)";
const PAINT_FILL_INACTIVE = "hsl(15 70% 60% / 0.18)";
const PAINT_FILL_ACTIVE = "hsl(var(--primary) / 0.35)";
const HIGHLIGHT = "hsl(var(--primary) / 0.28)";
const HIGHLIGHT_STROKE = "hsl(var(--primary))";

// Real-world conversion (FIBA half-court 15m x 14m)
const M_PER_X = 15 / 100; // 0.15
const M_PER_Y = 14 / 70; // 0.20
const HOOP_X = 50;
const HOOP_Y = 8;

function distFromHoopMeters(x: number, y: number): number {
  const dx = (x - HOOP_X) * M_PER_X;
  const dy = (y - HOOP_Y) * M_PER_Y;
  return Math.round(Math.sqrt(dx * dx + dy * dy) * 10) / 10;
}

export function BasketballHalfCourtSVG({
  exercise,
  points = [],
  onClickZone,
  className,
  readOnly,
  pending,
  pendingResult = null,
  showCursorTracker = true,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const pointInExerciseRegion = (x: number, y: number): boolean => {
    switch (exercise.region) {
      case "free_throw_line":
        return y >= 26 && y <= 31 && x >= 38 && x <= 62;
      case "paint":
        return x >= 37 && x <= 63 && y >= 5 && y <= 28;
      case "three_point_arc": {
        const dx = x - 50;
        const dy = y - 8;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist >= 32 && y <= 60 && x >= 4 && x <= 96;
      }
      case "all":
      default:
        return y <= 70;
    }
  };

  const zoneLabelFor = (x: number, y: number): string => {
    if (exercise.region === "free_throw_line") return "Lancer franc";
    if (exercise.region === "paint") {
      if (Math.hypot(x - 50, y - 8) <= 8) return "Sous le cercle";
      return "Raquette";
    }
    if (y <= 12 && (x <= 18 || x >= 82)) return "Corner 3pts";
    if (y <= 30 && (x <= 25 || x >= 75)) return "Aile 3pts";
    return "Top 3pts";
  };

  const getSvgCoords = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 70;
    return { x, y };
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (readOnly || !showCursorTracker) return;
    setCursor(getSvgCoords(e));
  }, [readOnly, showCursorTracker]);

  const handleMouseLeave = useCallback(() => setCursor(null), []);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (readOnly || !onClickZone) return;
    const { x: xRaw, y: yRaw } = getSvgCoords(e);
    const x = Math.round(xRaw * 10) / 10;
    const y = Math.round(yRaw * 10) / 10;
    if (!pointInExerciseRegion(x, y)) return;
    onClickZone(x, y, zoneLabelFor(x, y));
  };

  const arcPath = `M 18 8 A 32 32 0 0 0 82 8`;

  const cursorDistM = cursor ? distFromHoopMeters(cursor.x, cursor.y) : 0;
  const cursorLeftM = cursor ? Math.round(cursor.x * M_PER_X * 10) / 10 : 0;
  const cursorRightM = cursor ? Math.round((100 - cursor.x) * M_PER_X * 10) / 10 : 0;

  // Pending circle styling based on result
  const pendingFill =
    pendingResult === "success"
      ? "hsl(142 71% 45% / 0.35)"
      : pendingResult === "miss"
        ? "hsl(0 84% 60% / 0.35)"
        : "transparent";
  const pendingStroke =
    pendingResult === "success"
      ? "hsl(142 71% 38%)"
      : pendingResult === "miss"
        ? "hsl(0 84% 50%)"
        : "hsl(var(--primary))";

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        viewBox="0 0 100 70"
        className={cn(
          "w-full h-auto select-none rounded-2xl border border-border shadow-sm",
          !readOnly && "cursor-crosshair",
          className,
        )}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Court background */}
        <rect x="0" y="0" width="100" height="70" fill={COURT_FILL} />
        <rect x="1" y="1" width="98" height="68" fill="none" stroke={LINE} strokeWidth="0.5" />

        {/* Highlighted region */}
        {exercise.region === "free_throw_line" && (
          <rect x="38" y="26" width="24" height="5" fill={HIGHLIGHT}
            stroke={HIGHLIGHT_STROKE} strokeWidth="0.4" strokeDasharray="1 1" rx="0.5" />
        )}
        {exercise.region === "three_point_arc" && (
          <path
            d={`M 4 8 L 18 8 ${arcPath.replace("M 18 8 ", "")} L 96 8 L 96 60 L 4 60 Z`}
            fill={HIGHLIGHT} opacity="0.55"
          />
        )}

        {/* Paint */}
        <rect x="37" y="5" width="26" height="23"
          fill={exercise.region === "paint" ? PAINT_FILL_ACTIVE : PAINT_FILL_INACTIVE}
          stroke={exercise.region === "paint" ? HIGHLIGHT_STROKE : LINE} strokeWidth="0.5" />
        <line x1="37" y1="28" x2="63" y2="28" stroke={LINE} strokeWidth="0.5" />
        <path d="M 38 28 A 12 12 0 0 1 62 28" fill="none" stroke={LINE} strokeWidth="0.5" />
        <path d="M 38 28 A 12 12 0 0 0 62 28" fill="none" stroke={LINE} strokeWidth="0.5" strokeDasharray="1.2 1.2" />
        <path d="M 46 5 A 4 4 0 0 0 54 5" fill="none" stroke={LINE} strokeWidth="0.4" />
        <line x1="44" y1="5" x2="56" y2="5" stroke={LINE} strokeWidth="0.9" />
        <circle cx="50" cy="7.5" r="1.4" fill="none" stroke="hsl(15 80% 45%)" strokeWidth="0.6" />

        {/* 3-pt line */}
        <path d={arcPath} fill="none" stroke={LINE} strokeWidth="0.5" />
        <line x1="18" y1="1" x2="18" y2="8" stroke={LINE} strokeWidth="0.5" />
        <line x1="82" y1="1" x2="82" y2="8" stroke={LINE} strokeWidth="0.5" />

        {/* Halfcourt circle */}
        <path d="M 38 70 A 12 12 0 0 1 62 70" fill="none" stroke={LINE} strokeWidth="0.5" />

        {/* Existing entries */}
        {points.map((pt, i) => {
          const rate = pt.attempts > 0 ? pt.successes / pt.attempts : 0;
          const color =
            rate >= 0.7 ? "hsl(142 71% 45%)" : rate >= 0.4 ? "hsl(38 92% 50%)" : "hsl(0 84% 60%)";
          return (
            <g key={pt.id ?? i}>
              <circle cx={pt.x} cy={pt.y} r="1.5" fill={color} stroke="white" strokeWidth="0.3" opacity="0.9" />
              <text x={pt.x} y={pt.y - 2} textAnchor="middle" fontSize="2"
                fill="hsl(var(--foreground))" fontWeight="600" pointerEvents="none">
                {Math.round(rate * 100)}%
              </text>
            </g>
          );
        })}

        {/* Pending shot circle (dashed → green/red after result) */}
        {pending && (
          <g pointerEvents="none">
            <circle
              cx={pending.x} cy={pending.y} r="2.4"
              fill={pendingFill}
              stroke={pendingStroke}
              strokeWidth="0.6"
              strokeDasharray={pendingResult ? undefined : "1.2 1"}
            />
            {pendingResult === "success" && (
              <path
                d={`M ${pending.x - 1.1} ${pending.y} l 0.9 0.9 l 1.7 -1.8`}
                fill="none" stroke="white" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round"
              />
            )}
            {pendingResult === "miss" && (
              <g stroke="white" strokeWidth="0.5" strokeLinecap="round">
                <line x1={pending.x - 1} y1={pending.y - 1} x2={pending.x + 1} y2={pending.y + 1} />
                <line x1={pending.x + 1} y1={pending.y - 1} x2={pending.x - 1} y2={pending.y + 1} />
              </g>
            )}
          </g>
        )}

        {/* Cursor crosshair + distance labels */}
        {cursor && showCursorTracker && !readOnly && (
          <g pointerEvents="none">
            <line x1={cursor.x} y1="0" x2={cursor.x} y2="70" stroke="rgba(0,0,0,0.45)" strokeWidth="0.25" strokeDasharray="0.8 0.8" />
            <line x1="0" y1={cursor.y} x2="100" y2={cursor.y} stroke="rgba(0,0,0,0.45)" strokeWidth="0.25" strokeDasharray="0.8 0.8" />
            {/* Distance from hoop (top label near cursor x) */}
            <rect x={cursor.x - 5} y="0.5" width="10" height="3.5" rx="0.6" fill="rgba(0,0,0,0.8)" />
            <text x={cursor.x} y="3.2" textAnchor="middle" fill="white" fontSize="2.2" fontWeight="bold" fontFamily="system-ui, sans-serif">
              {cursorDistM}m
            </text>
            {/* Left side label */}
            <rect x="0.5" y={cursor.y - 1.8} width="8" height="3.5" rx="0.6" fill="rgba(0,0,0,0.8)" />
            <text x="4.5" y={cursor.y + 0.7} textAnchor="middle" fill="white" fontSize="2" fontWeight="bold" fontFamily="system-ui, sans-serif">
              {cursorLeftM}m
            </text>
            {/* Right side label */}
            <rect x="91.5" y={cursor.y - 1.8} width="8" height="3.5" rx="0.6" fill="rgba(0,0,0,0.8)" />
            <text x="95.5" y={cursor.y + 0.7} textAnchor="middle" fill="white" fontSize="2" fontWeight="bold" fontFamily="system-ui, sans-serif">
              {cursorRightM}m
            </text>
          </g>
        )}
      </svg>

      {/* Bottom coordinate bar */}
      {cursor && showCursorTracker && !readOnly && (
        <div className="mt-1 bg-black/70 backdrop-blur-sm text-white text-[11px] font-mono px-3 py-1 rounded-md flex justify-between pointer-events-none">
          <span>🎯 {cursorDistM}m du cercle</span>
          <span>Largeur: {cursorLeftM}m / {cursorRightM}m</span>
        </div>
      )}
    </div>
  );
}
