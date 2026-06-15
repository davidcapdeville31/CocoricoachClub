
# Filtre saison active — état d'avancement

## Règles validées (rappel)
- **Roster** : exclure les joueurs `season_id ≠ activeSeasonId` (incluant `season_id = null`).
- **EWMA/AWCR** : calcul sur historique 28j/90j glissants (fetch large), affichage filtré à `[start_date, end_date]`.
- **Blessures actives** et **records/PB absolus** : restent visibles hors fenêtre. Autres modules santé/académie filtrent dates + roster.

## ✅ Implémenté
- `SeasonRosterFilterProvider` monté sur `CategoryDetails`.
- Toggle visible sur : Datas, Workload (PerformanceTab), Planification, Académie (AcademicTab + AcademyTab), Santé, Admin, Calendar, AWCR, Decision Center.
- **Hooks partagés saison-aware** (propagent automatiquement à tous les consommateurs) :
  - `useTrainingLoad` (mode joueur + équipe) : awcrData, hrvData, gpsData filtrés par
    `allowedIds` + `isDateInActiveSeason`, scopeKey ajouté au queryKey pour invalider le cache
    quand le toggle change. Fenêtre 28/90j glissante conservée pour la précision EWMA.
  - `useCategoryMatches`, `useCategoryPlayers` (analytics équipe) : filtrés roster + dates,
    scopeKey dans queryKey.
  - `useSeasonFilteredPlayerIds` : enabled uniquement si toggle ON (clé varie naturellement).
- **Filtres dates + roster appliqués directement** :
  - `CalendarTab` (sessions, matches, weekly planning)
  - `AwcrTab` (rows filtrés par allowedIds + isDateInActiveSeason)
  - `AcademicTab` (players, grades, absences)
  - `AcademyTab` (players selector, academicData)
  - `InjuriesTab` (raw injuries via keepPlayer)
  - `DecisionCenter` :
    - `players` → filtré (cascade sur GroupStatus, alertes, dialogs)
    - `injuries`, `illnesses` → keepPlayer
    - `awcrDataFull` → keepPlayer (90j glissant conservé pour EWMA)
    - `wellnessData` → keepPlayer + isDateInActiveSeason
    - `todaySessions`, `tomorrowSessions` → vidés si hors fenêtre
    - `todayAttendance`, `todaySessionParticipants`, `todayRpeData` → keepPlayer + dates
    - `expiredDocs`, `upcomingMatches` → keepPlayer + dates
- **Mutations gardées par `useSeasonGuard(categoryId)`** (`src/hooks/use-season-guard.ts`) :
  - `assertPlayer(id)` / `assertPlayers([])` / `assertDate(date)` rejettent avec toast.
  - Appliqué sur `AcademyTab` (addAcademicGrade, updateAcademicGrade, addAbsence).
  - Pattern réutilisable pour toutes les autres mutations.
- **Cache React Query** : les requêtes critiques ont un `scopeKey` dérivé de
  `activeSeasonOnly + activeSeasonEnd` dans leur queryKey → bascule = invalidation auto.
  Pour les filtres post-fetch via `useMemo`, la même cache est partagée mais le rendu
  est recalculé instantanément quand le toggle change.

## 🔧 Reste à faire (passes ciblées)
- **Datas children** : appliquer `useSeasonFilteredPlayerIds` + `isDateInActiveSeason` dans
  `PlayerCumulativeStats` (3018 lignes — gros chantier), `BowlingCumulativeStats`,
  `TennisTrainingStats`, `BasketballPrecisionTracker`, `PrecisionFieldTracker`,
  `PrecisionTrainingStats`, `AthleticsThrowingStats`, `AthleticsSprintStats`
  (la plupart ont déjà l'import — vérifier qu'ils appliquent le filtre dans **toutes**
  les requêtes/aggregations + ajouter scopeKey dans queryKey).
  `TeamSportsAnalytics` bénéficie déjà via les hooks partagés ; vérifier les onglets
  enfants (`GeneralTab`, `CompareTab`, `PlayerStatsTab`, `HistoryTab`) pour les fetches
  directs hors hooks partagés.
- **Workload children** : `TrainingLoadTab` et ses sous-composants (`TrainingLoadKPIs`,
  `TrainingLoadChart`, `TrainingLoadCalendar`, `RpePlanVsActual`, `TeamLoadComparison`,
  `HrvAnalysisPanel`, `TrainingLoadAlerts`, `TrainingDistribution`) sont alimentés par
  `useTrainingLoad` → déjà filtrés. Vérifier qu'aucun fetch parallèle ne contourne.
  `AvailabilityScoreTab`, `InjuryRiskPrediction`, `TonnageDashboard`,
  `PerformanceEvolution`, `PendingWeightLogsValidation`, `PendingTestResultsValidation` :
  ajouter filtres roster + dates + garde-fou mutations.
