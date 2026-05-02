import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  generateDualModePalette,
  applyDualModePaletteToDocument,
  resetPaletteToDefault,
} from '@/lib/brandingColorUtils';

export interface LogoCrop {
  scale: number;
  positionX: number;
  positionY: number;
}

export interface ClubBranding {
  id?: string;
  club_id: string;
  logo_url: string | null;
  logo_crop: LogoCrop | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  is_custom: boolean;
}

interface ClubBrandingContextType {
  branding: ClubBranding | null;
  loading: boolean;
  refreshBranding: () => Promise<void>;
  applyTheme: (b: Partial<ClubBranding>) => void;
  resetToDefault: () => void;
}

const DEFAULT_COLORS = { primary: '#2563eb', secondary: '#f5f5f5', accent: '#dc2626' };

const ClubBrandingContext = createContext<ClubBrandingContextType | undefined>(undefined);

interface ProviderProps {
  children: ReactNode;
  clubId?: string | null;
}

export function ClubBrandingProvider({ children, clubId }: ProviderProps) {
  const [branding, setBranding] = useState<ClubBranding | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBranding = useCallback(async () => {
    if (!clubId) {
      resetPaletteToDefault();
      setBranding(null);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('club_branding')
        .select('*')
        .eq('club_id', clubId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching branding:', error);
        resetPaletteToDefault();
        setLoading(false);
        return;
      }

      if (data && data.is_custom) {
        let logoCrop: LogoCrop | null = null;
        if (data.logo_crop && typeof data.logo_crop === 'object') {
          const cd = data.logo_crop as Record<string, unknown>;
          logoCrop = {
            scale: (cd.scale as number) || 1,
            positionX: (cd.positionX as number) || 0,
            positionY: (cd.positionY as number) || 0,
          };
        }
        const b: ClubBranding = {
          id: data.id,
          club_id: data.club_id,
          logo_url: data.logo_url,
          logo_crop: logoCrop,
          primary_color: data.primary_color || DEFAULT_COLORS.primary,
          secondary_color: data.secondary_color || DEFAULT_COLORS.secondary,
          accent_color: data.accent_color || DEFAULT_COLORS.accent,
          is_custom: data.is_custom,
        };
        setBranding(b);
        const palette = generateDualModePalette(b.primary_color, b.secondary_color, b.accent_color);
        applyDualModePaletteToDocument(palette);
      } else {
        resetPaletteToDefault();
        setBranding(null);
      }
    } catch (err) {
      console.error('fetchBranding error:', err);
      resetPaletteToDefault();
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  const refreshBranding = useCallback(async () => { await fetchBranding(); }, [fetchBranding]);

  const applyTheme = useCallback((newBranding: Partial<ClubBranding>) => {
    const primary = newBranding.primary_color || branding?.primary_color || DEFAULT_COLORS.primary;
    const secondary = newBranding.secondary_color || branding?.secondary_color || DEFAULT_COLORS.secondary;
    const accent = newBranding.accent_color || branding?.accent_color || DEFAULT_COLORS.accent;
    const palette = generateDualModePalette(primary, secondary, accent);
    applyDualModePaletteToDocument(palette);
  }, [branding]);

  const resetToDefault = useCallback(() => {
    resetPaletteToDefault();
    setBranding(null);
  }, []);

  useEffect(() => {
    fetchBranding();
    return () => { resetPaletteToDefault(); };
  }, [fetchBranding]);

  return (
    <ClubBrandingContext.Provider value={{ branding, loading, refreshBranding, applyTheme, resetToDefault }}>
      {children}
    </ClubBrandingContext.Provider>
  );
}

export function useClubBranding() {
  const ctx = useContext(ClubBrandingContext);
  if (!ctx) throw new Error('useClubBranding must be used within ClubBrandingProvider');
  return ctx;
}
