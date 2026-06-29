import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Wrench } from "lucide-react";
import logoLight from "@/assets/logo-light.png";

interface MaintenanceStatus {
  enabled: boolean;
  message: string;
}

/**
 * Global maintenance gate. Shows a fullscreen "App in maintenance" screen for everyone
 * EXCEPT super admins. Visible even to anonymous visitors thanks to a SECURITY DEFINER RPC.
 */
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  const { data: status } = useQuery({
    queryKey: ["maintenance-status"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_maintenance_status");
      if (error) throw error;
      return data as unknown as MaintenanceStatus;
    },
    refetchInterval: 5 * 60_000, // re-check every 5 minutes
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  });

  const { data: isSuperAdmin } = useQuery({
    queryKey: ["is-super-admin-gate", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase.rpc("is_super_admin", { _user_id: user.id });
      return data === true;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  // Always allow super admins to keep working — they can disable maintenance.
  if (!status?.enabled || isSuperAdmin) {
    return <>{children}</>;
  }

  // Allow super-admin route through so they can sign in and disable it
  if (location.pathname.startsWith("/super-admin") || location.pathname.startsWith("/auth")) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/40 to-background p-6">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-2xl border p-8 text-center backdrop-blur-xl">
        <img
          src={logoLight}
          alt="CocoriCoach Club"
          className="h-16 w-auto mx-auto mb-6"
        />
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 text-primary mb-4">
          <Wrench className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold mb-3">Application en maintenance</h1>
        <p className="text-muted-foreground whitespace-pre-line">
          {status?.message || "Application en maintenance. Nous revenons très vite !"}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-6">
          Merci pour votre patience.
        </p>
      </div>
    </div>
  );
}
