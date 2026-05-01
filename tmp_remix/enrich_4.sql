-- ============================================
-- DESCRIPTIONS BIOMÉCANIQUES DÉTAILLÉES
-- Partie 4: Gainage/Core, Plyométrie, Cardio
-- ============================================

-- PLANK / PLANCHE
UPDATE exercise_library SET 
  general_description = 'Exercice isométrique fondamental de gainage développant la stabilité du tronc. Renforce les abdominaux, obliques, érecteurs du rachis et muscles profonds du core.',
  positioning_criteria = '{
    "body_placement": "En appui sur les avant-bras et les orteils, corps en ligne droite de la tête aux talons",
    "feet_position": "Pieds écartés largeur des hanches ou joints, orteils au sol, talons poussés vers l''arrière",
    "hands_grip": "Avant-bras au sol, coudes sous les épaules, mains à plat ou poings fermés",
    "joint_alignment": "Épaules au-dessus des coudes, hanches alignées avec épaules et chevilles, tête dans le prolongement de la colonne",
    "initial_posture": "Corps rigide et gainé, abdominaux contractés, fessiers serrés, omoplates légèrement écartées"
  }',
  execution_criteria = '{
    "movement_flow": "Maintenir la position statique en contractant tous les muscles du core. Respirer normalement tout en maintenant la tension. Éviter tout mouvement ou affaissement.",
    "range_of_motion": "Position statique maintenue. Aucun mouvement.",
    "speed_control": "Maintien isométrique constant. Durée progressive selon le niveau.",
    "breathing": "Respiration normale et continue. Ne pas bloquer la respiration.",
    "key_points": ["Corps aligné de la tête aux talons", "Pas de cambrure ni d''arrondissement du dos", "Fessiers et abdominaux contractés", "Regard vers le sol", "Épaules loin des oreilles"]
  }',
  safety_prevention = '{
    "common_errors": ["Hanches qui s''affaissent vers le sol", "Hanches trop hautes (position de pyramide)", "Tête qui tombe vers le sol", "Retenir sa respiration"],
    "risk_zones": ["Région lombaire", "Épaules"],
    "safety_instructions": "Commencer par des durées courtes et progresser. Arrêter si la position ne peut plus être maintenue. Utiliser un miroir pour vérifier l''alignement."
  }'
WHERE exercise_name ILIKE '%plank%' OR exercise_name ILIKE '%planche%';

-- SIDE PLANK / PLANCHE LATÉRALE
UPDATE exercise_library SET 
  general_description = 'Exercice isométrique de gainage latéral développant les obliques et la stabilité du tronc dans le plan frontal.',
  positioning_criteria = '{
    "body_placement": "En appui sur un avant-bras et le côté du pied, corps en ligne droite",
    "feet_position": "Pieds empilés l''un sur l''autre ou le pied supérieur devant l''inférieur pour plus de stabilité",
    "hands_grip": "Avant-bras au sol, coude sous l''épaule, main au sol ou poing fermé. Bras supérieur le long du corps ou vers le plafond.",
    "joint_alignment": "Épaule au-dessus du coude, hanches alignées avec épaules et chevilles, pas de rotation du buste",
    "initial_posture": "Corps rigide en ligne droite, obliques et fessiers contractés, regard droit devant"
  }',
  execution_criteria = '{
    "movement_flow": "Maintenir la position latérale en contractant les obliques. Hanches hautes et alignées. Respirer normalement.",
    "range_of_motion": "Position statique maintenue.",
    "speed_control": "Maintien isométrique. Alterner les côtés.",
    "breathing": "Respiration normale et continue.",
    "key_points": ["Hanches hautes et alignées", "Pas de rotation du buste", "Obliques fortement contractés", "Corps en ligne droite de la tête aux pieds"]
  }',
  safety_prevention = '{
    "common_errors": ["Hanches qui s''affaissent", "Rotation du buste vers l''avant ou l''arrière", "Épaule qui remonte vers l''oreille"],
    "risk_zones": ["Épaule", "Région lombaire"],
    "safety_instructions": "Commencer avec les genoux au sol si nécessaire. Vérifier l''alignement régulièrement."
  }'
