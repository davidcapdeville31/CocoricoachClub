-- ============================================
-- DESCRIPTIONS BIOMÉCANIQUES DÉTAILLÉES
-- Partie 5: Mobilité, Prévention, Poids de corps, HYROX, Drills
-- ============================================

-- PUSH-UPS / POMPES
UPDATE exercise_library SET 
  general_description = 'Exercice fondamental de poussée au poids de corps développant les pectoraux, deltoïdes antérieurs et triceps. Base de nombreuses progressions.',
  positioning_criteria = '{
    "body_placement": "En appui sur les mains et les orteils, corps en ligne droite de la tête aux talons",
    "feet_position": "Pieds joints ou légèrement écartés, orteils au sol",
    "hands_grip": "Mains au sol légèrement plus larges que les épaules, doigts écartés et orientés vers l''avant",
    "joint_alignment": "Épaules au-dessus des poignets, coudes orientés à 45° par rapport au corps",
    "initial_posture": "Corps gainé et aligné, abdominaux et fessiers contractés, tête dans le prolongement de la colonne"
  }',
  execution_criteria = '{
    "movement_flow": "Descendre en fléchissant les coudes tout en gardant le corps aligné. La poitrine descend vers le sol. Remonter en poussant jusqu''à l''extension des bras.",
    "range_of_motion": "Descente jusqu''à ce que la poitrine effleure le sol. Extension complète des bras en haut.",
    "speed_control": "Descente contrôlée (2 sec). Poussée puissante mais maîtrisée (1 sec).",
    "breathing": "Inspiration pendant la descente. Expiration pendant la poussée.",
    "key_points": ["Corps aligné de la tête aux talons", "Coudes à 45° (pas écartés à 90°)", "Poitrine proche du sol", "Extension complète en haut", "Gainage constant"]
  }',
  safety_prevention = '{
    "common_errors": ["Hanches qui s''affaissent", "Hanches trop hautes", "Coudes trop écartés", "Amplitude incomplète", "Tête qui tombe"],
    "risk_zones": ["Épaules", "Poignets", "Région lombaire"],
    "safety_instructions": "Adapter sur les genoux si nécessaire. Échauffer les poignets. Maintenir le gainage tout le mouvement."
  }'
WHERE exercise_name ILIKE '%push-up%' OR exercise_name ILIKE '%pompe%';

-- HANDSTAND PUSH-UP / HSPU
UPDATE exercise_library SET 
  general_description = 'Exercice avancé de poussée verticale en équilibre développant les épaules, triceps et la stabilité du core.',
  positioning_criteria = '{
    "body_placement": "En équilibre sur les mains contre un mur (ou libre), corps inversé et aligné",
    "feet_position": "Talons contre le mur (version assistée) ou jambes tendues en équilibre",
    "hands_grip": "Mains au sol légèrement plus larges que les épaules, doigts écartés pointant vers le mur",
    "joint_alignment": "Épaules au-dessus des poignets, corps aligné en position inversée",
    "initial_posture": "Corps droit et gainé, tête neutre entre les bras, regard vers le sol"
  }',
  execution_criteria = '{
    "movement_flow": "Fléchir les coudes pour descendre la tête vers le sol. Créer un tripode (tête + deux mains). Pousser pour remonter jusqu''à l''extension des bras.",
    "range_of_motion": "Descente jusqu''à ce que la tête touche le sol. Extension complète des bras en haut.",
    "speed_control": "Descente contrôlée. Poussée puissante.",
    "breathing": "Inspiration en descendant. Expiration en poussant.",
    "key_points": ["Corps aligné et gainé", "Tête forme un tripode avec les mains au sol", "Coudes vers l''extérieur (version standard) ou vers l''arrière (version stricte)", "Extension complète en haut"]
  }',
  safety_prevention = '{
    "common_errors": ["Perte de l''alignement du corps", "Dos qui s''arque excessivement", "Chute non contrôlée"],
    "risk_zones": ["Épaules", "Cou", "Poignets"],
    "safety_instructions": "Prérequis: équilibre mural stable, force d''épaule suffisante. Utiliser un abmat pour la tête. Apprendre à sortir de l''équilibre en sécurité."
  }'
