import type { FrameData, BowlingStats } from "@/components/athlete-portal/BowlingScoreSheet";
import { confirmedScore, hasThrow, isFirstBall, isFrameComplete } from "./scoreRules";

const pct = (success: number, attempts: number) => attempts ? Math.round(success / attempts * 1000) / 10 : 0;
export function calculateBowlingStats(frames: FrameData[]): BowlingStats {
  let strikes = 0, spares = 0, splitCount = 0, splitConverted = 0, splitOnLastThrow = 0;
  let singlePinCount = 0, singlePinConverted = 0, pocketCount = 0, pocketOpportunities = 0;
  let totalThrows = 0, totalFrames = 0, openFrames = 0, spareOpportunities = 0;
  let firstBallGte8Count = 0, firstBallGte8Opportunities = 0;
  frames.forEach((frame, index) => {
    frame.throws.forEach((roll, t) => {
      if (!hasThrow(roll)) return;
      totalThrows++;
      if (roll.value === "X") strikes++;
      if (roll.value === "/") spares++;
      const firstBall = isFirstBall(index, t, frame);
      const next = frame.throws[t + 1];
      const hasConversionOpportunity = index < 9 || t < 2;
      if (firstBall) {
        totalFrames++;
        // Missing observations are not failed pocket attempts. Legacy booleans retain their meaning.
        if (roll.observed === undefined || roll.observed.includes("isPocket")) {
          pocketOpportunities++;
          if (roll.isPocket) pocketCount++;
        }
        if (hasConversionOpportunity) {
          firstBallGte8Opportunities++;
          if (roll.pins >= 8) firstBallGte8Count++;
          if (roll.pins === 9 && hasThrow(next)) {
            singlePinCount++;
            if (next.value === "/") singlePinConverted++;
          }
          // Keep existing exclusion of unsuccessful splits from spare efficiency.
          if (roll.value !== "X" && hasThrow(next) && (!roll.isSplit || next.value === "/")) spareOpportunities++;
        }
      }
      if (roll.isSplit) {
        if (!hasConversionOpportunity) splitOnLastThrow++;
        else if (hasThrow(next)) {
          splitCount++;
          if (next.value === "/") splitConverted++;
        }
      }
    });
    if (index < 9 && isFrameComplete(frame, index) && frame.throws[0].value !== "X" && frame.throws[1]?.value !== "/" && !frame.throws[0].isSplit) openFrames++;
  });
  return {
    totalScore: confirmedScore(frames), strikes, spares, splitCount, splitConverted, splitOnLastThrow,
    singlePinCount, singlePinConverted, pocketCount, totalThrows, totalFrames, openFrames,
    strikePercentage: pct(strikes, totalFrames), sparePercentage: pct(spares, spareOpportunities),
    splitPercentage: pct(splitConverted, splitCount), singlePinConversionRate: pct(singlePinConverted, singlePinCount),
    pocketPercentage: pct(pocketCount, pocketOpportunities), pocketOpportunities, spareOpportunities,
    firstBallGte8Count, firstBallGte8Opportunities, firstBallGte8Percentage: pct(firstBallGte8Count, firstBallGte8Opportunities),
  };
}