WHERE exercise_name ILIKE '%side plank%' OR exercise_name ILIKE '%planche latérale%';

-- HOLLOW HOLD
UPDATE exercise_library SET 
  general_description = 'Position fondamentale de gymnastique développant la force du core et la stabilité. Base de nombreux mouvements gymnastiques.',
  positioning_criteria = '{
    "body_placement": "Allongé sur le dos, bras tendus au-dessus de la tête, jambes tendues et légèrement soulevées",
    "feet_position": "Jambes tendues, jointes, soulevées du sol (15-30 cm)",
    "hands_grip": "Bras tendus au-dessus de la tête, dans le prolongement du corps",
    "joint_alignment": "Bas du dos plaqué au sol, lombaires en contact avec le sol",
    "initial_posture": "Corps en forme de banane concave, tête légèrement soulevée, regard vers les orteils"
  }',
  execution_criteria = '{
    "movement_flow": "Maintenir la position creuse en contractant les abdominaux. Le bas du dos reste plaqué au sol tout le temps.",
    "range_of_motion": "Position statique. Plus les bras et jambes sont bas, plus c''est difficile.",
    "speed_control": "Maintien isométrique constant.",
    "breathing": "Respiration contrôlée, superficielle mais continue.",
    "key_points": ["Bas du dos collé au sol (pas de cambrure)", "Omoplates légèrement décollées", "Regard vers les orteils", "Corps en forme de croissant"]
  }',
  safety_prevention = '{
    "common_errors": ["Cambrure du bas du dos (perte de contact avec le sol)", "Tête qui tombe en arrière", "Bras ou jambes trop bas causant la perte de position"],
    "risk_zones": ["Région lombaire"],
    "safety_instructions": "Si le dos se cambre, relever légèrement les jambes. Progresser graduellement en abaissant les membres."
  }'
WHERE exercise_name ILIKE '%hollow%';

-- DEAD BUG
UPDATE exercise_library SET 
  general_description = 'Exercice anti-extension développant le contrôle du core et la coordination. Excellent pour la stabilité lombaire.',
  positioning_criteria = '{
    "body_placement": "Allongé sur le dos, bras tendus vers le plafond, hanches et genoux fléchis à 90°",
    "feet_position": "Genoux au-dessus des hanches, tibias parallèles au sol, pieds relaxés",
    "hands_grip": "Bras tendus vers le plafond, mains au-dessus des épaules",
    "joint_alignment": "Bas du dos plaqué au sol, hanches et genoux à 90°",
    "initial_posture": "Position de table inversée, lombaires en contact avec le sol, regard vers le plafond"
  }',
  execution_criteria = '{
    "movement_flow": "Abaisser simultanément un bras vers l''arrière et la jambe opposée vers l''avant, sans toucher le sol. Maintenir le bas du dos plaqué au sol. Revenir à la position initiale et alterner.",
    "range_of_motion": "Bras et jambe opposés s''étendent jusqu''à être proches du sol, puis retour.",
    "speed_control": "Mouvement lent et contrôlé (3-4 sec par répétition). Pas de précipitation.",
    "breathing": "Expiration pendant l''extension. Inspiration pendant le retour.",
    "key_points": ["Le bas du dos ne doit jamais décoller du sol", "Mouvement controlatéral (bras droit + jambe gauche)", "Contrôle total, pas d''élan", "Core engagé tout le temps"]
  }',
  safety_prevention = '{
    "common_errors": ["Bas du dos qui se cambre quand les membres s''étendent", "Mouvement trop rapide", "Perte de contrôle du mouvement"],
    "risk_zones": ["Région lombaire"],
    "safety_instructions": "Réduire l''amplitude si le dos se cambre. Commencer par une jambe à la fois si nécessaire."
  }'
