import { createClient } from "npm:@supabase/supabase-js@2";
import { filterByPreferences } from "../_shared/notification-preferences.ts";
import { isAuthorizedCronRequest } from "../_shared/cron-auth.ts";

// Envoie le push OneSignal correspondant à une notification in-app
// (assignation à une séance, convocation compétition). Appelé par trigger DB.
const PREF: Record<string, "sessions" | "convocations"> = {
  session_assignment: "sessions",
  match_convocation: "convocations",
};

Deno.serve(async (req) => {
  if (!(await isAuthorizedCronRequest(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  try {
    const { notification_id } = await req.json();
    if (typeof notification_id !== "string") {
      return new Response(JSON.stringify({ error: "notification_id required" }), { status: 400 });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: n } = await supabase.from("notifications")
      .select("id, user_id, notification_type, title, message, metadata").eq("id", notification_id).maybeSingle();
    if (!n || !PREF[n.notification_type]) return new Response(JSON.stringify({ skipped: true }));

    const { pushUserIds } = await filterByPreferences(supabase, [n.user_id], PREF[n.notification_type]);
    if (pushUserIds.length === 0) return new Response(JSON.stringify({ skipped: "preferences" }));

    const url = n.notification_type === "match_convocation"
      ? "https://cocoricoachclub.com/athlete-space?tab=calendar"
      : "https://cocoricoachclub.com/athlete-space?tab=calendar";
    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${Deno.env.get("ONESIGNAL_REST_API_KEY")}` },
      body: JSON.stringify({
        app_id: Deno.env.get("ONESIGNAL_APP_ID"),
        include_aliases: { external_id: pushUserIds },
        target_channel: "push",
        headings: { fr: n.title, en: n.title },
        contents: { fr: n.message, en: n.message },
        web_url: url,
        web_push_topic: `${n.notification_type}-${(n.metadata as any)?.session_id ?? (n.metadata as any)?.match_id ?? n.id}`,
        data: { type: n.notification_type, url, ...(n.metadata as object) },
      }),
    });
    const json = await res.json();
    console.log(`[push-from-notification] ${n.notification_type} → ${res.status}`, json?.id ?? json);
    return new Response(JSON.stringify({ ok: res.ok, result: json }), { headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[push-from-notification]", e);
    return new Response(JSON.stringify({ error: e?.message }), { status: 500 });
  }
});
