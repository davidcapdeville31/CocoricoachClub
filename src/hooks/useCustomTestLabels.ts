import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves labels + units for test_types stored as `custom:<uuid>` by
 * fetching the corresponding rows in `custom_tests`.
 *
 * Returns a map keyed by `custom:<uuid>` → { name, unit }.
 */
export function useCustomTestLabels(testTypes: (string | null | undefined)[]) {
  const ids = Array.from(
    new Set(
      (testTypes || [])
        .filter((t): t is string => !!t && t.startsWith("custom:"))
        .map((t) => t.slice("custom:".length)),
    ),
  );

  const key = ids.slice().sort().join(",");

  const { data } = useQuery({
    queryKey: ["custom_test_labels", key],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_tests")
        .select("id, name, unit")
        .in("id", ids);
      if (error) throw error;
      return data || [];
    },
  });

  const map: Record<string, { name: string; unit: string | null }> = {};
  (data || []).forEach((r: any) => {
    map[`custom:${r.id}`] = { name: r.name, unit: r.unit };
  });
  return map;
}

export function labelizeTestType(
  testType: string,
  customMap: Record<string, { name: string; unit: string | null }>,
): string {
  if (testType?.startsWith("custom:")) {
    return customMap[testType]?.name || "Test personnalisé";
  }
  return (testType || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
