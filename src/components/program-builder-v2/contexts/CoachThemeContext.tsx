// V2 namespace - minimal stub for CoachThemeContext.
// The Remix version fetches custom branding from a `coach_branding` table that
// does not exist in this project. We expose the same API surface (`useCoachTheme`)
// returning safe defaults so copied components compile and render.

import React, { createContext, useContext } from 'react';

export interface CoachBranding {
  id: string;
  coach_id: string;
  logo_url: string | null;
  logo_crop: { scale: number; positionX: number; positionY: number } | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  is_custom: boolean;
}

interface CoachThemeContextType {
  branding: CoachBranding | null;
  loading: boolean;
  isCustomTheme: boolean;
  refreshBranding: () => Promise<void>;
  applyTheme: (branding: Partial<CoachBranding>) => void;
  resetToDefault: () => void;
}

const DEFAULT_VALUE: CoachThemeContextType = {
  branding: null,
  loading: false,
  isCustomTheme: false,
  refreshBranding: async () => {},
  applyTheme: () => {},
  resetToDefault: () => {},
};

const CoachThemeContext = createContext<CoachThemeContextType>(DEFAULT_VALUE);

export function CoachThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <CoachThemeContext.Provider value={DEFAULT_VALUE}>
      {children}
    </CoachThemeContext.Provider>
  );
}

export function useCoachTheme() {
  // Always returns defaults — never throws — so V2 components work outside a provider.
  return useContext(CoachThemeContext);
}
