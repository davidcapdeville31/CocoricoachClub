# UX athlète mobile V2 — séances guidées

## Ce que l’audit confirme
- L’accueil affiche les séances via le module de saisie RPE : une amélioration des cartes doit donc préserver les formulaires et leurs associations.
- Les consignes mentales viennent du texte enregistré par le coach dans la séance. Les retours existants sont le commentaire, le ressenti, la durée et le RPE ; aucun questionnaire mental structuré distinct n’a été identifié.
- Les circuits conservent le détail par exercice et par tour dans leurs notes, avec une seule ligne agrégée pour le tonnage. Le statut Fait / Adapté / Non fait porte sur la ligne du circuit complet, pas sur chacun de ses tours.
- Le témoin actuel des tours dépend de leur visite et des répétitions préremplies : il ne constitue pas une preuve de réalisation.
- Certains formulaires réinitialisent leurs valeurs à l’ouverture ou à l’arrivée de la durée prévue : la conservation des saisies nécessite une protection ciblée.

## 1. Préparation mentale — priorité
- Remplacer l’action discrète par **Découvrir ma séance**, avec titre, date, objectif disponible et statut réel. Pour un texte libre, afficher une phrase entière sans inventer d’objectif.
- Ouvrir une fiche confortable plein écran sur téléphone : contenu intégral du coach, typographie lisible et rendu Markdown sécurisé éprouvé. Conserver l’ordre original, sans réécriture ni suppression.
- Ajouter une navigation interne uniquement à partir des titres réellement présents dans le contenu.
- Garder les consignes accessibles pendant la saisie des observations existantes. Ne pas inventer de questions ou de nouveaux champs.
- Permettre la reprise d’un brouillon de saisie sans le confondre avec une séance terminée. Ne pas stocker les réponses sensibles durablement sur le téléphone ; réutiliser les possibilités existantes d’enregistrement, et distinguer clairement brouillon et validation finale.

## 2. Circuits — saisir pendant l’entraînement
- Séparer **Consignes / Mes résultats** en conservant prescription complète, vidéos et instructions accessibles sans perdre les valeurs saisies.
- Afficher un résumé du circuit, la récupération lorsqu’elle est renseignée, les tours et une progression discrète.
- Compacter chaque exercice en une ligne souple : nom lisible, charge, répétitions ; adaptation sur petit écran sans réduire les champs tactiles.
- Remplacer le témoin de visite par une confirmation explicite **Valider le tour et continuer**, enregistrée avec le détail du circuit. Les valeurs préremplies seules ne valident jamais un tour.
- Respecter les champs facultatifs, y compris une charge vide au poids du corps. La copie du tour précédent complète seulement les champs vides compatibles.
- Indiquer clairement que Fait / Adapté / Non fait concerne le circuit entier. Aucune modification des calculs ou des critères existants de validation finale.

## 3. Bilan — une séance clairement identifiée
- Afficher activité, titre et date au-dessus du bilan correspondant ; conserver toutes les associations existantes.
- Conserver échelle RPE, valeur, libellé et durée, avec un contrôle tactile confortable.
- Présenter les cinq ressentis dans une grille sans débordement, avec coche et état sélectionné explicite.
- Préserver HRV, données complémentaires et saisies pendant les changements de vue.

## 4. Accueil — distinguer les actions
- Séparer **Mes séances à réaliser** et **Mes séances terminées** en réutilisant les statuts actuels, sans assimiler consultation, présence ou remplissage automatique à une validation volontaire.
- Harmoniser les cartes et leurs actions, garder les séances partiellement remplies accessibles.
- Conserver navigation, wellness, récupération, cycles, bowling et autres fonctionnalités. Aucun changement inutile côté coach.

## Vérifications et limites
- Images à **320, 360, 390, 430 px**, plus contrôle ordinateur et mode sombre.
- Vérifier contenu mental long, listes et gras, observations, retour accidentel et reprise ; circuit de 6 tours, copie sans écrasement, charge vide, confirmation et persistance des valeurs entre tours ; bilan associé à la bonne séance ; séparation des statuts.
- Vérifier les parcours réels avec la session authentifiée disponible, sans notifications de test ni modification d’une séance réelle sans nécessité. Si le compte accessible n’est pas athlète ou si l’enregistrement ne peut être testé sans toucher aux données réelles, annoncer explicitement cette limite.
- Présenter après chaque phase les changements visibles, les tests effectués et ceux non vérifiés. Ne pas déclarer l’ensemble terminé après une simple compilation ou une démonstration isolée.

## Composants concernés — détails techniques
- `AthleteSpaceRpe`, `AthleteSpaceDashboard`, `AthleteSpaceCalendar` : cartes et entrée dans les séances, sans modifier les requêtes d’accès ni les convocations.
- Une fiche mentale dédiée côté athlète, réutilisant les retours existants et le rendu du contenu du coach.
- `AthleteWeightLogInput`, `CircuitRoundStepper` : séparation prescription/résultats et saisie compacte ; extension rétrocompatible des métadonnées du circuit pour les tours confirmés, sans migration ni changement de tonnage.
- `SessionValidationDialog` et les bilans dans `AthleteSpaceRpe` : identification de la séance, ressentis et conservation des saisies.
- Tokens visuels et composants existants ; changements transversaux pour toutes les disciplines, sans reconstruire le bowling ou le wellness.
- Ajouter des tests ciblés pour les confirmations de tours, copie sans écrasement et absence de validation par préremplissage ; contrôler les erreurs de l’aperçu après les modifications.