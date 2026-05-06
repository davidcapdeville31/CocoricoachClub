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

    // Eligible = clubs whose local time is Monday 03:xx
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
        if (weekday === "Mon" && hour === "03") {
          eligible.push({ id: club.id, name: club.name });
        }
      } catch (e) {
        console.error(`[auto-snapshot] tz error ${club.name}:`, e);
      }
    }

    if (eligible.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No clubs at Mon 03h local", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: any[] = [];
    for (const club of eligible) {
      // Snapshot the club
      const { data: clubSnap, error: clubErr } = await supabase.rpc("snapshot_club_full", {
        _club_id: club.id,
        _notes: "Sauvegarde automatique hebdomadaire (lundi 03h00 heure locale)",
      });
      if (clubErr) {
        console.error(`[auto-snapshot] club ${club.name}:`, clubErr);
        results.push({ club: club.name, scope: "club", success: false, error: clubErr.message });
      } else {
        console.log(`[auto-snapshot] club ${club.name} ✓`, clubSnap);
        results.push({ club: club.name, scope: "club", success: true, result: clubSnap });
      }

      // Snapshot each active (non-archived) category of the club
      const { data: cats, error: catsErr } = await supabase
        .from("categories")
        .select("id, name")
        .eq("club_id", club.id)
        .eq("is_archived", false);
      if (catsErr) {
        console.error(`[auto-snapshot] cats list ${club.name}:`, catsErr);
        continue;
      }
      for (const cat of cats ?? []) {
        const { data: catSnap, error: catErr } = await supabase.rpc("snapshot_category_full", {
          _category_id: cat.id,
          _notes: "Sauvegarde automatique hebdomadaire (lundi 03h00 heure locale)",
        });
        if (catErr) {
          console.error(`[auto-snapshot] cat ${cat.name}:`, catErr);
          results.push({ club: club.name, category: cat.name, scope: "category", success: false, error: catErr.message });
        } else {
          results.push({ club: club.name, category: cat.name, scope: "category", success: true, result: catSnap });
        }
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
