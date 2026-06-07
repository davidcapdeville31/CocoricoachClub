import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const respond = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST") return respond({ success: false, error: "Méthode non autorisée" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return respond({ success: false, error: "Configuration backend manquante" }, 500);

    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!jwt) return respond({ success: false, error: "Authentification requise" }, 401);

    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    const userId = userData.user?.id;
    if (userError || !userId) return respond({ success: false, error: "Session invalide" }, 401);

    const { match_id, player_id } = (await req.json()) ?? {};
    if (!match_id || !player_id) return respond({ success: false, error: "Données manquantes" }, 400);

    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, user_id")
      .eq("id", player_id)
      .maybeSingle();
    if (playerError) throw playerError;
    if (!player) return respond({ success: false, error: "Joueur introuvable" }, 404);
    if (player.user_id !== userId) return respond({ success: false, error: "Accès refusé" }, 403);

    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, is_personal, created_by_player_id")
      .eq("id", match_id)
      .maybeSingle();
    if (matchError) throw matchError;
    if (!match) return respond({ success: false, error: "Compétition introuvable" }, 404);

    if (!match.is_personal || match.created_by_player_id !== player_id) {
      return respond(
        { success: false, error: "Seules vos compétitions personnelles peuvent être supprimées" },
        403,
      );
    }

    const { error: delError } = await supabase.from("matches").delete().eq("id", match_id);
    if (delError) throw delError;

    return respond({ success: true });
  } catch (e: any) {
    console.error("[athlete-delete-match] error:", e);
    return respond({ success: false, error: e?.message || "Erreur serveur" }, 500);
  }
});
