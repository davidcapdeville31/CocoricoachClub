import { supabase } from "@/integrations/supabase/client";
import logoLight from "@/assets/logo-light.png";

/** Load any image (URL or imported asset) as a PNG data URL via canvas (handles CORS). */
export async function loadImageAsDataUrl(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        resolve(c.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Resolve the best available logo URL for PDF reports:
 * 1. Custom PDF settings logo of this category (if any)
 * 2. Club logo (clubs.logo_url)
 * 3. Default app logo
 *
 * Pass categoryId when the report is scoped to one category, or clubId directly
 * when only a club context is available (e.g. cross-category exports).
 */
export async function getReportLogoDataUrl(opts: {
  categoryId?: string | null;
  clubId?: string | null;
}): Promise<string> {
  let pdfSettingsLogo: string | null = null;
  let clubLogo: string | null = null;

  try {
    if (opts.categoryId) {
      const { data: settings } = await supabase
        .from("pdf_custom_settings" as any)
        .select("logo_url, show_logo")
        .eq("category_id", opts.categoryId)
        .maybeSingle();
      if (settings && (settings as any).show_logo !== false) {
        pdfSettingsLogo = (settings as any).logo_url || null;
      }

      const { data: cat } = await supabase
        .from("categories")
        .select("club_id, clubs(logo_url)")
        .eq("id", opts.categoryId)
        .single();
      const c = (cat as any)?.clubs;
      clubLogo = c?.logo_url || null;
    } else if (opts.clubId) {
      const { data: club } = await supabase
        .from("clubs")
        .select("logo_url")
        .eq("id", opts.clubId)
        .single();
      clubLogo = (club as any)?.logo_url || null;
    }
  } catch {
    // ignore
  }

  const finalUrl = pdfSettingsLogo || clubLogo;
  if (finalUrl) {
    const data = await loadImageAsDataUrl(finalUrl);
    if (data) return data;
  }

  // Fallback: default app logo
  const fallback = await loadImageAsDataUrl(logoLight);
  return fallback || logoLight;
}
