import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.67";

type InvitationKind = "club" | "category";

type ClubInvitationRow = {
  id: string;
  club_id: string;
  email: string;
  role: string;
  invited_by: string | null;
  status: string;
  expires_at: string | null;
  assigned_categories: string[] | null;
};

type CategoryInvitationRow = {
  id: string;
  category_id: string;
  email: string;
  role: string;
  invited_by: string | null;
  status: string;
  expires_at: string | null;
};

const BodySchema = z.object({
  token: z.string().min(8),
  kind: z.enum(["club", "category"]),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
  full_name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(20).nullable().optional(),
});

async function findUserByEmail(admin: ReturnType<typeof createClient>, email: string) {
  let page = 1;

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;

    const user = data.users.find((entry) => entry.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 200) break;

    page += 1;
  }

  return null;
}

async function ensureApprovedUser(admin: ReturnType<typeof createClient>, userId: string, invitedBy: string | null, note: string) {
  const { error } = await admin.from("approved_users").upsert(
    { user_id: userId, approved_by: invitedBy, notes: note },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

async function acceptClubInvitationServerSide(admin: ReturnType<typeof createClient>, invitation: ClubInvitationRow, userId: string) {
  await ensureApprovedUser(admin, userId, invitation.invited_by, "Auto-approved via club invitation signup");

  const { error: clubMemberError } = await admin.from("club_members").upsert(
    {
      club_id: invitation.club_id,
      user_id: userId,
      role: invitation.role,
      invited_by: invitation.invited_by,
      assigned_categories: invitation.assigned_categories,
    },
    { onConflict: "club_id,user_id" },
  );

  if (clubMemberError) throw clubMemberError;

  let categoryIds = invitation.assigned_categories ?? [];

  if (categoryIds.length === 0) {
    const { data: categories, error: categoriesError } = await admin
      .from("categories")
      .select("id")
      .eq("club_id", invitation.club_id);

    if (categoriesError) throw categoriesError;
    categoryIds = (categories ?? []).map((category) => category.id as string);
  }

  if (categoryIds.length > 0) {
    const { error: categoryMembersError } = await admin.from("category_members").upsert(
      categoryIds.map((categoryId) => ({
        category_id: categoryId,
        user_id: userId,
        role: invitation.role,
        invited_by: invitation.invited_by,
      })),
      { onConflict: "category_id,user_id" },
    );

    if (categoryMembersError) throw categoryMembersError;
  }

  const { error: invitationError } = await admin
    .from("club_invitations")
    .update({ status: "accepted" })
    .eq("id", invitation.id);

  if (invitationError) throw invitationError;

  return { redirectPath: `/clubs/${invitation.club_id}` };
}

async function acceptCategoryInvitationServerSide(admin: ReturnType<typeof createClient>, invitation: CategoryInvitationRow, userId: string) {
  await ensureApprovedUser(admin, userId, invitation.invited_by, "Auto-approved via category invitation signup");

  const { data: category, error: categoryError } = await admin
    .from("categories")
    .select("club_id")
    .eq("id", invitation.category_id)
    .single();

  if (categoryError) throw categoryError;

  const { error: categoryMemberError } = await admin.from("category_members").upsert(
    {
      category_id: invitation.category_id,
      user_id: userId,
      role: invitation.role,
      invited_by: invitation.invited_by,
    },
    { onConflict: "category_id,user_id" },
  );

  if (categoryMemberError) throw categoryMemberError;

  const { error: invitationError } = await admin
    .from("category_invitations")
    .update({ status: "accepted" })
    .eq("id", invitation.id);

  if (invitationError) throw invitationError;

  return { redirectPath: `/clubs/${category.club_id}/categories/${invitation.category_id}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json().catch(() => null);
    const parsedBody = BodySchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return new Response(JSON.stringify({ success: false, error: parsedBody.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { token, kind, email, password, full_name, phone } = parsedBody.data;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = full_name.trim();
    const normalizedPhone = phone && phone.trim().length > 0 ? phone.trim() : null;

    if (kind === "club") {
      const { data: invitation, error: invitationError } = await admin
        .from("club_invitations")
        .select("id, club_id, email, role, invited_by, status, expires_at, assigned_categories")
        .eq("token", token)
        .maybeSingle<ClubInvitationRow>();

      if (invitationError) throw invitationError;
      if (!invitation) {
        return new Response(JSON.stringify({ success: false, error: "Invitation introuvable" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (invitation.email.toLowerCase() !== normalizedEmail) {
        return new Response(JSON.stringify({ success: false, error: "Utilisez l'email invité pour créer ce compte" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (invitation.expires_at && new Date(invitation.expires_at).getTime() <= Date.now()) {
        return new Response(JSON.stringify({ success: false, error: "Invitation expirée" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!["pending", "accepted"].includes(invitation.status)) {
        return new Response(JSON.stringify({ success: false, error: "Invitation invalide" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const existingUser = await findUserByEmail(admin, normalizedEmail);
      let userId = existingUser?.id ?? null;

      if (existingUser) {
        const { error: updateError } = await admin.auth.admin.updateUserById(existingUser.id, {
          password,
          email_confirm: true,
          user_metadata: {
            ...(existingUser.user_metadata || {}),
            full_name: normalizedName,
            phone: normalizedPhone || undefined,
          },
        });

        if (updateError) throw updateError;
      } else {
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: normalizedName,
            phone: normalizedPhone || undefined,
          },
        });

        if (createError || !created?.user) throw createError || new Error("Impossible de créer le compte");
        userId = created.user.id;
      }

      const result = await acceptClubInvitationServerSide(admin, invitation, userId!);
      return new Response(JSON.stringify({ success: true, user_id: userId, redirectPath: result.redirectPath }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invitation, error: invitationError } = await admin
      .from("category_invitations")
      .select("id, category_id, email, role, invited_by, status, expires_at")
      .eq("token", token)
      .maybeSingle<CategoryInvitationRow>();

    if (invitationError) throw invitationError;
    if (!invitation) {
      return new Response(JSON.stringify({ success: false, error: "Invitation introuvable" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invitation.email.toLowerCase() !== normalizedEmail) {
      return new Response(JSON.stringify({ success: false, error: "Utilisez l'email invité pour créer ce compte" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invitation.expires_at && new Date(invitation.expires_at).getTime() <= Date.now()) {
      return new Response(JSON.stringify({ success: false, error: "Invitation expirée" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["pending", "accepted"].includes(invitation.status)) {
      return new Response(JSON.stringify({ success: false, error: "Invitation invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existingUser = await findUserByEmail(admin, normalizedEmail);
    let userId = existingUser?.id ?? null;

    if (existingUser) {
      const { error: updateError } = await admin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: {
          ...(existingUser.user_metadata || {}),
          full_name: normalizedName,
          phone: normalizedPhone || undefined,
        },
      });

      if (updateError) throw updateError;
    } else {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: normalizedName,
          phone: normalizedPhone || undefined,
        },
      });

      if (createError || !created?.user) throw createError || new Error("Impossible de créer le compte");
      userId = created.user.id;
    }

    const result = await acceptCategoryInvitationServerSide(admin, invitation, userId!);
    return new Response(JSON.stringify({ success: true, user_id: userId, redirectPath: result.redirectPath }), {
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