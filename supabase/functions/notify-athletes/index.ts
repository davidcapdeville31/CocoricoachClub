import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTemplateEmailWithLog } from "../_shared/transactional-email-templates/send-log.ts";
import {
  filterByPreferences,
  type NotificationCategory,
} from "../_shared/notification-preferences.ts";

// Emails de notification désactivés à la demande du club : push uniquement.
// (Les emails d'authentification et d'invitation restent actifs.)
const APP_NOTIFICATION_EMAILS_ENABLED = false;

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
  channels: ("email" | "sms" | "push")[];
  eventType: "session" | "match" | "event" | "custom" | "convocation";
  eventDetails?: {
    date?: string;
    time?: string;
    location?: string;
  };
  /** Optional: server fetches club + category names to personalize emails */
  category_id?: string;
  /** Optional explicit overrides */
  clubName?: string;
  categoryName?: string;
  /** When true, skip inserting in-app bell notifications (caller already did it) */
  skipBell?: boolean;
}

const APP_NAME = "CocoriCoach Club";
const APP_URL = "https://cocoricoachclub.com";
const LOGO_URL = "https://cocoricoachclub.com/email-logo.png";

function eventTypeToCategory(t: NotifyAthletesRequest["eventType"]): NotificationCategory {
  switch (t) {
    case "session": return "sessions";
    case "match": return "matches";
    case "convocation": return "convocations";
    default: return "sessions";
  }
}

