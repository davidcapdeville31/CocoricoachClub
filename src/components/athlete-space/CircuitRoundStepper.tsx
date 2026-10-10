import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type CircuitCell = { weight: string; reps: string };
export type CircuitLog = {
  exercises: Array<{ name: string; reps: string }>;
  rounds: CircuitCell[][]; // rounds[roundIdx][exerciseIdx]
};

const CIRCUIT_TAG_RE = /<!--circuit-log:([\s\S]*?)-->/;

export function encodeCircuitTag(c: CircuitLog): string {
  return `<!--circuit-log:${JSON.stringify({ e: c.exercises.map((x) => x.name), r: c.rounds })}-->`;
}
export function stripCircuitTag(notes: string | null): string {
  return (notes || "").replace(CIRCUIT_TAG_RE, "").trim();
}

/** Build an empty circuit log from a V2 circuit config, or null if the config has no named exercises. */
export function buildCircuitLog(config: any, fallbackRounds: number): CircuitLog | null {
  const series: any[] = Array.isArray(config?.series) ? config.series.filter((s: any) => s?.isActive !== false) : [];
  const exercises = series
    .map((s) => ({ name: String(s.exerciseName || s.phaseExerciseName || "").trim(), reps: s.reps ? String(s.reps) : "" }))
    .filter((e) => e.name);
  if (exercises.length < 2) return null;
  const n = Number(config?.repsPerRound) > 0 ? Number(config.repsPerRound) : fallbackRounds;
  const rounds = Array.from({ length: Math.max(1, n) }, () => exercises.map((e) => ({ weight: "", reps: e.reps })));
  return { exercises, rounds };
}

/** Aggregates per-cell values (tonnage stays Σ weight × reps). */
export function aggregateCircuit(c: CircuitLog) {
  let tonnage = 0, reps = 0;
  c.rounds.forEach((r) => r.forEach((cell) => {
    const rp = parseInt(cell.reps) || 0;
    const w = parseFloat(cell.weight) || 0;
    reps += rp;
    tonnage += w * rp;
  }));
  return { tonnage, reps };
}

const roundDone = (r: CircuitCell[]) => r.every((c) => (parseInt(c.reps) || 0) > 0);

export function CircuitRoundStepper({ value, onChange }: { value: CircuitLog; onChange: (v: CircuitLog) => void }) {
  const [idx, setIdx] = useState(0);
  const total = value.rounds.length;
  const round = value.rounds[idx] || [];

  const setCell = (ex: number, patch: Partial<CircuitCell>) => {
    const rounds = value.rounds.map((r, i) => (i === idx ? r.map((c, j) => (j === ex ? { ...c, ...patch } : c)) : r));
    onChange({ ...value, rounds });
  };

  // Volontaire : ne remplit que les champs vides du tour courant.
  const copyPrevious = () => {
    const prev = value.rounds[idx - 1];
    if (!prev) return;
    const rounds = value.rounds.map((r, i) =>
      i === idx ? r.map((c, j) => ({ weight: c.weight || prev[j]?.weight || "", reps: c.reps || prev[j]?.reps || "" })) : r,
    );
    onChange({ ...value, rounds });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Tours du circuit">
        {value.rounds.map((r, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === idx}
            aria-label={`Tour ${i + 1}`}
            onClick={() => setIdx(i)}
            className={cn(
              "h-8 min-w-8 px-2 rounded-full text-xs font-semibold border transition-colors motion-reduce:transition-none",
              i === idx
                ? "bg-primary text-primary-foreground border-primary"
                : roundDone(r)
                  ? "bg-status-optimal/15 text-status-optimal border-status-optimal/40"
                  : "bg-background text-muted-foreground border-border",
            )}
          >
            {roundDone(r) && i !== idx ? <Check className="h-3.5 w-3.5 mx-auto" /> : i + 1}
          </button>
        ))}
      </div>

      <div key={idx} className="rounded-xl border bg-surface-sunken/40 p-3 space-y-3 animate-in fade-in-0 slide-in-from-right-2 duration-200 motion-reduce:animate-none">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Tour {idx + 1} / {total}</p>
          {idx > 0 && (
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={copyPrevious}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Reprendre le tour précédent
            </Button>
          )}
        </div>
        {value.exercises.map((ex, j) => (
          <div key={j} className="space-y-1.5">
            <p className="text-sm font-medium leading-tight break-words">
              {ex.name}
              {ex.reps && <span className="ml-1.5 text-xs font-normal text-muted-foreground">· prévu {ex.reps}</span>}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="min-w-0">
                <span className="sr-only">Charge {ex.name}</span>
                <div className="relative">
                  <Input type="number" inputMode="decimal" step="0.5" min={0} placeholder="Charge"
                    className="h-11 w-full pr-9 text-base"
                    value={round[j]?.weight ?? ""} onChange={(e) => setCell(j, { weight: e.target.value })} />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
                </div>
              </label>
              <label className="min-w-0">
                <span className="sr-only">Répétitions {ex.name}</span>
                <div className="relative">
                  <Input type="number" inputMode="numeric" min={0} placeholder="Reps"
                    className="h-11 w-full pr-12 text-base"
                    value={round[j]?.reps ?? ""} onChange={(e) => setCell(j, { reps: e.target.value })} />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">reps</span>
                </div>
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {idx > 0 ? (
          <Button type="button" variant="outline" className="h-11" onClick={() => setIdx(idx - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
          </Button>
        ) : <span />}
        {idx < total - 1 ? (
          <Button type="button" className="h-11" onClick={() => setIdx(idx + 1)}>
            Tour suivant <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <p className="self-center text-center text-xs text-muted-foreground">Dernier tour</p>
        )}
      </div>
    </div>
  );
}
