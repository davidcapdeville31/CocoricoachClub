import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TARGET_OUTCOMES, outcomeLabel } from "@/lib/constants/bowlingTargetOutcomes";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  /** Limite l'affichage à un sous-ensemble si besoin */
  allowed?: string[];
}

export function BowlingTargetOutcomesPicker({ value, onChange, allowed }: Props) {
  const opts = allowed
    ? TARGET_OUTCOMES.filter((o) => allowed.includes(o.value))
    : TARGET_OUTCOMES;
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {opts.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs border transition-all",
              on
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background hover:bg-muted border-border text-foreground/80",
            )}
          >
            {o.label}
          </button>
        );
      })}
      {value.length > 0 && (
        <Badge variant="outline" className="text-[10px] ml-auto">
          {value.length} objectif{value.length > 1 ? "s" : ""}
        </Badge>
      )}
    </div>
  );
}

export { outcomeLabel };