WHERE exercise_name ILIKE '%handstand push%' OR exercise_name ILIKE '%hspu%';

-- ROPE CLIMB / CORDE
UPDATE exercise_library SET 
  general_description = 'Exercice de grimpe développant la force de préhension, du haut du corps et la coordination. Mouvement fonctionnel de tirage.',
  positioning_criteria = '{
    "body_placement": "Debout face à la corde, mains saisissant la corde au-dessus de la tête",
    "feet_position": "Pieds joints, prêts à s''enrouler autour de la corde (version avec jambes) ou tendus (legless)",
    "hands_grip": "Main supérieure haute, main inférieure juste en dessous. Prise ferme.",
    "joint_alignment": "Bras en extension au départ, corps proche de la corde",
    "initial_posture": "Corps gainé, regard vers le haut, prêt à tirer et grimper"
  }',
  execution_criteria = '{
    "movement_flow": "Version avec jambes: créer un footlock (corde enroulée autour du pied et bloquée). Tirer avec les bras tout en poussant avec les pieds. Réattraper plus haut et répéter. Version sans jambes: traction pure alternée des bras.",
    "range_of_motion": "Du sol jusqu''au sommet de la corde. Toucher la poutre ou le point d''ancrage.",
    "speed_control": "Mouvements coordonnés et contrôlés. Descente contrôlée (ne pas glisser).",
    "breathing": "Respiration continue et régulière.",
    "key_points": ["Maîtriser le footlock pour économiser les bras", "Tirer avec les dorsaux, pas seulement les bras", "Descente contrôlée (pas de glissade)", "Corps proche de la corde"]
  }',
  safety_prevention = '{
    "common_errors": ["Glisser lors de la descente (brûlures)", "Footlock mal fait", "Épuisement des bras avant d''arriver en haut"],
    "risk_zones": ["Mains (brûlures)", "Épaules", "Grip"],
    "safety_instructions": "Apprendre le footlock au sol avant de grimper. Descendre de façon contrôlée. Utiliser des protège-mains si nécessaire. Ne pas lâcher sans contrôle."
  }'
WHERE exercise_name ILIKE '%rope climb%' OR exercise_name ILIKE '%corde%grimper%';

-- SLED PUSH
UPDATE exercise_library SET 
  general_description = 'Exercice de poussée de traîneau développant la puissance des membres inférieurs et le conditionnement métabolique. Mouvement HYROX standard.',
  positioning_criteria = '{
    "body_placement": "Debout derrière le traîneau, mains sur les poignées hautes ou basses, corps penché vers l''avant",
    "feet_position": "Pieds décalés, prêts à pousser, poids sur l''avant des pieds",
    "hands_grip": "Mains fermement agrippées sur les poignées, bras tendus ou légèrement fléchis",
    "joint_alignment": "Corps incliné à environ 45°, alignement tête-épaules-hanches",
    "initial_posture": "Position de sprint penché, core fortement engagé, regard vers l''avant"
  }',
  execution_criteria = '{
    "movement_flow": "Pousser avec les jambes en alternant des pas courts et puissants. Maintenir le traîneau en mouvement constant. Le corps reste en position penchée tout le parcours.",
    "range_of_motion": "Pas courts et rapides. Extension complète de la jambe de poussée.",
    "speed_control": "Rythme constant et soutenable. Pas trop rapide au départ pour ne pas s''épuiser.",
    "breathing": "Respiration régulière et forcée. Ne pas retenir.",
    "key_points": ["Corps penché à 45° environ", "Pas courts et puissants", "Pousser avec les jambes, pas le dos", "Maintenir un rythme constant", "Core fortement engagé"]
  }',
  safety_prevention = '{
    "common_errors": ["Se redresser trop (perte de puissance)", "Pas trop longs", "Retenir sa respiration", "Partir trop vite"],
    "risk_zones": ["Région lombaire", "Épaules"],
    "safety_instructions": "S''échauffer les jambes avant. Choisir une charge adaptée. Maintenir une bonne posture même fatigué."
  }'
WHERE exercise_name ILIKE '%sled push%';