WHERE exercise_name ILIKE '%dead bug%';

-- RUSSIAN TWIST
UPDATE exercise_library SET 
  general_description = 'Exercice de rotation développant les obliques et la force rotationnelle du tronc.',
  positioning_criteria = '{
    "body_placement": "Assis au sol, buste incliné vers l''arrière (45°), pieds au sol ou soulevés",
    "feet_position": "Pieds au sol (débutant) ou soulevés avec genoux fléchis (avancé)",
    "hands_grip": "Mains jointes devant la poitrine ou tenant un poids",
    "joint_alignment": "Buste incliné à 45°, colonne en position neutre (pas arrondie)",
    "initial_posture": "Core engagé, poitrine ouverte, regard droit devant"
  }',
  execution_criteria = '{
    "movement_flow": "Faire pivoter le buste d''un côté en gardant les hanches stables. Les mains suivent la rotation du buste. Revenir au centre et pivoter de l''autre côté.",
    "range_of_motion": "Rotation de 45° de chaque côté environ. Le mouvement vient du tronc, pas des bras.",
    "speed_control": "Mouvement contrôlé, pas trop rapide. Pause légère de chaque côté.",
    "breathing": "Expiration pendant la rotation. Respiration continue.",
    "key_points": ["La rotation vient du tronc, pas des bras", "Hanches stables (ne tournent pas)", "Poitrine reste ouverte", "Contrôle constant du mouvement"]
  }',
  safety_prevention = '{
    "common_errors": ["Arrondir le dos", "Les hanches qui tournent avec le buste", "Mouvement trop rapide sans contrôle"],
    "risk_zones": ["Région lombaire"],
    "safety_instructions": "Garder le dos droit. Réduire l''amplitude si nécessaire. Éviter les charges trop lourdes."
  }'
WHERE exercise_name ILIKE '%russian twist%';

-- MOUNTAIN CLIMBERS
UPDATE exercise_library SET 
  general_description = 'Exercice dynamique de conditionnement sollicitant le core, les épaules et le système cardiovasculaire.',
  positioning_criteria = '{
    "body_placement": "Position de pompe haute, mains sous les épaules, corps aligné",
    "feet_position": "Un pied en avant (genou vers la poitrine), un pied en arrière (jambe tendue)",
    "hands_grip": "Mains à plat, doigts écartés, épaules au-dessus des poignets",
    "joint_alignment": "Corps en ligne droite des épaules aux talons (du pied arrière)",
    "initial_posture": "Position de planche haute solide, core engagé, hanches basses et stables"
  }',
  execution_criteria = '{
    "movement_flow": "Alterner rapidement les jambes en ramenant un genou vers la poitrine pendant que l''autre jambe s''étend. Maintenir les hanches stables et basses tout le mouvement.",
    "range_of_motion": "Genou ramené vers la poitrine, puis extension complète en alternant.",
    "speed_control": "Rythme rapide et régulier. Vitesse adaptée au niveau.",
    "breathing": "Respiration régulière et rythmée. Ne pas retenir sa respiration.",
    "key_points": ["Hanches basses et stables (pas de rebond)", "Core engagé tout le temps", "Épaules au-dessus des poignets", "Mouvement fluide et rythmé"]
  }',
  safety_prevention = '{
    "common_errors": ["Hanches qui montent et descendent", "Épaules qui avancent devant les poignets", "Perte du gainage"],
    "risk_zones": ["Poignets", "Épaules", "Région lombaire"],
    "safety_instructions": "Maintenir une position de planche solide. Ralentir si la technique se dégrade."
  }'
WHERE exercise_name ILIKE '%mountain climber%';

