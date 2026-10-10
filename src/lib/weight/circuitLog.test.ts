import { describe, expect, test } from "bun:test";
import { aggregateCircuit, buildCircuitLog, confirmCircuitRound, copyPreviousCircuitRound, encodeCircuitTag, parseCircuitTag, type CircuitLog } from "./circuitLog";

const sample = (): CircuitLog => ({ exercises: [{ name: "Squat", reps: "10" }, { name: "Pompes", reps: "8" }], rounds: [[{ weight: "20", reps: "10" }, { weight: "", reps: "8" }], [{ weight: "25", reps: "" }, { weight: "", reps: "8" }]], confirmedRounds: [] });
describe("Circuit confirmation and compatible persistence", () => {
  test("six prefilled tours are not confirmed", () => {
    const c = buildCircuitLog({ repsPerRound: 6, series: [{ exerciseName: "Squat", reps: 10 }, { exerciseName: "Pompes", reps: 8 }] }, 1);
    expect(c?.rounds.length).toBe(6);
    expect(c?.confirmedRounds).toEqual([]);
  });
  test("bodyweight blank stays blank after explicit confirmation", () => {
    const c = confirmCircuitRound(sample(), 0);
    expect(c?.confirmedRounds).toEqual([0]);
    expect(c?.rounds[0][1].weight).toBe("");
  });
  test("copy fills only blank cells and keeps current weight 25 and reps 8", () => {
    const c = copyPreviousCircuitRound(sample(), 1);
    expect(c.rounds[1]).toEqual([{ weight: "25", reps: "10" }, { weight: "", reps: "8" }]);
    expect(c.confirmedRounds).toEqual([]);
  });
  test("incomplete tour cannot be confirmed", () => { expect(confirmCircuitRound(sample(), 1)).toBeNull(); });
  test("confirmation persists without changing tonnage", () => {
    const c = confirmCircuitRound(sample(), 0);
    if (!c) throw new Error("Confirmation failed");
    const read = parseCircuitTag(encodeCircuitTag(c));
    expect(read?.confirmedRounds).toEqual([0]);
    expect(read && aggregateCircuit(read)).toEqual({ tonnage: 400, reps: 26 });
  });
  test("legacy tag remains readable but not falsely confirmed", () => {
    const read = parseCircuitTag('<!--circuit-log:{"e":["Squat"],"r":[[{"weight":"20","reps":"10"}]]}-->');
    expect(read?.confirmedRounds).toEqual([]);
    expect(read && aggregateCircuit(read).tonnage).toBe(200);
  });
});