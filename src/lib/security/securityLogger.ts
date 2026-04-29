import { supabase } from "@/integrations/supabase/client";

/**
 * Security event logger — central API for tracking security-relevant events.
 * Uses the public.log_security_event RPC which is SECURITY DEFINER.
 */

export type SecuritySeverity = "info" | "warning" | "critical";

export type SecurityEventType =
  | "login_success"
  | "login_failed"
  | "logout"
  | "password_changed"
  | "password_reset_requested"
  | "mfa_enabled"
  | "mfa_disabled"
  | "mfa_verified"
  | "mfa_failed"
  | "new_device_login"
  | "session_timeout"
  | "suspicious_access"
  | "data_export_requested"
  | "account_deletion_requested"
  | "consent_given"
  | "consent_revoked"
  | "permission_denied";

interface LogEventOptions {
  eventType: SecurityEventType | string;
  severity?: SecuritySeverity;
  clubId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Generate a stable device fingerprint (privacy-preserving).
 * Uses screen + timezone + UA hash. Not 100% unique but enough to detect
 * obvious new-device situations.
 */
export function getDeviceFingerprint(): string {
  if (typeof window === "undefined") return "server";
  const parts = [
    window.navigator.userAgent,
    `${window.screen.width}x${window.screen.height}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    window.navigator.language,
  ];
  // Simple non-cryptographic hash
  let hash = 0;
  const str = parts.join("|");
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `dev_${Math.abs(hash).toString(36)}`;
}

export async function logSecurityEvent(opts: LogEventOptions): Promise<void> {
  try {
    const fingerprint = getDeviceFingerprint();
    const userAgent = typeof window !== "undefined" ? window.navigator.userAgent : null;

    await supabase.rpc("log_security_event", {
      _event_type: opts.eventType,
      _severity: opts.severity ?? "info",
      _ip_address: null, // Filled by backend if available
      _user_agent: userAgent,
      _device_fingerprint: fingerprint,
      _club_id: opts.clubId ?? null,
      _metadata: (opts.metadata ?? {}) as never,
    });
  } catch (err) {
    // Never throw from logging — fail silently
    console.warn("[security] event log failed", err);
  }
}

/**
 * Log access to sensitive data (medical records, personal info, etc.)
 * Required for RGPD compliance.
 */
export async function logSensitiveAccess(opts: {
  playerId?: string | null;
  table: string;
  action: "view" | "export" | "modify" | "delete" | "decrypt";
  recordId?: string | null;
  categoryId?: string | null;
  justification?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await supabase.rpc("log_sensitive_access", {
      _accessed_player_id: opts.playerId ?? null,
      _accessed_table: opts.table,
      _access_action: opts.action,
      _accessed_record_id: opts.recordId ?? null,
      _category_id: opts.categoryId ?? null,
      _justification: opts.justification ?? null,
      _metadata: (opts.metadata ?? {}) as never,
    });
  } catch (err) {
    console.warn("[security] sensitive access log failed", err);
  }
}
