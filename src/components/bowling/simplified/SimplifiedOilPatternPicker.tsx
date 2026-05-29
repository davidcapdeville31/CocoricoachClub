import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Droplet, Image as ImageIcon, X, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import {
  ALL_PATTERN_NAMES,
  getPatternPreset,
  PROFILE_TYPES,
  FRICTION_LEVELS,
  OIL_RATIOS,
  getOilCategory,
} from "@/lib/constants/bowlingOilPatterns";
import type { SimplifiedOilPattern } from "./types";

interface Props {
  value: SimplifiedOilPattern;
  onChange: (next: SimplifiedOilPattern) => void;
  categoryId: string;
}

/**
 * Picker huilage du mode simplifié — aligné sur l'éditeur Compétitions.
 * Champs complets + auto-catégorisation Sportif/Challenge/Récréation via le ratio latéral.
 */
export function SimplifiedOilPatternPicker({ value, onChange, categoryId }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const hasData =
    !!value.preset_name ||
    !!value.image_url ||
    value.length_feet != null ||
    value.buff_distance_feet != null ||
    value.width_boards != null ||
    value.total_volume_ml != null ||
    !!value.oil_ratio ||
    !!value.profile_type ||
    !!value.outside_friction;
  const [collapsed, setCollapsed] = useState(hasData);

  const patch = (p: Partial<SimplifiedOilPattern>) => onChange({ ...value, ...p });

  const handlePresetSelect = (name: string) => {
    if (name === "__none__") {
      patch({ preset_name: null });
      return;
    }
    const preset = getPatternPreset(name);
    if (preset) {
      patch({
        preset_name: name,
        length_feet: preset.length_feet ?? value.length_feet,
        buff_distance_feet: preset.buff_distance_feet ?? value.buff_distance_feet,
        width_boards: preset.width_boards ?? value.width_boards,
        total_volume_ml: preset.total_volume_ml ?? value.total_volume_ml,
        oil_ratio: preset.oil_ratio ?? value.oil_ratio,
        profile_type: preset.profile_type ?? value.profile_type,
        forward_oil: preset.forward_oil ?? value.forward_oil,
        reverse_oil: preset.reverse_oil ?? value.reverse_oil,
        outside_friction: preset.outside_friction ?? value.outside_friction,
      });
      toast.info(`Données officielles chargées pour ${name}`);
    } else {
      patch({ preset_name: name });
    }
  };

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `oil-patterns-simplified/${categoryId}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("exercise-images")
        .upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("exercise-images").getPublicUrl(path);
      patch({ image_url: data.publicUrl });
      toast.success("Image téléchargée");
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors du téléchargement");
    } finally {
      setUploading(false);
    }
  };

  const numOrNull = (s: string): number | null => {
    if (s.trim() === "") return null;
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const category = getOilCategory(value.oil_ratio);

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-surface-sunken p-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <Droplet className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold">Huilage de la piste</span>
          {collapsed && (value.preset_name || value.length_feet != null) && (
            <span className="truncate text-xs text-muted-foreground">
              · {value.preset_name || "Libre"}
              {value.length_feet != null ? ` · ${value.length_feet}ft` : ""}
              {value.total_volume_ml != null ? ` · ${value.total_volume_ml}mL` : ""}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2">
          {category && (
            <Badge variant="outline" className={category.color}>
              {category.label}
            </Badge>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {!collapsed && (
        <>
      {/* Pattern preset */}
      <div className="space-y-1">
        <Label className="text-xs">Pattern (optionnel)</Label>
        <Select
          value={value.preset_name || "__none__"}
          onValueChange={handlePresetSelect}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Sélectionner un pattern" />
          </SelectTrigger>
          </SelectTrigger>
          <SelectContent className="z-[100] max-h-72">
            <SelectItem value="__none__" className="italic">
              Libre / non défini
            </SelectItem>
            <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
              PBA officiels
            </div>
            {ALL_PATTERN_NAMES.filter((n) => n.startsWith("PBA")).map((name) => (
              <SelectItem key={name} value={name}>
                {name}
                {getPatternPreset(name) && (
                  <span className="ml-2 text-xs text-emerald-600">✓</span>
                )}
              </SelectItem>
            ))}
            <div className="border-t mt-1 pt-1 px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
              Autres
            </div>
            {ALL_PATTERN_NAMES.filter((n) => !n.startsWith("PBA")).map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Image */}
      <div className="space-y-1">
        <Label className="text-xs">Image du huilage</Label>
        {value.image_url ? (
          <div className="relative inline-block" style={{ maxWidth: 200 }}>
            <img
              src={value.image_url}
              alt="Huilage"
              className="w-full cursor-pointer rounded-lg border hover:opacity-90"
              style={{ aspectRatio: "4/5" }}
              onClick={() => setEnlarged(true)}
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute right-1 top-1 h-6 w-6"
              onClick={() => patch({ image_url: null })}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="gap-2"
            >
              <ImageIcon className="h-4 w-4" />
              {uploading ? "Téléchargement..." : "Ajouter une image"}
            </Button>
          </div>
        )}
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Longueur (feet)</Label>
          <Input
            type="number"
            step="0.1"
            placeholder="ex. 42"
            value={value.length_feet ?? ""}
            onChange={(e) => patch({ length_feet: numOrNull(e.target.value) })}
            className="h-8 text-sm bg-background"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Distance de buff (feet)</Label>
          <Input
            type="number"
            step="0.1"
            placeholder="ex. 3"
            value={value.buff_distance_feet ?? ""}
            onChange={(e) =>
              patch({ buff_distance_feet: numOrNull(e.target.value) })
            }
            className="h-8 text-sm bg-background"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Largeur (boards)</Label>
          <Input
            type="number"
            step="1"
            placeholder="ex. 39"
            value={value.width_boards ?? ""}
            onChange={(e) => patch({ width_boards: numOrNull(e.target.value) })}
            className="h-8 text-sm bg-background"
          />
        </div>
      </div>

      {/* Volume / Ratio / Profile */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Volume total (mL)</Label>
          <Input
            type="number"
            step="0.1"
            placeholder="ex. 25"
            value={value.total_volume_ml ?? ""}
            onChange={(e) =>
              patch({ total_volume_ml: numOrNull(e.target.value) })
            }
            className="h-8 text-sm bg-background"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ratio latéral d'huile</Label>
          <Select
            value={value.oil_ratio || "__none__"}
            onValueChange={(v) =>
              patch({ oil_ratio: v === "__none__" ? null : v })
            }
          >
            <SelectTrigger className="h-8 text-sm bg-background">
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent className="z-[100]">
              <SelectItem value="__none__" className="italic">Non défini</SelectItem>
              {OIL_RATIOS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Type de profil</Label>
          <Select
            value={value.profile_type || "__none__"}
            onValueChange={(v) =>
              patch({
                profile_type:
                  v === "__none__" ? null : (v as SimplifiedOilPattern["profile_type"]),
              })
            }
          >
            <SelectTrigger className="h-8 text-sm bg-background">
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent className="z-[100]">
              <SelectItem value="__none__" className="italic">Non défini</SelectItem>
              {PROFILE_TYPES.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {category && (
        <div className={`rounded-lg border p-2 text-xs ${category.color}`}>
          <div className="font-semibold">{category.description}</div>
          <div className="opacity-80">{category.detail}</div>
        </div>
      )}

      {/* Friction + Forward/Reverse */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Friction extérieure</Label>
          <Select
            value={value.outside_friction || "__none__"}
            onValueChange={(v) =>
              patch({
                outside_friction:
                  v === "__none__"
                    ? null
                    : (v as SimplifiedOilPattern["outside_friction"]),
              })
            }
          >
            <SelectTrigger className="h-8 text-sm bg-background">
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent className="z-[100]">
              <SelectItem value="__none__" className="italic">Non défini</SelectItem>
              {FRICTION_LEVELS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between rounded-lg border bg-background px-2 py-1.5">
          <Label className="text-xs cursor-pointer">Forward</Label>
          <Switch
            checked={value.forward_oil}
            onCheckedChange={(b) => patch({ forward_oil: b })}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border bg-background px-2 py-1.5">
          <Label className="text-xs cursor-pointer">Reverse</Label>
          <Switch
            checked={value.reverse_oil}
            onCheckedChange={(b) => patch({ reverse_oil: b })}
          />
        </div>
      </div>

      {enlarged && value.image_url && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setEnlarged(false)}
        >
          <img src={value.image_url} alt="Huilage" className="max-h-[90vh] max-w-[90vw] rounded-lg" />
        </div>
      )}
    </div>
  );
}
