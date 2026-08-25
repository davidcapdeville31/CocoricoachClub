import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Trash2, Info, Send, Copy, Link2, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getAppBaseUrl } from "@/lib/appUrl";
import { Trans, useTranslation } from "react-i18next";
import i18n from "@/i18n";

interface CategoryCollaborationTabProps {
  categoryId: string;
}

// Rôles disponibles alignés avec Super Admin / Admin Club
const getAvailableRoles = () => [
  { value: "admin", label: i18n.t("adminStaff.roles.admin.label"), description: i18n.t("adminStaff.roles.admin.description"), variant: "default" as const },
  { value: "coach", label: i18n.t("adminStaff.roles.coach.label"), description: i18n.t("adminStaff.roles.coach.description"), variant: "secondary" as const },
  { value: "prepa_physique", label: i18n.t("adminStaff.roles.prepa_physique.label"), description: i18n.t("adminStaff.roles.prepa_physique.description"), variant: "secondary" as const },
  { value: "doctor", label: i18n.t("adminStaff.roles.doctor.label"), description: i18n.t("adminStaff.roles.doctor.description"), variant: "secondary" as const },
  { value: "physio", label: i18n.t("adminStaff.roles.physio.label"), description: i18n.t("adminStaff.roles.physio.description"), variant: "secondary" as const },
  { value: "mental_coach", label: i18n.t("adminStaff.roles.mental_coach.label"), description: i18n.t("adminStaff.roles.mental_coach.description"), variant: "secondary" as const },
  { value: "administratif", label: i18n.t("adminStaff.roles.administratif.label"), description: i18n.t("adminStaff.roles.administratif.description"), variant: "secondary" as const },
  { value: "athlete", label: i18n.t("adminStaff.roles.athlete.label"), description: i18n.t("adminStaff.roles.athlete.description"), variant: "secondary" as const },
  { value: "viewer", label: i18n.t("adminStaff.roles.viewer.label"), description: i18n.t("adminStaff.roles.viewer.description"), variant: "outline" as const },
];

