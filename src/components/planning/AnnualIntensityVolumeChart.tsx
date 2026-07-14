import { useMemo } from "react";
import { addDays, differenceInCalendarDays, format, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
} from "recharts";

interface Cycle {
  id: string;
  name: string;
  color: string;
  periodization_category_id: string;
  start_date: string;
  end_date: string;
  intensity: number | null;
  volume: number | null;
  weekly_details?: { week: number; intensity: number; volume: number }[] | null;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Props {
  periodStart: Date;
  periodEnd: Date;
  categories: Category[];
  cycles: Cycle[];
}

export function AnnualIntensityVolumeChart({ periodStart, periodEnd, categories, cycles }: Props) {
  const { data, bands } = useMemo(() => {
    const start = startOfWeek(periodStart, { weekStartsOn: 1 });
    const totalDays = differenceInCalendarDays(periodEnd, start) + 1;
    const weekCount = Math.ceil(totalDays / 7);

    const rows: any[] = [];
    for (let w = 0; w < weekCount; w++) {
      const wStart = addDays(start, w * 7);
      const wEnd = addDays(wStart, 6);
      const active = cycles.filter((c) => {
        const cs = new Date(c.start_date);
        const ce = new Date(c.end_date);
        return ce >= wStart && cs <= wEnd;
      });

      // Compute intensity/volume for this week (use weekly_details if available)
      let intensitySum = 0;
      let volumeSum = 0;
      let count = 0;
      active.forEach((c) => {
        let iVal = c.intensity ?? 0;
        let vVal = c.volume ?? 0;
        if (c.weekly_details && c.weekly_details.length > 0) {
          const cs = new Date(c.start_date);
          const csWeekStart = startOfWeek(cs, { weekStartsOn: 1 });
          const weekIdxInCycle = Math.floor(differenceInCalendarDays(wStart, csWeekStart) / 7);
          const wd = c.weekly_details[Math.max(0, Math.min(c.weekly_details.length - 1, weekIdxInCycle))];
          if (wd) {
            iVal = wd.intensity ?? iVal;
            vVal = wd.volume ?? vVal;
          }
        }
        intensitySum += iVal;
        volumeSum += vVal;
        count++;
      });

      rows.push({
        label: format(wStart, "dd/MM", { locale: fr }),
        weekIndex: w,
        intensity: count > 0 ? Math.round((intensitySum / count) * 10) / 10 : null,
        volume: count > 0 ? Math.round((volumeSum / count) * 10) / 10 : null,
      });
    }

    // Category color bands (ReferenceArea)
    const bandsArr = cycles.map((c) => {
      const cat = categories.find((k) => k.id === c.periodization_category_id);
      const cs = new Date(c.start_date);
      const ce = new Date(c.end_date);
      const startIdx = Math.max(0, Math.floor(differenceInCalendarDays(cs, start) / 7));
      const endIdx = Math.min(weekCount - 1, Math.floor(differenceInCalendarDays(ce, start) / 7));
      return {
        id: c.id,
        color: cat?.color || c.color,
        name: cat?.name || c.name,
        x1: rows[startIdx]?.label,
        x2: rows[endIdx]?.label,
      };
    }).filter((b) => b.x1 && b.x2);

    return { data: rows, bands: bandsArr };
  }, [periodStart, periodEnd, cycles, categories]);

  // Unique legend entries by category name
  const legendCats = useMemo(() => {
    const seen = new Set<string>();
    const list: { name: string; color: string }[] = [];
    bands.forEach((b) => {
      if (!seen.has(b.name)) {
        seen.add(b.name);
        list.push({ name: b.name, color: b.color });
      }
    });
    return list;
  }, [bands]);

  if (data.every((d) => d.intensity == null && d.volume == null)) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Aucune donnée d'intensité ou volume définie sur les cycles de la période.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      {/* Legend catégories */}
      {legendCats.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs">
          {legendCats.map((c) => (
            <div key={c.name} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: c.color }} />
              <span className="text-foreground/80">{c.name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="w-full" style={{ height: 420 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            {bands.map((b, i) => (
              <ReferenceArea
                key={`${b.id}-${i}`}
                x1={b.x1}
                x2={b.x2}
                fill={b.color}
                fillOpacity={0.08}
                stroke={b.color}
                strokeOpacity={0.15}
              />
            ))}
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              domain={[0, 10]}
              ticks={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              label={{ value: "/10", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="intensity"
              name="Charge / intensité"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="volume"
              name="Volume"
              stroke="hsl(142 71% 45%)"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
