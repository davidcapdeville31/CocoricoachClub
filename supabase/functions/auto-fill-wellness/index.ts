import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAuthorizedCronRequest } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STANDARD_KEYS = [
  "sleep_quality",
  "sleep_duration",
  "general_fatigue",
  "stress_level",
  "soreness_upper_body",
  "soreness_lower_body",
] as const;

// Fallback (no customisation saved for the category)
const DEFAULT_INVERTED: Record<string, boolean> = {
  sleep_quality: false,
  // sleep_duration is stored as a 1-5 SCORE where 1 = >8h (best) → inverted
  sleep_duration: true,
  general_fatigue: true,
  stress_level: true,
  soreness_upper_body: true,
  soreness_lower_body: true,
};

const BASE_WELLNESS = {
  has_specific_pain: false,
  pain_zone: null,
  pain_location: null,
  notes: null,
};

type WellnessScaleLevel = { value: number; label?: string; color?: string };
type WellnessQuestion = {
  key: string;
  enabled?: boolean;
  inverted?: boolean;
  is_custom?: boolean;
  scale?: WellnessScaleLevel[];
};

/** Optimal answer for a question: best end of its (possibly customised) scale. */
function optimalValue(q: { inverted?: boolean; scale?: WellnessScaleLevel[] }, fallbackInverted: boolean): number {
  const inverted = q.inverted ?? fallbackInverted;
  const values = Array.isArray(q.scale) && q.scale.length > 0
    ? q.scale.map((s) => Number(s.value)).filter((v) => Number.isFinite(v))
    : [];
  if (values.length === 0) return inverted ? 0 : 5;
  return inverted ? Math.min(...values) : Math.max(...values);
}

/**
 * Build the "everything is fine" wellness payload for a category,
 * honouring the category's wellness customisation (enabled questions,
 * inverted/positive orientation, custom scales and custom questions).
 */
function buildOptimalWellness(questions: WellnessQuestion[] | null) {
  const payload: Record<string, unknown> = { ...BASE_WELLNESS };
  const customAnswers: Record<string, number> = {};

  for (const key of STANDARD_KEYS) {
    const q = questions?.find((x) => x.key === key);
    // sleep_duration is ALWAYS stored as a 1-5 score where 1 = >8h (optimal)
    // and 5 = <5h (worst), regardless of the category's display scale.
    // The optimal auto-fill value is therefore always 1.
    if (key === "sleep_duration") {
      payload[key] = 1;
      continue;
    }
    payload[key] = optimalValue(q ?? {}, DEFAULT_INVERTED[key]);
  }


  for (const q of questions || []) {
    if (!q.is_custom || q.enabled === false) continue;
    // Custom questions default to "lower = better" (0 = aucun symptôme)
    customAnswers[q.key] = optimalValue(q, q.inverted ?? true);
  }


  payload.custom_answers = customAnswers;
  return payload;
}

