import { useRef } from "react";
import { cn } from "@/lib/utils";
import type { BasketballPrecisionExercise } from "@/lib/constants/basketballPrecisionExercises";

/**
 * Cliquable half-court basketball SVG.
 * Coordinates: 0..100 on both axes (x = horizontal, y = vertical).
 * Origin (0,0) = top-left corner. The basket is at the top center.
 *
 *  Geometry (approx. FIBA half-court, mirrored so basket = top):
 *    - Hoop center: (50, 8)
 *    - Backboard line: y = 5
 *    - Free-throw line: y = 28 (paint length ≈ 580cm in real life)
 *    - Free-throw circle radius: 12 (in x units)
 *    - Paint (key): x ∈ [37, 63], y ∈ [5, 28]
 *    - 3-pt arc: radius 32 around hoop, with corner straight lines
 */

export interface BasketCourtPoint {
  x: number;
  y: number;
  attempts: number;
  successes: number;
  exerciseLabel?: string;
  id?: string;
}

interface Props {
  exercise: BasketballPrecisionExercise;
  points?: BasketCourtPoint[];
  onClickZone?: (x: number, y: number, zoneLabel: string) => void;
  highlightedExerciseValue?: string;
  className?: string;
  /** Disable interactions (read-only) */
  readOnly?: boolean;
}

const COURT_FILL = "hsl(28 60% 88%)";
const LINE = "hsl(220 25% 25%)";
const PAINT_FILL_INACTIVE = "hsl(15 70% 60% / 0.18)";
const PAINT_FILL_ACTIVE = "hsl(var(--primary) / 0.35)";
const HIGHLIGHT = "hsl(var(--primary) / 0.28)";
const HIGHLIGHT_STROKE = "hsl(var(--primary))";

export function BasketballHalfCourtSVG({
  exercise,
  points = [],
  onClickZone,
  className,
  readOnly,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  const pointInExerciseRegion = (x: number, y: number): boolean => {
    switch (exercise.region) {
      case "free_throw_line": {
        // Tight band around the free-throw line
        return y >= 26 && y <= 31 && x >= 38 && x <= 62;
      }
      case "paint": {
        // Inside the painted area + restricted area near the hoop
        return x >= 37 && x <= 63 && y >= 5 && y <= 28;
      }
      case "three_point_arc": {
        // Outside the 3-pt arc & line. Arc radius ~32 around (50, 8).
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
    // 3pt
    if (y <= 12 && (x <= 18 || x >= 82)) return "Corner 3pts";
    if (y <= 30 && (x <= 25 || x >= 75)) return "Aile 3pts";
    return "Top 3pts";
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (readOnly || !onClickZone || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xRaw = ((e.clientX - rect.left) / rect.width) * 100;
    const yRaw = ((e.clientY - rect.top) / rect.height) * 70; // viewBox height 70
    const x = Math.round(xRaw * 10) / 10;
    const y = Math.round(yRaw * 10) / 10;
    if (!pointInExerciseRegion(x, y)) return;
    onClickZone(x, y, zoneLabelFor(x, y));
  };

  // Build 3-pt arc path: circle radius 32 centered at (50,8), from (18,8) to (82,8)
  const arcPath = `M 18 8 A 32 32 0 0 0 82 8`;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 70"
      className={cn(
        "w-full h-auto select-none rounded-2xl border border-border shadow-sm",
        !readOnly && "cursor-crosshair",
        className,
      )}
      onClick={handleClick}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Court background */}
      <rect x="0" y="0" width="100" height="70" fill={COURT_FILL} />
      {/* Sidelines + baseline + halfcourt line at bottom */}
      <rect
        x="1"
        y="1"
        width="98"
        height="68"
        fill="none"
        stroke={LINE}
        strokeWidth="0.5"
      />

      {/* Highlighted region */}
      {exercise.region === "free_throw_line" && (
        <rect
          x="38"
          y="26"
          width="24"
          height="5"
          fill={HIGHLIGHT}
          stroke={HIGHLIGHT_STROKE}
          strokeWidth="0.4"
          strokeDasharray="1 1"
          rx="0.5"
        />
      )}
      {exercise.region === "three_point_arc" && (
        <>
          {/* shaded outer area beyond the arc */}
          <path
            d={`M 4 8 L 18 8 ${arcPath.replace("M 18 8 ", "")} L 96 8 L 96 60 L 4 60 Z`}
            fill={HIGHLIGHT}
            opacity="0.55"
          />
        </>
      )}

      {/* Paint (key) */}
      <rect
        x="37"
        y="5"
        width="26"
        height="23"
        fill={exercise.region === "paint" ? HIGHLIGHT : PAINT_FILL}
        stroke={exercise.region === "paint" ? HIGHLIGHT_STROKE : LINE}
        strokeWidth="0.5"
      />
      {/* Free-throw line */}
      <line x1="37" y1="28" x2="63" y2="28" stroke={LINE} strokeWidth="0.5" />
      {/* Free-throw circle (top half = solid, bottom half = dashed) */}
      <path
        d="M 38 28 A 12 12 0 0 1 62 28"
        fill="none"
        stroke={LINE}
        strokeWidth="0.5"
      />
      <path
        d="M 38 28 A 12 12 0 0 0 62 28"
        fill="none"
        stroke={LINE}
        strokeWidth="0.5"
        strokeDasharray="1.2 1.2"
      />

      {/* Restricted area arc near hoop */}
      <path
        d="M 46 5 A 4 4 0 0 0 54 5"
        fill="none"
        stroke={LINE}
        strokeWidth="0.4"
      />

      {/* Backboard */}
      <line
        x1="44"
        y1="5"
        x2="56"
        y2="5"
        stroke={LINE}
        strokeWidth="0.9"
      />
      {/* Hoop */}
      <circle
        cx="50"
        cy="7.5"
        r="1.4"
        fill="none"
        stroke="hsl(15 80% 45%)"
        strokeWidth="0.6"
      />

      {/* 3-pt line */}
      <path d={arcPath} fill="none" stroke={LINE} strokeWidth="0.5" />
      {/* 3-pt corner straight lines (from baseline up to where the arc starts) */}
      <line x1="18" y1="1" x2="18" y2="8" stroke={LINE} strokeWidth="0.5" />
      <line x1="82" y1="1" x2="82" y2="8" stroke={LINE} strokeWidth="0.5" />

      {/* Halfcourt circle */}
      <path
        d="M 38 70 A 12 12 0 0 1 62 70"
        fill="none"
        stroke={LINE}
        strokeWidth="0.5"
      />

      {/* Existing entries - colored by success rate */}
      {points.map((pt, i) => {
        const rate = pt.attempts > 0 ? pt.successes / pt.attempts : 0;
        const color =
          rate >= 0.7
            ? "hsl(142 71% 45%)"
            : rate >= 0.4
              ? "hsl(38 92% 50%)"
              : "hsl(0 84% 60%)";
        return (
          <g key={pt.id ?? i}>
            <circle
              cx={pt.x}
              cy={pt.y}
              r="1.5"
              fill={color}
              stroke="white"
              strokeWidth="0.3"
              opacity="0.9"
            />
            <text
              x={pt.x}
              y={pt.y - 2}
              textAnchor="middle"
              fontSize="2"
              fill="hsl(var(--foreground))"
              fontWeight="600"
              pointerEvents="none"
            >
              {Math.round(rate * 100)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
