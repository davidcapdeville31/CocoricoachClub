import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PerformanceReference {
  id: string;
  player_id: string;
  category_id: string;
  test_date: string;
  source_type: string;
  source_id: string | null;
  ref_vmax_ms: number | null;
  ref_vmax_kmh: number | null;
  ref_acceleration_max: number | null;
  ref_deceleration_max: number | null;
  ref_sprint_distance_m: number | null;
  ref_time_40m_seconds: number | null;
  ref_player_load_per_min: number | null;
  ref_high_intensity_distance_per_min: number | null;
  ref_impacts_per_min: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReferenceInput {
  player_id: string;
  category_id: string;
  test_date: string;
  source_type: "speed_test" | "gps_session" | "manual";
  source_id?: string;
  ref_vmax_ms?: number;
  ref_vmax_kmh?: number;
  ref_acceleration_max?: number;
  ref_deceleration_max?: number;
  ref_sprint_distance_m?: number;
  ref_time_40m_seconds?: number;
  ref_player_load_per_min?: number;
  ref_high_intensity_distance_per_min?: number;
  ref_impacts_per_min?: number;
  notes?: string;
}

export function usePlayerReferences(categoryId: string, playerId?: string) {
  return useQuery({
    queryKey: ["player_performance_references", categoryId, playerId],
    queryFn: async () => {
      let query = supabase
        .from("player_performance_references")
        .select("*")
        .eq("category_id", categoryId)
        .eq("is_active", true);
      
      if (playerId) {
        query = query.eq("player_id", playerId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as PerformanceReference[];
    },
    enabled: !!categoryId,
  });
}

export function useActiveReference(categoryId: string, playerId: string) {
  return useQuery({
    queryKey: ["player_active_reference", categoryId, playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_performance_references")
        .select("*")
        .eq("category_id", categoryId)
        .eq("player_id", playerId)
        .eq("is_active", true)
        .maybeSingle();
      
      if (error) throw error;
      return data as PerformanceReference | null;
    },
    enabled: !!categoryId && !!playerId,
  });
}

export function useCreatePerformanceReference() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateReferenceInput) => {
      // First, deactivate any existing active reference for this player
      await supabase
        .from("player_performance_references")
        .update({ is_active: false })
        .eq("player_id", input.player_id)
        .eq("category_id", input.category_id)
        .eq("is_active", true);
      
      // Then create the new reference
      const { data, error } = await supabase
        .from("player_performance_references")
        .insert({
          ...input,
          is_active: true,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ["player_performance_references", variables.category_id] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["player_active_reference", variables.category_id, variables.player_id] 
      });
    },
    onError: (error: Error) => {
      console.error("Error creating performance reference:", error);
      toast.error("Erreur lors de la création de la référence");
    },
  });
}

export function useBulkCreatePerformanceReferences() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (inputs: CreateReferenceInput[]) => {
      if (inputs.length === 0) return [];
      
      const categoryId = inputs[0].category_id;
      const playerIds = inputs.map(i => i.player_id);
      
      // Deactivate existing active references for all players
      await supabase
        .from("player_performance_references")
        .update({ is_active: false })
        .eq("category_id", categoryId)
        .in("player_id", playerIds)
        .eq("is_active", true);
      
      // Create all new references
      const { data, error } = await supabase
        .from("player_performance_references")
        .insert(inputs.map(input => ({
          ...input,
          is_active: true,
        })))
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      if (variables.length > 0) {
        queryClient.invalidateQueries({ 
          queryKey: ["player_performance_references", variables[0].category_id] 
        });
        variables.forEach(v => {
          queryClient.invalidateQueries({ 
            queryKey: ["player_active_reference", v.category_id, v.player_id] 
          });
        });
      }
    },
    onError: (error: Error) => {
      console.error("Error creating performance references:", error);
      toast.error("Erreur lors de la création des références");
    },
  });
}

// Calculate percentage relative to reference
export function calculatePercentageOfReference(
  currentValue: number | null | undefined,
  referenceValue: number | null | undefined
): number | null {
  if (!currentValue || !referenceValue || referenceValue === 0) return null;
  return Math.round((currentValue / referenceValue) * 100);
}
