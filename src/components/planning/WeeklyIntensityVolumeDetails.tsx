import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { differenceInCalendarDays, addDays, format } from "date-fns";

export interface WeeklyDetail {
  week: number;
  intensity: number;
  volume: number;
}

function getSliderColor(v: number) {
  if (v <= 2) return "#22c55e";
  if (v <= 4) return "#facc15";
  if (v <= 6) return "#f59e0b";
  if (v <= 8) return "#ef4444";
  return "#dc2626";
}

function MiniSlider({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const color = getSliderColor(value);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">{label}</Label>
        <span className="text-[10px] font-bold px-1.5 rounded" style={{ backgroundColor: `${color}20`, color }}>
          {value}/10
        </span>
      </div>
      <div className="relative flex items-center w-full h-5">
        <div className="absolute h-1.5 w-full rounded-full bg-secondary" />
        <div className="absolute h-1.5 rounded-full" style={{ width: `${(value / 10) * 100}%`, backgroundColor: color }} />
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute w-full h-5 opacity-0 cursor-pointer z-10"
        />
        <div
          className="absolute w-4 h-4 rounded-full border-2 bg-background shadow-sm pointer-events-none"
          style={{ left: `calc(${(value / 10) * 100}% - 8px)`, borderColor: color }}
        />
      </div>
    </div>
  );
}

interface Props {
  startDate?: Date;
  endDate?: Date;
  value: WeeklyDetail[];
  onChange: (details: WeeklyDetail[]) => void;
}

export function WeeklyIntensityVolumeDetails({ startDate, endDate, value, onChange }: Props) {
  const [expanded, setExpanded] = useState(value.length > 0);

  // Auto-expand when pre-filled data arrives (e.g. edit dialog)
  useEffect(() => {
    if (value.length > 0 && !expanded) setExpanded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.length > 0]);

  const weekCount = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const days = differenceInCalendarDays(endDate, startDate) + 1;
    return Math.max(1, Math.ceil(days / 7));
  }, [startDate, endDate]);

  // Sync array length when weekCount changes and details are already active
  useEffect(() => {
    if (!expanded) return;
    if (value.length === weekCount) return;
    const next: WeeklyDetail[] = [];
    for (let i = 0; i < weekCount; i++) {
      next.push(value[i] ?? { week: i + 1, intensity: 0, volume: 0 });
    }
    onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekCount, expanded]);

  const handleToggle = () => {
    if (!expanded) {
      if (!startDate || !endDate) return;
      if (value.length !== weekCount) {
        const init: WeeklyDetail[] = [];
        for (let i = 0; i < weekCount; i++) {
          init.push(value[i] ?? { week: i + 1, intensity: 0, volume: 0 });
        }
        onChange(init);
      }
      setExpanded(true);
    } else {
      setExpanded(false);
      onChange([]); // reset -> revert to cycle-level values
    }
  };

  const updateWeek = (idx: number, patch: Partial<WeeklyDetail>) => {
    const next = value.map((w, i) => (i === idx ? { ...w, ...patch } : w));
    onChange(next);
  };

  const canOpen = !!startDate && !!endDate;

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleToggle}
        disabled={!canOpen}
        className="w-full justify-between"
      >
        <span className="flex items-center gap-2">
          <Plus className="h-3.5 w-3.5" />
          {expanded ? "Masquer le détail par semaine" : "+ de détails (intensité/volume par semaine)"}
        </span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </Button>

      {!canOpen && (
        <p className="text-[11px] text-muted-foreground italic">
          Sélectionne les dates de début et de fin pour activer le détail hebdomadaire.
        </p>
      )}

      {expanded && canOpen && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2 max-h-96 overflow-y-auto">
          <p className="text-[11px] text-muted-foreground">
            L'intensité et le volume du cycle seront la moyenne des valeurs hebdomadaires ci-dessous.
          </p>
          {value.map((w, i) => {
            const wStart = startDate ? addDays(startDate, i * 7) : undefined;
            const wEnd = startDate ? addDays(startDate, Math.min(i * 7 + 6, differenceInCalendarDays(endDate!, startDate))) : undefined;
            return (
              <div
                key={i}
                className="grid grid-cols-[110px_1fr_1fr] gap-3 items-center rounded-md border bg-background p-2.5"
              >
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">Semaine {w.week}</span>
                  {wStart && wEnd && (
                    <span className="text-[10px] text-muted-foreground">
                      {format(wStart, "dd/MM", { locale: getDateLocale() })} → {format(wEnd, "dd/MM", { locale: getDateLocale() })}
                    </span>
                  )}
                </div>
                <MiniSlider label="Intensité" value={w.intensity} onChange={(v) => updateWeek(i, { intensity: v })} />
                <MiniSlider label="Volume" value={w.volume} onChange={(v) => updateWeek(i, { volume: v })} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function averageWeekly(details: WeeklyDetail[]): { intensity: number; volume: number } | null {
  if (!details || details.length === 0) return null;
  const sumI = details.reduce((s, d) => s + (d.intensity || 0), 0);
  const sumV = details.reduce((s, d) => s + (d.volume || 0), 0);
  return {
    intensity: Math.round(sumI / details.length),
    volume: Math.round(sumV / details.length),
  };
}
