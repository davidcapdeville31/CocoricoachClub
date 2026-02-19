import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ResendOptions {
  tableName: "ambassador_invitations" | "club_invitations" | "category_invitations" | "athlete_invitations";
  invitationId: string;
  invitationType: "club_admin" | "collaborator" | "category_member" | "athlete";
  inviterName?: string;
  clubName?: string;
  categoryName?: string;
  role?: string;
  invalidateKeys?: string[][];
}

function getInvitationLink(tableName: string, token: string): string {
  const origin = window.location.origin;
  switch (tableName) {
    case "ambassador_invitations":
      return `${origin}/ambassador-invitation?token=${token}`;
    case "club_invitations":
      return `${origin}/accept-invitation?token=${token}`;
    case "category_invitations":
      return `${origin}/accept-invitation?token=${token}&type=category`;
    case "athlete_invitations":
      return `${origin}/accept-athlete-invitation?token=${token}`;
    default:
      return `${origin}/accept-invitation?token=${token}`;
  }
}

export function useResendInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: ResendOptions) => {
      // 1. Renew the token via the SQL function
      const { data, error } = await (supabase as any).rpc("renew_invitation", {
        _table_name: options.tableName,
        _invitation_id: options.invitationId,
      });

      if (error) throw error;

      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (!result.success) throw new Error(result.error);

      // 2. Build the new invitation link
      const invitationLink = getInvitationLink(options.tableName, result.token);

      // 3. Resend the email
      try {
        await supabase.functions.invoke("send-invitation-email", {
          body: {
            email: result.email,
            invitationType: options.invitationType,
            inviterName: options.inviterName || "CocoriCoach",
            clubName: options.clubName,
            categoryName: options.categoryName,
            role: options.role,
            invitationLink,
          },
        });
      } catch (e) {
        console.error("Email resend failed:", e);
        // Still return success since the token was renewed
      }

      return { ...result, invitationLink };
    },
    onSuccess: (_, options) => {
      if (options.invalidateKeys) {
        options.invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
      toast.success("Invitation renvoyée avec un nouveau lien (valable 48h)");
    },
    onError: () => {
      toast.error("Erreur lors du renvoi de l'invitation");
    },
  });
}

export function getInvitationStatus(status: string, expiresAt?: string | null): "pending" | "accepted" | "expired" {
  if (status === "accepted") return "accepted";
  if (expiresAt && new Date(expiresAt) < new Date()) return "expired";
  return "pending";
}
