import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MentionsLegales() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />Retour</Link>
        </Button>

        <h1 className="text-3xl font-bold mb-2">Mentions légales</h1>
        <p className="text-sm text-muted-foreground mb-8">Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}</p>

        <Card className="p-6 sm:p-8 space-y-6 prose prose-sm max-w-none">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Éditeur du site</h2>
            <p>
              Le site et l'application <strong>CocoriCoach Club</strong> sont édités par :
              <br />
              <em className="text-muted-foreground">[À COMPLÉTER : Nom de la société / Auto-entrepreneur, forme juridique, capital social, RCS, adresse complète, email de contact, téléphone]</em>
            </p>
            <p>Directeur de la publication : <em className="text-muted-foreground">[Nom du responsable]</em></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Hébergement</h2>
            <p>
              L'application est hébergée par :<br />
              <strong>Lovable Cloud</strong> (infrastructure Supabase / AWS — Union Européenne)<br />
              Site : <a href="https://lovable.dev" className="text-primary underline">lovable.dev</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Propriété intellectuelle</h2>
            <p>
              L'ensemble du contenu (textes, images, logos, charte graphique, code) est protégé par le droit d'auteur.
              Toute reproduction, même partielle, est interdite sans autorisation écrite préalable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Responsabilité</h2>
            <p>
              CocoriCoach Club fournit un outil d'aide à l'entraînement et au suivi sportif.
              Les recommandations affichées (charge d'entraînement, alertes santé, protocoles) sont des
              indicateurs d'aide à la décision et ne se substituent en aucun cas à un avis médical professionnel.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Contact</h2>
            <p>
              Pour toute question : <em className="text-muted-foreground">[contact@cocoricoach.com — à compléter]</em><br />
              Délégué à la Protection des Données (DPO) : <em className="text-muted-foreground">[dpo@cocoricoach.com — à compléter]</em>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Droit applicable</h2>
            <p>Les présentes mentions sont régies par le droit français. Tribunaux compétents : <em>[ville à compléter]</em>.</p>
          </section>
        </Card>
      </div>
    </div>
  );
}