-- SLED PULL
UPDATE exercise_library SET 
  general_description = 'Exercice de traction de traîneau développant la force de tirage et le conditionnement. Mouvement HYROX standard.',
  positioning_criteria = '{
    "body_placement": "Face au traîneau à distance, tenant la corde, corps légèrement penché en arrière",
    "feet_position": "Pieds écartés largeur des épaules, genoux légèrement fléchis, position stable",
    "hands_grip": "Mains alternées sur la corde, prise ferme",
    "joint_alignment": "Corps légèrement incliné vers l''arrière pour contrebalancer la traction",
    "initial_posture": "Position stable et ancrée, core engagé, prêt à tirer"
  }',
  execution_criteria = '{
    "movement_flow": "Tirer la corde main sur main de façon alternée et continue. Maintenir une position stable et ancrée. Amener le traîneau jusqu''à soi.",
    "range_of_motion": "Amplitude complète des bras à chaque tirage. Mouvement continu jusqu''à ce que le traîneau arrive.",
    "speed_control": "Rythme régulier et soutenable. Mouvements fluides.",
    "breathing": "Respiration continue et régulière.",
    "key_points": ["Position stable et ancrée", "Tirer main sur main sans pause", "Utiliser le dos et les bras", "Core engagé pour stabiliser", "Rythme constant"]
  }',
  safety_prevention = '{
    "common_errors": ["Perdre l''équilibre vers l''avant", "Tractions trop courtes", "Position instable"],
    "risk_zones": ["Région lombaire", "Épaules", "Grip"],
    "safety_instructions": "S''ancrer solidement avant de tirer. Utiliser des gants si nécessaire pour le grip."
  }'
WHERE exercise_name ILIKE '%sled pull%';

-- SANDBAG LUNGES / FENTES SANDBAG
UPDATE exercise_library SET 
  general_description = 'Exercice de fentes avec sac lesté développant la force des membres inférieurs et l''endurance. Mouvement HYROX standard.',
  positioning_criteria = '{
    "body_placement": "Debout, sac de sable sur les épaules (position de squat arrière), corps vertical",
    "feet_position": "Pieds écartés largeur des hanches, prêts à faire un pas en avant",
    "hands_grip": "Mains tenant le sac sur les épaules, stabilisant la charge",
    "joint_alignment": "Colonne verticale, épaules au-dessus des hanches",
    "initial_posture": "Sac stable sur les trapèzes/épaules, corps gainé, regard droit devant"
  }',
  execution_criteria = '{
    "movement_flow": "Faire un grand pas en avant. Descendre en fléchissant les deux genoux jusqu''à ce que le genou arrière soit proche du sol. Pousser avec le pied avant pour se relever et faire le pas suivant. Alterner les jambes.",
    "range_of_motion": "Pas long, descente jusqu''à 90° aux deux genoux, genou arrière proche du sol.",
    "speed_control": "Pas contrôlés et réguliers. Maintenir un rythme constant.",
    "breathing": "Respiration régulière à chaque pas.",
    "key_points": ["Buste vertical malgré la charge", "Pas suffisamment longs", "Genou arrière proche du sol", "Poids sur le talon du pied avant", "Rythme régulier"]
  }',
  safety_prevention = '{
    "common_errors": ["Buste qui penche vers l''avant", "Pas trop courts", "Genoux qui s''effondrent vers l''intérieur"],
    "risk_zones": ["Genoux", "Région lombaire", "Épaules"],
    "safety_instructions": "S''assurer que le sac est bien positionné sur les épaules. Maintenir le buste vertical. Adapter la charge au niveau."
  }'
WHERE exercise_name ILIKE '%sandbag%lunge%' OR exercise_name ILIKE '%lunge%sandbag%';

