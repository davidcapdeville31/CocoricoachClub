import { Flag, Check, CalendarDays, Clock, Users, Droplet, Target, Wrench, Circle } from "lucide-react";
import { format } from "date-fns";
import { getDateLocale } from "@/lib/i18n/dateLocale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { aggregateGamesStats, itemLabel, technicalThemeLabel, type SimplifiedBlock } from "./types";

const STEPS = ["Informations", "Séance", "Parties"];

export function BowlingStepper({ step, onStep }: { step: number; onStep: (s: number) => void }) {
  return (
    <div className="flex items-start">
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={label} className="flex flex-1 items-start last:flex-none">
            <button type="button" onClick={() => onStep(i)} className="flex flex-col items-center gap-1 min-w-[60px] sm:min-w-[84px]">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  done && "bg-bowling-accent text-primary-foreground",
                  active && "bg-bowling-ink text-card",
                  !done && !active && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={cn("text-[11px] sm:text-xs whitespace-nowrap", active ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={cn("mt-4 h-0.5 flex-1 rounded-full", i < step ? "bg-bowling-accent" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Résumé court et utile d'un bloc, recalculé à chaque rendu. Aucune valeur nulle inventée. */
export function blockSummary(b: SimplifiedBlock): string {
  const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  if (b.type === "tactical") {
    const parts = b.items.map((it) => {
      const att = it.attempts || 0;
      if (att <= 0) return itemLabel(it);
      const suc = Math.min(it.success || 0, att);
      return `${itemLabel(it)} — ${suc}/${att} — ${Math.round((suc / att) * 100)} %`;
    });
    const base = parts.length ? parts.join(" · ") : "Aucune situation";
    return b.duration_min > 0 ? `${base} · ${b.duration_min} min` : base;
  }
  if (b.type === "technical") {
    return `${technicalThemeLabel(b)}${b.duration_min > 0 ? ` — ${b.duration_min} min` : ""}`;
  }
  const agg = aggregateGamesStats(b);
  if (!agg) return "Aucun score saisi";
  return `${agg.count} partie${agg.count > 1 ? "s" : ""} — Moyenne ${fmt(agg.avgScore)}`;
}

function blockLine(b: SimplifiedBlock): { icon: typeof Target; color: string; title: string; detail: string } {
  if (b.type === "tactical") {
    const items = b.items.filter((it) => (it.attempts || 0) > 0);
    const att = items.reduce((s, it) => s + (it.attempts || 0), 0);
    const suc = items.reduce((s, it) => s + Math.min(it.success || 0, it.attempts || 0), 0);
    return {
      icon: Target,
      color: "text-bowling-tactical",
      title: b.title?.trim() || "Tactique",
      detail: `${b.duration_min} min · ${items.map(itemLabel).join(", ") || "aucune situation"}${att ? ` · ${suc}/${att} (${Math.round((suc / att) * 100)} %)` : ""}`,
    };
  }
  if (b.type === "technical") {
    return { icon: Wrench, color: "text-bowling-technical", title: b.title?.trim() || "Technique", detail: `${technicalThemeLabel(b)} · ${b.duration_min} min` };
  }
  const agg = aggregateGamesStats(b);
  const best = Math.max(0, ...b.parties.map((p) => p.stats?.totalScore || 0));
  return {
    icon: Circle,
    color: "text-bowling-games",
    title: b.title?.trim() || "Parties",
    detail: agg ? `${agg.count} partie${agg.count > 1 ? "s" : ""} · Moy. ${agg.avgScore.toLocaleString("fr-FR")} · Meilleure ${best}` : "Aucun score saisi",
  };
}

export function BowlingSessionRecap({
  date,
  blocks,
  totalDuration,
  athleteCount,
  oilName,
  objective,
  onEditStep,
}: {
  date: Date;
  blocks: SimplifiedBlock[];
  totalDuration: number;
  athleteCount: number | null;
  oilName: string | null;
  objective?: string | null;
  onEditStep: (s: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-[20px] bg-bowling-accent/10 p-5 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-bowling-ink">Résumé de la séance</h3>
          <Button variant="ghost" size="sm" className="h-8 rounded-lg bg-card text-bowling-accent" onClick={() => onEditStep(0)}>Modifier</Button>
        </div>
        <p className="flex items-center gap-2 text-sm capitalize"><CalendarDays className="h-4 w-4 text-bowling-ink" />{format(date, "EEEE d MMMM yyyy", { locale: getDateLocale() })}</p>
        <p className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4 text-bowling-ink" />{totalDuration} min</p>
        {athleteCount !== null && (
          <p className="flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-bowling-ink" />{athleteCount} athlète{athleteCount > 1 ? "s" : ""}</p>
        )}
        {objective && <p className="flex items-center gap-2 text-sm"><Flag className="h-4 w-4 text-bowling-ink" />Objectif : {objective}</p>}
        {oilName && <p className="flex items-center gap-2 text-sm"><Droplet className="h-4 w-4 text-bowling-ink" />{oilName}</p>}
      </div>

      <div className="rounded-[20px] bg-card p-5 shadow-[0_2px_12px_-4px_hsl(var(--foreground)/0.08)] space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-bowling-ink">Blocs ({blocks.length})</h3>
          <Button variant="ghost" size="sm" className="h-8 rounded-lg bg-card text-bowling-accent" onClick={() => onEditStep(1)}>Modifier</Button>
        </div>
        {blocks.map((b, i) => {
          const l = blockLine(b);
          return (
            <div key={b.id} className="flex items-start gap-3 rounded-xl bg-bowling-canvas p-3">
              <l.icon className={cn("mt-0.5 h-4 w-4 shrink-0", l.color)} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{i + 1}. {l.title}</p>
                <p className="text-xs text-muted-foreground">{l.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
