
# Filtre saison active + clôture/bilan de saison

## Règles validées (à appliquer partout)
- **Roster** : exclure les joueurs `season_id = null` ET ceux d'autres saisons. Seul `season_id = activeSeasonId` passe.
- **EWMA/AWCR** : calcul sur historique 28j glissants (fetch large), affichage filtré à `[start_date, end_date]`.
- **Blessures actives** et **records/PB absolus** : restent visibles hors fenêtre. Tous les autres modules santé/académie filtrent dates + roster strictement.


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
