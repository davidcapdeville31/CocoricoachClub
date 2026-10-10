import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wrench, Trash2, Clock, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SimplifiedBallPicker } from "./SimplifiedBallPicker";
import {
  TECHNICAL_THEMES,
  technicalThemeLabel,
  type SimplifiedTechnicalBlock,
  type TechnicalThemeKey,
} from "./types";

interface Props {
  value: SimplifiedTechnicalBlock;
  index: number;
  categoryId: string;
  playerId?: string;
  onChange: (next: SimplifiedTechnicalBlock) => void;
  onRemove: () => void;
}

export function SimplifiedTechnicalBlockEditor({ value, index, categoryId, playerId, onChange, onRemove }: Props) {
  const set = <K extends keyof SimplifiedTechnicalBlock>(k: K, v: SimplifiedTechnicalBlock[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_110px] gap-3 md:grid-cols-[1fr_140px]">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Thématique travaillée</Label>
          <Select
            value={value.theme}
            onValueChange={(v) => set("theme", v as TechnicalThemeKey)}
          >
            <SelectTrigger className="h-11 rounded-xl border-0 bg-bowling-canvas text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TECHNICAL_THEMES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Durée (min)
          </Label>
          <Input
            type="number"
            min={1}
            step={1}
            value={value.duration_min || ""}
            onChange={(e) => set("duration_min", e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="h-11 rounded-xl border-0 bg-bowling-canvas text-base"
          />
        </div>
      </div>

      {value.theme === "other" && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Précisez la thématique</Label>
          <Input
            placeholder="ex. Equilibre dynamique"
            value={value.custom_theme ?? ""}
            onChange={(e) => set("custom_theme", e.target.value)}
            className="h-11 rounded-xl border-0 bg-bowling-canvas text-base"
          />
        </div>
      )}

      <SimplifiedBallPicker
        playerId={playerId}
        categoryId={categoryId}
        value={value.ball_id}
        onChange={(id) => set("ball_id", id)}
      />

      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <Label className="text-sm font-semibold text-bowling-ink">Travail effectué</Label>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Aide repères de sensations">
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs bg-background/95 backdrop-blur-md text-xs leading-relaxed">
                Note ce que tu ressens pendant l'exercice : qualité du geste, fluidité, équilibre, libération du bras, timing, relâchement, contact avec la boule, fatigue… Ces repères de sensations aident à comprendre et reproduire ce qui fonctionne.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Textarea
          rows={3}
          placeholder="Exercices réalisés et consignes travaillées (ex. 3 × 10 lancers, travail de l'axe du swing)."
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
          className="min-h-[84px] rounded-xl border-0 bg-bowling-canvas resize-y text-base"
          style={{ fieldSizing: "content" } as React.CSSProperties}
        />
        <p className="text-[11px] text-muted-foreground">
          Les statistiques retiennent uniquement le temps de travail sur la thématique sélectionnée.
        </p>
      </div>

      <details>
        <summary className="cursor-pointer list-none text-sm font-medium text-muted-foreground hover:text-foreground">+ Observations (facultatif)</summary>
        <Textarea
          rows={3}
          placeholder="Sensations, ce qui a fonctionné, points à retravailler…"
          value={value.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          className="mt-2 rounded-xl border-0 bg-bowling-canvas resize-y text-sm"
        />
      </details>
    </div>
  );
}
