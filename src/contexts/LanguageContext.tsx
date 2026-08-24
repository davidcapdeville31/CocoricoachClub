import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useTranslation } from "react-i18next";
import i18n, { AppLanguage, LANGUAGE_STORAGE_KEY, getStoredLanguage } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const DEFAULT_STORAGE_KEY = "app-language-default";

interface LanguageContextType {
  language: AppLanguage;
  defaultLanguage: AppLanguage | null;
  setLanguage: (lang: AppLanguage) => void;
  saveAsDefault: () => Promise<boolean>;
  savingDefault: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState<AppLanguage>(getStoredLanguage);
  const [defaultLanguage, setDefaultLanguage] = useState<AppLanguage | null>(() => {
    const stored = localStorage.getItem(DEFAULT_STORAGE_KEY);
    return stored === "fr" || stored === "en" ? stored : null;
  });
  const [savingDefault, setSavingDefault] = useState(false);

  const applyLanguage = useCallback((lang: AppLanguage) => {
    setLanguageState(lang);
    i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  }, []);

  // Apply the stored language at mount (covers reloads and logouts)
  useEffect(() => {
    applyLanguage(getStoredLanguage());
  }, [applyLanguage]);

  // On login, the account-level default wins so the choice follows the user
  // across devices.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("language")
        .eq("id", user.id)
        .maybeSingle();
      const remote = (data as { language?: string } | null)?.language;
      if (cancelled || (remote !== "fr" && remote !== "en")) return;
      setDefaultLanguage(remote);
      localStorage.setItem(DEFAULT_STORAGE_KEY, remote);
      applyLanguage(remote);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, applyLanguage]);

  const saveAsDefault = useCallback(async () => {
    setSavingDefault(true);
    try {
      localStorage.setItem(DEFAULT_STORAGE_KEY, language);
      setDefaultLanguage(language);
      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({ language } as never)
          .eq("id", user.id);
        if (error) throw error;
      }
      return true;
    } catch (error) {
      console.error("Error saving default language:", error);
      return false;
    } finally {
      setSavingDefault(false);
    }
  }, [language, user]);

  return (
    <LanguageContext.Provider
      value={{ language, defaultLanguage, setLanguage: applyLanguage, saveAsDefault, savingDefault }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within a LanguageProvider");
  return context;
}

export { useTranslation };
