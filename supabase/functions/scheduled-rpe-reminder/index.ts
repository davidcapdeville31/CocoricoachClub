import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { filterByPreferences } from "../_shared/notification-preferences.ts";
import { isAuthorizedCronRequest } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const validateCronSecret = (req: Request): boolean => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) return false;
  const provided = req.headers.get("x-cron-secret");
  return !!provided && provided === cronSecret;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!(await isAuthorizedCronRequest(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID");
    const oneSignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

    if (!oneSignalAppId || !oneSignalApiKey) {
      throw new Error("OneSignal credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const baseHeaders = {
      "Content-Type": "application/json",
      Authorization: `Key ${oneSignalApiKey}`,
    };

    // Fuseau horaire par club : rappel 30 min après la fin de séance (heure locale)
    // + relance le lendemain à 8h00 locale si le RPE n'est toujours pas saisi.
    const now = new Date();
    const { data: clubs } = await supabase.from("clubs").select("id, timezone");
    const sel = `id, session_date, session_end_time, training_type, category_id,
        categories!inner(id, name, club_id, clubs!inner(name))`;
    const local = (d: Date, tz: string) => {
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
      const g = (t: string) => parts.find((x) => x.type === t)!.value;
      return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}`, hour: Number(g("hour")), minute: Number(g("minute")) };
    };
    const sessions: any[] = [];
    for (const club of clubs || []) {
      const tz = club.timezone || "Europe/Paris";
      let from, to, nowL;
      try { from = local(new Date(now.getTime() - 60 * 60000), tz); to = local(new Date(now.getTime() - 30 * 60000), tz); nowL = local(now, tz); } catch { continue; }
      // Séances terminées il y a 30 à 60 min (le cron tourne toutes les 30 min)
      if (from.date === to.date) {
        const { data } = await supabase.from("training_sessions").select(sel)
          .eq("categories.club_id", club.id).eq("session_date", to.date)
          .not("session_end_time", "is", null)
          .gt("session_end_time", from.time).lte("session_end_time", to.time + ":59");
        for (const x of data || []) sessions.push({ ...x, kind: "rpe_reminder" });
      }
      // Relance du lendemain 8h00
      if (nowL.hour === 8 && nowL.minute < 30) {
        const y = local(new Date(now.getTime() - 24 * 3600000), tz).date;
        const { data } = await supabase.from("training_sessions").select(sel)
          .eq("categories.club_id", club.id).eq("session_date", y);
        for (const x of data || []) sessions.push({ ...x, kind: "rpe_reminder_followup" });
      }
    }
    console.log(`[rpe] ${sessions.length} session(s) to remind`);

    if (sessions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No sessions to remind" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalPushSent = 0;
    const results: any[] = [];

    for (const session of sessions) {
      // Get players who participated (from attendance or all players if no attendance)
      const { data: attendance } = await supabase
        .from("training_attendance")
        .select("player_id")
        .eq("training_session_id", session.id)
        .eq("status", "present");

      let playerIds: string[] = [];

      if (attendance && attendance.length > 0) {
        playerIds = attendance.map((a) => a.player_id);
      } else {
        // Fallback: get all players from category
        const { data: allPlayers } = await supabase
          .from("players")
          .select("id")
          .eq("category_id", session.category_id);

        // Ne jamais relancer les athlètes qui se sont déclarés absents
        const { data: absentParts } = await supabase
          .from("event_participants")
          .select("player_id")
          .eq("training_session_id", session.id)
          .eq("attendance_status", "absent");
        const absentIds = new Set((absentParts || []).map((p: any) => p.player_id));

        if (allPlayers) {
          playerIds = allPlayers.map((p) => p.id).filter((id: string) => !absentIds.has(id));

        }
      }

      if (playerIds.length === 0) continue;

      // Check which players already submitted RPE for this session
      const { data: existingRpe } = await supabase
        .from("awcr_tracking")
        .select("player_id")
        .eq("training_session_id", session.id)
        .in("player_id", playerIds);

      const submittedPlayerIds = new Set(existingRpe?.map((r) => r.player_id) || []);
      const pendingPlayerIds = playerIds.filter((pid) => !submittedPlayerIds.has(pid));

      if (pendingPlayerIds.length === 0) {
        console.log(`[rpe] Session ${session.id}: all ${playerIds.length} players already submitted RPE, skipping`);
        continue;
      }

      console.log(
        `[rpe] Session ${session.id}: ${pendingPlayerIds.length}/${playerIds.length} players pending RPE`
      );

      // Get player contact info for pending players
      const { data: players, error: playersError } = await supabase
        .from("players")
        .select("id, name, email, phone, user_id")
        .in("id", pendingPlayerIds);

      if (playersError || !players) continue;

      const category = session.categories as any;
      const trainingTypeLabel = getTrainingTypeLabel(session.training_type);
      const isStrength = session.training_type === "gym" || session.training_type === "physical";

      // Deep link URL for quick access
      const appBaseUrl = "https://cocoricoachclub.com";
      const rpeDeepLink = `${appBaseUrl}/athlete-space?tab=rpe`;

      const isFollowup = session.kind === "rpe_reminder_followup";
      const tonnageHint = isStrength
        ? " (et le tonnage si ton coach ne l'a pas encore renseigné)"
        : "";

      let alreadyNotified = new Set<string>();
      // ── IN-APP NOTIFICATIONS (cloche rouge) ─────────────────────────────
      try {
        // Dédup: ne pas réinsérer si déjà créée pour cette session
        const { data: existingNotifs } = await supabase
          .from("notifications")
          .select("user_id")
          .eq("notification_type", session.kind)
          .filter("metadata->>session_id", "eq", session.id);

        alreadyNotified = new Set(
          (existingNotifs ?? []).map((n: any) => n.user_id),
        );

        const inAppRows = players
          .filter((p) => p.user_id && !alreadyNotified.has(p.user_id))
          .map((p) => ({
            user_id: p.user_id!,
            category_id: session.category_id,
            notification_type: session.kind,
            notification_subtype: session.training_type,
            title: isFollowup ? "RPE d'hier non renseigné ⏰" : "RPE à renseigner 💪",
            message: isFollowup ? `Tu n'as pas encore donné ton RPE pour ta séance "${trainingTypeLabel}" d'hier (${category.name}).` : `Ta séance "${trainingTypeLabel}" (${category.name}) est terminée. Pense à renseigner ton RPE${tonnageHint}.`,
            is_read: false,
            priority: "normal",
            metadata: {
              session_id: session.id,
              category_id: session.category_id,
              training_type: session.training_type,
              url: rpeDeepLink,
            },
          }));

        if (inAppRows.length > 0) {
          const { error: insertErr } = await supabase
            .from("notifications")
            .insert(inAppRows);
          if (insertErr) {
            console.error(`[rpe] In-app insert error for session ${session.id}:`, insertErr);
          } else {
            console.log(`[rpe] In-app notifications created: ${inAppRows.length} for session ${session.id}`);
          }
        }
      } catch (e) {
        console.error("[rpe] In-app notification error:", e);
        continue;
      }

      // Filter recipients by per-user notification preferences (push only — pas d'email pour ce rappel)
      const allUserIds = players.filter((p) => p.user_id).map((p) => p.user_id!);
      const { pushUserIds: allowedPushUserIds } =
        await filterByPreferences(supabase, allUserIds, "rpe_reminder");
      const allowedPushSet = new Set(allowedPushUserIds);


      // ── PUSH via OneSignal (external_id targeting) ─────────────────────
      const pushUserIds = players
        .filter((p) => p.user_id && allowedPushSet.has(p.user_id!) && !alreadyNotified.has(p.user_id!))
        .map((p) => p.user_id!);

      if (pushUserIds.length > 0) {
        try {
          const response = await fetch("https://api.onesignal.com/notifications", {
            method: "POST",
            headers: baseHeaders,
            body: JSON.stringify({
              app_id: oneSignalAppId,
              include_aliases: { external_id: pushUserIds },
              target_channel: "push",
              headings: {
                fr: isFollowup ? "RPE d'hier non renseigné ⏰" : "Comment s'est passée la séance ? 💪",
                en: "How did your session go? 💪",
              },
              contents: {
                fr: isFollowup ? `Donne ton RPE pour "${trainingTypeLabel}" d'hier (${category.name}) en 10 secondes !` : `"${trainingTypeLabel}" (${category.name}) est terminée. Donne ton RPE${tonnageHint} en 10 secondes !`,
                en: `"${trainingTypeLabel}" (${category.name}) is done. Log your RPE${tonnageHint} in 10s!`,
              },
              web_url: rpeDeepLink,
              ttl: 7200,
              web_push_topic: `${session.kind}-${session.id}`,
              data: {
                type: "rpe_reminder",
                session_id: session.id,
                category_id: session.category_id,
                url: rpeDeepLink,
              },
            }),
          });

          const json = await response.json();
          if (response.ok) {
            totalPushSent += json.recipients ?? pushUserIds.length;
            console.log(`[rpe] Push sent to ${json.recipients ?? pushUserIds.length} device(s) for session ${session.id}`);
          } else {
            console.error(`[rpe] Push error for session ${session.id}:`, json);
          }
        } catch (error) {
          console.error("[rpe] Push send error:", error);
        }
      }

      results.push({
        session_id: session.id,
        category: category.name,
        training_type: trainingTypeLabel,
        totalPlayers: playerIds.length,
        alreadySubmitted: submittedPlayerIds.size,
        pushTargeted: pushUserIds.length,
        type: session.kind,
      });
    }

    console.log(`[rpe] Total: ${totalPushSent} push sent`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${totalPushSent} push sent`,
        pushSent: totalPushSent,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in scheduled-rpe-reminder:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getTrainingTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    physical: "Préparation Physique",
    technical: "Technique",
    tactical: "Tactique",
    collective: "Collectif",
    video: "Analyse Vidéo",
    recovery: "Récupération",
    gym: "Musculation",
    cardio: "Cardio",
    sprint: "Vitesse",
    flexibility: "Souplesse",
    match_prep: "Préparation Match",
    rehab: "Réathlétisation",
    warmup: "Échauffement",
    cooldown: "Retour au calme",
  };
  return labels[type] || type;
}
