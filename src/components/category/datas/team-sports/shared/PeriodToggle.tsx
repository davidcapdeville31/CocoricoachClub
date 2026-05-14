import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AnalyticsPeriod } from "@/lib/analytics/team-sports/types";

interface Props {
  value: AnalyticsPeriod;
  onChange: (v: AnalyticsPeriod) => void;
}

const OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "all", label: "Match complet" },
  { value: "H1", label: "1ère MT" },
  { value: "H2", label: "2ème MT" },
];

export function PeriodToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-surface-sunken border">
      {OPTIONS.map((o) => (
        <Button
          key={o.value}
          variant={value === o.value ? "default" : "ghost"}
          size="sm"
          onClick={() => onChange(o.value)}
          className={cn("rounded-xl", value === o.value && "shadow")}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}
