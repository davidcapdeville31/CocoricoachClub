import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const respond = (data: unknown) =>
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST") return respond({ success: false, error: "Méthode non autorisée" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return respond({ success: false, error: "Configuration backend manquante" });

    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!jwt) return respond({ success: false, error: "Authentification requise" });

    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    const userId = userData.user?.id;
    if (userError || !userId) return respond({ success: false, error: "Session invalide" });

    const { match_id, player_id } = (await req.json()) ?? {};
    if (!match_id || !player_id) return respond({ success: false, error: "Données manquantes" });

    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, user_id, category_id")
      .eq("id", player_id)
      .maybeSingle();
    if (playerError) throw playerError;
    if (!player) return respond({ success: false, error: "Joueur introuvable" });

    const isOwnerUser = player.user_id === userId;
    let isStaff = false;
    if (!isOwnerUser) {
      const { data: isSA } = await supabase.rpc("is_super_admin", { _user_id: userId });
      if (isSA) {
        isStaff = true;
      } else if (player.category_id) {
        const { data: hasAccess } = await supabase.rpc("can_access_category", {
          _user_id: userId,
          _category_id: player.category_id,
        });
        isStaff = !!hasAccess;
      }
      if (!isStaff) {
        const { data: pcRows } = await supabase
          .from("player_categories")
          .select("category_id")
          .eq("player_id", player_id)
          .eq("status", "accepted");
        for (const row of pcRows || []) {
          const { data: hasAccess } = await supabase.rpc("can_access_category", {
            _user_id: userId,
            _category_id: row.category_id,
          });
          if (hasAccess) { isStaff = true; break; }
        }
      }
      if (!isStaff) return respond({ success: false, error: "Accès refusé" });
    }

    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, is_personal, created_by_player_id")
      .eq("id", match_id)
      .maybeSingle();
    if (matchError) throw matchError;
    if (!match) return respond({ success: false, error: "Compétition introuvable" });

    // Athlète : ne peut supprimer QUE ses propres compétitions personnelles.
    // Staff : peut supprimer toute compétition (personnelle ou club).
    if (!isStaff) {
      if (!match.is_personal || match.created_by_player_id !== player_id) {
        return respond({
          success: false,
          error: "Seules vos compétitions personnelles peuvent être supprimées",
        });
      }
    }

    // Nettoyer les dépendances avant la suppression
    await supabase.from("match_lineups").delete().eq("match_id", match_id);
    await supabase.from("match_events").delete().eq("match_id", match_id);
    await supabase.from("player_match_stats").delete().eq("match_id", match_id);

    const { error: delError } = await supabase.from("matches").delete().eq("id", match_id);
    if (delError) throw delError;

    return respond({ success: true });
  } catch (e: any) {
    console.error("[athlete-delete-match] error:", e);
    return respond({ success: false, error: e?.message || "Erreur serveur" });
  }
});
