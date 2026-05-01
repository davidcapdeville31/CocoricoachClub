-- ============================================
-- DESCRIPTIONS BIOMÉCANIQUES DÉTAILLÉES
-- Partie 2: Musculation - Exercices secondaires
-- ============================================

-- PULL-UPS / TRACTIONS
UPDATE exercise_library SET 
  general_description = 'Exercice fondamental de tirage vertical développant les dorsaux, biceps, avant-bras et rhomboïdes. Mouvement de référence pour évaluer la force relative du haut du corps.',
  positioning_criteria = '{
    "body_placement": "Suspendu à une barre fixe, corps aligné et vertical, jambes tendues ou légèrement fléchies",
    "feet_position": "Jambes tendues, chevilles croisées ou parallèles. Aucun balancement initial.",
    "hands_grip": "Mains en pronation (paumes vers l''avant), écartées légèrement plus que la largeur des épaules. Prise complète avec les pouces enroulés.",
    "joint_alignment": "Épaules engagées (dépression scapulaire) même en position basse, coudes orientés vers l''extérieur",
    "initial_posture": "Corps gainé de la tête aux pieds, épaules actives (non relâchées), regard légèrement vers le haut"
  }',
  execution_criteria = '{
    "movement_flow": "Initier en tirant les coudes vers le bas et l''arrière. Monter en ramenant la poitrine vers la barre. Le menton passe au-dessus de la barre. Redescendre de façon contrôlée jusqu''à l''extension complète des bras.",
    "range_of_motion": "De l''extension complète (bras tendus, épaules actives) jusqu''au menton au-dessus de la barre.",
    "speed_control": "Montée puissante et contrôlée (1-2 sec). Descente maîtrisée (2-3 sec). Éviter le balancement.",
    "breathing": "Expiration pendant la phase de traction (montée). Inspiration pendant la descente.",
    "key_points": ["Initier avec les dorsaux, pas les biceps", "Garder les épaules engagées même en bas", "Éviter le balancement et le kipping", "Poitrine vers la barre, pas juste le menton"]
  }',
  safety_prevention = '{
    "common_errors": ["Demi-répétitions (amplitude incomplète)", "Balancer le corps pour prendre de l''élan", "Relâcher complètement les épaules en bas", "Tirer seulement avec les bras"],
    "risk_zones": ["Articulation des épaules", "Coudes", "Poignets"],
    "safety_instructions": "Échauffer les épaules et les coudes avant l''exercice. Si débutant, utiliser des bandes élastiques d''assistance. Maintenir toujours les épaules actives en position basse."
  }'
WHERE exercise_name ILIKE '%pull-up%' OR exercise_name ILIKE '%traction%' OR exercise_name ILIKE '%chin-up%';

-- BARBELL ROW / ROWING BARRE
UPDATE exercise_library SET 
  general_description = 'Exercice de tirage horizontal développant l''épaisseur du dos. Sollicite les dorsaux, rhomboïdes, trapèzes moyens, érecteurs du rachis et biceps.',
  positioning_criteria = '{
    "body_placement": "Debout, buste penché vers l''avant à environ 45-60° par rapport au sol, genoux légèrement fléchis",
    "feet_position": "Pieds écartés largeur des hanches, poids sur le milieu du pied et les talons",
    "hands_grip": "Mains en pronation, écartées légèrement plus que la largeur des épaules. Prise ferme, poignets droits.",
    "joint_alignment": "Dos plat et rigide, genoux légèrement fléchis, regard vers le sol à 2m devant soi",
    "initial_posture": "Colonne neutre (pas arrondie), omoplates en position neutre, abdominaux gainés, barre suspendue à bout de bras"
  }',
  execution_criteria = '{
    "movement_flow": "Tirer la barre vers le nombril en ramenant les coudes vers l''arrière. Serrer les omoplates en haut du mouvement. Redescendre de façon contrôlée jusqu''à l''extension des bras.",
    "range_of_motion": "De l''extension complète des bras jusqu''au contact de la barre avec l''abdomen (zone du nombril).",
    "speed_control": "Traction contrôlée (1-2 sec). Pause d''une seconde en haut avec contraction des omoplates. Descente maîtrisée (2 sec).",
    "breathing": "Expiration pendant la traction. Inspiration pendant la descente. Maintien du gainage abdominal.",
    "key_points": ["Garder le dos plat et rigide tout au long", "Tirer vers le nombril, pas vers la poitrine", "Initier avec les dorsaux en rétractant les omoplates", "Ne pas utiliser l''élan du corps"]
  }',
  safety_prevention = '{
    "common_errors": ["Arrondir le dos", "Se relever pour prendre de l''élan", "Tirer trop haut vers la poitrine", "Utiliser des charges trop lourdes compromettant la technique"],
    "risk_zones": ["Région lombaire", "Biceps (insertion)", "Épaules"],
    "safety_instructions": "Maîtriser la position de hip hinge avant de charger. Utiliser une ceinture de force pour les séries lourdes. Réduire la charge si le dos commence à s''arrondir."
  }'