export function CategoryCollaborationTab({ categoryId }: CategoryCollaborationTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const AVAILABLE_ROLES = getAvailableRoles();

  const { data: category, isLoading: categoryLoading } = useQuery({
    queryKey: ["category", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*, clubs(*)")
        .eq("id", categoryId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["category-members", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("category_members")
        .select("*")
        .eq("category_id", categoryId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      const membersWithProfiles = await Promise.all(
        data.map(async (member: any) => {
          const { data: profileData } = await supabase
            .rpc("get_safe_profile", { profile_id: member.user_id });
          const profile = profileData?.[0] || null;
          
          let displayName = profile?.full_name;
          if (!displayName) {
            const { data: playerData } = await supabase
              .from("players")
              .select("name, first_name")
              .eq("user_id", member.user_id)
              .maybeSingle();
            if (playerData) {
              displayName = [playerData.first_name, playerData.name].filter(Boolean).join(" ");
            }
          }
          
          return {
            ...member,
            profile: profile ? { ...profile, full_name: displayName || profile?.email || "Utilisateur" } : null,
          };
        })
      );
      
      return membersWithProfiles;
    },
  });

  // Fetch existing invitations for this category to get tokens
  const { data: invitations } = useQuery({
    queryKey: ["category-invitations", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("category_invitations")
        .select("*")
        .eq("category_id", categoryId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Also fetch athlete invitations
  const { data: athleteInvitations } = useQuery({
    queryKey: ["athlete-invitations", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("athlete_invitations")
        .select("*")
        .eq("category_id", categoryId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clubMembers, isLoading: clubMembersLoading } = useQuery({
    queryKey: ["club-members-for-category", categoryId],
    queryFn: async () => {
      if (!category) return [];
      const { data, error } = await supabase
        .from("club_members")
        .select("*")
        .eq("club_id", (category as any).club_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      const membersWithProfiles = await Promise.all(
        data.map(async (member: any) => {
          const { data: profileData } = await supabase
            .rpc("get_safe_profile", { profile_id: member.user_id });
          const profile = profileData?.[0] || null;
          
          let displayName = profile?.full_name;
          if (!displayName) {
            const { data: playerData } = await supabase
              .from("players")
              .select("name, first_name")
              .eq("user_id", member.user_id)
              .maybeSingle();
            if (playerData) {
              displayName = [playerData.first_name, playerData.name].filter(Boolean).join(" ");
            }
          }
          
          return {
            ...member,
            profile: profile ? { ...profile, full_name: displayName || profile?.email || "Utilisateur" } : null,
          };
        })
      );
      
      return membersWithProfiles.filter((m: any) => {
        if (!m.assigned_categories || m.assigned_categories.length === 0) return true;
        return m.assigned_categories.includes(categoryId);
      });
    },
    enabled: !!category,
  });

  // Also fetch club-level invitations
  const { data: clubInvitations } = useQuery({
    queryKey: ["club-invitations-for-category", category?.club_id],
    queryFn: async () => {
      if (!category) return [];
      const { data, error } = await supabase
        .from("club_invitations")
        .select("*")
        .eq("club_id", (category as any).club_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!category,
  });

  const { data: canManage } = useQuery({
    queryKey: ["can-manage-category", categoryId],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user || !category) return false;
      if ((category as any).clubs?.user_id === user.user.id) return true;
      const { data: memberRole } = await supabase
        .from("club_members")
        .select("role")
        .eq("club_id", (category as any).club_id)
        .eq("user_id", user.user.id)
        .maybeSingle();
      return memberRole?.role === "admin";
    },
    enabled: !!category,
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("category_members")
        .delete()
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-members", categoryId] });
      toast.success(t("adminStaff.collaboration.toasts.memberRemoved"));
    },
    onError: () => {
      toast.error(t("adminStaff.collaboration.toasts.removeError"));
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, newRole }: { memberId: string; newRole: string }) => {
      const { error } = await supabase
        .from("category_members")
        .update({ role: newRole as any })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-members", categoryId] });
      toast.success(t("adminStaff.collaboration.toasts.roleUpdated"));
    },
    onError: () => {
      toast.error(t("adminStaff.collaboration.toasts.roleUpdateError"));
    },
  });

  const renewInvitationMutation = useMutation({
    mutationFn: async ({ tableName, invitationId }: { tableName: string; invitationId: string }) => {
      const { data, error } = await supabase.rpc("renew_invitation", {
        _table_name: tableName,
        _invitation_id: invitationId,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      if (data?.success) {
        queryClient.invalidateQueries({ queryKey: ["category-invitations", categoryId] });
        queryClient.invalidateQueries({ queryKey: ["club-invitations-for-category"] });
        toast.success(t("adminStaff.collaboration.toasts.invitationResent"));
      } else {
        toast.error(data?.error || t("adminStaff.collaboration.toasts.resendGenericError"));
      }
    },
    onError: () => {
      toast.error(t("adminStaff.collaboration.toasts.resendError"));
    },
  });

  const createInvitationMutation = useMutation({
    mutationFn: async ({ email, role, isClubMember }: { email: string; role: string; isClubMember: boolean }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");
      
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

      if (isClubMember) {
        const { error } = await supabase.from("club_invitations").insert({
          club_id: (category as any).club_id,
          email,
          role: role as any,
          invited_by: user.user.id,
          token,
          expires_at: expiresAt,
          status: "pending",
        });
        if (error) throw error;
        return { token, type: "club_invitations" };
      } else {
        const { error } = await supabase.from("category_invitations").insert({
          category_id: categoryId,
          email,
          role: role as any,
          invited_by: user.user.id,
          token,
          expires_at: expiresAt,
          status: "pending",
        });
        if (error) throw error;
        return { token, type: "category_invitations" };
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["category-invitations", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["club-invitations-for-category"] });
      const link = getInvitationLink(data.token, data.type);
      navigator.clipboard.writeText(link);
      toast.success(t("adminStaff.collaboration.toasts.invitationCreatedCopied"));
    },
    onError: () => {
      toast.error(t("adminStaff.collaboration.toasts.invitationCreateError"));
    },
  });

  const getRoleConfig = (role: string) => {
    return AVAILABLE_ROLES.find(r => r.value === role) || { 
      value: role, label: role, description: "", variant: "outline" as const 
    };
  };


  const getRoleBadge = (role: string) => {
    const config = getRoleConfig(role);
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Find invitation for a member by email
  const getInvitationForMember = (memberEmail: string | null | undefined, isClubMember: boolean): { invitation: any; type: string } | null => {
    if (!memberEmail) return null;
    
    if (isClubMember) {
      const clubInv = clubInvitations?.find((inv: any) => inv.email === memberEmail);
      if (clubInv) return { invitation: clubInv, type: "club_invitations" };
      return null;
    }
    
    // Check category invitations
    const catInv = invitations?.find((inv: any) => inv.email === memberEmail);
    if (catInv) return { invitation: catInv, type: "category_invitations" };
    
    // Check athlete invitations
    const athInv = athleteInvitations?.find((inv: any) => inv.email === memberEmail);
    if (athInv) return { invitation: athInv, type: "athlete_invitations" };
    
    return null;
  };

  const getInvitationLink = (token: string, type: string) => {
    if (type === "athlete_invitations") {
      return `${getAppBaseUrl()}/accept-athlete-invitation?token=${token}`;
    }
    const isCategory = type === "category_invitations";
    return `${getAppBaseUrl()}/accept-invitation?token=${token}${isCategory ? "&type=category" : ""}`;
  };

  const handleCopyLink = async (token: string, type: string, memberId: string) => {
    const link = getInvitationLink(token, type);
    await navigator.clipboard.writeText(link);
    setCopiedId(memberId);
    toast.success(t("adminStaff.collaboration.toasts.linkCopied"));
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResendInvitation = (invitationId: string, tableName: string) => {
    renewInvitationMutation.mutate({ tableName, invitationId });
  };

  if (categoryLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const renderInvitationActions = (member: any, isClubMember: boolean) => {
    const result = getInvitationForMember(member.profile?.email, isClubMember);
    
    if (!result) {
      if (!member.profile?.email) {
        return <span className="text-xs text-muted-foreground italic">—</span>;
      }
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => createInvitationMutation.mutate({
                  email: member.profile.email,
                  role: member.role,
                  isClubMember,
                })}
                disabled={createInvitationMutation.isPending}
              >
                <Plus className="h-3.5 w-3.5" />
                {t("adminStaff.collaboration.actions.create")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("adminStaff.collaboration.actions.createTooltip")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    const { invitation, type } = result;
    
    return (
      <TooltipProvider>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleResendInvitation(invitation.id, type)}
                disabled={renewInvitationMutation.isPending}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("adminStaff.collaboration.actions.resendTooltip")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleCopyLink(invitation.token, type, member.id)}
              >
                {copiedId === member.id ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("adminStaff.collaboration.actions.copyLinkTooltip")}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  };

  return (
    <div className="space-y-6">
      {/* Info Section */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <Trans i18nKey="adminStaff.collaboration.infoAlert" components={{ strong: <strong /> }} />
        </AlertDescription>
      </Alert>

      {/* Club Members with access Section */}
      <Card className="bg-gradient-card shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">{t("adminStaff.collaboration.clubStaff.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {t("adminStaff.collaboration.clubStaff.description")}
          </p>
          {clubMembersLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : clubMembers && clubMembers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("adminStaff.collaboration.clubStaff.columns.member")}</TableHead>
                  <TableHead>{t("adminStaff.collaboration.clubStaff.columns.role")}</TableHead>
                  <TableHead>{t("adminStaff.collaboration.clubStaff.columns.invitation")}</TableHead>
                  <TableHead>{t("adminStaff.collaboration.clubStaff.columns.access")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clubMembers.map((member: any) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{member.profile?.full_name || t("adminStaff.collaboration.defaultUser")}</p>
                        <p className="text-sm text-muted-foreground">{member.profile?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(member.role)}</TableCell>
                    <TableCell>
                      {renderInvitationActions(member, true)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-secondary text-secondary-foreground border-border">
                        {!member.assigned_categories || member.assigned_categories.length === 0 
                          ? t("adminStaff.collaboration.clubStaff.allCategories") 
                          : t("adminStaff.collaboration.clubStaff.assignedCategory")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-6">
              {t("adminStaff.collaboration.clubStaff.empty")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Category-specific Members Section */}
      <Card className="bg-gradient-card shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">{t("adminStaff.collaboration.categoryMembers.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {t("adminStaff.collaboration.categoryMembers.description")}
          </p>
          {membersLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : members && members.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("adminStaff.collaboration.categoryMembers.columns.member")}</TableHead>
                  <TableHead>{t("adminStaff.collaboration.categoryMembers.columns.role")}</TableHead>
                  <TableHead>{t("adminStaff.collaboration.categoryMembers.columns.invitation")}</TableHead>
                  <TableHead>{t("adminStaff.collaboration.categoryMembers.columns.since")}</TableHead>
                  {canManage && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member: any) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{member.profile?.full_name || t("adminStaff.collaboration.defaultUser")}</p>
                        <p className="text-sm text-muted-foreground">{member.profile?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {canManage ? (
                        <Select
                          value={member.role}
                          onValueChange={(value: string) => updateRoleMutation.mutate({ memberId: member.id, newRole: value })}
                        >
                          <SelectTrigger className="w-52">
                            <SelectValue>
                              {getRoleConfig(member.role).label}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_ROLES.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{role.label}</span>
                                  <span className="text-xs text-muted-foreground">{role.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        getRoleBadge(member.role)
                      )}
                    </TableCell>
                    <TableCell>
                      {renderInvitationActions(member, false)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(member.created_at), "dd MMM yyyy", { locale: getDateLocale() })}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMemberMutation.mutate(member.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-6">
              {t("adminStaff.collaboration.categoryMembers.empty")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
