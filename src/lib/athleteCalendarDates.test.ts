import { describe, expect, test } from "bun:test";
import { calendarDateKey, calendarWeek, civilDate, dateInEvent, navigateCalendar } from "./athleteCalendarDates";

describe("athlete calendar civil dates", () => {
  test("week starts on Monday and has seven dates", () => {
    expect(calendarWeek(civilDate("2026-10-10")).map(calendarDateKey)).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
  });
  test("month navigation crosses years without losing the civil day", () => {
    expect(calendarDateKey(navigateCalendar(civilDate("2026-12-10"), "month", 1))).toBe("2027-01-10");
    expect(calendarDateKey(navigateCalendar(civilDate("2026-01-10"), "month", -1))).toBe("2025-12-10");
  });
  test("leap day is retained and month-end navigation is clamped", () => {
    expect(calendarDateKey(navigateCalendar(civilDate("2024-01-31"), "month", 1))).toBe("2024-02-29");
  });
  test("weekly navigation preserves dates across summer and winter clock changes", () => {
    expect(calendarDateKey(navigateCalendar(civilDate("2026-03-28"), "week", 1))).toBe("2026-04-04");
    expect(calendarDateKey(navigateCalendar(civilDate("2026-10-24"), "week", 1))).toBe("2026-10-31");
  });
  test("multi-day competitions include both boundaries, not adjacent days", () => {
    expect(dateInEvent("2026-10-10", "2026-10-10", "2026-10-12")).toBe(true);
    expect(dateInEvent("2026-10-12", "2026-10-10", "2026-10-12")).toBe(true);
    expect(dateInEvent("2026-10-13", "2026-10-10", "2026-10-12")).toBe(false);
    expect(dateInEvent("2026-10-09", "2026-10-10", "2026-10-12")).toBe(false);
  });
  test("missing or invalid end dates do not move the event", () => {
    expect(dateInEvent("2026-10-10", "2026-10-10")).toBe(true);
    expect(dateInEvent("2026-10-11", "2026-10-10", "2026-10-09")).toBe(false);
  });
});