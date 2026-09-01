import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTemplateEmailWithLog } from "../_shared/transactional-email-templates/send-log.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InvitationEmailRequest {
  email: string;
  invitationType: "club_admin" | "collaborator" | "category_member" | "athlete";
  inviterName?: string;
  clubName?: string;
  categoryName?: string;
  role?: string;
  invitationLink: string;
  athleteName?: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  coach: "Coach",
  viewer: "Viewer (lecture seule)",
  physio: "Kinésithérapeute",
  doctor: "Médecin",
  preparateur: "Préparateur physique",
  analyst: "Analyste",
  manager: "Manager",
};

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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is authenticated
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: InvitationEmailRequest = await req.json();
    const {
      email,
      invitationType,
      inviterName,
      clubName,
      categoryName,
      role,
      invitationLink,
      athleteName,
    } = body;

    if (!email || !invitationType || !invitationLink) {
      throw new Error("Missing required fields: email, invitationType, invitationLink");
    }

    const roleLabel = role ? ROLE_LABELS[role] ?? role : undefined;

    // Idempotency key — stable per (email + type + link)
    const linkHash = invitationLink.split("token=")[1]?.slice(0, 32) ?? Date.now().toString();
    const idempotencyKey = `invitation-${invitationType}-${linkHash}`;

    // Forward to send-transactional-email so the email leaves
    // from noreply@cocoricoachclub.com (verified Lovable Email sender),
    // ensuring consistent branding & no SSL/sender warnings.
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await serviceClient.functions.invoke(
      "send-transactional-email",
      {
        body: {
          templateName: "invitation",
          recipientEmail: email,
          idempotencyKey,
          templateData: {
            invitationType,
            inviterName,
            clubName,
            categoryName,
            roleLabel,
            athleteName,
            invitationLink,
          },
        },
      },
    );

    if (error) {
      console.error("send-transactional-email error:", error);
      throw new Error(error.message ?? "Failed to enqueue invitation email");
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error in send-invitation-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
};

serve(handler);
