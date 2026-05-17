// ============================================================
// Widgets atomiques pour la fiche scouting Judo
// ============================================================
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Star, ChevronDown } from "lucide-react";
import { TONE_CLASSES, TONE_ACTIVE, type ChipOption } from "./scoutingConstants";
import * as Collapsible from "@radix-ui/react-collapsible";

// ============================================================
// SectionCard — accordéon premium avec couleur thématique
// ============================================================
interface SectionCardProps {
  id: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  tone?: "danger" | "control" | "opportunism" | "newaza" | "physical" | "neutral";
  defaultOpen?: boolean;
  children: ReactNode;
  rightSlot?: ReactNode;
}

const TONE_HEADER: Record<NonNullable<SectionCardProps["tone"]>, string> = {
  danger: "from-rose-500/15 to-rose-500/5 border-rose-500/20",
  control: "from-blue-500/15 to-blue-500/5 border-blue-500/20",
  opportunism: "from-orange-500/15 to-orange-500/5 border-orange-500/20",
  newaza: "from-violet-500/15 to-violet-500/5 border-violet-500/20",
  physical: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/20",
  neutral: "from-muted/60 to-muted/20 border-border",
};

const TONE_ICON_BG: Record<NonNullable<SectionCardProps["tone"]>, string> = {
  danger: "bg-rose-500/20 text-rose-600 dark:text-rose-300",
  control: "bg-blue-500/20 text-blue-600 dark:text-blue-300",
  opportunism: "bg-orange-500/20 text-orange-600 dark:text-orange-300",
  newaza: "bg-violet-500/20 text-violet-600 dark:text-violet-300",
  physical: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300",
  neutral: "bg-muted text-muted-foreground",
};

export function SectionCard({
  id,
  title,
  subtitle,
  icon,
  tone = "neutral",
  defaultOpen = true,
  children,
  rightSlot,
}: SectionCardProps) {
  return (
    <Collapsible.Root defaultOpen={defaultOpen} className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      <Collapsible.Trigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            "flex w-full items-center gap-3 px-4 py-3 bg-gradient-to-r border-b text-left transition-colors hover:brightness-105",
            TONE_HEADER[tone],
          )}
        >
          {icon && (
            <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", TONE_ICON_BG[tone])}>
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold tracking-tight truncate">{title}</div>
            {subtitle && <div className="text-[11px] text-muted-foreground truncate">{subtitle}</div>}
          </div>
          {rightSlot}
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform data-[state=open]:rotate-180 shrink-0" />
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
        <div className="p-4 space-y-4">{children}</div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

// ============================================================
// ChipGroup — sélection mono ou multi (clé string)
// ============================================================
interface ChipGroupProps {
  label?: string;
  options: ChipOption[];
  value: string | string[] | null;
  onChange: (v: string | string[] | null) => void;
  multi?: boolean;
  size?: "sm" | "md";
}

export function ChipGroup({ label, options, value, onChange, multi = false, size = "sm" }: ChipGroupProps) {
  const selected = new Set<string>(
    Array.isArray(value) ? value : value ? [value] : [],
  );

  const toggle = (key: string) => {
    if (multi) {
      const next = new Set(selected);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      onChange(Array.from(next));
    } else {
      onChange(selected.has(key) ? null : key);
    }
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          {label}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = selected.has(opt.key);
          const toneIdle = opt.tone ? TONE_CLASSES[opt.tone] : "bg-muted/60 text-foreground border-border hover:bg-muted";
          const toneActive = opt.tone ? TONE_ACTIVE[opt.tone] : "bg-primary text-primary-foreground border-primary";
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => toggle(opt.key)}
              className={cn(
                "rounded-full border font-medium transition-all duration-150 select-none",
                size === "sm" ? "h-7 px-3 text-[11px]" : "h-8 px-3.5 text-xs",
                active ? toneActive : toneIdle,
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// SliderWithLabels — slider gradué
// ============================================================
interface SliderWithLabelsProps {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  leftLabel?: string;
  rightLabel?: string;
  unit?: string;
  tone?: "danger" | "control" | "newaza" | "physical";
}

const SLIDER_TONE = {
  danger: "[&_[role=slider]]:bg-rose-500 [&>.bg-primary]:bg-rose-500",
  control: "[&_[role=slider]]:bg-blue-500 [&>.bg-primary]:bg-blue-500",
  newaza: "[&_[role=slider]]:bg-violet-500 [&>.bg-primary]:bg-violet-500",
  physical: "[&_[role=slider]]:bg-emerald-500 [&>.bg-primary]:bg-emerald-500",
} as const;

export function SliderWithLabels({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 5,
  leftLabel,
  rightLabel,
  unit = "",
  tone,
}: SliderWithLabelsProps) {
  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</span>
          <span className="text-xs font-bold tabular-nums">{value}{unit}</span>
        </div>
      )}
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? min)}
        className={cn("py-1", tone && SLIDER_TONE[tone])}
      />
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// DangerStars — sélecteur 1 à 5 étoiles
// ============================================================
interface DangerStarsProps {
  value: number | null;
  onChange: (v: number | null) => void;
  size?: "sm" | "md" | "lg";
  readonly?: boolean;
}

export function DangerStars({ value, onChange, size = "md", readonly = false }: DangerStarsProps) {
  const px = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-6 w-6" : "h-4 w-4";
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = (value ?? 0) >= n;
        return (
          <button
            key={n}
            type="button"
            disabled={readonly}
            onClick={() => onChange(value === n ? null : n)}
            className={cn(
              "p-0.5 rounded transition-transform",
              !readonly && "hover:scale-110 cursor-pointer",
              readonly && "cursor-default",
            )}
            aria-label={`Danger ${n}`}
          >
            <Star
              className={cn(
                px,
                "transition-colors",
                active
                  ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]"
                  : "text-muted-foreground/40",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// SaveIndicator — badge "Synchronisé / En cours"
// ============================================================
export function SaveIndicator({ saving, dirty }: { saving: boolean; dirty: boolean }) {
  if (saving) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
        Synchronisation…
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
        Modifié
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Enregistré
    </span>
  );
}

// ============================================================
// MiniStat — petit bloc statistique
// ============================================================
export function MiniStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: "danger" | "control" | "opportunism" | "newaza" | "physical" | "neutral";
}) {
  const toneClass = {
    danger: "border-rose-500/30 bg-rose-500/5",
    control: "border-blue-500/30 bg-blue-500/5",
    opportunism: "border-orange-500/30 bg-orange-500/5",
    newaza: "border-violet-500/30 bg-violet-500/5",
    physical: "border-emerald-500/30 bg-emerald-500/5",
    neutral: "border-border bg-muted/30",
  }[tone];

  return (
    <div className={cn("rounded-xl border px-3 py-2", toneClass)}>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</div>
      <div className="text-sm font-bold mt-0.5">{value}</div>
    </div>
  );
}
