/**
 * tag-session-participants
 *
 * Tags each participant of a training session in OneSignal so they can be
 * targeted precisely per-session, regardless of shared URLs or category.
 *
 * Tags written per player:
 *   participates_training_<session_id> = "true"   (precise per-session targeting)
 *   role                               = "athlete" (general role)
 *   club_id                            = "<club_id>" (club targeting)
 *
 * Usage:
 *   POST /tag-session-participants
 *   {
 *     "session_id": "<uuid>",
 *     "player_ids": ["<uuid>", ...],
 *     "club_id": "<uuid>",          // optional — enriches general tags
 *     "action": "add" | "remove"    // default: add
 *   }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TagRequest {
  session_id: string;
  player_ids: string[];
  club_id?: string;
  action?: "add" | "remove"; // default: add
}

interface TagResult {
  player_id: string;
  user_id: string;
  status: "tagged" | "skipped" | "error";
  reason?: string;
  onesignal_response?: unknown;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
    const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      throw new Error("OneSignal credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: TagRequest = await req.json();
    const { session_id, player_ids, club_id, action = "add" } = body;

    if (!session_id) throw new Error("session_id is required");
    if (!player_ids || player_ids.length === 0) {
      console.log(`[tag-session-participants] No player_ids provided for session ${session_id}`);
      return new Response(
        JSON.stringify({ success: true, tagged: 0, skipped: 0, errors: [], details: [], message: "No player_ids provided" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve player_ids → user_ids (only players with an active account)
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id, user_id, name")
      .in("id", player_ids)
      .not("user_id", "is", null);

    if (playersError) throw playersError;

    const tagKey = `participates_training_${session_id}`;
    const tagValue = action === "add" ? "true" : ""; // empty string removes the tag in OneSignal
    const detailedResults: TagResult[] = [];
    let tagged = 0;
    let skipped = 0;
    const errors: string[] = [];

    console.log(`[tag-session-participants] ── Session: ${session_id} ──────────────────────`);
    console.log(`[tag-session-participants] Action: ${action}`);
    console.log(`[tag-session-participants] Player IDs received: ${player_ids.length}`);
    console.log(`[tag-session-participants] Players with accounts: ${players?.length ?? 0}`);
    if (club_id) console.log(`[tag-session-participants] Club ID: ${club_id}`);

    // Log players without accounts
    const playerMap = new Map((players ?? []).map((p) => [p.id, p]));
    for (const pid of player_ids) {
      if (!playerMap.has(pid)) {
        console.warn(`[tag-session-participants] ⚠️  Player ${pid} — no user account (not subscribed)`);
        detailedResults.push({ player_id: pid, user_id: "N/A", status: "skipped", reason: "no user account" });
        skipped++;
      }
    }

    // Tag each player in OneSignal
    for (const player of players ?? []) {
      if (!player.user_id) {
        detailedResults.push({ player_id: player.id, user_id: "N/A", status: "skipped", reason: "null user_id" });
        skipped++;
        continue;
      }

      // Build tag payload
      const tags: Record<string, string> = {
        [tagKey]: tagValue,
        training_id: action === "add" ? session_id : "", // backwards compatibility
      };

      // Add general role/club tags when tagging (not removing)
      if (action === "add") {
        tags.role = "athlete";
        tags.user_type = "player";
        if (club_id) tags.club_id = club_id;
      }

      const url = `https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/users/by/external_id/${player.user_id}`;

      try {
        const res = await fetch(url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
          },
          body: JSON.stringify({ tags }),
        });

        const json = await res.json();

        if (res.ok) {
          tagged++;
          const result: TagResult = {
            player_id: player.id,
            user_id: player.user_id,
            status: "tagged",
            onesignal_response: json,
          };
          detailedResults.push(result);
          console.log(
            `[tag-session-participants] ✅ ${action} "${tagKey}" — Player: ${player.name ?? player.id} | User: ${player.user_id}`
          );
        } else {
          const reason = JSON.stringify(json);
          errors.push(`user ${player.user_id} (${player.name}): ${reason}`);
          detailedResults.push({
            player_id: player.id,
            user_id: player.user_id,
            status: "error",
            reason,
          });
          console.error(
            `[tag-session-participants] ❌ Failed — Player: ${player.name ?? player.id} | User: ${player.user_id} | Error: ${reason}`
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`user ${player.user_id}: ${msg}`);
        detailedResults.push({
          player_id: player.id,
          user_id: player.user_id,
          status: "error",
          reason: msg,
        });
        console.error(`[tag-session-participants] ❌ Exception — User: ${player.user_id}:`, msg);
      }
    }

    console.log(`[tag-session-participants] ── Summary ──────────────────────────────────`);
    console.log(`[tag-session-participants] Tagged: ${tagged} | Skipped: ${skipped} | Errors: ${errors.length}`);
    if (errors.length > 0) {
      console.error(`[tag-session-participants] Errors:`, errors);
    }

    return new Response(
      JSON.stringify({
        success: true,
        session_id,
        tagKey,
        action,
        tagged,
        skipped,
        errors,
        details: detailedResults,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[tag-session-participants] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
