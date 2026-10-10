import type { ThrowData, FrameData } from "@/components/athlete-portal/BowlingScoreSheet";
import { hasThrow, isFirstBall } from "./scoreRules";

export type ObservationField = "isPocket" | "isSplit" | "isSinglePin" | "isSinglePinConverted";

export function observationValue(roll: ThrowData, field: ObservationField): boolean | undefined {
  return roll.observed !== undefined && !roll.observed.includes(field) ? undefined : roll[field];
}

export function toggleObservation(value: boolean | undefined): boolean {
  return value !== true;
}

export function quickObservationFields(frame: FrameData, index: number, roll: number, trackPockets: boolean): ObservationField[] {
  const data = frame.throws[roll];
  if (!hasThrow(data) || !isFirstBall(index, roll, frame)) return [];
  return [...(trackPockets ? ["isPocket" as const] : []), ...(data.value !== "X" ? ["isSplit" as const] : [])];
}