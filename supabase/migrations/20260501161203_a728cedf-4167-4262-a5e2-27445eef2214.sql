-- Partie 6: Athlétisme/Running drills + Cardio/Endurance
UPDATE exercise_library SET 
  general_description = 'Sprints courts maximaux travaillant l''accélération sur les premiers mètres, phase clé de la performance en sports collectifs et individuels.',
  positioning_criteria = '{"body_placement": "Départ en position basse, projection vers l''avant", "feet_position": "Pied avant ancré, pied arrière prêt à pousser", "joint_alignment": "Tronc incliné ~45°, bras opposés aux jambes"}'::jsonb,
  execution_criteria = '{"movement_flow": "Poussée explosive, redressement progressif sur 15-20m", "range_of_motion": "Grandes foulées avec montée de genoux", "key_points": ["Pas de redressement précoce", "Bras puissants", "Regard bas au départ"]}'::jsonb,
  safety_prevention = '{"common_errors": ["Redressement trop tôt", "Foulées trop courtes"], "risk_zones": ["Ischio-jambiers", "Mollets"]}'::jsonb
WHERE exercise_name ILIKE '%accélération%' OR exercise_name ILIKE '%départ%';

UPDATE exercise_library SET 
  general_description = 'Éducatifs de course visant à améliorer la mécanique de foulée, la coordination et l''économie de course.',
  positioning_criteria = '{"body_placement": "Posture verticale, gainage actif", "feet_position": "Appui sur l''avant-pied", "joint_alignment": "Hanches hautes, épaules relâchées"}'::jsonb,
  execution_criteria = '{"movement_flow": "Mouvement rythmé et contrôlé", "range_of_motion": "Amplitude adaptée à l''éducatif", "key_points": ["Cadence régulière", "Coordination bras/jambes", "Pied actif"]}'::jsonb,
  safety_prevention = '{"common_errors": ["Posture avachie", "Talon qui claque"], "risk_zones": ["Tendon d''Achille", "Tibial antérieur"]}'::jsonb
WHERE station_name = 'Athlétisme/Running drills' AND (general_description IS NULL OR general_description = '');

UPDATE exercise_library SET 
  general_description = 'Travail cardiovasculaire à intensité contrôlée pour développer l''endurance aérobie et la capacité de récupération.',
  positioning_criteria = '{"body_placement": "Posture droite, gainage léger", "feet_position": "Appui adapté à l''appareil/activité", "joint_alignment": "Articulations alignées et souples"}'::jsonb,
  execution_criteria = '{"movement_flow": "Rythme régulier, respiration contrôlée", "range_of_motion": "Amplitude naturelle", "key_points": ["Maintenir zone cible FC", "Hydratation", "Posture stable"]}'::jsonb,
  safety_prevention = '{"common_errors": ["Intensité mal calibrée", "Posture avachie"], "risk_zones": ["Genoux", "Bas du dos"]}'::jsonb
WHERE station_name = 'Cardio/Endurance' AND (general_description IS NULL OR general_description = '');

-- Partie 7: Gainage/Core
UPDATE exercise_library SET 
  general_description = 'Exercices de gainage et de renforcement du tronc pour la stabilité, le transfert de force et la protection lombaire.',
  positioning_criteria = '{"body_placement": "Tronc gainé, bassin neutre", "feet_position": "Selon variante (au sol, suspendu, etc.)", "joint_alignment": "Colonne neutre, épaules basses"}'::jsonb,
  execution_criteria = '{"movement_flow": "Mouvement contrôlé, sans à-coups", "range_of_motion": "Amplitude maîtrisée", "key_points": ["Respiration continue", "Activation profonde", "Pas de cambrure excessive"]}'::jsonb,
  safety_prevention = '{"common_errors": ["Bassin en antéversion", "Apnée prolongée"], "risk_zones": ["Lombaires", "Cervicales"]}'::jsonb
WHERE station_name = 'Gainage/Core' AND (general_description IS NULL OR general_description = '');

-- Partie 8: Haltérophilie restants
UPDATE exercise_library SET 
  general_description = 'Mouvements d''haltérophilie ou dérivés exigeant explosivité, mobilité et coordination globale.',
  positioning_criteria = '{"body_placement": "Pieds largeur de bassin, dos gainé", "feet_position": "Appui pleine plante, ancrage solide", "joint_alignment": "Barre proche du corps, épaules au-dessus de la barre"}'::jsonb,
  execution_criteria = '{"movement_flow": "Tirage/poussée explosive, réception stable", "range_of_motion": "Amplitude complète selon mouvement", "key_points": ["Triple extension", "Verrouillage actif", "Trajectoire verticale"]}'::jsonb,
  safety_prevention = '{"common_errors": ["Dos rond", "Barre trop éloignée"], "risk_zones": ["Lombaires", "Épaules", "Poignets"]}'::jsonb
WHERE station_name = 'Haltérophilie' AND (general_description IS NULL OR general_description = '');

-- Partie 9: Poids de corps/Calisthenics
UPDATE exercise_library SET 
  general_description = 'Mouvements au poids du corps développant force relative, contrôle moteur et mobilité.',
  positioning_criteria = '{"body_placement": "Corps gainé, alignement tête-bassin-talons", "feet_position": "Selon variante", "joint_alignment": "Épaules engagées, scapulas actives"}'::jsonb,
  execution_criteria = '{"movement_flow": "Mouvement lent et contrôlé", "range_of_motion": "Amplitude complète et progressive", "key_points": ["Tension constante", "Respiration coordonnée", "Progression par paliers"]}'::jsonb,
  safety_prevention = '{"common_errors": ["Compensation lombaire", "Épaules hautes"], "risk_zones": ["Épaules", "Poignets", "Coudes"]}'::jsonb
