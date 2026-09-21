# Comparaison 360° des athlètes

Aujourd'hui les comparaisons sont éclatées : tests physiques dans Performance → Comparaison & Évolution, présence dans Admin → Présence, charge dans Performance → Charge d'entraînement, blessures dans Santé. Il n'existe aucun endroit où l'on croise tout pour les mêmes athlètes.

## Ce qu'on ajoute

Un nouvel onglet **Comparaison 360°** dans Performance (à côté de Charge, Disponibilité, Évolution Tests / Muscu).

En haut, un sélecteur d'athlètes identique à celui déjà utilisé dans Comparaison & Évolution :
- barre de recherche nom / prénom (accents ignorés),
- cases à cocher, sélection multiple,
- filtre par groupe + mode « comparer des groupes entre eux »,
- sélecteur de période (7 jours / mois / 3 mois / saison / dates personnalisées).

En dessous, un tableau de synthèse : une ligne par athlète, une colonne par indicateur, avec code couleur (meilleur / moyen / à surveiller) et le meilleur de la sélection mis en avant.

Puis des blocs détaillés dépliables, chacun avec son graphique comparatif :

1. **Tests physiques** — dernier résultat, évolution depuis le premier, par test sélectionné.
2. **Assiduité dans l'app** — taux de réponse Wellness et RPE sur la période (données saisies / attendues).
3. **Présence aux entraînements** — taux global + séparation Musculation / Terrain (même calcul qu'Admin → Présence).
4. **Présence aux compétitions** — convocations vs présences confirmées.
5. **Charge d'entraînement** — charge moyenne hebdo, charge aiguë, chronique, ratio, avec la règle de reprise déjà en place (pas de zone si moins de 21 jours continus).
6. **Blessures** — nombre d'épisodes sur la période, jours d'indisponibilité, statut actuel, frise comparative.
7. **Courbe de poids** — une courbe par athlète sur la période, delta début → fin.

Exports **PDF** et **CSV** de l'ensemble de la comparaison affichée, comme dans les autres blocs.

## Points techniques

- Nouveau `src/components/analytics/Athlete360ComparisonPanel.tsx` + hooks de collecte dans `src/hooks/analytics/useAthlete360.ts`, branché dans `PerformanceTab.tsx` (nouvel onglet `comparison-360`).
- Réutilisation existante : sélecteur et logique tests de `TestsComparisonPanel`, règles de comptage de présence d'Admin → Présence (staff prioritaire sur `event_participants`, futures et `no_response` exclues), `assessLoadWindow` / EWMA-AWCR pour la charge, `collectWeightHistory` pour le poids, `injuries` pour l'historique.
- Exports via `generateCsv` / `downloadCsv` et `preparePdfWithSettings`, sur le modèle de `testsComparisonExport.ts`.
- Générique toutes disciplines : aucun bloc spécifique rugby ; les blocs sans données pour la discipline sont simplement masqués.
- Respect du filtre de saison actif et des permissions existantes (onglet masqué en mode lecture seule).
