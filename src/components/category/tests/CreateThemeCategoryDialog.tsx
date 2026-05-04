import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { normalizeCustomTestType } from "./customTestCatalog";

interface CreateThemeCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
}

export function CreateThemeCategoryDialog({ open, onOpenChange, categoryId }: CreateThemeCategoryDialogProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [label, setLabel] = useState("");
  const [editingId, setEditingId] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: categoryData } = useQuery({
    queryKey: ["category-club-id", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("club_id").eq("id", categoryId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: existingThemes = [] } = useQuery({
    queryKey: ["test-theme-categories", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_theme_categories" as any)
        .select("id, label, value")
        .eq("category_id", categoryId)
        .order("label");
      if (error) throw error;
      return (data || []) as Array<{ id: string; label: string; value: string }>;
    },
    enabled: open,
  });

  // Pre-fill when selecting an existing one in edit mode
  useEffect(() => {
    if (mode === "edit" && editingId) {
      const t = existingThemes.find((x) => x.id === editingId);
      if (t) setLabel(t.label);
    }
  }, [mode, editingId, existingThemes]);

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setMode("create");
      setLabel("");
      setEditingId("");
    }
  }, [open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!categoryData?.club_id) throw new Error("Club introuvable");
      const trimmed = label.trim();
      if (!trimmed) throw new Error("Le nom de la catégorie est requis");
      const value = normalizeCustomTestType(trimmed);
      if (!value) throw new Error("Nom de catégorie invalide");

      if (mode === "edit") {
        if (!editingId) throw new Error("Sélectionnez une catégorie à modifier");
        const { error } = await supabase
          .from("test_theme_categories" as any)
          .update({ label: trimmed, value })
          .eq("id", editingId);
        if (error) {
          if (error.code === "23505") throw new Error("Cette catégorie existe déjà");
          throw error;
        }
      } else {
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
      }
    },
    onSuccess: () => {
      toast.success(mode === "edit" ? "Catégorie modifiée" : "Catégorie créée avec succès");
      queryClient.invalidateQueries({ queryKey: ["custom-test-categories", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["test-theme-categories", categoryId] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error("Aucune catégorie sélectionnée");
      const { error } = await supabase
        .from("test_theme_categories" as any)
        .delete()
        .eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Catégorie supprimée");
      queryClient.invalidateQueries({ queryKey: ["custom-test-categories", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["test-theme-categories", categoryId] });
      setConfirmDelete(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
      setConfirmDelete(false);
    },
  });

  const handleSubmit = () => {
    if (saveMutation.isPending) return;
    if (mode === "edit" && !editingId) return toast.error("Sélectionnez une catégorie à modifier");
    if (!label.trim()) return toast.error("Le nom est requis");
    saveMutation.mutate();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Créer / Modifier une catégorie de tests</DialogTitle>
            <DialogDescription>
              Une catégorie est une thématique qui regroupe plusieurs tests (ex : "Coordination", "Endurance spécifique"...).
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 py-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "create" ? "default" : "outline"}
              onClick={() => { setMode("create"); setLabel(""); setEditingId(""); }}
              className="flex-1"
            >
              Créer
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "edit" ? "default" : "outline"}
              onClick={() => { setMode("edit"); setLabel(""); setEditingId(""); }}
              className="flex-1"
              disabled={existingThemes.length === 0}
            >
              Modifier
            </Button>
          </div>

          {mode === "edit" && (
            <div className="space-y-2">
              <Label>Catégorie à modifier</Label>
              <Select value={editingId} onValueChange={setEditingId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez une catégorie..." />
                </SelectTrigger>
                <SelectContent>
                  {existingThemes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2 py-2">
            <Label>{mode === "edit" ? "Nouveau nom" : "Nom de la catégorie"}</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Coordination spécifique"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {mode === "edit" && editingId && (
              <Button
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
                className="sm:mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-1" /> Supprimer
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
              {saveMutation.isPending
                ? (mode === "edit" ? "Modification..." : "Création...")
                : (mode === "edit" ? "Modifier" : "Créer la catégorie")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette catégorie ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les tests rattachés à cette catégorie ne seront pas supprimés mais devront être reclassés.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); deleteMutation.mutate(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
