/**
 * Stable color mapping per competition name.
 * Same competition name → same color across the app (Vue Annuelle,
 * Calendrier Global, timelines...). The default (empty/undefined) stays red.
 */

export interface CompetitionColor {
  /** Solid background class (e.g. bg-rose-500) */
  bg: string;
  /** Hover background class */
  bgHover: string;
  /** Text class on solid bg (always white for readability) */
  text: string;
  /** Soft background (e.g. bg-rose-500/15) for chips */
  soft: string;
  /** Text class on soft bg */
  softText: string;
  /** Named hex used for calendar dots / chart legends */
  hex: string;
  /** Human name (for tooltips / legends) */
  name: string;
}

const PALETTE: CompetitionColor[] = [
  { bg: "bg-rose-500",    bgHover: "hover:bg-rose-600",    text: "text-white", soft: "bg-rose-500/15",    softText: "text-rose-700 dark:text-rose-300",    hex: "#f43f5e", name: "rose" },
  { bg: "bg-amber-500",   bgHover: "hover:bg-amber-600",   text: "text-white", soft: "bg-amber-500/15",   softText: "text-amber-700 dark:text-amber-300",   hex: "#f59e0b", name: "amber" },
  { bg: "bg-emerald-500", bgHover: "hover:bg-emerald-600", text: "text-white", soft: "bg-emerald-500/15", softText: "text-emerald-700 dark:text-emerald-300", hex: "#10b981", name: "emerald" },
  { bg: "bg-sky-500",     bgHover: "hover:bg-sky-600",     text: "text-white", soft: "bg-sky-500/15",     softText: "text-sky-700 dark:text-sky-300",       hex: "#0ea5e9", name: "sky" },
  { bg: "bg-violet-500",  bgHover: "hover:bg-violet-600",  text: "text-white", soft: "bg-violet-500/15",  softText: "text-violet-700 dark:text-violet-300", hex: "#8b5cf6", name: "violet" },
  { bg: "bg-fuchsia-500", bgHover: "hover:bg-fuchsia-600", text: "text-white", soft: "bg-fuchsia-500/15", softText: "text-fuchsia-700 dark:text-fuchsia-300", hex: "#d946ef", name: "fuchsia" },
  { bg: "bg-teal-500",    bgHover: "hover:bg-teal-600",    text: "text-white", soft: "bg-teal-500/15",    softText: "text-teal-700 dark:text-teal-300",     hex: "#14b8a6", name: "teal" },
  { bg: "bg-orange-500",  bgHover: "hover:bg-orange-600",  text: "text-white", soft: "bg-orange-500/15",  softText: "text-orange-700 dark:text-orange-300", hex: "#f97316", name: "orange" },
  { bg: "bg-indigo-500",  bgHover: "hover:bg-indigo-600",  text: "text-white", soft: "bg-indigo-500/15",  softText: "text-indigo-700 dark:text-indigo-300", hex: "#6366f1", name: "indigo" },
  { bg: "bg-lime-600",    bgHover: "hover:bg-lime-700",    text: "text-white", soft: "bg-lime-500/15",    softText: "text-lime-700 dark:text-lime-300",     hex: "#65a30d", name: "lime" },
  { bg: "bg-pink-500",    bgHover: "hover:bg-pink-600",    text: "text-white", soft: "bg-pink-500/15",    softText: "text-pink-700 dark:text-pink-300",     hex: "#ec4899", name: "pink" },
  { bg: "bg-cyan-600",    bgHover: "hover:bg-cyan-700",    text: "text-white", soft: "bg-cyan-500/15",    softText: "text-cyan-700 dark:text-cyan-300",     hex: "#0891b2", name: "cyan" },
];

const DEFAULT_COLOR = PALETTE[0]; // rose = red default (as requested)

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/**
 * Stable competition → color mapping. Empty / null / undefined competition
 * keeps the default (rose/red).
 */
export function getCompetitionColor(competition?: string | null): CompetitionColor {
  if (!competition || !competition.trim()) return DEFAULT_COLOR;
  const key = competition.trim().toLowerCase();
  const idx = hash(key) % PALETTE.length;
  return PALETTE[idx];
}
