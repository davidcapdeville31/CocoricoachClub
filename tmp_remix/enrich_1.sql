-- ============================================
-- DESCRIPTIONS BIOMÉCANIQUES DÉTAILLÉES
-- Partie 1: Musculation - Exercices principaux
-- ============================================

-- BACK SQUAT
UPDATE exercise_library SET 
  general_description = 'Exercice fondamental de développement de la force des membres inférieurs. Sollicite principalement les quadriceps, fessiers, ischio-jambiers et érecteurs du rachis. Mouvement fonctionnel essentiel pour la performance athlétique et la vie quotidienne.',
  positioning_criteria = '{
    "body_placement": "Debout sous la barre, pieds légèrement plus larges que la largeur du bassin, pointes de pieds orientées vers l''extérieur (15-30°)",
    "feet_position": "Pieds à plat, poids réparti sur l''ensemble du pied avec légère prédominance sur les talons. Écart légèrement supérieur à la largeur des épaules.",
    "hands_grip": "Mains sur la barre légèrement plus larges que les épaules, prise pronation ferme, poignets dans l''alignement des avant-bras",
    "joint_alignment": "Genoux alignés avec les pointes de pieds, colonne vertébrale neutre, regard horizontal",
    "initial_posture": "Barre posée sur les trapèzes supérieurs (high bar) ou sur les deltoïdes postérieurs (low bar), omoplates serrées, cage thoracique ouverte, abdominaux et lombaires gainés"
  }',
  execution_criteria = '{
    "movement_flow": "Initier le mouvement par une flexion simultanée des hanches et des genoux (triple flexion). Descendre de façon contrôlée en maintenant le dos droit. Remonter en poussant le sol avec les pieds, extension complète des hanches et genoux en position haute.",
    "range_of_motion": "Descendre jusqu''à ce que le pli de hanche passe en dessous du niveau des genoux (squat complet/parallèle). Les genoux suivent la direction des pointes de pieds tout au long du mouvement.",
    "speed_control": "Phase excentrique (descente) contrôlée sur 2-3 secondes. Phase concentrique (montée) explosive mais maîtrisée. Pas de rebond en position basse.",
    "breathing": "Inspiration profonde et blocage abdominal (manœuvre de Valsalva) avant la descente. Expiration contrôlée en fin de remontée.",
    "key_points": ["Le poids reste sur les talons tout au long du mouvement", "Les genoux ne doivent pas dépasser excessivement les pointes de pieds", "Le dos reste droit et la poitrine ouverte", "Maintenir le gainage abdominal constant"]
  }',
  safety_prevention = '{
    "common_errors": ["Arrondir le dos en position basse (butt wink)", "Laisser les genoux s''effondrer vers l''intérieur (valgus)", "Décoller les talons du sol", "Descendre trop rapidement sans contrôle", "Pencher excessivement le buste vers l''avant"],
    "risk_zones": ["Région lombaire", "Articulations des genoux", "Articulation coxo-fémorale"],
    "safety_instructions": "Utiliser un rack avec sécurités réglées à la bonne hauteur. Pour les charges lourdes, prévoir un ou deux pareurs. Échauffer progressivement avec des séries légères."
  }'
WHERE exercise_name ILIKE '%back squat%' OR (exercise_name = 'Squat' AND station_name = 'Musculation');

-- FRONT SQUAT
UPDATE exercise_library SET 
  general_description = 'Variante du squat avec la barre en position frontale. Sollicite davantage les quadriceps et le core en raison de la position plus verticale du buste. Excellent pour développer la mobilité thoracique et la force du haut du dos.',
  positioning_criteria = '{
    "body_placement": "Debout face à la barre, pieds largeur des épaules ou légèrement plus large, pointes orientées vers l''extérieur (15-30°)",
    "feet_position": "Pieds à plat, écartement similaire au back squat mais permettant une descente plus verticale",
    "hands_grip": "Position rack frontale: coudes hauts et vers l''avant, barre reposant sur les deltoïdes antérieurs. Prise classique (doigts sous la barre) ou croisée (bras croisés sur la barre)",
    "joint_alignment": "Coudes pointant vers l''avant et maintenus hauts, colonne vertébrale verticale, regard horizontal",
    "initial_posture": "Barre posée sur les deltoïdes antérieurs devant la gorge, coudes hauts créant une tablette pour la barre, thorax ouvert, abdominaux fortement engagés"
  }',
  execution_criteria = '{
    "movement_flow": "Initier la descente en poussant les genoux vers l''avant tout en maintenant les coudes hauts. Le buste reste vertical tout au long du mouvement. Remonter en poussant le sol et en maintenant la position haute des coudes.",
    "range_of_motion": "Descente profonde similaire au back squat, pli de hanche sous les genoux. Le buste reste plus vertical que pour le back squat.",
    "speed_control": "Descente contrôlée sur 2-3 secondes. Remontée explosive en maintenant la position des coudes.",
    "breathing": "Grande inspiration et gainage avant la descente. Expiration en fin de mouvement concentrique.",
    "key_points": ["Coudes hauts tout au long du mouvement", "Buste vertical, ne pas pencher vers l''avant", "Mobilité thoracique et des poignets requise", "Core fortement engagé pour maintenir la position"]
  }',
  safety_prevention = '{
    "common_errors": ["Laisser tomber les coudes (perte de la barre)", "Pencher le buste vers l''avant", "Manque de mobilité des poignets limitant la prise", "Arrondissement du haut du dos"],
    "risk_zones": ["Poignets", "Épaules", "Région thoracique", "Genoux"],
    "safety_instructions": "Travailler la mobilité thoracique et des poignets avant de charger lourd. Utiliser des sangles de levage si la mobilité des poignets est limitée. Toujours squatter dans un rack avec sécurités."
  }'
