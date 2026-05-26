import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { filterByPreferences } from "../_shared/notification-preferences.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID");
    const oneSignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

    if (!oneSignalAppId || !oneSignalApiKey) {
      throw new Error("OneSignal credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const baseHeaders = {
      "Content-Type": "application/json",
      Authorization: `Key ${oneSignalApiKey}`,
    };

    // Get all clubs with their timezone
    const { data: allClubs, error: clubsError } = await supabase
      .from("clubs")
      .select("id, name, timezone");

    if (clubsError) throw clubsError;
    if (!allClubs || allClubs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No clubs found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter clubs where it's currently 8h in their timezone
    const eligibleClubIds: string[] = [];
    for (const club of allClubs) {
      try {
        const tz = club.timezone || "Europe/Paris";
        const nowInTz = new Date().toLocaleString("en-US", { timeZone: tz });
        const localHour = new Date(nowInTz).getHours();
        if (localHour === 8) {
          eligibleClubIds.push(club.id);
          console.log(`[wellness] Club "${club.name}" (${tz}) → 8h local ✓`);
        } else {
          console.log(`[wellness] Club "${club.name}" (${tz}) → ${localHour}h local, skipping`);
        }
      } catch (e) {
        console.error(`[wellness] Invalid timezone for club "${club.name}": ${club.timezone}`, e);
      }
    }

    if (eligibleClubIds.length === 0) {
      console.log("[wellness] No clubs at 8h local right now");
      return new Response(
        JSON.stringify({ skipped: true, reason: "No clubs at 8h local" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get categories for eligible clubs only
    const { data: categories, error: catError } = await supabase
      .from("categories")
      .select("id, name, club_id, clubs!inner(name)")
      .in("club_id", eligibleClubIds);

    if (catError) throw catError;
    if (!categories || categories.length === 0) {
      return new Response(
        JSON.stringify({ message: "No categories for eligible clubs" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalEmailsSent = 0;
    let totalPushSent = 0;
    const results: any[] = [];

    const appBaseUrl = "https://cocoricoachclub.com";
    const wellnessDeepLink = `${appBaseUrl}/athlete-space?tab=wellness`;

    for (const category of categories) {
      const { data: players, error: playersError } = await supabase
        .from("players")
        .select("id, name, email, phone, user_id")
        .eq("category_id", category.id);

      if (playersError) {
        console.error(`Error fetching players for category ${category.id}:`, playersError);
        continue;
      }

      if (!players || players.length === 0) continue;

      // Filter by per-user notification preferences
      const allUserIds = players.filter((p) => p.user_id).map((p) => p.user_id!);
      const { pushUserIds: allowedPushUserIds, emailUserIds: allowedEmailUserIds } =
        await filterByPreferences(supabase, allUserIds, "wellness_reminder");
      const allowedEmailSet = new Set(allowedEmailUserIds);
      const allowedPushSet = new Set(allowedPushUserIds);

      // ── EMAIL via send-transactional-email (queued, logged, retry-safe) ───
      const emailTargets = players
        .filter((p) => p.email && p.user_id && allowedEmailSet.has(p.user_id))
        .map((p) => ({ email: p.email!, userId: p.user_id! }));

      for (const target of emailTargets) {
        try {
          const { error: emailError } = await supabase.functions.invoke(
            "send-transactional-email",
            {
              body: {
                templateName: "app-notification",
                recipientEmail: target.email,
                idempotencyKey: `wellness-reminder-${target.userId}-${new Date().toISOString().slice(0, 10)}`,
                templateData: {
                  title: "🌅 Wellness du jour",
                  message: `Bonjour ! N'oublie pas de renseigner ton Wellness du jour (${category.name}) pour aider ton staff à suivre ta récupération.`,
                  ctaLabel: "❤️ Remplir mon Wellness",
                  ctaUrl: wellnessDeepLink,
                },
              },
            }
          );
          if (emailError) {
            console.error(`[wellness] Email error for ${target.email}:`, emailError);
          } else {
            totalEmailsSent += 1;
          }
        } catch (error) {
          console.error("[wellness] Email send error:", error);
        }
      }

      // ── PUSH via OneSignal ─────────────────────────────────────────────
      const pushUserIds = players
        .filter((p) => p.user_id && allowedPushSet.has(p.user_id!))
        .map((p) => p.user_id!);

      if (pushUserIds.length > 0) {
        try {
          const response = await fetch("https://api.onesignal.com/notifications", {
            method: "POST",
            headers: baseHeaders,
            body: JSON.stringify({
              app_id: oneSignalAppId,
              include_aliases: { external_id: pushUserIds },
              target_channel: "push",
              headings: { fr: "Comment tu te sens ce matin ? 🌅", en: "Comment tu te sens ce matin ? 🌅" },
              contents: {
                fr: `Prends 30 secondes pour remplir ton Wellness du jour (${category.name}).`,
                en: `Prends 30 secondes pour remplir ton Wellness du jour (${category.name}).`,
              },
              url: wellnessDeepLink,
              ttl: 3600,
              data: {
                type: "wellness_reminder",
                category_id: category.id,
                url: wellnessDeepLink,
              },
            }),
          });

          const json = await response.json();
          if (response.ok) {
            totalPushSent += json.recipients ?? pushUserIds.length;
            console.log(`[wellness] Push sent to ${json.recipients ?? pushUserIds.length} device(s) for ${category.name}`);
          } else {
            console.error(`[wellness] Push error for ${category.name}:`, json);
          }
        } catch (error) {
          console.error("[wellness] Push send error:", error);
        }
      }

      results.push({
        category: category.name,
        emailsSent: emailRecipients.length,
        pushTargeted: pushUserIds.length,
        type: "wellness_reminder",
      });
    }

    console.log(`[wellness] Total: ${totalEmailsSent} emails, ${totalPushSent} push sent`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${totalEmailsSent} email(s) + ${totalPushSent} push sent`,
        emailsSent: totalEmailsSent,
        pushSent: totalPushSent,
        eligibleClubs: eligibleClubIds.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in scheduled-wellness-reminder:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
