import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SyncTagsRequest {
  user_id: string;
  action: "update" | "remove_club" | "remove_category" | "full_sync";
  club_id?: string;
  category_id?: string;
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

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      throw new Error("OneSignal credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user_id, action }: SyncTagsRequest = await req.json();

    if (!user_id) throw new Error("user_id is required");

    // Build updated tags from current database state
    const tags: Record<string, string> = {};

    // Get club memberships
    const { data: clubMemberships } = await supabase
      .from("club_members")
      .select("club_id, role")
      .eq("user_id", user_id);

    // Get owned clubs
    const { data: ownedClubs } = await supabase
      .from("clubs")
      .select("id")
      .eq("user_id", user_id);

    // Get category memberships
    const { data: categoryMemberships } = await supabase
      .from("category_members")
      .select("category_id, role")
      .eq("user_id", user_id);

    // Build club_ids
    const allClubIds = new Set<string>();
    clubMemberships?.forEach((m) => allClubIds.add(m.club_id));
    ownedClubs?.forEach((c) => allClubIds.add(c.id));
    tags.club_ids = Array.from(allClubIds).join(",");

    // Build category_ids
    if (categoryMemberships && categoryMemberships.length > 0) {
      tags.category_ids = categoryMemberships.map((m) => m.category_id).join(",");
    } else {
      tags.category_ids = "";
    }

    // Determine role
    const roles = new Set<string>();
    clubMemberships?.forEach((m) => roles.add(m.role));
    categoryMemberships?.forEach((m) => roles.add(m.role));
    if (ownedClubs && ownedClubs.length > 0) roles.add("admin");

    const roleHierarchy = ["admin", "coach", "physio", "doctor", "viewer", "athlete"];
    for (const r of roleHierarchy) {
      if (roles.has(r)) {
        tags.role = r;
        break;
      }
    }

    // Check super admin
    const { data: superAdminData } = await supabase
      .from("super_admin_users")
      .select("id")
      .eq("user_id", user_id)
      .limit(1);

    if (superAdminData && superAdminData.length > 0) {
      tags.is_super_admin = "true";
      tags.role = "super_admin";
    }

    tags.user_type = roles.has("athlete") && roles.size === 1 ? "athlete" : "staff";

    // Update tags via OneSignal REST API
    const updateResponse = await fetch(
      `https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/users/by/external_id/${user_id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
        },
        body: JSON.stringify({
          tags,
        }),
      }
    );

    const updateResult = await updateResponse.text();
    console.log(`[sync-onesignal-tags] ${action} for user ${user_id}:`, updateResult);

    return new Response(
      JSON.stringify({ success: true, tags, action }),
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
