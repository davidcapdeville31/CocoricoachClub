import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { filterByPreferences } from "../_shared/notification-preferences.ts";

// Les rappels wellness sont envoyés en push uniquement.



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

    // Local day-of-week per club (0 = dimanche ... 6 = samedi)
    const clubDowMap: Record<string, number> = {};
    for (const club of allClubs) {
      if (!eligibleClubIds.includes(club.id)) continue;
      const tz = club.timezone || "Europe/Paris";
      clubDowMap[club.id] = new Date(
        new Date().toLocaleString("en-US", { timeZone: tz })
      ).getDay();
    }

    // Respect the per-category wellness schedule (e.g. only Wednesdays)
    const { data: schedules } = await supabase
      .from("wellness_schedules")
      .select("category_id, days_of_week")
      .in("category_id", categories.map((c: any) => c.id));
    const scheduleMap: Record<string, number[]> = {};
    for (const s of schedules || []) {
      scheduleMap[s.category_id as string] = (s.days_of_week as number[]) || [];
    }

    let totalPushSent = 0;
    const results: any[] = [];

    const appBaseUrl = "https://cocoricoachclub.com";
    const wellnessDeepLink = `${appBaseUrl}/athlete-space?tab=wellness`;

    for (const category of categories) {
      const days = scheduleMap[category.id];
      const dow = clubDowMap[category.club_id];
      if (days && days.length > 0 && dow !== undefined && !days.includes(dow)) {
        console.log(`[wellness] Category ${category.name}: not scheduled today (dow=${dow}), skipping`);
        continue;
      }
      const { data: players, error: playersError } = await supabase
        .from("players")

        .select("id, name, email, phone, user_id")
        .eq("category_id", category.id);

      if (playersError) {
        console.error(`Error fetching players for category ${category.id}:`, playersError);
        continue;
      }

      if (!players || players.length === 0) continue;

      // Filter by per-user push preferences
      const allUserIds = players.filter((p) => p.user_id).map((p) => p.user_id!);
      const { pushUserIds: allowedPushUserIds } =
        await filterByPreferences(supabase, allUserIds, "wellness_reminder");
      const allowedPushSet = new Set(allowedPushUserIds);


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
        pushTargeted: pushUserIds.length,
        type: "wellness_reminder",
      });
    }

    console.log(`[wellness] Total: ${totalPushSent} push sent`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${totalPushSent} push sent`,
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
