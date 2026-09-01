import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

    const body = await req.json().catch(() => null);
    const {
      category_id,
      session_id,
      player_id,
      session_date,
      training_type,
      session_start_time,
      session_end_time,
      intensity,
      notes,
      partner_player_ids,
    } = body ?? {};

    if (
      typeof category_id !== "string" || !UUID_RE.test(category_id) ||
      typeof session_id !== "string" || !UUID_RE.test(session_id) ||
      typeof player_id !== "string" || !UUID_RE.test(player_id) ||
      typeof session_date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(session_date) ||
      typeof training_type !== "string" ||
      training_type.length < 1 ||
      training_type.length > 100
    ) {
      return respond({ success: false, error: "Données de séance invalides" });
    }
    if (intensity !== undefined && (typeof intensity !== "number" || intensity < 1 || intensity > 10)) {
      return respond({ success: false, error: "L'intensité doit être comprise entre 1 et 10" });
    }
    if (notes !== undefined && (typeof notes !== "string" || notes.length > 10000)) {
      return respond({ success: false, error: "Les notes sont invalides" });
    }
    if (session_start_time !== undefined && session_start_time !== null && (typeof session_start_time !== "string" || !/^\d{2}:\d{2}(:\d{2})?$/.test(session_start_time))) {
      return respond({ success: false, error: "L'heure de début est invalide" });
    }
    if (session_end_time !== undefined && session_end_time !== null && (typeof session_end_time !== "string" || !/^\d{2}:\d{2}(:\d{2})?$/.test(session_end_time))) {
      return respond({ success: false, error: "L'heure de fin est invalide" });
    }
    if (partner_player_ids !== undefined && (!Array.isArray(partner_player_ids) || partner_player_ids.length > 50 || partner_player_ids.some((id: unknown) => typeof id !== "string" || !UUID_RE.test(id)))) {
      return respond({ success: false, error: "Les partenaires sont invalides" });
    }

    // Ownership: the logged-in user must own this player (or be staff of the category)
    const { data: player } = await supabase
      .from("players")
      .select("id, user_id, name, category_id")
      .eq("id", player_id)
      .maybeSingle();
    if (!player) return respond({ success: false, error: "Joueur introuvable" });

    const { data: session } = await supabase
      .from("training_sessions")
      .select("id, category_id, created_by_player_id, session_date, training_type")
      .eq("id", session_id)
      .maybeSingle();
    if (!session) return respond({ success: false, error: "Séance introuvable" });
    if (session.category_id !== category_id) {
      return respond({ success: false, error: "Catégorie invalide" });
    }

    const hasPrimaryCategory = player.category_id === category_id;
    let hasLinkedCategory = false;
    if (!hasPrimaryCategory) {
      const { data: linkedCategory } = await supabase
        .from("player_categories")
        .select("id")
        .eq("player_id", player_id)
        .eq("category_id", category_id)
        .eq("status", "accepted")
        .maybeSingle();
      hasLinkedCategory = Boolean(linkedCategory);
    }
    if (!hasPrimaryCategory && !hasLinkedCategory) {
      return respond({ success: false, error: "Accès refusé pour cette catégorie" });
    }

    const isOwnerUser = player.user_id === userId;
    let isStaff = false;
    if (!isOwnerUser) {
      const { data: isSA } = await supabase.rpc("is_super_admin", { _user_id: userId });
      if (isSA) isStaff = true;
      else {
        const { data: hasAccess } = await supabase.rpc("can_access_category", {
          _user_id: userId,
          _category_id: session.category_id,
        });
        isStaff = !!hasAccess;
      }
      if (!isStaff) return respond({ success: false, error: "Accès refusé" });
    }

    // An athlete can only edit sessions they created themselves
    if (isOwnerUser && session.created_by_player_id !== player_id) {
      return respond({ success: false, error: "Vous ne pouvez modifier que vos propres séances" });
    }

    const updates: Record<string, unknown> = {
      session_date,
      training_type,
      session_start_time: session_start_time || null,
      session_end_time: session_end_time || null,
      intensity: intensity ?? null,
      notes: notes ?? null,
    };

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("training_sessions")
        .update(updates)
        .eq("id", session_id);
      if (updateError) throw updateError;
    }

    // ── Coéquipiers : resynchroniser sans toucher aux participants externes ──
    if (Array.isArray(partner_player_ids)) {
      const requested: string[] = Array.from(
        new Set(
          partner_player_ids.filter(
            (id: unknown) => typeof id === "string" && id && id !== player_id,
          ),
        ),
      ) as string[];

      const categoryId = session.category_id;
      const { data: directPartners } = await supabase
        .from("players")
        .select("id")
        .eq("category_id", categoryId);
      const { data: linkedPartners } = await supabase
        .from("player_categories")
        .select("player_id")
        .eq("category_id", categoryId)
        .eq("status", "accepted");
      const localIds = new Set<string>([
        ...(directPartners || []).map((p: { id: string }) => p.id),
        ...(linkedPartners || []).map((p: { player_id: string }) => p.player_id),
      ]);
      const validRequested = requested.filter((id) => localIds.has(id));

      const { data: currentParticipants } = await supabase
        .from("event_participants")
        .select("player_id")
        .eq("training_session_id", session_id);
      const current = (currentParticipants || []).map((p: { player_id: string }) => p.player_id);

      // Supprimer uniquement les partenaires locaux retirés (jamais les externes)
      const toRemove = current.filter(
        (id) => id !== player_id && localIds.has(id) && !validRequested.includes(id),
      );
      if (toRemove.length > 0) {
        await supabase
          .from("event_participants")
          .delete()
          .eq("training_session_id", session_id)
          .in("player_id", toRemove);
      }

      const toAdd = validRequested.filter((id) => !current.includes(id));
      if (toAdd.length > 0) {
        await supabase.from("event_participants").insert(
          toAdd.map((id) => ({ training_session_id: session_id, player_id: id })),
        );
      }
    }

    // ── Notifier le staff de la catégorie : "Séance modifiée par ..." ──
    try {
      const categoryId = session.category_id;
      const playerName = player.name || "Un athlète";
      const { data: catInfo } = await supabase
        .from("categories")
        .select("name")
        .eq("id", categoryId)
        .maybeSingle();

      const { data: members } = await supabase
        .from("category_members")
        .select("user_id, role")
        .eq("category_id", categoryId);
      const staffIds = Array.from(
        new Set(
          (members || [])
            .filter((m) => m.role && m.role !== "athlete" && m.user_id !== userId)
            .map((m) => m.user_id),
        ),
      );

      if (staffIds.length > 0) {
        const finalDate = (updates.session_date as string) || session.session_date;
        const finalType = (updates.training_type as string) || session.training_type;
        const records = staffIds.map((uid) => ({
          user_id: uid,
          category_id: categoryId,
          title: "✏️ Séance modifiée par un athlète",
          message: `${playerName} a modifié sa séance ${finalType} du ${finalDate}${catInfo?.name ? ` (${catInfo.name})` : ""}`,
          notification_type: "athlete_session",
          notification_subtype: "self_updated",
          priority: "normal",
          metadata: { player_id, session_id, training_type: finalType, session_date: finalDate },
        }));
        const { error: notifErr } = await supabase.from("notifications").insert(records);
        if (notifErr) console.warn("[athlete-update-session] notif warn:", notifErr.message);
      }
    } catch (notifyErr) {
      console.warn("[athlete-update-session] notify staff warn:", notifyErr);
    }

    return respond({ success: true, session_id });
  } catch (error: unknown) {
    const err = error as { message?: string; details?: string; hint?: string };
    console.error("[athlete-update-session] error", err);
    return respond({
      success: false,
      error: [err?.message, err?.details, err?.hint].filter(Boolean).join(" | ") || "Erreur serveur",
    });
  }
});
