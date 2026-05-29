import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { TACTICAL_ZONES } from "@/lib/constants/bowlingTacticalZones";
import { Label } from "@/components/ui/label";

interface Props {
  selected: string[];
  onChange: (next: string[]) => void;
  throwsPerZone?: number;
  onThrowsPerZoneChange?: (v: number) => void;
}

export function BowlingZoneSelector({ selected, onChange, throwsPerZone, onThrowsPerZoneChange }: Props) {
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

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

      {onThrowsPerZoneChange && (
        <div className="flex items-center gap-2">
          <Label className="text-xs whitespace-nowrap">Lancers par zone</Label>
          <Input
            type="number"
            min={1}
            value={throwsPerZone ?? ""}
            onChange={(e) => onThrowsPerZoneChange(parseInt(e.target.value || "0", 10))}
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