WHERE exercise_name ILIKE '%front squat%';

-- DEADLIFT / SOULEVÉ DE TERRE
UPDATE exercise_library SET 
  general_description = 'Exercice roi du développement de la chaîne postérieure. Sollicite les érecteurs du rachis, fessiers, ischio-jambiers, trapèzes, avant-bras et core. Mouvement fonctionnel de base reproduisant l''action de soulever un objet du sol.',
  positioning_criteria = '{
    "body_placement": "Debout face à la barre, pieds sous la barre (barre au-dessus du milieu du pied), tibias proches de la barre",
    "feet_position": "Pieds écartés largeur des hanches (stance conventionnel), pointes légèrement vers l''extérieur (10-15°). Poids sur l''ensemble du pied.",
    "hands_grip": "Mains agrippant la barre juste à l''extérieur des genoux. Prise double pronation ou mixte (une main en pronation, une en supination) pour les charges lourdes.",
    "joint_alignment": "Genoux alignés avec les pieds, tibias verticaux ou légèrement inclinés vers l''avant, hanches plus hautes que les genoux en position de départ",
    "initial_posture": "Dos droit et rigide, épaules légèrement en avant de la barre, omoplates engagées (serrer les oranges sous les aisselles), poitrine ouverte, regard vers le sol 2-3m devant soi"
  }',
  execution_criteria = '{
    "movement_flow": "Initier le mouvement en poussant le sol avec les pieds. La barre monte le long des tibias puis des cuisses. Hanches et épaules montent simultanément. Extension complète des hanches et genoux en position haute avec légère rétroversion du bassin. Redescendre en inversant le mouvement.",
    "range_of_motion": "Du sol jusqu''à l''extension complète des hanches. La barre reste en contact avec le corps tout au long du mouvement.",
    "speed_control": "Montée puissante mais contrôlée. Descente maîtrisée, ne pas lâcher la barre. Pause au sol entre chaque répétition (dead stop).",
    "breathing": "Grande inspiration et gainage abdominal maximal avant de tirer. Blocage respiratoire pendant l''effort. Expiration contrôlée en haut du mouvement.",
    "key_points": ["La barre reste proche du corps tout le temps", "Le dos reste droit et rigide, jamais arrondi", "Pousser le sol plutôt que tirer la barre", "Verrouiller les hanches en haut sans hyperextension lombaire"]
  }',
  safety_prevention = '{
    "common_errors": ["Arrondir le bas du dos (flexion lombaire)", "Tirer avec le dos au lieu de pousser avec les jambes", "Barre qui s''éloigne du corps", "Hyperextension lombaire excessive en haut", "Hanches qui montent plus vite que les épaules (stiff leg non voulu)"],
    "risk_zones": ["Région lombaire", "Articulations sacro-iliaques", "Biceps (prise mixte)"],
    "safety_instructions": "Maîtriser parfaitement la technique avant d''augmenter les charges. Utiliser une ceinture de force pour les charges lourdes. Alterner la prise mixte pour éviter les déséquilibres. Ne jamais arrondir le dos, préférer réduire la charge."
  }'
WHERE exercise_name ILIKE '%deadlift%' OR exercise_name ILIKE '%soulevé de terre%';