- **Planification / Ski + Athlétisme** : `FisRankingTab`, `AthleticsRecordsTab` →
  filtrer joueurs ; records absolus (PB) restent visibles, SB de la saison se contente du roster.
- **Santé children** : `CoachDashboard`, `MedicalRecordsTab`, `WellnessTab`,
  `ActiveProtocolsDashboard`, `ConcussionProtocolTab`, `InjuryStatsPanel`,
  `WellnessPainStats`, `InjuryRiskAssessment` → vérifier filtres roster+dates
  (sauf blessures actives → toujours visibles). Ajouter `useSeasonGuard` sur dialogs
  d'ajout blessure / maladie / wellness / record / test.
- **Admin** : `RecruitmentPipeline`, `MatchSheets`, `ConvocationsList`,
  documents personnels → filtrer joueurs + dates (les prospects de recrutement
  n'ont pas de season_id, garder visibles).
- **Académie / Stats** : `AcademicStatsSection` → consommer roster+dates filtrés.
- **Sélecteurs joueurs partagés** : `PlayerSelection`, `PlayerSelector`,
  `AthleteSelector`, `MultiPlayerCheckbox` → lire le contexte saison directement
  ou ajouter prop `respectSeasonFilter` (défaut `true`). Notification visuelle quand
  un joueur préalablement sélectionné devient inéligible.
- **Garde-fous mutations restants** : appliquer `useSeasonGuard` sur tous les
  dialogs d'ajout/modification (session, RPE, wellness, blessure, record, test,
  compétition, document, convocation, recrutement, GPS objective).
- **Compteurs / badges** (`usePendingWeightLogsCount`, `usePendingTestResultsCount`,
  `useUnreadAthleteSessionsCount`, `useUnreadMessages`) → variante saison-aware si besoin.



## Clôture / Export bilan saison (lot dédié, non démarré)
Voir spécification précédente du plan — à implémenter dans `SeasonsManager`
(bouton "Clôturer & exporter bilan", PDF jspdf + Excel exceljs, log audit).




Objectif : quand le toggle **« Saison active uniquement »** est ON, tous les dashboards collectifs (Datas, Workload, Planification, Académie, Admin) ne montrent que les athlètes de la saison active **et** uniquement les données entre `start_date` et `end_date`. Les profils athlètes gardent leur historique complet. Ajout d'une action **Clôturer / Exporter bilan** dans Admin club › Saisons.

---

## 1. Datas — corriger le filtre actuel

Le toggle existe déjà (`SeasonRosterFilterToggle` dans `DatasTab.tsx`) mais les composants enfants ignorent `useSeasonFilteredPlayerIds` + la fenêtre de dates.

À patcher pour filtrer **et** par roster **et** par dates :
- `PlayerCumulativeStats`, `TeamSportsAnalytics`
- `BowlingCumulativeStats`, `BowlingTrainingStats`
- `TennisTrainingStats`, `BasketballPrecisionTracker`
- `PrecisionFieldTracker`, `PrecisionTrainingStats`
- `AthleticsThrowingStats`, `AthleticsSprintStats`

Pattern unique appliqué à chaque hook de fetch :
- intersecter `playerId` avec `allowedIds` (via `useSeasonFilteredPlayerIds`)
- filtrer la requête `match_date / session_date / created_at` avec `isDateInActiveSeason` (ou clause `.gte/.lte` côté Supabase quand possible)

## 2. Workload — ajouter le toggle + filtre

- Monter `<SeasonRosterFilterToggle />` en haut de `WorkloadTab` (alignement droite identique à Datas).
- S'assurer que le `SeasonRosterFilterProvider` enveloppe déjà la page catégorie (sinon l'ajouter au layout).
- Appliquer `useSeasonFilteredPlayerIds` + `isDateInActiveSeason` sur tous les hooks workload (RPE, EWMA/ACWR, tonnage, GPS, charts collectifs).

## 3. Planification — masquer hors fenêtre

- Ajouter `<SeasonRosterFilterToggle />` dans `PlanificationTab`.
- Dans `CalendarTab` : filtrer sessions, compétitions, événements via `isDateInActiveSeason(event.start)` quand ON.
- Filtrer aussi le roster des sélecteurs d'athlètes (`allowedIds`).
- Pour Ski (FIS/WSPL) et Athlétisme (records) : appliquer la fenêtre de dates et le roster aux requêtes correspondantes.

