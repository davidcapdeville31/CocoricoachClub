import { Check, Circle, Minus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleObservation } from "@/lib/bowling/observationControls";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: boolean | undefined;
  readOnly: boolean;
  onChange: (value: boolean | undefined) => void;
}

export function BowlingObservationButton({ label, value, readOnly, onChange }: Props) {
  const Icon = value === true ? Check : value === false ? Minus : Circle;
  const state = value === undefined ? "Non saisi" : value ? "Oui" : "Non";
  return <div className="flex min-w-0 items-stretch gap-1">
    <Button variant="outline" aria-label={`${label} : ${state}`} aria-pressed={value === true}
      className={cn("h-12 min-w-0 flex-1 gap-2 rounded-lg bg-card px-2", value === true && "border-selection bg-selection text-selection-foreground font-semibold")}
      onClick={() => { if (!readOnly) onChange(toggleObservation(value)); }}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex min-w-0 flex-col items-start text-xs leading-tight"><span className="font-semibold">{label}</span><span>{state}</span></span>
    </Button>
    {value !== undefined && !readOnly && <Button variant="ghost" size="icon" className="h-12 w-11 shrink-0" aria-label={`Effacer ${label} · Non saisi`} title={`Effacer ${label} · Non saisi`} onClick={() => onChange(undefined)}><RotateCcw className="h-3.5 w-3.5" /></Button>}
  </div>;
}