WHERE station_name = 'Poids de corps/Calisthenics' AND (general_description IS NULL OR general_description = '');

-- Partie 10: Prévention/Renforcement
UPDATE exercise_library SET 
  general_description = 'Exercices de prévention et de renforcement ciblé pour stabiliser les articulations et réduire le risque de blessure.',
  positioning_criteria = '{"body_placement": "Position stable, alignement précis", "feet_position": "Selon exercice", "joint_alignment": "Articulation cible isolée"}'::jsonb,
  execution_criteria = '{"movement_flow": "Mouvement lent, qualité avant quantité", "range_of_motion": "Amplitude contrôlée et progressive", "key_points": ["Activation ciblée", "Respiration fluide", "Pas de compensation"]}'::jsonb,
  safety_prevention = '{"common_errors": ["Vitesse excessive", "Compensations"], "risk_zones": ["Articulation ciblée"]}'::jsonb
WHERE station_name = 'Prévention/Renforcement' AND (general_description IS NULL OR general_description = '');

-- Partie 11: Réathlétisation
UPDATE exercise_library SET 
  general_description = 'Exercices de réathlétisation visant un retour progressif à l''activité après blessure, dans le respect des paliers de charge.',
  positioning_criteria = '{"body_placement": "Posture sécurisée, contrôle constant", "feet_position": "Adaptée au stade de retour", "joint_alignment": "Alignement strict pour protéger la zone lésée"}'::jsonb,
  execution_criteria = '{"movement_flow": "Progression lente, écoute des sensations", "range_of_motion": "Amplitude progressive et indolore", "key_points": ["Respect du palier", "Validation médicale", "Charge adaptée"]}'::jsonb,
  safety_prevention = '{"common_errors": ["Brûler les étapes", "Ignorer la douleur"], "risk_zones": ["Zone récemment lésée"]}'::jsonb
WHERE station_name = 'Réathlétisation' AND (general_description IS NULL OR general_description = '');

-- Partie 12: Respiration
UPDATE exercise_library SET 
  general_description = 'Techniques respiratoires pour optimiser la récupération, la gestion du stress et la performance cardio-respiratoire.',
  positioning_criteria = '{"body_placement": "Position confortable, colonne neutre", "feet_position": "Au sol ou selon protocole", "joint_alignment": "Cage thoracique mobile, épaules basses"}'::jsonb,
  execution_criteria = '{"movement_flow": "Respiration rythmée selon protocole", "range_of_motion": "Amplitude diaphragmatique complète", "key_points": ["Inspiration nasale", "Expiration longue", "Régularité du rythme"]}'::jsonb,
  safety_prevention = '{"common_errors": ["Hyperventilation", "Tension cervicale"], "risk_zones": ["Système nerveux autonome"]}'::jsonb
WHERE station_name = 'Respiration' AND (general_description IS NULL OR general_description = '');

-- Partie 13: Row
UPDATE exercise_library SET 
  general_description = 'Travail au rameur sollicitant le corps entier, idéal pour l''endurance aérobie et la puissance.',
  positioning_criteria = '{"body_placement": "Dos droit, bassin engagé", "feet_position": "Pieds sanglés, appuis fermes", "joint_alignment": "Bras tendus en avant, épaules basses"}'::jsonb,
  execution_criteria = '{"movement_flow": "Jambes-tronc-bras en poussée, bras-tronc-jambes en retour", "range_of_motion": "Extension complète + retour contrôlé", "key_points": ["Poignée vers le sternum", "Pas de tirage uniquement bras", "Cadence stable"]}'::jsonb,
  safety_prevention = '{"common_errors": ["Dos rond", "Tirage avec les bras seuls"], "risk_zones": ["Lombaires", "Épaules"]}'::jsonb
WHERE station_name = 'Row' AND (general_description IS NULL OR general_description = '');

-- Partie 14: Tests & Évaluations
UPDATE exercise_library SET 
  general_description = 'Test standardisé d''évaluation des qualités physiques permettant de mesurer la progression et d''orienter la planification.',
  positioning_criteria = '{"body_placement": "Selon protocole standardisé", "feet_position": "Selon protocole", "joint_alignment": "Conditions reproductibles"}'::jsonb,
  execution_criteria = '{"movement_flow": "Respect strict du protocole", "range_of_motion": "Amplitude définie par le test", "key_points": ["Échauffement complet", "Conditions identiques", "Mesure précise"]}'::jsonb,
  safety_prevention = '{"common_errors": ["Échauffement insuffisant", "Protocole non respecté"], "risk_zones": ["Variable selon test"]}'::jsonb
WHERE station_name = 'Tests & Évaluations' AND (general_description IS NULL OR general_description = '');

-- Partie 15: Vitesse/Plyométrie
UPDATE exercise_library SET 
  general_description = 'Exercices de vitesse et de pliométrie développant la puissance explosive, la vitesse de course et la réactivité neuromusculaire.',
  positioning_criteria = '{"body_placement": "Posture athlétique, gainage actif", "feet_position": "Appuis dynamiques sur l''avant-pied", "joint_alignment": "Genoux dans l''axe des pieds"}'::jsonb,
  execution_criteria = '{"movement_flow": "Contact au sol bref et explosif", "range_of_motion": "Amplitude maximale en projection", "key_points": ["Qualité avant quantité", "Récupération complète", "Réception amortie"]}'::jsonb,
  safety_prevention = '{"common_errors": ["Volume excessif", "Réception jambes raides"], "risk_zones": ["Genoux", "Tendon d''Achille", "Ischios"]}'::jsonb
WHERE station_name = 'Vitesse/Plyométrie' AND (general_description IS NULL OR general_description = '');