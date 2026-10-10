# Refonte mobile de l'espace athlète — par étapes

Audit fait sur le code actuel. Le travail se fait par étapes, avec une vérification visuelle à 320, 360, 390 et 430 px, sur tablette et sur ordinateur après chaque étape. Le côté coach, les calculs, les bases de données et les historiques ne changent pas.

## Composants concernés (audit)

| Zone | Composant actuel | Problème constaté |
|---|---|---|
| Accueil | `AthleteSpaceDashboard`, `CurrentCyclesCard` | Grandes cartes, navigation faite d'icônes sans libellés |
| Séances / calendrier | `AthleteSpaceCalendar`, `SessionDetailDialog` | Consignes mentales affichées en entier, avec les `**` visibles |
| Saisie musculation | `AthleteWeightLogInput` (gère circuit, EMOM, tabata, 5×5, drop set, cluster, rest-pause, pyramides, séries classiques) | Champs qui débordent ; **circuit : une seule ligne « Tour N : kg × reps » pour tout le circuit**, au lieu d'une ligne par exercice ; prescription affichée deux fois |
| Validation / RPE | `SessionValidationDialog`, `AthleteSpaceRpe` | RPE, commentaire et charges sont mélangés dans un long défilement |

## Étape 1 — Débordements mobiles + saisie des circuits (prioritaire)
- Grille de saisie fluide : charge et répétitions en 2 colonnes égales, clavier numérique, poubelle intégrée, sans largeur fixe. Plus aucun défilement horizontal dès 320 px.
- Le bouton d'apparence flottant (soleil) est déplacé ou mis en retrait, pour ne plus masquer les champs.
- **Circuit** : saisie « Tour 1 / 6 » avec la liste des exercices du circuit, chacun avec Charge + Répétitions. Boutons « Tour précédent / Tour suivant », pastilles des tours (faits / à faire), bouton volontaire « Reprendre les valeurs du tour précédent » qui ne remplit que les champs vides.
- Les données restent enregistrées par exercice et par tour, comme aujourd'hui. Avant de coder, je vérifie comment les tours de circuit sont enregistrés actuellement. Si l'enregistrement ne regroupe qu'une charge par tour, je l'adapte sans toucher au tonnage.
- Les autres méthodes gardent leur logique : séries classiques (lignes de séries), EMOM/tabata (rounds), drop set, cluster, rest-pause et pyramides (mode auto actuel). Seule leur mise en page mobile est corrigée.
- Une seule vue détaillée de la prescription : dans la zone de saisie, un résumé « Circuit · 4 exercices · 6 tours » avec « Voir le détail » (vidéos et infos conservées).

## Étape 2 — Séance musculation : « Ma séance » / « Mes résultats »
- Deux onglets dans la séance. Les valeurs saisies sont gardées quand on change d'onglet.
- Bilan progressif : Mes résultats → Mon ressenti (Fait / Adapté / Non fait, commentaire) → Mon RPE → bouton principal « Valider ma séance ». Les règles de validation actuelles et les données HRV sont conservées.

## Étape 3 — Séance de préparation mentale
- Carte courte : titre, objectif court, date ou durée, statut, bouton « Voir ».
- À l'ouverture : affichage propre du texte (titres, gras, italique, listes, paragraphes). Les sections (Objectif, Comprendre, Travail…) sont repliables seulement si elles existent dans le texte enregistré. Le champ « Mes observations » existant est conservé.

## Étape 4 — Accueil
- En-tête un peu moins haut (avatar, nom, équipe, cloche, infos perso conservés).
- Navigation : icônes avec libellés courts et état actif marqué. Les onglets principaux sont visibles, les autres sont accessibles dans « Plus ». Toutes les destinations actuelles sont conservées.
- Wellness compact : « À remplir » + bouton « Renseigner », ou « ✓ Renseigné » + mini-résumé des indicateurs existants.
- Séances du jour : cartes courtes (type, titre, date, objectif, statut, action).
- Cycle en cours : nom, activité, objectif, dates, progression réelle, temps restant, plus « Détails ».

## Étape 5 — Finitions
- Animations discrètes (onglets, tour suivant, validation), désactivées si le téléphone demande moins d'animations. Contrôle du mode sombre.

## Tests et limites
- Je teste chaque écran en images, avec des données d'essai, aux largeurs indiquées.
- L'enregistrement réel côté athlète demande un compte athlète connecté. Si je ne peux pas l'utiliser, je le signalerai, sans le déclarer validé.

## Détails techniques
- Logique métier non touchée : `getPrescribedRounds`, `SPECIAL_AUTO_METHODS`, calculs de tonnage et de charge, RLS et fonctions.
- Nouveaux composants partagés : `CircuitRoundStepper` et `SetRowInput` (ligne charge/reps responsive), plus le rendu du texte via le moteur markdown déjà présent ou `react-markdown`.
- Après chaque étape : typecheck `bunx tsgo --noEmit -p tsconfig.app.json`.
