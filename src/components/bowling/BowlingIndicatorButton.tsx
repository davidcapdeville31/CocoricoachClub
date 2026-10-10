import { Check, Circle, Minus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { nextIndicatorValue, type IndicatorType, type IndicatorValue } from "@/lib/bowling/indicatorState";

// One semantic mapping, independent of focus, hover or selection.
const appearances = {
  pocket: { label: "Poche", yes: "border-observation-pocket bg-observation-pocket text-observation-on-foreground", Icon: Check },
  split: { label: "Split", yes: "border-observation-split bg-observation-split text-observation-on-foreground", Icon: TriangleAlert },
};
const neutral = {
  no: "border-border bg-observation-no text-observation-no-foreground",
  unset: "border-dashed border-border bg-card text-card-foreground",
};
interface Props {
  type: IndicatorType;
  value: IndicatorValue;
  readOnly: boolean;
  onChange: (value: IndicatorValue) => void;
}
export function BowlingIndicatorButton({ type, value, readOnly, onChange }: Props) {
  const config = appearances[type];
  const Icon = value === null ? Circle : value ? config.Icon : Minus;
  const label = value === null ? "Non renseigné" : value ? "Oui" : "Non";
  return <Button type="button" variant="observation" data-observation="" data-value={value === null ? "unset" : value ? "yes" : "no"}
    aria-label={`${config.label} : ${label}`} aria-readonly={readOnly}
    className={cn("h-12 w-full min-w-0 gap-2 rounded-lg px-2 font-semibold touch-manipulation", value === null ? neutral.unset : value ? config.yes : neutral.no)}
    onClick={() => { if (!readOnly) onChange(nextIndicatorValue(value)); }}>
    <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
    <span className="flex min-w-0 flex-col items-start text-xs leading-tight"><span>{config.label}</span><span>{value === null ? "—" : label}</span></span>
  </Button>;
}
