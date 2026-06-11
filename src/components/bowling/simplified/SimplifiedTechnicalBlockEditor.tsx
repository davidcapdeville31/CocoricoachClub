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
    <div className="rounded-2xl border border-border/60 bg-surface p-4 space-y-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-emerald-500/10 p-2">
            <Wrench className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-sm font-semibold">
              Bloc Technique #{index + 1}
            </div>
            <div className="text-xs text-muted-foreground">
              {technicalThemeLabel(value)} · {value.duration_min} min
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Thématique travaillée</Label>
          <Select
            value={value.theme}
            onValueChange={(v) => set("theme", v as TechnicalThemeKey)}
          >
            <SelectTrigger className="bg-surface-sunken">
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
          <Label className="text-xs flex items-center gap-1">
            <Clock className="h-3 w-3" /> Durée (min)
          </Label>
          <Input
            type="number"
            min={1}
            step={1}
            value={value.duration_min}
            onChange={(e) => set("duration_min", Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="bg-surface-sunken"
          />
        </div>
      </div>

      {value.theme === "other" && (
        <div className="space-y-1">
          <Label className="text-xs">Précisez la thématique</Label>
          <Input
            placeholder="ex. Equilibre dynamique"
            value={value.custom_theme ?? ""}
            onChange={(e) => set("custom_theme", e.target.value)}
            className="bg-surface-sunken"
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
          <Label className="text-xs">Description du travail effectué + repères de sensations</Label>
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
          rows={4}
          placeholder="Décris précisément ce que tu as travaillé : exercices, sensations, ressenti, points clés..."
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
          className="bg-surface-sunken resize-y"
        />
        <p className="text-[11px] text-muted-foreground">
          Les statistiques retiennent uniquement le temps de travail sur la thématique sélectionnée.
        </p>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Notes du bloc (optionnel)
        </Label>
        <Textarea
          rows={3}
          placeholder="Ressentis, observations, axes à retravailler…"
          value={value.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          className="bg-surface-sunken resize-y text-sm"
        />
      </div>
    </div>
  );
}
