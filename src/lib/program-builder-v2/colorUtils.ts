/**
 * Utilitaires de couleur pour le système de branding
 * Conforme WCAG 2.1 pour l'accessibilité
 */

// === Conversions de couleurs ===

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`;
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 0, s: 0, l: 50 };
  return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

export function hslToHex(h: number, s: number, l: number): string {
  const rgb = hslToRgb(h, s, l);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

// === Calculs de contraste WCAG ===

/**
 * Calcule la luminance relative selon WCAG 2.1
 */
export function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calcule le ratio de contraste entre deux couleurs
 * Retourne un nombre entre 1 et 21
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 1;

  const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Vérifie si le contraste respecte les normes WCAG AA
 * @param ratio - Ratio de contraste
 * @param isLargeText - true pour texte >= 18pt ou 14pt bold
 */
export function isWCAGCompliant(ratio: number, isLargeText = false): boolean {
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Détermine si une couleur est claire ou foncée
 */
export function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  return luminance > 0.179;
}

/**
 * Retourne la meilleure couleur de texte (noir ou blanc) pour un fond donné
 */
export function getContrastTextColor(backgroundColor: string): string {
  return isLightColor(backgroundColor) ? '#1a1a1a' : '#ffffff';
}

/**
 * Génère la valeur HSL pour CSS (format "h s% l%")
 */
export function hexToHslCss(hex: string): string {
  const hsl = hexToHsl(hex);
  return `${hsl.h} ${hsl.s}% ${hsl.l}%`;
}

// === Génération de variations de couleurs ===

/**
 * Crée une version plus claire d'une couleur
 */
export function lightenColor(hex: string, amount: number = 20): string {
  const hsl = hexToHsl(hex);
  return hslToHex(hsl.h, hsl.s, Math.min(100, hsl.l + amount));
}

/**
 * Crée une version plus foncée d'une couleur
 */
export function darkenColor(hex: string, amount: number = 20): string {
  const hsl = hexToHsl(hex);
  return hslToHex(hsl.h, hsl.s, Math.max(0, hsl.l - amount));
}

/**
 * Crée une couleur complémentaire
 */
export function getComplementaryColor(hex: string): string {
  const hsl = hexToHsl(hex);
  return hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l);
}

/**
 * Calcule la saturation d'une couleur (0-100)
 */
export function getSaturation(hex: string): number {
  const hsl = hexToHsl(hex);
  return hsl.s;
}

// === Extraction de couleurs depuis image ===

export interface ExtractedColors {
  primary: string;
  secondary: string;
  accent: string;
  dominantColors: string[];
}

/**
 * Extrait les couleurs dominantes d'une image
 * Utilise un algorithme de quantification amélioré
 */
export async function extractColorsFromImage(imageDataUrl: string): Promise<ExtractedColors> {
  return new Promise((resolve) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (!ctx) {
          console.error('Canvas context not available');
          resolve(getDefaultColors());
          return;
        }

        // Taille d'analyse optimisée
        const maxSize = 80;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.max(1, Math.floor(img.width * scale));
        canvas.height = Math.max(1, Math.floor(img.height * scale));
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        
        // Collecter les couleurs avec quantification
        const colorBuckets: Map<string, { r: number; g: number; b: number; count: number; saturation: number }> = new Map();
        
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];
          
          // Ignorer pixels transparents
          if (a < 128) continue;
          
          // Calculer HSL pour filtrer
          const hsl = rgbToHsl(r, g, b);
          
          // Ignorer couleurs trop sombres, claires, ou grises
          if (hsl.l < 10 || hsl.l > 90) continue;
          if (hsl.s < 15 && hsl.l > 20 && hsl.l < 80) continue; // Gris
          
          // Quantifier (regrouper couleurs similaires)
          const qr = Math.round(r / 16) * 16;
          const qg = Math.round(g / 16) * 16;
          const qb = Math.round(b / 16) * 16;
          const key = `${qr},${qg},${qb}`;
          
          const existing = colorBuckets.get(key);
          if (existing) {
            existing.count++;
          } else {
            colorBuckets.set(key, { r: qr, g: qg, b: qb, count: 1, saturation: hsl.s });
          }
        }
        
        // Trier par fréquence pondérée par saturation
        const sortedColors = Array.from(colorBuckets.values())
          .filter(c => c.count > 2)
          .sort((a, b) => {
            // Favoriser les couleurs saturées et fréquentes
            const scoreA = a.count * (1 + a.saturation / 100);
            const scoreB = b.count * (1 + b.saturation / 100);
            return scoreB - scoreA;
          });
        
        if (sortedColors.length === 0) {
          console.log('No colors found in image, using defaults');
          resolve(getDefaultColors());
          return;
        }
        
        // Convertir en hex
        const hexColors = sortedColors.slice(0, 10).map(c => rgbToHex(c.r, c.g, c.b));
        
        // Sélectionner primary (la plus fréquente et saturée)
        const primary = hexColors[0];
        
        // Chercher une couleur contrastante pour accent
        let accent = hexColors[1] || getComplementaryColor(primary);
        for (const color of hexColors.slice(1)) {
          const diff = getColorDifference(primary, color);
          if (diff > 100) {
            accent = color;
            break;
          }
        }
        
        // Secondary: version claire de primary ou couleur claire du logo
        let secondary = hexColors.find(c => {
          const hsl = hexToHsl(c);
          return hsl.l > 50 && hsl.l < 85;
        }) || lightenColor(primary, 40);
        
        // S'assurer que secondary est assez claire
        const secondaryHsl = hexToHsl(secondary);
        if (secondaryHsl.l < 85) {
          secondary = hslToHex(secondaryHsl.h, Math.min(secondaryHsl.s, 20), 95);
        }
        
        resolve({
          primary,
          secondary,
          accent,
          dominantColors: hexColors,
        });
        
      } catch (error) {
        console.error('Color extraction error:', error);
        resolve(getDefaultColors());
      }
    };
    
    img.onerror = () => {
      console.error('Image load error');
      resolve(getDefaultColors());
    };
    
    img.src = imageDataUrl;
  });
}

function getColorDifference(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 0;
  return Math.abs(rgb1.r - rgb2.r) + Math.abs(rgb1.g - rgb2.g) + Math.abs(rgb1.b - rgb2.b);
}

function getDefaultColors(): ExtractedColors {
  return {
    primary: '#2563eb',
    secondary: '#f5f5f5',
    accent: '#dc2626',
    dominantColors: ['#2563eb', '#dc2626'],
  };
}

// === Génération de palette complète ===

export interface BrandingPalette {
  // Couleurs de marque
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  
  // Neutres (toujours générés)
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  card: string;
  cardForeground: string;
  border: string;
  
  // États
  destructive: string;
  destructiveForeground: string;
}

export interface DualModePalette {
  light: BrandingPalette;
  dark: BrandingPalette;
}

/**
 * Génère une palette complète à partir des couleurs de marque
 * Inclut automatiquement les neutres et calcule les contrastes
 */
export function generateBrandingPalette(
  primary: string, 
  secondary: string, 
  accent: string
): BrandingPalette {
  // Foreground colors avec contraste optimal
  const primaryFg = getContrastTextColor(primary);
  const accentFg = getContrastTextColor(accent);
  
  // Secondary doit être claire pour servir de fond
  let secondaryNormalized = secondary;
  const secHsl = hexToHsl(secondary);
  if (secHsl.l < 85) {
    secondaryNormalized = hslToHex(secHsl.h, Math.min(secHsl.s, 15), 96);
  }
  const secondaryFg = getContrastTextColor(secondaryNormalized);
  
  // Neutres - toujours blanc/gris/noir
  const background = '#ffffff';
  const foreground = '#0a0a0a';
  const muted = '#f5f5f5';
  const mutedForeground = '#737373';
  const card = '#ffffff';
  const cardForeground = '#0a0a0a';
  const border = '#e5e5e5';
  
  // Destructive - utiliser accent si rouge, sinon rouge standard
  const accentHsl = hexToHsl(accent);
  const isAccentReddish = accentHsl.h >= 0 && accentHsl.h <= 30 || accentHsl.h >= 330;
  const destructive = isAccentReddish ? accent : '#dc2626';
  const destructiveFg = getContrastTextColor(destructive);
  
  return {
    primary,
    primaryForeground: primaryFg,
    secondary: secondaryNormalized,
    secondaryForeground: secondaryFg,
    accent,
    accentForeground: accentFg,
    background,
    foreground,
    muted,
    mutedForeground,
    card,
    cardForeground,
    border,
    destructive,
    destructiveForeground: destructiveFg,
  };
}

/**
 * Génère une palette pour le mode sombre à partir des couleurs de marque
 * Ajuste les couleurs pour un meilleur rendu sur fond sombre
 */
export function generateDarkPalette(
  primary: string, 
  secondary: string, 
  accent: string
): BrandingPalette {
  const primaryHsl = hexToHsl(primary);
  const accentHsl = hexToHsl(accent);
  
  // En mode sombre, on éclaircit la couleur primaire pour meilleure visibilité
  const darkPrimary = hslToHex(
    primaryHsl.h, 
    Math.min(primaryHsl.s, 70), // Réduire légèrement la saturation
    Math.max(55, Math.min(65, primaryHsl.l + 15)) // Éclaircir pour visibilité
  );
  const primaryFg = getContrastTextColor(darkPrimary);
  
  // Accent aussi éclaircit pour le mode sombre
  const darkAccent = hslToHex(
    accentHsl.h,
    Math.min(accentHsl.s, 75),
    Math.max(55, Math.min(65, accentHsl.l + 10))
  );
  const accentFg = getContrastTextColor(darkAccent);
  
  // Secondary en mode sombre = version sombre et subtile
  const secHsl = hexToHsl(secondary);
  const darkSecondary = hslToHex(secHsl.h, Math.min(secHsl.s, 15), 20);
  const secondaryFg = getContrastTextColor(darkSecondary);
  
  // Neutres pour mode sombre
  const background = '#0a0a0f'; // Noir profond avec légère teinte
  const foreground = '#fafafa';
  const muted = '#1f1f23';
  const mutedForeground = '#a1a1aa';
  const card = '#18181b';
  const cardForeground = '#fafafa';
  const border = '#27272a';
  
  // Destructive
  const isAccentReddish = accentHsl.h >= 0 && accentHsl.h <= 30 || accentHsl.h >= 330;
  const destructive = isAccentReddish ? darkAccent : '#ef4444';
  const destructiveFg = getContrastTextColor(destructive);
  
  return {
    primary: darkPrimary,
    primaryForeground: primaryFg,
    secondary: darkSecondary,
    secondaryForeground: secondaryFg,
    accent: darkAccent,
    accentForeground: accentFg,
    background,
    foreground,
    muted,
    mutedForeground,
    card,
    cardForeground,
    border,
    destructive,
    destructiveForeground: destructiveFg,
  };
}

/**
 * Génère les palettes pour les deux modes (clair et sombre)
 */
export function generateDualModePalette(
  primary: string,
  secondary: string,
  accent: string
): DualModePalette {
  return {
    light: generateBrandingPalette(primary, secondary, accent),
    dark: generateDarkPalette(primary, secondary, accent),
  };
}

/**
 * Applique la palette aux variables CSS du document
 */
export function applyPaletteToDocument(palette: BrandingPalette): void {
  const root = document.documentElement;
  
  // Couleurs de marque
  root.style.setProperty('--primary', hexToHslCss(palette.primary));
  root.style.setProperty('--primary-foreground', hexToHslCss(palette.primaryForeground));
  
  root.style.setProperty('--secondary', hexToHslCss(palette.secondary));
  root.style.setProperty('--secondary-foreground', hexToHslCss(palette.secondaryForeground));
  
  root.style.setProperty('--accent', hexToHslCss(palette.accent));
  root.style.setProperty('--accent-foreground', hexToHslCss(palette.accentForeground));
  
  // Ring color = primary
  root.style.setProperty('--ring', hexToHslCss(palette.primary));
  
  // Destructive
  root.style.setProperty('--destructive', hexToHslCss(palette.destructive));
  root.style.setProperty('--destructive-foreground', hexToHslCss(palette.destructiveForeground));
  
  // Sidebar colors (alignées sur primary)
  root.style.setProperty('--sidebar-primary', hexToHslCss(palette.primary));
  root.style.setProperty('--sidebar-primary-foreground', hexToHslCss(palette.primaryForeground));
  root.style.setProperty('--sidebar-ring', hexToHslCss(palette.primary));
  root.style.setProperty('--sidebar-accent', hexToHslCss(palette.secondary));
  root.style.setProperty('--sidebar-accent-foreground', hexToHslCss(palette.secondaryForeground));
}

/**
 * Applique les palettes pour les deux modes (clair et sombre)
 * Injecte des règles CSS dans un élément style
 */
export function applyDualModePaletteToDocument(dualPalette: DualModePalette): void {
  const styleId = 'coach-branding-styles';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  
  const generateCssVars = (palette: BrandingPalette) => `
    --primary: ${hexToHslCss(palette.primary)};
    --primary-foreground: ${hexToHslCss(palette.primaryForeground)};
    --secondary: ${hexToHslCss(palette.secondary)};
    --secondary-foreground: ${hexToHslCss(palette.secondaryForeground)};
    --accent: ${hexToHslCss(palette.accent)};
    --accent-foreground: ${hexToHslCss(palette.accentForeground)};
    --ring: ${hexToHslCss(palette.primary)};
    --destructive: ${hexToHslCss(palette.destructive)};
    --destructive-foreground: ${hexToHslCss(palette.destructiveForeground)};
    --sidebar-primary: ${hexToHslCss(palette.primary)};
    --sidebar-primary-foreground: ${hexToHslCss(palette.primaryForeground)};
    --sidebar-ring: ${hexToHslCss(palette.primary)};
    --sidebar-accent: ${hexToHslCss(palette.secondary)};
    --sidebar-accent-foreground: ${hexToHslCss(palette.secondaryForeground)};
  `;
  
  styleEl.textContent = `
    :root {
      ${generateCssVars(dualPalette.light)}
    }
    
    .dark {
      ${generateCssVars(dualPalette.dark)}
    }
  `;
}

/**
 * Supprime les styles de branding personnalisés
 */
export function removeDualModePaletteFromDocument(): void {
  const styleEl = document.getElementById('coach-branding-styles');
  if (styleEl) {
    styleEl.remove();
  }
}

/**
 * Réinitialise les variables CSS aux valeurs par défaut
 */
export function resetPaletteToDefault(): void {
  const root = document.documentElement;
  
  const cssVars = [
    '--primary', '--primary-foreground',
    '--secondary', '--secondary-foreground',
    '--accent', '--accent-foreground',
    '--ring',
    '--destructive', '--destructive-foreground',
    '--sidebar-primary', '--sidebar-primary-foreground',
    '--sidebar-ring', '--sidebar-accent', '--sidebar-accent-foreground'
  ];
  
  cssVars.forEach(varName => root.style.removeProperty(varName));
  
  // Supprimer aussi le style injecté pour dual mode
  removeDualModePaletteFromDocument();
}

// === Palettes prédéfinies ===

export interface PresetPalette {
  id: string;
  name: string;
  icon: string;
  primary: string;
  secondary: string;
  accent: string;
}

export const PRESET_PALETTES: PresetPalette[] = [
  {
    id: 'cocoricoach',
    name: 'CocoriCoach',
    icon: '🐓',
    primary: '#2563eb',
    secondary: '#f5f5f5',
    accent: '#dc2626',
  },
  {
    id: 'ocean',
    name: 'Océan',
    icon: '🌊',
    primary: '#0891b2',
    secondary: '#f0f9ff',
    accent: '#0ea5e9',
  },
  {
    id: 'forest',
    name: 'Forêt',
    icon: '🌲',
    primary: '#16a34a',
    secondary: '#f0fdf4',
    accent: '#15803d',
  },
  {
    id: 'sunset',
    name: 'Coucher de soleil',
    icon: '🌅',
    primary: '#ea580c',
    secondary: '#fff7ed',
    accent: '#c2410c',
  },
  {
    id: 'night',
    name: 'Nuit',
    icon: '🌙',
    primary: '#6366f1',
    secondary: '#f5f3ff',
    accent: '#8b5cf6',
  },
  {
    id: 'rose',
    name: 'Rose',
    icon: '🌸',
    primary: '#db2777',
    secondary: '#fdf2f8',
    accent: '#be185d',
  },
  {
    id: 'gold',
    name: 'Or',
    icon: '✨',
    primary: '#ca8a04',
    secondary: '#fefce8',
    accent: '#a16207',
  },
  {
    id: 'slate',
    name: 'Ardoise',
    icon: '🪨',
    primary: '#475569',
    secondary: '#f8fafc',
    accent: '#334155',
  },
];
