// Public edge function: takes an athlete invitation token + password,
// creates a confirmed auth user, links the player and category membership,
// then returns the credentials so the client can sign in immediately.
// verify_jwt = false (public, secured by single-use token).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token, password } = await req.json().catch(() => ({}));
    if (!token || typeof token !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Token manquant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: "Mot de passe trop court (min. 6 caractères)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Validate token via existing RPC
    const { data: validation, error: valErr } = await admin.rpc(
      "validate_athlete_invitation",
      { _token: token },
    );
    if (valErr) {
      console.error("validate_athlete_invitation error", valErr);
      return new Response(
        JSON.stringify({ success: false, error: "Erreur de validation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const v = validation as any;
    if (!v?.success) {
      return new Response(
        JSON.stringify({ success: false, error: v?.error || "Invitation invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const email: string = v.email;
    const playerId: string = v.player_id;
    const clubId: string = v.club_id;
    const categoryId: string = v.category_id;

    // 2. Find or create the auth user (email pre-confirmed)
    let userId: string | null = null;

    // Look up existing user by email
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );

    if (existing) {
      userId = existing.id;
      // Reset password + ensure confirmed
      const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: {
          ...(existing.user_metadata || {}),
          is_athlete: true,
          player_id: playerId,
          club_id: clubId,
          category_id: categoryId,
        },
      });
      if (updErr) {
        console.error("updateUserById error", updErr);
        return new Response(
          JSON.stringify({ success: false, error: "Impossible de finaliser le compte existant" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          is_athlete: true,
          player_id: playerId,
          club_id: clubId,
          category_id: categoryId,
        },
      });
      if (createErr || !created?.user) {
        console.error("createUser error", createErr);
        return new Response(
          JSON.stringify({
            success: false,
            error: createErr?.message || "Impossible de créer le compte",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      userId = created.user.id;
    }

    // 3. Accept the invitation server-side (links player.user_id, adds category_member, sets status=accepted)
    const { data: acceptResult, error: acceptErr } = await admin.rpc(
      "accept_athlete_invitation_signup",
      { _token: token, _user_id: userId },
    );
    if (acceptErr) {
      console.error("accept_athlete_invitation_signup error", acceptErr);
      return new Response(
        JSON.stringify({ success: false, error: "Erreur lors de la liaison du compte" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const r = acceptResult as any;
    if (!r?.success) {
      return new Response(
        JSON.stringify({ success: false, error: r?.error || "Erreur de liaison" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, email, user_id: userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("accept-athlete-invitation-signup error", e);
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
