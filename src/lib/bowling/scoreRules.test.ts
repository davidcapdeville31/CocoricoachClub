import { describe, expect, test } from "bun:test";
import { changeThrow, emptyFrames, isGameComplete, remainingPins, scoreFrames } from "./scoreRules";
import { calculateBowlingStats } from "./scoreStats";
import { aggregateGamesStats, newGamesBlock, quickScoreStats } from "@/components/bowling/simplified/types";

function play(rolls: number[][]) {
  let frames = emptyFrames();
  rolls.forEach((values, i) => values.forEach((n, t) => {
    const result = changeThrow(frames, i, t, String(n));
    if (result.error) throw Error(result.error);
    frames = result.frames;
  }));
  return frames;
}

describe("Official bowling scoring and safe entry", () => {
  test("gutter then ten is a spare, including tenth-frame bonus rack", () => {
    const f = play([...Array.from({ length: 9 }, () => [0, 10]), [10, 0, 10]]);
    expect(f[0].throws[1].value).toBe("/");
    expect(f[9].throws[2].value).toBe("/");
    expect(f[9].cumulativeScore).toBe(120);
    expect(calculateBowlingStats(f).strikes).toBe(1);
    expect(calculateBowlingStats(f).spares).toBe(10);
  });
  test("perfect game is 300", () => {
    const f = play([...Array.from({ length: 9 }, () => [10]), [10, 10, 10]]);
    expect(f[9].cumulativeScore).toBe(300);
    expect(isGameComplete(f)).toBe(true);
  });
  test("ten open frames 9 then gutter total 90", () => {
    const f = play(Array.from({ length: 10 }, () => [9, 0]));
    expect(f[9].cumulativeScore).toBe(90);
    expect(f[0].throws[1].value).toBe("0");
  });
  test("ten 5/ spares plus bonus 5 total 150", () => {
    const f = play([...Array.from({ length: 9 }, () => [5, 5]), [5, 5, 5]]);
    expect(f[9].cumulativeScore).toBe(150);
  });
  test("strike waits for two ordinary throws and scores 17", () => {
    let f = play([[10], [3]]);
    expect(f[0].score).toBeNull();
    f = changeThrow(f, 1, 1, "4").frames;
    expect(f[0].score).toBe(17);
    expect(f[1].cumulativeScore).toBe(24);
  });
  test("spare followed by strike resolves to 20", () => {
    const f = play([[6, 4], [10]]);
    expect(f[0].score).toBe(20);
    expect(f[1].score).toBeNull();
  });
  test("tenth strike resets pins then restricts final bonus", () => {
    let f = play([...Array.from({ length: 9 }, () => [0, 0]), [10, 7]]);
    expect(f[9].score).toBeNull();
    expect(remainingPins(f[9], 9, 2)).toBe(3);
    expect(changeThrow(f, 9, 2, "4").error).toBeDefined();
    f = changeThrow(f, 9, 2, "3").frames;
    expect(f[9].throws[2].value).toBe("/");
    expect(f[9].cumulativeScore).toBe(20);
  });
  test("tenth spare gets one full-rack bonus; open gets none", () => {
    const spare = play([...Array.from({ length: 9 }, () => [0, 0]), [7, 3, 10]]);
    expect(spare[9].cumulativeScore).toBe(20);
    const open = play([...Array.from({ length: 9 }, () => [0, 0]), [7, 2]]);
    expect(remainingPins(open[9], 9, 2)).toBeNull();
    expect(open[9].cumulativeScore).toBe(9);
  });
  test("correction preserves following frames and recalculates bonus", () => {
    const f = play([[10], [3, 4], [9, 0]]);
    const next = changeThrow(f, 1, 0, "5");
    expect(next.incompatible).toBe(false);
    expect(next.frames[0].score).toBe(19);
    expect(next.frames[2].throws).toEqual(f[2].throws);
    expect(next.frames[2].cumulativeScore).toBe(37);
  });
  test("only incompatible correction is flagged, not compatible symbol change", () => {
    const f = play([[3, 4], [9, 0]]);
    expect(changeThrow(f, 0, 0, "6").incompatible).toBe(false);
    expect(changeThrow(f, 0, 0, "6").frames[0].throws[1].value).toBe("/");
    const invalid = changeThrow(f, 0, 0, "10");
    expect(invalid.incompatible).toBe(true);
    expect(invalid.frames[1].throws).toEqual(f[1].throws);
  });
  test("multiple finished games exclude unfinished game from average", () => {
    const b = newGamesBlock();
    b.parties = [90, 150].map((score, i) => ({ id: String(i), stats: quickScoreStats(score), frames: null, ball_id: null }));
    const f = play([[10]]);
    b.parties.push({ id: "unfinished", stats: calculateBowlingStats(f), frames: f, ball_id: null });
    const a = aggregateGamesStats(b);
    expect(a?.count).toBe(2);
    expect(a?.avgScore).toBe(120);
    expect(a?.totalScore).toBe(240);
    expect(a?.bestScore).toBe(150);
  });
  test("JSON persistence reopens incomplete game without inventing throws", () => {
    const f = play([[10], [4]]);
    const reopened = scoreFrames(JSON.parse(JSON.stringify(f)));
    expect(isGameComplete(reopened)).toBe(false);
    expect(reopened[1].throws.length).toBe(1);
    expect(reopened[0].score).toBeNull();
    expect(reopened[9].cumulativeScore).toBeNull();
  });
  test("missing optional pocket data is not failed; explicit no is denominator", () => {
    const f = play([[10], [9, 1]]);
    expect(calculateBowlingStats(f).pocketOpportunities).toBe(0);
    f[0].throws[0].observed = ["isPocket"];
    f[0].throws[0].isPocket = true;
    expect(calculateBowlingStats(f).pocketPercentage).toBe(100);
    f[1].throws[0].observed = ["isPocket"];
    expect(calculateBowlingStats(f).pocketPercentage).toBe(50);
  });
});