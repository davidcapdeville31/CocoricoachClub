import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  accent?: "default" | "primary" | "success" | "danger" | "warning";
}

const ACCENT: Record<NonNullable<Props["accent"]>, string> = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-emerald-500",
  danger: "text-red-500",
  warning: "text-amber-500",
};

export function KpiCard({ label, value, sub, icon, accent = "default" }: Props) {
  return (
    <Card className="rounded-2xl border bg-surface">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        </div>
        <div className={cn("text-3xl font-bold leading-none", ACCENT[accent])}>{value}</div>
        {sub ? <div className="text-xs text-muted-foreground mt-1">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}
