import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { player_id } = await req.json();
    if (!player_id) {
      return new Response(JSON.stringify({ error: "player_id requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify caller has access to this player (via category membership / club ownership)
    const { data: player } = await admin.from("players")
      .select("id, name, first_name, category_id").eq("id", player_id).single();
    if (!player) {
      return new Response(JSON.stringify({ error: "Joueur introuvable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: hasAccess } = await admin.rpc("can_view_player_sensitive_data", {
      _user_id: user.id, _category_id: player.category_id,
    });
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Accès refusé à ce joueur" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log
    await admin.from("data_export_requests").insert({
      user_id: user.id, requested_for_player_id: player_id,
      status: "processing", format: "json",
    });

    const exportPayload: Record<string, any> = {
      _meta: {
        player_id, player_name: `${player.first_name || ""} ${player.name || ""}`.trim(),
        exported_at: new Date().toISOString(),
        exported_by: user.id,
        notice: "Export RGPD article 20 (portabilité) — données du joueur. Usage strictement professionnel.",
      },
    };

    for (const table of PLAYER_TABLES) {
      try {
        const { data } = await admin.from(table).select("*").or(
          `player_id.eq.${player_id},id.eq.${player_id}`
        );
        if (data && data.length > 0) exportPayload[table] = data;
      } catch (_) {}
    }

    await admin.from("data_export_requests")
      .update({ status: "ready", completed_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("requested_for_player_id", player_id).eq("status", "processing");

    const filename = `cocoricoach-player-${player.first_name || ""}-${player.name || ""}-${player_id.slice(0, 8)}.json`
      .replace(/\s+/g, "_");

    return new Response(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    console.error("[gdpr-export-player-data]", e);
    return new Response(JSON.stringify({ error: e?.message || "Erreur" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
