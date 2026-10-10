import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Target, Crosshair, Split, CircleDot, type LucideIcon } from "lucide-react";

const SITUATION_ICONS: Record<string, LucideIcon> = { strike: Target, pocket: Crosshair, composed_spare: Split, single_pin: CircleDot };
import { SimplifiedOilPatternPicker } from "./SimplifiedOilPatternPicker";
import { SimplifiedBallPicker } from "./SimplifiedBallPicker";
import {
  COMPOSED_SPARES,
  SINGLE_PINS,
  TARGET_TYPES,
  itemLabel,
  newItem,
  type SimplifiedTacticalBlock,
  type SimplifiedTacticalItem,
  type SimplifiedTargetType,
} from "./types";

interface Props {
  value: SimplifiedTacticalBlock;
  onChange: (next: SimplifiedTacticalBlock) => void;
  onRemove: () => void;
  categoryId: string;
  playerId?: string;
  index: number;
  /** Si true, le sélecteur de huilage par bloc est masqué (le huilage est défini au niveau de la séance). */
  hideOilPicker?: boolean;
}

export function SimplifiedTacticalBlockEditor({
  value,
  onChange,
  onRemove,
  categoryId,
  playerId,
  index,
  hideOilPicker,
}: Props) {

  const update = (patch: Partial<SimplifiedTacticalBlock>) =>
    onChange({ ...value, ...patch });

  const updateItem = (id: string, patch: Partial<SimplifiedTacticalItem>) =>
    update({
      items: value.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    });

  const removeItem = (id: string) =>
    update({ items: value.items.filter((it) => it.id !== id) });

  const addItem = (target_type: SimplifiedTargetType) =>
    update({ items: [...value.items, newItem(target_type)] });

  const totalAttempts = value.items.reduce((s, it) => s + (it.attempts || 0), 0);
  const totalSuccess = value.items.reduce((s, it) => s + (it.success || 0), 0);
  const globalPct =
    totalAttempts > 0 ? Math.round((totalSuccess / totalAttempts) * 100) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label htmlFor={`tac-dur-${value.id}`} className="text-sm font-medium text-bowling-ink">Durée</Label>
        <div className="relative w-28">
          <Input id={`tac-dur-${value.id}`} type="number" inputMode="numeric" min={1} value={value.duration_min || ""}
            onChange={(e) => update({ duration_min: e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0) })}
            className="h-11 rounded-xl border-0 bg-bowling-canvas pr-11 text-base" />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">min</span>
        </div>
      </div>

      {/* Situations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold text-bowling-ink">Situations travaillées</Label>
          {globalPct !== null && <span className="text-xs font-medium text-muted-foreground">Total {totalSuccess}/{totalAttempts} · {globalPct} %</span>}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TARGET_TYPES.map((t) => {
            const count = value.items.filter((it) => it.target_type === t.value).length;
            const Icon = SITUATION_ICONS[t.value];
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => addItem(t.value)}
                className={`flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-medium transition-colors ${count > 0 ? "bg-bowling-ink text-card" : "bg-bowling-canvas text-foreground hover:bg-muted"}`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${count > 0 ? "" : "text-bowling-tactical"}`} />
                <span className="truncate">{t.label}</span>
                {count > 1 && <span className="text-xs opacity-80">×{count}</span>}
              </button>
            );
          })}
        </div>

        {value.items.map((item) => {
          const over = (item.success || 0) > (item.attempts || 0);
          const pct = item.attempts > 0 ? Math.round((Math.min(item.success, item.attempts) / item.attempts) * 100) : null;
          return (
            <div key={item.id} className="space-y-2 border-t border-border/60 pt-3 first:border-t-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-bowling-ink">{itemLabel(item)}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Retirer la situation" onClick={() => removeItem(item.id)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>

              {item.target_type === "composed_spare" && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Select value={item.composed_spare || "6_10"} onValueChange={(v) => updateItem(item.id, { composed_spare: v as any })}>
                    <SelectTrigger className="h-11 rounded-xl bg-bowling-canvas border-0 text-sm"><SelectValue placeholder="Choisir un spare" /></SelectTrigger>
                    <SelectContent className="z-[200] max-h-[60vh]">
                      {COMPOSED_SPARES.map((s) => <SelectItem key={s.value} value={s.value} className="py-2 text-sm">{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {item.composed_spare === "custom" && (
                    <Input placeholder="ex. 2-4-10" className="h-11 rounded-xl bg-bowling-canvas border-0 text-sm" value={(item.custom_pins || []).join("-")}
                      onChange={(e) => {
                        const pins = e.target.value.split(/[-,\s]+/).map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n) && n >= 1 && n <= 10);
                        updateItem(item.id, { custom_pins: pins });
                      }} />
                  )}
                </div>
              )}
              {item.target_type === "single_pin" && (
                <Select value={item.single_pin || "10"} onValueChange={(v) => updateItem(item.id, { single_pin: v as any })}>
                  <SelectTrigger className="h-11 rounded-xl bg-bowling-canvas border-0 text-sm"><SelectValue placeholder="Choisir une quille" /></SelectTrigger>
                  <SelectContent className="z-[200] max-h-[60vh]">
                    {SINGLE_PINS.map((s) => <SelectItem key={s.value} value={s.value} className="py-2 text-sm">{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[110px_110px_64px_1fr] sm:gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Lancers</Label>
                  <Input type="number" inputMode="numeric" pattern="[0-9]*" min={0} value={item.attempts || ""}
                    onChange={(e) => updateItem(item.id, { attempts: Math.max(0, parseInt(e.target.value || "0", 10) || 0) })}
                    className="h-11 rounded-xl border-0 bg-bowling-canvas text-base" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Réussites</Label>
                  <Input type="number" inputMode="numeric" pattern="[0-9]*" min={0} value={item.success || ""}
                    aria-invalid={over}
                    onChange={(e) => updateItem(item.id, { success: Math.max(0, parseInt(e.target.value || "0", 10) || 0) })}
                    className={`h-11 rounded-xl border-0 bg-bowling-canvas text-base ${over ? "ring-2 ring-destructive/60" : ""}`} />
                </div>
                <div className="col-span-2 flex items-center gap-3 sm:col-span-2 sm:pb-3">
                  <span className="w-14 shrink-0 text-base font-semibold text-bowling-tactical">{pct !== null ? `${pct} %` : "—"}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bowling-canvas">
                    {pct !== null && <div className="h-full rounded-full bg-bowling-tactical/70 transition-all" style={{ width: `${pct}%` }} />}
                  </div>
                </div>
              </div>
              {over && <p className="text-xs text-destructive">Les réussites dépassent le nombre de lancers ({item.attempts}).</p>}
            </div>
          );
        })}
      </div>

      <details className="group rounded-xl bg-bowling-canvas/60 px-3 py-2">
        <summary className="cursor-pointer list-none text-sm font-medium text-muted-foreground hover:text-foreground">+ Boule, titre et notes (facultatif)</summary>
        <div className="mt-3 space-y-3">
          <Input value={value.title} onChange={(e) => update({ title: e.target.value })} placeholder="Titre (ex. Spares côté gauche)" className="h-11 rounded-xl border-0 bg-card text-sm" />
          <SimplifiedBallPicker playerId={playerId} categoryId={categoryId} value={value.ball_id} onChange={(id) => update({ ball_id: id })} />
          {!hideOilPicker && (
            <SimplifiedOilPatternPicker value={value.oil_pattern} onChange={(op) => update({ oil_pattern: op })} categoryId={categoryId} />
          )}
          <Textarea value={value.notes ?? ""} onChange={(e) => update({ notes: e.target.value })} placeholder="Ressentis, observations, axes à retravailler…" rows={2} className="rounded-xl border-0 bg-card text-sm" />
        </div>
      </details>
    </div>
  );
}
