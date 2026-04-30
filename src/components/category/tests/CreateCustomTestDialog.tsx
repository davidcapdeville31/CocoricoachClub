import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getTestCategoriesForSport } from "@/lib/constants/testCategories";
import { formatCategoryLabel, normalizeCustomTestType } from "./customTestCatalog";

interface CreateCustomTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  sportType?: string;
}

export function CreateCustomTestDialog({ open, onOpenChange, categoryId, sportType }: CreateCustomTestDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [categoryMode, setCategoryMode] = useState<"existing" | "new">("existing");
  const [testCategory, setTestCategory] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [unit, setUnit] = useState("");
  const [isTime, setIsTime] = useState(false);
  const [description, setDescription] = useState("");

  const baseTestCategories = useMemo(() => {
    return getTestCategoriesForSport(sportType || "").filter(c => !c.value.startsWith("rehab_"));
  }, [sportType]);

  const { data: existingCustomCategories } = useQuery({
    queryKey: ["custom-test-categories", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_test_categories")
        .select("custom_tests(test_category)")
        .eq("category_id", categoryId);

      if (error) throw error;

      return Array.from(
        new Set(
          (data || [])
            .map((row: any) => row.custom_tests?.test_category)
            .filter((value): value is string => Boolean(value))
        )
      );
    },
    enabled: open,
  });

  const testCategories = useMemo(() => {
    const categoryMap = new Map(baseTestCategories.map((category) => [category.value, category.label]));

    (existingCustomCategories || []).forEach((categoryValue) => {
      if (!categoryMap.has(categoryValue)) {
        categoryMap.set(categoryValue, formatCategoryLabel(categoryValue));
      }
    });

    return Array.from(categoryMap.entries()).map(([value, label]) => ({ value, label }));
  }, [baseTestCategories, existingCustomCategories]);

  // Get club_id from category
  const { data: categoryData } = useQuery({
    queryKey: ["category-club-id", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("club_id")
        .eq("id", categoryId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const createTest = useMutation({
    mutationFn: async () => {
      if (!categoryData?.club_id) throw new Error("Club introuvable");
      const trimmedName = name.trim();
      const trimmedDescription = description.trim();
      const finalCategory = categoryMode === "new" ? normalizeCustomTestType(newCategoryName) : testCategory;

      if (!trimmedName) throw new Error("Le nom du test est requis");
      if (!finalCategory) throw new Error("La catégorie du test est requise");

      if (categoryMode === "new") {
        const existingCategoryValues = new Set(testCategories.map((category) => category.value));
        if (existingCategoryValues.has(finalCategory)) {
          throw new Error("Cette catégorie existe déjà. Sélectionnez-la dans la liste.");
        }
      }
      
      const { data: user } = await supabase.auth.getUser();
      
      // Create the custom test
      const { data: customTest, error: testError } = await supabase
        .from("custom_tests")
        .insert({
          club_id: categoryData.club_id,
          name: trimmedName,
          test_category: finalCategory,
          unit: unit || null,
          is_time: isTime,
          description: trimmedDescription || null,
          created_by: user?.user?.id || null,
        })
        .select("id")
        .single();
      
      if (testError) throw testError;

      // Link to this category
      const { error: linkError } = await supabase
        .from("custom_test_categories")
        .insert({
          custom_test_id: customTest.id,
          category_id: categoryId,
        });
      
      if (linkError) throw linkError;
    },
    onSuccess: () => {
      toast.success("Test personnalisé créé avec succès");
      queryClient.invalidateQueries({ queryKey: ["custom-test-categories", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["generic_tests_discovery", categoryId] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Erreur lors de la création: " + error.message);
    },
  });

  const resetForm = () => {
    setName("");
    setCategoryMode("existing");
    setTestCategory("");
    setNewCategoryName("");
    setUnit("");
    setIsTime(false);
    setDescription("");
  };

  const handleSubmit = () => {
    if (createTest.isPending) return;

    if (!name.trim()) {
      toast.error("Le nom du test est requis");
      return;
    }

    if (categoryMode === "existing" && !testCategory) {
      toast.error("Choisissez une catégorie de test");
      return;
    }

    if (categoryMode === "new" && !newCategoryName.trim()) {
      toast.error("Saisissez le nom de la nouvelle catégorie");
      return;
    }

    createTest.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Créer un test personnalisé</DialogTitle>
          <DialogDescription>
            Ajoutez un nouveau test dans une catégorie existante.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Catégorie</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={categoryMode === "existing" ? "default" : "outline"}
                onClick={() => {
                  setCategoryMode("existing");
                  setNewCategoryName("");
                }}
              >
                Catégorie existante
              </Button>
              <Button
                type="button"
                size="sm"
                variant={categoryMode === "new" ? "default" : "outline"}
                onClick={() => {
                  setCategoryMode("new");
                  setTestCategory("");
                }}
              >
                Nouvelle catégorie
              </Button>
            </div>

            {categoryMode === "existing" ? (
              <Select value={testCategory} onValueChange={setTestCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une catégorie..." />
                </SelectTrigger>
                <SelectContent>
                  {testCategories.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder="Ex: Coordination spécifique bowling"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Nom du test</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Test de détente verticale"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Unité de mesure</Label>
              <Input
                value={unit}
                onChange={e => setUnit(e.target.value)}
                placeholder="Ex: cm, kg, s"
              />
            </div>
            <div className="space-y-1.5 flex flex-col justify-end">
              <div className="flex items-center gap-2 h-10">
                <Switch checked={isTime} onCheckedChange={setIsTime} />
                <Label className="text-sm">Chronométré</Label>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description (optionnel)</Label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Description du test..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit}>
            {createTest.isPending ? "Création..." : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
