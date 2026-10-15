import { describe, expect, it } from "bun:test";
import { ATHLETE_CALENDAR_EVENT_TYPES } from "./athleteCalendarEventTypes";

describe("athlete calendar event types", () => {
  it("allows athletes to create the same medical event as coaches", () => {
    expect(ATHLETE_CALENDAR_EVENT_TYPES.includes("medical")).toBe(true);
  });
});