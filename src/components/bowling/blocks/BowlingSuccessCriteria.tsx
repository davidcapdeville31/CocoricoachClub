import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUCCESS_CRITERIA_KEYS } from "@/lib/constants/bowlingTargetOutcomes";
import type { BowlingSuccessCriteria } from "./types";

interface Props {
  value: BowlingSuccessCriteria;
  onChange: (next: BowlingSuccessCriteria) => void;
}

export function BowlingSuccessCriteria({ value, onChange }: Props) {
  const set = (k: string, raw: string) => {
    const n = raw === "" ? undefined : Number(raw);
    onChange({ ...value, [k]: Number.isNaN(n) ? undefined : n });
  };
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {SUCCESS_CRITERIA_KEYS.map((c) => (
        <div key={c.key} className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{c.label}</Label>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              value={(value as any)[c.key] ?? ""}
              onChange={(e) => set(c.key, e.target.value)}
              className="h-8 text-xs"
            />
            {c.suffix && (
              <span className="text-[10px] text-muted-foreground w-8">{c.suffix}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
