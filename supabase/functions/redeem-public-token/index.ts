// Edge function: redeem-public-token
// Validates a public access token and returns auth credentials for an
// auto-provisioned guest "viewer" account. The visitor is then signed in
// client-side via supabase.auth.signInWithPassword so all RLS policies
// based on auth.uid() / club_members / category_members work normally.
//
// Public function (no JWT required) - verify_jwt = false
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function randomPassword(): string {
  // 32-char URL-safe random password
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token } = await req.json().catch(() => ({ token: null }));
    if (!token || typeof token !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Token manquant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Lookup token
    const { data: tokenRow, error: tokenErr } = await admin
      .from("public_access_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (tokenErr || !tokenRow) {
      return new Response(
        JSON.stringify({ success: false, error: "Lien invalide" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!tokenRow.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: "Lien désactivé" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "Lien expiré" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Ensure guest auth user exists
    const guestEmail = `viewer-${tokenRow.id}@guest.cocoricoachclub.com`;
    let userId = tokenRow.auth_user_id as string | null;
    let password = tokenRow.auth_password as string | null;

    if (!userId || !password) {
      password = randomPassword();
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: guestEmail,
        password,
        email_confirm: true,
        user_metadata: {
          is_public_viewer: true,
          public_token_id: tokenRow.id,
          public_label: tokenRow.label ?? null,
        },
      });

      if (createErr || !created.user) {
        // Possibly already exists from a previous failed attempt — try to fetch by email
        const { data: list } = await admin.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        const existing = list?.users?.find((u) => u.email === guestEmail);
        if (!existing) {
          return new Response(
            JSON.stringify({
              success: false,
              error: createErr?.message ?? "Impossible de créer le compte invité",
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        userId = existing.id;
        // Reset password for this existing user
        await admin.auth.admin.updateUserById(existing.id, { password });
      } else {
        userId = created.user.id;
      }

      // Persist credentials
      await admin
        .from("public_access_tokens")
        .update({ auth_user_id: userId, auth_password: password })
        .eq("id", tokenRow.id);
    }

    // 3. Ensure viewer membership for the targeted scope
    if (tokenRow.club_id) {
      const { data: existing } = await admin
        .from("club_members")
        .select("id, role")
        .eq("club_id", tokenRow.club_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) {
        await admin.from("club_members").insert({
          club_id: tokenRow.club_id,
          user_id: userId,
          role: "viewer",
        });
      } else if (existing.role !== "viewer") {
        await admin
          .from("club_members")
          .update({ role: "viewer" })
          .eq("id", existing.id);
      }
    }

    if (tokenRow.category_id) {
      const { data: existing } = await admin
        .from("category_members")
        .select("id, role")
        .eq("category_id", tokenRow.category_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) {
        await admin.from("category_members").insert({
          category_id: tokenRow.category_id,
          user_id: userId,
          role: "viewer",
        });
      } else if (existing.role !== "viewer") {
        await admin
          .from("category_members")
          .update({ role: "viewer" })
          .eq("id", existing.id);
      }
    }

    // 4. Update last_used_at
    await admin
      .from("public_access_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    return new Response(
      JSON.stringify({
        success: true,
        email: guestEmail,
        password,
        club_id: tokenRow.club_id,
        category_id: tokenRow.category_id,
        access_type: tokenRow.access_type,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("redeem-public-token error", e);
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
