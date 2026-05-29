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
    if (!supabaseUrl || !serviceKey) return respond({ success: false, error: "Config manquante" }, 500);

    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!jwt) return respond({ success: false, error: "Authentification requise" }, 401);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(jwt);
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) {
      console.error("[athlete-bowling-training] auth", claimsError?.message);
      return respond({ success: false, error: "Session invalide" }, 401);
    }

    const body = await req.json();
    const { action, category_id, player_id, session_date } = body ?? {};

    if (!action || !category_id || !player_id || !session_date) {
      return respond({ success: false, error: "Données manquantes" }, 400);
    }

    // Authorize: athlete owns the player OR has staff access
    const { data: player } = await supabase
      .from("players")
      .select("id, user_id, category_id")
      .eq("id", player_id)
      .maybeSingle();
    if (!player) return respond({ success: false, error: "Joueur introuvable" }, 404);

    if (player.user_id !== userId) {
      const { data: hasAccess } = await supabase.rpc("can_access_category", {
        _user_id: userId,
        _category_id: category_id,
      });
      const { data: isSA } = await supabase.rpc("is_super_admin", { _user_id: userId });
      if (!hasAccess && !isSA) return respond({ success: false, error: "Accès refusé" }, 403);
    }

    // Verify player belongs to category
    if (player.category_id !== category_id) {
      const { data: pcMatch } = await supabase
        .from("player_categories")
        .select("id")
        .eq("player_id", player_id)
        .eq("category_id", category_id)
        .eq("status", "accepted")
        .maybeSingle();
      if (!pcMatch) return respond({ success: false, error: "Catégorie invalide pour ce joueur" }, 403);
    }

    // ---- ACTION: save_game ----
    if (action === "save_game") {
      const { stats, frames, ballData } = body;
      if (!stats || !frames) return respond({ success: false, error: "Données partie manquantes" }, 400);

      // Find or create training match for the day
      let matchId: string | null = null;
      const { data: existingMatch } = await supabase
        .from("matches")
        .select("id")
        .eq("category_id", category_id)
        .eq("event_type", "training")
        .eq("match_date", session_date)
        .limit(1)
        .maybeSingle();

      if (existingMatch) {
        matchId = existingMatch.id;
      } else {
        const { data: newMatch, error: matchErr } = await supabase
          .from("matches")
          .insert({
            category_id,
            opponent: `Entraînement ${session_date}`,
            match_date: session_date,
            event_type: "training",
            is_home: true,
          })
          .select("id")
          .single();
        if (matchErr) throw matchErr;
        matchId = newMatch.id;
      }

      // Count existing rounds for this player to set round_number
      const { count } = await supabase
        .from("competition_rounds")
        .select("id", { count: "exact", head: true })
        .eq("match_id", matchId)
        .eq("player_id", player_id);

      const { data: round, error: roundErr } = await supabase
        .from("competition_rounds")
        .insert({
          match_id: matchId,
          player_id,
          round_number: (count || 0) + 1,
          result: String(stats.totalScore ?? 0),
          notes: ballData ? JSON.stringify(ballData) : null,
        })
        .select("id")
        .single();
      if (roundErr) throw roundErr;

      const statData = {
        frames,
        totalScore: stats.totalScore,
        strikes: stats.strikes,
        spares: stats.spares,
        splitCount: stats.splitCount,
        splitConverted: stats.splitConverted,
        singlePinCount: stats.singlePinCount,
        singlePinConverted: stats.singlePinConverted,
        pocketCount: stats.pocketCount,
        openFrames: stats.openFrames,
        strikePercentage: stats.strikePercentage,
        sparePercentage: stats.sparePercentage,
        splitPercentage: stats.splitPercentage,
        singlePinConversionRate: stats.singlePinConversionRate,
        pocketPercentage: stats.pocketPercentage,
        ballData,
      };

      const { error: statsErr } = await supabase
        .from("competition_round_stats")
        .insert({ round_id: round.id, stat_data: statData });
      if (statsErr) throw statsErr;

      return respond({ success: true, round_id: round.id, match_id: matchId });
    }

    // ---- ACTION: save_spare ----
    if (action === "save_spare") {
      const { exercise_type, attempts, successes } = body;
      const a = parseInt(String(attempts));
      const s = parseInt(String(successes));
      if (!exercise_type || isNaN(a) || a <= 0 || isNaN(s) || s < 0 || s > a) {
        return respond({ success: false, error: "Données invalides" }, 400);
      }

      const { error } = await supabase.from("bowling_spare_training").insert({
        player_id,
        category_id,
        exercise_type,
        attempts: a,
        successes: s,
        session_date,
      });
      if (error) throw error;

      return respond({ success: true });
    }

    // ---- ACTION: save_throw — saisie lancer-par-lancer ----
    if (action === "save_throw") {
      const { block_id, throw_payload } = body;
      if (!block_id || !throw_payload) {
        return respond({ success: false, error: "Données lancer manquantes" }, 400);
      }
      const { data: block } = await supabase
        .from("bowling_training_blocks")
        .select("id, category_id, athlete_id")
        .eq("id", block_id)
        .maybeSingle();
      if (!block) return respond({ success: false, error: "Bloc introuvable" }, 404);
      if (block.category_id !== category_id) {
        return respond({ success: false, error: "Bloc hors catégorie" }, 403);
      }
      const payload = { ...throw_payload, block_id, athlete_id: player_id };
      const { data, error } = await supabase
        .from("bowling_throw_results")
        .insert(payload)
        .select("id, foot_delta, breakpoint_delta")
        .single();
      if (error) throw error;
      return respond({ success: true, throw: data });
    }

    // ---- ACTION: save_training_game ----
    if (action === "save_training_game") {
      const { block_id, game_number, score, stats, frames, pattern_id, ball_arsenal_id } = body;
      if (!block_id || !game_number) {
        return respond({ success: false, error: "Données partie manquantes" }, 400);
      }
      const { data: block } = await supabase
        .from("bowling_training_blocks")
        .select("id, category_id")
        .eq("id", block_id)
        .maybeSingle();
      if (!block || block.category_id !== category_id) {
        return respond({ success: false, error: "Bloc invalide" }, 403);
      }
      const { error } = await supabase.from("bowling_training_games").insert({
        block_id,
        athlete_id: player_id,
        game_number,
        score: score ?? null,
        stats: stats ?? {},
        frames: frames ?? null,
        pattern_id: pattern_id ?? null,
        ball_arsenal_id: ball_arsenal_id ?? null,
      });
      if (error) throw error;
      return respond({ success: true });
    }

    // ---- ACTION: complete_block ----
    if (action === "complete_block") {
      const { block_id, debrief } = body;
      if (!block_id) return respond({ success: false, error: "Bloc requis" }, 400);
      const { error } = await supabase
        .from("bowling_training_blocks")
        .update({ status: "completed", debrief: debrief ?? null, updated_at: new Date().toISOString() })
        .eq("id", block_id)
        .eq("category_id", category_id);
      if (error) throw error;
      return respond({ success: true });
    }

    return respond({ success: false, error: "Action inconnue" }, 400);
  } catch (error: unknown) {
    const err = error as { message?: string; details?: string; hint?: string; code?: string };
    console.error("[athlete-bowling-training]", JSON.stringify(err));
    return respond({ success: false, error: [err?.message, err?.details, err?.hint].filter(Boolean).join(" | ") || "Erreur" }, 500);
  }
});
