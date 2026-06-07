import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const respond = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST") {
      return respond({ success: false, error: "Méthode non autorisée" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return respond({ success: false, error: "Configuration backend manquante" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!jwt) return respond({ success: false, error: "Authentification requise" }, 401);

    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    const userId = userData.user?.id;
    if (userError || !userId) return respond({ success: false, error: "Session invalide" }, 401);

    const body = await req.json();
    const { category_id, player_id, match } = body ?? {};

    if (!category_id || !player_id || !match || typeof match !== "object") {
      return respond({ success: false, error: "Données manquantes" }, 400);
    }
    if (!match.match_date) {
      return respond({ success: false, error: "Date de la compétition requise" }, 400);
    }

    // Ensure the logged-in user owns the player
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, user_id, category_id")
      .eq("id", player_id)
      .maybeSingle();
    if (playerError) throw playerError;
    if (!player) return respond({ success: false, error: "Joueur introuvable" }, 404);

    if (player.user_id !== userId) {
      const { data: isSA } = await supabase.rpc("is_super_admin", { _user_id: userId });
      if (!isSA) return respond({ success: false, error: "Accès refusé" }, 403);
    }

    // Sanitize payload — whitelist of allowed columns
    const allowed: Record<string, unknown> = {
      category_id,
      opponent: match.opponent || "Compétition",
      competition: match.competition ?? null,
      competition_stage: match.competition_stage ?? null,
      match_date: match.match_date,
      end_date: match.end_date ?? null,
      match_time: match.match_time ?? null,
      location: match.location ?? null,
      is_home: typeof match.is_home === "boolean" ? match.is_home : true,
      notes: match.notes ?? null,
      event_type: match.event_type ?? "individual",
      age_category: match.age_category ?? null,
      distance_meters: match.distance_meters ?? null,
      match_format: match.match_format ?? null,
      tournament_level: match.tournament_level ?? null,
      selection_type: match.selection_type ?? "club",
      // Personal competition flags (athlete-created)
      is_personal: true,
      created_by_player_id: player_id,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("matches")
      .insert(allowed)
      .select("id")
      .single();
    if (insertError) throw insertError;

    // Auto-create lineup entry so the athlete is the sole participant
    await supabase.from("match_lineups").insert({
      match_id: inserted.id,
      player_id,
    });

    return respond({ success: true, match_id: inserted.id });
  } catch (e: any) {
    console.error("[athlete-create-match] error:", e);
    return respond({ success: false, error: e?.message || "Erreur serveur" }, 500);
  }
});
