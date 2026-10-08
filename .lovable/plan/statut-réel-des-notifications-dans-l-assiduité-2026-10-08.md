# Statut réel des notifications dans l’assiduité

## Objectif
Dans **Admin → Rapports → Assiduité dans l’application**, afficher un statut actif uniquement lorsque le canal est réellement opérationnel pour l’athlète.

## Modifications
- Contrôler le push depuis l’abonnement actif réellement enregistré par le service de notifications, comme pour Axelle.
- Contrôler le mail uniquement si l’abonnement mail est lui aussi activé, et non simplement présent.
- Afficher des libellés sans ambiguïté : **Push actif / Push inactif** et **Mail actif / Mail inactif**.
- Ne pas afficher « inactif » pendant un chargement ou en cas d’échec du contrôle : afficher **Vérification…** ou **Statut indisponible**.
- Actualiser automatiquement les statuts pendant que le rapport reste ouvert et lors du retour sur la page.
- Conserver ces statuts réels dans les exports CSV et PDF, pour toutes les disciplines.

## Vérification
- Vérifier qu’Axelle apparaît en **Push actif**.
- Vérifier que les comptes sans appareil réellement abonné n’apparaissent jamais comme actifs.
- Contrôler l’affichage du tableau et l’absence d’erreur de compilation.