WHERE exercise_name ILIKE '%barbell row%' OR exercise_name ILIKE '%rowing%' AND station_name = 'Musculation';

-- DIPS
UPDATE exercise_library SET 
  general_description = 'Exercice de poussée verticale descendante développant les triceps, pectoraux inférieurs et deltoïdes antérieurs. Excellent pour la force fonctionnelle du haut du corps.',
  positioning_criteria = '{
    "body_placement": "Suspendu aux barres parallèles, bras tendus, corps vertical ou légèrement incliné vers l''avant",
    "feet_position": "Jambes croisées ou parallèles, légèrement fléchies derrière le corps pour l''équilibre",
    "hands_grip": "Mains en prise neutre sur les barres, poignets droits, pouces enroulés",
    "joint_alignment": "Épaules abaissées et stables, coudes pointant vers l''arrière ou légèrement vers l''extérieur",
    "initial_posture": "Corps gainé, poitrine ouverte, omoplates légèrement rétractées, regard droit devant"
  }',
  execution_criteria = '{
    "movement_flow": "Descendre en fléchissant les coudes, permettant au corps de s''incliner légèrement vers l''avant. Descendre jusqu''à ce que les épaules passent sous les coudes. Remonter en poussant sur les barres jusqu''à l''extension des bras.",
    "range_of_motion": "Descente jusqu''à angle de 90° aux coudes minimum, idéalement épaules au niveau ou sous les coudes. Extension complète en haut.",
    "speed_control": "Descente contrôlée (2-3 sec). Légère pause en bas. Remontée puissante mais maîtrisée (1-2 sec).",
    "breathing": "Inspiration pendant la descente. Expiration pendant la poussée.",
    "key_points": ["Inclinaison vers l''avant pour cibler les pectoraux", "Corps plus vertical pour cibler les triceps", "Ne pas descendre trop bas si douleur aux épaules", "Garder les épaules stables et abaissées"]
  }',
  safety_prevention = '{
    "common_errors": ["Descendre trop bas causant un stress excessif aux épaules", "Épaules qui remontent vers les oreilles", "Balancement du corps", "Coudes trop écartés"],
    "risk_zones": ["Articulation de l''épaule (capsule antérieure)", "Coudes", "Articulation sterno-claviculaire"],
    "safety_instructions": "Ne pas forcer l''amplitude si douleur aux épaules. Échauffer les épaules avant l''exercice. Utiliser une assistance (bandes ou machine) si nécessaire pour maintenir une bonne technique."
  }'
WHERE exercise_name ILIKE '%dip%';

