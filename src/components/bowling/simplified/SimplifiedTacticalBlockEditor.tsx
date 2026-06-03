import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Target } from "lucide-react";
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
    <Card className="space-y-4 rounded-2xl border-l-4 border-l-blue-500 bg-surface p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-blue-500/10 p-2">
            <Target className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bloc {index + 1} · Tactique
            </p>
            <Input
              value={value.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Titre du bloc (optionnel)"
              className="mt-1 h-8 text-sm"
            />
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {/* Durée */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Durée (min)</Label>
          <Input
            type="number"
            min={1}
            value={value.duration_min}
            onChange={(e) =>
              update({ duration_min: parseInt(e.target.value || "0", 10) })
            }
            className="h-9 text-sm"
          />
        </div>
        {globalPct !== null && (
          <div className="flex items-end justify-end">
            <Badge variant="secondary" className="text-xs">
              {totalSuccess}/{totalAttempts} réussis · {globalPct}%
            </Badge>
          </div>
        )}
      </div>

      {/* Boule */}
      <SimplifiedBallPicker
        playerId={playerId}
        categoryId={categoryId}
        value={value.ball_id}
        onChange={(id) => update({ ball_id: id })}
      />

      {/* Huilage (masqué quand défini au niveau de la séance) */}
      {!hideOilPicker && (
        <SimplifiedOilPatternPicker
          value={value.oil_pattern}
          onChange={(op) => update({ oil_pattern: op })}
          categoryId={categoryId}
        />
      )}


      {/* Items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Situations travaillées
          </Label>
        </div>

        {value.items.length === 0 && (
          <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3 text-center text-xs italic text-muted-foreground">
            Aucune situation. Ajoutez-en une ci-dessous.
          </p>
        )}

        {value.items.map((item) => {
          const pct =
            item.attempts > 0
              ? Math.round((item.success / item.attempts) * 100)
              : null;
          return (
            <div
              key={item.id}
              className="space-y-2 rounded-xl border border-border/60 bg-surface-sunken p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{itemLabel(item)}</span>
                <div className="flex items-center gap-2">
                  {pct !== null && (
                    <Badge
                      variant="outline"
                      className={
                        pct >= 70
                          ? "border-emerald-500 text-emerald-600"
                          : pct >= 40
                            ? "border-amber-500 text-amber-600"
                            : "border-rose-500 text-rose-600"
                      }
                    >
                      {pct}%
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>

              {/* Sous-sélection */}
              {item.target_type === "composed_spare" && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Select
                    value={item.composed_spare || "6_10"}
                    onValueChange={(v) =>
                      updateItem(item.id, { composed_spare: v as any })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[100]">
                      {COMPOSED_SPARES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {item.composed_spare === "custom" && (
                    <Input
                      placeholder="ex. 2-4-10"
                      className="h-8 text-xs"
                      value={(item.custom_pins || []).join("-")}
                      onChange={(e) => {
                        const pins = e.target.value
                          .split(/[-,\s]+/)
                          .map((x) => parseInt(x, 10))
                          .filter((n) => Number.isFinite(n) && n >= 1 && n <= 10);
                        updateItem(item.id, { custom_pins: pins });
                      }}
                    />
                  )}
                </div>
              )}
              {item.target_type === "single_pin" && (
                <Select
                  value={item.single_pin || "10"}
                  onValueChange={(v) => updateItem(item.id, { single_pin: v as any })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    {SINGLE_PINS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Attempts + success */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">
                    Nb lancers
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={item.attempts || ""}
                    onChange={(e) =>
                      updateItem(item.id, {
                        attempts: Math.max(0, parseInt(e.target.value || "0", 10)),
                      })
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">
                    Réussis
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={item.attempts || undefined}
                    value={item.success || ""}
                    onChange={(e) => {
                      const v = Math.max(0, parseInt(e.target.value || "0", 10));
                      updateItem(item.id, {
                        success: item.attempts ? Math.min(v, item.attempts) : v,
                      });
                    }}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          );
        })}

        {/* Add buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          {TARGET_TYPES.map((t) => (
            <Button
              key={t.value}
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => addItem(t.value)}
            >
              <Plus className="h-3.5 w-3.5" />
              {t.label}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}
