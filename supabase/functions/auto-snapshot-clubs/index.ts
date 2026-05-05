import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: clubs, error } = await supabase
      .from("clubs")
      .select("id, name, timezone, auto_backup_enabled, is_archived")
      .eq("is_active", true)
      .eq("is_archived", false);

    if (error) throw error;

    const eligible: { id: string; name: string }[] = [];
    for (const club of clubs ?? []) {
      if (club.auto_backup_enabled === false) continue;
      try {
        const tz = club.timezone || "Europe/Paris";
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).formatToParts(new Date());
        const weekday = parts.find((p) => p.type === "weekday")?.value;
        const hour = parts.find((p) => p.type === "hour")?.value;
        if (weekday === "Sun" && hour === "23") {
          eligible.push({ id: club.id, name: club.name });
        }
      } catch (e) {
        console.error(`[auto-snapshot] tz error ${club.name}:`, e);
      }
    }

    if (eligible.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No clubs at Sun 23h local", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: any[] = [];
    for (const club of eligible) {
      const { data, error: rpcErr } = await supabase.rpc("snapshot_club_full", {
        _club_id: club.id,
        _notes: "Sauvegarde automatique hebdomadaire (dimanche 23h55)",
      });
      if (rpcErr) {
        console.error(`[auto-snapshot] ${club.name}:`, rpcErr);
        results.push({ club: club.name, success: false, error: rpcErr.message });
      } else {
        console.log(`[auto-snapshot] ${club.name} ✓`, data);
        results.push({ club: club.name, success: true, result: data });
      }
    }

    return new Response(
      JSON.stringify({ success: true, count: eligible.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[auto-snapshot] error:", e);
    return new Response(
      JSON.stringify({ error: e?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
