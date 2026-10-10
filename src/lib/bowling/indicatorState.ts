import type { ThrowData } from "@/components/athlete-portal/BowlingScoreSheet";
import { observationValue } from "./observationControls";

export type IndicatorValue = boolean | null;
export type IndicatorType = "pocket" | "split";
export function nextIndicatorValue(value: IndicatorValue): IndicatorValue {
  return value === null ? true : value === true ? false : null;
}
export function indicatorValue(roll: ThrowData, type: IndicatorType): IndicatorValue {
  return observationValue(roll, type === "pocket" ? "isPocket" : "isSplit") ?? null;
}
// Null adapts to existing observed-fields JSON; historical statistics stay intact.
export function resetThrowIndicators(roll: ThrowData): ThrowData {
  const observed = roll.observed ?? ["isPocket", "isSplit", "isSinglePin", "isSinglePinConverted"];
  return { ...roll, isPocket: false, isSplit: false, observed: observed.filter(field => field !== "isPocket" && field !== "isSplit") };
}
