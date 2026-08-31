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

  const respond = (data: unknown) =>
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST") {
      return respond({ success: false, error: "Méthode non autorisée" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return respond({ success: false, error: "Configuration backend manquante" });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!jwt) {
      return respond({ success: false, error: "Authentification requise" });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    const userId = userData.user?.id;

    if (userError || !userId) {
      return respond({ success: false, error: "Session invalide" });
    }

    const body = await req.json();
    const {
      category_id,
      player_id,
      session_date,
      training_type,
      session_start_time,
      session_end_time,
      intensity,
      notes,
      session_blocks,
      exercises,
      partner_player_ids,
    } = body ?? {};

    if (!category_id || !player_id || !session_date || !training_type) {
      return respond({ success: false, error: "Données manquantes" });
    }

    // Check player access: athlete owns the player OR staff/admin has category access
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, user_id")
      .eq("id", player_id)
      .maybeSingle();

    if (playerError) throw playerError;
    if (!player) {
      return respond({ success: false, error: "Joueur introuvable" });
    }

    // If the logged-in user is NOT the player owner, check if they have staff access
    if (player.user_id !== userId) {
      const { data: hasAccess } = await supabase.rpc("can_access_category", {
        _user_id: userId,
        _category_id: category_id,
      });
      const { data: isSA } = await supabase.rpc("is_super_admin", {
        _user_id: userId,
      });
      if (!hasAccess && !isSA) {
        return respond({ success: false, error: "Accès refusé pour ce joueur" });
      }
    }

    // Verify player has access to this category (primary or via player_categories)
    const { data: primaryMatch } = await supabase
      .from("players")
      .select("id")
      .eq("id", player_id)
      .eq("category_id", category_id)
      .maybeSingle();

    if (!primaryMatch) {
      const { data: pcMatch } = await supabase
        .from("player_categories")
        .select("id")
        .eq("player_id", player_id)
        .eq("category_id", category_id)
        .eq("status", "accepted")
        .maybeSingle();

      if (!pcMatch) {
        return respond({ success: false, error: "Accès refusé pour cette catégorie" });
      }
    }

    // ── Coéquipiers déclarés par l'athlète (même catégorie) ──
    const requestedPartners: string[] = Array.isArray(partner_player_ids)
      ? Array.from(new Set(partner_player_ids.filter((id: unknown) => typeof id === "string" && id && id !== player_id)))
      : [];

    let partnerIds: string[] = [];
    if (requestedPartners.length > 0) {
      const { data: directPartners } = await supabase
        .from("players")
        .select("id")
        .in("id", requestedPartners)
        .eq("category_id", category_id);
      const { data: linkedPartners } = await supabase
        .from("player_categories")
        .select("player_id")
        .in("player_id", requestedPartners)
        .eq("category_id", category_id)
        .eq("status", "accepted");
      partnerIds = Array.from(
        new Set([
          ...(directPartners || []).map((p: { id: string }) => p.id),
          ...(linkedPartners || []).map((p: { player_id: string }) => p.player_id),
        ]),
      );
    }

    const rawIntensity =
      typeof intensity === "number"
        ? intensity
        : typeof intensity === "string" && intensity.trim() !== ""
          ? Number(intensity)
          : null;
    const parsedIntensity = rawIntensity !== null && !Number.isNaN(rawIntensity) && rawIntensity >= 1 && rawIntensity <= 10 ? rawIntensity : null;

    const { data: session, error: sessionError } = await supabase
      .from("training_sessions")
      .insert({
        category_id,
        session_date,
        training_type,
        session_start_time: session_start_time || null,
        session_end_time: session_end_time || null,
        intensity: Number.isNaN(parsedIntensity) ? null : parsedIntensity,
        created_by_player_id: player_id,
        notes: notes ? `[Séance athlète] ${notes}` : "[Séance athlète]",
      })
      .select("id")
      .single();

    if (sessionError) throw sessionError;

    // Insert session blocks
    const blockRecords = Array.isArray(session_blocks)
      ? session_blocks
          .filter((block) => block?.training_type)
          .map((block, idx) => ({
            training_session_id: session.id,
            block_order: idx,
            start_time: block.start_time || null,
            end_time: block.end_time || null,
            training_type: block.training_type,
            theme: block.theme || null,
            duration_minutes: block.duration_minutes ?? null,
            intensity: block.intensity ?? null,
            notes: block.notes || null,
            session_type: block.session_type || null,
            objective: block.objective || null,
            target_intensity: block.target_intensity ?? null,
            volume: block.volume ?? null,
            contact_charge: block.contact_charge ?? null,
            bowling_exercise_type: block.bowling_exercise_type || null,
            throwing_implement: block.throwing_implement || null,
            implement_weight_g: block.implement_weight_g ?? null,
          }))
      : [];


    if (blockRecords.length > 0) {
      const { error: blocksError } = await supabase
        .from("training_session_blocks")
        .insert(blockRecords);

      if (blocksError) {
        await supabase.from("training_sessions").delete().eq("id", session.id);
        throw blocksError;
      }
    }

    // Insert exercises
    const exerciseRecords = Array.isArray(exercises)
      ? exercises
          .filter((ex) => ex?.exercise_name?.trim())
          .map((ex, idx) => ({
            training_session_id: session.id,
            player_id,
            category_id,
            exercise_name: ex.exercise_name,
            exercise_category: ex.exercise_category || "autre",
            sets: typeof ex.sets === "number" ? ex.sets : (parseInt(ex.sets) || 3),
            reps: ex.reps != null ? (typeof ex.reps === "number" ? ex.reps : (parseInt(ex.reps) || null)) : null,
            weight_kg: ex.weight_kg != null ? Number(ex.weight_kg) || null : null,
            rest_seconds: ex.rest_seconds != null ? (typeof ex.rest_seconds === "number" ? ex.rest_seconds : (parseInt(ex.rest_seconds) || null)) : null,
            notes: ex.notes || null,
            order_index: idx,
            library_exercise_id: ex.library_exercise_id || null,
            set_type: ex.set_type || "normal",
            method: ex.method || ex.set_type || null,
            group_id: ex.group_id || null,
            group_order: ex.group_order ?? null,
            tempo: ex.tempo || null,
            drop_sets: ex.drop_sets ?? null,
            cluster_sets: ex.cluster_sets ?? null,
          }))
      : [];

    // Les exercices sont dupliqués pour chaque coéquipier afin qu'il puisse
    // saisir ses propres charges (tonnage / charge d'entraînement).
    const allExerciseRecords = exerciseRecords.length > 0
      ? [
          ...exerciseRecords,
          ...partnerIds.flatMap((pid) =>
            exerciseRecords.map((ex) => ({ ...ex, player_id: pid })),
          ),
        ]
      : [];

    if (allExerciseRecords.length > 0) {
      const { error: exercisesError } = await supabase
        .from("gym_session_exercises")
        .insert(allExerciseRecords);

      if (exercisesError) {
        // Cleanup on failure
        await supabase.from("training_session_blocks").delete().eq("training_session_id", session.id);
        await supabase.from("training_sessions").delete().eq("id", session.id);
        throw exercisesError;
      }
    }

    // Séance auto-créée par l'athlète → privée à lui seul.
    // On insère le créateur comme unique participant pour que le filtrage
    // côté calendrier athlète (event_participants) la masque aux autres joueurs.
    try {
      await supabase
        .from("event_participants")
        .insert(
          [player_id, ...partnerIds].map((pid) => ({
            training_session_id: session.id,
            player_id: pid,
          })),
        );
    } catch (partErr) {
      console.warn("[athlete-create-session] participant insert warn:", partErr);
    }

    // ── Alimenter la charge d'entraînement (awcr_tracking) ──
    // Quand l'athlète a renseigné RPE (intensity) et une durée (via start/end),
    // on crée immédiatement une entrée awcr_tracking pour que le workload
    // (EWMA/ACWR) reflète la séance sans attendre le remplissage auto de fin
    // de journée. Le trigger compute_ewma_loads recalculera les charges.
    try {
      let durationMin = 0;
      if (session_start_time && session_end_time) {
        const [sh, sm] = String(session_start_time).split(":").map(Number);
        const [eh, em] = String(session_end_time).split(":").map(Number);
        if ([sh, sm, eh, em].every((n) => !Number.isNaN(n))) {
          durationMin = Math.max(0, eh * 60 + em - (sh * 60 + sm));
        }
      }
      const rpe = parsedIntensity ?? 0;
      if (rpe > 0 && durationMin > 0) {
        const training_load = rpe * durationMin;
        const { error: awcrErr } = await supabase
          .from("awcr_tracking")
          .insert({
            player_id,
            category_id,
            session_date,
            training_session_id: session.id,
            rpe,
            duration_minutes: durationMin,
            training_load,
          });
        if (awcrErr) {
          console.warn("[athlete-create-session] awcr insert warn:", awcrErr.message);
        }
      }
    } catch (awcrErr) {
      console.warn("[athlete-create-session] awcr insert warn:", awcrErr);
    }

    // ── Notifier les coéquipiers ajoutés à la séance ──
    if (partnerIds.length > 0) {
      try {
        const { data: creator } = await supabase
          .from("players")
          .select("name")
          .eq("id", player_id)
          .maybeSingle();
        const creatorName = creator?.name || "Un athlète";

        const { data: partnerRows } = await supabase
          .from("players")
          .select("id, user_id")
          .in("id", partnerIds);

        const records = (partnerRows || [])
          .filter((p: { user_id: string | null }) => !!p.user_id)
          .map((p: { id: string; user_id: string }) => ({
            user_id: p.user_id,
            category_id,
            title: "🤝 Séance partagée",
            message: `${creatorName} t'a ajouté à une séance ${training_type} du ${session_date}. Ajoute ton RPE${training_type === "musculation" ? " et tes charges" : ""}.`,
            notification_type: "athlete_session",
            notification_subtype: "shared_session",
            priority: "normal",
            metadata: {
              player_id: p.id,
              created_by_player_id: player_id,
              session_id: session.id,
              training_type,
              session_date,
            },
          }));

        if (records.length > 0) {
          const { error: partnerNotifErr } = await supabase.from("notifications").insert(records);
          if (partnerNotifErr) {
            console.warn("[athlete-create-session] partner notif warn:", partnerNotifErr.message);
          }
        }
      } catch (partnerNotifyErr) {
        console.warn("[athlete-create-session] partner notify warn:", partnerNotifyErr);
      }
    }

    // ── Notifier le staff de la catégorie (in-app + push best-effort) ──
    try {
      const { data: playerInfo } = await supabase
        .from("players")
        .select("name")
        .eq("id", player_id)
        .maybeSingle();
      const playerName = playerInfo?.name || "Un athlète";

      const { data: catInfo } = await supabase
        .from("categories")
        .select("name")
        .eq("id", category_id)
        .maybeSingle();

      // Récupérer les staff de la catégorie (exclure les athlètes & le créateur)
      const { data: members } = await supabase
        .from("category_members")
        .select("user_id, role")
        .eq("category_id", category_id);
      const staffIds = Array.from(
        new Set(
          (members || [])
            .filter((m) => m.role && m.role !== "athlete" && m.user_id !== userId)
            .map((m) => m.user_id),
        ),
      );

      const title = "🏋️ Nouvelle séance d'athlète";
      const message = `${playerName} vient de se créer une séance ${training_type} le ${session_date}${catInfo?.name ? ` (${catInfo.name})` : ""}`;

      if (staffIds.length > 0) {
        const records = staffIds.map((uid) => ({
          user_id: uid,
          category_id,
          title,
          message,
          notification_type: "athlete_session",
          notification_subtype: "self_planned",
          priority: "normal",
          metadata: { player_id, session_id: session.id, training_type, session_date },
        }));
        const { error: notifErr } = await supabase.from("notifications").insert(records);
        if (notifErr) console.warn("[athlete-create-session] notif insert warn:", notifErr.message);

        // Note: pas de push OneSignal pour ce type — pastille in-app uniquement

      }
    } catch (notifyErr) {
      console.warn("[athlete-create-session] notify staff warn:", notifyErr);
    }

    return respond({ success: true, session_id: session.id });
  } catch (error: unknown) {
    const err = error as { message?: string; details?: string; hint?: string; code?: string; stack?: string };
    const message = err?.message || "Erreur inconnue";
    console.error("[athlete-create-session] Error:", JSON.stringify({
      message,
      details: err?.details,
      hint: err?.hint,
      code: err?.code,
      stack: err?.stack,
    }));
    const fullMessage = [message, err?.details, err?.hint].filter(Boolean).join(" | ");
    return respond({ success: false, error: fullMessage });
  }
});
