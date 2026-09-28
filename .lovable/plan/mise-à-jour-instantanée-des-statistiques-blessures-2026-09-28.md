# Mise à jour instantanée des statistiques blessures

## Objectif
Faire apparaître immédiatement toute blessure ajoutée, modifiée ou supprimée dans les compteurs et statistiques, sans rechargement.

## Changements
- Remplacer les simples invalidations différées par un rafraîchissement actif des données après chaque action sur une blessure.
- Renforcer la synchronisation en temps réel pour relancer directement les statistiques lorsqu’un changement vient d’un autre écran ou utilisateur.
- Harmoniser les différents écrans de santé afin qu’ils actualisent tous les mêmes données statistiques.
- Vérifier le cas réel de la troisième blessure, actuellement bien enregistrée et comprise dans la saison active.

## Détails techniques
- Centraliser les clés de cache concernées : liste des blessures, statistiques blessures et vues santé associées.
- Attendre la fin du rafraîchissement avant de fermer la fenêtre d’ajout lorsque cela garantit l’affichage immédiat.
- Conserver le filtre par saison et par effectif actif existant.
