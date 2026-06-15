---
name: Active Season Filter Rules
description: Règles précises du toggle "Saison active uniquement" pour roster, dates, EWMA, et exceptions
type: feature
---

Quand le toggle **« Saison active uniquement »** est ON :

## Roster
- Seuls les joueurs avec `players.season_id = activeSeasonId` sont visibles.
- Les joueurs avec `season_id = null` (anciens non migrés) sont **exclus**.

## Dates
- Tous les modules (Datas, Workload, Planification, Académie, Administratif) filtrent les données entre `start_date` et `end_date` de la saison active.

## Exception EWMA / AWCR / Charge chronique (Workload)
- Le **calcul** EWMA/AWCR utilise 28 jours glissants avant la date affichée (historique complet nécessaire pour la précision).
- L'**affichage** ne montre que les points dans la fenêtre `[start_date, end_date]` de la saison active.
- Pattern : fetch des données jusqu'à `end_date`, calcul EWMA sur la série complète, puis filtre des points affichés à `>= start_date`.

## Exception Blessures et Records actifs
- **Blessures en cours** (status actif, pas de `recovery_date`) : restent visibles même hors fenêtre de saison (sécurité médicale).
- **Records absolus / PB** (`athletics_records`, benchmarks) : restent visibles hors fenêtre (référence de performance).
- Tous les autres modules santé/académie (Wellness, notes, absences, minimas par saison) filtrent dates + roster strictement.
