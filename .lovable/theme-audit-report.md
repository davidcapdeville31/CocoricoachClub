# Audit clair/sombre — première étape, 10 octobre 2026

## Portée
Audit structurel du système existant et première correction des causes partagées. Ce rapport ne constitue pas une certification exhaustive de toute l’application.

### Corrections
- Unification des tokens `.dark` et `.field-mode`, réutilisation du choix de thème existant, variantes Tailwind compatibles avec Mode Terrain.
- Surfaces et textes des champs, dialogs, overlays, cases à cocher, toasts et graphiques raccordés aux tokens existants.
- Sélections bleu marine/blanc ; erreurs avec couleur de texte contrastée, badges et statuts corrigés ; Wellness vert préservé.
- RPE d’effort raccordé à une palette commune, sans remplacer la sélection RPE par le bleu marine ni l’étendre aux autres échelles.
- Labels accessibles sur les contrôles constatés sans nom ; onglets Admin adaptés aux petites largeurs ; popover des notifications limité à la largeur disponible.
- Branding personnalisé compatible avec Mode Terrain ; couleurs de suppression indépendantes des accents personnalisés.

## Vérifications réellement exécutées
Playwright Chromium connecté en consultation autorisée :
- `/` : liste des clubs.
- `/settings` : préférences personnelles et notifications.
- `/admin` : liste des utilisateurs et statuts.
- `/super-admin` : tableau de bord initial.
- `/categories/0e6a72e9-8475-489f-a09c-55d83b01bca4` : décisions catégorie bowling.
- `/categories/27f202f1-5fb7-4a43-ab0a-5894cffbf75c` : décisions catégorie judo.
- `/athlete-space?playerId=67d19fdc-dcfa-4257-8afe-9168799e3bdc` : accueil athlète, consultation Vue Admin.

Chaque écran a été contrôlé en clair et Mode Terrain à 320, 360, 390, 430, 768 et 1280 px : 84 états. Axe 4.10.3 exécuté à chaque largeur, règles color-contrast, button-name, label, landmark-one-main et heading-order. Captures visuelles inspectées pour accueil athlète sombre, catégorie bowling claire, paramètres sombres et Admin clair à 390 px.

Dernier passage : aucun échec détecté par les règles contraste, nom de bouton ou label sur ces états ; aucun débordement horizontal mesuré ; aucune erreur JavaScript. Les résultats automatisés ne prouvent pas à eux seuls la conformité WCAG complète ni le contraste de chaque élément graphique ou état interactif.

28 tests bowling/judo réussis, 123 assertions : scores officiels, bonus, corrections, données manquantes, observations, sérialisation et modèle judo. Build automatique observé réussi. Aucun enregistrement, push ni changement de données réalisé pendant les vérifications.

## Anomalies et limites restantes
- Axe signale encore des régions principales manquantes sur six routes et des sauts de niveaux de titres sur paramètres, Admin, Super Admin et espace athlète ; corrections structurelles à traiter séparément.
- Les onglets secondaires, modales, formulaires ouverts, erreurs de validation, hover/focus et toutes les disciplines n’ont pas été parcourus exhaustivement.
- La palette RPE a été raccordée dans le code ; ses dix états n’ont pas tous été vérifiés dans un formulaire connecté durant cette étape.
- Android physique, iOS, clavier virtuel, technologies d’assistance et contrastes de tous les graphiques non vérifiés.
- Les couleurs exactes imposées Poche Oui (#169B70) / blanc sont conservées ; cette paire est une limite connue pour le contraste AA du petit texte, à arbitrer sans changer arbitrairement la demande précédente.
- Les personnalisations de club restent possibles ; chaque palette personnalisée nécessite une vérification supplémentaire.

## Étapes suivantes
Poursuivre l’inventaire route par route, puis tester les portails, formulaires, états interactifs, sélections à contenus imbriqués et RPE connecté ; corriger les anomalies confirmées sans modification métier.