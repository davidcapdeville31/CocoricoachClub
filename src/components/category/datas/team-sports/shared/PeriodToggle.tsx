import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AnalyticsPeriod } from "@/lib/analytics/team-sports/types";

interface Props {
  value: AnalyticsPeriod;
  onChange: (v: AnalyticsPeriod) => void;
}

const OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "all", label: "Match" },
  { value: "H1", label: "1ère MT" },
  { value: "H2", label: "2ème MT" },
];

export function PeriodToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-sunken border text-xs">
      {OPTIONS.map((o) => (
        <Button
          key={o.value}
          variant="ghost"
          size="sm"
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 px-3 rounded-md text-xs font-medium",
            value === o.value ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}
