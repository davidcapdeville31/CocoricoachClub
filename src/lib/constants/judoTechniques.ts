// Judo techniques (Gokyo + popular extras)
// Organized by family. Used to track per-attack stats: attempts / successes / points.

export interface JudoTechnique {
  key: string;
  label: string;
  family: "te" | "koshi" | "ashi" | "sutemi" | "ne_osae" | "ne_shime" | "ne_kansetsu";
}

export const JUDO_TECHNIQUES: JudoTechnique[] = [
  // Te-waza (techniques de bras / épaule)
  { key: "seoi_nage", label: "Seoi-nage", family: "te" },
  { key: "ippon_seoi_nage", label: "Ippon seoi-nage", family: "te" },
  { key: "morote_seoi_nage", label: "Morote seoi-nage", family: "te" },
  { key: "tai_otoshi", label: "Tai-otoshi", family: "te" },
  { key: "kata_guruma", label: "Kata-guruma", family: "te" },
  { key: "sukui_nage", label: "Sukui-nage", family: "te" },
  { key: "te_guruma", label: "Te-guruma", family: "te" },
  { key: "kibisu_gaeshi", label: "Kibisu-gaeshi", family: "te" },

  // Koshi-waza (techniques de hanche)
  { key: "uki_goshi", label: "Uki-goshi", family: "koshi" },
  { key: "o_goshi", label: "O-goshi", family: "koshi" },
  { key: "harai_goshi", label: "Harai-goshi", family: "koshi" },
  { key: "tsuri_komi_goshi", label: "Tsuri-komi-goshi", family: "koshi" },
  { key: "hane_goshi", label: "Hane-goshi", family: "koshi" },
  { key: "utsuri_goshi", label: "Utsuri-goshi", family: "koshi" },
  { key: "ushiro_goshi", label: "Ushiro-goshi", family: "koshi" },

  // Ashi-waza (techniques de jambe)
  { key: "de_ashi_harai", label: "De-ashi-harai", family: "ashi" },
  { key: "okuri_ashi_harai", label: "Okuri-ashi-harai", family: "ashi" },
  { key: "sasae_tsurikomi_ashi", label: "Sasae-tsurikomi-ashi", family: "ashi" },
  { key: "hiza_guruma", label: "Hiza-guruma", family: "ashi" },
  { key: "o_soto_gari", label: "O-soto-gari", family: "ashi" },
  { key: "o_uchi_gari", label: "O-uchi-gari", family: "ashi" },
  { key: "ko_soto_gari", label: "Ko-soto-gari", family: "ashi" },
  { key: "ko_uchi_gari", label: "Ko-uchi-gari", family: "ashi" },
  { key: "uchi_mata", label: "Uchi-mata", family: "ashi" },
  { key: "ashi_guruma", label: "Ashi-guruma", family: "ashi" },
  { key: "o_guruma", label: "O-guruma", family: "ashi" },
  { key: "o_soto_guruma", label: "O-soto-guruma", family: "ashi" },

  // Sutemi-waza (sacrifices)
  { key: "tomoe_nage", label: "Tomoe-nage", family: "sutemi" },
  { key: "sumi_gaeshi", label: "Sumi-gaeshi", family: "sutemi" },
  { key: "yoko_otoshi", label: "Yoko-otoshi", family: "sutemi" },
  { key: "tani_otoshi", label: "Tani-otoshi", family: "sutemi" },
  { key: "yoko_guruma", label: "Yoko-guruma", family: "sutemi" },
  { key: "uki_waza", label: "Uki-waza", family: "sutemi" },
  { key: "soto_makikomi", label: "Soto-makikomi", family: "sutemi" },

  // Ne-waza : immobilisations (osae-komi)
  { key: "kesa_gatame", label: "Kesa-gatame", family: "ne_osae" },
  { key: "kata_gatame", label: "Kata-gatame", family: "ne_osae" },
  { key: "kami_shiho_gatame", label: "Kami-shiho-gatame", family: "ne_osae" },
  { key: "yoko_shiho_gatame", label: "Yoko-shiho-gatame", family: "ne_osae" },
  { key: "tate_shiho_gatame", label: "Tate-shiho-gatame", family: "ne_osae" },

  // Ne-waza : étranglements (shime-waza)
  { key: "hadaka_jime", label: "Hadaka-jime", family: "ne_shime" },
  { key: "okuri_eri_jime", label: "Okuri-eri-jime", family: "ne_shime" },
  { key: "kata_ha_jime", label: "Kata-ha-jime", family: "ne_shime" },
  { key: "sankaku_jime", label: "Sankaku-jime", family: "ne_shime" },
  { key: "gyaku_juji_jime", label: "Gyaku-juji-jime", family: "ne_shime" },

  // Ne-waza : clés articulaires (kansetsu-waza)
  { key: "ude_garami", label: "Ude-garami", family: "ne_kansetsu" },
  { key: "juji_gatame", label: "Juji-gatame", family: "ne_kansetsu" },
  { key: "ude_gatame", label: "Ude-gatame", family: "ne_kansetsu" },
  { key: "waki_gatame", label: "Waki-gatame", family: "ne_kansetsu" },
];

export const JUDO_TECHNIQUE_FAMILIES: { key: JudoTechnique["family"]; label: string }[] = [
  { key: "te", label: "Te-waza (bras / épaule)" },
  { key: "koshi", label: "Koshi-waza (hanche)" },
  { key: "ashi", label: "Ashi-waza (jambe)" },
  { key: "sutemi", label: "Sutemi-waza (sacrifices)" },
  { key: "ne_osae", label: "Osae-komi (immobilisations)" },
  { key: "ne_shime", label: "Shime-waza (étranglements)" },
  { key: "ne_kansetsu", label: "Kansetsu-waza (clés)" },
];

// Stat key helpers for the JSONB stats column on competition_rounds
export const techStatKey = (techKey: string, kind: "att" | "suc" | "pts") =>
  `tech__${techKey}__${kind}`;

export function summarizeTechniqueStats(stats: Record<string, number> | null | undefined) {
  const out: Record<string, { att: number; suc: number; pts: number }> = {};
  if (!stats) return out;
  for (const [k, v] of Object.entries(stats)) {
    const m = k.match(/^tech__(.+)__(att|suc|pts)$/);
    if (!m) continue;
    const [, techKey, kind] = m;
    if (!out[techKey]) out[techKey] = { att: 0, suc: 0, pts: 0 };
    out[techKey][kind as "att" | "suc" | "pts"] += Number(v) || 0;
  }
  return out;
}
