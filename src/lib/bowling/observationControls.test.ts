import { describe, expect, test } from "bun:test";
import { changeThrow, emptyFrames } from "./scoreRules";
import { observationValue, quickObservationFields, toggleObservation } from "./observationControls";
import { calculateBowlingStats } from "./scoreStats";

describe("Mobile optional bowling observations", () => {
  test("unentered remains absent; tapping activates then explicitly records no", () => {
    const f = changeThrow(emptyFrames(), 0, 0, "7").frames;
    const roll = f[0].throws[0];
    expect(observationValue(roll, "isPocket")).toBeUndefined();
    expect(toggleObservation(undefined)).toBe(true);
    expect(toggleObservation(true)).toBe(false);
    expect(toggleObservation(false)).toBe(true);
    expect(calculateBowlingStats(f).pocketOpportunities).toBe(0);
    roll.observed = ["isPocket"];
    roll.isPocket = false;
    expect(observationValue(roll, "isPocket")).toBe(false);
    expect(calculateBowlingStats(f).pocketOpportunities).toBe(1);
    roll.observed = [];
    expect(calculateBowlingStats(f).pocketOpportunities).toBe(0);
  });
  test("only first rack throws have controls; strikes hide split", () => {
    let f = changeThrow(emptyFrames(), 1, 0, "7").frames;
    expect(quickObservationFields(f[1], 1, 0, true)).toEqual(["isPocket", "isSplit"]);
    f = changeThrow(f, 1, 1, "2").frames;
    expect(quickObservationFields(f[1], 1, 1, true)).toEqual([]);
    f = changeThrow(f, 2, 0, "10").frames;
    expect(quickObservationFields(f[2], 2, 0, true)).toEqual(["isPocket"]);
    expect(quickObservationFields(f[1], 1, 0, false)).toEqual(["isSplit"]);
  });
  test("tenth bonus controls respect rack resets", () => {
    let f = changeThrow(emptyFrames(), 9, 0, "10").frames;
    f = changeThrow(f, 9, 1, "7").frames;
    f = changeThrow(f, 9, 2, "3").frames;
    expect(quickObservationFields(f[9], 9, 1, true)).toEqual(["isPocket", "isSplit"]);
    expect(quickObservationFields(f[9], 9, 2, true)).toEqual([]);
    f = changeThrow(f, 9, 1, "10").frames;
    expect(quickObservationFields(f[9], 9, 2, true)).toEqual(["isPocket", "isSplit"]);
  });
  test("correction to strike preserves existing split; roundtrip preserves yes no and missing", () => {
    let f = changeThrow(emptyFrames(), 0, 0, "7").frames;
    f[0].throws[0].observed = ["isPocket", "isSplit"];
    f[0].throws[0].isSplit = true;
    f = changeThrow(f, 0, 0, "10").frames;
    const restored = JSON.parse(JSON.stringify(f));
    expect(observationValue(restored[0].throws[0], "isSplit")).toBe(true);
    expect(observationValue(restored[0].throws[0], "isPocket")).toBe(false);
    expect(observationValue(restored[0].throws[0], "isSinglePin")).toBeUndefined();
    expect(quickObservationFields(restored[0], 0, 0, true)).toEqual(["isPocket"]);
  });
});