-- HIP THRUST
UPDATE exercise_library SET 
  general_description = 'Exercice d''isolation des fessiers développant la puissance et l''hypertrophie des muscles glutéaux. Excellent pour améliorer l''extension de hanche.',
  positioning_criteria = '{
    "body_placement": "Dos appuyé contre un banc au niveau des omoplates, pieds au sol, bassin au-dessus du sol",
    "feet_position": "Pieds à plat, écartés largeur des hanches, placés de sorte que les tibias soient verticaux en position haute",
    "hands_grip": "Mains stabilisant la barre sur les hanches ou posées sur le banc pour l''équilibre",
    "joint_alignment": "Genoux formant un angle de 90° en position haute, colonne neutre",
    "initial_posture": "Omoplates appuyées sur le banc, barre positionnée sur le pli des hanches avec protection, fessiers contractés"
  }',
  execution_criteria = '{
    "movement_flow": "Pousser les hanches vers le plafond en contractant maximalement les fessiers. Atteindre l''extension complète des hanches (corps aligné des épaules aux genoux). Redescendre de façon contrôlée.",
    "range_of_motion": "De la position basse (fessiers proches du sol) jusqu''à l''extension complète des hanches (alignement épaules-hanches-genoux).",
    "speed_control": "Montée puissante (1 sec). Contraction isométrique de 1-2 sec en haut. Descente contrôlée (2-3 sec).",
    "breathing": "Expiration pendant la poussée. Inspiration pendant la descente.",
    "key_points": ["Pousser à travers les talons", "Contracter maximalement les fessiers en haut", "Ne pas hyperextendre le bas du dos", "Garder le menton rentré (regard vers le bas)", "Tibias verticaux en position haute"]
  }',
  safety_prevention = '{
    "common_errors": ["Hyperextension lombaire au lieu de l''extension de hanche", "Pieds placés trop loin ou trop près", "Ne pas atteindre l''extension complète", "Utiliser le bas du dos au lieu des fessiers"],
    "risk_zones": ["Région lombaire", "Articulation coxo-fémorale"],
    "safety_instructions": "Utiliser un coussin ou une barre pad pour protéger les hanches. Maîtriser le mouvement sans charge avant d''ajouter du poids. Garder le regard vers le bas pour éviter l''hyperextension cervicale."
  }'
WHERE exercise_name ILIKE '%hip thrust%';

-- LUNGES / FENTES
UPDATE exercise_library SET 
  general_description = 'Exercice unilatéral développant les quadriceps, fessiers et ischio-jambiers. Améliore l''équilibre, la coordination et corrige les déséquilibres musculaires.',
  positioning_criteria = '{
    "body_placement": "Debout, buste droit, regard horizontal, bras le long du corps ou mains sur les hanches",
    "feet_position": "Pieds écartés largeur des hanches, un pied va faire un pas en avant",
    "hands_grip": "Mains sur les hanches, le long du corps, ou tenant des haltères pour ajouter de la charge",
    "joint_alignment": "Colonne vertébrale neutre et verticale, épaules au-dessus des hanches",
    "initial_posture": "Corps gainé, poids réparti équitablement sur les deux pieds, regard droit devant"
  }',
  execution_criteria = '{
    "movement_flow": "Faire un grand pas en avant. Fléchir les deux genoux simultanément pour descendre le corps. Le genou arrière se dirige vers le sol sans le toucher. Pousser avec le pied avant pour revenir à la position initiale.",
    "range_of_motion": "Descente jusqu''à ce que les deux genoux forment des angles d''environ 90°. Le genou arrière passe près du sol (5-10 cm).",
    "speed_control": "Pas en avant contrôlé. Descente maîtrisée (2 sec). Remontée puissante en poussant du talon avant.",
    "breathing": "Inspiration pendant la descente. Expiration pendant la remontée.",
    "key_points": ["Genou avant aligné avec la cheville (ne dépasse pas la pointe de pied excessivement)", "Buste vertical, ne pas se pencher en avant", "Poids sur le talon du pied avant", "Genou avant stable, pas de valgus"]
  }',
  safety_prevention = '{
    "common_errors": ["Genou qui s''effondre vers l''intérieur (valgus)", "Pas trop court limitant l''amplitude", "Se pencher excessivement vers l''avant", "Genou arrière qui frappe le sol"],
    "risk_zones": ["Articulation du genou (rotule)", "Ligaments croisés", "Articulation de la hanche"],
    "safety_instructions": "Maîtriser le mouvement sans charge avant d''ajouter des poids. Éviter si douleur au genou. Utiliser un coussin sous le genou arrière si besoin de toucher le sol."
  }'
