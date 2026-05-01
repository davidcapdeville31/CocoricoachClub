-- ============================================
-- DESCRIPTIONS BIOMÉCANIQUES DÉTAILLÉES
-- Partie 3: Haltérophilie et CrossFit
-- ============================================

-- CLEAN / ÉPAULÉ
UPDATE exercise_library SET 
  general_description = 'Mouvement olympique complet consistant à amener la barre du sol jusqu''aux épaules en un seul mouvement explosif. Développe la puissance, la coordination et la force totale du corps.',
  positioning_criteria = '{
    "body_placement": "Debout face à la barre, pieds écartés largeur des hanches, tibias touchant la barre",
    "feet_position": "Pieds à plat, écartés largeur des hanches, pointes légèrement vers l''extérieur (10-15°)",
    "hands_grip": "Mains en pronation, écartées légèrement plus que la largeur des épaules (prise d''épaulé). Prise crochet recommandée (pouce sous les doigts).",
    "joint_alignment": "Épaules au-dessus ou légèrement en avant de la barre, genoux poussés vers l''extérieur, dos plat et rigide",
    "initial_posture": "Position de soulevé de terre, hanches plus hautes que les genoux mais plus basses que les épaules, poitrine ouverte, regard vers l''avant"
  }',
  execution_criteria = '{
    "movement_flow": "1ère tirée: soulever la barre du sol en gardant le dos plat, angle du buste constant. 2ème tirée: extension explosive des hanches, genoux et chevilles (triple extension) quand la barre passe les genoux. Tirage haut avec les coudes, puis passage sous la barre en fléchissant rapidement les hanches et genoux. Réception en position de front squat, coudes hauts. Se relever en extension complète.",
    "range_of_motion": "Du sol jusqu''à la position rack frontale (barre sur les deltoïdes, coudes hauts), puis extension complète debout.",
    "speed_control": "1ère tirée contrôlée et progressive. 2ème tirée explosive et violente. Passage sous la barre rapide. Réception stable avant de se relever.",
    "breathing": "Grande inspiration avant le tirage. Blocage pendant l''effort. Expiration une fois debout.",
    "key_points": ["Garder la barre proche du corps tout le mouvement", "Triple extension explosive (chevilles, genoux, hanches)", "Coudes rapides et hauts lors du passage sous la barre", "Réception stable en front squat avant de se relever"]
  }',
  safety_prevention = '{
    "common_errors": ["Tirer avec les bras trop tôt", "Barre qui s''éloigne du corps", "Ne pas finir la triple extension", "Réception instable ou sur les orteils", "Coudes bas en position de réception"],
    "risk_zones": ["Région lombaire", "Poignets", "Épaules", "Genoux"],
    "safety_instructions": "Maîtriser chaque phase séparément avant le mouvement complet. Utiliser des charges légères pour apprendre. S''entraîner sur plateforme avec bumper plates. Travailler la mobilité des poignets et thorax."
  }'
WHERE exercise_name ILIKE '%clean%' OR exercise_name ILIKE '%épaulé%';

-- SNATCH / ARRACHÉ
UPDATE exercise_library SET 
  general_description = 'Mouvement olympique le plus technique consistant à amener la barre du sol au-dessus de la tête en un seul mouvement continu. Développe la puissance explosive, la mobilité et la coordination.',
  positioning_criteria = '{
    "body_placement": "Debout face à la barre, pieds écartés largeur des hanches, tibias proches de la barre",
    "feet_position": "Pieds à plat, écartés largeur des hanches, pointes légèrement vers l''extérieur",
    "hands_grip": "Prise large (barre au niveau du pli de hanche quand debout), pronation, prise crochet recommandée",
    "joint_alignment": "Épaules au-dessus de la barre, dos plat, genoux poussés vers l''extérieur au-dessus des pieds",
    "initial_posture": "Hanches plus basses que pour le clean, buste plus vertical grâce à la prise large, regard vers l''avant, omoplates engagées"
  }',
  execution_criteria = '{
    "movement_flow": "1ère tirée: soulever la barre en maintenant l''angle du dos. 2ème tirée: triple extension explosive quand la barre passe les genoux. Tirer les coudes hauts et vers l''extérieur. Passage rapide sous la barre en la poussant vers le haut. Réception en overhead squat complet, bras verrouillés au-dessus de la tête. Se relever en gardant la barre stable.",
    "range_of_motion": "Du sol jusqu''à la position overhead squat (barre au-dessus de la tête, bras tendus), puis extension complète debout.",
    "speed_control": "1ère tirée progressive. 2ème tirée maximalement explosive. Passage sous la barre très rapide. Réception stable puis remontée contrôlée.",
    "breathing": "Inspiration avant le tirage. Blocage pendant tout le mouvement. Expiration une fois debout et stable.",
    "key_points": ["Barre proche du corps (effleure le torse)", "Extension complète avant de passer sous la barre", "Recevoir avec les bras verrouillés immédiatement", "Garder la barre au-dessus du centre de gravité (légèrement en arrière de la tête)"]
  }',
  safety_prevention = '{
    "common_errors": ["Tirer avec les bras avant l''extension des hanches", "Barre qui part vers l''avant", "Recevoir avec les coudes fléchis", "Manque de mobilité pour le squat complet", "Perte d''équilibre vers l''avant"],
    "risk_zones": ["Épaules", "Poignets", "Région lombaire", "Genoux"],
    "safety_instructions": "Exercice très technique nécessitant un coaching. Travailler la mobilité overhead et de squat. Utiliser des bumper plates et une plateforme. Apprendre les positions progressivement avec un manche à balai."
  }'
