import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, reason } = await req.json();
    const admin = createClient(supabaseUrl, serviceKey);

    if (action === "request") {
      // Create or refresh deletion request
      const { error } = await admin.from("account_deletion_requests").upsert({
        user_id: user.id,
        status: "pending",
        reason: reason || null,
        requested_at: new Date().toISOString(),
        scheduled_for: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancelled_at: null,
      }, { onConflict: "user_id" });

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        scheduled_for: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        message: "Suppression programmée dans 30 jours. Vous pouvez l'annuler à tout moment d'ici là.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "cancel") {
      const { error } = await admin.from("account_deletion_requests")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("user_id", user.id).eq("status", "pending");

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        message: "Suppression annulée. Votre compte est maintenu.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "execute_immediate") {
      // Immediate deletion (for users who explicitly want it now, no grace period)
      // Cascades via FK ON DELETE CASCADE.
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) throw error;

      return new Response(JSON.stringify({
        success: true, message: "Compte supprimé.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Action invalide" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[gdpr-account-deletion]", e);
    return new Response(JSON.stringify({ error: e?.message || "Erreur" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