-- GOOD MORNING
UPDATE exercise_library SET 
  general_description = 'Exercice de hip hinge développant les ischio-jambiers, fessiers et érecteurs du rachis. Excellent pour la chaîne postérieure.',
  positioning_criteria = '{
    "body_placement": "Debout, barre sur les trapèzes comme pour un squat, pieds écartés largeur des hanches",
    "feet_position": "Pieds parallèles ou légèrement vers l''extérieur, écartés largeur des hanches",
    "hands_grip": "Mains sur la barre comme pour un back squat, omoplates serrées",
    "joint_alignment": "Colonne neutre, genoux légèrement fléchis",
    "initial_posture": "Barre positionnée sur les trapèzes, dos droit, regard vers l''avant"
  }',
  execution_criteria = '{
    "movement_flow": "Fléchir les hanches en poussant les fessiers vers l''arrière (hip hinge). Le buste s''incline vers l''avant tout en gardant le dos droit. Descendre jusqu''à ce que le buste soit proche de l''horizontale. Remonter en contractant les fessiers et ischio-jambiers.",
    "range_of_motion": "Flexion de hanche jusqu''à 90° environ (buste proche de l''horizontale), selon la souplesse.",
    "speed_control": "Descente contrôlée (2-3 sec). Remontée contrôlée (2 sec).",
    "breathing": "Inspiration et gainage avant la descente. Expiration pendant la remontée.",
    "key_points": ["C''est un hip hinge, pas une flexion du dos", "Dos droit et rigide tout le mouvement", "Poids sur les talons", "Genoux légèrement fléchis mais fixes", "Contracter les fessiers pour remonter"]
  }',
  safety_prevention = '{
    "common_errors": ["Arrondir le dos", "Fléchir excessivement les genoux (transformer en squat)", "Descendre trop bas pour sa mobilité", "Hyperextension en haut"],
    "risk_zones": ["Région lombaire"],
    "safety_instructions": "Commencer avec des charges très légères. Maîtriser le hip hinge. Ne pas forcer l''amplitude au-delà de sa mobilité."
  }'
WHERE exercise_name ILIKE '%good morning%';

-- ROMANIAN DEADLIFT / RDL
UPDATE exercise_library SET 
  general_description = 'Variante du soulevé de terre ciblant les ischio-jambiers et les fessiers. Excellent pour le développement de la chaîne postérieure.',
  positioning_criteria = '{
    "body_placement": "Debout, barre tenue devant les cuisses, bras tendus",
    "feet_position": "Pieds écartés largeur des hanches, parallèles ou légèrement vers l''extérieur",
    "hands_grip": "Mains en pronation sur la barre, écartées légèrement plus que les épaules",
    "joint_alignment": "Colonne neutre, genoux légèrement fléchis et fixes, épaules en arrière",
    "initial_posture": "Debout droit, barre contre les cuisses, omoplates engagées, dos droit"
  }',
  execution_criteria = '{
    "movement_flow": "Fléchir les hanches en poussant les fessiers vers l''arrière, permettant à la barre de descendre le long des cuisses. Garder la barre proche du corps. Descendre jusqu''à sentir l''étirement des ischio-jambiers. Remonter en contractant les fessiers.",
    "range_of_motion": "Descente jusqu''à mi-tibia ou selon la souplesse (étirement ischio-jambiers). Pas jusqu''au sol comme le deadlift conventionnel.",
    "speed_control": "Descente lente et contrôlée (3 sec). Remontée contrôlée (2 sec).",
    "breathing": "Inspiration avant la descente. Gainage maintenu. Expiration en remontant.",
    "key_points": ["Hip hinge pur (genoux fixes)", "Barre proche du corps tout le temps", "Dos droit et rigide", "Sentir l''étirement des ischio-jambiers en bas", "Contracter les fessiers pour remonter"]
  }',
  safety_prevention = '{
    "common_errors": ["Arrondir le dos", "Plier les genoux excessivement", "Barre qui s''éloigne du corps", "Descendre trop bas au-delà de sa mobilité"],
    "risk_zones": ["Région lombaire", "Ischio-jambiers"],
    "safety_instructions": "Respecter sa mobilité d''ischio-jambiers. Ne pas forcer l''amplitude. Garder le dos droit impérativement."
  }'
WHERE exercise_name ILIKE '%romanian deadlift%' OR exercise_name ILIKE '%rdl%';

