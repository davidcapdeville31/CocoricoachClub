import { useEffect, useMemo, useState } from "react";
import { format, isSameDay, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { getDateLocale } from "@/lib/i18n/dateLocale";
import { calendarDateKey, calendarWeek, navigateCalendar, weekEnd } from "@/lib/athleteCalendarDates";
import { cn } from "@/lib/utils";

export type CalendarMarker = { type: string; label: string; dates: Date[] };
interface Props { selected: Date; onSelect: (date: Date) => void; markers: CalendarMarker[] }

export function AthleteCalendarGrid({ selected, onSelect, markers }: Props) {
  const [view, setView] = useState<"month" | "week">(() => {
    try { return localStorage.getItem("athlete-calendar-view") === "week" ? "week" : "month"; } catch { return "month"; }
  });
  const [anchor, setAnchor] = useState(selected);
  useEffect(() => { setAnchor(selected); }, [selected]);
  const markersByDate = useMemo(() => {
    const map = new Map<string, CalendarMarker[]>();
    markers.forEach(marker => marker.dates.forEach(date => {
      const key = calendarDateKey(date);
      const existing = map.get(key) || [];
      if (!existing.some(item => item.type === marker.type)) map.set(key, [...existing, marker]);
    }));
    return map;
  }, [markers]);
  const renderDate = (date: Date) => {
    const items = markersByDate.get(calendarDateKey(date)) || [];
    return <><span>{date.getDate()}</span><span className="athlete-date-markers" aria-hidden="true">{items.slice(0, 3).map(item => <i key={item.type} data-calendar-kind={item.type} />)}{items.length > 3 && <b>+</b>}</span><span className="sr-only">{items.map(item => item.label).join(", ")}</span></>;
  };
  const locale = getDateLocale();
  return <section className="athlete-calendar-grid" aria-label="Calendrier sportif">
    <div className="flex items-center justify-between gap-2 mb-2">
      <div className="flex gap-1" aria-label="Affichage du calendrier">{(["month", "week"] as const).map(mode => <Button key={mode} size="sm" variant="outline" aria-pressed={view === mode} className="min-h-11 px-3" onClick={() => { setView(mode); try { localStorage.setItem("athlete-calendar-view", mode); } catch { /* preference is optional */ } }}>{mode === "month" ? "Mois" : "Semaine"}</Button>)}</div>
      <Button variant="outline" size="sm" className="min-h-11 px-3" onClick={() => { const now = new Date(); setAnchor(now); onSelect(now); }}>Aujourd’hui</Button>
    </div>
    <div className="flex items-center justify-between gap-1 mb-2">
      <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={view === "month" ? "Mois précédent" : "Semaine précédente"} onClick={() => setAnchor(date => navigateCalendar(date, view, -1))}><ChevronLeft className="h-5 w-5" /></Button>
      <p className="text-sm font-semibold text-center" aria-live="polite">{view === "month" ? format(anchor, "MMMM yyyy", { locale }) : `${format(calendarWeek(anchor)[0], "d MMM", { locale })} – ${format(weekEnd(anchor), "d MMM yyyy", { locale })}`}</p>
      <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={view === "month" ? "Mois suivant" : "Semaine suivante"} onClick={() => setAnchor(date => navigateCalendar(date, view, 1))}><ChevronRight className="h-5 w-5" /></Button>
    </div>
    {view === "month" ? <Calendar mode="single" required selected={selected} onSelect={date => date && onSelect(date)} month={startOfMonth(anchor)} onMonthChange={setAnchor} weekStartsOn={1} locale={locale} className="athlete-month-picker p-0 w-full" components={{ DayContent: ({ date }) => renderDate(date) }} classNames={{ caption: "hidden", months: "block", month: "space-y-0 w-full", table: "w-full border-collapse", head_row: "grid grid-cols-7", head_cell: "text-xs text-muted-foreground text-center py-2", row: "grid grid-cols-7 gap-1 mt-1", cell: "relative text-center min-w-0", day: "athlete-date-button", day_selected: "athlete-date-selected", day_today: "athlete-date-today", day_outside: "athlete-date-outside" }} /> : <div className="grid grid-cols-7 gap-1">{calendarWeek(anchor).map(date => <div key={calendarDateKey(date)} className="min-w-0"><p className="text-xs text-muted-foreground text-center py-2">{format(date, "EEEEE", { locale })}</p><Button variant="ghost" className={cn("athlete-date-button", isSameDay(date, new Date()) && "athlete-date-today")} aria-pressed={isSameDay(date, selected)} aria-label={format(date, "EEEE d MMMM yyyy", { locale })} onClick={() => onSelect(date)}>{renderDate(date)}</Button></div>)}</div>}
    <details className="mt-2 text-xs text-muted-foreground"><summary className="min-h-11 flex items-center cursor-pointer">Repères du calendrier</summary><ul className="flex flex-wrap gap-x-3 gap-y-2 pb-2">{markers.map(marker => <li key={marker.type} className="flex items-center gap-1.5"><i className="athlete-calendar-dot" data-calendar-kind={marker.type} aria-hidden="true" />{marker.label}</li>)}</ul></details>
  </section>;
}