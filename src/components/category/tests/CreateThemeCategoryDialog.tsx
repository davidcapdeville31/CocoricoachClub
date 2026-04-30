import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { normalizeCustomTestType } from "./customTestCatalog";

interface CreateThemeCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
}

export function CreateThemeCategoryDialog({ open, onOpenChange, categoryId }: CreateThemeCategoryDialogProps) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");

  const { data: categoryData } = useQuery({
    queryKey: ["category-club-id", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("club_id").eq("id", categoryId).single();
      if (error) throw error;
      return data;
    },
  });

  const createCategory = useMutation({
    mutationFn: async () => {
      if (!categoryData?.club_id) throw new Error("Club introuvable");
      const trimmed = label.trim();
      if (!trimmed) throw new Error("Le nom de la catégorie est requis");
      const value = normalizeCustomTestType(trimmed);
      if (!value) throw new Error("Nom de catégorie invalide");

      const { data: user } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("test_theme_categories" as any)
        .insert({
          category_id: categoryId,
          club_id: categoryData.club_id,
          value,
          label: trimmed,
          created_by: user?.user?.id || null,
        });

      if (error) {
        if (error.code === "23505") throw new Error("Cette catégorie existe déjà");
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Catégorie créée avec succès");
      queryClient.invalidateQueries({ queryKey: ["custom-test-categories", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["test-theme-categories", categoryId] });
      setLabel("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  const handleSubmit = () => {
    if (createCategory.isPending) return;
    if (!label.trim()) return toast.error("Le nom est requis");
    createCategory.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Créer une catégorie de tests</DialogTitle>
          <DialogDescription>
            Une catégorie est une thématique qui regroupe plusieurs tests (ex : "Coordination", "Endurance spécifique"...).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label>Nom de la catégorie</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: Coordination spécifique"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit}>
            {createCategory.isPending ? "Création..." : "Créer la catégorie"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
