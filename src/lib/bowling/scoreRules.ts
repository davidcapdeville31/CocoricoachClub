import type { FrameData, ThrowData } from "@/components/athlete-portal/BowlingScoreSheet";

export const hasThrow = (throwData?: ThrowData) => !!throwData?.value;
export const emptyFrames = (): FrameData[] => Array.from({ length: 10 }, () => ({ throws: [], score: null, cumulativeScore: null }));

/** Number of standing pins, including resets within the tenth frame. */
export function remainingPins(frame: FrameData, index: number, throwIndex: number): number | null {
  if (throwIndex === 0) return 10;
  const first = frame.throws[0];
  if (!hasThrow(first)) return null;
  if (throwIndex === 1) return first.value === "X" ? (index === 9 ? 10 : null) : 10 - first.pins;
  const second = frame.throws[1];
  if (index !== 9 || !hasThrow(second)) return null;
  if (first.value !== "X") return second.value === "/" ? 10 : null;
  return second.value === "X" ? 10 : 10 - second.pins;
}

export function isFrameComplete(frame: FrameData, index: number): boolean {
  if (!hasThrow(frame.throws[0])) return false;
  if (index < 9 && frame.throws[0].value === "X") return true;
  if (!hasThrow(frame.throws[1])) return false;
  if (index === 9 && (frame.throws[0].value === "X" || frame.throws[1].value === "/")) return hasThrow(frame.throws[2]);
  return true;
}

export const isGameComplete = (frames: FrameData[]) => frames.length === 10 && frames.every(isFrameComplete);
export function nextThrowIndex(frame: FrameData, index: number) {
  if (isFrameComplete(frame, index)) return 0;
  for (let t = 0; t < (index === 9 ? 3 : 2); t++) if (!hasThrow(frame.throws[t])) return t;
  return 0;
}

/** Existing ten-pin scoring, with pending throws never treated as zero. */
export function scoreFrames(frames: FrameData[]): FrameData[] {
  let cumulative = 0;
  let prefixConfirmed = true;
  return frames.map((frame, index) => {
    let score: number | null = null;
    if (isFrameComplete(frame, index)) {
      if (index === 9) score = frame.throws.reduce((sum, t) => sum + t.pins, 0);
      else if (frame.throws[0].value === "X" || frame.throws[1]?.value === "/") {
        const needed = frame.throws[0].value === "X" ? 2 : 1;
        const bonus: ThrowData[] = [];
        for (let f = index + 1; f < frames.length && bonus.length < needed; f++) {
          const following = frames[f];
          for (let t = 0; t < (f === 9 ? 3 : following.throws[0]?.value === "X" ? 1 : 2) && bonus.length < needed; t++) {
            const roll = following.throws[t];
            if (!hasThrow(roll)) break;
            bonus.push(roll);
          }
          // Do not skip gaps to consume a later frame's throws as a bonus.
          if (!isFrameComplete(following, f)) break;
        }
        if (bonus.length === needed) score = 10 + bonus.reduce((sum, t) => sum + t.pins, 0);
      } else score = frame.throws[0].pins + frame.throws[1].pins;
    }
    if (score === null) prefixConfirmed = false;
    if (prefixConfirmed && score !== null) cumulative += score;
    return { ...frame, score, cumulativeScore: prefixConfirmed ? cumulative : null };
  });
}

export function confirmedScore(frames: FrameData[]) {
  return frames.reduce((score, frame) => frame.cumulativeScore ?? score, 0);
}

/** Recompute symbols for compatible later rolls; only flag actual incompatible rolls. */
export function changeThrow(frames: FrameData[], index: number, throwIndex: number, raw: string): { frames: FrameData[]; incompatible: boolean; error?: string } {
  const current = frames[index];
  const remaining = remainingPins(current, index, throwIndex);
  if (remaining === null) return { frames, incompatible: false, error: "Renseignez d’abord le lancer précédent." };
  const upper = raw.toUpperCase();
  const pins = upper === "X" ? 10 : upper === "/" ? remaining : upper === "-" || upper === "G" || upper === "" ? 0 : Number(upper);
  if (!Number.isInteger(pins) || pins < 0 || pins > remaining || (upper === "/" && remaining === 10)) return { frames, incompatible: false, error: `Il reste ${remaining} quille${remaining > 1 ? "s" : ""}.` };
  const copy = frames.map(f => ({ ...f, throws: f.throws.map(t => ({ ...t })) }));
  const frame = copy[index];
  const previous = frame.throws[throwIndex];
  const value = upper === "" ? "" : pins === 10 && remaining === 10 ? "X" : pins === remaining && remaining < 10 ? "/" : upper === "G" || upper === "-" ? "-" : String(pins);
  frame.throws[throwIndex] = { value, pins, isPocket: false, isSplit: false, isSinglePin: false, isSinglePinConverted: false, ...previous, value, pins };
  let incompatible = false;
  for (let t = throwIndex + 1; t < frame.throws.length; t++) {
    const roll = frame.throws[t];
    if (!hasThrow(roll)) continue;
    const standing = remainingPins(frame, index, t);
    if (standing === null || roll.pins > standing) {
      incompatible = true;
      frame.throws = frame.throws.slice(0, t);
      break;
    }
    roll.value = roll.pins === 10 && standing === 10 ? "X" : roll.pins === standing && standing < 10 ? "/" : roll.value === "-" ? "-" : String(roll.pins);
  }
  // A strike or open tenth must not retain irrelevant empty cells.
  if (index < 9 && value === "X" && throwIndex === 0) frame.throws = frame.throws.slice(0, 1);
  return { frames: scoreFrames(copy), incompatible };
}

export function isFirstBall(index: number, throwIndex: number, frame: FrameData) {
  return throwIndex === 0 || (index === 9 && (throwIndex === 1 ? frame.throws[0]?.value === "X" : frame.throws[1]?.value === "X" || frame.throws[1]?.value === "/"));
}