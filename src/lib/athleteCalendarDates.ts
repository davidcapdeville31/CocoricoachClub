import { addDays, addMonths, addWeeks, endOfWeek, format, parseISO, startOfWeek } from "date-fns";

export function calendarDateKey(date: Date) { return format(date, "yyyy-MM-dd"); }
export function calendarWeek(date: Date) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}
export function navigateCalendar(date: Date, view: "month" | "week", direction: number) {
  return view === "month" ? addMonths(date, direction) : addWeeks(date, direction);
}
export function dateInEvent(date: string, start: string, end?: string | null) {
  return date >= start && date <= (end && end >= start ? end : start);
}
export function weekEnd(date: Date) { return endOfWeek(date, { weekStartsOn: 1 }); }
export function civilDate(value: string) { return parseISO(value); }