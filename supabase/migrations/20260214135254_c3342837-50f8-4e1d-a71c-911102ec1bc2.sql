-- Drop existing check constraint and recreate with all rehab categories
ALTER TABLE public.exercise_library DROP CONSTRAINT exercise_library_category_check;

ALTER TABLE public.exercise_library ADD CONSTRAINT exercise_library_category_check CHECK (category = ANY (ARRAY[
  'halterophilie','halterophilie_snatch','halterophilie_clean','halterophilie_jerk','halterophilie_clean_jerk','halterophilie_pulls','halterophilie_positions','halterophilie_hang','halterophilie_blocks','halterophilie_complexes','halterophilie_squats','halterophilie_presses','halterophilie_pulls_strength',
  'upper_push','upper_pull','shoulders','arms','lower_push','lower_pull','glutes','hamstrings','calves','core','anti_rotation','musculation',
  'plyometrics','isometrics','explosive',
  'bodyweight_upper','bodyweight_lower','bodyweight_core','bodyweight_full','calisthenics','gymnastics','weighted_calisthenics',
  'crossfit_wod','crossfit_amrap','crossfit_emom','crossfit_fortime','crossfit_chipper','hyrox_simulation','hyrox_running','hyrox_stations','functional_fitness',
  'pilates_mat','pilates_reformer','yoga_flow','yoga_power','yoga_stretch','pilates_core',
  'reathletisation_lower','reathletisation_upper','reathletisation_trunk',
  'proprioception','neuromuscular','shoulder_stability','knee_stability','ankle_stability','hip_stability',
  'wrist_hand_rehab','elbow_rehab','balance_training',
  'eccentric','isometric_rehab','concentric_rehab',
  'rom_restoration','joint_mobilization','scar_tissue_work',
  'motor_control','functional_rehab','gait_retraining','running_rehab',
  'rotator_cuff','scapular_control','hamstring_rehab','quadriceps_rehab','calf_rehab','adductor_rehab','hip_flexor_rehab','spinal_stabilization','cervical_rehab',
  'prophylaxis','nordic_hamstring','copenhagen_adductor','theraband_exercises','aquatic_rehab','electrostimulation','cryotherapy_protocol','plyometric_rehab','agility_rehab','sport_specific_rehab',
  'ergo_rowerg','ergo_skierg','ergo_bikeerg','ergo_assault','ergo_treadmill','ergo_elliptical','ergo_stairmaster','ergo_versaclimber',
  'sled_push','sled_pull','sled_drag','prowler',
  'running_ef','running_seuil','running_vma','running_fractionne','running_sprint','running_cote','running_fartlek','running_tempo','running_recup','running_ppg','running_trail',
  'cardio','terrain','speed','agility','endurance','interval',
  'football_technique','football_tactical','football_finishing','football_possession',
  'handball_shooting','handball_defense','handball_fast_break',
  'basketball_shooting','basketball_dribbling','basketball_defense','basketball_transition',
  'volleyball_service','volleyball_attack','volleyball_block','volleyball_reception',
  'rugby_scrummage','rugby_lineout','rugby_tackle','rugby_ruck','rugby_passing','rugby_kicking',
  'judo_randori','judo_uchikomi','judo_nagekomi','judo_newaza','judo_kata',
  'aviron_technique','aviron_ergo','aviron_endurance',
  'bowling_technique','bowling_spare','bowling_strike',
  'athletisme_starting_blocks','athletisme_acceleration','athletisme_max_velocity','athletisme_sprint_endurance','athletisme_hurdle_drills','athletisme_hurdle_rhythm','athletisme_intervals','athletisme_tempo_runs','athletisme_long_run','athletisme_fartlek','athletisme_approach_work','athletisme_takeoff_drills','athletisme_flight_drills','athletisme_landing','athletisme_pole_vault_tech','athletisme_throwing_drills','athletisme_rotation_work','athletisme_release_drills','athletisme_implement_work',
  'warmup','warmup_dynamic','warmup_specific','activation','mobility','stretching','dynamic_stretching','foam_rolling','recovery','breathing','cooldown',
  'other'
]));