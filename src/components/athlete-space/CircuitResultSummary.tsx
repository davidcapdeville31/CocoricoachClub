import { useState } from "react";
import { Button } from "@/components/ui/button";
import { parseCircuitTag } from "@/lib/weight/circuitLog";

export function CircuitResultSummary({ notes }: { notes: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const circuit = parseCircuitTag(notes);
  if (!circuit) return null;
  return <div className="space-y-2 text-xs">
    <Button variant="ghost" type="button" size="sm" className="h-10 w-full justify-start whitespace-normal text-left" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
      {circuit.exercises.length} exercices · {circuit.rounds.length} tours · {circuit.confirmedRounds?.length || 0} confirmés {expanded ? "−" : "+"}
    </Button>
    {expanded && circuit.rounds.map((round, i) => <div key={i} className="border-t border-border pt-2"><p className="mb-1 font-semibold">Tour {i + 1}{circuit.confirmedRounds?.includes(i) ? " · Confirmé" : ""}</p>{round.map((cell, j) => <div key={j} className="flex justify-between gap-2 py-1"><span className="min-w-0 break-words">{circuit.exercises[j]?.name}</span><span className="shrink-0">{cell.weight === "" ? "—" : `${cell.weight} kg`} · {cell.reps || "—"} reps</span></div>)}</div>)}
  </div>;
}