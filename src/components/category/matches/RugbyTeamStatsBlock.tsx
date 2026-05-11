import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RugbyTeamStatsBlockProps {
  value: Record<string, number>;
  onChange: (key: string, val: number) => void;
}

const FIELDS: Array<{ key: string; label: string }> = [
  { key: "fouls", label: "Nombre de fautes" },
  { key: "yellowCards", label: "Cartons jaunes" },
  { key: "redCards", label: "Cartons rouges" },
];

const SCRUM_FIELDS = [
  { totalKey: "scrumTotal", wonKey: "scrumWon", totalLabel: "Mêlées introduites", wonLabel: "Mêlées conservées" },
  { totalKey: "scrumDefenseTotal", wonKey: "scrumDefenseWon", totalLabel: "Mêlées adverses", wonLabel: "Mêlées adverses gagnées" },
];

const LINEOUT_FIELDS = [
  { totalKey: "lineoutTotal", wonKey: "lineoutWon", totalLabel: "Touches introduites", wonLabel: "Touches conservées" },
  { totalKey: "lineoutDefenseTotal", wonKey: "lineoutSteals", totalLabel: "Touches adverses", wonLabel: "Touches adverses volées" },
];

function pct(won: number, total: number): string {
  if (!total || total <= 0) return "0%";
  return `${Math.round((won / total) * 100)}%`;
}

export function RugbyTeamStatsBlock({ value, onChange }: RugbyTeamStatsBlockProps) {
  const num = (k: string) => Number(value[k]) || 0;

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <Label className="text-xs">{f.label}</Label>
            <Input
              type="number"
              min={0}
              value={value[f.key] ?? ""}
              onChange={(e) => onChange(f.key, parseInt(e.target.value) || 0)}
              className="h-8 mt-1"
              placeholder="0"
            />
          </div>
        ))}
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Mêlées</p>
        <div className="space-y-2">
          {SCRUM_FIELDS.map((row) => (
            <div key={row.totalKey} className="grid grid-cols-3 gap-3 items-end">
              <div>
                <Label className="text-xs">{row.totalLabel}</Label>
                <Input
                  type="number"
                  min={0}
                  value={value[row.totalKey] ?? ""}
                  onChange={(e) => onChange(row.totalKey, parseInt(e.target.value) || 0)}
                  className="h-8 mt-1"
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs">{row.wonLabel}</Label>
                <Input
                  type="number"
                  min={0}
                  value={value[row.wonKey] ?? ""}
                  onChange={(e) => onChange(row.wonKey, parseInt(e.target.value) || 0)}
                  className="h-8 mt-1"
                  placeholder="0"
                />
              </div>
              <div className="h-8 mt-1 flex items-center justify-center rounded-md bg-muted text-sm font-semibold">
                {pct(num(row.wonKey), num(row.totalKey))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Touches</p>
        <div className="space-y-2">
          {LINEOUT_FIELDS.map((row) => (
            <div key={row.totalKey} className="grid grid-cols-3 gap-3 items-end">
              <div>
                <Label className="text-xs">{row.totalLabel}</Label>
                <Input
                  type="number"
                  min={0}
                  value={value[row.totalKey] ?? ""}
                  onChange={(e) => onChange(row.totalKey, parseInt(e.target.value) || 0)}
                  className="h-8 mt-1"
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs">{row.wonLabel}</Label>
                <Input
                  type="number"
                  min={0}
                  value={value[row.wonKey] ?? ""}
                  onChange={(e) => onChange(row.wonKey, parseInt(e.target.value) || 0)}
                  className="h-8 mt-1"
                  placeholder="0"
                />
              </div>
              <div className="h-8 mt-1 flex items-center justify-center rounded-md bg-muted text-sm font-semibold">
                {pct(num(row.wonKey), num(row.totalKey))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
