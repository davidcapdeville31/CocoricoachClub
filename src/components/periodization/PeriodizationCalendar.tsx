import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PeriodizationCalendarProps {
  categoryId: string;
}

export function PeriodizationCalendar({ categoryId }: PeriodizationCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: events, isLoading } = useQuery({
    queryKey: ["periodization-calendar", categoryId, currentDate],
    queryFn: async () => {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);

      const [periodsRes, cyclesRes, sessionsRes] = await Promise.all([
        supabase
          .from("training_periods")
          .select("*")
          .eq("category_id", categoryId)
          .or(`start_date.lte.${format(monthEnd, "yyyy-MM-dd")},end_date.gte.${format(monthStart, "yyyy-MM-dd")}`),
        supabase
          .from("training_cycles")
          .select("*")
          .eq("category_id", categoryId)
          .or(`start_date.lte.${format(monthEnd, "yyyy-MM-dd")},end_date.gte.${format(monthStart, "yyyy-MM-dd")}`),
        supabase
          .from("training_sessions")
          .select("*")
          .eq("category_id", categoryId)
          .gte("session_date", format(monthStart, "yyyy-MM-dd"))
          .lte("session_date", format(monthEnd, "yyyy-MM-dd")),
      ]);

      return {
        periods: periodsRes.data || [],
        cycles: cyclesRes.data || [],
        sessions: sessionsRes.data || [],
      };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const result: { type: string; label: string; color: string }[] = [];

    events?.periods.forEach((period) => {
      if (
        isWithinInterval(day, {
          start: new Date(period.start_date),
          end: new Date(period.end_date),
        })
      ) {
        result.push({
          type: "period",
          label: period.name,
          color: period.period_type === "préparation" ? "bg-blue-500" : period.period_type === "compétition" ? "bg-red-500" : period.period_type === "récupération" ? "bg-green-500" : "bg-gray-500",
        });
      }
    });

    events?.sessions.forEach((session) => {
      if (session.session_date === dayStr) {
        result.push({
          type: "session",
          label: session.training_type,
          color: "bg-purple-500",
        });
      }
    });

    return result;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {format(currentDate, "MMMM yyyy", { locale: fr })}
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Aujourd'hui
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
          <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
            {day}
          </div>
        ))}

        {days.map((day) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);

          return (
            <div
              key={day.toString()}
              className={`min-h-24 border rounded-lg p-2 ${
                isCurrentMonth ? "bg-card" : "bg-muted/30"
              }`}
            >
              <div className="text-sm font-medium mb-1">{format(day, "d")}</div>
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map((event, idx) => (
                  <div
                    key={idx}
                    className={`text-xs px-1 py-0.5 rounded ${event.color} text-white truncate`}
                    title={event.label}
                  >
                    {event.label}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-xs text-muted-foreground">
                    +{dayEvents.length - 2}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded" />
          <span className="text-sm">Préparation</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded" />
          <span className="text-sm">Compétition</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded" />
          <span className="text-sm">Récupération</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-purple-500 rounded" />
          <span className="text-sm">Séance</span>
        </div>
      </div>
    </div>
  );
}