// Strip emojis & non-printable symbols (deliverability-friendly subjects)
function cleanSubject(s: string): string {
  return s
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
    let { clubName, categoryName } = body;

    if (!athletes || athletes.length === 0) throw new Error("No athletes provided");
    if (!channels || channels.length === 0) throw new Error("No notification channels selected");

    const subject = cleanSubject(body.subject || "Notification");

    const supabaseService = createClient(
      supabaseUrl!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? supabaseAnonKey!
    );

    // Resolve club + category names from category_id if not provided
    if (category_id && (!clubName || !categoryName)) {
      const { data: catRow } = await supabaseService
        .from("categories")
        .select("name, clubs(name)")
        .eq("id", category_id)
        .maybeSingle();
      if (catRow) {
        // @ts-ignore
        categoryName = categoryName ?? catRow.name ?? undefined;
        // @ts-ignore
        clubName = clubName ?? catRow.clubs?.name ?? undefined;
      }
    }

    const results = {
      emailsSent: 0,
      smsSent: 0,
      pushSent: 0,
      errors: [] as string[],
    };

    // Clean professional HTML email (no emojis, brand logo, dynamic club/category)
    const buildEmailContent = (athleteName: string) => {
      const safeName = escapeHtml(athleteName);
      const safeSubject = escapeHtml(subject);
      const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");
      const safeClub = clubName ? escapeHtml(clubName) : null;
      const safeCategory = categoryName ? escapeHtml(categoryName) : null;

      const contextLine = safeClub || safeCategory
        ? `<p style="margin: 0 0 24px 0; color: #6b7280; font-size: 13px; letter-spacing: 0.3px; text-transform: uppercase;">${[safeClub, safeCategory].filter(Boolean).join(" &middot; ")}</p>`
        : "";

      const detailsRows: string[] = [];
      if (eventDetails?.date) detailsRows.push(`<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:90px;">Date</td><td style="padding:6px 0;color:#111827;font-size:14px;font-weight:500;">${escapeHtml(eventDetails.date)}</td></tr>`);
      if (eventDetails?.time) detailsRows.push(`<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Heure</td><td style="padding:6px 0;color:#111827;font-size:14px;font-weight:500;">${escapeHtml(eventDetails.time)}</td></tr>`);
      if (eventDetails?.location) detailsRows.push(`<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Lieu</td><td style="padding:6px 0;color:#111827;font-size:14px;font-weight:500;">${escapeHtml(eventDetails.location)}</td></tr>`);

      const detailsBlock = detailsRows.length
        ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:24px 0;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:8px 0;">${detailsRows.join("")}</table>`
        : "";

      return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeSubject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#111827;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f6fb;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="padding:32px 32px 0 32px;text-align:center;">
          <img src="${LOGO_URL}" alt="${APP_NAME}" width="56" height="56" style="display:inline-block;border:0;border-radius:12px;">
        </td></tr>
        <tr><td style="padding:24px 32px 32px 32px;">
          ${contextLine}
          <h1 style="margin:0 0 16px 0;color:#111827;font-size:20px;font-weight:600;line-height:1.3;">${safeSubject}</h1>
          <p style="margin:0 0 16px 0;color:#374151;font-size:15px;line-height:1.6;">Bonjour ${safeName},</p>
          <p style="margin:0;color:#374151;font-size:15px;line-height:1.6;">${safeMessage}</p>
          ${detailsBlock}
          <p style="margin:24px 0 0 0;color:#6b7280;font-size:13px;line-height:1.5;">Connectez-vous à votre espace pour plus de détails.</p>
        </td></tr>
        <tr><td style="padding:20px 32px;background-color:#fafafa;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
            ${APP_NAME}${safeClub ? ` &middot; ${safeClub}` : ""}<br>
            <a href="${APP_URL}" style="color:#9ca3af;text-decoration:underline;">${APP_URL.replace("https://", "")}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
    };

    const emailsToLookup = athletes
      .filter((a) => !a.user_id && a.email)
      .map((a) => a.email!.toLowerCase());

    const emailToUserId = new Map<string, string>();
    if (emailsToLookup.length > 0) {
      const { data: playerRows } = await supabaseService
        .from("players")
        .select("email,user_id")
        .in("email", emailsToLookup);
      for (const r of (playerRows ?? []) as Array<{ email: string | null; user_id: string | null }>) {
        if (r.email && r.user_id) emailToUserId.set(r.email.toLowerCase(), r.user_id);
      }
    }

    const enrichedAthletes = athletes.map((a) => ({
      ...a,
      user_id: a.user_id ?? (a.email ? emailToUserId.get(a.email.toLowerCase()) : undefined),
    }));

    const category = eventTypeToCategory(eventType);
    const allUserIds = enrichedAthletes
      .map((a) => a.user_id)
      .filter((u): u is string => Boolean(u));
    const { pushUserIds, emailUserIds } = await filterByPreferences(
      supabaseService,
      allUserIds,
      category
    );
    const allowedPushSet = new Set(pushUserIds);
    const allowedEmailSet = new Set(emailUserIds);

    const fromName = clubName ? `${APP_NAME} - ${clubName}` : APP_NAME;
    // Sanitize: OneSignal email_from_name must be ASCII-safe, no emoji
    const safeFromName = cleanSubject(fromName).slice(0, 64) || APP_NAME;

    // 🔔 ALWAYS create in-app bell notifications (red dot in header) for all athletes
    // regardless of which channels (push/email/sms) are checked.
    const bellRows = enrichedAthletes
      .filter((a) => a.user_id)
      .map((a) => ({
        user_id: a.user_id!,
        category_id: category_id ?? null,
        notification_type: eventType,
        title: subject,
        message: message,
        metadata: {
          source: "notify-athletes",
          eventType,
          eventDetails: eventDetails ?? null,
          clubName: clubName ?? null,
          categoryName: categoryName ?? null,
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
      const emailAllowed = !athlete.user_id || allowedEmailSet.has(athlete.user_id);
      const pushAllowed = !athlete.user_id || allowedPushSet.has(athlete.user_id);

      if (APP_NOTIFICATION_EMAILS_ENABLED && channels.includes("email") && athlete.email && emailAllowed) {
        try {
          // Build details lines for the message body
          const detailsLines: string[] = [];
          if (eventDetails?.date) detailsLines.push(`📅 ${eventDetails.date}`);
          if (eventDetails?.time) detailsLines.push(`🕐 ${eventDetails.time}`);
          if (eventDetails?.location) detailsLines.push(`📍 ${eventDetails.location}`);
          const fullMessage = detailsLines.length
            ? `Bonjour ${athlete.name},\n\n${message}\n\n${detailsLines.join("\n")}`
            : `Bonjour ${athlete.name},\n\n${message}`;

          const idemKey = `notify-${eventType}-${athlete.user_id ?? athlete.email}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          const result = await sendTemplateEmailWithLog(supabaseService, "app-notification", athlete.email, {
            idempotencyKey: idemKey,
            templateData: {
              siteName: APP_NAME,
              siteUrl: APP_URL,
              title: subject,
              message: fullMessage,
              ctaLabel: "Ouvrir l'application",
              ctaUrl: APP_URL,
            },
          });

          if (result.sent) results.emailsSent++;
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          results.errors.push(`Email ${athlete.email}: ${errorMessage}`);
        }
      }

      if (channels.includes("sms") && athlete.phone) {
        try {
          let formattedPhone = athlete.phone.replace(/\s/g, "");
          if (!formattedPhone.startsWith("+")) {
            if (formattedPhone.startsWith("0")) {
              formattedPhone = "+33" + formattedPhone.substring(1);
            } else {
              formattedPhone = "+" + formattedPhone;
            }
          }

          let smsContent = `${subject}\n${message}`;
          if (eventDetails?.date) smsContent += `\n${eventDetails.date}`;
          if (eventDetails?.time) smsContent += ` a ${eventDetails.time}`;
          if (eventDetails?.location) smsContent += `\n${eventDetails.location}`;
          if (smsContent.length > 300) smsContent = smsContent.substring(0, 297) + "...";

          const smsResponse = await fetch("https://api.onesignal.com/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Key ${ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify({
              app_id: ONESIGNAL_APP_ID,
              include_phone_numbers: [formattedPhone],
              sms_from: "CocoriCoach",
              contents: { en: smsContent },
              name: `SMS to ${athlete.name}`,
            }),
          });

          if (smsResponse.ok) {
            results.smsSent++;
          } else {
            const errorData = await smsResponse.json();
            results.errors.push(`SMS ${athlete.phone}: ${JSON.stringify(errorData)}`);
          }
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          results.errors.push(`SMS ${athlete.phone}: ${errorMessage}`);
        }
      }

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
