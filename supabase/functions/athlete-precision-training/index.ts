import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  const respond = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST")
      return respond({ success: false, error: "Méthode non autorisée" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey)
      return respond({ success: false, error: "Config manquante" }, 500);

    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!jwt)
      return respond({ success: false, error: "Authentification requise" }, 401);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: claimsData, error: claimsError } =
      await authClient.auth.getClaims(jwt);
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId)
      return respond({ success: false, error: "Session invalide" }, 401);

    const body = await req.json();
    const {
      category_id,
      player_id,
      session_date,
      exercise_label,
      zone_x,
      zone_y,
      attempts,
      successes,
    } = body ?? {};

    if (
      !category_id ||
      !player_id ||
      !session_date ||
      !exercise_label ||
      zone_x === undefined ||
      zone_y === undefined
    )
      return respond({ success: false, error: "Données manquantes" }, 400);

    const a = parseInt(String(attempts));
    const s = parseInt(String(successes));
    if (isNaN(a) || a <= 0 || isNaN(s) || s < 0 || s > a)
      return respond({ success: false, error: "Valeurs invalides" }, 400);

    // Authorize: athlete owns the player OR has staff access to the category
    const { data: player } = await supabase
      .from("players")
      .select("id, user_id, category_id")
      .eq("id", player_id)
      .maybeSingle();
    if (!player)
      return respond({ success: false, error: "Joueur introuvable" }, 404);

    if (player.user_id !== userId) {
      const { data: hasAccess } = await supabase.rpc("can_access_category", {
        _user_id: userId,
        _category_id: category_id,
      });
      const { data: isSA } = await supabase.rpc("is_super_admin", {
        _user_id: userId,
      });
      if (!hasAccess && !isSA)
        return respond({ success: false, error: "Accès refusé" }, 403);
    }

    if (player.category_id !== category_id) {
      const { data: pcMatch } = await supabase
        .from("player_categories")
        .select("id")
        .eq("player_id", player_id)
        .eq("category_id", category_id)
        .eq("status", "accepted")
        .maybeSingle();
      if (!pcMatch)
        return respond(
          { success: false, error: "Catégorie invalide pour ce joueur" },
          403,
        );
    }

    const { data, error } = await supabase
      .from("precision_training")
      .insert({
        category_id,
        player_id,
        session_date,
        exercise_label,
        zone_x: Number(zone_x),
        zone_y: Number(zone_y),
        attempts: a,
        successes: s,
        created_by_athlete: true,
      })
      .select("id")
      .single();

    if (error) throw error;
    return respond({ success: true, id: data.id });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("[athlete-precision-training]", e?.message);
    return respond({ success: false, error: e?.message || "Erreur" }, 500);
  }
});
