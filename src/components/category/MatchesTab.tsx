import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Calendar } from "lucide-react";
import { AddMatchCalendarDialog } from "./matches/AddMatchCalendarDialog";
import { MatchCard } from "./matches/MatchCard";
import { format, isFuture, isPast } from "date-fns";
import { fr } from "date-fns/locale";

interface MatchesTabProps {
  categoryId: string;
}

export function MatchesTab({ categoryId }: MatchesTabProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { data: matches, isLoading } = useQuery({
    queryKey: ["matches", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("category_id", categoryId)
        .order("match_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const upcomingMatches = matches?.filter((m) => isFuture(new Date(m.match_date))) || [];
  const pastMatches = matches?.filter((m) => isPast(new Date(m.match_date))) || [];

  if (isLoading) {
    return <p className="text-muted-foreground">Chargement...</p>;
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card shadow-md">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Gestion des matchs
            </CardTitle>
            <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Ajouter un match
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(!matches || matches.length === 0) ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Aucun match programmé pour cette catégorie
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Créer le premier match
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {upcomingMatches.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-primary">
                    Matchs à venir ({upcomingMatches.length})
                  </h3>
                  <div className="space-y-3">
                    {upcomingMatches.map((match) => (
                      <MatchCard key={match.id} match={match} categoryId={categoryId} />
                    ))}
                  </div>
                </div>
              )}

              {pastMatches.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-muted-foreground">
                    Matchs passés ({pastMatches.length})
                  </h3>
                  <div className="space-y-3">
                    {pastMatches.reverse().map((match) => (
                      <MatchCard key={match.id} match={match} categoryId={categoryId} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AddMatchCalendarDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        categoryId={categoryId}
      />
    </div>
  );
}
