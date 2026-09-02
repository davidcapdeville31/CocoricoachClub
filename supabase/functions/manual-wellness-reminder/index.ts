import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";


import { filterByPreferences } from "../_shared/notification-preferences.ts";

// Les rappels wellness sont envoyés en push uniquement.


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID");
    const oneSignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

    // Validate caller (must be authenticated staff)
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const categoryId: string | undefined = body.categoryId;
    const targetPlayerIds: string[] | undefined = Array.isArray(body.playerIds)
      ? body.playerIds.filter((x: unknown) => typeof x === "string")
      : undefined;
    const onlyMissing: boolean = body.onlyMissing !== false; // default true

    if (!categoryId || typeof categoryId !== "string") {
      return new Response(JSON.stringify({ error: "categoryId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify the caller has access to this category (staff = club member or category member)
    const { data: category, error: catErr } = await supabase
      .from("categories")
      .select("id, name, club_id")
      .eq("id", categoryId)
      .maybeSingle();
    if (catErr || !category) {
      return new Response(JSON.stringify({ error: "category not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: clubMember } = await supabase
      .from("club_members")
      .select("role")
      .eq("club_id", category.club_id)
      .eq("user_id", user.id)
      .maybeSingle();
    const { data: catMember } = await supabase
      .from("category_members")
      .select("role")
      .eq("category_id", categoryId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!clubMember && !catMember) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch players in category
    let playersQuery = supabase
      .from("players")
      .select("id, name, email, user_id")
      .eq("category_id", categoryId);
    if (targetPlayerIds && targetPlayerIds.length > 0) {
      playersQuery = playersQuery.in("id", targetPlayerIds);
    }
    const { data: players, error: playersErr } = await playersQuery;
    if (playersErr) throw playersErr;
    if (!players || players.length === 0) {
      return new Response(JSON.stringify({ message: "No players targeted", emailsSent: 0, pushSent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out players who already filled wellness today (if onlyMissing)
    let targetedPlayers = players;
    if (onlyMissing) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: filled } = await supabase
        .from("wellness_tracking")
        .select("player_id")
        .eq("category_id", categoryId)
        .eq("tracking_date", today);
      const filledIds = new Set((filled || []).map((w) => w.player_id));
      targetedPlayers = players.filter((p) => !filledIds.has(p.id));
    }

    if (targetedPlayers.length === 0) {
      // Log even if nothing was sent so coaches see the action was attempted today
      await supabase.from("wellness_reminder_log").insert({
        category_id: categoryId,
        sent_by: user.id,
        targeted_count: 0,
        emails_sent: 0,
        push_sent: 0,
      });
      return new Response(
        JSON.stringify({ message: "All athletes already filled wellness today", emailsSent: 0, pushSent: 0, targeted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appBaseUrl = "https://cocoricoachclub.com";
    const wellnessDeepLink = `${appBaseUrl}/athlete-space?tab=wellness`;

    const allUserIds = targetedPlayers.filter((p) => p.user_id).map((p) => p.user_id!);
    const { pushUserIds: allowedPushUserIds } =
      await filterByPreferences(supabase, allUserIds, "wellness_reminder");
    const allowedPushSet = new Set(allowedPushUserIds);

    let pushSent = 0;

    // Push
    if (oneSignalAppId && oneSignalApiKey) {
      const pushUserIds = targetedPlayers
        .filter((p) => p.user_id && allowedPushSet.has(p.user_id!))
        .map((p) => p.user_id!);

      if (pushUserIds.length > 0) {
        try {
          const resp = await fetch("https://api.onesignal.com/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Key ${oneSignalApiKey}`,
            },
            body: JSON.stringify({
              app_id: oneSignalAppId,
              include_aliases: { external_id: pushUserIds },
              target_channel: "push",
              headings: { fr: "❤️ Rappel Wellness", en: "❤️ Wellness reminder" },
              contents: {
                fr: `Ton coach te rappelle de remplir ton Wellness du jour (${category.name}).`,
                en: `Your coach reminds you to fill in today's Wellness (${category.name}).`,
              },
              url: wellnessDeepLink,
              ttl: 3600,
              data: { type: "wellness_reminder", category_id: categoryId, url: wellnessDeepLink },
            }),
          });
          const json = await resp.json();
          if (resp.ok) {
            pushSent = json.recipients ?? pushUserIds.length;
          } else {
            console.error("[manual-wellness] push error", json);
          }
        } catch (e) {
          console.error("[manual-wellness] push send error", e);
        }
      }
    }

    // Log the reminder
    await supabase.from("wellness_reminder_log").insert({
      category_id: categoryId,
      sent_by: user.id,
      targeted_count: targetedPlayers.length,
      emails_sent: 0,
      push_sent: pushSent,
    });

    return new Response(
      JSON.stringify({
        success: true,
        targeted: targetedPlayers.length,
        emailsSent: 0,
        pushSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[manual-wellness-reminder]", error);
    return new Response(
      JSON.stringify({ error: error?.message || "unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
