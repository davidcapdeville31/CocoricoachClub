import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Mail, CheckCircle2, XCircle, Loader2, User, Users } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface NotificationManagementSectionProps {
  categoryId: string;
}

interface MemberNotifStatus {
  userId: string;
  name: string;
  email: string | null;
  role: string;
  hasPushSubscription: boolean;
}

export function NotificationManagementSection({ categoryId }: NotificationManagementSectionProps) {
  // Fetch all category members (staff + athletes)
  const { data: membersStatus = [], isLoading } = useQuery({
    queryKey: ["notification-status", categoryId],
    queryFn: async () => {
      // 1. Get category members (staff)
      const { data: categoryMembers = [] } = await supabase
        .from("category_members")
        .select("user_id, role")
        .eq("category_id", categoryId);

      // 2. Get athletes (players with user_id linked)
      const { data: players = [] } = await supabase
        .from("players")
        .select("user_id, name, first_name, email")
        .eq("category_id", categoryId)
        .not("user_id", "is", null);

      // 3. Get all user IDs
      const staffUserIds = categoryMembers.map(m => m.user_id);
      const athleteUserIds = players.filter(p => p.user_id).map(p => p.user_id!);
      const allUserIds = [...new Set([...staffUserIds, ...athleteUserIds])];

      if (allUserIds.length === 0) return [];

      // 4. Get profiles for names
      const { data: profiles = [] } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", allUserIds);

      // 5. Get push subscriptions
      const { data: pushSubs = [] } = await supabase
        .from("push_subscriptions")
        .select("user_id")
        .in("user_id", allUserIds);

      const pushUserIds = new Set(pushSubs.map(s => s.user_id));
      const profileMap = new Map(profiles.map(p => [p.id, p]));
      const memberRoleMap = new Map(categoryMembers.map(m => [m.user_id, m.role]));

      const results: MemberNotifStatus[] = [];

      // Staff members
      for (const userId of staffUserIds) {
        const profile = profileMap.get(userId);
        if (!profile) continue;
        results.push({
          userId,
          name: profile.full_name || "Sans nom",
          email: profile.email,
          role: memberRoleMap.get(userId) || "staff",
          hasPushSubscription: pushUserIds.has(userId),
        });
      }

      // Athletes
      for (const player of players) {
        if (!player.user_id) continue;
        // Skip if already added as staff
        if (staffUserIds.includes(player.user_id)) continue;
        const profile = profileMap.get(player.user_id);
        results.push({
          userId: player.user_id,
          name: `${player.first_name || ""} ${player.name || ""}`.trim() || profile?.full_name || "Sans nom",
          email: player.email || profile?.email || null,
          role: "athlete",
          hasPushSubscription: pushUserIds.has(player.user_id),
        });
      }

      return results;
    },
  });

  const roleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: "Admin",
      coach: "Coach",
      prepa_physique: "Prépa. physique",
      physio: "Physio",
      doctor: "Médecin",
      administratif: "Administratif",
      athlete: "Athlète",
    };
    return labels[role] || role;
  };

  const staffMembers = membersStatus.filter(m => m.role !== "athlete");
  const athletes = membersStatus.filter(m => m.role === "athlete");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderMemberRow = (member: MemberNotifStatus) => (
    <div key={member.userId} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{member.name}</p>
          <p className="text-xs text-muted-foreground truncate">{member.email || "—"}</p>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0 ml-1">
          {roleLabel(member.role)}
        </Badge>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-2">
        {/* Push */}
        <div className="flex items-center gap-1" title="Notifications Push">
          <Bell className="h-3.5 w-3.5 text-muted-foreground" />
          {member.hasPushSubscription ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-muted-foreground/50" />
          )}
        </div>
        {/* Email */}
        <div className="flex items-center gap-1" title="Notifications Email">
          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
          {member.email ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-muted-foreground/50" />
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1">
          <Bell className="h-3.5 w-3.5" />
          <span>Push</span>
        </div>
        <div className="flex items-center gap-1">
          <Mail className="h-3.5 w-3.5" />
          <span>Email</span>
        </div>
        <div className="flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span>Actif</span>
        </div>
        <div className="flex items-center gap-1">
          <XCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span>Inactif</span>
        </div>
      </div>

      {/* Staff */}
      {staffMembers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Users className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Staff ({staffMembers.length})</h4>
          </div>
          <Card>
            <CardContent className="p-2 divide-y divide-border">
              {staffMembers.map(renderMemberRow)}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Athletes */}
      {athletes.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <User className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Athlètes ({athletes.length})</h4>
          </div>
          <Card>
            <CardContent className="p-2 divide-y divide-border">
              {athletes.map(renderMemberRow)}
            </CardContent>
          </Card>
        </div>
      )}

      {membersStatus.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Aucun membre avec un compte actif dans cette catégorie.
        </p>
      )}

      <p className="text-xs text-muted-foreground px-1">
        Les notifications push nécessitent que chaque utilisateur les active depuis son navigateur. Les notifications email sont actives dès qu'un email est renseigné dans le profil.
      </p>
    </div>
  );
}
