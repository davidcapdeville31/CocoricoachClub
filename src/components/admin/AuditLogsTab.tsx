import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  FileText, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  User,
  Shield,
  AlertTriangle,
  Edit,
  Trash2,
  Plus,
  ArrowRightLeft
} from "lucide-react";

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

const ACTION_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  create: { label: "Création", icon: Plus, color: "bg-green-100 text-green-800" },
  update: { label: "Modification", icon: Edit, color: "bg-blue-100 text-blue-800" },
  delete: { label: "Suppression", icon: Trash2, color: "bg-red-100 text-red-800" },
  transfer: { label: "Transfert", icon: ArrowRightLeft, color: "bg-purple-100 text-purple-800" },
  approve_user: { label: "Approbation", icon: User, color: "bg-green-100 text-green-800" },
  revoke_approval: { label: "Révocation accès", icon: AlertTriangle, color: "bg-amber-100 text-amber-800" },
  grant_super_admin: { label: "Promotion admin", icon: Shield, color: "bg-indigo-100 text-indigo-800" },
  revoke_super_admin: { label: "Retrait admin", icon: Shield, color: "bg-red-100 text-red-800" },
};

const ENTITY_LABELS: Record<string, string> = {
  injury: "Blessure",
  player: "Joueur",
  user: "Utilisateur",
  club: "Club",
  category: "Catégorie",
};

const PAGE_SIZE = 20;

export function AuditLogsTab() {
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["audit-logs", page, actionFilter, entityFilter],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }
      if (entityFilter !== "all") {
        query = query.eq("entity_type", entityFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch user profiles for the logs
      const userIds = [...new Set((data || []).map(log => log.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return (data || []).map(log => ({
        ...log,
        user_email: profileMap.get(log.user_id)?.email,
        user_name: profileMap.get(log.user_id)?.full_name,
      })) as AuditLog[];
    },
  });

  const { data: totalCount = 0 } = useQuery({
    queryKey: ["audit-logs-count", actionFilter, entityFilter],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true });

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }
      if (entityFilter !== "all") {
        query = query.eq("entity_type", entityFilter);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const filteredLogs = searchTerm
    ? logs.filter(log => 
        log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase())
      )
    : logs;

  const renderActionBadge = (action: string) => {
    const config = ACTION_LABELS[action] || { label: action, icon: FileText, color: "bg-gray-100 text-gray-800" };
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Journal d'audit
        </CardTitle>
        <CardDescription>
          Historique de toutes les actions sensibles effectuées sur la plateforme
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les actions</SelectItem>
              <SelectItem value="create">Création</SelectItem>
              <SelectItem value="update">Modification</SelectItem>
              <SelectItem value="delete">Suppression</SelectItem>
              <SelectItem value="transfer">Transfert</SelectItem>
              <SelectItem value="approve_user">Approbation</SelectItem>
              <SelectItem value="revoke_approval">Révocation</SelectItem>
              <SelectItem value="grant_super_admin">Promotion admin</SelectItem>
              <SelectItem value="revoke_super_admin">Retrait admin</SelectItem>
            </SelectContent>
          </Select>

          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="injury">Blessures</SelectItem>
              <SelectItem value="player">Joueurs</SelectItem>
              <SelectItem value="user">Utilisateurs</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => refetch()}>
            Actualiser
          </Button>
        </div>

        {/* Logs table */}
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Chargement...</p>
        ) : filteredLogs.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Aucun log trouvé</p>
        ) : (
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Détails</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {log.user_name || "Inconnu"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {log.user_email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {renderActionBadge(log.action)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ENTITY_LABELS[log.entity_type] || log.entity_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <code className="text-xs bg-muted p-1 rounded block truncate">
                        {JSON.stringify(log.details)}
                      </code>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {totalCount} entrée(s) au total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {page + 1} / {Math.max(1, totalPages)}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
