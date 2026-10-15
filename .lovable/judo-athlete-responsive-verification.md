# Compétitions judo athlète — adaptation responsive

## Périmètre
- Présentation uniquement, activée par le mode athlète et le sport judo dans le dialogue existant.
- Noms, ordre et nombre des onglets, sous-sections, champs, actions, sauvegardes et calculs inchangés. Aucun changement de données, migration, permissions, export ou résultat.
- Pas de renommage mobile ni fusion des quatre boutons de sauvegarde : la consigne finale de conservation prévaut.
- Fenêtre plein écran sous 768 px, hauteur visualViewport avec repli 100dvh, safe areas, contenu défilant et actions dans le flux.
- Contrôles tactiles 44 px, onglets à libellés complets sur plusieurs lignes, classement 3×2, suppression de combat séparée du bouton de sélection, adversaire sur deux lignes, scores empilés, vidéo visible sur mobile.
- Dès 1024 px, aucun style responsive ajouté ne s'applique ; staff et autres sports n'activent pas le périmètre.

## Vérifications effectuées
- Composants réels montés dans un navigateur avec cache de données simulé ; aucune donnée athlète écrite et aucune notification envoyée.
- 320, 360, 375, 390, 430, 768, 1024 et 1280 px, clair/sombre ; les quatre onglets et les quatre sous-onglets de combat.
- 85 états mobile/tablette, rotation 667×375 incluse : aucun débordement horizontal ni recouvrement entre contrôles visibles, avec prise en compte des zones de défilement.
- 28 états ordinateur : aucun débordement ; le bouton de suppression inclus dans le bouton de combat reste à sa position historique, volontairement non modifiée.
- Ajout d'un deuxième combat, nom d'adversaire, victoire, Golden Score, immobilisation Yuko, observations avec espaces, navigation entre combats : nom conservé en mémoire.
- Panneau vidéo visible et URL saisissable ; confirmation de suppression ouverte et annulée.
- Enregistrer et continuer : erreur réseau simulée visible dans l'état de sauvegarde et notification d'erreur ; données en mémoire conservées.
- Captures examinées : score mobile clair/sombre, classement 3×2, vidéo, erreur et paysage. Aucune erreur JavaScript du test. Dernière compilation : OK.

## Limites explicites
- Consultation connectée tentée : lectures des catégories/compétitions judo n'ont pas abouti, donc aucun parcours authentifié réel validé.
- Sauvegarde réussie, réouverture après sauvegarde, classement persisté, suppression réellement sauvegardée et lecture staff non testés.
- Liste Mes compétitions adaptée mais non vérifiée avec données connectées.
- Clavier iOS/Android natif et encoches physiques non testés : comportement visualViewport implémenté, pas assimilé à un test téléphone réel.
- Saisie de scores détaillée, limites numériques et calculs non modifiés ; aucune nouvelle règle métier introduite.