-- BIRD DOG
UPDATE exercise_library SET 
  general_description = 'Exercice de stabilisation développant le core et la coordination controlatérale. Excellent pour la prévention lombaire.',
  positioning_criteria = '{
    "body_placement": "À quatre pattes, mains sous les épaules, genoux sous les hanches",
    "feet_position": "Genoux au sol, écartés largeur des hanches",
    "hands_grip": "Mains à plat, doigts vers l''avant, épaules au-dessus des poignets",
    "joint_alignment": "Colonne neutre (dos plat), tête dans le prolongement de la colonne",
    "initial_posture": "Position de quadrupédie stable, dos plat, abdominaux légèrement contractés"
  }',
  execution_criteria = '{
    "movement_flow": "Étendre simultanément un bras vers l''avant et la jambe opposée vers l''arrière. Maintenir le dos stable et plat. Le bras, le corps et la jambe forment une ligne. Revenir à la position initiale et alterner.",
    "range_of_motion": "Extension complète du bras (parallèle au sol) et de la jambe (parallèle au sol).",
    "speed_control": "Mouvement lent et contrôlé (3-4 sec par répétition). Pause en extension.",
    "breathing": "Expiration pendant l''extension. Inspiration au retour.",
    "key_points": ["Dos plat et stable (pas de rotation)", "Bras et jambe parallèles au sol", "Mouvement controlatéral", "Core engagé pour stabiliser", "Pas de précipitation"]
  }',
  safety_prevention = '{
    "common_errors": ["Rotation du bassin ou des épaules", "Dos qui s''arque", "Mouvements trop rapides", "Perte d''équilibre"],
    "risk_zones": ["Région lombaire"],
    "safety_instructions": "Se concentrer sur la stabilité plutôt que l''amplitude. Garder le regard vers le sol."
  }'
WHERE exercise_name ILIKE '%bird dog%';

-- WORLD''S GREATEST STRETCH
UPDATE exercise_library SET 
  general_description = 'Étirement dynamique complet ciblant hanches, thorax, ischio-jambiers et épaules. Excellent pour l''échauffement et la mobilité.',
  positioning_criteria = '{
    "body_placement": "Position de fente basse, une main au sol, l''autre prête à s''élever",
    "feet_position": "Pied avant à plat à côté de la main au sol, pied arrière sur les orteils",
    "hands_grip": "Une main au sol pour le support, l''autre libre pour la rotation",
    "joint_alignment": "Genou avant aligné avec la cheville, jambe arrière tendue",
    "initial_posture": "Position de fente profonde, corps stable"
  }',
  execution_criteria = '{
    "movement_flow": "1) En position de fente, main au sol à l''intérieur du pied avant. 2) Rotation thoracique en levant le bras vers le plafond, regard suit la main. 3) Revenir et pousser les hanches vers l''arrière en tendant la jambe avant (étirement ischio). 4) Revenir en fente et alterner ou répéter.",
    "range_of_motion": "Rotation thoracique maximale. Étirement ischio-jambier contrôlé.",
    "speed_control": "Mouvement fluide et continu. 3-5 secondes par position.",
    "breathing": "Respiration normale et continue.",
    "key_points": ["Rotation thoracique, pas lombaire", "Maintenir le pied arrière actif", "Étirement progressif, pas forcé", "Mouvement fluide entre les positions"]
  }',
  safety_prevention = '{
    "common_errors": ["Forcer la rotation", "Genou avant qui dépasse excessivement", "Mouvements saccadés"],
    "risk_zones": ["Genoux", "Région lombaire"],
    "safety_instructions": "Progresser doucement dans l''amplitude. Utiliser un support si l''équilibre est difficile."
  }'
WHERE exercise_name ILIKE '%world%greatest%stretch%';

