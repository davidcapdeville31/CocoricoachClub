import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Mail, Copy, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useResendInvitation, getInvitationStatus } from "@/hooks/useResendInvitation";

interface ClubInvitationsSectionProps {
  clubId: string;
}

export function ClubInvitationsSection({ clubId }: ClubInvitationsSectionProps) {
  const queryClient = useQueryClient();
  const resendMutation = useResendInvitation();

  const { data: club } = useQuery({
    queryKey: ["club-name-for-resend", clubId],
    queryFn: async () => {
      const { data } = await supabase.from("clubs").select("name").eq("id", clubId).single();
      return data;
    },
  });

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ["club-invitations", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_invitations")
        .select("*")
        .eq("club_id", clubId)
        .in("status", ["pending", "accepted"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from("club_invitations")
        .delete()
        .eq("id", invitationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-invitations", clubId] });
      toast.success("Invitation annulée");
    },
    onError: () => {
      toast.error("Erreur lors de l'annulation");
    },
  });

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/accept-invitation?token=${token}`;
    navigator.clipboard.writeText(link);
    toast.success("Lien copié !");
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      admin: { label: "Admin", variant: "default" },
      coach: { label: "Coach", variant: "secondary" },
      viewer: { label: "Viewer", variant: "outline" },
      physio: { label: "Kiné", variant: "secondary" },
      doctor: { label: "Médecin", variant: "secondary" },
      mental_coach: { label: "Mental", variant: "secondary" },
      prepa_physique: { label: "Prépa Physique", variant: "secondary" },
      administratif: { label: "Administratif", variant: "secondary" },
    };
    const config = variants[role] || variants.viewer;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusBadge = (status: string, expiresAt?: string | null) => {
    const effectiveStatus = getInvitationStatus(status, expiresAt);
    switch (effectiveStatus) {
      case "accepted":
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Activé</Badge>;
      case "expired":
        return <Badge variant="outline" className="text-destructive border-destructive">Expiré</Badge>;
      default:
        return <Badge variant="outline" className="text-amber-600 border-amber-600">En attente</Badge>;
    }
  };

  if (isLoading) {
    return <Card className="animate-pulse h-32" />;
  }

  if (invitations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Invitations ({invitations.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Envoyée le</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((invitation: any) => {
              const effectiveStatus = getInvitationStatus(invitation.status, invitation.expires_at);
              return (
                <TableRow key={invitation.id}>
                  <TableCell className="font-medium">{invitation.email}</TableCell>
                  <TableCell>{getRoleBadge(invitation.role)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(invitation.created_at), "dd/MM/yy HH:mm", { locale: fr })}
                  </TableCell>
                  <TableCell>{getStatusBadge(invitation.status, invitation.expires_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {/* Copy link: visible only when pending */}
                      {effectiveStatus === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyInviteLink(invitation.token)}
                          title="Copier le lien"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                      {/* Resend: visible when pending or expired */}
                      {effectiveStatus !== "accepted" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => resendMutation.mutate({
                            tableName: "club_invitations",
                            invitationId: invitation.id,
                            invitationType: "collaborator",
                            clubName: club?.name,
                            role: invitation.role,
                            invalidateKeys: [["club-invitations", clubId]],
                          })}
                          disabled={resendMutation.isPending}
                          title={effectiveStatus === "expired" ? "Renvoyer (nouveau lien)" : "Renvoyer l'email"}
                        >
                          <RefreshCw className={`h-4 w-4 ${resendMutation.isPending ? "animate-spin" : ""}`} />
                        </Button>
                      )}
                      {/* Delete: only when not accepted */}
                      {effectiveStatus !== "accepted" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteInvitation.mutate(invitation.id)}
                          disabled={deleteInvitation.isPending}
                          title="Annuler"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