WHERE exercise_name ILIKE '%lunge%' OR exercise_name ILIKE '%fente%';

-- LEG PRESS
UPDATE exercise_library SET 
  general_description = 'Exercice guidé de développement des membres inférieurs sur machine. Sollicite quadriceps, fessiers et ischio-jambiers dans un mouvement sécurisé.',
  positioning_criteria = '{
    "body_placement": "Dos plaqué contre le dossier de la machine, fessiers en contact avec le siège",
    "feet_position": "Pieds sur la plateforme, écartés largeur des épaules, orientés légèrement vers l''extérieur. Position variable selon ciblage (haut=fessiers, bas=quadriceps)",
    "hands_grip": "Mains sur les poignées latérales, sans tirer sur les poignées pendant l''effort",
    "joint_alignment": "Genoux alignés avec les pieds, bas du dos plaqué contre le dossier",
    "initial_posture": "Dos complètement en contact avec le dossier, abdominaux légèrement contractés, regard droit devant"
  }',
  execution_criteria = '{
    "movement_flow": "Déverrouiller la sécurité. Fléchir les genoux pour descendre la plateforme vers le buste. Descendre jusqu''à ce que les genoux forment un angle de 90° ou légèrement moins. Pousser pour remonter la plateforme sans verrouiller complètement les genoux.",
    "range_of_motion": "Descente jusqu''à un angle de 90° aux genoux environ. Remontée jusqu''à l''extension quasi-complète (éviter le verrouillage brutal).",
    "speed_control": "Descente contrôlée (2-3 sec). Pas de pause prolongée en bas. Remontée puissante mais fluide.",
    "breathing": "Inspiration pendant la descente. Expiration pendant la poussée.",
    "key_points": ["Dos plaqué contre le dossier tout le mouvement", "Ne pas verrouiller les genoux en haut", "Pousser à travers les talons", "Genoux alignés avec les pieds (pas de valgus)"]
  }',
  safety_prevention = '{
    "common_errors": ["Décoller le bas du dos du dossier en bas du mouvement", "Verrouiller brutalement les genoux en haut", "Descendre trop bas causant l''arrondissement du dos", "Laisser les genoux s''effondrer vers l''intérieur"],
    "risk_zones": ["Région lombaire", "Genoux"],
    "safety_instructions": "Ajuster le siège pour que le dos reste en contact avec le dossier en amplitude complète. Utiliser les sécurités de la machine. Ne pas descendre au-delà de l''amplitude permettant de garder le dos plaqué."
  }'
WHERE exercise_name ILIKE '%leg press%' OR exercise_name ILIKE '%presse%jambe%';

-- LEG CURL
UPDATE exercise_library SET 
  general_description = 'Exercice d''isolation des ischio-jambiers. Développe la force et la masse musculaire de la loge postérieure de la cuisse.',
  positioning_criteria = '{
    "body_placement": "Allongé face contre le banc (version couchée) ou assis (version assise), hanches en contact avec le support",
    "feet_position": "Chevilles sous le rouleau rembourré, pieds en flexion dorsale ou neutre",
    "hands_grip": "Mains sur les poignées pour stabiliser le haut du corps",
    "joint_alignment": "Genoux alignés avec l''axe de rotation de la machine, hanches en contact avec le banc",
    "initial_posture": "Jambes tendues, corps stable et gainé, regard vers le sol (version couchée)"
  }',
  execution_criteria = '{
    "movement_flow": "Fléchir les genoux pour ramener les talons vers les fessiers. Contracter maximalement les ischio-jambiers en fin de mouvement. Redescendre de façon contrôlée jusqu''à l''extension des jambes.",
    "range_of_motion": "De l''extension complète des jambes jusqu''à la flexion maximale (talons proches des fessiers).",
    "speed_control": "Flexion contrôlée (1-2 sec). Contraction isométrique d''une seconde en haut. Descente lente (2-3 sec).",
    "breathing": "Expiration pendant la flexion. Inspiration pendant l''extension.",
    "key_points": ["Hanches en contact avec le banc (pas de compensation)", "Flexion plantaire en fin de mouvement pour cibler les gastrocnémiens", "Mouvement fluide sans à-coups", "Contracter maximalement en position haute"]
  }',
  safety_prevention = '{
    "common_errors": ["Lever les hanches du banc pour tricher", "Utiliser l''élan au lieu de la contraction musculaire", "Amplitude incomplète", "Charge trop lourde compromettant la technique"],
    "risk_zones": ["Ischio-jambiers (risque de crampe ou élongation)", "Articulation du genou"],
    "safety_instructions": "Échauffer les ischio-jambiers avant l''exercice. Utiliser des charges permettant un contrôle total. Arrêter immédiatement en cas de crampe."
  }'
