export type CircuitCell = { weight: string; reps: string };
export type CircuitLog = {
  exercises: Array<{ name: string; reps: string }>;
  rounds: CircuitCell[][];
  confirmedRounds?: number[];
};
const CIRCUIT_TAG_RE = /<!--circuit-log:([\s\S]*?)-->/;
export function encodeCircuitTag(c: CircuitLog): string {
  return `<!--circuit-log:${JSON.stringify({ e: c.exercises.map((x) => x.name), r: c.rounds, confirmed: c.confirmedRounds || [] })}-->`;
}
export function stripCircuitTag(notes: string | null): string {
  return (notes || "").replace(CIRCUIT_TAG_RE, "").trim();
}
export function parseCircuitTag(notes: string | null): CircuitLog | null {
  const match = notes?.match(CIRCUIT_TAG_RE);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]);
    if (!Array.isArray(data.e) || !data.e.every((name: unknown) => typeof name === "string") || !Array.isArray(data.r)) return null;
    if (!data.r.every((row: unknown) => Array.isArray(row) && row.length === data.e.length && row.every((cell) => cell && typeof cell.weight === "string" && typeof cell.reps === "string"))) return null;
    return { exercises: data.e.map((name: string) => ({ name, reps: "" })), rounds: data.r,
      confirmedRounds: Array.isArray(data.confirmed) ? data.confirmed.filter((i: number) => Number.isInteger(i) && i >= 0 && i < data.r.length) : [] };
  } catch { return null; }
}
export function buildCircuitLog(config: any, fallbackRounds: number): CircuitLog | null {
  const series: any[] = Array.isArray(config?.series) ? config.series.filter((s: any) => s?.isActive !== false) : [];
  const exercises = series.map((s) => ({ name: String(s.exerciseName || s.phaseExerciseName || "").trim(), reps: s.reps ? String(s.reps) : "" })).filter((e) => e.name);
  if (exercises.length < 2) return null;
  const n = Number(config?.repsPerRound) > 0 ? Number(config.repsPerRound) : fallbackRounds;
  return { exercises, rounds: Array.from({ length: Math.max(1, n) }, () => exercises.map((e) => ({ weight: "", reps: e.reps }))), confirmedRounds: [] };
}
/** Existing tonnage convention remains unchanged, including bodyweight entries. */
export function aggregateCircuit(c: CircuitLog) {
  let tonnage = 0, reps = 0;
  c.rounds.forEach((r) => r.forEach((cell) => {
    const rp = parseInt(cell.reps) || 0;
    const w = parseFloat(cell.weight) || 0;
    reps += rp; tonnage += w * rp;
  }));
  return { tonnage, reps };
}
export function confirmCircuitRound(c: CircuitLog, index: number): CircuitLog | null {
  const row = c.rounds[index];
  if (!row?.length || !row.every((cell) => cell.reps.trim() !== "" && Number.isInteger(Number(cell.reps)) && Number(cell.reps) > 0 && (cell.weight.trim() === "" || (Number.isFinite(Number(cell.weight)) && Number(cell.weight) >= 0)))) return null;
  return { ...c, confirmedRounds: [...new Set([...(c.confirmedRounds || []), index])] };
}
export function copyPreviousCircuitRound(c: CircuitLog, index: number): CircuitLog {
  const previous = c.rounds[index - 1];
  if (!previous) return c;
  return { ...c, confirmedRounds: (c.confirmedRounds || []).filter((i) => i !== index), rounds: c.rounds.map((row, i) => i === index ? row.map((cell, j) => ({ weight: cell.weight || previous[j]?.weight || "", reps: cell.reps || previous[j]?.reps || "" })) : row) };
}