# Plan d'optimisation des requêtes répétées

Objectif : réduire le volume de requêtes en arrière-plan sans dégrader l'UX ni la sécurité. Chaque étape est indépendante et déployable séparément.

---

## Étape 1 — Stopper les polls OneSignal silencieux ⭐ (gain immédiat, risque nul)

**Problème** : `check-onesignal-subscriptions` et `sync-onesignal-tags` sont rappelés à chaque `onAuthStateChange` (TOKEN_REFRESHED toutes les ~50 min, USER_UPDATED, focus onglet, etc.) + `waitForOneSignalServerSubscription` boucle 5× par login.

**Actions** :
- Dans `AuthContext.tsx` : ne déclencher `syncOneSignalUser` que sur les events `SIGNED_IN` et `INITIAL_SESSION`, pas sur `TOKEN_REFRESHED` ni `USER_UPDATED`.
- Dans `lib/onesignal.ts` : mémoïser `oneSignalLogin` par `userId` pendant la session (flag en mémoire) pour éviter les re-syncs si l'auth listener refire.
- Réduire `waitForOneSignalServerSubscription` à 2 tentatives (au lieu de 5).

**Impact** : -80 % des appels OneSignal (passe d'environ 1 appel / 50 min à 1 par session réelle).
**Risque** : faible. Si l'utilisateur révoque la permission navigateur en cours de session, le tag ne se met à jour qu'au prochain login (acceptable).
**Fichiers** : `src/contexts/AuthContext.tsx`, `src/lib/onesignal.ts`.
**Test** : ouvrir la page 15 min, vérifier dans l'onglet Réseau qu'il n'y a plus d'appels OneSignal après le login initial. Forcer un `TOKEN_REFRESHED` (await 1 h ou modifier `expires_at`) → aucun nouvel appel OneSignal.

---

## Étape 2 — Cacher les requêtes d'identité (is_super_admin, club_members, profil) ⭐

**Problème** : `is_super_admin`, `super_admin_users`, `club_members`, `category_members`, `clubs`, `user_security_settings` sont rejouées à chaque navigation et chaque montage de composant (souvent via des `useEffect` sans cache ou des `useQuery` sans `staleTime`).

**Actions** :
- Ajouter `staleTime: 5 * 60 * 1000` et `gcTime: 10 * 60 * 1000` sur les `useQuery` d'identité (rôle utilisateur, super admin, settings sécurité, branding club).
- Centraliser `is_super_admin` dans un hook unique `useIsSuperAdmin()` consommé partout, plutôt que des appels directs `supabase.rpc(...)` éparpillés.
- Idem pour `useClubMembership(clubId)` / `useCategoryMembership(categoryId)`.

**Impact** : -60 à -80 % des requêtes d'identité (1 fois par session au lieu de N fois par navigation).
**Risque** : faible. Si l'admin change un rôle, le changement met jusqu'à 5 min à se refléter (acceptable, déjà le cas pour `role-menu-permissions-matrix`).
**Fichiers** : `src/hooks/useMenuPermissions.ts`, `src/lib/onesignal.ts` (buildUserTags), hooks d'identité existants, composants qui appellent directement `supabase.rpc("is_super_admin")` ou `from("super_admin_users")`.
**Test** : ouvrir l'app, naviguer entre 5 pages, vérifier dans Réseau qu'`is_super_admin` n'apparaît qu'une fois.

---

## Étape 3 — Cadencer les polls notifications / messages

**Problème** : `notifications`, `messages`, `matches` sont probablement rejouées via `refetchInterval` court (souvent 10–30 s) sur tous les hooks (`useUnreadMessages`, `useUnreadAthleteSessionsCount`, badges header, etc.). Ces polls tournent même quand l'onglet est en arrière-plan.

**Actions** :
- Passer `refetchInterval` à 60 s minimum sur les compteurs non critiques.
- Ajouter `refetchIntervalInBackground: false` partout (déjà le défaut TanStack, mais à confirmer).
- Pour les notifications et messages, basculer sur **Supabase Realtime** (channel `postgres_changes`) à la place du polling : un seul abonnement, push-based. Le polling reste en filet de sécurité toutes les 5 min.

**Impact** : -90 % des requêtes `notifications`/`messages` (de ~120 / heure à ~12).
**Risque** : moyen. Realtime peut manquer un event si le socket se déconnecte → garder un refetch de secours sur `window focus`.
**Fichiers** : `src/hooks/useUnreadMessages.ts`, `src/lib/hooks/useUnreadAthleteSessionsCount.ts`, `src/lib/hooks/usePendingWeightLogsCount.ts`, `src/lib/hooks/usePendingTestResultsCount.ts`, composants de header / badges.
**Test** : ouvrir 2 onglets, envoyer un message depuis l'un, vérifier que le badge se met à jour dans l'autre en <2 s (via Realtime) sans avoir multiplié les requêtes.

---

## Étape 4 — Couper le poll permission navigateur OneSignal (2 s)

**Problème** : `lib/onesignal.ts` interroge `Notification.permission` toutes les 2 s via un `setInterval` pour détecter un changement.

**Actions** :
- Remplacer par un check on-demand : uniquement au focus de l'onglet (`visibilitychange`) et après un clic sur le bouton "activer notifications".

**Impact** : élimine 1 800 vérifications / heure (côté JS, sans requête réseau mais consomme CPU).
**Risque** : très faible. La permission ne change quasi jamais sans interaction utilisateur.
**Fichiers** : `src/lib/onesignal.ts`, `src/hooks/use-push-notifications.ts`.
**Test** : ouvrir DevTools → Performance, enregistrer 30 s, vérifier qu'il n'y a plus de tâches OneSignal récurrentes.

---

## Étape 5 — `get_maintenance_status` toutes les 60 s

**Problème** : log réseau montre 1 appel / minute en continu (MaintenanceGate).

**Actions** :
- Passer l'intervalle à 5 min (300 s). Si maintenance activée, le banner apparaît avec 5 min de retard max — acceptable pour un mode admin.
- Ajouter `refetchOnWindowFocus: true` pour rattraper l'état au retour de l'utilisateur.

**Impact** : -83 % (60 → 12 requêtes / heure).
**Risque** : nul.
**Fichiers** : composant `MaintenanceGate` (à localiser).
**Test** : activer la maintenance dans Super Admin → vérifier que tous les clients la voient au plus tard 5 min après + immédiatement au retour sur l'onglet.

---

## Ordre recommandé

1. **Étape 1** (OneSignal auth) — déploiement rapide, gain immédiat visible dans Network.
2. **Étape 5** (maintenance) — 2 lignes de code, gain net.
3. **Étape 4** (poll permission) — purement client, aucun risque RLS.
4. **Étape 2** (cache identité) — demande plus d'attention (centraliser hooks), tester la navigation multi-pages.
5. **Étape 3** (Realtime notifications) — la plus impactante mais aussi la plus risquée, à faire en dernier avec tests cross-onglets.

---

## Récapitulatif gain attendu

| Étape | Requêtes / heure avant | après | Gain |
|---|---|---|---|
| 1 OneSignal | ~30 | ~2 | -93 % |
| 2 Identité | ~80 | ~10 | -88 % |
| 3 Notifs/messages | ~120 | ~12 | -90 % |
| 4 Poll permission | 1 800 (JS) | 0 | -100 % |
| 5 Maintenance | 60 | 12 | -80 % |

Total estimé : **>80 % de requêtes en moins** sur une session ouverte 1 h.

Souhaitez-vous que j'implémente les étapes 1, 4 et 5 en premier (faible risque, gain immédiat) avant de traiter les étapes 2 et 3 ?