import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ExerciseMedia {
  image_url: string | null;
  youtube_url: string | null;
  description: string | null;
}

const normalizeExerciseName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

/**
 * Hook to look up exercise media (image/video/description) by exercise name.
 * Reads BOTH `name`/`exercise_name` keys and BOTH `youtube_url`/`video_url`,
 * plus `general_description`/`description` so that the Info "i" tooltip and
 * the Video camera icon work whatever column was filled when the exercise
 * was created.
 */
export function useExerciseMedia() {
  const { user } = useAuth();

  const { data: exercises } = useQuery({
    queryKey: ["exercise-library-media-v3", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_library")
        .select(
          "name, exercise_name, image_url, youtube_url, video_url, description, general_description",
        )
        .or(
          user
            ? `user_id.eq.${user.id},is_system.eq.true`
            : "is_system.eq.true",
        );
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const mediaMap = useMemo(() => {
    const map = new Map<string, ExerciseMedia>();

    exercises?.forEach((ex: any) => {
      const video = ex.youtube_url || ex.video_url || null;
      const desc = ex.general_description || ex.description || null;
      if (!ex.image_url && !video && !desc) return;

      const candidates = [ex.name, ex.exercise_name].filter(Boolean) as string[];
      candidates.forEach((raw) => {
        const key = normalizeExerciseName(raw);
        const existing = map.get(key);
        map.set(key, {
          image_url: ex.image_url || existing?.image_url || null,
          youtube_url: video || existing?.youtube_url || null,
          description: desc || existing?.description || null,
        });
      });
    });

    return map;
  }, [exercises]);

  const getMedia = (exerciseName: string): ExerciseMedia | null => {
    return mediaMap.get(normalizeExerciseName(exerciseName)) || null;
  };

  return { getMedia };
}