-- FARMERS CARRY / MARCHE FERMIER
UPDATE exercise_library SET 
  general_description = 'Exercice de portage développant la force de grip, la stabilité du core et le conditionnement général.',
  positioning_criteria = '{
    "body_placement": "Debout, une charge lourde dans chaque main, corps vertical et gainé",
    "feet_position": "Pieds parallèles, prêts à marcher avec des pas normaux",
    "hands_grip": "Prise ferme sur les poignées, poignets droits, charges le long du corps",
    "joint_alignment": "Épaules basses et en arrière, colonne neutre et verticale",
    "initial_posture": "Corps gainé, poitrine ouverte, regard droit devant, charges près des cuisses"
  }',
  execution_criteria = '{
    "movement_flow": "Marcher en ligne droite avec des pas contrôlés. Maintenir le corps vertical et stable. Éviter le balancement latéral.",
    "range_of_motion": "Marche normale. Distance ou durée selon l''objectif.",
    "speed_control": "Pas courts et contrôlés. Vitesse modérée et régulière.",
    "breathing": "Respiration régulière et profonde. Ne pas bloquer.",
    "key_points": ["Corps vertical, pas de penchement", "Épaules basses et en arrière", "Grip ferme", "Pas contrôlés", "Core fortement engagé"]
  }',
  safety_prevention = '{
    "common_errors": ["Se pencher sur le côté", "Épaules qui remontent", "Pas trop longs ou précipités"],
    "risk_zones": ["Épaules", "Région lombaire", "Grip"],
    "safety_instructions": "Choisir une charge permettant de maintenir une bonne posture. Prévoir un espace dégagé pour marcher."
  }'
WHERE exercise_name ILIKE '%farmer%carry%' OR exercise_name ILIKE '%marche%fermier%';

-- SQUAT JUMP
UPDATE exercise_library SET 
  general_description = 'Exercice de plyométrie développant la puissance explosive des membres inférieurs.',
  positioning_criteria = '{
    "body_placement": "Debout, pieds écartés largeur des épaules, bras le long du corps ou mains derrière la tête",
    "feet_position": "Pieds parallèles ou légèrement vers l''extérieur, écartés largeur des épaules",
    "hands_grip": "Bras libres (accompagnent le mouvement) ou mains derrière la tête (plus difficile)",
    "joint_alignment": "Genoux alignés avec les pieds, colonne neutre",
    "initial_posture": "Position athlétique prête à sauter"
  }',
  execution_criteria = '{
    "movement_flow": "Descendre en squat (cuisses parallèles ou légèrement en dessous). Sans pause en bas, sauter de façon explosive vers le haut. Atterrir en douceur et absorber l''impact en descendant directement dans le squat suivant.",
    "range_of_motion": "Squat partiel à complet selon l''objectif, puis saut maximal.",
    "speed_control": "Descente contrôlée. Saut explosif. Atterrissage absorbé.",
    "breathing": "Inspiration en descendant. Expiration explosive pendant le saut.",
    "key_points": ["Descendre avant de sauter (pas de mini squat)", "Extension complète en l''air", "Atterrir en douceur (absorber l''impact)", "Enchaîner fluidement"]
  }',
  safety_prevention = '{
    "common_errors": ["Atterrissage dur (genoux verrouillés)", "Genoux qui s''effondrent à l''atterrissage", "Squat trop superficiel"],
    "risk_zones": ["Genoux", "Chevilles", "Région lombaire"],
    "safety_instructions": "Atterrir toujours sur l''avant des pieds. Maîtriser le squat avant d''ajouter le saut. Surface appropriée (pas de béton dur)."
  }'
WHERE exercise_name ILIKE '%squat jump%';

