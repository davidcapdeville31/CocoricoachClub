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
import { getAppBaseUrl } from "@/lib/appUrl";

interface ClubInvitationsSectionProps {
  clubId: string;
}

export function ClubInvitationsSection({ clubId }: ClubInvitationsSectionProps) {
  const queryClient = useQueryClient();
  const resendMutation = useResendInvitation();

  const getDisplayStatus = (invitation: any): "pending" | "accepted" | "expired" | "incomplete" => {
    const effectiveStatus = getInvitationStatus(invitation.status, invitation.expires_at);
    if (effectiveStatus === "accepted" && !invitation._isResolvedAcceptance) {
      return "incomplete";
    }
    return effectiveStatus;
  };

  const { data: club } = useQuery({
    queryKey: ["club-name-for-resend", clubId],
    queryFn: async () => {
      const { data } = await supabase.from("clubs").select("name").eq("id", clubId).single();
      return data;
    },
  });

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ["club-invitations", clubId, "with-categories"],
    queryFn: async () => {
      const [clubRes, catsRes, clubMembersRes] = await Promise.all([
        supabase
          .from("club_invitations")
          .select("*")
          .eq("club_id", clubId)
          .in("status", ["pending", "accepted"])
          .order("created_at", { ascending: false }),
        supabase.from("categories").select("id, name").eq("club_id", clubId),
        supabase.from("club_members").select("user_id").eq("club_id", clubId),
      ]);
      if (clubRes.error) throw clubRes.error;
      if (catsRes.error) throw catsRes.error;
      if (clubMembersRes.error) throw clubMembersRes.error;

      const categories = catsRes.data || [];
      const categoryIds = categories.map((c: any) => c.id);
      const catMap = new Map(categories.map((c: any) => [c.id, c.name]));

      let categoryInvitations: any[] = [];
      let categoryMembers: any[] = [];
      if (categoryIds.length > 0) {
        const [{ data: catInvs, error: catInvErr }, { data: catMembers, error: catMembersErr }] = await Promise.all([
          supabase
            .from("category_invitations")
            .select("*")
            .in("category_id", categoryIds)
            .in("status", ["pending", "accepted"])
            .order("created_at", { ascending: false }),
          supabase
            .from("category_members")
            .select("category_id, user_id")
            .in("category_id", categoryIds),
        ]);
        if (catInvErr) throw catInvErr;
        if (catMembersErr) throw catMembersErr;
        categoryMembers = catMembers || [];
        categoryInvitations = (catInvs || []).map((inv: any) => ({
          ...inv,
          _scope: "category" as const,
          _scopeLabel: catMap.get(inv.category_id) || "Catégorie",
        }));
      }

      const memberUserIds = Array.from(
        new Set([
          ...(clubMembersRes.data || []).map((member: any) => member.user_id),
          ...categoryMembers.map((member: any) => member.user_id),
        ].filter(Boolean))
      );

      let profileEmailsByUserId = new Map<string, string>();
      if (memberUserIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", memberUserIds);

        if (profilesError) throw profilesError;

        profileEmailsByUserId = new Map(
          (profiles || [])
            .filter((profile: any) => profile.email)
            .map((profile: any) => [profile.id, String(profile.email).toLowerCase()])
        );
      }

      const activeClubEmails = new Set(
        (clubMembersRes.data || [])
          .map((member: any) => profileEmailsByUserId.get(member.user_id))
          .filter(Boolean)
      );

      const activeCategoryKeys = new Set(
        categoryMembers
          .map((member: any) => {
            const email = profileEmailsByUserId.get(member.user_id);
            return email ? `${member.category_id}:${email}` : null;
          })
          .filter(Boolean)
      );

      const clubInvitations = (clubRes.data || []).map((inv: any) => {
        const assigned: string[] = Array.isArray(inv.assigned_categories) ? inv.assigned_categories : [];
        const assignedNames = assigned
          .map((id: string) => catMap.get(id))
          .filter(Boolean) as string[];
        const isMember = activeClubEmails.has((inv.email || "").toLowerCase());
        return {
          ...inv,
          _scope: "club" as const,
          _scopeLabel:
            assignedNames.length === 0
              ? "Club entier"
              : assignedNames.length <= 2
                ? assignedNames.join(", ")
                : `${assignedNames.length} catégories`,
          _isRestrictedScope: assignedNames.length > 0,
          _isMember: isMember,
          _isResolvedAcceptance: isMember,
        };
      });

      const resolvedCategoryInvitations = categoryInvitations.map((inv: any) => ({
        ...inv,
        _isResolvedAcceptance:
          inv.status === "accepted" &&
          activeCategoryKeys.has(`${inv.category_id}:${(inv.email || "").toLowerCase()}`),
      }));

      const all = [...clubInvitations, ...resolvedCategoryInvitations];
      const acceptedKeys = new Set(
        all
          .filter((inv: any) => inv.status === "accepted" && inv._isResolvedAcceptance)
          .map((inv: any) => `${inv._scope}:${inv.category_id || ""}:${(inv.email || "").toLowerCase()}`)
      );
      return all
        .filter((inv: any) => {
          if (inv.status === "accepted") return true;
          return !acceptedKeys.has(
            `${inv._scope}:${inv.category_id || ""}:${(inv.email || "").toLowerCase()}`
          );
        })
        .sort(
          (a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    },
  });

  const deleteInvitation = useMutation({
    mutationFn: async (inv: any) => {
      const table = inv._scope === "category" ? "category_invitations" : "club_invitations";
      const { error } = await supabase.from(table).delete().eq("id", inv.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-invitations", clubId] });
      queryClient.invalidateQueries({ queryKey: ["category-invitations"] });
      toast.success("Invitation annulée");
    },
    onError: () => {
      toast.error("Erreur lors de l'annulation");
    },
  });

  const copyInviteLink = (inv: any) => {
    const suffix = inv._scope === "category" ? "&type=category" : "";
    const link = `${getAppBaseUrl()}/accept-invitation?token=${inv.token}${suffix}`;
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

  const getStatusBadge = (invitation: any) => {
    const displayStatus = getDisplayStatus(invitation);
    switch (displayStatus) {
      case "accepted":
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Activé</Badge>;
      case "incomplete":
        return <Badge variant="outline" className="text-amber-600 border-amber-600">À relancer</Badge>;
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
        {(() => {
          const renderActions = (invitation: any, displayStatus: string, isCategory: boolean) => (
            <div className="flex items-center gap-1">
              {displayStatus === "pending" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyInviteLink(invitation)}
                  title="Copier le lien"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
              {displayStatus !== "accepted" && !isCategory && (
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
                  title={displayStatus === "expired" || displayStatus === "incomplete" ? "Renvoyer (nouveau lien)" : "Renvoyer l'email"}
                >
                  <RefreshCw className={`h-4 w-4 ${resendMutation.isPending ? "animate-spin" : ""}`} />
                </Button>
              )}
              {displayStatus !== "accepted" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteInvitation.mutate(invitation)}
                  disabled={deleteInvitation.isPending}
                  title="Annuler"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          );

          return (
            <>
              {/* Vue mobile : cartes */}
              <div className="space-y-3 md:hidden">
                {invitations.map((invitation: any) => {
                  const displayStatus = getDisplayStatus(invitation);
                  const isCategory = invitation._scope === "category";
                  return (
                    <div
                      key={`m-${invitation._scope}-${invitation.id}`}
                      className="rounded-xl border p-3 space-y-2"
                    >
                      <p className="font-medium text-sm break-all">{invitation.email}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={isCategory ? "secondary" : "default"}>
                          {invitation._scopeLabel}
                        </Badge>
                        {getRoleBadge(invitation.role)}
                        {getStatusBadge(invitation)}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(invitation.created_at), "dd/MM/yy HH:mm", { locale: fr })}
                        </span>
                        {renderActions(invitation, displayStatus, isCategory)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Vue desktop : tableau */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Portée</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Envoyée le</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="w-[150px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((invitation: any) => {
                      const displayStatus = getDisplayStatus(invitation);
                      const isCategory = invitation._scope === "category";
                      return (
                        <TableRow key={`${invitation._scope}-${invitation.id}`}>
                          <TableCell className="font-medium">{invitation.email}</TableCell>
                          <TableCell>
                            <Badge variant={isCategory ? "secondary" : "default"}>
                              {invitation._scopeLabel}
                            </Badge>
                          </TableCell>
                          <TableCell>{getRoleBadge(invitation.role)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(invitation.created_at), "dd/MM/yy HH:mm", { locale: fr })}
                          </TableCell>
                          <TableCell>{getStatusBadge(invitation)}</TableCell>
                          <TableCell>{renderActions(invitation, displayStatus, isCategory)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          );
        })()}
      </CardContent>

    </Card>
  );
}