const validateCronSecret = (req: Request): boolean => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) return false;
  const provided = req.headers.get("x-cron-secret");
  return !!provided && provided === cronSecret;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!(await isAuthorizedCronRequest(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all clubs with their timezone
    const { data: allClubs, error: clubsError } = await supabase
      .from("clubs")
      .select("id, name, timezone");

    if (clubsError) throw clubsError;
    if (!allClubs || allClubs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No clubs found", filled: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter clubs where it's currently 23h in their timezone (end of day)
    const eligibleClubIds: string[] = [];
    for (const club of allClubs) {
      try {
        const tz = club.timezone || "Europe/Paris";
        const nowInTz = new Date().toLocaleString("en-US", { timeZone: tz });
        const localHour = new Date(nowInTz).getHours();
        if (localHour === 23) {
          eligibleClubIds.push(club.id);
          console.log(`[auto-fill-wellness] Club "${club.name}" (${tz}) → 23h local ✓`);
        }
      } catch (e) {
        console.error(`[auto-fill-wellness] Invalid timezone for club "${club.name}": ${club.timezone}`, e);
      }
    }

    if (eligibleClubIds.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No clubs at 23h local", filled: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get categories for eligible clubs
    // Exclude bowling categories: per product rule, no wellness auto-fill for bowling athletes
    const { data: categoriesRaw, error: catError } = await supabase
      .from("categories")
      .select("id, club_id, rugby_type")
      .in("club_id", eligibleClubIds);

    const categories = (categoriesRaw || []).filter(
      (c: any) => !((c.rugby_type as string | null)?.toLowerCase().startsWith("bowling"))
    );

    if (catError) throw catError;
    if (!categories || categories.length === 0) {
      return new Response(
        JSON.stringify({ message: "No categories for eligible clubs", filled: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build a map of club_id -> today's date in that club's timezone
    const clubDateMap: Record<string, string> = {};
    const clubDowMap: Record<string, number> = {};
    for (const club of allClubs) {
      if (eligibleClubIds.includes(club.id)) {
        const tz = club.timezone || "Europe/Paris";
        const localNow = new Date().toLocaleString("en-CA", { timeZone: tz });
        clubDateMap[club.id] = localNow.split(",")[0].trim();
        clubDowMap[club.id] = new Date(
          new Date().toLocaleString("en-US", { timeZone: tz })
        ).getDay();
      }
    }

    // Respect the per-category wellness schedule (only auto-fill on planned days)
    const { data: schedules } = await supabase
      .from("wellness_schedules")
      .select("category_id, days_of_week")
      .in("category_id", categories.map((c: any) => c.id));
    const scheduleMap: Record<string, number[]> = {};
    for (const s of schedules || []) {
      scheduleMap[s.category_id as string] = (s.days_of_week as number[]) || [];
    }

    let totalFilled = 0;

    for (const category of categories) {
      const today = clubDateMap[category.club_id];
      if (!today) continue;

      const days = scheduleMap[category.id];
      const dow = clubDowMap[category.club_id];
      if (days && days.length > 0 && dow !== undefined && !days.includes(dow)) {
        console.log(`[auto-fill-wellness] Category ${category.id}: not a wellness day (dow=${dow}), skipping`);
        continue;
      }


      const { data: players } = await supabase
        .from("players")
        .select("id")
        .eq("category_id", category.id);

      if (!players || players.length === 0) continue;

      const playerIds = players.map((p) => p.id);

      const { data: existingWellness } = await supabase
        .from("wellness_tracking")
        .select("player_id")
        .eq("category_id", category.id)
        .eq("tracking_date", today)
        .in("player_id", playerIds);

      const submittedIds = new Set(existingWellness?.map((w) => w.player_id) || []);
      const missingIds = playerIds.filter((id) => !submittedIds.has(id));

      if (missingIds.length === 0) continue;

      // Respect the category's wellness customisation
      const { data: configRow } = await supabase
        .from("wellness_question_configs")
        .select("questions")
        .eq("category_id", category.id)
        .maybeSingle();

      const optimal = buildOptimalWellness(
        (configRow?.questions as WellnessQuestion[] | null) ?? null
      );

      console.log(
        `[auto-fill-wellness] Category ${category.id} (date=${today}): auto-filling ${missingIds.length} players`
      );

      const inserts = missingIds.map((playerId) => ({
        player_id: playerId,
        category_id: category.id,
        tracking_date: today,
        auto_filled: true,
        ...optimal,
      }));

      const { error: insertError } = await supabase
        .from("wellness_tracking")
        .insert(inserts);

      if (insertError) {
        console.error(`[auto-fill-wellness] Insert error for category ${category.id}:`, insertError);
      } else {
        totalFilled += missingIds.length;
      }
    }

    console.log(`[auto-fill-wellness] Done. Total auto-filled: ${totalFilled}`);

    return new Response(
      JSON.stringify({ success: true, filled: totalFilled, eligibleClubs: eligibleClubIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[auto-fill-wellness] Error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
