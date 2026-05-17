/**
 * Returns the canonical app URL to use when generating invitation links,
 * deep-links sent via email/push, etc.
 *
 * Goal: even when staff create an invitation from the Lovable preview
 * (lovable.dev / id-preview-*.lovable.app), the link embedded in the email
 * must point to the production site (cocoricoachclub.com), NOT the preview
 * sandbox — otherwise recipients land on a Lovable login screen they can't
 * authenticate against.
 */

const PRODUCTION_URL = "https://cocoricoachclub.com";

export function getAppBaseUrl(): string {
  if (typeof window === "undefined") return PRODUCTION_URL;

  const origin = window.location.origin;
  const host = window.location.hostname;

  // Preview / sandbox origins → swap to production
  if (
    host.endsWith("lovable.dev") ||
    host.endsWith("lovableproject.com") ||
    host.includes("id-preview--") ||
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1")
  ) {
    return PRODUCTION_URL;
  }

  return origin;
}
