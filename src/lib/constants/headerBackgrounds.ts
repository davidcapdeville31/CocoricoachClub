import flagFr from "@/assets/banner-bg/flag-fr.jpg";
import gradientIndigo from "@/assets/banner-bg/gradient-indigo.jpg";
import stadiumNight from "@/assets/banner-bg/stadium-night.jpg";
import grassField from "@/assets/banner-bg/grass-field.jpg";
import mountains from "@/assets/banner-bg/mountains.jpg";
import carbon from "@/assets/banner-bg/carbon.jpg";

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
  { id: "default", label: "Dégradé par défaut", url: "" },
  { id: "flag-fr", label: "Drapeau France", url: flagFr },
  { id: "gradient-indigo", label: "Vague indigo", url: gradientIndigo },
  { id: "stadium-night", label: "Stade de nuit", url: stadiumNight },
  { id: "grass-field", label: "Pelouse sportive", url: grassField },
  { id: "mountains", label: "Montagne enneigée", url: mountains },
  { id: "carbon", label: "Carbone sombre", url: carbon },
];
