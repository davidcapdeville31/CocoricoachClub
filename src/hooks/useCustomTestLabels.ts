import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TEST_CATEGORIES } from "@/lib/constants/testCategories";

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
        .filter((t): t is string => !!t && /^custom:/i.test(t))
        .map((t) => t.slice("custom:".length).toLowerCase()),
    ),
  );

  const key = ids.slice().sort().join(",");

  const { data } = useQuery({
    queryKey: ["custom_test_labels", key],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const direct = await supabase
        .from("custom_tests")
        .select("id, name, unit")
        .in("id", ids);

      if (!direct.error && direct.data && direct.data.length === ids.length) {
        return direct.data || [];
      }

      const rpc = await supabase.rpc("get_custom_test_labels", { _ids: ids });
      if (!rpc.error && rpc.data) {
        const rows = [...(direct.data || [])];
        const seen = new Set(rows.map((row: any) => row.id));
        (rpc.data || []).forEach((row: any) => {
          if (!seen.has(row.id)) rows.push(row);
        });
        return rows;
      }

      return direct.data || [];
    },
  });

  const map: Record<string, { name: string; unit: string | null }> = {};
  (data || []).forEach((r: any) => {
    map[`custom:${String(r.id).toLowerCase()}`] = { name: r.name, unit: r.unit };
  });
  return map;
}

export function labelizeTestType(
  testType: string,
  customMap: Record<string, { name: string; unit: string | null }>,
): string {
  if (/^custom:/i.test(testType || "")) {
    const id = testType.slice("custom:".length).toLowerCase();
    return customMap[`custom:${id}`]?.name || "Test personnalisé";
  }
  // Ancien format de saisie staff : `custom_<slug>` → on affiche le nom lisible
  if (/^custom_/i.test(testType || "")) {
    const slug = testType.slice("custom_".length);
    const known = Object.values(customMap).find(
      (v) => v?.name && v.name.toLowerCase().replace(/[\s_-]+/g, "") === slug.toLowerCase().replace(/[\s_-]+/g, ""),
    );
    return (
      known?.name ||
      slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    );
  }
  // Fallback : libellé du catalogue système (ex : "weight" → "Pesée")
  for (const category of TEST_CATEGORIES) {
    const found = category.tests.find((t) => t.value === testType);
    if (found) return found.label;
  }
  return (testType || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
