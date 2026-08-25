import { getDateLocale, getLocaleTag } from "@/lib/i18n/dateLocale";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Heart, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { calculateEWMASeries, transformToDailyLoadData } from "@/lib/trainingLoadCalculations";
import { HrvEntryDialog } from "@/components/category/hrv/HrvEntryDialog";

interface PlayerAwcrTabProps {
  playerId: string;
  categoryId: string;
  readOnly?: boolean;
}

type PeriodPreset = "7" | "14" | "30" | "90" | "all" | "custom";

export function PlayerAwcrTab({ playerId, categoryId, readOnly = false }: PlayerAwcrTabProps) {
  const [isHrvDialogOpen, setIsHrvDialogOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodPreset>("7");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();

  const { data: awcrData } = useQuery({
    queryKey: ["awcr_tracking", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("awcr_tracking")
        .select("*")
        .eq("player_id", playerId)
        .order("session_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Calculate EWMA data for table (needs full history for accurate EWMA)
  const ewmaResults = awcrData && awcrData.length > 0
    ? calculateEWMASeries(transformToDailyLoadData(awcrData, []), "sRPE")
    : [];

  // Filter by period for display
  const filteredResults = useMemo(() => {
    if (ewmaResults.length === 0) return [];

    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (period === "all") {
      // no filter
    } else if (period === "custom") {
      startDate = customStart || null;
      endDate = customEnd || null;
    } else {
      const days = parseInt(period, 10);
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - (days - 1));
      startDate.setHours(0, 0, 0, 0);
    }

    return ewmaResults
      .filter((r) => {
        const d = new Date(r.date);
        if (startDate && d < startDate) return false;
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (d > end) return false;
        }
        return true;
      })
      .slice()
      .reverse(); // most recent first
  }, [ewmaResults, period, customStart, customEnd]);

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card shadow-md">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
            <div>
              <CardTitle>Historique EWMA</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Ratio EWMA = Charge Aiguë (7j) / Charge Chronique (28j) | Zone optimale: 0.85 - 1.30
              </p>
            </div>
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsHrvDialogOpen(true)}
                className="gap-2 self-start"
              >
                <Heart className="h-4 w-4 text-destructive" />
                HRV
              </Button>
            )}
          </div>

          {/* Period selector */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPreset)}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 derniers jours</SelectItem>
                <SelectItem value="14">14 derniers jours</SelectItem>
                <SelectItem value="30">30 derniers jours</SelectItem>
                <SelectItem value="90">90 derniers jours</SelectItem>
                <SelectItem value="all">Tout l'historique</SelectItem>
                <SelectItem value="custom">Période personnalisée</SelectItem>
              </SelectContent>
            </Select>

            {period === "custom" && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn("h-9 justify-start text-left font-normal", !customStart && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStart ? format(customStart, "dd/MM/yyyy", { locale: getDateLocale() }) : "Du..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customStart}
                      onSelect={setCustomStart}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>

                <span className="text-sm text-muted-foreground">au</span>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn("h-9 justify-start text-left font-normal", !customEnd && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEnd ? format(customEnd, "dd/MM/yyyy", { locale: getDateLocale() }) : "Au..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customEnd}
                      onSelect={setCustomEnd}
                      disabled={(d) => (customStart ? d < customStart : false)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredResults.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>RPE</TableHead>
                    <TableHead>Durée (min)</TableHead>
                    <TableHead>sRPE</TableHead>
                    <TableHead>EWMA Aiguë (7j)</TableHead>
                    <TableHead>EWMA Chronique (28j)</TableHead>
                    <TableHead>Ratio EWMA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.map((result) => {
                    const sourceData = awcrData?.find(d => d.session_date === result.date);
                    return (
                      <TableRow key={result.date}>
                        <TableCell>
                          {new Date(result.date).toLocaleDateString(getLocaleTag())}
                        </TableCell>
                        <TableCell>{sourceData?.rpe}/10</TableCell>
                        <TableCell>{sourceData?.duration_minutes}</TableCell>
                        <TableCell className="font-semibold">{sourceData?.training_load}</TableCell>
                        <TableCell>{result.acute.toFixed(1)}</TableCell>
                        <TableCell>{result.chronic.toFixed(1)}</TableCell>
                        <TableCell>
                          <span
                            className={`font-semibold ${
                              result.ratio < 0.85 || result.ratio > 1.3
                                ? "text-destructive"
                                : "text-primary"
                            }`}
                          >
                            {result.ratio.toFixed(2)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              {ewmaResults.length === 0 ? "Aucune donnée EWMA disponible" : "Aucune donnée sur cette période"}
            </p>
          )}
        </CardContent>
      </Card>

      <HrvEntryDialog
        open={isHrvDialogOpen}
        onOpenChange={setIsHrvDialogOpen}
        categoryId={categoryId}
        defaultPlayerId={playerId}
      />
    </div>
  );
}