WHERE exercise_name ILIKE '%snatch%' OR exercise_name ILIKE '%arraché%';

-- JERK / JETÉ
UPDATE exercise_library SET 
  general_description = 'Mouvement olympique de poussée permettant d''amener la barre des épaules au-dessus de la tête par une impulsion des jambes. Développe la puissance et la coordination.',
  positioning_criteria = '{
    "body_placement": "Debout, barre en position rack frontale sur les épaules, corps vertical et gainé",
    "feet_position": "Pieds écartés largeur des hanches, parallèles ou légèrement orientés vers l''extérieur",
    "hands_grip": "Mains sur la barre légèrement plus larges que les épaules, coudes hauts et vers l''avant",
    "joint_alignment": "Colonne neutre et verticale, coudes hauts créant une tablette pour la barre",
    "initial_posture": "Barre reposant sur les deltoïdes, coudes hauts, corps gainé, regard droit devant"
  }',
  execution_criteria = '{
    "movement_flow": "Dip: flexion courte et rapide des genoux (quart de squat), buste vertical. Drive: extension explosive des jambes pour propulser la barre vers le haut. Split/Squat: passage sous la barre en fente (split jerk) ou en squat (squat jerk), bras verrouillés. Recovery: ramener les pieds parallèles en gardant la barre stable au-dessus de la tête.",
    "range_of_motion": "De la position rack jusqu''à l''extension complète des bras au-dessus de la tête.",
    "speed_control": "Dip contrôlé et rapide. Drive maximalement explosif. Passage sous la barre très rapide. Recovery contrôlé.",
    "breathing": "Inspiration et blocage avant le dip. Maintien du blocage jusqu''à la stabilisation. Expiration une fois stable.",
    "key_points": ["Dip vertical (pas de pencher vers l''avant)", "Extension complète et violente des jambes", "Passer sous la barre rapidement pendant qu''elle monte", "Verrouiller les coudes immédiatement", "Barre légèrement en arrière de la tête"]
  }',
  safety_prevention = '{
    "common_errors": ["Dip vers l''avant au lieu de vertical", "Pousser avec les bras au lieu des jambes", "Ne pas passer sous la barre", "Coudes pas verrouillés en réception", "Perte d''équilibre vers l''avant"],
    "risk_zones": ["Épaules", "Poignets", "Genoux", "Région lombaire"],
    "safety_instructions": "Apprendre le timing avec des charges légères. Travailler le dip drive séparément. S''assurer de la mobilité overhead. Utiliser une plateforme avec bumper plates."
  }'
WHERE exercise_name ILIKE '%jerk%' OR exercise_name ILIKE '%jeté%';

