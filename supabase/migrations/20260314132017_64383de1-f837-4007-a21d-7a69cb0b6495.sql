ALTER TABLE exercise_library DROP CONSTRAINT exercise_library_category_check;

ALTER TABLE exercise_library ADD CONSTRAINT exercise_library_category_check CHECK (category = ANY (ARRAY[
  -- Haltérophilie
  'halterophilie', 'halterophilie_snatch', 'halterophilie_clean', 'halterophilie_jerk', 'halterophilie_clean_jerk',
  'halterophilie_pulls', 'halterophilie_positions', 'halterophilie_hang', 'halterophilie_blocks', 'halterophilie_complexes',
  'halterophilie_squats', 'halterophilie_presses', 'halterophilie_pulls_strength',
  -- Musculation
  'upper_push', 'upper_pull', 'shoulders', 'arms', 'lower_push', 'lower_pull', 'glutes', 'hamstrings', 'calves',
  'core', 'anti_rotation', 'musculation', 'isometrics', 'explosive',
  'force_max', 'force_vitesse', 'vitesse_force', 'puissance', 'hypertrophie', 'endurance_force',
  'excentrique', 'tempo_training', 'cluster_sets', 'contrast_training',
  -- Pliométrie
  'plyometrics', 'plyo_lower_bilateral', 'plyo_lower_unilateral', 'plyo_upper', 'plyo_depth_jumps',
  'plyo_box_jumps', 'plyo_bounds', 'plyo_reactive', 'plyo_horizontal', 'plyo_lateral', 'plyo_medball',
  -- Neuro / Cognitif
  'neuro_reaction', 'neuro_coordination', 'neuro_dual_task', 'neuro_decision_making',
  'neuro_visual_tracking', 'neuro_peripheral_vision', 'neuro_hand_eye', 'neuro_foot_eye',
  'neuro_cognitive_load', 'neuro_inhibition', 'neuro_spatial_awareness', 'neuro_rhythm',
  'neuro_laterality', 'neuro_priming',
  -- Poids de corps
  'bodyweight_upper', 'bodyweight_lower', 'bodyweight_core', 'bodyweight_full',
  'calisthenics', 'gymnastics', 'weighted_calisthenics',
  -- CrossFit / Hyrox
  'crossfit_wod', 'crossfit_amrap', 'crossfit_emom', 'crossfit_fortime', 'crossfit_chipper',
  'hyrox_simulation', 'hyrox_running', 'hyrox_stations', 'functional_fitness',
  -- Pilates / Yoga
  'pilates_mat', 'pilates_reformer', 'yoga_flow', 'yoga_power', 'yoga_stretch', 'pilates_core',
  -- Rehab
  'reathletisation_lower', 'reathletisation_upper', 'reathletisation_trunk',
  'proprioception', 'neuromuscular', 'shoulder_stability', 'knee_stability', 'ankle_stability',
  'hip_stability', 'wrist_hand_rehab', 'elbow_rehab', 'balance_training',
  'eccentric', 'isometric_rehab', 'concentric_rehab', 'rom_restoration', 'joint_mobilization',
  'scar_tissue_work', 'motor_control', 'functional_rehab', 'gait_retraining', 'running_rehab',
  'rotator_cuff', 'scapular_control', 'hamstring_rehab', 'quadriceps_rehab', 'calf_rehab',
  'adductor_rehab', 'hip_flexor_rehab', 'spinal_stabilization', 'cervical_rehab',
  'prophylaxis', 'nordic_hamstring', 'copenhagen_adductor', 'theraband_exercises',
  'aquatic_rehab', 'electrostimulation', 'cryotherapy_protocol', 'plyometric_rehab',
  'agility_rehab', 'sport_specific_rehab',
  -- Ergo
  'ergo_rowerg', 'ergo_skierg', 'ergo_bikeerg', 'ergo_assault', 'ergo_treadmill',
  'ergo_elliptical', 'ergo_stairmaster', 'ergo_versaclimber',
  -- Sled
  'sled_push', 'sled_pull', 'sled_drag', 'prowler',
  -- Course
  'running_ef', 'running_seuil', 'running_vma', 'running_fractionne', 'running_sprint',
  'running_cote', 'running_fartlek', 'running_tempo', 'running_recup', 'running_ppg', 'running_trail',
  'running_drills_warmup', 'running_drills_abc', 'running_drills_montees_genoux',
  'running_drills_talons_fesses', 'running_drills_skipping', 'running_drills_griffes',
  'running_drills_carioca', 'running_drills_lateral', 'running_drills_jambes_tendues',
  'running_drills_foulees_bondissantes', 'running_drills_coordination', 'running_drills_pose_pied',
  'running_drills_frequence', 'running_drills_amplitude', 'running_drills_departs',
  'running_acceleration_work', 'running_max_velocity', 'running_deceleration',
  'running_sprint_resiste', 'running_sprint_assiste', 'running_relays',
  'running_hurdle_mobility', 'running_hurdle_rhythm', 'running_hurdle_trail_leg',
  'running_hurdle_lead_leg', 'running_hurdle_spacing',
  -- Autres
  'cardio', 'terrain', 'speed', 'agility', 'endurance', 'interval',
  'football_technique', 'football_tactical', 'football_finishing', 'football_possession',
  'handball_shooting', 'handball_defense', 'handball_fast_break',
  'basketball_shooting', 'basketball_dribbling', 'basketball_defense', 'basketball_transition',
  'volleyball_service', 'volleyball_attack', 'volleyball_block', 'volleyball_reception',
  'rugby_scrummage', 'rugby_lineout', 'rugby_tackle', 'rugby_ruck', 'rugby_passing', 'rugby_kicking',
  'judo_randori', 'judo_uchikomi', 'judo_nagekomi', 'judo_newaza', 'judo_kata',
  'aviron_technique', 'aviron_ergo', 'aviron_endurance',
  'bowling_technique', 'bowling_spare', 'bowling_strike',
  'athletisme_starting_blocks', 'athletisme_acceleration', 'athletisme_max_velocity',
  'athletisme_sprint_endurance', 'athletisme_hurdle_drills', 'athletisme_hurdle_rhythm',
  'athletisme_intervals', 'athletisme_tempo_runs', 'athletisme_long_run', 'athletisme_fartlek',
  'athletisme_approach_work', 'athletisme_takeoff_drills', 'athletisme_flight_drills',
  'athletisme_landing', 'athletisme_pole_vault_tech', 'athletisme_throwing_drills',
  'athletisme_rotation_work', 'athletisme_release_drills', 'athletisme_implement_work',
  'warmup', 'warmup_dynamic', 'warmup_specific', 'activation', 'mobility', 'stretching',
  'dynamic_stretching', 'foam_rolling', 'recovery', 'breathing', 'cooldown', 'other'
]::text[]));