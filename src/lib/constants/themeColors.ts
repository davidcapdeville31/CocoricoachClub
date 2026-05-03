// Color tokens per session block theme. Used to colorize block cards
// in the field session creator and previews so coaches can quickly
// identify the type of work scheduled.
//
// Returns Tailwind classes (border + bg + text) using semantic-friendly
// hues. Falls back to neutral primary when unknown.

export type ThemeColorTokens = {
  border: string;     // left border color class
  bg: string;         // soft background tint class
  text: string;       // accent text/icon color
  badge: string;      // badge background+text combo
  hex: string;        // raw hex (for inline styles / charts)
};

const PALETTE: Record<string, ThemeColorTokens> = {
  warmup: {
    border: "border-l-amber-500",
    bg: "bg-amber-500/5",
    text: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    hex: "#f59e0b",
  },
  recovery: {
    border: "border-l-sky-500",
    bg: "bg-sky-500/5",
    text: "text-sky-600 dark:text-sky-400",
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    hex: "#0ea5e9",
  },
  collectif: {
    border: "border-l-emerald-500",
    bg: "bg-emerald-500/5",
    text: "text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    hex: "#10b981",
  },
  technique: {
    border: "border-l-blue-500",
    bg: "bg-blue-500/5",
    text: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    hex: "#3b82f6",
  },
  tactique: {
    border: "border-l-indigo-500",
    bg: "bg-indigo-500/5",
    text: "text-indigo-600 dark:text-indigo-400",
    badge: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    hex: "#6366f1",
  },
  opposition: {
    border: "border-l-rose-500",
    bg: "bg-rose-500/5",
    text: "text-rose-600 dark:text-rose-400",
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    hex: "#f43f5e",
  },
  competition: {
    border: "border-l-red-500",
    bg: "bg-red-500/5",
    text: "text-red-600 dark:text-red-400",
    badge: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
    hex: "#ef4444",
  },
  fitness: {
    border: "border-l-fuchsia-500",
    bg: "bg-fuchsia-500/5",
    text: "text-fuchsia-600 dark:text-fuchsia-400",
    badge: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30",
    hex: "#d946ef",
  },
  musculation: {
    border: "border-l-violet-500",
    bg: "bg-violet-500/5",
    text: "text-violet-600 dark:text-violet-400",
    badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
    hex: "#8b5cf6",
  },
  course: {
    border: "border-l-cyan-500",
    bg: "bg-cyan-500/5",
    text: "text-cyan-600 dark:text-cyan-400",
    badge: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
    hex: "#06b6d4",
  },
  fractionne: {
    border: "border-l-orange-500",
    bg: "bg-orange-500/5",
    text: "text-orange-600 dark:text-orange-400",
    badge: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    hex: "#f97316",
  },
  bowling: {
    border: "border-l-teal-500",
    bg: "bg-teal-500/5",
    text: "text-teal-600 dark:text-teal-400",
    badge: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
    hex: "#14b8a6",
  },
  default: {
    border: "border-l-primary/60",
    bg: "bg-primary/5",
    text: "text-primary",
    badge: "bg-primary/15 text-primary border-primary/30",
    hex: "hsl(var(--primary))",
  },
};

/**
 * Resolve color tokens for a session block theme.
 * Accepts either the raw `training_type` value or its display label.
 */
export function getThemeColorTokens(themeOrLabel?: string | null): ThemeColorTokens {
  if (!themeOrLabel) return PALETTE.default;
  const t = themeOrLabel.toLowerCase().trim();

  if (t.includes("échauf") || t.includes("echauf") || t.includes("warmup")) return PALETTE.warmup;
  if (t.includes("récup") || t.includes("recup") || t.includes("recovery")) return PALETTE.recovery;
  if (t.includes("muscu") || t.includes("strength")) return PALETTE.musculation;
  if (t.includes("fraction") || t.includes("hiit") || t.includes("interval")) return PALETTE.fractionne;
  if (t.includes("course") || t.includes("running") || t.includes("endurance") || t.includes("cardio")) return PALETTE.course;
  if (t.includes("fitness")) return PALETTE.fitness;
  if (t.includes("opposition") || t.includes("contact")) return PALETTE.opposition;
  if (t.includes("compét") || t.includes("compet") || t.includes("match") || t.includes("spécifique compét")) return PALETTE.competition;
  if (t.includes("tactique") || t.includes("tactical")) return PALETTE.tactique;
  if (t.includes("technique") || t.includes("technical") || t.includes("skills")) return PALETTE.technique;
  if (t.includes("collectif") || t.includes("team")) return PALETTE.collectif;
  if (t.includes("bowling")) return PALETTE.bowling;

  return PALETTE.default;
}
