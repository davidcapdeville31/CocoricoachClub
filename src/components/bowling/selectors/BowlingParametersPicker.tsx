import { cn } from "@/lib/utils";
import {
  TECHNICAL_PARAMETERS,
  TECH_PARAM_GROUP_LABELS,
  type TechParamGroup,
} from "@/lib/constants/bowlingTechnicalParameters";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
}

export function BowlingParametersPicker({ value, onChange }: Props) {
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const groups = Array.from(new Set(TECHNICAL_PARAMETERS.map((p) => p.group))) as TechParamGroup[];

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            {TECH_PARAM_GROUP_LABELS[g]}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TECHNICAL_PARAMETERS.filter((p) => p.group === g).map((p) => {
              const on = value.includes(p.value);
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => toggle(p.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs border transition-all",
                    on
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background hover:bg-muted border-border text-foreground/80",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
