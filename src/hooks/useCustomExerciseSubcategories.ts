import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export interface CustomExerciseSubcategory {
  id: string;
  category_id: string;
  exercise_category: string;
  name: string;
}

/** Sous-catégories d'exercices créées par le staff, visibles uniquement dans la catégorie (équipe) courante. */
export function useCustomExerciseSubcategories(categoryIdProp?: string) {
  const params = useParams<{ categoryId?: string }>();
  const categoryId = categoryIdProp || params.categoryId;
  const query = useQuery({
    queryKey: ["exercise-custom-subcategories", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_custom_subcategories" as any)
        .select("id, category_id, exercise_category, name")
        .eq("category_id", categoryId!)
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as CustomExerciseSubcategory[];
    },
  });
  return { categoryId, subcategories: query.data || [] };
}