-- THRUSTER
UPDATE exercise_library SET 
  general_description = 'Mouvement combiné associant un front squat à un push press. Exercice très complet sollicitant tout le corps et développant l''endurance musculaire et cardiovasculaire.',
  positioning_criteria = '{
    "body_placement": "Debout, barre en position rack frontale, corps vertical et gainé",
    "feet_position": "Pieds écartés légèrement plus que la largeur des hanches, pointes vers l''extérieur (15-30°)",
    "hands_grip": "Mains sur la barre légèrement plus larges que les épaules, coudes hauts",
    "joint_alignment": "Coudes hauts et parallèles au sol, colonne neutre, genoux alignés avec les pieds",
    "initial_posture": "Barre sur les deltoïdes antérieurs, coudes hauts, abdominaux engagés, regard horizontal"
  }',
  execution_criteria = '{
    "movement_flow": "Descendre en front squat complet (pli de hanche sous les genoux) en gardant les coudes hauts et le buste vertical. Sans pause en bas, remonter de façon explosive en utilisant l''élan pour pousser la barre au-dessus de la tête jusqu''à l''extension complète des bras. Redescendre la barre sur les épaules et enchaîner directement le squat suivant.",
    "range_of_motion": "Squat complet jusqu''à extension complète des bras au-dessus de la tête.",
    "speed_control": "Descente contrôlée. Remontée et poussée explosives et continues (un seul mouvement fluide). Pas de pause entre les phases.",
    "breathing": "Inspiration avant la descente. Expiration pendant la poussée ou en haut du mouvement.",
    "key_points": ["Utiliser l''élan du squat pour la poussée (pas de pause en bas)", "Coudes hauts pendant le squat", "Extension complète en haut (hanches, genoux, bras)", "Mouvement fluide et continu"]
  }',
  safety_prevention = '{
    "common_errors": ["Pause en bas du squat (perte d''élan)", "Coudes qui tombent", "Pencher le buste vers l''avant", "Ne pas finir l''extension en haut", "Pousser avec les bras au lieu des jambes"],
    "risk_zones": ["Épaules", "Poignets", "Région lombaire", "Genoux"],
    "safety_instructions": "Maîtriser le front squat et le push press séparément. Commencer avec des charges légères. Travailler la mobilité des poignets et thoracique."
  }'
WHERE exercise_name ILIKE '%thruster%';

-- BURPEE
UPDATE exercise_library SET 
  general_description = 'Exercice de conditionnement au poids de corps combinant une pompe, un squat et un saut. Développe l''endurance cardiovasculaire, la force et la coordination.',
  positioning_criteria = '{
    "body_placement": "Debout, pieds écartés largeur des épaules, bras le long du corps",
    "feet_position": "Pieds parallèles, écartés largeur des épaules",
    "hands_grip": "Mains prêtes à être posées au sol, doigts écartés",
    "joint_alignment": "Corps vertical et aligné, regard droit devant",
    "initial_posture": "Position debout naturelle, prêt à initier le mouvement"
  }',
  execution_criteria = '{
    "movement_flow": "1) Fléchir les hanches et genoux pour poser les mains au sol. 2) Sauter ou marcher les pieds vers l''arrière pour atteindre la position de planche. 3) Effectuer une pompe (poitrine au sol). 4) Sauter ou marcher les pieds vers les mains. 5) Se relever et sauter en l''air avec les mains au-dessus de la tête. Répéter immédiatement.",
    "range_of_motion": "De la position debout jusqu''au sol (planche/pompe) puis saut avec extension complète.",
    "speed_control": "Mouvement fluide et rapide sans pause entre les phases. Vitesse adaptée au niveau et à l''objectif (technique vs vitesse).",
    "breathing": "Expiration pendant la pompe et le saut. Inspiration pendant la transition. Rythme respiratoire régulier.",
    "key_points": ["Garder le corps aligné en position de planche", "Pompe complète (poitrine au sol)", "Extension complète pendant le saut", "Mouvement fluide sans pause"]
  }',
  safety_prevention = '{
    "common_errors": ["Dos qui s''affaisse en position de planche", "Pompe incomplète", "Pas de saut ou saut insuffisant", "Perte de la technique à la fatigue"],
    "risk_zones": ["Poignets", "Épaules", "Région lombaire"],
    "safety_instructions": "Adapter la vitesse au niveau technique. Modifier le mouvement si nécessaire (pas de pompe, pas de saut). Échauffer les poignets avant l''exercice."
  }'
WHERE exercise_name ILIKE '%burpee%';

