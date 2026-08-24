// Translates user-entered content (exercise names, session themes, notes, goals...)
// and caches the result in public.content_translations so each string is only
// ever paid for once. Called at save time by the app so both languages exist
// before anyone switches the interface language.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Lang = "fr" | "en";

const LANG_LABEL: Record<Lang, string> = {
  fr: "French",
  en: "English",
};

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const sourceLang: Lang = body.sourceLang === "en" ? "en" : "fr";
    const targetLang: Lang = body.targetLang === "en" ? "en" : "fr";
    const rawTexts: unknown = body.texts;

    if (!Array.isArray(rawTexts)) {
      return new Response(JSON.stringify({ error: "texts must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize: keep short, meaningful, unique strings only.
    const texts = Array.from(
      new Set(
        rawTexts
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim())
          .filter((t) => t.length > 0 && t.length <= 2000),
      ),
    );

    const translations: Record<string, string> = {};

    if (texts.length === 0 || sourceLang === targetLang) {
      return new Response(JSON.stringify({ translations }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const hashes = await Promise.all(texts.map(sha256));
    const hashToText = new Map<string, string>();
    hashes.forEach((h, i) => hashToText.set(h, texts[i]));

    // 1. Reuse anything already translated.
    const { data: cached } = await supabase
      .from("content_translations")
      .select("source_hash, translated_text")
      .eq("source_lang", sourceLang)
      .eq("target_lang", targetLang)
      .in("source_hash", hashes);

    const cachedHashes = new Set<string>();
    for (const row of cached ?? []) {
      const src = hashToText.get(row.source_hash as string);
      if (src) {
        translations[src] = row.translated_text as string;
        cachedHashes.add(row.source_hash as string);
      }
    }

    const missing = hashes
      .filter((h) => !cachedHashes.has(h))
      .map((h) => ({ hash: h, text: hashToText.get(h)! }));

    if (missing.length === 0) {
      return new Response(JSON.stringify({ translations }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Translate the remainder in one batched call.
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(
        JSON.stringify({ error: "AI translation is not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const prompt = [
      `Translate each item from ${LANG_LABEL[sourceLang]} to ${LANG_LABEL[targetLang]}.`,
      "Context: a sports coaching / athlete performance application (training, strength, wellness, competition).",
      "Rules: keep proper nouns, athlete names, club names, abbreviations (RPE, ACWR, 3RM, GPS) and numbers unchanged.",
      "Keep the same casing style and punctuation. Return only the translation, no comments.",
      'Answer with a JSON object shaped {"items":[{"i":0,"t":"translation"}, ...]} covering every index.',
      "",
      JSON.stringify(missing.map((m, i) => ({ i, s: m.text }))),
    ].join("\n");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const detail = await aiRes.text();
      console.error("AI gateway error", aiRes.status, detail);
      return new Response(
        JSON.stringify({
          error:
            aiRes.status === 402
              ? "Crédits IA épuisés : la traduction automatique est en pause."
              : aiRes.status === 429
                ? "Trop de traductions demandées, réessaie dans un instant."
                : "La traduction automatique a échoué.",
          translations,
        }),
        {
          status: aiRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const aiJson = await aiRes.json();
    const content: string = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let items: Array<{ i: number; t: string }> = [];
    try {
      const parsed = JSON.parse(content);
      items = Array.isArray(parsed?.items) ? parsed.items : [];
    } catch (_e) {
      console.error("Unparseable AI response", content.slice(0, 500));
    }

    const rows: Array<Record<string, string>> = [];
    for (const item of items) {
      const entry = missing[item?.i as number];
      if (!entry || typeof item?.t !== "string" || !item.t.trim()) continue;
      translations[entry.text] = item.t.trim();
      rows.push({
        source_hash: entry.hash,
        source_lang: sourceLang,
        target_lang: targetLang,
        source_text: entry.text,
        translated_text: item.t.trim(),
      });
    }

    if (rows.length > 0) {
      const { error } = await supabase
        .from("content_translations")
        .upsert(rows, { onConflict: "source_hash,source_lang,target_lang" });
      if (error) console.error("Cache write failed", error);
    }

    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("translate-content failed", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message ?? "Unexpected error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
