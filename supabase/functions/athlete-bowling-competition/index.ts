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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) return respond({ success: false, error: "Config manquante" }, 500);

    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!jwt) return respond({ success: false, error: "Authentification requise" }, 401);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(jwt);
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) {
      return respond({ success: false, error: "Session invalide" }, 401);
    }

    const body = await req.json();
    const { action, match_id, category_id, player_id } = body ?? {};
    if (!action || !match_id || !category_id || !player_id) {
      return respond({ success: false, error: "Données manquantes" }, 400);
    }

    // Authorize
    const { data: player } = await supabase
      .from("players")
      .select("id, user_id, category_id")
      .eq("id", player_id)
      .maybeSingle();
    if (!player) return respond({ success: false, error: "Joueur introuvable" }, 404);

    const isAthleteSelf = player.user_id === userId;
    let isStaff = false;
    if (!isAthleteSelf) {
      const { data: hasAccess } = await supabase.rpc("can_access_category", {
        _user_id: userId,
        _category_id: category_id,
      });
      const { data: isSA } = await supabase.rpc("is_super_admin", { _user_id: userId });
      isStaff = !!hasAccess || !!isSA;
      if (!isStaff) return respond({ success: false, error: "Accès refusé" }, 403);
    }

    // Verify match & ownership context
    const { data: matchRow } = await supabase
      .from("matches")
      .select("id, category_id, match_date, competition, opponent, location, is_personal, created_by_player_id")
      .eq("id", match_id)
      .maybeSingle();
    if (!matchRow) return respond({ success: false, error: "Compétition introuvable" }, 404);
    if (matchRow.category_id !== category_id) {
      return respond({ success: false, error: "Catégorie incohérente" }, 403);
    }

    const isOwnPersonalMatch =
      !!matchRow.is_personal && matchRow.created_by_player_id === player_id && isAthleteSelf;

    // ===== LOAD =====
    if (action === "load") {
      // Only return patterns explicitly assigned to THIS player on THIS match.
      // The athlete starts from a blank state and picks a preset or builds a custom one.
      const { data: assignedRows } = await supabase
        .from("bowling_oil_pattern_players")
        .select("oil_pattern_id")
        .eq("player_id", player_id);
      const assignedIds = (assignedRows || []).map((r: any) => r.oil_pattern_id);

      let oilPatterns: any[] = [];
      if (assignedIds.length > 0) {
        const { data } = await supabase
          .from("bowling_oil_patterns")
          .select("*")
          .in("id", assignedIds)
          .eq("match_id", match_id)
          .order("created_at");
        oilPatterns = data || [];
      }
      const assigned_pattern_ids: string[] = oilPatterns.map((p: any) => p.id);

      const { data: rounds } = await supabase
        .from("competition_rounds")
        .select("*, competition_round_stats(*)")
        .eq("match_id", match_id)
        .eq("player_id", player_id)
        .order("round_number");

      return respond({
        success: true,
        match: matchRow,
        oil_patterns: oilPatterns || [],
        assigned_pattern_ids,
        rounds: rounds || [],
        can_delete_existing_patterns: isOwnPersonalMatch || isStaff,
      });
    }

    // ===== SAVE =====
    if (action === "save") {
      const {
        deleted_pattern_ids = [],
        oil_patterns = [],
        rounds = [],
      } = body;

      // 1) Delete patterns (only if allowed)
      if (Array.isArray(deleted_pattern_ids) && deleted_pattern_ids.length > 0) {
        if (!isOwnPersonalMatch && !isStaff) {
          return respond({ success: false, error: "Suppression de huilage non autorisée" }, 403);
        }
        await supabase
          .from("bowling_oil_patterns")
          .delete()
          .in("id", deleted_pattern_ids);
      }

      // 2) Upsert patterns
      const clientKeyToId: Record<string, string> = {};
      for (const p of oil_patterns) {
        const payload: any = {
          category_id,
          match_id,
          name: p.name || "Pattern personnalisé",
          gender: p.gender || null,
          length_feet: p.length_feet,
          buff_distance_feet: p.buff_distance_feet,
          width_boards: p.width_boards,
          total_volume_ml: p.total_volume_ml,
          oil_ratio: p.oil_ratio,
          profile_type: p.profile_type,
          forward_oil: p.forward_oil ?? true,
          reverse_oil: p.reverse_oil ?? true,
          outside_friction: p.outside_friction,
          notes: p.notes,
        };
        let patternId = p.id as string | undefined;
        if (patternId) {
          const { error: upErr } = await supabase
            .from("bowling_oil_patterns")
            .update(payload)
            .eq("id", patternId);
          if (upErr) throw upErr;
        } else {
          const { data: inserted, error: insErr } = await supabase
            .from("bowling_oil_patterns")
            .insert(payload)
            .select("id")
            .single();
          if (insErr) throw insErr;
          patternId = inserted.id;
        }
        if (p.client_key && patternId) clientKeyToId[p.client_key] = patternId;

        // Manage this player's assignment for this pattern
        if (patternId) {
          if (p.assigned) {
            // Insert if not present
            const { data: existing } = await supabase
              .from("bowling_oil_pattern_players")
              .select("oil_pattern_id")
              .eq("oil_pattern_id", patternId)
              .eq("player_id", player_id)
              .maybeSingle();
            if (!existing) {
              await supabase
                .from("bowling_oil_pattern_players")
                .insert({ oil_pattern_id: patternId, player_id });
            }
          } else {
            await supabase
              .from("bowling_oil_pattern_players")
              .delete()
              .eq("oil_pattern_id", patternId)
              .eq("player_id", player_id);
          }
        }
      }

      // 3) Replace this player's rounds
      // Fetch existing round ids to delete stats first
      const { data: existingRounds } = await supabase
        .from("competition_rounds")
        .select("id")
        .eq("match_id", match_id)
        .eq("player_id", player_id);
      const existingRoundIds = (existingRounds || []).map((r: any) => r.id);
      if (existingRoundIds.length > 0) {
        await supabase.from("competition_round_stats").delete().in("round_id", existingRoundIds);
        await supabase.from("competition_rounds").delete().in("id", existingRoundIds);
      }

      let n = 0;
      for (const round of rounds) {
        n += 1;
        const roundPayload: any = {
          match_id,
          player_id,
          round_number: n,
          opponent_name: round.opponent_name || null,
          result: round.result || null,
          notes: round.notes || null,
          phase: round.phase || null,
          lane: round.lane ?? null,
          current_conditions: round.current_conditions ?? null,
          temperature_celsius: round.temperature_celsius ?? null,
        };
        const { data: roundRow, error: roundErr } = await supabase
          .from("competition_rounds")
          .insert(roundPayload)
          .select("id")
          .single();
        if (roundErr) throw roundErr;

        const statData: any = {
          ...(round.stats || {}),
          ...(round.bowlingFrames ? { bowlingFrames: round.bowlingFrames } : {}),
          ...(round.bowlingCategory ? { bowlingCategory: round.bowlingCategory } : {}),
          ...(round.roundDate ? { roundDate: round.roundDate } : {}),
          ...(round.blockId ? { blockId: round.blockId } : {}),
          ...(round.ballData ? { ballData: round.ballData } : {}),
        };
        if (Object.keys(statData).length > 0) {
          const { error: statErr } = await supabase
            .from("competition_round_stats")
            .insert({ round_id: roundRow.id, stat_data: JSON.parse(JSON.stringify(statData)) });
          if (statErr) throw statErr;
        }
      }

      return respond({ success: true, client_key_to_id: clientKeyToId });
    }

    // ===== SAVE SINGLE PATTERN =====
    if (action === "save_pattern") {
      const p = body.pattern;
      if (!p) return respond({ success: false, error: "Huilage manquant" }, 400);

      const payload: any = {
        category_id,
        match_id,
        name: p.name || "Pattern personnalisé",
        gender: p.gender || null,
        length_feet: p.length_feet,
        buff_distance_feet: p.buff_distance_feet,
        width_boards: p.width_boards,
        total_volume_ml: p.total_volume_ml,
        oil_ratio: p.oil_ratio,
        profile_type: p.profile_type,
        forward_oil: p.forward_oil ?? true,
        reverse_oil: p.reverse_oil ?? true,
        outside_friction: p.outside_friction,
        notes: p.notes,
      };

      let patternId = p.id as string | undefined;
      if (patternId) {
        const { error: upErr } = await supabase
          .from("bowling_oil_patterns")
          .update(payload)
          .eq("id", patternId);
        if (upErr) throw upErr;
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from("bowling_oil_patterns")
          .insert(payload)
          .select("id")
          .single();
        if (insErr) throw insErr;
        patternId = inserted.id;
      }

      // Auto-assign this pattern to the athlete (since saving from athlete side)
      const assign = p.assigned !== false;
      if (patternId) {
        if (assign) {
          const { data: existing } = await supabase
            .from("bowling_oil_pattern_players")
            .select("oil_pattern_id")
            .eq("oil_pattern_id", patternId)
            .eq("player_id", player_id)
            .maybeSingle();
          if (!existing) {
            await supabase
              .from("bowling_oil_pattern_players")
              .insert({ oil_pattern_id: patternId, player_id });
          }
        } else {
          await supabase
            .from("bowling_oil_pattern_players")
            .delete()
            .eq("oil_pattern_id", patternId)
            .eq("player_id", player_id);
        }
      }

      return respond({ success: true, pattern_id: patternId });
    }

    // ===== SAVE SINGLE ROUND =====
    if (action === "save_round") {
      const round = body.round;
      if (!round || typeof round.round_number !== "number") {
        return respond({ success: false, error: "Partie manquante" }, 400);
      }

      // Delete existing round for this player+match+round_number (if any)
      const { data: existing } = await supabase
        .from("competition_rounds")
        .select("id")
        .eq("match_id", match_id)
        .eq("player_id", player_id)
        .eq("round_number", round.round_number);
      const ids = (existing || []).map((r: any) => r.id);
      if (ids.length > 0) {
        await supabase.from("competition_round_stats").delete().in("round_id", ids);
        await supabase.from("competition_rounds").delete().in("id", ids);
      }

      const { data: roundRow, error: roundErr } = await supabase
        .from("competition_rounds")
        .insert({
          match_id,
          player_id,
          round_number: round.round_number,
          opponent_name: round.opponent_name || null,
          result: round.result || null,
          notes: round.notes || null,
          phase: round.phase || null,
          lane: round.lane ?? null,
          current_conditions: round.current_conditions ?? null,
          temperature_celsius: round.temperature_celsius ?? null,
        })
        .select("id")
        .single();
      if (roundErr) throw roundErr;

      const statData: any = {
        ...(round.stats || {}),
        ...(round.bowlingFrames ? { bowlingFrames: round.bowlingFrames } : {}),
        ...(round.bowlingCategory ? { bowlingCategory: round.bowlingCategory } : {}),
        ...(round.roundDate ? { roundDate: round.roundDate } : {}),
        ...(round.blockId ? { blockId: round.blockId } : {}),
        ...(round.ballData ? { ballData: round.ballData } : {}),
      };
      if (Object.keys(statData).length > 0) {
        const { error: statErr } = await supabase
          .from("competition_round_stats")
          .insert({ round_id: roundRow.id, stat_data: JSON.parse(JSON.stringify(statData)) });
        if (statErr) throw statErr;
      }

      return respond({ success: true, round_id: roundRow.id });
    }

    return respond({ success: false, error: "Action inconnue" }, 400);
  } catch (error: unknown) {
    const err = error as { message?: string; details?: string; hint?: string };
    console.error("[athlete-bowling-competition]", JSON.stringify(err));
    return respond(
      { success: false, error: [err?.message, err?.details, err?.hint].filter(Boolean).join(" | ") || "Erreur" },
      500,
    );
  }
});
