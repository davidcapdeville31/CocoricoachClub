## Contexte

Sur M14, le benchmark "Squat - 1RM" a été créé avec `test_type = squat_1rm` (preset) et un ratio 1x/1.5x/2x/2.5x PDC. Mais le résultat saisi a été enregistré sous `test_type = custom:fcf7...b1368` (test personnalisé « Squat 3RM »). Les deux ne se rencontrent jamais → aucun affichage.

De plus, l'écran de gestion/comparaison des barèmes (`BenchmarkManager` + `BenchmarkComparison`) existe dans le code mais **n'est monté nulle part** dans l'app. Il est inaccessible aujourd'hui.

## Ce que je vais faire

### 1. Matching benchmark ↔ test (les deux options)

**a) Sélecteur direct des tests personnalisés** dans l'éditeur de benchmark (`BenchmarkManager`)  
Sous chaque catégorie de test, ajouter en fin de liste les tests personnalisés de la catégorie (source : table `custom_tests`), affichés comme `⭐ Nom (personnalisé)` avec la valeur `custom:<uuid>`. Auto-remplit l'unité.

**b) Fallback par nom** dans `BenchmarkComparison`  
Si `benchmark.test_type` ne matche aucun résultat, tenter un match par nom :  
– Si le benchmark cible un preset (`squat_1rm`) → chercher un `custom_tests.name` équivalent (normalisation : minuscules, retrait des espaces/tirets, ex : « squat 3rm » ≈ « squat_3rm »).  
– Si le benchmark cible `custom:<uuid>` → match direct.

**c) Fix bug ratio PDC**  
Aujourd'hui `use_body_weight_ratio = true` sans `body_weight_multiplier` n'applique **rien** (ratios stockés dans les seuils sont ignorés). Corriger : quand les seuils sont déjà des ratios (< 10), les multiplier par le poids de l'athlète.

### 2. Rendre l'écran barèmes accessible

Ajouter `BenchmarkTab` dans l'onglet Tests de la catégorie (module transversal, dispo pour toutes disciplines) — sous-onglet « Barèmes ». On y trouve le `BenchmarkManager` (créer/éditer) + `BenchmarkComparison` (vue globale effectif × barèmes).

### 3. Vue globale d'effectif

`BenchmarkComparison` est déjà quasi-complète (tableau joueurs × barèmes avec badge coloré du niveau). Je :
- l'améliore avec le matching custom (point 1),
- ajoute filtre par poste pour ne montrer que les benchmarks pertinents,
- affiche le poids de corps pris pour le calcul quand un ratio PDC est utilisé.

### 4. Vue athlète (espace athlète)

Dans l'espace athlète → Performance → Tests, ajouter un panneau « Ton niveau » qui, pour chaque test réalisé, affiche :
- la valeur perso, l'évolution (déjà présent),
- **le badge du niveau atteint** vis-à-vis du meilleur barème matchant son poste (via `useSuggestedBenchmarks` + logique de niveau de `BenchmarkComparison`),
- le prochain palier à atteindre.

### 5. Barèmes par poste

Déjà supporté (`filter_type=position`, `filter_value=pilier|…`). Aucun changement structurel. Je m'assure que l'éditeur permet bien de dupliquer un barème pour créer une variante par poste (bouton « Dupliquer pour un autre poste » dans `BenchmarkManager`).

## Détails techniques

Fichiers touchés :
- `src/components/category/benchmarks/BenchmarkManager.tsx` — ajout options custom_tests dans le Select "Test", bouton dupliquer.
- `src/components/category/benchmarks/BenchmarkComparison.tsx` — matching custom, fallback par nom, fix ratio PDC, filtre poste.
- `src/hooks/useSuggestedBenchmarks.ts` — même logique de matching custom pour `getBestBenchmarkFor`.
- Nouveau `src/lib/benchmarks/matchTestType.ts` — helper partagé (normalisation, résolution custom↔preset).
- Nouveau `src/lib/benchmarks/computeLevel.ts` — logique de niveau extraite (utilisée par comparison + espace athlète).
- Montage de `BenchmarkTab` dans l'onglet Tests de la catégorie (sous-onglet « Barèmes »).
- Espace athlète Tests : nouvelle carte « Ton niveau vs barème » utilisant `useSuggestedBenchmarks` + `computeLevel`.

Aucune migration DB nécessaire (la structure `benchmarks` couvre déjà tous les besoins).

## Résultat attendu

- Le Squat 3RM saisi (50 kg) apparaîtra bien dans la vue globale avec son badge (par ex. « Excellent » car 50/poids ≥ ratio élite).
- Vue effectif accessible depuis Catégorie → Tests → Barèmes, filtrable par poste.
- Athlète voit son niveau perso et son prochain palier.
- Chaque poste peut avoir son propre barème avec ratios différents.