-- HIGH KNEES / MONTÉES DE GENOUX
UPDATE exercise_library SET 
  general_description = 'Exercice de drill athlétique développant la coordination, la réactivité et la préparation à la course.',
  positioning_criteria = '{
    "body_placement": "Debout, corps vertical et gainé, bras fléchis à 90°",
    "feet_position": "Pieds parallèles, écartés largeur des hanches, sur la pointe des pieds",
    "hands_grip": "Bras fléchis, prêts à accompagner le mouvement",
    "joint_alignment": "Corps vertical, épaules au-dessus des hanches",
    "initial_posture": "Position athlétique prête à bouger"
  }',
  execution_criteria = '{
    "movement_flow": "Lever alternativement les genoux vers la poitrine (cuisse parallèle au sol) en restant sur place. Les bras accompagnent le mouvement en opposition. Rester sur la pointe des pieds.",
    "range_of_motion": "Genoux jusqu''à la hauteur des hanches (cuisse parallèle au sol).",
    "speed_control": "Rythme rapide et régulier. Cadence élevée.",
    "breathing": "Respiration régulière et rythmée.",
    "key_points": ["Genoux hauts (parallèle au sol)", "Rester sur les pointes de pieds", "Corps vertical (pas de penchement)", "Bras actifs en opposition", "Cadence rapide"]
  }',
  safety_prevention = '{
    "common_errors": ["Genoux pas assez hauts", "Pencher le buste en arrière", "Atterrir sur les talons"],
    "risk_zones": ["Mollets (fatigue)", "Chevilles"],
    "safety_instructions": "Échauffer les mollets avant. Surface appropriée. Maintenir une bonne technique même à haute cadence."
  }'
WHERE exercise_name ILIKE '%high knee%' OR exercise_name ILIKE '%montée%genou%';

-- A-SKIP / SKIPPING
UPDATE exercise_library SET 
  general_description = 'Drill athlétique fondamental développant la mécanique de course, la coordination et la réactivité.',
  positioning_criteria = '{
    "body_placement": "Debout, corps vertical, bras fléchis à 90°",
    "feet_position": "Pieds parallèles, poids sur l''avant des pieds",
    "hands_grip": "Bras fléchis, prêts à accompagner le mouvement",
    "joint_alignment": "Corps aligné et vertical",
    "initial_posture": "Position athlétique de course"
  }',
  execution_criteria = '{
    "movement_flow": "Combiner un sautillement avec une montée de genou. Le genou monte pendant la phase de vol du sautillement. Atterrir sur le pied opposé et alterner. Les bras accompagnent en opposition.",
    "range_of_motion": "Genou jusqu''à 90° (cuisse parallèle au sol). Petit sautillement.",
    "speed_control": "Rythme régulier. Commencer lentement pour maîtriser la coordination.",
    "breathing": "Respiration naturelle et rythmée.",
    "key_points": ["Coordination saut + montée de genou", "Pied de sol actif (contact au sol rapide)", "Bras en opposition", "Posture verticale", "Rythme régulier"]
  }',
  safety_prevention = '{
    "common_errors": ["Perte de coordination", "Rythme irrégulier", "Amplitude insuffisante"],
    "risk_zones": ["Chevilles", "Mollets"],
    "safety_instructions": "Apprendre lentement avant d''accélérer. Surface plane et stable."
  }'
WHERE exercise_name ILIKE '%skip%';

-- BUTT KICKS / TALONS-FESSES
UPDATE exercise_library SET 
  general_description = 'Drill athlétique développant la coordination et la vitesse de cycle de jambe.',
  positioning_criteria = '{
    "body_placement": "Debout, corps légèrement penché vers l''avant, bras fléchis",
    "feet_position": "Pieds parallèles, sur la pointe des pieds",
    "hands_grip": "Bras fléchis accompagnant le mouvement",
    "joint_alignment": "Corps légèrement penché vers l''avant",
    "initial_posture": "Position de course légèrement penchée"
  }',
  execution_criteria = '{
    "movement_flow": "En courant sur place ou en avançant lentement, ramener alternativement les talons vers les fessiers. Les cuisses restent relativement verticales.",
    "range_of_motion": "Talons touchant ou s''approchant des fessiers à chaque foulée.",
    "speed_control": "Cadence rapide. Mouvement continu et fluide.",
    "breathing": "Respiration régulière.",
    "key_points": ["Talons vers les fesses, pas les genoux vers l''avant", "Cuisses relativement verticales", "Rester sur les pointes de pieds", "Cadence rapide", "Corps légèrement penché"]
  }',
  safety_prevention = '{
    "common_errors": ["Lever les genoux au lieu des talons", "Rythme trop lent"],
    "risk_zones": ["Quadriceps (fatigue)", "Mollets"],
    "safety_instructions": "Échauffer les jambes avant. Maintenir une bonne technique."
  }'
WHERE exercise_name ILIKE '%butt kick%' OR exercise_name ILIKE '%talon%fesse%';