import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Validates a scheduled-job request.
 * Accepts either the CRON_SECRET env value or the internal token stored in
 * public.cron_tokens (used by pg_cron jobs, which cannot read edge secrets).
 */
export async function isAuthorizedCronRequest(req: Request): Promise<boolean> {
  const provided = req.headers.get("x-cron-secret");
  if (!provided) return false;

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && provided === cronSecret) return true;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await supabase.from("cron_tokens").select("token").limit(1);
    return !!data?.some((row: { token: string }) => row.token === provided);
  } catch (_e) {
    return false;
  }
}
