import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarRange, Activity } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { useTranslation } from "react-i18next";

interface Props {
  categoryId: string;
}

const CYCLE_TYPE_META: Record<string, { short: string; className: string; icon: string }> = {
  PG: { short: "PG", className: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30", icon: "🏗️" },
  PS: { short: "PS", className: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30", icon: "🎯" },
  PC: { short: "PC", className: "bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30", icon: "⚡" },
};

export function CurrentCyclesCard({ categoryId }: Props) {
  const { t } = useTranslation();
  const today = new Date().toISOString().split("T")[0];

  const { data: cycles = [], isLoading } = useQuery({
    queryKey: ["athlete-current-cycles", categoryId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("periodization_cycles")
        .select("id, name, color, cycle_type, intensity, start_date, end_date, objective, periodization_category_id, periodization_categories(name, color)")
        .eq("category_id", categoryId)
        .lte("start_date", today)
        .gte("end_date", today)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!categoryId,
  });

  if (isLoading || cycles.length === 0) return null;

  return (
    <Card className="shadow-sm border-2 rounded-2xl" style={{ borderColor: "hsl(var(--brand-500) / 0.25)" }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-primary" />
          {t("athleteSpace:components.currentCyclesCard.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {cycles.map((c: any) => {
          const meta = c.cycle_type ? CYCLE_TYPE_META[c.cycle_type as keyof typeof CYCLE_TYPE_META] : null;
          const thematic = c.periodization_categories;
          const totalDays = differenceInCalendarDays(new Date(c.end_date), new Date(c.start_date)) + 1;
          const elapsed = differenceInCalendarDays(new Date(), new Date(c.start_date)) + 1;
          const progress = Math.max(0, Math.min(100, Math.round((elapsed / totalDays) * 100)));
          const daysLeft = Math.max(0, differenceInCalendarDays(new Date(c.end_date), new Date()));

          return (
            <div
              key={c.id}
              className="rounded-xl border bg-surface-sunken/60 p-3 space-y-2"
              style={{ borderColor: `${c.color || thematic?.color || "#64748b"}50` }}
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: thematic?.color || c.color || "#64748b" }}
                  />
                  <span className="text-xs text-muted-foreground truncate">
                    {thematic?.name || t("athleteSpace:components.currentCyclesCard.activity")}
                  </span>
                </div>
                {meta && (
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${meta.className}`}>
                    <span className="mr-1">{meta.icon}</span>
                    {meta.short}
                  </Badge>
                )}
              </div>

              <div className="text-sm font-semibold leading-tight">{c.name}</div>

              {c.objective && (
                <div className="text-[11px] text-muted-foreground line-clamp-2">{c.objective}</div>
              )}

              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>
                  {format(new Date(c.start_date), "d MMM", { locale: getDateLocale() })} →{" "}
                  {format(new Date(c.end_date), "d MMM yyyy", { locale: getDateLocale() })}
                </span>
                <span className="font-medium">
                  {daysLeft > 0
                    ? t("athleteSpace:components.currentCyclesCard.daysLeft", { count: daysLeft, plural: daysLeft > 1 ? "s" : "" })
                    : t("athleteSpace:components.currentCyclesCard.lastDay")}
                </span>
              </div>

              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: thematic?.color || c.color || "hsl(var(--primary))",
                  }}
                />
              </div>

              {typeof c.intensity === "number" && c.intensity > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Activity className="h-3 w-3" />
                  <span>{t("athleteSpace:components.currentCyclesCard.intensity")}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-1.5 rounded-full ${
                          i <= Math.round((c.intensity / 10) * 5)
                            ? "bg-primary"
                            : "bg-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
