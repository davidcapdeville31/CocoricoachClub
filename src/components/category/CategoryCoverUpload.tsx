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
  /**
   * Si true, n'affiche QUE le bouton "Fond d'écran" (les actions logo
   * sont alors gérées via <LogoHoverActions /> overlay sur le cercle).
   */
  backgroundOnly?: boolean;
}

/**
 * Hook partagé : centralise les mutations de logo + fond d'écran.
 */
function useCoverMutations(
  categoryId: string,
  currentCoverUrl?: string | null,
) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

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
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  return { uploading, setUploading, uploadCover, deleteCover, updatePosition, updateBackground };
}

/**
 * Composant à rendre PAR-DESSUS le cercle du logo : affiche au hover
 * deux icônes (changer l'image, recentrer) sur un voile sombre.
 */
export function LogoHoverActions({
  categoryId,
  currentCoverUrl,
  currentCoverPosition,
}: {
  categoryId: string;
  currentCoverUrl?: string | null;
  currentCoverPosition?: string | null;
}) {
  const inputId = `cover-upload-${categoryId}`;
  const [recenterOpen, setRecenterOpen] = useState(false);
  const { uploading, setUploading, uploadCover, updatePosition } =
    useCoverMutations(categoryId, currentCoverUrl);

  const currentPos = currentCoverPosition || "center";

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      uploadCover.mutate(file);
    }
    e.target.value = "";
  };

  return (
    <>
      {/* Overlay hover : sombre + 2 icônes */}
      <div
        className={cn(
          "pointer-events-auto absolute inset-0 rounded-full",
          "flex items-center justify-center gap-2",
          "bg-black/0 opacity-0 hover:bg-black/55 hover:opacity-100",
          "focus-within:bg-black/55 focus-within:opacity-100",
          "transition-all duration-200 z-10",
        )}
      >
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-9 w-9 rounded-full shadow-lg"
          disabled={uploading}
          onClick={() => document.getElementById(inputId)?.click()}
          title={currentCoverUrl ? "Changer l'image" : "Ajouter une image"}
          aria-label={currentCoverUrl ? "Changer l'image" : "Ajouter une image"}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
        </Button>
        {currentCoverUrl && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-9 w-9 rounded-full shadow-lg"
            onClick={() => setRecenterOpen(true)}
            title="Recadrer le logo"
            aria-label="Recadrer le logo"
          >
            <Crosshair className="h-4 w-4" />
          </Button>
        )}
      </div>

      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
        disabled={uploading}
      />

      {/* Dialog: recentrer le logo via drag & drop */}
      <Dialog open={recenterOpen} onOpenChange={setRecenterOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recadrer le logo</DialogTitle>
            <DialogDescription>
              Maintenez le clic sur le logo et déplacez-le pour le repositionner dans le cercle.
            </DialogDescription>
          </DialogHeader>
          <DragPositionPicker
            imageUrl={currentCoverUrl ?? null}
            initialPosition={currentPos}
            onCommit={(pos) => updatePosition.mutate(pos)}
            saving={updatePosition.isPending}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecenterOpen(false)}>Fermer</Button>
            <Button
              variant="outline"
              onClick={() => updatePosition.mutate("50% 50%")}
              disabled={updatePosition.isPending}
            >
              Réinitialiser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CategoryCoverUpload({
  categoryId,
  currentCoverUrl,
  currentHeaderBackgroundUrl,
  backgroundOnly = false,
}: CategoryCoverUploadProps) {
  const [bgOpen, setBgOpen] = useState(false);
  const { deleteCover, updateBackground } = useCoverMutations(categoryId, currentCoverUrl);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBgOpen(true)}
          className="gap-2"
        >
          <ImageIcon className="h-4 w-4" /> Fond d'écran
        </Button>
        {!backgroundOnly && currentCoverUrl && (
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
        )}
      </div>

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
                  onClick={() => {
                    updateBackground.mutate(preset.url || null, {
                      onSuccess: () => setBgOpen(false),
                    });
                  }}
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
