import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Normalize a raw phone number to strict E.164 (+ followed by 8-15 digits).
 * Returns null when the number cannot be trusted — better to skip the SMS
 * subscription than to have OneSignal reject the whole user creation.
 */
function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  const hadPlus = trimmed.startsWith("+") || trimmed.startsWith("00");
  // Keep digits only (drops spaces, dots, dashes, parentheses, slashes…)
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (trimmed.startsWith("00")) digits = digits.replace(/^00/, "");
  if (!hadPlus && digits.startsWith("0")) {
    // National French format -> +33
    digits = "33" + digits.replace(/^0+/, "");
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return "+" + digits;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
    const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      throw new Error("OneSignal credentials not configured");
    }

    // Require a valid Supabase JWT — only the authenticated user may sync their own tags.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authedClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub as string;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user_id } = await req.json();

    if (!user_id) throw new Error("user_id is required");
    if (user_id !== callerId) {
      // Only super_admins may sync tags for other users
      const { data: isSuper } = await supabase
        .from("super_admin_users")
        .select("id")
        .eq("user_id", callerId)
        .maybeSingle();
      if (!isSuper) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── 1. Fetch all user data in parallel ────────────────────────────────────
    const [
      { data: profile },
      { data: clubMemberships },
      { data: ownedClubs },
      { data: categoryMemberships },
      { data: superAdminData },
      { data: playerData },
    ] = await Promise.all([
      supabase.from("profiles").select("email, full_name").eq("id", user_id).single(),
      supabase.from("club_members").select("club_id, role").eq("user_id", user_id),
      supabase.from("clubs").select("id, name").eq("user_id", user_id),
      supabase.from("category_members").select("category_id, role, categories(id, club_id)").eq("user_id", user_id),
      supabase.from("super_admin_users").select("id").eq("user_id", user_id).limit(1),
      // Fetch phone number from players table (linked via user_id)
      supabase.from("players").select("phone").eq("user_id", user_id).limit(1),
    ]);

    const userEmail = profile?.email || "";
    const userPhone = playerData?.[0]?.phone || "";

    // ── 2. Build tags — FREE PLAN: max 2 tags ────────────────────────────────
    // Tag 1: role (hiérarchie)
    const roles = new Set<string>();
    clubMemberships?.forEach((m: any) => roles.add(m.role));
    categoryMemberships?.forEach((m: any) => roles.add(m.role));
    if (ownedClubs && ownedClubs.length > 0) roles.add("admin");
    if (superAdminData && superAdminData.length > 0) roles.add("super_admin");

    let role = "viewer";
    // Include ALL app roles in hierarchy
    const roleHierarchy = [
      "super_admin", "admin", "coach", "prepa_physique",
      "physio", "doctor", "administratif", "athlete", "viewer",
    ];
    for (const r of roleHierarchy) {
      if (roles.has(r)) { role = r; break; }
    }

    // Tag 2: club_ids (ciblage par club — inclut les clubs via catégories pour les athletes)
    const allClubIds = new Set<string>();
    clubMemberships?.forEach((m: any) => allClubIds.add(m.club_id));
    ownedClubs?.forEach((c: any) => allClubIds.add(c.id));
    categoryMemberships?.forEach((m: any) => {
      const cat = m.categories as any;
      if (cat?.club_id) allClubIds.add(cat.club_id);
    });

    const tags: Record<string, string> = {
      role,
      club_ids: Array.from(allClubIds).join(","),
    };

    console.log(`[sync-onesignal-tags] User ${user_id} — role: ${role}, clubs: ${tags.club_ids}, email: ${userEmail ? "yes" : "no"}, phone: ${userPhone ? "yes" : "no"}`);

    const baseHeaders = {
      "Content-Type": "application/json",
      Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
    };

    // ── 3. Upsert user via OneSignal REST API ─────────────────────────────────
    // First try PATCH (update existing user by external_id)
    const patchUrl = `https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/users/by/external_id/${user_id}`;
    let patchResponse = await fetch(patchUrl, {
      method: "PATCH",
      headers: baseHeaders,
      body: JSON.stringify({ tags }),
    });

    let patchResult = await patchResponse.text();
    console.log(`[sync-onesignal-tags] PATCH response (${patchResponse.status}):`, patchResult);

    // If user not found (404/400), try to CREATE via POST (v2 API)
    const patchData = (() => { try { return JSON.parse(patchResult); } catch { return {}; } })();
    const notFound =
      patchResponse.status === 404 ||
      patchResponse.status === 400 ||
      patchData?.errors?.some?.((e: string) =>
        e?.toLowerCase?.().includes("doesn't match") ||
        e?.toLowerCase?.().includes("not found")
      );

    if (notFound) {
      console.log(`[sync-onesignal-tags] User ${user_id} not found — creating via POST`);

      // Build subscriptions array for email and phone
      const subscriptions: any[] = [];
      if (userEmail) {
        subscriptions.push({ type: "Email", token: userEmail });
      }
      const e164 = toE164(userPhone);
      if (userPhone && !e164) {
        console.warn(`[sync-onesignal-tags] Skipping invalid phone for user ${user_id}`);
      }
      if (e164) {
        subscriptions.push({ type: "SMS", token: e164 });
      }

      const createBody: any = {
        properties: { tags },
        identity: { external_id: user_id },
      };
      if (subscriptions.length > 0) createBody.subscriptions = subscriptions;

      const createUser = async (body: any) => {
        const res = await fetch(
          `https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/users`,
          { method: "POST", headers: baseHeaders, body: JSON.stringify(body) }
        );
        const text = await res.text();
        console.log(`[sync-onesignal-tags] POST create response (${res.status}):`, text);
        return { ok: res.ok, status: res.status, text };
      };

      let created = await createUser(createBody);

      // A rejected subscription must never cost the user their tags:
      // retry with identity + tags only.
      if (!created.ok && subscriptions.length > 0) {
        console.warn("[sync-onesignal-tags] Create failed with subscriptions — retrying without them");
        created = await createUser({
          properties: { tags },
          identity: { external_id: user_id },
        });
      }

      if (!created.ok) {
        console.error(`[sync-onesignal-tags] Create failed for ${user_id}:`, created.text);
        return new Response(
          JSON.stringify({ success: false, action: "created", status: created.status, error: created.text }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, tags, action: "created" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Sync email + phone subscriptions for existing users ──────────────
    const syncSubscriptions: any[] = [];
    if (userEmail) syncSubscriptions.push({ type: "Email", token: userEmail });
    const syncE164 = toE164(userPhone);
    if (userPhone && !syncE164) {
      console.warn(`[sync-onesignal-tags] Skipping invalid phone for user ${user_id}`);
    }
    if (syncE164) syncSubscriptions.push({ type: "SMS", token: syncE164 });

    if (syncSubscriptions.length > 0) {
      try {
        const syncResponse = await fetch(
          `https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/users/by/external_id/${user_id}`,
          {
            method: "PATCH",
            headers: baseHeaders,
            body: JSON.stringify({ subscriptions: syncSubscriptions }),
          }
        );
        const syncResult = await syncResponse.text();
        console.log(`[sync-onesignal-tags] Subscription sync (${syncResponse.status}):`, syncResult);
      } catch (syncErr) {
        console.warn("[sync-onesignal-tags] Subscription sync warning:", syncErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, tags, action: "updated" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[sync-onesignal-tags] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