-- ROWING MACHINE / RAMEUR
UPDATE exercise_library SET 
  general_description = 'Exercice cardio complet sollicitant environ 86% des muscles du corps. Développe l''endurance cardiovasculaire et la force musculaire.',
  positioning_criteria = '{
    "body_placement": "Assis sur le siège du rameur, pieds sur les cale-pieds, mains sur la poignée",
    "feet_position": "Pieds sangles sur les cale-pieds, sangles au niveau de la base des orteils",
    "hands_grip": "Mains en pronation sur la poignée, légèrement plus écartées que les épaules",
    "joint_alignment": "Genoux fléchis en position de départ (catch), dos droit",
    "initial_posture": "Position de catch: genoux fléchis, tibias verticaux, buste penché vers l''avant, bras tendus"
  }',
  execution_criteria = '{
    "movement_flow": "CATCH (départ): genoux fléchis, buste penché vers l''avant. DRIVE (poussée): pousser avec les jambes, puis ouvrir les hanches, puis tirer avec les bras. FINISH (arrivée): jambes tendues, buste légèrement en arrière, poignée contre le bas des côtes. RECOVERY (retour): étendre les bras, pencher le buste, fléchir les genoux.",
    "range_of_motion": "Course complète du siège. Jambes de fléchies à tendues, bras de tendus à fléchis.",
    "speed_control": "Drive puissant (1 temps). Recovery plus lent (2 temps). Ratio 1:2.",
    "breathing": "Expiration pendant le drive. Inspiration pendant le recovery.",
    "key_points": ["Séquence: jambes > hanches > bras (drive) / bras > hanches > jambes (recovery)", "Dos droit tout le mouvement", "Ne pas tirer avec le dos", "Cadence régulière"]
  }',
  safety_prevention = '{
    "common_errors": ["Arrondir le dos", "Tirer avec les bras avant de pousser avec les jambes", "Hyperextension du dos en finish", "Cadence trop élevée sans puissance"],
    "risk_zones": ["Région lombaire", "Genoux"],
    "safety_instructions": "Apprendre la technique avant d''augmenter l''intensité. Garder le dos droit. Régler correctement la résistance."
  }'
WHERE exercise_name ILIKE '%row%' AND (station_name ILIKE '%cardio%' OR exercise_name ILIKE '%rameur%');

-- SKI ERG
UPDATE exercise_library SET 
  general_description = 'Exercice cardio simulant le ski de fond développant la puissance du haut du corps et l''endurance cardiovasculaire.',
  positioning_criteria = '{
    "body_placement": "Debout face à la machine, bras au-dessus de la tête tenant les poignées",
    "feet_position": "Pieds parallèles, écartés largeur des hanches, genoux légèrement fléchis",
    "hands_grip": "Mains en pronation sur les poignées, bras tendus au-dessus de la tête",
    "joint_alignment": "Corps aligné, légèrement sur la pointe des pieds au départ",
    "initial_posture": "Bras tendus vers le haut, corps gainé, prêt à tirer vers le bas"
  }',
  execution_criteria = '{
    "movement_flow": "Tirer les poignées vers le bas en fléchissant les hanches et en contractant les abdominaux. Les bras passent le long du corps jusqu''aux hanches. Remonter les bras de façon contrôlée pendant que le corps se redresse.",
    "range_of_motion": "Bras de au-dessus de la tête jusqu''aux hanches. Flexion des hanches accompagnant le mouvement.",
    "speed_control": "Tirée puissante. Retour contrôlé. Rythme régulier.",
    "breathing": "Expiration pendant la tirée. Inspiration pendant le retour.",
    "key_points": ["Utiliser la flexion des hanches (pas juste les bras)", "Engager les abdominaux", "Mouvement fluide et rythmé", "Ne pas se pencher trop en avant"]
  }',
  safety_prevention = '{
    "common_errors": ["Tirer seulement avec les bras", "Hyperextension du dos au retour", "Position statique des hanches"],
    "risk_zones": ["Épaules", "Région lombaire"],
    "safety_instructions": "Utiliser les hanches et le core, pas seulement les bras. Maintenir un gainage constant."
  }'
WHERE exercise_name ILIKE '%ski erg%';

