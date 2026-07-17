import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustomTestInfo {
  id: string;
  name: string;
  unit: string | null;
  test_category: string | null;
}

/**
 * Retourne un mapping `custom:<uuid>` -> { name, unit, test_category }
 * pour tous les tests personnalisés visibles (club courant).
 * Utile pour afficher un nom lisible partout où seul le test_type
 * (`custom:<uuid>`) est stocké.
 */
export function useCustomTestsMap() {
  const { data = {}, isLoading } = useQuery({
    queryKey: ["custom-tests-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_tests")
        .select("id, name, unit, test_category");
      if (error) throw error;
      const map: Record<string, CustomTestInfo> = {};
      for (const t of data || []) {
        map[`custom:${t.id}`] = {
          id: t.id,
          name: t.name,
          unit: t.unit ?? null,
          test_category: t.test_category ?? null,
        };
      }
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  const resolveLabel = (testType: string | null | undefined, fallback?: string) => {
    if (!testType) return fallback || "";
    if (testType.startsWith("custom:")) {
      return data[testType]?.name || fallback || testType;
    }
    return fallback || testType;
  };

  return { map: data, resolveLabel, isLoading };
}
