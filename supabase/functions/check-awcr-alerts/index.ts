import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAuthorizedCronRequest } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const validateCronSecret = (req: Request): boolean => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) return false;
  const provided = req.headers.get("x-cron-secret");
  return !!provided && provided === cronSecret;
};

interface AWCRAlert {
  player_id: string;
  player_name: string;
  category_id: string;
  awcr: number;
  alert_type: "high" | "very_high" | "low";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!(await isAuthorizedCronRequest(req))) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: categories, error: catError } = await supabase
      .from("categories")
      .select("id, name, club_id");

    if (catError) throw catError;

    const alerts: AWCRAlert[] = [];
    const notificationsToCreate: any[] = [];

    for (const category of categories || []) {
      const { data: awcrData, error: awcrError } = await supabase
        .from("awcr_tracking")
        .select(`id, player_id, awcr, session_date, players!inner(id, name)`)
        .eq("category_id", category.id)
        .order("session_date", { ascending: false });

      if (awcrError) {
        console.error(`Error fetching AWCR for category ${category.id}`);
        continue;
      }

      const latestByPlayer = new Map<string, any>();
      for (const entry of awcrData || []) {
        if (!latestByPlayer.has(entry.player_id)) latestByPlayer.set(entry.player_id, entry);
      }

      for (const [playerId, entry] of latestByPlayer) {
        const awcr = entry.awcr;
        if (awcr === null || awcr === undefined) continue;

        let alertType: "high" | "very_high" | "low" | null = null;
        if (awcr > 1.5) alertType = "very_high";
        else if (awcr > 1.3) alertType = "high";
        else if (awcr < 0.8) alertType = "low";

        if (alertType) {
          const playerName = (entry.players as any)?.name || "Joueur inconnu";
          alerts.push({ player_id: playerId, player_name: playerName, category_id: category.id, awcr, alert_type: alertType });

          const { data: members } = await supabase
            .from("category_members").select("user_id").eq("category_id", category.id);
          const { data: club } = await supabase
            .from("clubs").select("user_id").eq("id", category.club_id).single();

          const userIds = new Set<string>();
          members?.forEach((m) => userIds.add(m.user_id));
          if (club?.user_id) userIds.add(club.user_id);

          const today = new Date().toISOString().split("T")[0];
          const { data: existingAlerts } = await supabase
            .from("notifications")
            .select("id")
            .eq("category_id", category.id)
            .eq("notification_type", "awcr_alert")
            .gte("created_at", today)
            .like("message", `%${playerId}%`);

          if ((existingAlerts?.length || 0) === 0) {
            let title = "", message = "", priority = "normal";
            if (alertType === "very_high") {
              title = "⚠️ AWCR très élevé - Risque de blessure";
              message = `${playerName} a un AWCR de ${awcr.toFixed(2)} (>1.5). Risque élevé de blessure, réduisez la charge d'entraînement.`;
              priority = "high";
            } else if (alertType === "high") {
              title = "⚠️ AWCR élevé";
              message = `${playerName} a un AWCR de ${awcr.toFixed(2)} (>1.3). Surveillez la charge d'entraînement.`;
            } else {
              title = "📉 AWCR faible - Risque de désentraînement";
              message = `${playerName} a un AWCR de ${awcr.toFixed(2)} (<0.8). Risque de désentraînement.`;
            }

            for (const userId of userIds) {
              notificationsToCreate.push({
                user_id: userId, category_id: category.id,
                notification_type: "awcr_alert", notification_subtype: alertType,
                title, message, priority,
                metadata: { player_id: playerId, player_name: playerName, awcr, alert_type: alertType },
              });
            }
          }
        }
      }
    }

    if (notificationsToCreate.length > 0) {
      const { error: insertError } = await supabase.from("notifications").insert(notificationsToCreate);
      if (insertError) throw insertError;
    }

    // Do NOT return the raw alerts array — it contains cross-tenant player data.
    return new Response(
      JSON.stringify({
        success: true,
        alerts_found: alerts.length,
        notifications_created: notificationsToCreate.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error in check-awcr-alerts:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
