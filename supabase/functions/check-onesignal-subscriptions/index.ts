import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
    const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      throw new Error("OneSignal credentials not configured");
    }

    const { user_ids } = await req.json();
    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      throw new Error("user_ids array is required");
    }

    const baseHeaders = {
      "Content-Type": "application/json",
      Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
    };

    // Check each user's subscriptions via OneSignal API
    const results: Record<string, { hasPush: boolean; hasEmail: boolean }> = {};

    // Process in batches of 5 to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < user_ids.length; i += batchSize) {
      const batch = user_ids.slice(i, i + batchSize);
      const promises = batch.map(async (userId: string) => {
        try {
          const url = `https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/users/by/external_id/${userId}`;
          const response = await fetch(url, { method: "GET", headers: baseHeaders });
          
          if (response.status === 404 || response.status === 400) {
            return { userId, hasPush: false, hasEmail: false };
          }

          const data = await response.json();
          const subscriptions = data?.subscriptions || [];
          
          const hasPush = subscriptions.some((s: any) => 
            (s.type === "ChromePush" || s.type === "SafariPush" || s.type === "FirefoxPush" || 
             s.type === "iOSPush" || s.type === "AndroidPush" || s.type === "WindowsPush") && 
            s.enabled === true
          );
          const hasEmail = subscriptions.some((s: any) => s.type === "Email");

          return { userId, hasPush, hasEmail };
        } catch (err) {
          console.warn(`[check-onesignal] Error for user ${userId}:`, err);
          return { userId, hasPush: false, hasEmail: false };
        }
      });

      const batchResults = await Promise.all(promises);
      for (const r of batchResults) {
        results[r.userId] = { hasPush: r.hasPush, hasEmail: r.hasEmail };
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[check-onesignal] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
