# Calendrier athlète — réalisation et vérifications

## Livré
- Calendrier placé en premier, sélecteur Calendrier / Planification explicite, vues Mois / Semaine et Aujourd’hui ; semaine débutant lundi.
- Cartes du jour compactes, présences et actions de séance accessibles sans déplier ; réalisation et provenance programmée/personnelle distinctes.
- Wellness synthétique, indicateurs consultables ; cycles conservés après les événements ; confirmations à venir regroupées sous la journée.
- Chargements, erreurs et nouvelle tentative visibles. Écritures de présence et délais existants conservés ; aucun changement de schéma, permission, calcul ni calendrier coach.
- Moteur mensuel existant réutilisé ; styles ciblés, surfaces opaques, sélection blanche en sombre, Wellness vert et présence/absence fonctionnelles conservées.

## Tests réellement exécutés
Compte staff connecté, consultation de données réelles uniquement ; aucune réponse ni séance enregistrée.

| Parcours / profil | Couverture |
| --- | --- |
| Manon CLEMENT — bowling | Clair/sombre à 320, 360, 390, 430, 768, 1280 px ; Mois précédent/suivant, Semaine suivante, Aujourd’hui, sélection du 17 octobre, aller-retour Planification conservant la date ; ouverture Voir la séance, Remplir les données, Récupération et Ajouter une séance |
| Axelle MAYONOVE — rugby | Clair/sombre à 320, 390, 768, 1280 px ; Mois/Semaine, ouverture création |
| Alexis — judo | Clair/sombre à 320, 390, 768, 1280 px ; Mois/Semaine, ouverture création |
| David — athlétisme | Clair/sombre à 320, 390, 768, 1280 px ; Mois/Semaine, ouverture création |

- Aucun débordement horizontal ni erreur JavaScript détecté dans ces parcours ; zéro bouton imbriqué dans le calendrier bowling.
- À 320 px, dernière action du résumé ouvert : bas à 763 px, navigation à 779 px, soit 16 px libres.
- Réponse réseau 500 simulée sur la lecture des séances : erreur affichée, Réessayer rétablit les cartes et leur action Voir la séance.
- Texte racine augmenté à 20 px à 320 px : aucun débordement horizontal ; réduction des animations activée dans le parcours complémentaire.
- Six tests de dates réussis : semaine lundi, changement d’année, année bissextile, changement d’heure, bornes multi-jours et fin invalide.
- Dernier signal de compilation consulté : build OK.

## Limites précises
- Pas de sauvegarde ni modification de présence en identité athlète, pas de contrôle de lecture coach après écriture : seul un compte staff de consultation a été utilisé, pour ne pas altérer les vraies réponses.
- Pas de téléphone physique, lecteur d’écran ou mesure exhaustive WCAG des formulaires et fenêtres propres aux sports.
- Les cases de date mesurent 44 px de haut mais environ 34 px de large à 320 px : elles satisfont le minimum 24 px de WCAG AA, pas un objectif renforcé de 44 × 44 px.
- Les marqueurs disposent de libellés accessibles et de formes distinctes pour compétition/cycle ; toutes les familles ne sont pas distinguées sans couleur dans la grille. La légende et la liste du jour complètent leur identification.
- Calendriers vérifiés sur quatre disciplines, pas toutes les catégories ; séances privées, formulaires et règles propres aux autres sports conservés mais non exercés exhaustivement.
- Les aperçus multi-sports comprennent des données en chargement ; cela ne constitue pas une vérification exhaustive de leur historique.
- Les notifications de disponibilité et écritures existantes sont inchangées, aucun push de test envoyé.

## Mission séparée
L’audit global des contrastes reste ouvert : inventaire complet des routes, formulaires, portails, graphiques et états RPE non couvert par cette refonte ciblée. Aucun audit exhaustif revendiqué.