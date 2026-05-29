import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Droplet, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { ALL_PATTERN_NAMES } from "@/lib/constants/bowlingOilPatterns";
import type { SimplifiedOilPattern } from "./types";

interface Props {
  value: SimplifiedOilPattern;
  onChange: (next: SimplifiedOilPattern) => void;
  categoryId: string;
}

/**
 * Sélecteur d'huilage simplifié pour le mode simplifié bowling.
 * Permet de choisir un preset et d'uploader/afficher l'image du huilage.
 */
export function SimplifiedOilPatternPicker({ value, onChange, categoryId }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [enlarged, setEnlarged] = useState(false);

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
      onChange({ ...value, image_url: data.publicUrl });
      toast.success("Image téléchargée");
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors du téléchargement");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-surface-sunken p-3">
      <div className="flex items-center gap-2">
        <Droplet className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-semibold">Huilage de la piste</span>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Pattern (optionnel)</Label>
        <Select
          value={value.preset_name || "__none__"}
          onValueChange={(v) =>
            onChange({ ...value, preset_name: v === "__none__" ? null : v })
          }
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Sélectionner un pattern" />
          </SelectTrigger>
          <SelectContent className="z-[100] max-h-72">
            <SelectItem value="__none__" className="italic">
              Libre / non défini
            </SelectItem>
            {ALL_PATTERN_NAMES.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
              onClick={() => onChange({ ...value, image_url: null })}
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
