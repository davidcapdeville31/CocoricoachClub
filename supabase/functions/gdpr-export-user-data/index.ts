import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tables containing user-linked or athlete-linked data (RGPD art. 20 portability)
const USER_TABLES = [
  "profiles",
  "user_consents",
  "data_export_requests",
  "account_deletion_requests",
  "notification_preferences",
  "club_members",
  "category_members",
  "user_roles",
  "approved_users",
  "audit_logs",
];

const PLAYER_TABLES = [
  "players",
  "player_categories",
  "player_contacts",
  "player_measurements",
  "player_objectives",
  "wellness_tracking",
  "training_attendance",
  "awcr_tracking",
  "injuries",
  "medical_records",
  "concussion_protocols",
  "menstrual_cycles",
  "menstrual_symptoms",
  "recovery_journal",
  "hrv_records",
  "body_composition",
  "nutrition_entries",
  "mental_assessments",
  "mental_goals",
  "mental_prep_sessions",
  "speed_tests",
  "strength_tests",
  "jump_tests",
  "mobility_tests",
  "rugby_specific_tests",
  "generic_tests",
  "athletics_records",
  "gym_session_exercises",
  "athlete_exercise_logs",
  "precision_training",
  "bowling_spare_training",
  "tennis_drill_training",
  "player_match_stats",
  "match_lineups",
  "player_caps",
  "player_evaluations",
  "player_selections",
  "player_development_plans",
  "player_availability_scores",
  "player_performance_references",
  "staff_notes",
  "admin_documents",
  "academic_grades",
  "academic_absences",
  "player_academic_profiles",
  "player_academic_tracking",
  "player_rehab_protocols",
  "rehab_calendar_events",
  "return_to_play_protocols",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Log the request
    await admin.from("data_export_requests").insert({
      user_id: user.id, status: "processing", format: "json",
    });

    const exportPayload: Record<string, any> = {
      _meta: {
        user_id: user.id,
        email: user.email,
        exported_at: new Date().toISOString(),
        notice:
          "Export RGPD article 20 (droit à la portabilité). Contient toutes vos données personnelles détenues par CocoriCoach Club.",
      },
    };

    // Find linked players (athletes the user owns)
    const { data: linkedPlayers } = await admin
      .from("players").select("id").eq("user_id", user.id);
    const playerIds = (linkedPlayers || []).map((p: any) => p.id);

    // Export user-scoped tables
    for (const table of USER_TABLES) {
      try {
        const { data } = await admin.from(table).select("*").or(
          `user_id.eq.${user.id},id.eq.${user.id}`
        );
        if (data && data.length > 0) exportPayload[table] = data;
      } catch (_) { /* table may not have user_id */ }
    }

    // Export player-scoped tables (only if user has linked players)
    if (playerIds.length > 0) {
      for (const table of PLAYER_TABLES) {
        try {
          const { data } = await admin.from(table).select("*").in("player_id", playerIds);
          if (data && data.length > 0) exportPayload[table] = data;
        } catch (_) {
          // Try with id directly (e.g. for "players" table itself)
          try {
            const { data } = await admin.from(table).select("*").in("id", playerIds);
            if (data && data.length > 0) exportPayload[table] = data;
          } catch (_) {}
        }
      }
    }

    // Mark complete
    await admin.from("data_export_requests")
      .update({ status: "ready", completed_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("status", "processing");

    return new Response(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="cocoricoach-data-${user.id}.json"`,
      },
    });
  } catch (e: any) {
    console.error("[gdpr-export-user-data]", e);
    return new Response(JSON.stringify({ error: e?.message || "Erreur" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
