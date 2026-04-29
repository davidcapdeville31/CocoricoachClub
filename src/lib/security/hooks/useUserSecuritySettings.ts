import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserSecuritySettings {
  id: string;
  user_id: string;
  mfa_enabled: boolean;
  mfa_factor_id: string | null;
  mfa_verified_at: string | null;
  session_timeout_minutes: number;
  last_password_change: string | null;
  password_change_required: boolean;
  trusted_devices: Array<{ fingerprint: string; first_seen: string; user_agent: string }>;
  failed_login_attempts: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

export function useUserSecuritySettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-security-settings", user?.id],
    queryFn: async (): Promise<UserSecuritySettings | null> => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("user_security_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as UserSecuritySettings | null;
    },
    enabled: !!user?.id,
  });
}

export function useUpdateSecuritySettings() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<UserSecuritySettings>) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("user_security_settings")
        .upsert(
          { user_id: user.id, ...updates },
          { onConflict: "user_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-security-settings"] });
    },
  });
}
