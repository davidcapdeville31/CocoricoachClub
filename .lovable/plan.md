## Wellness personnalisable par catégorie

### Objectif
Renommer la carte « Personnaliser Wellness » en **Fréquence du Wellness** et y ajouter un **éditeur de questions** par catégorie (questions par défaut pré-remplies, ajout/suppression possible, libellés et couleurs des 5 niveaux personnalisables — comme un barème de test).

### UX (Staff — Santé › Wellness)
Bloc unique « **Fréquence du Wellness** » contenant :
1. **Fréquence** (existant) — jours de la semaine où le wellness est demandé.
2. **Questions du Wellness** (nouveau) :
   - Liste des questions par défaut pré-cochées : Qualité du sommeil, Heures de sommeil, Fatigue générale, Stress, Douleurs haut/bas du corps.
   - Toggle « activée / désactivée » par question standard.
   - Bouton **+ Ajouter une question** (libellé libre, type « échelle 1-5 »).
   - Pour chaque question : édition inline du **libellé**, de **l'emoji**, et des 5 niveaux (label + couleur) — UI identique à la création d'un barème de test (palette `status-optimal → status-critical` + couleur libre).
   - Bouton « Réinitialiser par défaut » par question.
3. **Enregistrement** : sauvegarde immédiate, applique uniquement à la catégorie courante.

### Données (nouvelle table)
`wellness_question_configs` (1 ligne par catégorie)
- `category_id` (FK unique)
- `questions` (jsonb) — tableau ordonné :
  ```json
  [{
    "key": "sleep_quality",        // standard ou "custom_xxx"
    "label": "Qualité du sommeil",
    "emoji": "😴",
    "enabled": true,
    "inverted": false,
    "is_custom": false,
    "scale": [
      { "value": 1, "label": "Très mal", "color": "hsl(...)" },
      ... 5 niveaux
    ]
  }]
  ```

Les **réponses aux questions standards** restent stockées dans les colonnes existantes de `wellness_tracking` (sleep_quality, general_fatigue, …) → aucun impact sur les calculs (EWMA, recovery, alerts, history).
Les **réponses aux questions custom** sont stockées dans une nouvelle colonne `wellness_tracking.custom_answers` (jsonb : `{ "custom_xxx": 3, … }`).

### Composants
- **Renommer** : ajuster le titre de `WellnessScheduleConfig.tsx` → « Fréquence du Wellness ».
- **Nouveau** : `WellnessQuestionsEditor.tsx` (intégré dans la même carte sous la grille des jours).
- **Hook** : `useWellnessConfig(categoryId)` → retourne la liste effective de questions (config sauvegardée OU défauts).
- **Refactor (léger)** :
  - `AddWellnessDialog.tsx` (staff) : rendre les questions à partir du hook, filtrer celles désactivées, afficher les questions custom.
  - `AthleteSpaceWellness.tsx` : idem côté espace athlète.
  - `AthleteSpaceWellnessHistory.tsx` & vues d'historique : afficher les colonnes activées + custom dans le détail (les graphiques agrégés conservent les indicateurs standards).

### Comportement
- Si aucune config n'existe pour la catégorie → barème **par défaut** (questions actuelles).
- Sauvegarde = devient le nouveau défaut **pour cette catégorie uniquement**.
- Les autres catégories restent inchangées.
- Les questions désactivées ne sont plus demandées mais les historiques restent visibles.

### Hors scope (pas touché)
- Les calculs (EWMA, recovery score, alerts, traffic light) restent basés sur les 5 champs standards.
- Pas de migration des données existantes.
- Les graphiques agrégés continuent d'utiliser les indicateurs standards.