-- WALL BALL
UPDATE exercise_library SET 
  general_description = 'Exercice de conditionnement combinant un front squat à un lancer de medecine ball. Développe la puissance des membres inférieurs, l''endurance et la coordination.',
  positioning_criteria = '{
    "body_placement": "Debout face à un mur, à environ 60-90 cm de distance, medecine ball tenu contre la poitrine",
    "feet_position": "Pieds écartés largeur des épaules ou légèrement plus, pointes vers l''extérieur (15-30°)",
    "hands_grip": "Mains sur les côtés du ballon, à hauteur de poitrine, coudes vers le bas",
    "joint_alignment": "Colonne neutre, genoux alignés avec les pieds, épaules au-dessus des hanches",
    "initial_posture": "Ballon contre la poitrine, regard vers la cible sur le mur, corps gainé"
  }',
  execution_criteria = '{
    "movement_flow": "Descendre en squat complet en gardant le ballon contre la poitrine. Remonter de façon explosive en utilisant l''élan des jambes pour lancer le ballon vers la cible sur le mur. Attraper le ballon au rebond et enchaîner directement le squat suivant.",
    "range_of_motion": "Squat complet (pli de hanche sous les genoux) jusqu''à extension complète avec lancer vers la cible (généralement à 3m pour hommes, 2.7m pour femmes).",
    "speed_control": "Descente contrôlée mais rapide. Remontée et lancer explosifs. Réception du ballon absorbée par le squat suivant.",
    "breathing": "Inspiration pendant la descente. Expiration pendant le lancer. Rythme régulier.",
    "key_points": ["Utiliser les jambes pour le lancer (pas les bras)", "Squat complet à chaque répétition", "Viser la cible avec précision", "Enchaîner fluidement sans pause"]
  }',
  safety_prevention = '{
    "common_errors": ["Squat incomplet", "Lancer avec les bras au lieu des jambes", "Perdre le contrôle du ballon", "S''éloigner du mur progressivement"],
    "risk_zones": ["Épaules", "Poignets", "Région lombaire"],
    "safety_instructions": "Commencer avec un ballon adapté à son niveau. S''assurer que le mur est solide et la zone dégagée. Maintenir la technique même à la fatigue."
  }'
WHERE exercise_name ILIKE '%wall ball%';

-- KETTLEBELL SWING
UPDATE exercise_library SET 
  general_description = 'Mouvement balistique développant la puissance de la chaîne postérieure. Excellent pour le conditionnement, la force des hanches et l''endurance.',
  positioning_criteria = '{
    "body_placement": "Debout, pieds écartés légèrement plus que la largeur des épaules, kettlebell au sol devant soi",
    "feet_position": "Pieds fermement ancrés, écartés plus large que les hanches, pointes légèrement vers l''extérieur",
    "hands_grip": "Deux mains sur l''anse de la kettlebell, prise ferme, poignets droits",
    "joint_alignment": "Dos plat, genoux légèrement fléchis, épaules au-dessus des hanches",
    "initial_posture": "Position de hip hinge, hanches vers l''arrière, kettlebell entre les jambes"
  }',
  execution_criteria = '{
    "movement_flow": "Initier le mouvement par une flexion des hanches (hip hinge) en balançant la kettlebell entre les jambes. Extension explosive des hanches pour propulser la kettlebell vers l''avant et le haut. Laisser la kettlebell monter jusqu''à la hauteur des yeux (Russian) ou au-dessus de la tête (American). Absorber le retour en fléchissant les hanches.",
    "range_of_motion": "Hip hinge avec kettlebell entre les jambes jusqu''à extension complète des hanches. Hauteur: yeux (Russian) ou overhead (American).",
    "speed_control": "Extension des hanches explosive et violente. Phase de vol de la kettlebell non forcée. Absorption du retour contrôlée.",
    "breathing": "Expiration puissante pendant l''extension. Inspiration pendant le retour.",
    "key_points": ["C''est un mouvement de hanche, pas un squat", "Extension explosive des hanches (snap)", "Bras passifs, la force vient des hanches", "Garder le dos plat tout le mouvement", "Core fortement engagé"]
  }',
  safety_prevention = '{
    "common_errors": ["Squatter au lieu de hip hinge", "Tirer avec les bras", "Arrondir le dos", "Hyperextendre le dos en haut", "Plier les poignets"],
    "risk_zones": ["Région lombaire", "Poignets", "Épaules (version American)"],
    "safety_instructions": "Maîtriser le hip hinge avant d''ajouter la kettlebell. Commencer avec une charge légère. S''assurer d''un espace dégagé autour de soi."
  }'
