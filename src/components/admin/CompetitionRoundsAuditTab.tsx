import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Trash2, Plus, Edit, Target } from "lucide-react";

interface AuditRow {
  id: string;
  round_id: string | null;
  match_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  user_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
  match_label?: string;
}

export function CompetitionRoundsAuditTab() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["competition-rounds-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_rounds_audit" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const list = (data || []) as unknown as AuditRow[];
      const userIds = [...new Set(list.map((r) => r.user_id).filter(Boolean))] as string[];
      const matchIds = [...new Set(list.map((r) => r.match_id).filter(Boolean))] as string[];

      const [{ data: profiles }, { data: matches }] = await Promise.all([
        userIds.length
          ? supabase.from("profiles").select("id, full_name, email").in("id", userIds)
          : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; email: string | null }> }),
        matchIds.length
          ? supabase.from("matches").select("id, opponent, competition, match_date").in("id", matchIds)
          : Promise.resolve({ data: [] as Array<{ id: string; opponent: string | null; competition: string | null; match_date: string | null }> }),
      ]);

      const pMap = new Map(profiles?.map((p) => [p.id, p]) || []);
      const mMap = new Map(matches?.map((m) => [m.id, m]) || []);

      return list.map((r) => {
        const m = r.match_id ? mMap.get(r.match_id) : null;
        return {
          ...r,
          user_name: r.user_id ? pMap.get(r.user_id)?.full_name ?? undefined : undefined,
          user_email: r.user_id ? pMap.get(r.user_id)?.email ?? undefined : undefined,
          match_label: m ? `${m.competition || ""} — ${m.opponent || ""}`.trim() : undefined,
        };
      });
    },
  });

  const renderAction = (a: AuditRow["action"]) => {
    if (a === "INSERT") return <Badge className="bg-green-100 text-green-800 gap-1"><Plus className="h-3 w-3" />Création</Badge>;
    if (a === "UPDATE") return <Badge className="bg-blue-100 text-blue-800 gap-1"><Edit className="h-3 w-3" />Modification</Badge>;
    return <Badge className="bg-red-100 text-red-800 gap-1"><Trash2 className="h-3 w-3" />Suppression</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Historique des Parties de Compétition
        </CardTitle>
        <CardDescription>
          Trace de toutes les créations, modifications et suppressions de parties (200 dernières actions).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Chargement...</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Aucune action enregistrée pour le moment. Le suivi est actif depuis aujourd'hui.
          </p>
        ) : (
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Compétition</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Partie #</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const data = r.new_data || r.old_data || {};
                  const roundNumber = (data as { round_number?: number }).round_number;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(r.created_at), "dd/MM/yy HH:mm:ss", { locale: fr })}
                      </TableCell>
                      <TableCell>{renderAction(r.action)}</TableCell>
                      <TableCell className="max-w-[260px] truncate text-sm">
                        {r.match_label || <span className="text-muted-foreground italic">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{r.user_name || "Inconnu"}</span>
                          <span className="text-xs text-muted-foreground">{r.user_email || r.user_id || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{roundNumber ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
