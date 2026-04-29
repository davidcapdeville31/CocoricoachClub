import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Cookie, X } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "cocoricoach_cookie_consent";

interface ConsentChoices {
  essential: boolean; // always true
  notifications: boolean;
  preferences: boolean;
  timestamp: string;
}

export function CookieConsentBanner() {
  const [open, setOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [notif, setNotif] = useState(true);
  const [prefs, setPrefs] = useState(true);

  useEffect(() => {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (!existing) setOpen(true);
  }, []);

  const recordConsent = async (choices: ConsentChoices) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
    setOpen(false);
    // Persist server-side if logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await Promise.all([
        supabase.rpc("record_user_consent", {
          _consent_type: "cookies_essential", _granted: true, _document_version: "1.0",
        }),
        supabase.rpc("record_user_consent", {
          _consent_type: "cookies_notifications", _granted: choices.notifications, _document_version: "1.0",
        }),
        supabase.rpc("record_user_consent", {
          _consent_type: "cookies_preferences", _granted: choices.preferences, _document_version: "1.0",
        }),
      ]);
    }
  };

  const acceptAll = () => recordConsent({
    essential: true, notifications: true, preferences: true, timestamp: new Date().toISOString(),
  });

  const rejectAll = () => recordConsent({
    essential: true, notifications: false, preferences: false, timestamp: new Date().toISOString(),
  });

  const acceptCustom = () => recordConsent({
    essential: true, notifications: notif, preferences: prefs, timestamp: new Date().toISOString(),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-4 sm:p-6 bg-background/95 backdrop-blur-md border-t shadow-2xl">
      <Card className="max-w-4xl mx-auto p-5 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <Cookie className="h-6 w-6 text-primary shrink-0 mt-1" />
          <div className="flex-1">
            <h2 className="font-semibold text-lg mb-1">🍪 Vos préférences de confidentialité</h2>
            <p className="text-sm text-muted-foreground">
              Nous utilisons uniquement des cookies nécessaires au fonctionnement et à la sécurité du service.
              Aucun cookie publicitaire ni de tracking marketing.{" "}
              <Link to="/politique-cookies" className="text-primary underline">En savoir plus</Link>
            </p>
          </div>
        </div>

        {showDetails && (
          <div className="space-y-3 mb-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">🔒 Essentiels</p>
                <p className="text-xs text-muted-foreground">Authentification, sécurité — toujours actifs</p>
              </div>
              <Switch checked disabled />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">🔔 Notifications push</p>
                <p className="text-xs text-muted-foreground">Rappels d'entraînement, alertes santé</p>
              </div>
              <Switch checked={notif} onCheckedChange={setNotif} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">⚙️ Préférences</p>
                <p className="text-xs text-muted-foreground">Thème, filtres, mémorisation interface</p>
              </div>
              <Switch checked={prefs} onCheckedChange={setPrefs} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={() => setShowDetails((v) => !v)}>
            {showDetails ? "Masquer" : "Personnaliser"}
          </Button>
          <Button variant="outline" size="sm" onClick={rejectAll}>Tout refuser</Button>
          {showDetails && <Button variant="secondary" size="sm" onClick={acceptCustom}>Valider mes choix</Button>}
          <Button size="sm" onClick={acceptAll}>Tout accepter</Button>
        </div>
      </Card>
    </div>
  );
}

export function getCookieConsent(): ConsentChoices | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function hasNotificationConsent(): boolean {
  return getCookieConsent()?.notifications === true;
}
