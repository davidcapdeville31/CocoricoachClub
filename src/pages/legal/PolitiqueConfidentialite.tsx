import { getLocaleTag } from "@/lib/i18n/dateLocale";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PolitiqueConfidentialite() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />Retour</Link>
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Politique de confidentialité</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">Conforme RGPD — Dernière mise à jour : {new Date().toLocaleDateString(getLocaleTag())}</p>

        <Card className="p-6 sm:p-8 space-y-6 prose prose-sm max-w-none">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Responsable du traitement</h2>
            <p>
              <strong>CocoriCoach Club</strong> — <em className="text-muted-foreground">[adresse complète à compléter]</em><br />
              Contact RGPD / DPO : <em className="text-muted-foreground">[dpo@cocoricoach.com — à compléter]</em>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Données collectées</h2>
            <p>Nous collectons et traitons les catégories de données suivantes :</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Identification</strong> : nom, prénom, email, téléphone, photo de profil</li>
              <li><strong>Données sportives</strong> : performances, statistiques de match, charges d'entraînement (RPE), assiduité</li>
              <li><strong>Données de santé (sensibles)</strong> : wellness (sommeil, fatigue, stress, courbatures), blessures, protocoles de retour au jeu, données de récupération, HRV, données menstruelles (uniquement si renseignées)</li>
              <li><strong>Données scolaires</strong> (académies) : notes, absences, suivi scolaire</li>
              <li><strong>Données techniques</strong> : adresse IP, type d'appareil, logs d'utilisation, identifiants OneSignal pour les notifications push</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Bases légales (art. 6 et 9 RGPD)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Consentement explicite</strong> (art. 9-2-a) pour les données de santé</li>
              <li><strong>Exécution d'un contrat</strong> (art. 6-1-b) pour le service de coaching</li>
              <li><strong>Intérêt légitime</strong> (art. 6-1-f) pour la sécurité, l'amélioration du service, les statistiques anonymisées</li>
              <li><strong>Obligation légale</strong> (art. 6-1-c) pour la conservation des justificatifs</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Cas particulier des mineurs</h2>
            <p>
              Pour les athlètes mineurs (moins de 15 ans en France — art. 8 RGPD), le consentement est donné
              <strong> conjointement par le titulaire de l'autorité parentale</strong>. Les données de santé d'un mineur
              ne peuvent être traitées qu'avec ce consentement explicite.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Destinataires</h2>
            <p>Vos données sont accessibles uniquement à :</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>L'athlète lui-même (toutes ses données)</li>
              <li>Le staff médical du club (données de santé) — sous secret professionnel</li>
              <li>Le staff sportif du club (données de performance, présence, charge)</li>
              <li>L'administration du club (données administratives, scolaires)</li>
              <li>Lovable Cloud (sous-traitant hébergeur, UE)</li>
              <li>OneSignal (envoi de notifications push, anonymisation possible)</li>
            </ul>
            <p>Aucune donnée n'est cédée, vendue, ou louée à des tiers commerciaux.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Durée de conservation</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Données du compte : pendant toute la durée d'utilisation du service</li>
              <li>Données de santé : durée du suivi sportif + 5 ans après la fin du suivi (à des fins probatoires médicales)</li>
              <li>Données de connexion (logs) : 1 an</li>
              <li>Données anonymisées (statistiques) : sans limite</li>
              <li>Après suppression du compte : suppression complète sous 30 jours, sauf obligation légale de conservation</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Vos droits (art. 12 à 22 RGPD)</h2>
            <p>Vous disposez à tout moment des droits suivants :</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Droit d'accès</strong> : consulter vos données depuis votre espace personnel</li>
              <li><strong>Droit de rectification</strong> : corriger vos données depuis votre profil</li>
              <li><strong>Droit à la portabilité</strong> : télécharger vos données au format JSON depuis Paramètres &rarr; Confidentialité</li>
              <li><strong>Droit à l'effacement</strong> : supprimer votre compte (effectif sous 30 jours, annulable)</li>
              <li><strong>Droit d'opposition / retrait du consentement</strong> : à tout moment depuis vos paramètres</li>
              <li><strong>Droit à la limitation du traitement</strong></li>
              <li><strong>Droit d'introduire une réclamation auprès de la CNIL</strong> : <a href="https://www.cnil.fr" className="text-primary underline">www.cnil.fr</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Sécurité</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Chiffrement TLS de toutes les communications</li>
              <li>Cloisonnement strict des données par club via Row-Level Security</li>
              <li>Vue masquée pour les données sensibles (téléphones, adresses)</li>
              <li>Authentification renforcée (mot de passe + vérification HIBP)</li>
              <li>Journalisation de tous les accès aux données sensibles</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Transferts hors UE</h2>
            <p>Aucun transfert de données personnelles hors Union Européenne n'est effectué.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Cookies</h2>
            <p>Voir notre <Link to="/politique-cookies" className="text-primary underline">politique de cookies</Link>.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Modifications</h2>
            <p>
              Toute modification substantielle de cette politique fait l'objet d'une notification et,
              le cas échéant, d'une nouvelle demande de consentement.
            </p>
          </section>
        </Card>
      </div>
    </div>
  );
}
