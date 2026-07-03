import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  accent?: "default" | "primary" | "success" | "danger" | "warning";
  compact?: boolean;
}

const ACCENT: Record<NonNullable<Props["accent"]>, string> = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-emerald-500",
  danger: "text-red-500",
  warning: "text-amber-500",
};

export function KpiCard({ label, value, sub, icon, accent = "default", compact = false }: Props) {
  return (
    <Card className="rounded-2xl border bg-surface">
      <CardContent className={cn(compact ? "p-3" : "p-4")}>
        <div className={cn("flex items-center justify-between", compact ? "mb-0.5" : "mb-1")}>
          <span className={cn("uppercase tracking-wide text-muted-foreground", compact ? "text-[11px] leading-tight" : "text-xs")}>{label}</span>
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        </div>
        <div className={cn("font-bold leading-none", compact ? "text-2xl" : "text-3xl", ACCENT[accent])}>{value}</div>
        {sub ? <div className={cn("text-muted-foreground", compact ? "text-[11px] mt-0.5" : "text-xs mt-1")}>{sub}</div> : null}
      </CardContent>
    </Card>
  );
}
