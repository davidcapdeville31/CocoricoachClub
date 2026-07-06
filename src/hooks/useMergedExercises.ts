import { useState, useEffect, useCallback } from 'react';
import { useCurrentUserIdentity } from '@/hooks/useCurrentUserIdentity';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface MergedExercise {
  id: string;
  exercise_name: string;
  station_name: string;
  exercise_type: string | null;
  description: string | null;
  general_description: string | null;
  positioning_criteria: unknown;
  execution_criteria: unknown;
  safety_prevention: unknown;
  tips: string | null;
  image_url: string | null;
  video_url: string | null;
  difficulty_level: string | null;
  muscles: string[] | null;
  equipment: string[] | null;
  joint_movements: string[] | null;
  is_default: boolean;
  coach_id: string | null;
  is_overridden: boolean;
  is_custom: boolean;
  override_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExerciseOverride {
  id?: string;
  coach_id: string;
  base_exercise_id: string;
  override_image_url?: string | null;
  override_video_url?: string | null;
  override_description?: string | null;
  override_general_description?: string | null;
  override_positioning_criteria?: unknown;
  override_execution_criteria?: unknown;
  override_safety_prevention?: unknown;
  override_tips?: string | null;
}

export function useMergedExercises() {
  const { isSuperAdmin } = useCurrentUserIdentity();
  const [exercises, setExercises] = useState<MergedExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchExercises = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Fallback to basic exercises for unauthenticated users
        const { data, error } = await supabase
          .from('exercise_library')
          .select('*')
          .eq('is_default', true)
          .order('exercise_name');
        
        if (error) throw error;
        
        setExercises((data || []).map(e => ({
          ...e,
          is_overridden: false,
          is_custom: false,
          override_id: null,
        })) as MergedExercise[]);
        return;
      }

      setUserId(user.id);

      // Use the merged exercises function
      const { data, error } = await supabase.rpc('get_merged_exercises_for_coach', {
        p_coach_id: user.id
      });

      if (error) throw error;
      
      setExercises((data || []) as MergedExercise[]);
    } catch (error) {
      console.error('Error fetching exercises:', error);
      toast.error('Erreur lors du chargement des exercices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  // Create or update an override for an admin exercise
  const saveOverride = async (override: ExerciseOverride) => {
    if (!userId) {
      toast.error('Vous devez être connecté');
      return false;
    }

    try {
      // Check if override exists
      const { data: existing } = await supabase
        .from('coach_exercise_overrides')
        .select('id')
        .eq('coach_id', userId)
        .eq('base_exercise_id', override.base_exercise_id)
        .single();

      if (existing) {
        // Update existing override
        const { error } = await supabase
          .from('coach_exercise_overrides')
          .update({
            override_image_url: override.override_image_url,
            override_video_url: override.override_video_url,
            override_description: override.override_description,
            override_general_description: override.override_general_description,
            override_positioning_criteria: override.override_positioning_criteria as Json,
            override_execution_criteria: override.override_execution_criteria as Json,
            override_safety_prevention: override.override_safety_prevention as Json,
            override_tips: override.override_tips,
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new override
        const { error } = await supabase
          .from('coach_exercise_overrides')
          .insert([{
            coach_id: userId,
            base_exercise_id: override.base_exercise_id,
            override_image_url: override.override_image_url,
            override_video_url: override.override_video_url,
            override_description: override.override_description,
            override_general_description: override.override_general_description,
            override_positioning_criteria: override.override_positioning_criteria as Json,
            override_execution_criteria: override.override_execution_criteria as Json,
            override_safety_prevention: override.override_safety_prevention as Json,
            override_tips: override.override_tips,
          }]);

        if (error) throw error;
      }

      toast.success('Modification sauvegardée');
      await fetchExercises();
      return true;
    } catch (error) {
      console.error('Error saving override:', error);
      toast.error('Erreur lors de la sauvegarde');
      return false;
    }
  };

  // Delete an override (revert to admin version)
  const deleteOverride = async (baseExerciseId: string) => {
    if (!userId) {
      toast.error('Vous devez être connecté');
      return false;
    }

    try {
      const { error } = await supabase
        .from('coach_exercise_overrides')
        .delete()
        .eq('coach_id', userId)
        .eq('base_exercise_id', baseExerciseId);

      if (error) throw error;

      toast.success('Override supprimé - exercice admin restauré');
      await fetchExercises();
      return true;
    } catch (error) {
      console.error('Error deleting override:', error);
      toast.error('Erreur lors de la suppression');
      return false;
    }
  };

  // Create a custom coach exercise
  const createCustomExercise = async (exercise: Partial<MergedExercise>) => {
    if (!userId) {
      toast.error('Vous devez être connecté');
      return false;
    }

    try {
      const insertData = {
        station_name: exercise.station_name || '',
        exercise_name: exercise.exercise_name || '',
        exercise_type: exercise.exercise_type,
        description: exercise.description,
        general_description: exercise.general_description,
        positioning_criteria: exercise.positioning_criteria as Json,
        execution_criteria: exercise.execution_criteria as Json,
        safety_prevention: exercise.safety_prevention as Json,
        tips: exercise.tips,
        image_url: exercise.image_url,
        video_url: exercise.video_url,
        difficulty_level: exercise.difficulty_level,
        muscles: exercise.muscles,
        equipment: exercise.equipment,
        coach_id: userId,
        is_default: false,
      };

      const { error } = await supabase
        .from('exercise_library')
        .insert([insertData]);

      if (error) throw error;

      toast.success('Exercice personnalisé créé');
      await fetchExercises();
      return true;
    } catch (error) {
      console.error('Error creating custom exercise:', error);
      toast.error('Erreur lors de la création');
      return false;
    }
  };

  // Update a custom coach exercise
  const updateCustomExercise = async (exerciseId: string, updates: Partial<MergedExercise>) => {
    if (!userId) {
      toast.error('Vous devez être connecté');
      return false;
    }

    try {
      // Build update object with only defined fields
      const updateData: Record<string, unknown> = {};
      if (updates.exercise_name !== undefined) updateData.exercise_name = updates.exercise_name;
      if (updates.station_name !== undefined) updateData.station_name = updates.station_name;
      if (updates.exercise_type !== undefined) updateData.exercise_type = updates.exercise_type;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.general_description !== undefined) updateData.general_description = updates.general_description;
      if (updates.positioning_criteria !== undefined) updateData.positioning_criteria = updates.positioning_criteria;
      if (updates.execution_criteria !== undefined) updateData.execution_criteria = updates.execution_criteria;
      if (updates.safety_prevention !== undefined) updateData.safety_prevention = updates.safety_prevention;
      if (updates.tips !== undefined) updateData.tips = updates.tips;
      if (updates.image_url !== undefined) updateData.image_url = updates.image_url;
      if (updates.video_url !== undefined) updateData.video_url = updates.video_url;
      if (updates.difficulty_level !== undefined) updateData.difficulty_level = updates.difficulty_level;
      if (updates.muscles !== undefined) updateData.muscles = updates.muscles;
      if (updates.equipment !== undefined) updateData.equipment = updates.equipment;

      const { error } = await supabase
        .from('exercise_library')
        .update(updateData as any)
        .eq('id', exerciseId)
        .eq('coach_id', userId)
        .eq('is_default', false);

      if (error) throw error;

      toast.success('Exercice mis à jour');
      await fetchExercises();
      return true;
    } catch (error) {
      console.error('Error updating custom exercise:', error);
      toast.error('Erreur lors de la mise à jour');
      return false;
    }
  };

  // Delete a custom coach exercise
  const deleteCustomExercise = async (exerciseId: string) => {
    if (!userId) {
      toast.error('Vous devez être connecté');
      return false;
    }

    try {
      const { error } = await supabase
        .from('exercise_library')
        .delete()
        .eq('id', exerciseId)
        .eq('coach_id', userId)
        .eq('is_default', false);

      if (error) throw error;

      toast.success('Exercice supprimé');
      await fetchExercises();
      return true;
    } catch (error) {
      console.error('Error deleting custom exercise:', error);
      toast.error('Erreur lors de la suppression');
      return false;
    }
  };

  return {
    exercises,
    loading,
    userId,
    isSuperAdmin,
    refetch: fetchExercises,
    saveOverride,
    deleteOverride,
    createCustomExercise,
    updateCustomExercise,
    deleteCustomExercise,
  };
}
