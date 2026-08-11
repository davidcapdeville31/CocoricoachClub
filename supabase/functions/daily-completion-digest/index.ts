import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAuthorizedCronRequest } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

/** Runs hourly; only acts for clubs where local time is 8h (recap of the previous day). */
const TARGET_LOCAL_HOUR = 8;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (!(await isAuthorizedCronRequest(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: clubs, error: clubsError } = await supabase
      .from("clubs")
      .select("id, name, timezone");
    if (clubsError) throw clubsError;

    // Keep clubs currently at 8h local, and compute yesterday's local date
    const eligible: { id: string; date: string }[] = [];
    for (const club of clubs || []) {
      const tz = club.timezone || "Europe/Paris";
      try {
        const localNow = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
        if (localNow.getHours() !== TARGET_LOCAL_HOUR) continue;
        const yesterday = new Date(localNow);
        yesterday.setDate(yesterday.getDate() - 1);
        const date = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
        eligible.push({ id: club.id, date });
      } catch (e) {
        console.error(`[daily-completion-digest] Bad timezone for club ${club.name}`, e);
      }
    }

    if (eligible.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "No clubs at 8h local" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let created = 0;

    for (const club of eligible) {
      const { data: categories } = await supabase
        .from("categories")
        .select("id, name")
        .eq("club_id", club.id);

      for (const category of categories || []) {
        const { data: players } = await supabase
          .from("players")
          .select("id")
          .eq("category_id", category.id);
        const playerIds = (players || []).map((p) => p.id);
        if (playerIds.length === 0) continue;

        // --- Wellness (uniquement les jours planifiés pour la catégorie) ---
        const { data: schedule } = await supabase
          .from("wellness_schedules")
          .select("days_of_week")
          .eq("category_id", category.id)
          .maybeSingle();
        const scheduledDays: number[] = schedule?.days_of_week ?? [0, 1, 2, 3, 4, 5, 6];
        const [dy, dm, dd] = club.date.split("-").map(Number);
        const weekday = new Date(Date.UTC(dy, dm - 1, dd)).getUTCDay();
        const wellnessExpected = scheduledDays.includes(weekday);

        let wellness: { player_id: string; auto_filled: boolean }[] = [];
        if (wellnessExpected) {
          const { data: w } = await supabase
            .from("wellness_tracking")
            .select("player_id, auto_filled")
            .eq("category_id", category.id)
            .eq("tracking_date", club.date)
            .in("player_id", playerIds);
          wellness = (w || []) as any;
        }
        const wellnessReal = wellness.filter((w) => !w.auto_filled).length;
        const wellnessAuto = wellness.filter((w) => w.auto_filled).length;


        // --- RPE (only if there was a session that day) ---
        const { data: sessions } = await supabase
          .from("training_sessions")
          .select("id")
          .eq("category_id", category.id)
          .eq("session_date", club.date);
        const sessionIds = (sessions || []).map((s) => s.id);

        let rpeReal = 0;
        let rpeAuto = 0;
        let rpeExpected = 0;
        if (sessionIds.length > 0) {
          const { data: rpe } = await supabase
            .from("awcr_tracking")
            .select("player_id, auto_filled, training_session_id")
            .in("training_session_id", sessionIds)
            .in("player_id", playerIds);
          rpeReal = (rpe || []).filter((r) => !r.auto_filled).length;
          rpeAuto = (rpe || []).filter((r) => r.auto_filled).length;
          rpeExpected = playerIds.length * sessionIds.length;
        }

        // --- Test results submitted by athletes ---
        const { data: tests } = await supabase
          .from("pending_test_results")
          .select("id, validation_status")
          .eq("category_id", category.id)
          .eq("test_date", club.date);
        const testsSubmitted = (tests || []).length;
        const testsPending = (tests || []).filter((t) => t.validation_status === "pending").length;

        if (wellness?.length === 0 && sessionIds.length === 0 && testsSubmitted === 0) continue;

        const parts: string[] = [];
        parts.push(
          `Wellness : ${wellnessReal}/${playerIds.length} rempli(s) par les athlètes` +
            (wellnessAuto > 0 ? ` — ${wellnessAuto} complété(s) automatiquement` : ""),
        );
        if (rpeExpected > 0) {
          parts.push(
            `RPE : ${rpeReal}/${rpeExpected} saisi(s) par les athlètes` +
              (rpeAuto > 0 ? ` — ${rpeAuto} complété(s) automatiquement (RPE prévu)` : ""),
          );
        }
        if (testsSubmitted > 0) {
          parts.push(
            `Tests : ${testsSubmitted} résultat(s) enregistré(s)` +
              (testsPending > 0 ? `, dont ${testsPending} à valider` : ""),
          );
        }

        const missing = playerIds.length - wellnessReal;
        const { data: staffIds } = await supabase.rpc("category_staff_user_ids", {
          _category_id: category.id,
        });
        const recipients: string[] = (staffIds as string[]) || [];
        if (recipients.length === 0) continue;

        const [y, m, d] = club.date.split("-");
        const rows = recipients.map((userId) => ({
          user_id: userId,
          category_id: category.id,
          notification_type: "daily_completion_digest",
          title: `Bilan de remplissage du ${d}/${m}/${y}`,
          message: parts.join(" • "),
          is_read: false,
          priority: missing > 0 ? "high" : "normal",
          metadata: {
            digest_date: club.date,
            wellness_real: wellnessReal,
            wellness_auto: wellnessAuto,
            rpe_real: rpeReal,
            rpe_auto: rpeAuto,
            tests_submitted: testsSubmitted,
            tests_pending: testsPending,
            players_total: playerIds.length,
          },
        }));

        // Avoid duplicates if the job runs twice within the same hour
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("category_id", category.id)
          .eq("notification_type", "daily_completion_digest")
          .contains("metadata", { digest_date: club.date })
          .limit(1);
        if (existing && existing.length > 0) continue;

        const { error: insertError } = await supabase.from("notifications").insert(rows);
        if (insertError) {
          console.error(`[daily-completion-digest] Insert error for category ${category.id}:`, insertError);
        } else {
          created += rows.length;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, notifications: created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[daily-completion-digest] Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error)?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
