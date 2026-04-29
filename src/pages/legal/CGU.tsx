import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CGU() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />Retour</Link>
        </Button>

        <h1 className="text-3xl font-bold mb-2">Conditions Générales d'Utilisation</h1>
        <p className="text-sm text-muted-foreground mb-8">Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}</p>

        <Card className="p-6 sm:p-8 space-y-6 prose prose-sm max-w-none">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Objet</h2>
            <p>
              Les présentes CGU régissent l'utilisation de l'application <strong>CocoriCoach Club</strong>,
              destinée aux clubs sportifs, à leur staff (entraîneurs, médical, administratif) et à leurs athlètes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Création de compte</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>L'inscription est nominative, gratuite ou payante selon le plan du club.</li>
              <li>Les athlètes mineurs doivent obtenir l'accord d'un titulaire de l'autorité parentale.</li>
              <li>L'utilisateur garantit l'exactitude des informations fournies.</li>
              <li>Les identifiants sont strictement personnels et confidentiels.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Utilisation acceptable</h2>
            <p>L'utilisateur s'engage à :</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Ne pas perturber le fonctionnement du service</li>
              <li>Ne pas tenter d'accéder à des comptes ou données qui ne lui appartiennent pas</li>
              <li>Respecter la confidentialité des données partagées par d'autres utilisateurs</li>
              <li>Ne pas utiliser le service à des fins illégales ou contraires aux bonnes mœurs</li>
              <li>Respecter le droit à l'image (photos d'athlètes, vidéos d'analyse)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Données et confidentialité</h2>
            <p>
              Le traitement des données personnelles est régi par notre
              <Link to="/politique-confidentialite" className="text-primary underline"> politique de confidentialité</Link>,
              qui fait partie intégrante des présentes CGU.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Avertissement médical</h2>
            <p>
              CocoriCoach Club est un outil d'aide à la décision. Les indicateurs de charge, de récupération,
              les alertes (EWMA, AWCR), les protocoles (commotion, retour au jeu) sont des aides automatisées et
              <strong> ne se substituent pas à un diagnostic ou avis médical professionnel</strong>.
              En cas de doute sur la santé d'un athlète, consultez un médecin du sport.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Propriété intellectuelle</h2>
            <p>
              L'application reste la propriété exclusive de l'éditeur. Les données saisies par les utilisateurs
              demeurent la propriété de l'utilisateur ou du club concerné.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Suspension et résiliation</h2>
            <p>
              L'éditeur se réserve le droit de suspendre tout compte en cas de manquement aux présentes CGU.
              L'utilisateur peut à tout moment supprimer son compte depuis ses paramètres
              (suppression effective sous 30 jours, annulable).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Limitation de responsabilité</h2>
            <p>
              L'éditeur fournit le service "en l'état" et ne garantit pas l'absence d'interruptions ou d'erreurs.
              La responsabilité de l'éditeur est limitée aux dommages directs et exclut tout dommage indirect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Modifications</h2>
            <p>
              Les CGU peuvent être modifiées. Toute modification substantielle est notifiée à l'utilisateur,
              qui doit accepter la nouvelle version pour continuer à utiliser le service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Droit applicable</h2>
            <p>Droit français. Tribunaux compétents : <em>[ville à compléter]</em>.</p>
          </section>
        </Card>
      </div>
    </div>
  );
}
