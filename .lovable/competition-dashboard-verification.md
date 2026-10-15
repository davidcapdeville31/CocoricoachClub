# Tableau de participation — vérifications

- Réutilise convocations et compositions ; ajoute les personnes possédant des résultats individuels significatifs et des corrections effectives, sans doublons ni écriture dans les sources sportives.
- Participation manuelle conservée dans competition_results (trois colonnes nullable), RPC limitée aux propriétaires/admin/coach/administratif avec accès catégorie ; trigger protège la correction des écritures et suppressions directes par athlète. Aucun nouvel accès super-admin d’écriture.
- Résultats individuels significatifs : résultat, temps, classement de round ou statistiques enregistrées ; round vide n’est pas une preuve. Un classement final n’est pas à lui seul une preuve de présence. Résultats collectifs non utilisés pour déduire la présence individuelle.
- Bowling EDF U19 réel : 17 personnes, 146 parties ; 11 présences automatiques et 6 à vérifier, 17 convocations sans réponse. Aucune absence déduite des données manquantes.
- Test connecté réel : compétition temporaire passée avec une convocation confirmée ; correction Absent, rechargement, convocation intacte et absence conservée ; correction Présent réussie. Données d’essai supprimées. Aucun push envoyé pour cette compétition passée.
- Recherche Angevin : une ligne ; liste développée 17 lignes ; filtre Absents conserve les compteurs globaux.
- 12 tests / 23 assertions incluant trente personnes, priorité des corrections, compétition future, absence de doublons, RSVP indépendant et absence non déduite.
- Clair/sombre à 320, 390, 768 et 1280 px ; section sans débordement, lignes 44 px mobile et 41 px desktop. Captures consultées ; les notifications hors-ligne existantes superposent parfois la capture, elles ne sont pas modifiées par cette demande.
- Compilation automatique OK.

## Limites
- Judo/rugby : source partagée, mais tentative de navigation judo sans compétition visible dans la sélection courante ; vérification visuelle multisport non achevée.
- Pas trente participants réels, téléphone physique ni panne de sauvegarde simulée. Tri exposé mais pas exercé automatiquement dans le navigateur.
- Protection DELETE des corrections appliquée ; complément pour préserver explicitement suppression parent en cascade non appliqué à cause de trois erreurs de connexion Cloud. Suppression d’un parent comportant une correction reste à vérifier, sans supprimer de données réelles.
- Polling 15 secondes en complément du canal ; réception effective des événements realtime non testée entre deux navigateurs.