---
name: Confirmation systématique sur toutes les suppressions
description: Tout bouton/handler de suppression doit passer par ConfirmDeleteButton ou useDeleteWithConfirm — jamais d'appel direct à une API destructive
type: constraint
---
**Règle absolue** : aucune action de suppression dans l'app ne s'exécute sans confirmation explicite dans une `AlertDialog`.

**Comment l'appliquer** :
- Utiliser `<ConfirmDeleteButton />` (`src/components/ui/confirm-delete-button.tsx`) pour tout bouton poubelle / "Supprimer".
- Pour les déclencheurs non-bouton (menu, swipe, row action) : `useDeleteWithConfirm` (`src/hooks/use-delete-with-confirm.ts`).
- **Interdit** : `confirm()` natif, `window.confirm`, ou `onClick` qui appelle directement `mutate()` / `.delete()` sans dialog.

**Niveaux de criticité** :
- `severity="high"` (saisie du nom obligatoire) : catégories, clubs, structures, saisons, joueurs, comptes utilisateurs, abonnements clients.
- `severity="medium"` (défaut) : séances, programmes, compétitions, tournois, tests, blessures, documents, fiches de match, exercices, photos d'équipe.
- `severity="low"` : tags, options de sondage, réactions, notes courtes, pièces jointes individuelles.

**Côté base** : un trigger Postgres `log_sensitive_delete` enregistre automatiquement toute suppression sur `categories`, `clubs`, `players`, `seasons`, `training_sessions`, `matches`, `training_programs` dans `audit_logs` (avec snapshot JSON de la ligne). Ne pas désactiver. Pour ajouter une table sensible à la liste : étendre le tableau `tables` dans le trigger et créer une migration.

**Why** : la suppression accidentelle d'EDF U19 par un admin n'a laissé aucune trace exploitable (pas de qui, pas de quoi) et n'a pas pu être restaurée. La confirmation typée + l'audit DB garantissent que ça ne se reproduira pas en silence.
