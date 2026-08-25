import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { useSeasonGuard } from "@/hooks/use-season-guard";
import { useSeasonRosterFilter } from "@/contexts/SeasonRosterFilterContext";

interface Props {
  categoryId: string;
}

export function PendingTestResultsValidation({ categoryId }: Props) {
  const qc = useQueryClient();
  const guard = useSeasonGuard(categoryId);
  const { activeSeasonStart, activeSeasonEnd } = useSeasonRosterFilter();
  const scopeKey = guard.isFiltering ? `${activeSeasonStart}_${activeSeasonEnd}` : "all";

  const { data: pending } = useQuery({
    queryKey: ["pending-test-results", categoryId, scopeKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_test_results")
        .select("id, test_category, test_type, result_value, result_unit, test_date, player_id, players(name, first_name)")
        .eq("category_id", categoryId)
        .eq("validation_status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data || [];
      if (!guard.isFiltering) return rows;
      return rows.filter((r: any) =>
        guard.isPlayerAllowed(r.player_id) && guard.isDateAllowed(r.test_date)
      );
    },
    refetchInterval: 30000,
  });

  const decide = useMutation({
    mutationFn: async ({ row, status }: { row: any; status: "validated" | "rejected" }) => {
      if (status === "validated") {
        if (!guard.assertPlayer(row.player_id)) throw new Error("blocked");
        if (!guard.assertDate(row.test_date)) throw new Error("blocked");
        const { error: insErr } = await supabase.from("generic_tests").insert({
          player_id: row.player_id,
          category_id: categoryId,
          test_date: row.test_date,
          test_category: row.test_category,
          test_type: row.test_type,
          result_value: row.result_value,
          result_unit: row.result_unit,
        });
        if (insErr) throw insErr;
      }
      const { error } = await supabase
        .from("pending_test_results")
        .update({ validation_status: status, validated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      toast.success(v.status === "validated" ? "Test validé et ajouté à l'historique" : "Test rejeté");
      qc.invalidateQueries({ queryKey: ["pending-test-results", categoryId] });
      qc.invalidateQueries({ queryKey: ["pending-test-results-count", categoryId] });
      qc.invalidateQueries({ queryKey: ["generic_tests"] });
      qc.invalidateQueries({ queryKey: ["generic-tests-evolution", categoryId] });
    },
    onError: (e: any) => {
      if (e?.message !== "blocked") toast.error(e?.message || "Erreur");
    },
  });

  if (!pending || pending.length === 0) return null;

  return (
    <Card className="border-warning/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-warning" />
          Résultats de tests à valider
          <Badge variant="outline" className="ml-2">{pending.length}</Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Résultats saisis par les athlètes en attente de validation pour intégrer l'historique des tests.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {pending.map((row: any) => {
          const p = row.players;
          const name = p ? `${p.first_name || ""} ${p.name}`.trim() : "—";
          return (
            <div key={row.id} className="flex items-center gap-2 p-2 rounded-md border bg-card text-sm">
              <FlaskConical className="h-3.5 w-3.5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate text-xs">{name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {row.test_type?.replace(/_/g, " ")} • {row.result_value} {row.result_unit || ""}
                  {row.test_date && ` • ${format(new Date(row.test_date), "d MMM", { locale: getDateLocale() })}`}
                </div>
              </div>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-success hover:text-success" title="Valider"
                onClick={() => decide.mutate({ row, status: "validated" })} disabled={decide.isPending}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" title="Rejeter"
                onClick={() => decide.mutate({ row, status: "rejected" })} disabled={decide.isPending}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
