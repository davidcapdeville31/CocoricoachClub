import { Check, CalendarDays, Clock, Users, Droplet, Target, Wrench, Circle } from "lucide-react";
import { format } from "date-fns";
import { getDateLocale } from "@/lib/i18n/dateLocale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { aggregateGamesStats, itemLabel, technicalThemeLabel, type SimplifiedBlock } from "./types";

const STEPS = ["Informations", "Séance", "Récapitulatif"];

export function BowlingStepper({ step, onStep }: { step: number; onStep: (s: number) => void }) {
  return (
    <div className="flex items-start pr-8">
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={label} className="flex flex-1 items-start last:flex-none">
            <button type="button" onClick={() => onStep(i)} className="flex flex-col items-center gap-1 min-w-[72px]">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  done && "bg-primary text-primary-foreground",
                  active && "bg-foreground text-background",
                  !done && !active && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={cn("text-xs", active ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={cn("mt-4 h-0.5 flex-1 rounded-full", i < step ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function blockLine(b: SimplifiedBlock): { icon: typeof Target; color: string; title: string; detail: string } {
  if (b.type === "tactical") {
    const items = b.items.filter((it) => (it.attempts || 0) > 0);
    const att = items.reduce((s, it) => s + (it.attempts || 0), 0);
    const suc = items.reduce((s, it) => s + Math.min(it.success || 0, it.attempts || 0), 0);
    return {
      icon: Target,
      color: "text-primary",
      title: b.title?.trim() || "Tactique",
      detail: `${b.duration_min} min · ${items.map(itemLabel).join(", ") || "aucune situation"}${att ? ` · ${suc}/${att} (${Math.round((suc / att) * 100)} %)` : ""}`,
    };
  }
  if (b.type === "technical") {
    return { icon: Wrench, color: "text-success", title: b.title?.trim() || "Technique", detail: `${technicalThemeLabel(b)} · ${b.duration_min} min` };
  }
  const agg = aggregateGamesStats(b);
  const best = Math.max(0, ...b.parties.map((p) => p.stats?.totalScore || 0));
  return {
    icon: Circle,
    color: "text-warning",
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
  onEditStep,
}: {
  date: Date;
  blocks: SimplifiedBlock[];
  totalDuration: number;
  athleteCount: number | null;
  oilName: string | null;
  onEditStep: (s: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-primary/5 p-4 ring-1 ring-primary/15 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Résumé de la séance</h3>
          <Button variant="outline" size="sm" className="h-8 rounded-lg" onClick={() => onEditStep(0)}>Modifier</Button>
        </div>
        <p className="flex items-center gap-2 text-sm capitalize"><CalendarDays className="h-4 w-4 text-primary" />{format(date, "EEEE d MMMM yyyy", { locale: getDateLocale() })}</p>
        <p className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4 text-primary" />{totalDuration} min</p>
        {athleteCount !== null && (
          <p className="flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-primary" />{athleteCount} athlète{athleteCount > 1 ? "s" : ""}</p>
        )}
        {oilName && <p className="flex items-center gap-2 text-sm"><Droplet className="h-4 w-4 text-primary" />{oilName}</p>}
      </div>

      <div className="rounded-2xl bg-card p-4 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Blocs ({blocks.length})</h3>
          <Button variant="outline" size="sm" className="h-8 rounded-lg" onClick={() => onEditStep(1)}>Modifier</Button>
        </div>
        {blocks.map((b, i) => {
          const l = blockLine(b);
          return (
            <div key={b.id} className="flex items-start gap-3 rounded-xl bg-surface-sunken p-3">
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
