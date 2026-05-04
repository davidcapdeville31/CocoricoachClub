import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Loader2, Image as ImageIcon, Crosshair, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { HEADER_BACKGROUND_PRESETS } from "@/lib/constants/headerBackgrounds";
import { cn } from "@/lib/utils";

interface CategoryCoverUploadProps {
  categoryId: string;
  currentCoverUrl?: string | null;
  currentCoverPosition?: string | null;
  currentHeaderBackgroundUrl?: string | null;
}

export function CategoryCoverUpload({
  categoryId,
  currentCoverUrl,
  currentCoverPosition,
  currentHeaderBackgroundUrl,
}: CategoryCoverUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const [recenterOpen, setRecenterOpen] = useState(false);
  const queryClient = useQueryClient();

  const uploadCover = useMutation({
    mutationFn: async (file: File) => {
      if (!file.type.startsWith("image/")) throw new Error("Le fichier doit être une image");
      if (file.size > 5 * 1024 * 1024) throw new Error("L'image ne doit pas dépasser 5MB");

      const fileExt = file.name.split(".").pop();
      const filePath = `${categoryId}/cover.${fileExt}`;

      if (currentCoverUrl) {
        const oldPath = currentCoverUrl.split("/").slice(-2).join("/");
        await supabase.storage.from("category-covers").remove([oldPath]);
      }

      const { error: uploadError } = await supabase.storage
        .from("category-covers")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("category-covers").getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("categories")
        .update({ cover_image_url: data.publicUrl })
        .eq("id", categoryId);
      if (updateError) throw updateError;

      return data.publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category", categoryId] });
      toast.success("Logo mis à jour");
      setUploading(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erreur lors de l'upload");
      setUploading(false);
    },
  });

  const deleteCover = useMutation({
    mutationFn: async () => {
      if (!currentCoverUrl) return;
      const filePath = currentCoverUrl.split("/").slice(-2).join("/");
      await supabase.storage.from("category-covers").remove([filePath]);
      const { error } = await supabase
        .from("categories")
        .update({ cover_image_url: null })
        .eq("id", categoryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category", categoryId] });
      toast.success("Logo supprimé");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const updatePosition = useMutation({
    mutationFn: async (position: string) => {
      const { error } = await supabase
        .from("categories")
        .update({ cover_image_position: position } as any)
        .eq("id", categoryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category", categoryId] });
      toast.success("Logo recentré");
      setRecenterOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const updateBackground = useMutation({
    mutationFn: async (url: string | null) => {
      const { error } = await supabase
        .from("categories")
        .update({ header_background_url: url } as any)
        .eq("id", categoryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category", categoryId] });
      toast.success("Fond d'écran mis à jour");
      setBgOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      uploadCover.mutate(file);
    }
  };

  const currentPos = currentCoverPosition || "center";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => document.getElementById("cover-upload")?.click()}
          className="gap-2"
        >
          {uploading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Upload en cours...</>
          ) : (
            <><Upload className="h-4 w-4" /> {currentCoverUrl ? "Modifier l'image" : "Ajouter une image"}</>
          )}
        </Button>
        {currentCoverUrl && (
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setRecenterOpen(true)}
              className="h-8 w-8"
              title="Recentrer le logo"
              aria-label="Recentrer le logo"
            >
              <Crosshair className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => deleteCover.mutate()}
              disabled={deleteCover.isPending}
              className="h-8 w-8 text-destructive hover:text-destructive"
              title="Supprimer le logo"
              aria-label="Supprimer le logo"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        <input
          id="cover-upload"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={uploading}
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setBgOpen(true)}
        className="gap-2"
      >
        <ImageIcon className="h-4 w-4" /> Fond d'écran
      </Button>

      {/* Dialog: choix fond d'écran */}
      <Dialog open={bgOpen} onOpenChange={setBgOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Choisir un fond d'écran</DialogTitle>
            <DialogDescription>
              Sélectionnez un visuel adapté à la taille du bandeau. Le logo de la catégorie restera affiché par-dessus.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto p-1">
            {HEADER_BACKGROUND_PRESETS.map((preset) => {
              const isSelected =
                (preset.url === "" && !currentHeaderBackgroundUrl) ||
                (preset.url !== "" && currentHeaderBackgroundUrl === preset.url);
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => updateBackground.mutate(preset.url || null)}
                  disabled={updateBackground.isPending}
                  className={cn(
                    "relative group rounded-xl overflow-hidden border-2 transition-all",
                    isSelected
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="aspect-[4/1] w-full bg-gradient-hero">
                    {preset.url && (
                      <img
                        src={preset.url}
                        alt={preset.label}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <span className="text-xs text-white font-medium">{preset.label}</span>
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1 shadow-lg">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: recentrer le logo */}
      <Dialog open={recenterOpen} onOpenChange={setRecenterOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recentrer le logo</DialogTitle>
            <DialogDescription>
              Choisissez la portion du logo affichée dans le cercle. Idéal pour cadrer une partie précise (ex. FFBSQ).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-center">
              <div className="h-40 w-40 rounded-full overflow-hidden ring-4 ring-border bg-muted">
                {currentCoverUrl && (
                  <img
                    src={currentCoverUrl}
                    alt="Aperçu"
                    className="h-full w-full object-cover transition-all"
                    style={{ objectPosition: currentPos }}
                  />
                )}
              </div>
            </div>
            <PositionPicker
              value={currentPos}
              onChange={(pos) => updatePosition.mutate(pos)}
              disabled={updatePosition.isPending}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecenterOpen(false)}>Fermer</Button>
            <Button
              variant="outline"
              onClick={() => updatePosition.mutate("center")}
              disabled={updatePosition.isPending}
            >
              Réinitialiser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const POSITIONS: { label: string; value: string }[] = [
  { label: "↖", value: "left top" },
  { label: "↑", value: "center top" },
  { label: "↗", value: "right top" },
  { label: "←", value: "left center" },
  { label: "•", value: "center" },
  { label: "→", value: "right center" },
  { label: "↙", value: "left bottom" },
  { label: "↓", value: "center bottom" },
  { label: "↘", value: "right bottom" },
];

function PositionPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 max-w-[180px] mx-auto">
      {POSITIONS.map((p) => (
        <Button
          key={p.value}
          variant={value === p.value ? "default" : "outline"}
          size="sm"
          disabled={disabled}
          onClick={() => onChange(p.value)}
          className="h-10 text-base"
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
