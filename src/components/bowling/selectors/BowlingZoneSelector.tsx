import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { TACTICAL_ZONES } from "@/lib/constants/bowlingTacticalZones";
import { Label } from "@/components/ui/label";

interface Props {
  selected: string[];
  onChange: (next: string[]) => void;
  // Legacy single value (toujours supporté pour rétro-compat)
  throwsPerZone?: number;
  onThrowsPerZoneChange?: (v: number) => void;
  // Nouveau : map par zone (préféré)
  throwsByZone?: Record<string, number>;
  onThrowsByZoneChange?: (m: Record<string, number>) => void;
}

export function BowlingZoneSelector({
  selected,
  onChange,
  throwsPerZone,
  onThrowsPerZoneChange,
  throwsByZone,
  onThrowsByZoneChange,
}: Props) {
  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    onChange(next);
    if (onThrowsByZoneChange && throwsByZone && !next.includes(v)) {
      const { [v]: _drop, ...rest } = throwsByZone;
      onThrowsByZoneChange(rest);
    }
  };

  const setZoneCount = (zone: string, n: number) => {
    if (!onThrowsByZoneChange) return;
    const next = { ...(throwsByZone || {}) };
    if (!n || n <= 0) delete next[zone];
    else next[zone] = n;
    onThrowsByZoneChange(next);
  };

  const total = onThrowsByZoneChange
    ? selected.reduce((sum, z) => sum + (throwsByZone?.[z] || 0), 0)
    : (selected.length || 0) * (throwsPerZone || 0);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/60 bg-surface-sunken p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Zones de jeu (flèches & lattes)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {TACTICAL_ZONES.map((z) => {
            const on = selected.includes(z.value);
            return (
              <button
                key={z.value}
                type="button"
                onClick={() => toggle(z.value)}
                className={cn(
                  "px-2.5 py-1.5 rounded-md text-xs border transition-all text-left",
                  on
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background hover:bg-muted border-border text-foreground/80",
                )}
              >
                <span className="font-semibold">{z.short}</span>
                <span className="text-[10px] block opacity-80">{z.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {onThrowsByZoneChange && selected.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-surface-sunken p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Lancers par zone
            </p>
            <span className="text-[11px] text-muted-foreground">
              Total : <span className="font-semibold text-foreground">{total}</span> lancers
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {selected.map((zone) => {
              const meta = TACTICAL_ZONES.find((t) => t.value === zone);
              return (
                <div key={zone} className="flex items-center gap-2">
                  <Label className="text-[11px] flex-1 truncate" title={meta?.label}>
                    {meta?.short || zone}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={throwsByZone?.[zone] || ""}
                    onChange={(e) => setZoneCount(zone, e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="h-8 w-16 text-xs"
                    placeholder="0"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!onThrowsByZoneChange && onThrowsPerZoneChange && (
        <div className="flex items-center gap-2">
          <Label className="text-xs whitespace-nowrap">Lancers par zone</Label>
          <Input
            type="number"
            min={1}
            value={throwsPerZone || ""}
            onChange={(e) => onThrowsPerZoneChange(e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="h-8 w-24 text-xs"
            placeholder="ex. 10"
          />
          {selected.length > 0 && throwsPerZone && (
            <span className="text-[11px] text-muted-foreground">
              = {selected.length * throwsPerZone} lancers
            </span>
          )}
        </div>
      )}
    </div>
  );
}
