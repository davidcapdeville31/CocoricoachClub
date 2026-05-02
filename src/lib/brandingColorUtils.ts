/**
 * Utilitaires de couleur pour le système de branding club
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
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
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

export function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

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

export function isWCAGCompliant(ratio: number, isLargeText = false): boolean {
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

export function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  return luminance > 0.179;
}

export function getContrastTextColor(backgroundColor: string): string {
  return isLightColor(backgroundColor) ? '#1a1a1a' : '#ffffff';
}

export function hexToHslCss(hex: string): string {
  const hsl = hexToHsl(hex);
  return `${hsl.h} ${hsl.s}% ${hsl.l}%`;
}

export function lightenColor(hex: string, amount: number = 20): string {
  const hsl = hexToHsl(hex);
  return hslToHex(hsl.h, hsl.s, Math.min(100, hsl.l + amount));
}

export function darkenColor(hex: string, amount: number = 20): string {
  const hsl = hexToHsl(hex);
  return hslToHex(hsl.h, hsl.s, Math.max(0, hsl.l - amount));
}

export function getComplementaryColor(hex: string): string {
  const hsl = hexToHsl(hex);
  return hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l);
}

// === Extraction depuis image ===

export interface ExtractedColors {
  primary: string;
  secondary: string;
  accent: string;
  dominantColors: string[];
}

export async function extractColorsFromImage(imageDataUrl: string): Promise<ExtractedColors> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(getDefaultColors());

        const maxSize = 80;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.max(1, Math.floor(img.width * scale));
        canvas.height = Math.max(1, Math.floor(img.height * scale));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        const colorBuckets: Map<string, { r: number; g: number; b: number; count: number; saturation: number }> = new Map();

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];
          if (a < 128) continue;
          const hsl = rgbToHsl(r, g, b);
          if (hsl.l < 10 || hsl.l > 90) continue;
          if (hsl.s < 15 && hsl.l > 20 && hsl.l < 80) continue;
          const qr = Math.round(r / 16) * 16;
          const qg = Math.round(g / 16) * 16;
          const qb = Math.round(b / 16) * 16;
          const key = `${qr},${qg},${qb}`;
          const existing = colorBuckets.get(key);
          if (existing) existing.count++;
          else colorBuckets.set(key, { r: qr, g: qg, b: qb, count: 1, saturation: hsl.s });
        }

        const sortedColors = Array.from(colorBuckets.values())
          .filter(c => c.count > 2)
          .sort((a, b) => (b.count * (1 + b.saturation / 100)) - (a.count * (1 + a.saturation / 100)));

        if (sortedColors.length === 0) return resolve(getDefaultColors());

        const hexColors = sortedColors.slice(0, 10).map(c => rgbToHex(c.r, c.g, c.b));
        const primary = hexColors[0];

        let accent = hexColors[1] || getComplementaryColor(primary);
        for (const color of hexColors.slice(1)) {
          const diff = getColorDifference(primary, color);
          if (diff > 100) { accent = color; break; }
        }

        let secondary = hexColors.find(c => {
          const hsl = hexToHsl(c);
          return hsl.l > 50 && hsl.l < 85;
        }) || lightenColor(primary, 40);

        const secondaryHsl = hexToHsl(secondary);
        if (secondaryHsl.l < 85) {
          secondary = hslToHex(secondaryHsl.h, Math.min(secondaryHsl.s, 20), 95);
        }

        resolve({ primary, secondary, accent, dominantColors: hexColors });
      } catch (error) {
        console.error('Color extraction error:', error);
        resolve(getDefaultColors());
      }
    };

    img.onerror = () => resolve(getDefaultColors());
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

// === Palette ===

export interface BrandingPalette {
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  card: string;
  cardForeground: string;
  border: string;
  destructive: string;
  destructiveForeground: string;
}

export interface DualModePalette {
  light: BrandingPalette;
  dark: BrandingPalette;
}

export function generateBrandingPalette(primary: string, secondary: string, accent: string): BrandingPalette {
  const primaryFg = getContrastTextColor(primary);
  const accentFg = getContrastTextColor(accent);

  let secondaryNormalized = secondary;
  const secHsl = hexToHsl(secondary);
  if (secHsl.l < 85) {
    secondaryNormalized = hslToHex(secHsl.h, Math.min(secHsl.s, 15), 96);
  }
  const secondaryFg = getContrastTextColor(secondaryNormalized);

  const accentHsl = hexToHsl(accent);
  const isAccentReddish = (accentHsl.h >= 0 && accentHsl.h <= 30) || accentHsl.h >= 330;
  const destructive = isAccentReddish ? accent : '#dc2626';

  return {
    primary,
    primaryForeground: primaryFg,
    secondary: secondaryNormalized,
    secondaryForeground: secondaryFg,
    accent,
    accentForeground: accentFg,
    background: '#ffffff',
    foreground: '#0a0a0a',
    muted: '#f5f5f5',
    mutedForeground: '#737373',
    card: '#ffffff',
    cardForeground: '#0a0a0a',
    border: '#e5e5e5',
    destructive,
    destructiveForeground: getContrastTextColor(destructive),
  };
}

export function generateDarkPalette(primary: string, secondary: string, accent: string): BrandingPalette {
  const primaryHsl = hexToHsl(primary);
  const accentHsl = hexToHsl(accent);

  // Brighten primary/accent for dark mode contrast
  const darkPrimary = hslToHex(primaryHsl.h, Math.min(primaryHsl.s, 75), Math.max(58, Math.min(70, primaryHsl.l + 18)));
  const darkAccent = hslToHex(accentHsl.h, Math.min(accentHsl.s, 80), Math.max(58, Math.min(70, accentHsl.l + 12)));
  const secHsl = hexToHsl(secondary);
  const darkSecondary = hslToHex(secHsl.h, Math.min(secHsl.s, 18), 18);

  const isAccentReddish = (accentHsl.h >= 0 && accentHsl.h <= 30) || accentHsl.h >= 330;
  const destructive = isAccentReddish ? darkAccent : '#ef4444';

  return {
    primary: darkPrimary,
    primaryForeground: getContrastTextColor(darkPrimary),
    secondary: darkSecondary,
    secondaryForeground: getContrastTextColor(darkSecondary),
    accent: darkAccent,
    accentForeground: getContrastTextColor(darkAccent),
    // Aligned with Design System V2 dark surfaces (bg #0E1117 < surface #161A22 < elevated)
    background: '#0e1117',
    foreground: '#f1f5f9',
    muted: '#1e232e',
    mutedForeground: '#94a3b8',
    card: '#161a22',
    cardForeground: '#f1f5f9',
    border: '#2a3344',
    destructive,
    destructiveForeground: getContrastTextColor(destructive),
  };
}

export function generateDualModePalette(primary: string, secondary: string, accent: string): DualModePalette {
  return {
    light: generateBrandingPalette(primary, secondary, accent),
    dark: generateDarkPalette(primary, secondary, accent),
  };
}

export function applyDualModePaletteToDocument(dualPalette: DualModePalette): void {
  const styleId = 'club-branding-styles';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  const generateCssVars = (palette: BrandingPalette, isDark: boolean) => {
    const primaryHsl = hexToHsl(palette.primary);
    const accentHsl = hexToHsl(palette.accent);

    // Variations brand (primitives) — pour que tous les composants qui utilisent --brand-* suivent
    const brand500 = `${primaryHsl.h} ${primaryHsl.s}% ${primaryHsl.l}%`;
    const brand600 = `${primaryHsl.h} ${primaryHsl.s}% ${Math.max(10, primaryHsl.l - 8)}%`;
    const brand700 = `${primaryHsl.h} ${primaryHsl.s}% ${Math.max(8, primaryHsl.l - 16)}%`;
    const brand400 = `${primaryHsl.h} ${primaryHsl.s}% ${Math.min(90, primaryHsl.l + 8)}%`;
    const brand300 = `${primaryHsl.h} ${primaryHsl.s}% ${Math.min(94, primaryHsl.l + 16)}%`;
    const brand100 = `${primaryHsl.h} ${Math.min(70, primaryHsl.s)}% ${isDark ? 22 : 92}%`;
    const brand50  = `${primaryHsl.h} ${Math.min(70, primaryHsl.s)}% ${isDark ? 14 : 97}%`;

    const accent500 = `${accentHsl.h} ${accentHsl.s}% ${accentHsl.l}%`;
    const accent600 = `${accentHsl.h} ${accentHsl.s}% ${Math.max(10, accentHsl.l - 8)}%`;

    // Hover dynamique pour primary
    const primaryHoverL = isDark ? Math.min(85, primaryHsl.l + 8) : Math.max(10, primaryHsl.l - 8);
    const primaryHover = `${primaryHsl.h} ${primaryHsl.s}% ${primaryHoverL}%`;
    const accentHoverL = isDark ? Math.min(85, accentHsl.l + 8) : Math.max(10, accentHsl.l - 8);
    const accentHover = `${accentHsl.h} ${accentHsl.s}% ${accentHoverL}%`;

    // Surfaces — en dark on teinte légèrement avec la couleur primaire
    const surfaces = isDark
      ? `
      --background: ${hexToHslCss(palette.background)};
      --foreground: ${hexToHslCss(palette.foreground)};
      --card: ${hexToHslCss(palette.card)};
      --card-foreground: ${hexToHslCss(palette.cardForeground)};
      --popover: ${hexToHslCss(palette.card)};
      --popover-foreground: ${hexToHslCss(palette.cardForeground)};
      --surface: ${hexToHslCss(palette.card)};
      --surface-foreground: ${hexToHslCss(palette.cardForeground)};
      --surface-elevated: ${primaryHsl.h} 18% 16%;
      --surface-elevated-foreground: ${hexToHslCss(palette.cardForeground)};
      --surface-sunken: ${primaryHsl.h} 22% 7%;
      --muted: ${hexToHslCss(palette.muted)};
      --muted-foreground: ${hexToHslCss(palette.mutedForeground)};
      --border: ${primaryHsl.h} 18% 22%;
      --border-strong: ${primaryHsl.h} 18% 32%;
      --input: ${primaryHsl.h} 18% 18%;
      --sidebar-background: ${primaryHsl.h} 28% 8%;
      --sidebar-foreground: 220 16% 92%;
      --sidebar-border: ${primaryHsl.h} 22% 16%;
      `
      : `
      --background: ${primaryHsl.h} 32% 96%;
      --foreground: ${hexToHslCss(palette.foreground)};
      --card: ${hexToHslCss(palette.card)};
      --card-foreground: ${hexToHslCss(palette.cardForeground)};
      --popover: ${hexToHslCss(palette.card)};
      --popover-foreground: ${hexToHslCss(palette.cardForeground)};
      --surface: 0 0% 100%;
      --surface-foreground: ${hexToHslCss(palette.foreground)};
      --surface-elevated: ${primaryHsl.h} 40% 99%;
      --surface-elevated-foreground: ${hexToHslCss(palette.foreground)};
      --surface-sunken: ${primaryHsl.h} 26% 92%;
      --muted: ${primaryHsl.h} 22% 95%;
      --muted-foreground: ${hexToHslCss(palette.mutedForeground)};
      --border: ${primaryHsl.h} 20% 86%;
      --border-strong: ${primaryHsl.h} 18% 72%;
      --input: ${primaryHsl.h} 20% 88%;
      --sidebar-background: ${primaryHsl.h} 30% 12%;
      --sidebar-foreground: 220 18% 92%;
      --sidebar-border: ${primaryHsl.h} 22% 20%;
      `;

    return `
      ${surfaces}
      --primary: ${hexToHslCss(palette.primary)};
      --primary-foreground: ${hexToHslCss(palette.primaryForeground)};
      --primary-hover: ${primaryHover};
      --secondary: ${hexToHslCss(palette.secondary)};
      --secondary-foreground: ${hexToHslCss(palette.secondaryForeground)};
      --secondary-hover: ${hexToHslCss(palette.secondary)};
      --accent: ${hexToHslCss(palette.accent)};
      --accent-foreground: ${hexToHslCss(palette.accentForeground)};
      --accent-hover: ${accentHover};
      --ring: ${hexToHslCss(palette.primary)};
      --destructive: ${hexToHslCss(palette.destructive)};
      --destructive-foreground: ${hexToHslCss(palette.destructiveForeground)};

      /* Brand primitives (utilisées par variantes premium, gradients, etc.) */
      --brand-50:  ${brand50};
      --brand-100: ${brand100};
      --brand-300: ${brand300};
      --brand-400: ${brand400};
      --brand-500: ${brand500};
      --brand-600: ${brand600};
      --brand-700: ${brand700};
      --accent-50:  ${accentHsl.h} ${Math.min(70, accentHsl.s)}% ${isDark ? 14 : 95}%;
      --accent-500: ${accent500};
      --accent-600: ${accent600};

      /* Sidebar — couleurs club */
      --sidebar-primary: ${hexToHslCss(palette.primary)};
      --sidebar-primary-foreground: ${hexToHslCss(palette.primaryForeground)};
      --sidebar-ring: ${hexToHslCss(palette.primary)};
      --sidebar-accent: ${primaryHsl.h} ${isDark ? 22 : 25}% ${isDark ? 16 : 90}%;
      --sidebar-accent-foreground: ${hexToHslCss(isDark ? palette.cardForeground : palette.foreground)};

      /* Charts — primaire + accent + dérivés */
      --chart-1: ${hexToHslCss(palette.primary)};
      --chart-2: ${hexToHslCss(palette.accent)};
      --chart-3: ${primaryHsl.h} ${primaryHsl.s}% ${Math.min(80, primaryHsl.l + 18)}%;
      --chart-4: ${accentHsl.h} ${accentHsl.s}% ${Math.min(80, accentHsl.l + 15)}%;

      /* Gradients — utilisent la couleur club */
      --gradient-hero: linear-gradient(135deg, hsl(${brand700}) 0%, hsl(${brand500}) 50%, hsl(${accent500}) 100%);
      --gradient-performance: linear-gradient(135deg, hsl(${accent500}), hsl(${brand500}));
      --gradient-mesh: radial-gradient(at 15% 0%, hsl(${brand500} / ${isDark ? '0.06' : '0.04'}) 0px, transparent 45%),
                       radial-gradient(at 85% 100%, hsl(${accent500} / ${isDark ? '0.05' : '0.035'}) 0px, transparent 45%);

      /* Shadow glow club */
      --shadow-glow: 0 0 0 1px hsl(${brand500} / ${isDark ? '0.3' : '0.18'}), 0 6px 16px -6px hsl(${brand500} / ${isDark ? '0.4' : '0.25'});
      --shadow-glow-accent: 0 0 0 1px hsl(${accent500} / ${isDark ? '0.3' : '0.18'}), 0 6px 16px -6px hsl(${accent500} / ${isDark ? '0.4' : '0.25'});
    `;
  };

  styleEl.textContent = `
    :root { ${generateCssVars(dualPalette.light, false)} }
    .dark { ${generateCssVars(dualPalette.dark, true)} }
  `;
}

export function removeDualModePaletteFromDocument(): void {
  const styleEl = document.getElementById('club-branding-styles');
  if (styleEl) styleEl.remove();
}

export function resetPaletteToDefault(): void {
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
  { id: 'cocoricoach', name: 'CocoriCoach', icon: '🐓', primary: '#2563eb', secondary: '#f5f5f5', accent: '#dc2626' },
  { id: 'ocean', name: 'Océan', icon: '🌊', primary: '#0891b2', secondary: '#f0f9ff', accent: '#0ea5e9' },
  { id: 'forest', name: 'Forêt', icon: '🌲', primary: '#16a34a', secondary: '#f0fdf4', accent: '#15803d' },
  { id: 'sunset', name: 'Coucher', icon: '🌅', primary: '#ea580c', secondary: '#fff7ed', accent: '#c2410c' },
  { id: 'night', name: 'Nuit', icon: '🌙', primary: '#6366f1', secondary: '#f5f3ff', accent: '#8b5cf6' },
  { id: 'rose', name: 'Rose', icon: '🌸', primary: '#db2777', secondary: '#fdf2f8', accent: '#be185d' },
  { id: 'gold', name: 'Or', icon: '✨', primary: '#ca8a04', secondary: '#fefce8', accent: '#a16207' },
  { id: 'slate', name: 'Ardoise', icon: '🪨', primary: '#475569', secondary: '#f8fafc', accent: '#334155' },
];
