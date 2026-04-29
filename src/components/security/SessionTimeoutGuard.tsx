import { useSessionTimeout } from "@/lib/security/hooks/useSessionTimeout";
import { useUserSecuritySettings } from "@/lib/security/hooks/useUserSecuritySettings";

/**
 * Mounts the session-timeout watcher.
 * Reads the user's preferred timeout from user_security_settings
 * (defaults to 30 minutes for security on shared devices / sensitive medical data).
 */
export function SessionTimeoutGuard() {
  const { data: settings } = useUserSecuritySettings();
  const timeoutMinutes = settings?.session_timeout_minutes ?? 30;
  useSessionTimeout(timeoutMinutes);
  return null;
}
