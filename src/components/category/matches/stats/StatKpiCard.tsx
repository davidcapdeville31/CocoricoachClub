import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  accent?: "brand" | "success" | "warning" | "danger" | "muted";
  className?: string;
}

const accentMap: Record<NonNullable<Props["accent"]>, string> = {
  brand: "from-brand-500/20 to-brand-500/5 text-brand-500 ring-brand-500/20",
  success: "from-emerald-500/20 to-emerald-500/5 text-emerald-500 ring-emerald-500/20",
  warning: "from-amber-500/20 to-amber-500/5 text-amber-500 ring-amber-500/20",
  danger: "from-rose-500/20 to-rose-500/5 text-rose-500 ring-rose-500/20",
  muted: "from-muted/60 to-muted/20 text-foreground ring-border",
};

export function StatKpiCard({ label, value, hint, icon: Icon, accent = "brand", className }: Props) {
  return (
    <div
      className={cn(
        "relative rounded-2xl bg-gradient-to-br p-3 ring-1 backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-lg",
        accentMap[accent],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        {Icon ? <Icon className="h-3.5 w-3.5 opacity-70" /> : null}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums leading-none text-foreground">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}
