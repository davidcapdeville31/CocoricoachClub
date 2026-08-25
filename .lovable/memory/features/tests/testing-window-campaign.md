---
name: Testing Window (fenêtre de passage)
description: Période optionnelle sur une séance de test limitant chaque athlète à un seul résultat par test sur toute la fenêtre
type: feature
---

Lors de la planification d'un test (catalogue Tests ou calendrier global), le staff peut définir une **fenêtre de passage** (date début / date fin), stockée dans les notes de séance via `<!--TESTWINDOW:{"start":"YYYY-MM-DD","end":"YYYY-MM-DD"}-->` (helpers `buildTestWindowMeta` / `parseTestWindowFromNotes` dans `src/lib/utils/sessionNotes.ts`, strippé par `getDisplayNotes`).

Côté espace athlète (`AthleteTestResultsInput`) : si une fenêtre existe, les résultats (`pending_test_results` + `generic_tests`) sont cherchés par `test_date` dans la période — toutes séances confondues. Un résultat déjà présent (hors statut `rejected`) verrouille la saisie du test pour toute la fenêtre et affiche la date de saisie. Sans fenêtre : comportement historique (par séance).

Cumulable avec le verrou de présence (athlète absente = saisie RPE/tests bloquée).
Valable pour toutes les disciplines.