WHERE exercise_name ILIKE '%leg curl%';

-- LEG EXTENSION
UPDATE exercise_library SET 
  general_description = 'Exercice d''isolation des quadriceps. Développe spécifiquement les quatre chefs du quadriceps, particulièrement le vaste médial.',
  positioning_criteria = '{
    "body_placement": "Assis sur la machine, dos plaqué contre le dossier, cuisses en contact avec le siège",
    "feet_position": "Chevilles sous le rouleau rembourré, pieds en flexion dorsale ou neutre",
    "hands_grip": "Mains sur les poignées latérales pour stabiliser le buste",
    "joint_alignment": "Genoux alignés avec l''axe de rotation de la machine, bord du siège au niveau du creux du genou",
    "initial_posture": "Dos plaqué contre le dossier, jambes fléchies à 90° ou plus, abdominaux légèrement engagés"
  }',
  execution_criteria = '{
    "movement_flow": "Étendre les genoux pour soulever le rouleau. Contracter maximalement les quadriceps en extension complète. Redescendre de façon contrôlée.",
    "range_of_motion": "De la flexion (90° ou plus) jusqu''à l''extension complète des genoux.",
    "speed_control": "Extension contrôlée (1-2 sec). Contraction isométrique d''une seconde en haut. Descente lente (2-3 sec).",
    "breathing": "Expiration pendant l''extension. Inspiration pendant la flexion.",
    "key_points": ["Dos plaqué contre le dossier", "Extension complète avec contraction maximale", "Mouvement contrôlé sans à-coups", "Orteils légèrement vers l''extérieur pour cibler le vaste médial"]
  }',
  safety_prevention = '{
    "common_errors": ["Utiliser l''élan", "Amplitude incomplète", "Décoller le dos du dossier", "Verrouillage brutal des genoux"],
    "risk_zones": ["Articulation du genou (ligaments, rotule)", "Tendons rotuliens"],
    "safety_instructions": "Ajuster la machine pour que l''axe de rotation soit aligné avec le genou. Éviter les charges excessives. Contre-indiqué en cas de problèmes rotuliens sans avis médical."
  }'
WHERE exercise_name ILIKE '%leg extension%';

