import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { confirmCircuitRound, copyPreviousCircuitRound, type CircuitLog } from "@/lib/weight/circuitLog";
export { buildCircuitLog, aggregateCircuit, encodeCircuitTag, stripCircuitTag } from "@/lib/weight/circuitLog";
export type { CircuitCell, CircuitLog } from "@/lib/weight/circuitLog";

export function CircuitRoundStepper({ value, onChange }: { value: CircuitLog; onChange: (v: CircuitLog) => void }) {
  const [idx, setIdx] = useState(0);
  const roundDone = (i: number) => value.confirmedRounds?.includes(i) === true;
  const total = value.rounds.length;
  const round = value.rounds[idx] || [];

  const setCell = (ex: number, patch: Partial<CircuitCell>) => {
    const rounds = value.rounds.map((r, i) => (i === idx ? r.map((c, j) => (j === ex ? { ...c, ...patch } : c)) : r));
    onChange({ ...value, rounds, confirmedRounds: (value.confirmedRounds || []).filter((i) => i !== idx) });
  };

  const copyPrevious = () => onChange(copyPreviousCircuitRound(value, idx));
  const confirmRound = () => {
    const confirmed = confirmCircuitRound(value, idx);
    if (!confirmed) { toast.error("Renseigne les répétitions de chaque exercice. La charge peut rester vide."); return; }
    onChange(confirmed);
    if (idx < total - 1) setIdx(idx + 1);
  };
  const done = value.rounds.filter((_, i) => roundDone(i)).length;

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex justify-between text-xs text-muted-foreground"><span>Tours confirmés</span><span>{done} / {total}</span></div>
      <Progress value={total ? done / total * 100 : 0} className="h-1" />
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Tours du circuit">
        {value.rounds.map((r, i) => (
          <Button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === idx}
            aria-label={`Tour ${i + 1}${roundDone(i) ? " confirmé" : ""}`}
            onClick={() => setIdx(i)}
            className={cn(
              "h-11 min-w-11 px-2 rounded-full text-xs font-semibold border transition-colors motion-reduce:transition-none",
              i === idx
                ? "bg-primary text-primary-foreground border-primary"
                : roundDone(i)
                  ? "bg-status-optimal/15 text-status-optimal border-status-optimal/40"
                  : "bg-background text-muted-foreground border-border",
            )}
          >
            {roundDone(i) && i !== idx ? <Check className="h-3.5 w-3.5 mx-auto" /> : i + 1}
          </Button>
        ))}
      </div>

      <div key={idx} className="min-w-0 border-t border-border py-3 space-y-3 animate-in fade-in-0 slide-in-from-right-2 duration-200 motion-reduce:animate-none">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold whitespace-nowrap">Tour {idx + 1} / {total}</p>
          {idx > 0 && (
            <Button type="button" variant="ghost" size="sm" className="h-10 px-2 text-xs" onClick={copyPrevious} aria-label="Reprendre les valeurs du tour précédent">
              <Copy className="h-3.5 w-3.5 mr-1" /> Reprendre tour {idx}
            </Button>
          )}
        </div>
        {value.exercises.map((ex, j) => (
          <div key={j} className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_6rem]">
            <p className="col-span-2 min-w-0 self-center text-sm font-medium leading-tight break-words sm:col-span-1">
              {ex.name}
              {ex.reps && <span className="ml-1.5 text-xs font-normal text-muted-foreground">· prévu {ex.reps}</span>}
            </p>
            <div className="contents">
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

      <Button type="button" className="h-auto min-h-11 w-full whitespace-normal" onClick={confirmRound}>
        <Check className="mr-2 h-4 w-4 shrink-0" />{idx < total - 1 ? "Valider le tour et continuer" : "Valider le dernier tour"}
      </Button>
      <div className="grid grid-cols-2 gap-2">
        {idx > 0 ? (
          <Button type="button" variant="outline" className="h-11" onClick={() => setIdx(idx - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
          </Button>
        ) : <span />}
        {idx < total - 1 ? (
          <Button type="button" variant="outline" className="h-11" onClick={() => setIdx(idx + 1)}>
            Tour suivant <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <p className="self-center text-center text-xs text-muted-foreground">Dernier tour</p>
        )}
      </div>
    </div>
  );
}
