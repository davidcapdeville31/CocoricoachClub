/**
 * Resolve the exact color used in the app for a training type / event
 * (Tailwind class from TRAINING_TYPE_COLORS) into an RGB triplet usable by jsPDF.
 * Works for every discipline since it parses the Tailwind class generically.
 */
import { getTrainingTypeColor } from "@/lib/constants/trainingTypes";

type RGB = [number, number, number];

/** Tailwind default palette (shades used across the app). */
const TW_PALETTE: Record<string, Record<string, RGB>> = {
  slate: { 400: [148, 163, 184], 500: [100, 116, 139], 600: [71, 85, 105], 700: [51, 65, 85] },
  gray: { 400: [156, 163, 175], 500: [107, 114, 128], 600: [75, 85, 99], 700: [55, 65, 81] },
  zinc: { 400: [161, 161, 170], 500: [113, 113, 122], 600: [82, 82, 91], 700: [63, 63, 70] },
  stone: { 400: [168, 162, 158], 500: [120, 113, 108], 600: [87, 83, 78], 700: [68, 64, 60] },
  red: { 400: [248, 113, 113], 500: [239, 68, 68], 600: [220, 38, 38], 700: [185, 28, 28] },
  orange: { 400: [251, 146, 60], 500: [249, 115, 22], 600: [234, 88, 12], 700: [194, 65, 12] },
  amber: { 400: [251, 191, 36], 500: [245, 158, 11], 600: [217, 119, 6], 700: [180, 83, 9] },
  yellow: { 400: [250, 204, 21], 500: [234, 179, 8], 600: [202, 138, 4], 700: [161, 98, 7] },
  lime: { 400: [163, 230, 53], 500: [132, 204, 22], 600: [101, 163, 13], 700: [77, 124, 15] },
  green: { 400: [74, 222, 128], 500: [34, 197, 94], 600: [22, 163, 74], 700: [21, 128, 61] },
  emerald: { 400: [52, 211, 153], 500: [16, 185, 129], 600: [5, 150, 105], 700: [4, 120, 87] },
  teal: { 400: [45, 212, 191], 500: [20, 184, 166], 600: [13, 148, 136], 700: [15, 118, 110] },
  cyan: { 400: [34, 211, 238], 500: [6, 182, 212], 600: [8, 145, 178], 700: [14, 116, 144] },
  sky: { 400: [56, 189, 248], 500: [14, 165, 233], 600: [2, 132, 199], 700: [3, 105, 161] },
  blue: { 400: [96, 165, 250], 500: [59, 130, 246], 600: [37, 99, 235], 700: [29, 78, 216] },
  indigo: { 400: [129, 140, 248], 500: [99, 102, 241], 600: [79, 70, 229], 700: [67, 56, 202] },
  violet: { 400: [167, 139, 250], 500: [139, 92, 246], 600: [124, 58, 237], 700: [109, 40, 217] },
  purple: { 400: [192, 132, 252], 500: [168, 85, 247], 600: [147, 51, 234], 700: [126, 34, 206] },
  fuchsia: { 400: [232, 121, 249], 500: [217, 70, 239], 600: [192, 38, 211], 700: [162, 28, 175] },
  pink: { 400: [244, 114, 182], 500: [236, 72, 153], 600: [219, 39, 119], 700: [190, 24, 93] },
  rose: { 400: [251, 113, 133], 500: [244, 63, 94], 600: [225, 29, 72], 700: [190, 18, 60] },
};

/** Fallback values of the semantic training tokens (see src/index.css). */
const TRAINING_TOKEN_FALLBACK: Record<string, string> = {
  "training-collectif": "214 70% 50%",
  "training-technique": "188 76% 40%",
  "training-physique": "160 60% 42%",
  "training-musculation": "32 70% 50%",
  "training-repos": "214 15% 55%",
  "training-test": "45 93% 47%",
};

function hslStringToRgb(hsl: string): RGB | null {
  const m = hsl.trim().match(/^(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!m) return null;
  const h = parseFloat(m[1]) / 360;
  const s = parseFloat(m[2]) / 100;
  const l = parseFloat(m[3]) / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function tokenToRgb(token: string): RGB | null {
  let raw = "";
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    raw = getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
  }
  if (!raw) raw = TRAINING_TOKEN_FALLBACK[token] || "";
  if (!raw) return null;
  return hslStringToRgb(raw);
}

/** Convert a Tailwind background class (e.g. "bg-orange-500", "bg-training-physique") to RGB. */
export function tailwindClassToRgb(className: string): RGB | null {
  if (!className) return null;
  // Gradients: take the first "from-<color>" stop
  const gradientStop = className.match(/from-([a-z]+)-(\d{2,3})/);
  const base = gradientStop
    ? `bg-${gradientStop[1]}-${gradientStop[2]}`
    : (className.split(/\s+/).find((c) => c.startsWith("bg-")) || "");
  if (!base) return null;
  const value = base.replace(/^bg-/, "");

  // Semantic tokens (training-*, primary, destructive…)
  if (value.startsWith("training-")) return tokenToRgb(value);

  const parts = value.split("-");
  if (parts.length >= 2) {
    const shade = parts[parts.length - 1];
    const family = parts.slice(0, -1).join("-");
    const fam = TW_PALETTE[family];
    if (fam) {
      return fam[shade] || fam["500"] || null;
    }
  }
  return tokenToRgb(value);
}

/** Exact PDF color for a training type, identical to the in-app badge color. */
export function trainingTypeRgb(trainingType?: string | null): RGB {
  const cls = getTrainingTypeColor(trainingType || "_default");
  return tailwindClassToRgb(cls) || [107, 114, 128];
}

/** Color used for competitions / matches (same as the app: rose-500). */
export const MATCH_RGB: RGB = [244, 63, 94];
