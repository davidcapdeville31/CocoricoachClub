import flagFr from "@/assets/banner-bg/flag-fr.jpg";
import gradientIndigo from "@/assets/banner-bg/gradient-indigo.jpg";
import stadiumNight from "@/assets/banner-bg/stadium-night.jpg";
import grassField from "@/assets/banner-bg/grass-field.jpg";
import mountains from "@/assets/banner-bg/mountains.jpg";
import carbon from "@/assets/banner-bg/carbon.jpg";
import basketballCourt from "@/assets/banner-bg/basketball-court.jpg";
import stadiumSeats from "@/assets/banner-bg/stadium-seats.jpg";
import runningTrack from "@/assets/banner-bg/running-track.jpg";
import swimmingPool from "@/assets/banner-bg/swimming-pool.jpg";
import tennisCourt from "@/assets/banner-bg/tennis-court.jpg";
import bowlingAlley from "@/assets/banner-bg/bowling-alley.jpg";
import boxingGym from "@/assets/banner-bg/boxing-gym.jpg";
import weightRoom from "@/assets/banner-bg/weight-room.jpg";
import footballPitch from "@/assets/banner-bg/football-pitch.jpg";
import rugbyPitch from "@/assets/banner-bg/rugby-pitch.jpg";
import throwingSports from "@/assets/banner-bg/throwing-sports.jpg";
import judoDojo from "@/assets/banner-bg/judo-dojo.jpg";
import skiSlope from "@/assets/banner-bg/ski-slope.jpg";
import snowboardPark from "@/assets/banner-bg/snowboard-park.jpg";
import freshSnow from "@/assets/banner-bg/fresh-snow.jpg";
import climbingWall from "@/assets/banner-bg/climbing-wall.jpg";

export interface HeaderBackgroundPreset {
  id: string;
  label: string;
  url: string;
}

/**
 * Fonds d'écran de bandeau prédéfinis.
 * Tous les visuels sont au format 1920x512 (~4:1) pour s'adapter exactement
 * au cadre derrière le logo de catégorie sans déformation.
 */
export const HEADER_BACKGROUND_PRESETS: HeaderBackgroundPreset[] = [
  // Génériques
  { id: "default", label: "Dégradé par défaut", url: "" },
  { id: "flag-fr", label: "Drapeau France", url: flagFr },
  { id: "gradient-indigo", label: "Vague indigo", url: gradientIndigo },
  { id: "carbon", label: "Carbone sombre", url: carbon },
  { id: "stadium-night", label: "Stade de nuit", url: stadiumNight },
  { id: "stadium-seats", label: "Tribunes", url: stadiumSeats },
  { id: "grass-field", label: "Pelouse sportive", url: grassField },

  // Sports collectifs
  { id: "football-pitch", label: "Football", url: footballPitch },
  { id: "rugby-pitch", label: "Rugby", url: rugbyPitch },
  { id: "basketball-court", label: "Basket", url: basketballCourt },

  // Raquette
  { id: "tennis-court", label: "Tennis – terre battue", url: tennisCourt },

  // Athlétisme & lancers
  { id: "running-track", label: "Athlétisme – piste", url: runningTrack },
  { id: "throwing-sports", label: "Sports de lancer", url: throwingSports },

  // Aquatique
  { id: "swimming-pool", label: "Natation", url: swimmingPool },

  // Combat
  { id: "judo-dojo", label: "Judo – dojo", url: judoDojo },
  { id: "boxing-gym", label: "Boxe", url: boxingGym },

  // Bowling
  { id: "bowling-alley", label: "Bowling", url: bowlingAlley },

  // Force
  { id: "weight-room", label: "Musculation", url: weightRoom },

  // Outdoor & glisse
  { id: "climbing-wall", label: "Escalade", url: climbingWall },
  { id: "ski-slope", label: "Ski", url: skiSlope },
  { id: "snowboard-park", label: "Snowboard", url: snowboardPark },
  { id: "fresh-snow", label: "Neige", url: freshSnow },
  { id: "mountains", label: "Montagne", url: mountains },
];

/**
 * Résout une valeur stockée en base (qui peut être :
 *  - un id de preset (ex: "flag-fr")
 *  - une URL externe (http/https)
 *  - un ancien chemin bundlé devenu invalide après rebuild
 *    (ex: "/assets/flag-fr-XXXX.jpg" ou "/src/assets/banner-bg/flag-fr.jpg")
 * vers l'URL bundlée actuelle. Retourne null si rien n'est trouvé.
 */
export function resolveHeaderBackgroundUrl(
  stored: string | null | undefined,
): string | null {
  if (!stored) return null;

  // URL externe : on la garde telle quelle
  if (/^https?:\/\//i.test(stored)) return stored;

  // 1) Match direct par id de preset
  const byId = HEADER_BACKGROUND_PRESETS.find((p) => p.id === stored);
  if (byId) return byId.url || null;

  // 2) Extraire le nom de base du chemin et le matcher au slug du preset.
  //    Ex: "/assets/flag-fr-DTE71Q8C.jpg" -> "flag-fr"
  //    Ex: "/src/assets/banner-bg/flag-fr.jpg" -> "flag-fr"
  const filename = stored.split("/").pop() ?? stored;
  const baseRaw = filename.replace(/\.[a-z0-9]+$/i, "");
  // Retirer un éventuel hash Vite final type "-AbC123_x"
  const base = baseRaw.replace(/-[A-Za-z0-9_-]{6,}$/i, "");

  const bySlug = HEADER_BACKGROUND_PRESETS.find(
    (p) => p.id === base || p.id === baseRaw,
  );
  if (bySlug) return bySlug.url || null;

  // 3) Inconnu : on retourne tel quel (peut casser, mais on n'a pas mieux)
  return stored;
}
