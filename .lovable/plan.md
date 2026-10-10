# Refonte transversale de l'affichage des séances

## Constats de l'audit initial
- Titres techniques générés à la source : `trainingTypes.ts` (« Bowling — Mode simplifié »), `BowlingSimplifiedDialog` écrit « Séance bowling — Mode simplifié » dans les notes, `SimplifiedSessionDialog` préfixe « [Séance athlète] ».
- « Consignes du coach » affiché à partir des notes, sans vérifier l'origine réelle (`SessionDetailDialog`, `AthleteSpaceCalendar`, `MentalSessionContent`).
- Clé `sessionDetailDialog.myDataEntered` absente des traductions (affichée brute).
- Les marqueurs « [Séance athlète] » servent aussi de détection d'origine (`AttendanceTab`, `SessionDetailsDialog`) : à conserver en lecture.

## Ce qui sera fait
1. **Un seul module de présentation** (`src/lib/sessionPresentation.ts`) utilisé par tous les écrans athlète et coach :
   - `getSessionDisplayTitle` : titre personnalisé conservé ; sinon « Séance {sport/type} » ; retire « — Mode simplifié/détaillé » et « [Séance athlète] » à l'affichage uniquement.
   - `getSessionOrigin` : personnelle (created_by_player_id ou auteur = athlète) / prescrite (auteur staff) / inconnue, fondé sur les données d'auteur déjà en place.
   - `splitSessionNotes` : sépare consignes staff, notes/objectif/bilan athlète et lignes techniques auto-générées (Durée/RPE répétés), masquées si déjà affichées ailleurs.
   - `getSessionStatus` : réalisation (programmée, en cours, terminée, annulée) distincte de la saisie (à compléter, partielle, enregistrée).
2. **Fenêtre de détails athlète** réorganisée : en-tête (titre, date, horaire · durée, origine · statut), résumé (durée, RPE, nb de blocs, objectif, saisie), contenu par blocs dépliables avec données propres au sport (bowling, judo, musculation, course, autres via champs existants), « Mes observations », actions selon permissions.
3. **Cartes calendrier** compactes : icône, titre, horaire, « Ma séance »/« Séance du coach », statut, action principale ; consignes complètes retirées des cartes.
4. **Coach** : mêmes titres/statuts/origine dans détails de séance, vignettes, vues semaine/jour, suivi individuel.
5. **Traductions** : ajout des clés manquantes (FR/EN), script de vérification des clés `t('…')` utilisées dans les composants séances ; remplacement des textes codés en dur concernés.
6. **Nouvelles séances** : les notes ne contiendront plus le titre technique ; le mode reste stocké dans les champs existants. Aucune donnée historique modifiée.

## Tests
- Tests unitaires du module de présentation (titres, origine, notes, statuts) avec les 10 scénarios demandés.
- Contrôle visuel clair/sombre 320–1280 px sur bowling, judo, musculation, course, rugby.
- Sauvegarde/réouverture réelle : uniquement si une session connectée est disponible ; sinon signalé non testé.

## Hors périmètre
Schéma, calculs, droits, logique de sauvegarde et modes de saisie inchangés.
