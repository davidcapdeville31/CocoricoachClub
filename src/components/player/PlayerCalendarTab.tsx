import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { isWithinInterval } from "date-fns";

interface PlayerCalendarTabProps {
  playerId: string;
  categoryId: string;
}

export function PlayerCalendarTab({ playerId, categoryId }: PlayerCalendarTabProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const { data: sessions } = useQuery({
    queryKey: ["training_sessions", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("*")
        .eq("category_id", categoryId)
        .order("session_date", { ascending: false })
        .order("session_start_time", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredSessions = sessions?.filter((session) => {
    if (!dateRange?.from) return true;
    const sessionDate = new Date(session.session_date);
    if (dateRange.to) {
      return isWithinInterval(sessionDate, { start: dateRange.from, end: dateRange.to });
    }
    return sessionDate.toDateString() === dateRange.from.toDateString();
  });

  const sessionDates = sessions?.map((session) => new Date(session.session_date)) || [];

  return (
    <Card className="bg-gradient-card shadow-md">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Calendrier des séances</CardTitle>
          {dateRange?.from && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDateRange(undefined)}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Réinitialiser
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="flex justify-center">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              modifiers={{
                session: sessionDates,
              }}
              modifiersStyles={{
                session: {
                  fontWeight: "bold",
                  textDecoration: "underline",
                },
              }}
              className="rounded-md border pointer-events-auto"
            />
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">
                {dateRange?.from
                  ? dateRange.to
                    ? `Séances du ${dateRange.from.toLocaleDateString("fr-FR")} au ${dateRange.to.toLocaleDateString("fr-FR")}`
                    : `Séances du ${dateRange.from.toLocaleDateString("fr-FR")}`
                  : "Toutes les séances"}
              </h3>
              {filteredSessions && filteredSessions.length > 0 ? (
                <div className="space-y-2">
                  {filteredSessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-3 border rounded-lg bg-card hover:bg-accent/10 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium capitalize">{session.training_type.replace(/_/g, " ")}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(session.session_date).toLocaleDateString("fr-FR", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </p>
                          {session.session_start_time && (
                            <p className="text-sm text-muted-foreground">
                              {session.session_start_time}
                              {session.session_end_time && ` - ${session.session_end_time}`}
                            </p>
                          )}
                        </div>
                        {session.intensity && (
                          <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                            Intensité: {session.intensity}/10
                          </span>
                        )}
                      </div>
                      {session.notes && (
                        <p className="text-sm mt-2 text-muted-foreground">{session.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Aucune séance pour cette période</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
