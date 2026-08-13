import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAuthorizedCronRequest } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

/**
 * Bilan RPE par entraînement.
 * Tourne toutes les 30 min : pour chaque séance terminée (>= 2h) ou complétée par
 * tous les athlètes, crée UNE notification récapitulative pour le staff de la catégorie.
 * Toutes disciplines confondues.
 */
const MIN_MINUTES_AFTER_END = 120;

const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (!(await isAuthorizedCronRequest(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: clubs, error: clubsError } = await supabase
      .from("clubs")
      .select("id, name, timezone");
    if (clubsError) throw clubsError;

    let created = 0;
    const results: any[] = [];

    for (const club of clubs || []) {
      const tz = club.timezone || "Europe/Paris";
      let localNow: Date;
      try {
        localNow = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
      } catch {
        localNow = new Date();
      }
      const today = localDateStr(localNow);
      const yesterdayDate = new Date(localNow);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = localDateStr(yesterdayDate);

      const { data: categories } = await supabase
        .from("categories")
        .select("id, name")
        .eq("club_id", club.id);

      for (const category of categories || []) {
        const { data: players } = await supabase
          .from("players")
          .select("id")
          .eq("category_id", category.id);
        const playerIds = (players || []).map((p) => p.id);
        if (playerIds.length === 0) continue;

        const { data: sessions } = await supabase
          .from("training_sessions")
          .select("id, session_date, session_end_time, training_type, intensity")
          .eq("category_id", category.id)
          .in("session_date", [yesterday, today]);

        for (const session of sessions || []) {
          // La séance doit être terminée depuis au moins 2h (heure locale du club)
          const endTime = session.session_end_time || "23:59";
          const [eh, em] = String(endTime).split(":").map(Number);
          const endLocal = new Date(
            `${session.session_date}T${String(eh).padStart(2, "0")}:${String(em || 0).padStart(2, "0")}:00`,
          );
          const minutesSinceEnd = (localNow.getTime() - endLocal.getTime()) / 60000;

          const { data: rpeRows } = await supabase
            .from("awcr_tracking")
            .select("player_id, rpe, auto_filled, duration_minutes, training_load")
            .eq("training_session_id", session.id)
            .in("player_id", playerIds);

          const rows = rpeRows || [];
          const realRows = rows.filter((r) => !r.auto_filled);
          if (realRows.length === 0) continue;

          const everyoneDone = new Set(rows.map((r) => r.player_id)).size >= playerIds.length;
          if (!everyoneDone && minutesSinceEnd < MIN_MINUTES_AFTER_END) continue;

          // Dédoublonnage : une seule notification par séance
          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("notification_type", "session_rpe_digest")
            .filter("metadata->>session_id", "eq", session.id)
            .limit(1);
          if (existing && existing.length > 0) continue;

          const avgReal =
            realRows.reduce((s, r) => s + (r.rpe || 0), 0) / realRows.length;
          const autoCount = rows.length - realRows.length;
          const planned = session.intensity || 0;
          const gap = planned > 0 ? avgReal - planned : null;

          const { data: staffIds } = await supabase.rpc("category_staff_user_ids", {
            _category_id: category.id,
          });
          const recipients: string[] = (staffIds as string[]) || [];
          if (recipients.length === 0) continue;

          const [y, m, d] = session.session_date.split("-");
          const parts = [
            `${realRows.length}/${playerIds.length} athlète(s) ont renseigné leur RPE`,
            `RPE réel moyen : ${avgReal.toFixed(1)}/10`,
          ];
          if (planned > 0) {
            parts.push(
              `Prévu : ${planned}/10 (écart ${gap! > 0 ? "+" : ""}${gap!.toFixed(1)})`,
            );
          }
          if (autoCount > 0) parts.push(`${autoCount} complété(s) automatiquement`);

          const notifRows = recipients.map((userId) => ({
            user_id: userId,
            category_id: category.id,
            notification_type: "session_rpe_digest",
            notification_subtype: session.training_type,
            title: `${category.name} — Bilan RPE de la séance du ${d}/${m}/${y}`,
            message: parts.join(" • "),
            is_read: false,
            priority: gap !== null && Math.abs(gap) >= 2 ? "high" : "normal",
            metadata: {
              session_id: session.id,
              category_id: category.id,
              session_date: session.session_date,
              training_type: session.training_type,
              rpe_real_count: realRows.length,
              rpe_auto_count: autoCount,
              players_total: playerIds.length,
              avg_rpe: Number(avgReal.toFixed(1)),
              planned_intensity: planned,
            },
          }));

          const { error: insertError } = await supabase.from("notifications").insert(notifRows);
          if (insertError) {
            console.error(`[session-rpe-digest] Insert error (session ${session.id}):`, insertError);
          } else {
            created += notifRows.length;
            results.push({ session_id: session.id, category: category.name, recipients: recipients.length });
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, notifications: created, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[session-rpe-digest] Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error)?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
