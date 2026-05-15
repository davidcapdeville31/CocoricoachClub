# Mode consultation : accès complet en lecture via lien public

## Objectif
Quand quelqu'un ouvre un lien `/public-view?token=...`, il est automatiquement connecté à un compte invité ayant le rôle `viewer` sur le club ou la catégorie ciblée. Toutes les pages de l'application (Datas, Tests, Effectif, Santé, Planification, Programme, Workload, Compétitions, Communication…) s'affichent comme pour un membre interne — mais en lecture seule, exactement comme aujourd'hui pour les utilisateurs avec rôle `viewer`.

## Pourquoi ce changement
Aujourd'hui le visiteur public n'est pas authentifié. Toutes les RLS basées sur `auth.uid()` retournent vide → l'utilisateur voit "0 joueurs / 0 séances / Aucune statistique". Seules quelques sections passent par l'edge function `public-data` (overview, joueurs basiques, matchs basiques). Étendre cette edge function à toutes les sections impliquerait de réécrire la moitié de l'app — non maintenable.

La solution la plus propre est de transformer le visiteur en véritable utilisateur authentifié avec rôle `viewer`, ce qui réutilise tout le système RLS existant.

## Étapes

### 1. Migration DB
Ajouter à `public_access_tokens` :
- `auth_user_id uuid` — l'utilisateur invité associé (créé à la première utilisation)
- `auth_password text` — mot de passe aléatoire généré côté serveur, stocké pour permettre la reconnexion

### 2. Nouvelle edge function `redeem-public-token`
- Valide le token (actif, non expiré)
- Si premier usage : crée un user Supabase invité (`viewer-<tokenId>@guest.cocoricoachclub.com`), génère un mot de passe aléatoire, le stocke
- Insère/met à jour l'entrée `club_members` (ou `category_members`) avec `role = 'viewer'` pour ce user et le club/catégorie cible
- Retourne `{ email, password, club_id, category_id }`

### 3. Refonte du flow côté client
- `PublicView.handleContinue` appelle l'edge function puis fait `supabase.auth.signInWithPassword` avec les identifiants retournés
- Une fois connecté, redirection vers `/categories/:id` ou `/clubs/:id` — l'utilisateur voit absolument tout via les RLS existantes
- `ViewerModeContext` détecte déjà le rôle `viewer` → la bannière "Mode consultation" et le blocage des actions d'édition fonctionnent automatiquement
- `PublicAccessContext` est conservé pour afficher la bannière et empêcher tout bouton d'édition (déjà en place)

### 4. Vérifications RLS
La majorité des tables (sessions, tests, players, injuries, etc.) ont déjà des politiques basées sur `is_club_member()` ou `is_category_member()`. Un `viewer` membre du club passe ces checks. Les rares tables qui n'auraient pas ces politiques seront ajustées après un audit rapide.

### 5. Sécurité
- Tokens expirés / désactivés → la function refuse la connexion et désactive le user invité si besoin
- Le user invité a un email factice non confirmable, le mot de passe ne sort jamais (utilisé uniquement par le retour de l'edge function et oublié immédiatement après le signIn)
- Les RLS empêchent toute écriture pour le rôle `viewer` (déjà le cas)

## Hors périmètre
- Pas de modification du flow d'invitation par email (collaborateurs internes invités via Settings → People restent inchangés)
- Pas de changement des permissions des autres rôles (admin, coach, doctor, etc.)
