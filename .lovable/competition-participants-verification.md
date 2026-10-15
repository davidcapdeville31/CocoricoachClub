# Participants intégrés — couverture

## Implémentation
- Fiches MatchCard dépliées : union dédoublonnée de match_participants (convocations) et match_lineups (composition/inscription), mêmes clés de lecture que les dialogues existants.
- Identités minimales via players_safe, lecture par lots de 200, montée de la section seulement au dépliement. Avatar, noms, disciplines et catégorie de poids judo déjà disponible dans discipline ; aucune donnée inventée.
- Recherche insensible aux accents/prénom/nom, huit personnes visibles puis expansion ; compteur unique dans le titre de section.
- Ancien bouton Participants remplacé par Ajouter / gérer, via EditMatchDialog en mode convocations uniquement. Mode préserve dates et champs compétition ; suppression de convocations confirmée. Composition collective reste accessible via le dialogue existant.
- Liste individuelle héritée du bouton Participants était en lecture seule ; inscriptions historiques de composition restent affichées et ne sont pas supprimées implicitement par édition des convocations.
- Pas de table, droits, migration, combat, partie, résultat, classement, export ou calcul modifié.

## Vérifications
- 4 tests unitaires, 11 assertions : dédoublonnage, huit personnes, tri/recherche, variations du compteur.
- Compte demandeur connecté : bowling EDF seniors dames, Championnat d'Europe juin 2026 (6 personnes, photos réelles), judo catégorie Judo (1 personne, catégorie -60kg), rugby Peyrehorade contre Dax (15 personnes).
- Recherche sans résultat, expansion rugby à 15 puis réduction, ouverture/annulation du sélecteur bowling et lecture des vrais candidats.
- Captures ordinateur 1280px et téléphone simulé 360px ; clair/sombre judo et rugby, aucun débordement horizontal.
- Le club Toulouse Balma Arts Martiaux inspecté ne possédait aucune compétition accessible ; tests judo effectués sur une autre catégorie accessible.
- Contrôle automatique de compilation : OK.

## Limites explicites
- Aucun ajout/retrait réel enregistré : les compétitions existantes sont réelles ; ni leurs convocations ni leurs compositions n'ont été changées pour les essais. Écriture, notification et relecture après écriture restent non vérifiées.
- États zéro/huit/doublon contrôlés dans les tests de transformation ; pas huit personnes ni doublon réellement enregistrés pour les essais.
- Téléphone physique non testé ; compétition future avec personnes non testée.
- Les écrans séparés FIS/WSPL et tournois rugby à sept n'ont pas le bouton Participants décrit et utilisent d'autres relations : ils restent inchangés, sans fausse association à match_participants.