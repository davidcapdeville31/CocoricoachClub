import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";

export const TEAM_COLOR_PALETTE: { value: string; label: string }[] = [
  { value: "#16a34a", label: "Vert" },
  { value: "#eab308", label: "Jaune" },
  { value: "#dc2626", label: "Rouge" },
  { value: "#2563eb", label: "Bleu" },
  { value: "#ea580c", label: "Orange" },
  { value: "#7c3aed", label: "Violet" },
  { value: "#0d9488", label: "Turquoise" },
  { value: "#db2777", label: "Rose" },
  { value: "#0f172a", label: "Noir" },
  { value: "#f1f5f9", label: "Blanc" },
  { value: "#78716c", label: "Gris" },
  { value: "#854d0e", label: "Marron" },
];

export interface TeamColorsDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  homeName: string;
  awayName: string;
  initialHome?: string;
  initialAway?: string;
  onConfirm: (colors: { home: string; away: string }) => void;
}

export function TeamColorsDialog({ open, onOpenChange, homeName, awayName, initialHome, initialAway, onConfirm }: TeamColorsDialogProps) {
  const [home, setHome] = useState<string>(initialHome ?? TEAM_COLOR_PALETTE[0].value);
  const [away, setAway] = useState<string>(initialAway ?? TEAM_COLOR_PALETTE[1].value);

  const Palette = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="grid grid-cols-6 gap-2 mt-2">
      {TEAM_COLOR_PALETTE.map((c) => {
        const active = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            className={`relative h-12 rounded-lg border-2 transition-all ${active ? "ring-2 ring-offset-2 ring-primary scale-105" : "border-border hover:scale-105"}`}
            style={{ backgroundColor: c.value, borderColor: active ? c.value : undefined }}
            title={c.label}
            aria-label={c.label}
          >
            {active && (
              <Check
                className="absolute inset-0 m-auto h-5 w-5"
                style={{ color: isLight(c.value) ? "#000" : "#fff" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Couleurs des équipes</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Domicile · {homeName}</Label>
            <Palette value={home} onChange={setHome} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Extérieur · {awayName}</Label>
            <Palette value={away} onChange={setAway} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => { onConfirm({ home, away }); onOpenChange(false); }}>Démarrer le match</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function isLight(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160;
}
