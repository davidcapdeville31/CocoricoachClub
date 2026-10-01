# Simplifier le bilan des combats de judo

## Objectif
Transformer la saisie des statistiques de combat en bilan post-combat, sans chronomètre ni suivi en direct, tout en conservant la lecture des anciennes données.

## Modifications prévues
- Supprimer du formulaire le chronomètre, la timeline, les durées de combat et de Golden Score, ainsi que les automatismes liés au suivi en direct.
- Regrouper la phase, l’adversaire et un choix explicite **Victoire / Défaite** dans l’en-tête du bilan.
- Renommer **Scores IJF** en **Score** et intégrer les compteurs de shido dans les colonnes Athlète et Adversaire, sans bloc séparé.
- Remplacer le Ne-waza par :
  - **Immobilisation Athlète** et **Immobilisation Adversaire**, avec les choix Aucun score / Yuko / Waza-ari / Ippon ;
  - le seul compteur détaillé **Liaisons debout-sol effectuées**.
- Supprimer l’onglet Défense.
- Simplifier Tactique :
  - profil du combat limité à **Dominant / Équilibré / Dominé** ;
  - style adverse limité à **Actif / Passif / Contreur** ;
  - supprimer la répartition Ne-waza / debout.
- Simplifier Détails : retirer les techniques Ne-waza et remplacer le tableau technique debout par deux valeurs, **techniques tentées** et **techniques réussies**, avec pourcentage calculé automatiquement.
- Mettre à jour les bilans, détails historiques et exports judo afin qu’ils utilisent les nouvelles données et n’affichent plus les rubriques supprimées.

## Compatibilité des données
- Réutiliser les clés existantes lorsqu’elles correspondent encore au besoin.
- Ajouter seulement des clés numériques dans le champ de statistiques existant pour l’immobilisation simplifiée et le bilan debout.
- Les anciennes statistiques restent stockées et lisibles dans les anciens enregistrements, mais ne sont plus proposées dans le nouveau formulaire.

## Vérification
- Vérifier la saisie d’un combat gagné et perdu, les scores et shidos, les quatre résultats d’immobilisation, le calcul du taux de réussite debout et la persistance après réouverture.
- Contrôler l’affichage sur mobile et ordinateur, puis vérifier l’absence d’erreurs de compilation et d’exécution.
