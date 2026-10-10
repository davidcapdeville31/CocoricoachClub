import { describe, expect, test } from "bun:test";
import { changeThrow, emptyFrames } from "./scoreRules";
import { indicatorValue, nextIndicatorValue, resetThrowIndicators } from "./indicatorState";

describe("Poche / Split three-state controls", () => {
  test.each(["pocket", "split"] as const)("%s cycles null → true → false → null repeatedly", () => {
    let value: boolean | null = null;
    for (let cycle = 0; cycle < 3; cycle++) {
      value = nextIndicatorValue(value); expect(value).toBe(true);
      value = nextIndicatorValue(value); expect(value).toBe(false);
      value = nextIndicatorValue(value); expect(value).toBeNull();
    }
  });
  test("reset clears only indicators, preserving pins and other observations", () => {
    const roll = changeThrow(emptyFrames(), 0, 0, "8").frames[0].throws[0];
    Object.assign(roll, { isPocket: true, isSplit: true, isSinglePin: true, observed: ["isPocket", "isSplit", "isSinglePin"] });
    const result = resetThrowIndicators(roll);
    expect(indicatorValue(result, "pocket")).toBeNull();
    expect(indicatorValue(result, "split")).toBeNull();
    expect(result.value).toBe("8"); expect(result.pins).toBe(8);
    expect(result.isSinglePin).toBe(true); expect(result.observed).toEqual(["isSinglePin"]);
    expect(roll.isPocket).toBe(true);
  });
  test("nine combinations survive serialization and preserve explicit false", () => {
    for (const pocket of [null, true, false]) for (const split of [null, true, false]) {
      const roll = changeThrow(emptyFrames(), 0, 0, "8").frames[0].throws[0];
      Object.assign(roll, { isPocket: pocket ?? false, isSplit: split ?? false, observed: [...(pocket !== null ? ["isPocket"] : []), ...(split !== null ? ["isSplit"] : [])] });
      const restored = JSON.parse(JSON.stringify(roll));
      expect(indicatorValue(restored, "pocket")).toBe(pocket);
      expect(indicatorValue(restored, "split")).toBe(split);
    }
  });
});
