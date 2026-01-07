import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AWCRAlert {
  player_id: string;
  player_name: string;
  category_id: string;
  awcr: number;
  alert_type: "high" | "very_high" | "low";
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting AWCR alerts check...");

    // Get all categories
    const { data: categories, error: catError } = await supabase
      .from("categories")
      .select("id, name, club_id");

    if (catError) {
      console.error("Error fetching categories:", catError);
      throw catError;
    }

    const alerts: AWCRAlert[] = [];
    const notificationsToCreate: any[] = [];

    for (const category of categories || []) {
      // Get the latest AWCR for each player in this category
      const { data: awcrData, error: awcrError } = await supabase
        .from("awcr_tracking")
        .select(`
          id,
          player_id,
          awcr,
          session_date,
          players!inner(id, name)
        `)
        .eq("category_id", category.id)
        .order("session_date", { ascending: false });

      if (awcrError) {
        console.error(`Error fetching AWCR for category ${category.id}:`, awcrError);
        continue;
      }

      // Group by player and get most recent
      const latestByPlayer = new Map<string, any>();
      for (const entry of awcrData || []) {
        if (!latestByPlayer.has(entry.player_id)) {
          latestByPlayer.set(entry.player_id, entry);
        }
      }

      // Check each player's latest AWCR
      for (const [playerId, entry] of latestByPlayer) {
        const awcr = entry.awcr;
        if (awcr === null || awcr === undefined) continue;

        let alertType: "high" | "very_high" | "low" | null = null;
        
        if (awcr > 1.5) {
          alertType = "very_high";
        } else if (awcr > 1.3) {
          alertType = "high";
        } else if (awcr < 0.8) {
          alertType = "low";
        }

        if (alertType) {
          const playerName = (entry.players as any)?.name || "Joueur inconnu";
          alerts.push({
            player_id: playerId,
            player_name: playerName,
            category_id: category.id,
            awcr: awcr,
            alert_type: alertType,
          });

          // Get category members to notify
          const { data: members } = await supabase
            .from("category_members")
            .select("user_id")
            .eq("category_id", category.id);

          // Also get club owner
          const { data: club } = await supabase
            .from("clubs")
            .select("user_id")
            .eq("id", category.club_id)
            .single();

          const userIds = new Set<string>();
          members?.forEach((m) => userIds.add(m.user_id));
          if (club?.user_id) userIds.add(club.user_id);

          // Check if we already sent an alert today for this player
          const today = new Date().toISOString().split("T")[0];
          const { data: existingAlerts } = await supabase
            .from("notifications")
            .select("id")
            .eq("category_id", category.id)
            .eq("notification_type", "awcr_alert")
            .gte("created_at", today)
            .like("message", `%${playerId}%`);

          if ((existingAlerts?.length || 0) === 0) {
            // Create alert message
            let title = "";
            let message = "";
            let priority = "normal";

            if (alertType === "very_high") {
              title = "⚠️ AWCR très élevé - Risque de blessure";
              message = `${playerName} a un AWCR de ${awcr.toFixed(2)} (>1.5). Risque élevé de blessure, réduisez la charge d'entraînement.`;
              priority = "high";
            } else if (alertType === "high") {
              title = "⚠️ AWCR élevé";
              message = `${playerName} a un AWCR de ${awcr.toFixed(2)} (>1.3). Surveillez la charge d'entraînement.`;
              priority = "normal";
            } else if (alertType === "low") {
              title = "📉 AWCR faible - Risque de désentraînement";
              message = `${playerName} a un AWCR de ${awcr.toFixed(2)} (<0.8). Risque de désentraînement.`;
              priority = "normal";
            }

            // Create notifications for each user
            for (const userId of userIds) {
              notificationsToCreate.push({
                user_id: userId,
                category_id: category.id,
                notification_type: "awcr_alert",
                notification_subtype: alertType,
                title: title,
                message: message,
                priority: priority,
                metadata: {
                  player_id: playerId,
                  player_name: playerName,
                  awcr: awcr,
                  alert_type: alertType,
                },
              });
            }
          }
        }
      }
    }

    // Insert all notifications
    if (notificationsToCreate.length > 0) {
      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notificationsToCreate);

      if (insertError) {
        console.error("Error inserting notifications:", insertError);
        throw insertError;
      }
      console.log(`Created ${notificationsToCreate.length} AWCR alert notifications`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        alerts_found: alerts.length,
        notifications_created: notificationsToCreate.length,
        alerts: alerts,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in check-awcr-alerts:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
