import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type InvitationKind = "club" | "category";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token, kind, email, password, full_name, phone } = await req.json().catch(() => ({}));

    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ success: false, error: "Token manquant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (kind !== "club" && kind !== "category") {
      return new Response(JSON.stringify({ success: false, error: "Type d'invitation invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ success: false, error: "Email manquant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return new Response(JSON.stringify({ success: false, error: "Mot de passe trop court" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!full_name || typeof full_name !== "string") {
      return new Response(JSON.stringify({ success: false, error: "Nom manquant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = full_name.trim();
    const normalizedPhone = typeof phone === "string" && phone.trim().length > 0 ? phone.trim() : null;

    const { data: infoData, error: infoError } = await admin.rpc("get_invitation_info", {
      _token: token,
      _kind: kind,
    });

    if (infoError) {
      console.error("get_invitation_info error", infoError);
      return new Response(JSON.stringify({ success: false, error: "Erreur de validation" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const info = infoData as { success?: boolean; email?: string; status?: string; error?: string } | null;
    if (!info?.success) {
      return new Response(JSON.stringify({ success: false, error: info?.error || "Invitation invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((info.email || "").toLowerCase() !== normalizedEmail) {
      return new Response(JSON.stringify({ success: false, error: "Utilisez l'email invité pour créer ce compte" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (info.status !== "pending") {
      return new Response(JSON.stringify({ success: false, error: "Invitation déjà utilisée ou expirée" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userList, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
      console.error("listUsers error", listError);
      return new Response(JSON.stringify({ success: false, error: "Impossible de vérifier le compte" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existingUser = userList.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (existingUser) {
      return new Response(JSON.stringify({ success: false, error: "Un compte existe déjà avec cet email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: normalizedName,
        phone: normalizedPhone || undefined,
      },
    });

    if (createError || !created?.user) {
      console.error("createUser error", createError);
      return new Response(JSON.stringify({ success: false, error: createError?.message || "Impossible de créer le compte" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, user_id: created.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("accept-invitation-signup error", error);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});