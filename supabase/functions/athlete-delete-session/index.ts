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

    const { session_id, player_id } = (await req.json()) ?? {};
    if (!session_id || !player_id) return respond({ success: false, error: "Données manquantes" });

    // Vérifier que l'utilisateur est bien le propriétaire du player OU staff de la catégorie
    const { data: player } = await supabase
      .from("players")
      .select("id, user_id, category_id")
      .eq("id", player_id)
      .maybeSingle();

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
        // Vérifier via player_categories aussi
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

    // Charger la séance + participants
    const { data: session, error: sessionError } = await supabase
      .from("training_sessions")
      .select("id, created_by_player_id, event_participants(player_id)")
      .eq("id", session_id)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session) return respond({ success: false, error: "Séance introuvable" });

    const participants: { player_id: string }[] = (session as any).event_participants || [];
    const isOwner = session.created_by_player_id === player_id;
    const isSoloAssignee = participants.length > 0 && participants.every((p) => p.player_id === player_id);

    if (!isOwner && !isSoloAssignee) {
      // Séance partagée → on retire juste le joueur de la liste de participants
      if (participants.some((p) => p.player_id === player_id)) {
        const { error: unassignError } = await supabase
          .from("event_participants")
          .delete()
          .eq("training_session_id", session_id)
          .eq("player_id", player_id);
        if (unassignError) throw unassignError;
        return respond({ success: true, unassigned: true });
      }
      return respond({ success: false, error: "Vous ne pouvez pas supprimer cette séance" });
    }

    // Suppression complète : exos, blocs, participants, puis séance
    await supabase.from("gym_session_exercises").delete().eq("training_session_id", session_id);
    await supabase.from("training_session_blocks").delete().eq("training_session_id", session_id);
    await supabase.from("event_participants").delete().eq("training_session_id", session_id);

    const { error: deleteError } = await supabase
      .from("training_sessions")
      .delete()
      .eq("id", session_id);
    if (deleteError) throw deleteError;

    return respond({ success: true, deleted: true });
  } catch (e: any) {
    console.error("[athlete-delete-session] error", e);
    return respond({ success: false, error: e?.message || "Erreur serveur" }, 200);
  }
});
