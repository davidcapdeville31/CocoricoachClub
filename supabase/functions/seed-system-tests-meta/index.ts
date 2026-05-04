// Edge function temporaire — applique les métadonnées aux tests système
// Lit le JSON de la requête et fait UPDATE par batches via service role
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { rows } = await req.json() as { rows: Array<{name:string;cat:string;icon:string;desc:string;obj:string}> };
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    let updated = 0;
    for (const r of rows) {
      const { error, count } = await supabase
        .from("custom_tests")
        .update({ icon: r.icon, description: r.desc, objectives: r.obj }, { count: "exact" })
        .eq("is_system", true)
        .eq("name", r.name)
        .eq("test_category", r.cat)
        .or("description.is.null,description.eq.")
        .or("objectives.is.null,objectives.eq.");
      if (error) console.error(r.name, error.message);
      else updated += count ?? 0;
    }

    return new Response(JSON.stringify({ ok: true, updated, total: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
