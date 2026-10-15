# Détection de participation réelle — 15 octobre 2026

## Sources et règle
- Parties/combats : `competition_rounds` reliées à compétition et athlète, avec `competition_round_stats.stat_data`.
- Convocations : `match_participants`, inchangées. Compositions : `match_lineups`, aucune preuve de présence.
- Corrections : colonnes existantes de `competition_results`, inchangées ; aucune migration ni écriture de résultat déduit.
- Résolution partagée : résultat individuel valide > correction staff > à vérifier. Une absence staff contradictoire reste stockée, signalée dans le tableau et les compteurs d'incohérences.
- Une fiche de statistiques vide, des métadonnées seules ou des valeurs par défaut ne suffisent pas. Score bowling rapide explicite 0–300 valable ; une feuille détaillée en cours ne suffit pas.

## Synchronisation et couverture
- Tableau commun, compteurs globaux et sources Auto/Staff ; infobulles et avertissement de contradiction.
- Lecture groupée des résultats paginée par 500 ; pas de requête par athlète.
- Sauvegardes staff de résultats et athlète bowling invalident la participation ; écoute des rounds, corrections et statistiques, rafraîchissement de secours toutes les 15 secondes.
- Après suppression du dernier résultat, retour à la correction staff ou À vérifier.
- Compteur de compétitions disputées de `PlayerCumulativeStats` utilise la même preuve pour les rounds et les corrections staff. Résultats et métriques sportives ne sont pas recalculés ni modifiés.
- Les autres historiques sportifs conservant leur propre présentation ne sont pas certifiés exhaustivement dans cette vérification.

## Vérifié
- 25 tests / 50 assertions : cinq parties, deux combats, refus historique conservé, convocation seule insuffisante, présence/absence staff, dernier résultat supprimé, historiques, compteurs recalculés, absence de doublons et immutabilité des entrées ; métadonnées, partie incomplète et autre athlète exclus.
- Compilation automatisée : OK après correction des types.
- Aucun appel de notification ajouté ; aucune donnée réelle modifiée.

## Bloqué / non vérifié
- Deux requêtes de lecture Cloud ont échoué : connexion indisponible.
- Deux tentatives de consultation connectée échouent : la catégorie reste au chargement, compétition inaccessible. Capture `/tmp/browser/participation-detection/opened.png`.
- Aucun enregistrement/suppression réel ni synchronisation entre deux comptes vérifié ce tour ; aucune affirmation de test réel des dix scénarios.
- Rendu final clair/sombre, appareils physiques, historique intégral de toutes les disciplines restent non certifiés.