import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { FlaskConical, Filter } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getTestCategoriesForSport } from "@/lib/constants/testCategories";

interface Props {
  playerId: string;
  categoryId: string;
  sportType?: string;
}

export function AthleteSpaceTests({ playerId, sportType }: Props) {
  const testCategories = useMemo(() => getTestCategoriesForSport(sportType || ""), [sportType]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data: genericTests = [], isLoading } = useQuery({
    queryKey: ["athlete-space-all-tests", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generic_tests")
        .select("*")
        .eq("player_id", playerId)
        .order("test_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: speedTests = [] } = useQuery({
    queryKey: ["athlete-space-speed-tests-tab", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("speed_tests")
        .select("*")
        .eq("player_id", playerId)
        .order("test_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: strengthTests = [] } = useQuery({
    queryKey: ["athlete-space-strength-tests-tab", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strength_tests")
        .select("*")
        .eq("player_id", playerId)
        .order("test_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const customIds = useMemo(() => {
    const ids = new Set<string>();
    genericTests.forEach((t: any) => {
      const type = t.test_type as string | null;
      const cat = t.test_category as string | null;
      if (type?.startsWith("custom:")) ids.add(type.slice(7));
      if (cat?.startsWith("custom:")) ids.add(cat.slice(7));
    });
    return Array.from(ids);
  }, [genericTests]);

  const { data: customTests = [] } = useQuery({
    queryKey: ["athlete-space-custom-tests-labels", customIds.sort().join(",")],
    enabled: customIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_tests")
        .select("id,name,category")
        .in("id", customIds);
      if (error) throw error;
      return data || [];
    },
  });
  const customById = useMemo(() => {
    const m = new Map<string, any>();
    customTests.forEach((c: any) => m.set(c.id, c));
    return m;
  }, [customTests]);
  const resolveLabel = (raw?: string | null) => {
    if (!raw) return "";
    if (raw.startsWith("custom:")) {
      const c = customById.get(raw.slice(7));
      return c?.name || raw.replace(/_/g, " ");
    }
    return raw.replace(/_/g, " ");
  };

  const categoriesWithData = useMemo(() => {
    const catSet = new Set<string>();
    if (speedTests.length > 0) catSet.add("__speed__");
    if (strengthTests.length > 0) catSet.add("__strength__");
    genericTests.forEach((t: any) => catSet.add(t.test_category));
    return catSet;
  }, [speedTests, strengthTests, genericTests]);

  const availableFilters = useMemo(() => {
    const filters: { value: string; label: string }[] = [];
    if (categoriesWithData.has("__speed__")) filters.push({ value: "__speed__", label: "Vitesse" });
    if (categoriesWithData.has("__strength__")) filters.push({ value: "__strength__", label: "Musculation" });
    testCategories.forEach(cat => {
      if (categoriesWithData.has(cat.value)) filters.push({ value: cat.value, label: cat.label });
    });
    return filters;
  }, [categoriesWithData, testCategories]);

  const showSpeed = selectedCategory === "all" || selectedCategory === "__speed__";
  const showStrength = selectedCategory === "all" || selectedCategory === "__strength__";

  if (isLoading) return null;

  const noData = genericTests.length === 0 && speedTests.length === 0 && strengthTests.length === 0;
  if (noData) {
    return (
      <Card className="bg-gradient-card">
        <CardContent className="py-8 text-center">
          <FlaskConical className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Aucun test enregistré pour le moment</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {availableFilters.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Filtrer l'historique</span>
          </div>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2 pb-2">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Tous
              </button>
              {availableFilters.map(f => (
                <button
                  key={f.value}
                  onClick={() => setSelectedCategory(f.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    selectedCategory === f.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* Full test history table */}
      <Card className="bg-gradient-card shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            Historique complet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 [&_th]:px-2 [&_th]:py-2 [&_td]:px-2 [&_td]:py-2 [&_th]:text-[11px] [&_th]:whitespace-nowrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead className="whitespace-nowrap">Catégorie</TableHead>
                  <TableHead className="whitespace-nowrap">Test</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Résultat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(selectedCategory === "all" || (selectedCategory !== "__speed__" && selectedCategory !== "__strength__")) &&
                  genericTests
                    .filter((t: any) => selectedCategory === "all" || t.test_category === selectedCategory)
                    .slice()
                    .reverse()
                    .slice(0, 30)
                    .map((test: any) => {
                      const cat = testCategories.find(c => c.value === test.test_category);
                      const testDef = cat?.tests.find(t => t.value === test.test_type);
                      return (
                        <TableRow key={test.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {format(new Date(test.test_date), "dd/MM/yyyy", { locale: fr })}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{cat?.label || resolveLabel(test.test_category)}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{testDef?.label || resolveLabel(test.test_type)}</TableCell>
                          <TableCell className="text-xs font-semibold text-primary text-right whitespace-nowrap">
                            {test.result_value} {test.result_unit || ""}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                {showSpeed && speedTests.slice().reverse().slice(0, 10).map((test: any) => (
                  <TableRow key={test.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(new Date(test.test_date), "dd/MM/yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">Vitesse</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">Sprint 40m</TableCell>
                    <TableCell className="text-xs font-semibold text-primary text-right whitespace-nowrap">
                      {test.time_40m_seconds}s
                    </TableCell>
                  </TableRow>
                ))}
                {showStrength && strengthTests.slice().reverse().slice(0, 10).map((test: any) => (
                  <TableRow key={test.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(new Date(test.test_date), "dd/MM/yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">Musculation</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{test.test_name}</TableCell>
                    <TableCell className="text-xs font-semibold text-primary text-right whitespace-nowrap">
                      {test.weight_kg}kg
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