-- ASSAULT/ECHO BIKE
UPDATE exercise_library SET 
  general_description = 'Exercice cardio intense utilisant les bras et les jambes simultanément. Excellent pour le conditionnement métabolique.',
  positioning_criteria = '{
    "body_placement": "Assis sur le siège, pieds sur les pédales, mains sur les poignées",
    "feet_position": "Pieds sangles ou placés sur les pédales, permettant le pédalage",
    "hands_grip": "Mains sur les poignées, prise ferme, bras actifs",
    "joint_alignment": "Hauteur du siège permettant une légère flexion du genou en bas de pédale",
    "initial_posture": "Buste légèrement penché vers l''avant, core engagé, prêt à pédaler"
  }',
  execution_criteria = '{
    "movement_flow": "Pédaler avec les jambes tout en poussant et tirant avec les bras de façon synchronisée. Les bras et les jambes travaillent en opposition (jambe droite pousse = bras droit tire).",
    "range_of_motion": "Pédalage complet. Mouvement complet des bras en push-pull.",
    "speed_control": "Cadence adaptée à l''objectif. Sprint ou endurance.",
    "breathing": "Respiration régulière et profonde. Adaptée à l''intensité.",
    "key_points": ["Utiliser activement les bras (pas passifs)", "Mouvement coordonné bras-jambes", "Core engagé pour stabiliser", "Maintenir une bonne posture"]
  }',
  safety_prevention = '{
    "common_errors": ["Bras passifs", "Posture affaissée", "Pédalage seulement avec les jambes"],
    "risk_zones": ["Épaules", "Région lombaire"],
    "safety_instructions": "Régler la hauteur du siège. Commencer progressivement en intensité. Maintenir le core engagé."
  }'
WHERE exercise_name ILIKE '%assault bike%' OR exercise_name ILIKE '%echo bike%';

-- RUNNING / COURSE
UPDATE exercise_library SET 
  general_description = 'Activité locomotrice fondamentale développant l''endurance cardiovasculaire et la capacité aérobie.',
  positioning_criteria = '{
    "body_placement": "Debout, corps légèrement penché vers l''avant, bras fléchis à 90°",
    "feet_position": "Attaque du sol sous le centre de gravité, pas devant le corps",
    "hands_grip": "Mains relaxées, doigts légèrement fléchis (comme tenir un oeuf)",
    "joint_alignment": "Alignement tête-épaules-hanches-pied d''appui",
    "initial_posture": "Corps détendu mais gainé, regard vers l''avant, épaules basses"
  }',
  execution_criteria = '{
    "movement_flow": "Foulée naturelle et économique. Le pied atterrit sous le centre de gravité. Les bras oscillent naturellement en opposition aux jambes. Extension complète de la hanche lors de la poussée.",
    "range_of_motion": "Longueur de foulée naturelle. Amplitude des bras coordonnée.",
    "speed_control": "Cadence de 170-180 pas/minute idéalement. Vitesse adaptée à l''objectif.",
    "breathing": "Respiration régulière, par le nez et/ou la bouche. Rythme adapté à l''intensité.",
    "key_points": ["Attaque du sol sous le centre de gravité", "Foulée légère (atterrissage silencieux)", "Corps légèrement penché vers l''avant", "Épaules relaxées, bras à 90°"]
  }',
  safety_prevention = '{
    "common_errors": ["Sur-striding (pied qui atterrit devant le corps)", "Tension excessive dans les épaules", "Foulée lourde (atterrissage bruyant)", "Mouvement vertical excessif"],
    "risk_zones": ["Genoux", "Chevilles", "Tibias", "Hanches"],
    "safety_instructions": "Échauffement progressif. Chaussures adaptées. Progression graduelle du volume. Surface appropriée si possible."
  }'
WHERE exercise_name ILIKE '%course%' OR exercise_name ILIKE '%run%';