-- CALF RAISE / MOLLETS
UPDATE exercise_library SET 
  general_description = 'Exercice d''isolation des mollets (gastrocnémiens et soléaire). Développe la force et la masse musculaire de la loge postérieure de la jambe.',
  positioning_criteria = '{
    "body_placement": "Debout sur une marche ou une cale, avant-pieds sur le bord, talons dans le vide",
    "feet_position": "Avant-pieds sur le bord de la marche, pieds parallèles ou légèrement orientés vers l''extérieur, écartés largeur des hanches",
    "hands_grip": "Mains en appui sur un support pour l''équilibre (mur, barre, machine)",
    "joint_alignment": "Genoux verrouillés ou très légèrement fléchis, corps vertical aligné",
    "initial_posture": "Corps gainé et vertical, épaules au-dessus des hanches, regard droit devant"
  }',
  execution_criteria = '{
    "movement_flow": "Monter sur la pointe des pieds en contractant les mollets. Atteindre l''extension plantaire maximale. Redescendre de façon contrôlée en laissant les talons descendre sous le niveau de la marche.",
    "range_of_motion": "De la dorsiflexion maximale (talons bas) jusqu''à la flexion plantaire maximale (sur la pointe des pieds).",
    "speed_control": "Montée contrôlée (1-2 sec). Contraction isométrique d''une seconde en haut. Descente lente (2-3 sec) avec étirement.",
    "breathing": "Expiration pendant la montée. Inspiration pendant la descente.",
    "key_points": ["Amplitude complète (étirement en bas, contraction en haut)", "Genoux stables (pas de flexion pendant le mouvement)", "Monter le plus haut possible", "Mouvement fluide et contrôlé"]
  }',
  safety_prevention = '{
    "common_errors": ["Amplitude réduite (demi-répétitions)", "Rebond en bas du mouvement", "Fléchir les genoux pendant l''exercice", "Élan excessif"],
    "risk_zones": ["Tendon d''Achille", "Aponévrose plantaire"],
    "safety_instructions": "Échauffer les mollets et le tendon d''Achille avant l''exercice. Éviter les rebonds. Progression progressive des charges."
  }'
WHERE exercise_name ILIKE '%calf%' OR exercise_name ILIKE '%mollet%';

-- BICEPS CURL
UPDATE exercise_library SET 
  general_description = 'Exercice d''isolation des biceps brachiaux et brachial antérieur. Développe la force et la masse musculaire des fléchisseurs du coude.',
  positioning_criteria = '{
    "body_placement": "Debout, pieds écartés largeur des hanches, buste droit et gainé",
    "feet_position": "Pieds parallèles, poids réparti équitablement, genoux légèrement fléchis",
    "hands_grip": "Mains en supination (paumes vers le haut) sur la barre ou les haltères, écartées largeur des épaules",
    "joint_alignment": "Coudes près du corps, épaules abaissées et stables",
    "initial_posture": "Bras tendus le long du corps, charge en position basse, buste gainé et immobile"
  }',
  execution_criteria = '{
    "movement_flow": "Fléchir les coudes pour monter la charge vers les épaules. Garder les coudes fixes près du corps. Contracter les biceps en haut. Redescendre de façon contrôlée.",
    "range_of_motion": "De l''extension complète du coude jusqu''à la flexion maximale (charge proche des épaules).",
    "speed_control": "Montée contrôlée (1-2 sec). Contraction isométrique en haut. Descente lente (2-3 sec).",
    "breathing": "Expiration pendant la flexion (montée). Inspiration pendant l''extension (descente).",
    "key_points": ["Coudes immobiles près du corps", "Pas de balancement du buste", "Extension complète en bas", "Contraction maximale en haut"]
  }',
  safety_prevention = '{
    "common_errors": ["Balancer le corps pour prendre de l''élan", "Avancer les coudes", "Amplitude incomplète", "Charge trop lourde"],
    "risk_zones": ["Tendons du biceps (insertion)", "Articulation du coude"],
    "safety_instructions": "Utiliser des charges permettant un mouvement strict. Éviter les charges excessives causant des compensations. Échauffer les biceps et coudes."
  }'
WHERE exercise_name ILIKE '%curl%biceps%' OR exercise_name ILIKE '%barbell curl%' OR exercise_name ILIKE '%dumbbell curl%';

