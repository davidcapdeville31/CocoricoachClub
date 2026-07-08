## Objectif

Transformer la messagerie en expérience type WhatsApp :
- voir qui est en ligne
- démarrer une conversation 1‑à‑1 en cliquant sur un membre (création automatique si elle n'existe pas)
- créer/renommer des groupes
- afficher les photos/avatars de chaque personne partout (liste, conversation, en‑tête, participants)
- corriger les bugs restants (doublons de conversations, canaux realtime, unread)

## Fonctionnalités livrées

1. **Présence en ligne (Realtime Presence)**
   - Nouveau hook `usePresence(categoryId)` qui rejoint un canal Supabase Realtime Presence par catégorie et publie `{ user_id, last_seen }` à l'ouverture de l'app.
   - Indicateur vert (point) sur chaque avatar quand l'utilisateur est en ligne, gris sinon.
   - Compteur "X en ligne" en haut de la liste des conversations.

2. **Panneau "Membres" cliquable pour DM**
   - Nouvel onglet/section "Membres" à côté de "Conversations" listant tous les membres de la catégorie (staff + athlètes) avec avatar + point de présence.
   - Clic sur un membre → ouvre la DM existante OU la crée automatiquement (RPC `get_or_create_direct_conversation`) puis la sélectionne.
   - Barre de recherche par nom.

3. **Groupes : création + renommage + avatar de groupe**
   - Dialog de création de groupe: nom + sélection multi‑membres avec avatars + recherche.
   - Renommage du groupe : icône crayon dans l'en‑tête du chat (staff/créateur uniquement) → dialog rapide.
   - Avatar de groupe généré (initiales colorées) si aucun avatar fourni.

4. **Avatars partout**
   - `ConversationList` : avatar de l'interlocuteur (DM) ou avatar groupe (Groupe) + point présence pour DM.
   - `ChatWindow` en‑tête : avatar de l'interlocuteur/groupe + statut "en ligne" / "vu à HH:MM".
   - Chaque bulle de message : petit avatar de l'expéditeur à gauche (regroupé si messages consécutifs du même auteur).
   - `ManageParticipantsDialog` : avatars dans la liste.

5. **Bugs corrigés**
   - Doublon DM impossible : la RPC `get_or_create_direct_conversation` renvoie l'existante si déjà présente entre 2 utilisateurs dans la même catégorie.
   - Compteur non‑lu figé après lecture : invalidation stricte sur `markConversationAsRead`.
   - Canaux realtime : suffixe aléatoire déjà appliqué sur `useUnreadMessages` étendu à `ChatWindow` et à la présence pour éviter les conflits multi‑instances.

## Détails techniques

### Base de données (migration)

- Colonnes ajoutées sur `conversations` :
  - `name text` (déjà présent pour groupes) — vérifier
  - `avatar_url text null` (avatar de groupe optionnel)
- RPC `public.get_or_create_direct_conversation(_category_id uuid, _other_user_id uuid)` :
  - vérifie que les 2 utilisateurs sont bien membres/athlètes de la catégorie
  - cherche une conversation `type='direct'` où les 2 sont les seuls participants
  - sinon crée la conversation + les 2 rows `conversation_participants`
  - renvoie l'`id`
- RPC `public.rename_conversation(_conversation_id uuid, _new_name text)` :
  - autorisé si créateur OU staff (`is_staff_for_category`) de la catégorie du groupe
- GRANT EXECUTE aux `authenticated` sur les 2 RPC.
- RLS `conversations UPDATE` : autoriser mise à jour de `name`/`avatar_url` selon la même règle que la RPC.

### Frontend

- `src/hooks/usePresence.ts` : `supabase.channel(\`presence:cat:${categoryId}\`, { config: { presence: { key: userId } } })` + `.track({ online_at })`, retourne `Set<userId>`.
- `src/components/messaging/MembersPanel.tsx` : liste membres de la catégorie (via `fetchCategoryRosterPlayers` + `category_members` staff), déclenche `get_or_create_direct_conversation` au clic.
- `src/components/messaging/CreateGroupDialog.tsx` : refonte multi‑sélect avec avatars.
- `src/components/messaging/RenameGroupDialog.tsx` : nouveau.
- `src/components/messaging/UserAvatar.tsx` : composant réutilisable `avatar + point de présence` (props `userId`, `name`, `photoUrl`, `size`).
- `MessagingTab.tsx` : ajoute onglets `Conversations | Membres`.
- `ConversationList.tsx` : intègre avatars + présence.
- `ChatWindow.tsx` : en‑tête avec avatar + statut, bulles avec avatar expéditeur.

### Non touché

- Structure des messages, réactions, sondages, pièces jointes, notifications push : conservées telles quelles.

## Étapes d'exécution

1. Migration SQL (nouvelles RPC + colonnes + RLS + GRANT).
2. Hook `usePresence` + composant `UserAvatar`.
3. `MembersPanel` + intégration onglets dans `MessagingTab`.
4. `CreateGroupDialog` refondu + `RenameGroupDialog`.
5. Mise à jour `ConversationList` (avatars/présence) et `ChatWindow` (en‑tête + bulles).
6. Vérification build + test manuel (démarrer DM depuis Membres, renommer groupe, voir présence).

## Ce qui reste hors périmètre

- Statut "en train d'écrire…" (typing indicator) — peut être ajouté ensuite si souhaité.
- Dernière connexion persistée en base (`last_seen_at`) — pour l'instant présence uniquement en temps réel via Realtime Presence.
- Upload d'avatar de groupe personnalisé — colonne prête mais UI d'upload livrée en itération suivante si demandée.
