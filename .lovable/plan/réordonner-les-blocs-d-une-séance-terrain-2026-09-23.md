# Réordonner les blocs d’une séance terrain

## Objectif
Ajouter sur chaque bloc deux commandes visibles : **monter** et **descendre**, afin de modifier immédiatement l’ordre des blocs avant d’enregistrer la séance.

## Mise en œuvre
- Ajouter deux boutons avec flèches dans l’en-tête de chaque bloc, à côté de la suppression.
- La flèche vers le haut déplace le bloc d’une position ; celle vers le bas fait l’inverse.
- Masquer ou rendre inactive la commande impossible pour le premier et le dernier bloc.
- Recalculer automatiquement les numéros « Bloc 1, Bloc 2… » après chaque déplacement.
- Conserver l’ordre choisi lors de la création comme lors de la modification d’une séance.
- Appliquer ce comportement à toutes les disciplines utilisant cette création de séance par blocs.

## Périmètre technique
Modification ciblée de l’écran de création/modification des séances terrain. Aucun changement sur les données des blocs, le RPE, le Wellness, les participants, les notifications ou l’affichage des séances.

## Vérification
Tester le déplacement vers le haut et vers le bas, les limites du premier/dernier bloc, puis vérifier que l’ordre enregistré est restauré à la réouverture.