-- TRICEPS EXTENSION
UPDATE exercise_library SET 
  general_description = 'Exercice d''isolation des triceps brachiaux. Développe la force et la masse musculaire des extenseurs du coude.',
  positioning_criteria = '{
    "body_placement": "Debout face à la poulie haute, ou couché pour skull crusher, buste stable et gainé",
    "feet_position": "Pieds écartés largeur des hanches, légèrement décalés pour la stabilité (poulie)",
    "hands_grip": "Mains en pronation ou neutre sur la corde/barre, écartées largeur des épaules ou plus proche",
    "joint_alignment": "Coudes près du corps et fixes, pointant vers le sol (poulie) ou vers le plafond (skull crusher)",
    "initial_posture": "Bras fléchis en position haute, épaules abaissées et stables, buste légèrement penché vers l''avant (poulie)"
  }',
  execution_criteria = '{
    "movement_flow": "Étendre les coudes pour pousser la charge vers le bas (poulie) ou vers le haut (skull crusher). Garder les coudes fixes. Contracter les triceps en extension complète. Revenir de façon contrôlée.",
    "range_of_motion": "De la flexion du coude jusqu''à l''extension complète.",
    "speed_control": "Extension contrôlée (1-2 sec). Contraction isométrique en bas. Retour lent (2-3 sec).",
    "breathing": "Expiration pendant l''extension. Inspiration pendant la flexion.",
    "key_points": ["Coudes immobiles", "Seuls les avant-bras bougent", "Extension complète avec contraction", "Pas d''élan du corps"]
  }',
  safety_prevention = '{
    "common_errors": ["Bouger les coudes pendant le mouvement", "Utiliser l''élan du corps", "Amplitude incomplète", "Arquer le dos"],
    "risk_zones": ["Articulation du coude", "Tendons des triceps"],
    "safety_instructions": "Échauffer les coudes avant l''exercice. Utiliser des charges permettant un mouvement strict. Pour skull crusher, utiliser un pareur ou des sécurités."
  }'
WHERE exercise_name ILIKE '%triceps%extension%' OR exercise_name ILIKE '%pushdown%' OR exercise_name ILIKE '%skull crusher%';

-- LATERAL RAISE / ÉLÉVATIONS LATÉRALES
UPDATE exercise_library SET 
  general_description = 'Exercice d''isolation du deltoïde moyen (faisceau latéral). Développe la largeur et le galbe des épaules.',
  positioning_criteria = '{
    "body_placement": "Debout, pieds écartés largeur des hanches, buste légèrement penché vers l''avant",
    "feet_position": "Pieds parallèles, poids réparti équitablement, genoux légèrement fléchis",
    "hands_grip": "Mains en prise neutre sur les haltères, paumes face aux cuisses",
    "joint_alignment": "Coudes légèrement fléchis et fixes, épaules abaissées",
    "initial_posture": "Bras le long du corps, haltères devant les cuisses ou sur les côtés, omoplates engagées"
  }',
  execution_criteria = '{
    "movement_flow": "Élever les bras latéralement jusqu''à la hauteur des épaules (parallèle au sol). Maintenir une légère flexion des coudes. Les mains arrivent à la hauteur des épaules ou légèrement en dessous. Redescendre de façon contrôlée.",
    "range_of_motion": "De la position basse (bras le long du corps) jusqu''à l''horizontale ou légèrement au-dessus.",
    "speed_control": "Élévation contrôlée (2 sec). Courte pause en haut. Descente lente (2-3 sec).",
    "breathing": "Expiration pendant l''élévation. Inspiration pendant la descente.",
    "key_points": ["Coudes légèrement fléchis et plus hauts que les poignets en haut", "Initier le mouvement avec les deltoïdes, pas les trapèzes", "Éviter de hausser les épaules", "Légère rotation interne (petits doigts légèrement plus hauts)"]
  }',
  safety_prevention = '{
    "common_errors": ["Hausser les épaules (utiliser les trapèzes)", "Élan excessif", "Monter les bras trop haut", "Charges trop lourdes"],
    "risk_zones": ["Articulation de l''épaule (conflit sous-acromial)", "Coiffe des rotateurs"],
    "safety_instructions": "Utiliser des charges légères à modérées. Éviter de monter au-dessus de l''horizontale. Arrêter en cas de douleur à l''épaule."
  }'
WHERE exercise_name ILIKE '%lateral raise%' OR exercise_name ILIKE '%élévation%latérale%';