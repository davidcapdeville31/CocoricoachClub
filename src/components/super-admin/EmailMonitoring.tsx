import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mail, CheckCircle2, XCircle, Ban, RefreshCw, Search } from "lucide-react";

type Row = {
  id: string;
  message_id: string | null;
  template_name: string | null;
  recipient_email: string | null;
  status: string | null;
  error_message: string | null;
  created_at: string;
};

const RANGES = [
  { value: "24h", label: "24h", hours: 24 },
  { value: "7d", label: "7 jours", hours: 24 * 7 },
  { value: "30d", label: "30 jours", hours: 24 * 30 },
];

const statusVariant = (s: string | null) => {
  switch (s) {
    case "sent":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    case "dlq":
    case "failed":
    case "bounced":
    case "complained":
      return "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30";
    case "suppressed":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    case "pending":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

export function EmailMonitoring() {
  const [range, setRange] = useState("7d");
  const [template, setTemplate] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const sinceISO = useMemo(() => {
    const hours = RANGES.find((r) => r.value === range)?.hours ?? 168;
    return new Date(Date.now() - hours * 3600 * 1000).toISOString();
  }, [range]);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["email-monitoring", range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_send_log")
        .select("id,message_id,template_name,recipient_email,status,error_message,created_at")
        .gte("created_at", sinceISO)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data as Row[];
    },
    refetchInterval: 30000,
  });

  const dedup = useMemo(() => {
    const map = new Map<string, Row>();
    for (const r of data ?? []) {
      const key = r.message_id ?? r.id;
      if (!map.has(key)) map.set(key, r);
    }
    return Array.from(map.values());
  }, [data]);

  const templates = useMemo(() => {
    const set = new Set<string>();
    dedup.forEach((r) => r.template_name && set.add(r.template_name));
    return Array.from(set).sort();
  }, [dedup]);

  const filtered = useMemo(() => {
    return dedup.filter((r) => {
      if (template !== "all" && r.template_name !== template) return false;
      if (status !== "all" && r.status !== status) return false;
      if (search && !(r.recipient_email ?? "").toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [dedup, template, status, search]);

  const stats = useMemo(() => {
    const s = { total: filtered.length, sent: 0, failed: 0, suppressed: 0, pending: 0 };
    for (const r of filtered) {
      if (r.status === "sent") s.sent++;
      else if (["dlq", "failed", "bounced", "complained"].includes(r.status ?? "")) s.failed++;
      else if (r.status === "suppressed") s.suppressed++;
      else if (r.status === "pending") s.pending++;
    }
    return s;
  }, [filtered]);

  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Mail className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Suivi des emails</h2>
            <p className="text-sm text-muted-foreground">
              Statut des envois (invitations, auth, transactionnels)
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Rafraîchir
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3 items-center">
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <Button
                key={r.value}
                size="sm"
                variant={range === r.value ? "default" : "outline"}
                onClick={() => {
                  setRange(r.value);
                  setPage(0);
                }}
              >
                {r.label}
              </Button>
            ))}
          </div>

          <Select value={template} onValueChange={(v) => { setTemplate(v); setPage(0); }}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Type d'email" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="sent">Envoyé</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="dlq">Échec</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="bounced">Bounced</SelectItem>
              <SelectItem value="suppressed">Supprimé</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un destinataire..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total" value={stats.total} icon={<Mail className="h-4 w-4" />} />
        <StatCard label="Envoyés" value={stats.sent} icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} />
        <StatCard label="Échecs" value={stats.failed} icon={<XCircle className="h-4 w-4 text-red-500" />} />
        <StatCard label="Supprimés" value={stats.suppressed} icon={<Ban className="h-4 w-4 text-amber-500" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Journal des envois</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-8 text-center">Chargement...</p>
          ) : paginated.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">Aucun email pour ces filtres</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead>
                      <TableHead>Destinataire</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Erreur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.template_name ?? "—"}</TableCell>
                        <TableCell className="text-sm">{r.recipient_email ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusVariant(r.status)}>
                            {r.status ?? "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(r.created_at).toLocaleString("fr-FR")}
                        </TableCell>
                        <TableCell className="text-xs text-red-600 dark:text-red-400 max-w-[280px] truncate" title={r.error_message ?? ""}>
                          {r.error_message ?? ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between pt-4">
                <p className="text-xs text-muted-foreground">
                  {filtered.length} email(s) — page {page + 1}/{totalPages}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    Précédent
                  </Button>
                  <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Suivant
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          {icon}
        </div>
        <p className="text-3xl font-bold mt-2">{value}</p>
      </CardContent>
    </Card>
  );
}
