import { Check, Circle, Minus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleObservation } from "@/lib/bowling/observationControls";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: boolean | undefined;
  readOnly: boolean;
  /** "positive": Oui is good (green), e.g. Poche. "negative": Oui is a warning (red), e.g. Split. "Non" and "Non renseigné" are always neutral — color is never used for a negative answer. */
  tone?: "positive" | "negative";
  clearable?: boolean;
  onChange: (value: boolean | undefined) => void;
}

export function BowlingObservationButton({ label, value, readOnly, tone, clearable = true, onChange }: Props) {
  const Icon = value === true ? Check : value === false ? Minus : Circle;
  const state = value === undefined ? "Non renseigné" : value ? "Oui" : "Non";
  return <div className="flex min-w-0 items-stretch gap-1">
    <Button variant="outline" data-observation="" data-tone={tone} data-state={value === undefined ? "unset" : value ? "yes" : "no"} aria-label={`${label} : ${state}`} aria-pressed={value === true}
      className={cn("h-12 min-w-0 flex-1 gap-2 rounded-lg bg-card px-2 font-semibold",
        tone === undefined && value === true && "border-selection bg-selection text-selection-foreground",
        value === true && tone === "positive" && "border-success bg-success text-success-foreground",
        value === true && tone === "negative" && "border-destructive bg-destructive text-destructive-foreground",
        value === false && "border-border bg-muted text-foreground")}
      onClick={() => { if (!readOnly) onChange(toggleObservation(value)); }}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex min-w-0 flex-col items-start text-xs leading-tight"><span>{label}</span><span aria-hidden={value === undefined}>{value === undefined ? "—" : state}</span></span>
    </Button>
    {clearable && value !== undefined && !readOnly && <Button variant="ghost" size="icon" className="h-12 w-11 shrink-0" aria-label={`Effacer ${label} · Non renseigné`} title={`Effacer ${label} · Non renseigné`} onClick={() => onChange(undefined)}><RotateCcw className="h-3.5 w-3.5" /></Button>}
  </div>;
}