WHERE exercise_name ILIKE '%kettlebell swing%' OR exercise_name ILIKE '%swing%';

-- BOX JUMP
UPDATE exercise_library SET 
  general_description = 'Exercice de plyométrie développant la puissance des membres inférieurs et la capacité de détente. Améliore la force explosive et la coordination.',
  positioning_criteria = '{
    "body_placement": "Debout face à la box, à environ 30-50 cm de distance, bras le long du corps",
    "feet_position": "Pieds écartés largeur des hanches, parallèles, poids sur l''avant des pieds",
    "hands_grip": "Bras libres, prêts à accompagner le mouvement",
    "joint_alignment": "Genoux légèrement fléchis, hanches en position neutre, regard vers le haut de la box",
    "initial_posture": "Position athlétique prête à sauter, corps légèrement penché vers l''avant"
  }',
  execution_criteria = '{
    "movement_flow": "Flexion rapide des hanches et genoux (contre-mouvement) accompagnée d''un balancement des bras vers l''arrière. Extension explosive des hanches, genoux et chevilles en balançant les bras vers l''avant et le haut. Sauter sur la box en ramenant les genoux vers la poitrine. Atterrir sur la box en position quart de squat stable. Se redresser complètement puis redescendre.",
    "range_of_motion": "Du sol jusqu''au sommet de la box, avec réception en position de squat partiel puis extension complète.",
    "speed_control": "Contre-mouvement rapide. Saut explosif. Atterrissage absorbé et contrôlé. Descente contrôlée.",
    "breathing": "Inspiration avant le saut. Expiration pendant ou après l''atterrissage.",
    "key_points": ["Utiliser les bras pour accompagner le saut", "Atterrir en douceur (pas bruyamment)", "Extension complète sur la box", "Descendre en step-down plutôt qu''en saut (préserve les articulations)"]
  }',
  safety_prevention = '{
    "common_errors": ["Atterrissage bruyant (impact dur)", "Ne pas se redresser complètement sur la box", "Sauter trop près ou trop loin de la box", "Box trop haute pour le niveau"],
    "risk_zones": ["Tendon d''Achille", "Genoux", "Tibias (risque de contact avec la box)"],
    "safety_instructions": "Commencer avec une box adaptée à son niveau. Toujours vérifier la stabilité de la box. Privilégier le step-down pour redescendre. Éviter si fatigue excessive."
  }'
WHERE exercise_name ILIKE '%box jump%';

-- MUSCLE-UP
UPDATE exercise_library SET 
  general_description = 'Mouvement avancé de gymnastique combinant une traction explosive et un dip. Développe la force du haut du corps et la coordination.',
  positioning_criteria = '{
    "body_placement": "Suspendu aux anneaux ou à la barre, corps en position de hollow légère",
    "feet_position": "Jambes ensemble, légèrement en avant du corps (hollow position)",
    "hands_grip": "Prise en false grip pour les anneaux (poignet sur l''anneau). Prise normale légèrement plus large que les épaules pour la barre.",
    "joint_alignment": "Épaules engagées, coudes légèrement fléchis, corps aligné",
    "initial_posture": "Position de hollow body suspendu, épaules actives (pas relâchées)"
  }',
  execution_criteria = '{
    "movement_flow": "Initier avec un léger kip ou swing (selon variante). Traction explosive en tirant les hanches vers la barre/anneaux. Au point haut de la traction, transition rapide en faisant passer les épaules au-dessus des mains. Terminer par un dip pour se retrouver en position de support au-dessus.",
    "range_of_motion": "De la suspension complète jusqu''à la position de support (bras tendus au-dessus des anneaux/barre).",
    "speed_control": "Traction explosive. Transition rapide et agressive. Dip contrôlé.",
    "breathing": "Expiration pendant la traction. Maintien de la tension. Expiration pendant le dip si nécessaire.",
    "key_points": ["Traction haute et explosive (hanches vers les mains)", "Transition rapide des épaules au-dessus", "Garder le corps proche de la barre/anneaux", "False grip essentiel pour les anneaux"]
  }',
  safety_prevention = '{
    "common_errors": ["Traction insuffisante", "Transition trop lente", "S''éloigner de la barre/anneaux", "Manque de force pour le dip", "Kipping excessif sans contrôle"],
    "risk_zones": ["Épaules", "Coudes", "Poignets"],
    "safety_instructions": "Prérequis: tractions strictes (10+), dips stricts (10+). Apprendre les progressions (transition drill, muscle-up négatif). Utiliser des bandes d''assistance si nécessaire."
  }'
