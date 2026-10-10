import { useEffect, useRef, useState } from "react";
import { Search, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { JUDO_FAMILIES, searchTechniques, techniqueByKey, type JudoPosition } from "@/lib/judo/nomenclature";

export const cardCls = "rounded-[20px] border border-border/40 bg-card p-4 sm:p-5 shadow-[0_6px_20px_-12px_hsl(var(--judo-ink)/0.2)]";
export const inputCls = "h-11 w-full min-w-0 rounded-xl border border-input bg-input-background px-3 text-[15px] text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring";

export function Chip({ active, onClick, children, tone = "technique" }: { active: boolean; onClick: () => void; children: React.ReactNode; tone?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all active:scale-[0.97]",
        active ? "border-selection bg-selection text-selection-foreground" : "border-border/60 bg-card text-muted-foreground hover:border-judo-ink/30 hover:text-foreground",
      )}
    >
      {active && <Check className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

export function NumField({ label, value, onChange, suffix, max }: { label: string; value: number | null; onChange: (v: number | null) => void; suffix?: string; max?: number }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="relative">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          value={value ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") return onChange(null);
            const n = Number(raw);
            if (Number.isFinite(n) && n >= 0) onChange(max ? Math.min(n, max) : n);
          }}
          className={cn(inputCls, suffix && "pr-11")}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
      </span>
    </label>
  );
}

export function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
    </label>
  );
}

/** Zone de texte qui s'agrandit automatiquement pendant la saisie. */
export function AutoText({ label, value, onChange, placeholder }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(88, el.scrollHeight)}px`;
  }, [value]);
  return (
    <label className="flex min-w-0 flex-col gap-1">
      {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full min-w-0 resize-none overflow-hidden rounded-xl border border-input bg-input-background px-3 py-2.5 text-[15px] leading-relaxed text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

export function IntensityPicker({ value, onChange, label = "Intensité prévue" }: { value: number | null; onChange: (v: number | null) => void; label?: string }) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label} <span className="font-normal">(1–10, facultatif)</span></span>
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <Button variant="outline"
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            data-rpe={n}
            aria-pressed={value === n}
            className={cn(
              "h-11 min-w-0 rounded-lg border text-sm font-semibold transition-colors",
              value === n ? "border-judo-ink bg-judo-ink text-card" : "border-border/60 bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {n}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** Sélecteur de techniques avec recherche, organisé par famille — sans menu minuscule ni modale imbriquée. */
export function TechniquePicker({ positions, families, selected, onChange }: { positions: JudoPosition[]; families: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const pos = positions.length === 1 ? positions[0] : null;
  const results = searchTechniques(query, pos).filter((t) => families.length === 0 || families.includes(t.family));
  const groups = JUDO_FAMILIES.filter((f) => results.some((t) => t.family === f.key));
  const toggle = (k: string) => onChange(selected.includes(k) ? selected.filter((x) => x !== k) : [...selected, k]);

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((k) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-full bg-judo-technique/10 py-1 pl-3 pr-1 text-sm font-medium text-judo-ink">
              {techniqueByKey(k)?.label ?? k}
              <button type="button" onClick={() => toggle(k)} className="rounded-full p-1.5 hover:bg-judo-technique/20" aria-label={`Retirer ${techniqueByKey(k)?.label ?? k}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          placeholder="Rechercher une technique (ex. uchi-mata)"
          className={cn(inputCls, "pl-9")}
          aria-label="Rechercher une technique"
        />
      </div>
      {open && (
        <div className="max-h-72 overflow-y-auto rounded-xl border border-border/50 bg-card p-2">
          {groups.length === 0 && <p className="p-3 text-sm text-muted-foreground">Aucune technique trouvée.</p>}
          {groups.map((f) => (
            <div key={f.key} className="mb-2 last:mb-0">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{f.label} · {f.hint}</p>
              <div className="grid grid-cols-1 gap-1 min-[380px]:grid-cols-2">
                {results.filter((t) => t.family === f.key).map((t) => {
                  const on = selected.includes(t.key);
                  return (
                    <button
                      key={t.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(t.key)}
                      className={cn("flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 text-left text-sm", on ? "bg-judo-technique/10 font-semibold text-judo-ink" : "hover:bg-muted/60")}
                    >
                      <span className="min-w-0 truncate">{t.label}</span>
                      {on && <Check className="h-4 w-4 shrink-0 text-judo-technique" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setOpen(false)} className="mt-1 w-full rounded-lg py-2.5 text-sm font-medium text-judo-technique hover:bg-judo-soft">Fermer la liste</button>
        </div>
      )}
    </div>
  );
}
