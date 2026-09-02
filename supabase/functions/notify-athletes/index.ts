import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import {
  filterByPreferences,
  type NotificationCategory,
} from "../_shared/notification-preferences.ts";

// Notifications sortantes limitées aux push à la demande du club.
// Les emails d'authentification et d'invitation restent actifs.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};


interface NotifyAthletesRequest {
  athletes: Array<{
    name: string;
    email?: string;
    phone?: string;
    user_id?: string;
  }>;
  subject: string;
  message: string;
  channels: ("push" | "email" | "sms")[];
  eventType: "session" | "match" | "event" | "custom" | "convocation";
  eventDetails?: {
    date?: string;
    time?: string;
    location?: string;
  };
  category_id?: string;
  skipBell?: boolean;
}

const APP_URL = "https://cocoricoachclub.com";

function eventTypeToCategory(t: NotifyAthletesRequest["eventType"]): NotificationCategory {
  switch (t) {
    case "session": return "sessions";
    case "match": return "matches";
    case "convocation": return "convocations";
    default: return "sessions";
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!authHeader || !supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
    const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      throw new Error("OneSignal credentials not configured");
    }

    const body: NotifyAthletesRequest = await req.json();
  const { athletes, message, channels, eventType, eventDetails, category_id, skipBell } = body;

    if (!athletes || athletes.length === 0) throw new Error("No athletes provided");
    if (!channels || channels.length === 0) throw new Error("No notification channels selected");

    const subject = (body.subject || "Notification").trim();

    const supabaseService = createClient(
      supabaseUrl!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? supabaseAnonKey!
    );


    const results = {
      pushSent: 0,
      errors: [] as string[],
    };



    const enrichedAthletes = athletes;

    const category = eventTypeToCategory(eventType);
    const allUserIds = enrichedAthletes
      .map((a) => a.user_id)
      .filter((u): u is string => Boolean(u));
    const { pushUserIds } = await filterByPreferences(
      supabaseService,
      allUserIds,
      category
    );
    const allowedPushSet = new Set(pushUserIds);

    // Toujours créer les notifications dans l'application pour alimenter la cloche.
    const bellRows = enrichedAthletes
      .filter((a) => a.user_id)
      .map((a) => ({
        user_id: a.user_id!,
        category_id: category_id ?? null,
        notification_type: eventType,
        title: subject,
        message,
        metadata: {
          source: "notify-athletes",
          eventType,
          eventDetails: eventDetails ?? null,
        },
        is_read: false,
      }));

    if (!skipBell && bellRows.length > 0) {
      const { error: bellError } = await supabaseService
        .from("notifications")
        .insert(bellRows);
      if (bellError) {
        console.error("[notify-athletes] Failed to insert bell notifications:", bellError);
        results.errors.push(`Bell: ${bellError.message}`);
      } else {
        console.log(`[notify-athletes] Created ${bellRows.length} bell notification(s)`);
      }
    }

    for (const athlete of enrichedAthletes) {
      const pushAllowed = !athlete.user_id || allowedPushSet.has(athlete.user_id);



      if (channels.includes("push") && athlete.user_id && pushAllowed) {
        try {
          let pushMessage = message;
          if (eventDetails?.date) pushMessage += `\n${eventDetails.date}`;
          if (eventDetails?.time) pushMessage += ` à ${eventDetails.time}`;
          if (eventDetails?.location) pushMessage += `\n${eventDetails.location}`;

          const pushResponse = await fetch("https://api.onesignal.com/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Key ${ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify({
              app_id: ONESIGNAL_APP_ID,
              // external_id = user.id (UUID), set by oneSignalLogin() in the browser SDK.
              // Using email here would target a non-existent alias → no push delivered.
              include_aliases: { external_id: [athlete.user_id] },
              target_channel: "push",
              headings: { en: subject, fr: subject },
              contents: { en: pushMessage, fr: pushMessage },
              name: `Push to ${athlete.name}`,
              url: APP_URL,
            }),
          });

          if (pushResponse.ok) {
            results.pushSent++;
          } else {
            const errorData = await pushResponse.json();
            results.errors.push(`Push ${athlete.user_id}: ${JSON.stringify(errorData)}`);
          }
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          results.errors.push(`Push ${athlete.user_id}: ${errorMessage}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, ...results, totalAthletes: athletes.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in notify-athletes:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
