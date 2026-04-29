import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowLeft, Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PolitiqueCookies() {
  const openConsentBanner = () => {
    localStorage.removeItem("cocoricoach_cookie_consent");
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />Retour</Link>
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <Cookie className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Politique de cookies</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}</p>

        <Card className="p-6 sm:p-8 space-y-6 prose prose-sm max-w-none">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Qu'est-ce qu'un cookie ?</h2>
            <p>
              Un cookie est un petit fichier texte stocké sur votre appareil qui permet à l'application
              de mémoriser certaines informations (préférences, session de connexion, etc.).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Cookies utilisés</h2>

            <div className="space-y-4">
              <div className="border-l-4 border-primary pl-4">
                <h3 className="font-semibold">🔒 Cookies essentiels (toujours actifs)</h3>
                <ul className="list-disc pl-6 text-sm">
                  <li><code>sb-*</code> — session d'authentification (Supabase / Lovable Cloud)</li>
                  <li><code>cocoricoach_cookie_consent</code> — mémorisation de votre choix de consentement</li>
                </ul>
                <p className="text-sm mt-2">Indispensables au fonctionnement du service. Pas de consentement requis (CNIL).</p>
              </div>

              <div className="border-l-4 border-amber-500 pl-4">
                <h3 className="font-semibold">🔔 Cookies de notifications (consentement requis)</h3>
                <ul className="list-disc pl-6 text-sm">
                  <li><code>OneSignal_*</code> — abonnement aux notifications push (rappels d'entraînement, alertes)</li>
                </ul>
                <p className="text-sm mt-2">Activés uniquement si vous acceptez les notifications dans votre profil.</p>
              </div>

              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold">⚙️ Cookies de préférences (consentement requis)</h3>
                <ul className="list-disc pl-6 text-sm">
                  <li>Mémorisation du thème (clair/sombre), de la langue, des filtres de tableau</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Pas de cookies publicitaires</h2>
            <p>
              <strong>CocoriCoach Club n'utilise aucun cookie publicitaire ni de tracking marketing.</strong>
              Pas de Google Analytics, pas de Facebook Pixel, pas de remarketing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Gérer votre consentement</h2>
            <p>Vous pouvez modifier vos préférences à tout moment :</p>
            <Button onClick={openConsentBanner} variant="outline" className="mt-2">
              Rouvrir le panneau de consentement
            </Button>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Durée de conservation</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Cookies de session : supprimés à la fermeture du navigateur</li>
              <li>Cookies persistants (consentement) : 13 mois maximum (recommandation CNIL)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Désactivation côté navigateur</h2>
            <p>
              Vous pouvez bloquer les cookies depuis les paramètres de votre navigateur,
              mais cela peut affecter le fonctionnement du service (impossibilité de se connecter notamment).
            </p>
          </section>
        </Card>
      </div>
    </div>
  );
}
