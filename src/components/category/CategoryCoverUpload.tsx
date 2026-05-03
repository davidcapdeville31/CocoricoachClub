import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CategoryCoverUploadProps {
  categoryId: string;
  currentCoverUrl?: string | null;
}

export function CategoryCoverUpload({ categoryId, currentCoverUrl }: CategoryCoverUploadProps) {
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const uploadCover = useMutation({
    mutationFn: async (file: File) => {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        throw new Error("Le fichier doit être une image");
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("L'image ne doit pas dépasser 5MB");
      }

      const fileExt = file.name.split(".").pop();
      const filePath = `${categoryId}/cover.${fileExt}`;

      // Delete old file if exists
      if (currentCoverUrl) {
        const oldPath = currentCoverUrl.split("/").slice(-2).join("/");
        await supabase.storage.from("category-covers").remove([oldPath]);
      }

      // Upload new file
      const { error: uploadError } = await supabase.storage
        .from("category-covers")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from("category-covers")
        .getPublicUrl(filePath);

      // Update category with new cover URL
      const { error: updateError } = await supabase
        .from("categories")
        .update({ cover_image_url: data.publicUrl })
        .eq("id", categoryId);

      if (updateError) throw updateError;

      return data.publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category", categoryId] });
      toast.success("Image de couverture mise à jour");
      setUploading(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erreur lors de l'upload de l'image");
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
      toast.success("Image de couverture supprimée");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression de l'image");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      uploadCover.mutate(file);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => document.getElementById("cover-upload")?.click()}
        className="gap-2"
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Upload en cours...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            {currentCoverUrl ? "Modifier l'image" : "Ajouter une image"}
          </>
        )}
      </Button>
      <input
        id="cover-upload"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
      />
      {currentCoverUrl && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => deleteCover.mutate()}
          disabled={deleteCover.isPending}
          className="gap-2 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Supprimer
        </Button>
      )}
    </div>
  );
}
