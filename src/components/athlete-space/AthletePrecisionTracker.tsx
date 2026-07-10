import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarPlus, Loader2, Target } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { PrecisionFieldTracker } from "@/components/rugby/PrecisionFieldTracker";
import { BasketballPrecisionTracker } from "@/components/basketball/BasketballPrecisionTracker";
import { isBasketballPrecisionSport } from "@/lib/constants/basketballPrecisionExercises";

interface Props {
  categoryId: string;
  playerId: string;
  sportType?: string;
}

/**
 * Wrapper de l'interface staff de précision (jeu au pied / shooting basket),
 * verrouillée sur l'athlète connecté. Si aucune séance n'existe aujourd'hui,
 * l'athlète peut en créer une via l'edge function dédiée
 * (athlete-create-session) afin de pouvoir saisir ses stats individuelles.
 */
export function AthletePrecisionTracker({ categoryId, playerId, sportType }: Props) {
  const isBasket = isBasketballPrecisionSport(sportType);
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [creating, setCreating] = useState(false);

  const { data: todaySessions = [], isLoading } = useQuery({
    queryKey: ["today-training-sessions", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("id, session_date")
        .eq("category_id", categoryId)
        .eq("session_date", today)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const hasSession = todaySessions.length > 0;

  const handleCreateSession = async () => {
    setCreating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        toast.error("Session expirée, reconnectez-vous");
        return;
      }
      const { data, error } = await supabase.functions.invoke("athlete-create-session", {
        body: {
          category_id: categoryId,
          player_id: playerId,
          session_date: today,
          training_type: "individuel",
          notes: "Séance précision (jeu au pied) — créée par l'athlète",
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Création échouée");
      toast.success("Séance créée — vous pouvez saisir vos stats");
      await queryClient.invalidateQueries({ queryKey: ["today-training-sessions", categoryId] });
    } catch (e: any) {
      toast.error(e?.message || "Impossible de créer la séance");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-primary/5 p-3 text-xs text-muted-foreground">
        🦶 Saisissez vos séances individuelles de jeu au pied. Les données
        alimentent votre base personnelle de précision et sont uniquement les vôtres.
      </div>

      {!isLoading && !hasSession ? (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="py-6 text-center space-y-3">
            <CalendarPlus className="h-8 w-8 mx-auto text-amber-600" />
            <h3 className="font-semibold text-amber-800 dark:text-amber-200">
              Aucune séance planifiée aujourd'hui
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Créez une séance individuelle pour commencer à saisir vos stats de précision.
            </p>
            <Button onClick={handleCreateSession} disabled={creating} className="gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
              Créer une séance individuelle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <PrecisionFieldTracker
          categoryId={categoryId}
          lockedPlayerId={playerId}
        />
      )}
    </div>
  );
}
