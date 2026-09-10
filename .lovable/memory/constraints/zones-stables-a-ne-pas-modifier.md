---
name: Zones stables à ne pas modifier
description: Programmation, création de séance par les athlètes, affiliation d'athlètes, wellness, RPE et affichage des séances sont figés et fonctionnels
type: constraint
---
Ne pas toucher (sauf demande explicite de correction sur ces zones précises) :
- Programmation / création de programmes et assignation
- Création de séance par les athlètes (espace athlète)
- Affiliation d'autres athlètes à une séance (partenaires, event_participants)
- Remplissage Wellness
- Remplissage RPE (y compris datation à la date réelle de la séance)
- Affichage des séances (calendriers staff + athlète, détails de séance)

**Why:** Ces parcours ont été longuement débogués et fonctionnent. Toute modification collatérale a déjà causé des régressions.

**How to apply:** Pour toute nouvelle demande, choisir l'implémentation qui n'altère pas ces fichiers/flux. Si un changement les touche obligatoirement, prévenir l'utilisateur avant et vérifier le parcours complet après.