## 4. Académie — ajouter le filtre

- Ajouter `<SeasonRosterFilterToggle />` dans `AcademyTab`.
- Filtrer notes, absences, retards, moyennes par `allowedIds` + `isDateInActiveSeason(date)`.

## 5. Admin (Administratif) — ajouter le filtre

- Ajouter `<SeasonRosterFilterToggle />` dans `AdministratifTab`.
- Filtrer pipeline recrutement, documents personnels, feuilles de match, etc. par roster + dates de saison.

## 6. Clôture / Export bilan saison (Admin club › Saisons)

Dans `SeasonsManager` (ou équivalent) :
- Ajouter un bouton **« Clôturer & exporter bilan »** par saison.
- Modal de confirmation listant ce qui sera inclus.
- Génération **PDF complet** (jspdf + autoTable, comme les exports existants) :
  - Page de garde : club, saison, dates, effectif
  - Section globale effectif : RPE moyen, charge cumulée, blessures, dispo, présences
  - Une section par athlète : identité, présences, charge (EWMA/ACWR), tests/PB, tonnage, blessures, compétitions
- Génération **Excel multi-onglets** (`exceljs` + helpers `excelExport.ts`) :
  - Onglets : Résumé, Effectif, RPE/Wellness, Tests, Tonnage, Compétitions, Blessures, Présences, Académie
- **Aucune suppression** de données : la clôture met seulement `is_active=false` sur la saison (déjà géré) + log un événement `season_closed` dans `audit_events` avec lien vers le PDF.
- Conserver les historiques individuels intacts (déjà le cas — pas de cascade delete).

## 7. Historiques athlètes — vérification

Le filtre saison ne doit jamais s'appliquer dans **`PlayerProfile`** et ses sous-onglets (blessures, programmation, tests, biométrie, etc.). Le `SeasonRosterFilterProvider` n'est pas monté sur ces routes — confirmer et ajouter un commentaire de garde si besoin.

---

## Détails techniques

- `SeasonRosterFilterContext` expose déjà `isDateInActiveSeason()` et `matches()` → réutilisés partout.
- `useSeasonFilteredPlayerIds(categoryId)` renvoie `allowedIds: Set<string> | null`. Pattern d'usage côté hook :
  ```ts
  const { allowedIds } = useSeasonFilteredPlayerIds(categoryId);
  const filtered = useMemo(
    () => rows.filter(r => (!allowedIds || allowedIds.has(r.player_id)) && isDateInActiveSeason(r.date)),
    [rows, allowedIds, isDateInActiveSeason],
  );
  ```
- Pour les requêtes Supabase volumineuses, préférer un filtre **côté SQL** avec `.gte('date', activeSeasonStart).lte('date', activeSeasonEnd)` quand le toggle est ON, sinon pas de clause.
- Export PDF/Excel : nouveau module `src/lib/seasonReport/` avec `buildSeasonPdf.ts` et `buildSeasonXlsx.ts`, branché depuis le bouton dans `SeasonsManager`.

---

## Périmètre exclu (ne change pas)

- Profils athlètes individuels : aucun filtre saison appliqué.
- Datas spécifiques par sport (sauf branchement du filtre) : pas de refonte métier.
- Clôture : `is_active` reste géré comme aujourd'hui, on ajoute juste l'export + un événement d'audit.

Confirme-moi ce plan (ou indique les parties à élaguer / prioriser) et je l'implémente.

## Phase 3 — useSeasonGuard on write dialogs (done)
- Santé: AddInjuryDialog, EditInjuryDialog, AddIllnessDialog, EditIllnessDialog, AddWellnessDialog
- Séances/RPE/Présences/Feedback: AddSessionDialog, EditSessionDialog, SessionAttendanceDialog, PostSessionRpeDialog, QuickRpeEntryDialog, QuickTeamRpeDialog, MatchRpeDialog, SessionFeedbackDialog
- Tests: AddStrengthTestDialog, UnifiedTestDialog, ScheduleTestDialog, ScheduleBatteryDialog, QuickTestEntryDialog
- Compétitions: AddTournamentDialog, EditMatchDialog, AddMultipleCompetitionsDialog, AddFisResultDialog
- Admin: ConvocationsSection, DocumentsSection

Pattern: assertPlayer/assertPlayers/assertDate throw guard:* sentinels that onError ignores (toast already shown by guard).
