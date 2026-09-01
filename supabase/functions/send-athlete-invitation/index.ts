import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTemplateEmailWithLog } from "../_shared/transactional-email-templates/send-log.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AthleteInvitationRequest {
  athleteName: string;
  athleteFirstName?: string;
  email: string;
  phone?: string;
  clubName: string;
  categoryName: string;
  invitationLink: string;
  channels: ("email" | "sms")[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!authHeader || !supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // OneSignal is now used ONLY for SMS — email goes through Lovable Emails.
    const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
    const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");

    const {
      athleteName,
      athleteFirstName,
      email,
      phone,
      clubName,
      categoryName,
      invitationLink,
      channels,
    }: AthleteInvitationRequest = await req.json();

    const displayName = athleteFirstName
      ? `${athleteFirstName} ${athleteName}`
      : athleteName;

    const results: { email?: any; sms?: any } = {};

    // ── EMAIL via Lovable-managed delivery ───────────────────────────────
    if (channels.includes("email") && email) {
      const linkHash = invitationLink.split("token=")[1]?.slice(0, 32) ?? Date.now().toString();
      const idempotencyKey = `invitation-athlete-${linkHash}`;
      const serviceClient = createClient(supabaseUrl, serviceRoleKey);

      try {
        results.email = await sendTemplateEmailWithLog(serviceClient, "invitation", email, {
          idempotencyKey,
          templateData: {
            invitationType: "athlete",
            clubName,
            categoryName,
            athleteName: displayName,
            invitationLink,
          },
        });
      } catch (error) {
        console.error("Managed invitation email error:", error);
        results.email = { error: error instanceof Error ? error.message : String(error) };
      }
    }

    // Send SMS (still via OneSignal)
    if (channels.includes("sms") && phone) {
      if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
        throw new Error("OneSignal credentials not configured for SMS");
      }
      let formattedPhone = phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");

      // Add French country code if missing
      if (formattedPhone.startsWith("0")) {
        formattedPhone = "+33" + formattedPhone.substring(1);
      } else if (!formattedPhone.startsWith("+")) {
        formattedPhone = "+33" + formattedPhone;
      }

      const smsMessage = `🏆 ${displayName}, tu as été invité(e) à rejoindre ${clubName} (${categoryName}). Crée ton compte ici : ${invitationLink}`;

      const smsResponse = await fetch(
        "https://api.onesignal.com/notifications",
        {
          method: "POST",
          headers: {
            Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            include_phone_numbers: [formattedPhone],
            sms_from: clubName.substring(0, 11),
            contents: { en: smsMessage },
            name: `Athlete Invitation - ${displayName}`,
          }),
        }
      );

      results.sms = await smsResponse.json();
      console.log("SMS invitation sent:", results.sms);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending athlete invitation:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