-- BENCH PRESS / DÉVELOPPÉ COUCHÉ
UPDATE exercise_library SET 
  general_description = 'Exercice fondamental pour le développement de la poitrine, des épaules antérieures et des triceps. Mouvement de poussée horizontale essentiel pour la force du haut du corps.',
  positioning_criteria = '{
    "body_placement": "Allongé sur le banc, tête, épaules et fessiers en contact avec le banc. Pieds à plat au sol ou sur le banc selon la configuration.",
    "feet_position": "Pieds fermement ancrés au sol, légèrement en arrière des genoux pour créer un arc dans le bas du dos. Position stable et symétrique.",
    "hands_grip": "Mains sur la barre légèrement plus larges que la largeur des épaules (1.5x largeur d''épaules environ). Prise pronation, poignets droits dans l''alignement des avant-bras. Pouces enroulés autour de la barre.",
    "joint_alignment": "Épaules en rétraction et abaissées (shoulder blades squeezed), coudes formant un angle de 45-75° avec le torse",
    "initial_posture": "Omoplates serrées et enfoncées dans le banc (rétraction scapulaire), légère cambrure naturelle du bas du dos (sans décoller les fessiers), poitrine bombée vers le haut"
  }',
  execution_criteria = '{
    "movement_flow": "Décrocher la barre et la stabiliser bras tendus au-dessus de la poitrine. Descendre la barre de façon contrôlée vers le bas des pectoraux (ligne des mamelons). Effleurer la poitrine puis pousser de façon explosive en ramenant la barre vers les yeux.",
    "range_of_motion": "La barre touche la poitrine (sauf limitation de mobilité). Extension complète des coudes en position haute sans verrouillage brutal.",
    "speed_control": "Descente contrôlée sur 2-3 secondes. Contact léger avec la poitrine (pas de rebond). Poussée explosive mais maîtrisée.",
    "breathing": "Inspiration pendant la descente. Blocage en bas et expiration pendant ou après la poussée.",
    "key_points": ["Omoplates serrées et stables tout le mouvement", "Trajectoire légèrement diagonale (poitrine vers yeux)", "Coudes à 45-75°, pas complètement écartés", "Poignets droits, pas cassés en arrière", "Fessiers en contact avec le banc"]
  }',
  safety_prevention = '{
    "common_errors": ["Rebondir la barre sur la poitrine", "Décoller les fessiers du banc", "Coudes trop écartés (90°)", "Poignets cassés en arrière", "Perdre la rétraction scapulaire", "Trajectoire verticale au lieu de diagonale"],
    "risk_zones": ["Articulation de l''épaule", "Poignets", "Région lombaire si mauvaise position"],
    "safety_instructions": "Toujours utiliser un pareur pour les séries lourdes ou s''entraîner dans un rack avec sécurités. Ne jamais utiliser de grip suicide (pouce du même côté que les doigts). Échauffer progressivement les épaules."
  }'
WHERE exercise_name ILIKE '%bench press%' OR exercise_name ILIKE '%développé couché%';

-- OVERHEAD PRESS / DÉVELOPPÉ MILITAIRE
UPDATE exercise_library SET 
  general_description = 'Exercice de poussée verticale développant les épaules, triceps et muscles stabilisateurs du tronc. Mouvement fonctionnel reproduisant l''action de pousser une charge au-dessus de la tête.',
  positioning_criteria = '{
    "body_placement": "Debout, pieds écartés largeur des hanches, corps parfaitement vertical et gainé",
    "feet_position": "Pieds parallèles ou très légèrement orientés vers l''extérieur, poids réparti sur l''ensemble du pied, talons au sol",
    "hands_grip": "Mains sur la barre légèrement plus larges que les épaules. Prise pronation, poignets droits. Avant-bras verticaux en position basse.",
    "joint_alignment": "Coudes sous les poignets et légèrement en avant de la barre en position de départ, colonne neutre",
    "initial_posture": "Barre reposant sur les deltoïdes antérieurs et clavicules (position rack). Omoplates engagées, abdominaux et fessiers contractés, regard droit devant."
  }',
  execution_criteria = '{
    "movement_flow": "Initier en reculant légèrement la tête pour laisser passer la barre. Pousser verticalement en rapprochant la barre du visage. Une fois la barre passée le front, avancer la tête et terminer le mouvement bras tendus au-dessus et légèrement en arrière de la tête. Redescendre en inversant le mouvement.",
    "range_of_motion": "De la position rack (clavicules) jusqu''à l''extension complète des bras au-dessus de la tête, barre légèrement en arrière du plan des oreilles.",
    "speed_control": "Poussée puissante et contrôlée. Descente maîtrisée. Pause en position rack entre les répétitions.",
    "breathing": "Inspiration et gainage en position rack. Blocage pendant la poussée. Expiration en haut ou pendant la descente.",
    "key_points": ["La barre monte en ligne droite proche du visage", "Finir avec la barre au-dessus/légèrement en arrière de la tête", "Fessiers et abdos contractés pour protéger le dos", "Ne pas cambrer excessivement le bas du dos", "Verrouiller les coudes en haut"]
  }',
  safety_prevention = '{
    "common_errors": ["Cambrer excessivement le bas du dos", "Pousser la barre vers l''avant au lieu de verticalement", "Relâcher les fessiers et abdominaux", "Finir avec la barre trop en avant de la tête"],
    "risk_zones": ["Épaules", "Région lombaire", "Poignets"],
    "safety_instructions": "Maintenir un gainage constant du core. Ne pas utiliser de charges excessives au détriment de la technique. S''échauffer les épaules avec des mouvements de rotation et d''élévation."
  }'
WHERE exercise_name ILIKE '%overhead press%' OR exercise_name ILIKE '%développé militaire%' OR exercise_name ILIKE '%press%' AND station_name = 'Musculation';