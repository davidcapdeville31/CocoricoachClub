## Refonte "Liste adversaires" Judo — Système de scouting haut niveau

Objectif : transformer l'onglet actuel en véritable plateforme d'analyse tactique adverse niveau IJF/INSEP.

### Architecture en 3 niveaux

```
JudoOpponentsTab (liste + recherche + filtres + comparaison)
  └─ OpponentScoutingSheet (fiche complète plein écran)
       └─ 8 sections accordéon + onglet vidéo + onglet plan IA
```

### Modèle de données (migration)

Étendre `opponent_profiles` avec colonnes JSONB structurées (scalable, sans exploser le schéma) :

- `general_profile` jsonb — style global, intensité, rythme, mental, gestion score, danger_level (1-5), tactical_difficulty, analysis_confidence
- `kumikata_profile` jsonb — main forte, styles de garde (multi), objectifs, domination (slider), comportement, zones favorites (heatmap data)
- `tokui_waza` jsonb[] — array de techniques `{name, category, danger, frequency, success_rate, direction, trigger, ground_transition, score_avg, is_favorite, is_surprise, tags}`
- `attack_systems` jsonb — enchaînements, directions dominantes, timings, distances, phases dangereuses
- `newaza_profile` jsonb — répartition (0-100), styles, comportement, sorties, danger
- `tactical_profile` jsonb — shidos fréquents, arbitrage, réactions, gestion fin de combat
- `physical_profile` jsonb — type, posture, déplacements, cardio, puissance (slider), explosivité (slider)
- `tactical_plan` jsonb — généré IA : points forts, faiblesses, danger principal, plan A/B, checklist
- `video_sequences` jsonb[] — `{url, timestamp_start, timestamp_end, technique, tag, note, score}`

Bucket storage : réutiliser `opponent-photos` + nouveau `opponent-videos` (privé, max 200 MB par fichier, RLS club_id).

Tables historisation :
- `opponent_analysis_history` (snapshots datés du profil pour suivre l'évolution)
- `opponent_match_history` (résultats vs nos athlètes, déjà partiellement via `competition_rounds`)

### Composants UI à créer

```
src/components/category/judo/scouting/
  OpponentScoutingSheet.tsx        — Dialog plein écran, header sticky, navigation sections
  sections/
    GeneralProfileSection.tsx      — chips + sliders + étoiles danger
    KumikataSection.tsx            — silhouette SVG zones cliquables + chips
    TokuiWazaSection.tsx           — table éditable + radar + top 3 + ajout technique
    AttackSystemsSection.tsx       — enchaînements (flèches), timings, phases
    NewazaSection.tsx              — slider debout/sol + styles + danger
    TacticalSection.tsx            — shidos, arbitrage, réactions
    PhysicalSection.tsx            — radar physique + sliders
    TacticalPlanSection.tsx        — généré via Lovable AI (Gemini 2.5 flash), édition manuelle
    VideoAnalysisSection.tsx       — upload + player + timeline tags
  widgets/
    DangerStars.tsx                — 1-5 étoiles colorées
    ChipMultiSelect.tsx            — chips multi-sélection
    SliderWithLabels.tsx           — slider gradué avec labels
    GripHeatmapSilhouette.tsx      — SVG judoka cliquable
    TechniqueRadar.tsx             — Recharts radar
    EnchainementFlow.tsx           — flèches technique → technique
    VideoTimeline.tsx              — barre temporelle avec marqueurs
    OpponentComparePanel.tsx       — 2 ou 3 adversaires côte à côte
  OpponentScoutingList.tsx         — refonte de l'onglet (cartes premium + filtres avancés)
  hooks/useOpponentScouting.ts     — fetch/update profil complet + autosave debounced
```

### Refonte `JudoOpponentsTab`

- Header : compteur, filtres avancés (sexe, poids, latéralité, danger, style global, technique), recherche full-text.
- Toggle vue : **Cartes scouting premium** (photo + drapeau + étoiles danger + top 3 techniques + style global badges) / **Tableau dense**.
- Bouton "Comparer" (sélection multi 2-3 adversaires → panneau comparaison).
- Bouton "Export PDF" (rapport coach par adversaire).
- Au clic carte → ouvre `OpponentScoutingSheet` (Dialog full-screen).

### Système couleurs (tokens semantic)

Ajout dans `index.css` :
```
--danger-judo: 0 75% 55%        /* rouge */
--control-judo: 220 70% 55%     /* bleu */
--opportunism-judo: 28 90% 55%  /* orange */
--newaza-judo: 270 65% 55%      /* violet */
--physical-judo: 145 60% 45%    /* vert */
```

### Plan tactique IA

Edge function `generate-opponent-plan` :
- Input : opponent_id
- Lit le profil complet + historique matchs vs nos athlètes
- Appelle Lovable AI Gateway `google/gemini-2.5-flash`
- Prompt structuré → renvoie `{strengths[], weaknesses[], main_danger, plan_a, plan_b, checklist[], score_strategy}`
- Sauvegarde dans `tactical_plan` avec `generated_at`, éditable manuellement par coach.

### Analyse vidéo

- Upload vers bucket `opponent-videos` (max 200 MB, formats mp4/mov/webm).
- Possibilité d'ajouter aussi URL externe (YouTube/Vimeo).
- Player HTML5 + overlay timeline.
- Tagging : pause vidéo → bouton "Ajouter tag" → modal (technique, tag tactique, note, score).
- Liste clips en sidebar, clic → seek timestamp.
- Export "highlights" = playlist séquentielle des clips marqués favoris.

### UX/Performance

- Autosave debounced 800 ms par section (mutation isolée par bloc JSONB).
- Indicateur "Enregistré" / "Synchro…" en haut.
- Sections accordéon avec mémorisation état (localStorage).
- Mobile : sections empilées plein écran, swipe entre sections.
- Mode "Compétition rapide" : affiche uniquement Plan tactique + Top 3 tokui + Kumikata + Danger principal.

### Sécurité RLS

Réutiliser le pattern existant (`club_id` + membres authentifiés du club). Vidéos : signed URLs avec expiration 1h.

### Sprint suggéré (livraison en 2 phases)

**Phase 1 (cette PR)** :
1. Migration : extension `opponent_profiles` + bucket vidéo + tables historique.
2. `OpponentScoutingSheet` + sections 1, 2, 3, 5, 6, 7 (Profil, Kumikata, Tokui-waza, Ne-waza, Tactique, Physique).
3. Refonte `JudoOpponentsTab` (cartes premium + filtres avancés).
4. Tokens couleurs design system.

**Phase 2 (PR suivante, sur ton ok après phase 1)** :
5. Section 4 (enchaînements avec arbre/flèches).
6. Section 8 + edge function Plan tactique IA.
7. Analyse vidéo (upload + tagging + timeline).
8. Comparateur d'adversaires + export PDF.

### Risques / points à valider avec toi

- **Scope** : c'est ~3 000 lignes de code, la phase 1 seule représente déjà ~1 500 lignes. Je propose vraiment de découper en 2 livraisons pour rester maintenable et te laisser valider l'UX au fur et à mesure.
- **Conservation existant** : les colonnes actuelles (`combat_profile`, `style_mask`, `ground_standing_pref`) restent et seront synchronisées avec les nouveaux JSONB pour ne pas casser la "gestion des combats" qui auto-remplit depuis l'adversaire.
- **Génération IA** : utilise Lovable AI Gateway (Gemini 2.5 flash) — aucune clé API à fournir.