/**
 * OneSignal Web SDK integration for CocoriCoach PWA
 * Handles initialization, external_id assignment, and dynamic tag management
 */

import { supabase } from "@/integrations/supabase/client";

// Declare OneSignal global types
declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: any) => void>;
    OneSignal?: any;
  }
}

let isInitialized = false;
let cachedAppId: string | null = null;

/**
 * Fetch OneSignal App ID from backend (it's a public key but we keep it configurable)
 */
async function getOneSignalAppId(): Promise<string | null> {
  if (cachedAppId) return cachedAppId;

  try {
    const { data, error } = await supabase.functions.invoke("get-onesignal-config");
    if (error) {
      console.error("[OneSignal] Error fetching config:", error);
      return null;
    }
    cachedAppId = data?.appId || null;
    return cachedAppId;
  } catch (err) {
    console.error("[OneSignal] Failed to fetch config:", err);
    return null;
  }
}

/**
 * Initialize OneSignal SDK
 */
export async function initOneSignal(): Promise<void> {
  if (isInitialized) return;
  if (typeof window === "undefined") return;

  const appId = await getOneSignalAppId();
  if (!appId) {
    console.warn("[OneSignal] No App ID available, skipping init");
    return;
  }

  try {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      await OneSignal.init({
        appId,
        serviceWorkerParam: { scope: "/" },
        serviceWorkerPath: "/OneSignalSDKWorker.js",
        notifyButton: { enable: false },
        allowLocalhostAsSecureOrigin: true,
      });
      isInitialized = true;
      console.log("[OneSignal] SDK initialized successfully");
    });
  } catch (err) {
    console.error("[OneSignal] Init error:", err);
  }
}

/**
 * Login user to OneSignal: set external_id and tags
 */
export async function oneSignalLogin(
  userId: string,
  email: string,
  userTags: Record<string, string>
): Promise<void> {
  if (typeof window === "undefined" || !window.OneSignal) {
    console.warn("[OneSignal] SDK not loaded yet");
    return;
  }

  try {
    // Set external_id to user's auth UUID
    await window.OneSignal.login(userId);
    console.log("[OneSignal] User logged in with external_id:", userId);

    // Set tags for filtering
    const tags: Record<string, string> = {
      user_id: userId,
      email: email,
      ...userTags,
    };

    await window.OneSignal.User.addTags(tags);
    console.log("[OneSignal] Tags set:", tags);
  } catch (err) {
    console.error("[OneSignal] Login error:", err);
  }
}

/**
 * Logout user from OneSignal
 */
export async function oneSignalLogout(): Promise<void> {
  if (typeof window === "undefined" || !window.OneSignal) return;

  try {
    await window.OneSignal.logout();
    console.log("[OneSignal] User logged out");
  } catch (err) {
    console.error("[OneSignal] Logout error:", err);
  }
}

/**
 * Update OneSignal tags (e.g., when switching club/category context)
 */
export async function updateOneSignalTags(
  tags: Record<string, string>
): Promise<void> {
  if (typeof window === "undefined" || !window.OneSignal) return;

  try {
    await window.OneSignal.User.addTags(tags);
    console.log("[OneSignal] Tags updated:", tags);
  } catch (err) {
    console.error("[OneSignal] Tag update error:", err);
  }
}

/**
 * Remove specific OneSignal tags
 */
export async function removeOneSignalTags(tagKeys: string[]): Promise<void> {
  if (typeof window === "undefined" || !window.OneSignal) return;

  try {
    await window.OneSignal.User.removeTags(tagKeys);
    console.log("[OneSignal] Tags removed:", tagKeys);
  } catch (err) {
    console.error("[OneSignal] Tag removal error:", err);
  }
}

/**
 * Fetch user's club and category memberships and build tags
 */
export async function buildUserTags(userId: string): Promise<Record<string, string>> {
  const tags: Record<string, string> = {};

  try {
    // Get club memberships
    const { data: clubMemberships } = await supabase
      .from("club_members")
      .select("club_id, role")
      .eq("user_id", userId);

    // Get owned clubs
    const { data: ownedClubs } = await supabase
      .from("clubs")
      .select("id")
      .eq("user_id", userId);

    // Get category memberships
    const { data: categoryMemberships } = await supabase
      .from("category_members")
      .select("category_id, role")
      .eq("user_id", userId);

    // Build club_ids tag (comma-separated)
    const allClubIds = new Set<string>();
    clubMemberships?.forEach((m) => allClubIds.add(m.club_id));
    ownedClubs?.forEach((c) => allClubIds.add(c.id));

    if (allClubIds.size > 0) {
      tags.club_ids = Array.from(allClubIds).join(",");
    }

    // Build category_ids tag
    if (categoryMemberships && categoryMemberships.length > 0) {
      tags.category_ids = categoryMemberships.map((m) => m.category_id).join(",");
    }

    // Determine primary role (highest privilege)
    const roles = new Set<string>();
    clubMemberships?.forEach((m) => roles.add(m.role));
    categoryMemberships?.forEach((m) => roles.add(m.role));
    if (ownedClubs && ownedClubs.length > 0) roles.add("admin");

    // Set role hierarchy: admin > coach > physio > doctor > viewer > athlete
    const roleHierarchy = ["admin", "coach", "physio", "doctor", "viewer", "athlete"];
    for (const r of roleHierarchy) {
      if (roles.has(r)) {
        tags.role = r;
        break;
      }
    }

    // Determine user_type
    tags.user_type = roles.has("athlete") && roles.size === 1 ? "athlete" : "staff";

    // Check super admin
    const { data: isSuperAdmin } = await supabase
      .rpc("is_super_admin", { _user_id: userId });
    if (isSuperAdmin) {
      tags.is_super_admin = "true";
      tags.role = "super_admin";
    }
  } catch (err) {
    console.error("[OneSignal] Error building user tags:", err);
  }

  return tags;
}
