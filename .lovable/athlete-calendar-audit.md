# Audit préalable — Calendrier athlète

## Périmètre observé
Code du calendrier athlète, présences séance/compétition, parent de navigation, styles athlète, cycles et dépendances. Aperçu connecté avec le compte disponible, consultation staff de Manon CLEMENT (bowling), onglet calendrier à 390 × 844 px. Aucune écriture de présence, séance ou notification. Deux maquettes analysées.

## Constats confirmés
- **Priorité UX élevée** : les prochaines séances et compétitions, avec leurs réponses complètes, précèdent la grille ; dans la capture réelle le mois débute seulement au bas de l’écran.
- **Priorité UX élevée** : carte de section, panneaux de prochaines séances, cartes événement et bloc de présence imbriqués ; actions principales empilées, marge cumulée importante.
- **Lisibilité** : onglet Calendrier réduit à une icône sur mobile, Planification abrégée « Planif. » ; grille avec fonds, contours et ombres de couleurs simultanés, légende volumineuse avant les événements.
- **Navigation** : pas de commande Aujourd’hui explicite, pas de vue semaine ; mois non contrôlé alors qu’un lien de notification change la date sélectionnée.
- **Défilement** : événements du jour enfermés dans une zone max-height 400 px avec défilement interne, en plus de celui de la page.
- **Répétition** : confirmations affichées dans la zone prochaine et à nouveau dans la journée sélectionnée ; événements déjà répondus présents dans la zone de confirmation.
- **Accessibilité critique** : boutons de modification/suppression imbriqués dans le bouton d’ouverture d’une séance personnelle ; champ de motif sans libellé associé. À corriger sans réécrire les interactions métier.
- **Présence** : succès après requêtes, erreurs via toast ; chargement masqué par `return null`, requêtes en erreur non représentées ; bouton verrouillé n’explique pas l’action. Commentaire local conservé lors du passage Présent, mais commentaire stocké actuellement remis à null par la sauvegarde Présent : préserver le contrat métier existant, ne pas le modifier silencieusement.
- **Performance/maintenance** : composant principal de 1615 lignes, nombreuses requêtes et états de fenêtres ; exercices déjà chargés uniquement pour la journée. Les requêtes existantes ne sont pas uniformément limitées à une période. Une modification des filtres d’historique serait risquée et hors refonte visuelle.

## Carte des dépendances et frontières
- `AthleteSpaceCalendar.tsx` : visibilité collective/ciblée/personnelle, dates, compétition multi-jours, cycles affectés/collectifs, Wellness, prévention/réhab, détails et création multisports.
- `SessionAttendanceResponse.tsx` : event_participants + training_attendance, verrouillage existant et délai de rattrapage ; ne pas changer les délais ni destinations d’écriture.
- `MatchAttendanceResponse.tsx` : match_participants, athlète convoqué uniquement, réponses tardives autorisées.
- `AthleteSpace.tsx` : onglets, identité, consultation admin et navigation basse ; adaptation de présentation du seul sous-onglet Calendrier.
- `Calendar` partagé : react-day-picker ; réutiliser le moteur sans changer le style global des calendriers coach.
- Fenêtres de détail/validation, création judo/bowling/terrain, compétition, récupération : conservées avec mêmes paramètres et sauvegardes.
- `CurrentCyclesCard` à l’accueil et `AnnualPlanningView` : ne pas refondre ces écrans ; réutiliser les données visibles plutôt que créer de nouveaux modèles.
- `FieldModeContext`, tokens globaux, data-attendance : sources existantes des thèmes et états fonctionnels ; pas de deuxième système.

## Limites de l’audit initial
Un seul sport rendu dans ce passage, clair uniquement ; aucune sauvegarde en identité athlète ni synchronisation coach après écriture testée ; réseau en échec, agrandissement du texte, lecteurs d’écran et téléphones physiques non vérifiés. L’audit global des thèmes demeure ouvert.