WHERE exercise_name ILIKE '%muscle-up%' OR exercise_name ILIKE '%muscle up%';

-- TOES TO BAR
UPDATE exercise_library SET 
  general_description = 'Exercice de gymnastique développant la force du core et du grip. Les orteils doivent toucher la barre à chaque répétition.',
  positioning_criteria = '{
    "body_placement": "Suspendu à une barre de traction, corps en position de hollow légère",
    "feet_position": "Jambes tendues, chevilles jointes, orteils pointés",
    "hands_grip": "Prise pronation, mains écartées légèrement plus que la largeur des épaules",
    "joint_alignment": "Épaules engagées et actives, corps aligné",
    "initial_posture": "Position de hollow body suspendu, épaules loin des oreilles"
  }',
  execution_criteria = '{
    "movement_flow": "Initier un léger kip avec les épaules (push away). Ramener les genoux vers la poitrine puis étendre les jambes vers la barre. Les orteils touchent la barre entre les mains. Redescendre de façon contrôlée en revenant à la position de hollow.",
    "range_of_motion": "De la suspension hollow jusqu''au contact des orteils avec la barre.",
    "speed_control": "Kip rythmé et contrôlé. Montée des jambes fluide. Descente contrôlée pour enchaîner.",
    "breathing": "Expiration en montant les jambes. Inspiration en redescendant.",
    "key_points": ["Utiliser les épaules pour initier le mouvement (pas juste les hanches)", "Orteils pointés", "Contact clair avec la barre", "Maintenir le rythme du kip"]
  }',
  safety_prevention = '{
    "common_errors": ["Seulement genoux à la poitrine sans toucher la barre", "Perte du rythme du kip", "Balancement excessif", "Épaules relâchées"],
    "risk_zones": ["Épaules", "Grip (ampoules)", "Région lombaire"],
    "safety_instructions": "Travailler les progressions (knee raises, knees to elbow). Renforcer le grip et le core. Utiliser des protège-mains si nécessaire."
  }'
WHERE exercise_name ILIKE '%toes to bar%' OR exercise_name ILIKE '%orteils%barre%';

-- DOUBLE UNDER
UPDATE exercise_library SET 
  general_description = 'Exercice de corde à sauter où la corde passe deux fois sous les pieds à chaque saut. Développe la coordination, l''agilité et l''endurance cardiovasculaire.',
  positioning_criteria = '{
    "body_placement": "Debout, corps vertical et gainé, bras légèrement écartés du corps",
    "feet_position": "Pieds joints, poids sur l''avant des pieds, chevilles actives",
    "hands_grip": "Mains tenant les poignées de la corde, poignets souples",
    "joint_alignment": "Corps vertical, genoux légèrement fléchis, épaules détendues",
    "initial_posture": "Position athlétique légère, prêt à sauter"
  }',
  execution_criteria = '{
    "movement_flow": "Sauter légèrement plus haut qu''un single under. Rotation rapide des poignets pour faire passer la corde deux fois sous les pieds pendant le saut. Atterrir en douceur sur l''avant des pieds. Enchaîner immédiatement le saut suivant.",
    "range_of_motion": "Saut de 10-15 cm du sol. La corde fait deux rotations complètes.",
    "speed_control": "Rythme régulier et constant. Les poignets contrôlent la vitesse de rotation.",
    "breathing": "Respiration régulière et rythmée. Éviter de retenir sa respiration.",
    "key_points": ["Le mouvement vient des poignets, pas des bras", "Saut vertical (pas vers l''avant)", "Corps gainé et vertical", "Atterrissage silencieux", "Timing régulier"]
  }',
  safety_prevention = '{
    "common_errors": ["Donkey kick (talons vers les fesses)", "Sauter vers l''avant", "Rotation avec les bras au lieu des poignets", "Saut trop haut gaspillant de l''énergie"],
    "risk_zones": ["Mollets (fatigue)", "Chevilles", "Tibias (marques de corde)"],
    "safety_instructions": "Maîtriser les single unders avant de progresser. Utiliser une corde adaptée à sa taille. S''échauffer les mollets et chevilles."
  }'
WHERE exercise_name ILIKE '%double under%' OR exercise_name ILIKE '%double%saut%';