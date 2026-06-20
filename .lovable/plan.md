## Objectif

Aucune suppression dans l'application ne doit être exécutée sans une confirmation explicite de l'utilisateur. Aujourd'hui, certains boutons "Supprimer" déclenchent l'action immédiatement (comme la suppression d'une catégorie), d'autres ont déjà une `AlertDialog` — c'est incohérent et risqué.

L'audit du code montre ~166 endroits avec une icône poubelle et ~383 handlers de suppression. Faire passer chacun à la main une fois ne suffira pas : il faut une **règle unique** qui s'applique partout, sinon le problème reviendra à la prochaine fonctionnalité.

## Approche : un composant unique réutilisable + passes de migration

### 1. Composant `<ConfirmDeleteButton />` (nouveau, central)

Un seul composant qui remplace tous les boutons de suppression de l'app. Il encapsule :

- Le bouton (icône poubelle ou texte "Supprimer", variant configurable)
- Une `AlertDialog` shadcn intégrée
- Un titre + message personnalisables ("Supprimer la catégorie EDF U19 ?", "Cette action est définitive et supprimera aussi X joueurs, Y séances...")
- Un champ optionnel "Tapez le nom pour confirmer" pour les suppressions **critiques** (catégorie, club, joueur, saison) — l'utilisateur doit retaper le nom exact avant que le bouton rouge ne s'active
- Un état `loading` pendant l'appel API
- Un toast de succès / erreur automatique

Niveaux de criticité :
- `low` : simple "Confirmer ?" (ex. supprimer un exercice perso, un tag)
- `medium` : confirmation + description des conséquences (ex. supprimer une séance, un test)
- `high` : confirmation + saisie du nom exact (ex. catégorie, club, saison, joueur, structure)

### 2. Hook `useDeleteWithConfirm`

Pour les cas où le déclencheur n'est pas un simple bouton (menu contextuel, swipe mobile, action depuis un tableau). Même logique, même UI, juste appelable programmatiquement.

### 3. Migration du code existant

Passe automatisée + revue manuelle, par domaine fonctionnel, dans cet ordre de priorité :

1. **Critique (high)** : `categories`, `clubs`, `seasons`, `players`, structures, comptes utilisateurs → toujours avec saisie du nom
2. **Élevé (medium)** : séances, programmes, compétitions, tournois, tests, blessures, documents administratifs, fiches de match
3. **Standard (low)** : exercices perso, tags, notes, messages, pièces jointes, photos, options de sondage

Les `AlertDialog` déjà en place sont conservées mais réécrites pour utiliser le nouveau composant, afin que tout passe par le même chemin (titre, ton, bouton rouge, raccourcis clavier Esc/Entrée identiques partout).

### 4. Garde-fou côté base

En complément (et sans bloquer la livraison UI) :
- Ajout d'un **log d'audit obligatoire** sur les suppressions sensibles via triggers Postgres (`categories`, `clubs`, `players`, `seasons`, `training_sessions`, `matches`, `programs`). Chaque DELETE écrit dans `audit_logs` qui a supprimé, quoi, et un snapshot JSON de la ligne — pour pouvoir au minimum savoir **qui** a fait quoi, même si la donnée n'est plus restaurable.
- Optionnel (étape suivante, à valider) : passer les entités les plus critiques (catégories, joueurs, saisons) en **soft delete** avec une corbeille "Restaurer (30 j)".

## Livrables de cette première itération

1. `src/components/ui/confirm-delete-button.tsx` + `src/hooks/use-delete-with-confirm.ts`
2. Migration des suppressions **critiques + élevées** (catégories, clubs, saisons, joueurs, séances, programmes, compétitions, tests, blessures, documents)
3. Trigger Postgres `log_sensitive_deletes` sur les 7 tables sensibles, écrivant dans `audit_logs`
4. Memory de projet : règle "toute suppression passe par `ConfirmDeleteButton`" pour que les futures features la respectent automatiquement

Les suppressions "standard" (tags, notes, options, etc.) seront migrées dans une 2ᵉ itération pour ne pas livrer un changement trop large d'un coup.

## Hors scope (pour plus tard, à valider séparément)

- Soft delete + corbeille avec restauration en 1 clic
- Restauration de la catégorie EDF U19 supprimée (impossible techniquement — donnée perdue, voir échange précédent)

## Note technique

Le composant s'appuie sur `AlertDialog` shadcn déjà présent, sur le design system existant (`destructive` variant, tokens sémantiques) et n'introduit aucune dépendance nouvelle. Les triggers Postgres utilisent `auth.uid()` et `row_to_json(OLD)` — pattern déjà utilisé ailleurs dans le projet.
