import { useState } from "react";
import { useRecommendedExercises } from "@/hooks/useRecommendedExercises";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dumbbell, Sparkles, ExternalLink, Image as ImageIcon } from "lucide-react";

interface RecommendedExercisesCardProps {
  playerId: string;
}

/**
 * Phase 6 — Identité Athlète :
 * Affiche les exercices recommandés à l'athlète selon ses attributs
 * (performance_profile, discipline, poste).
 */
export function RecommendedExercisesCard({ playerId }: RecommendedExercisesCardProps) {
  const { recommendations, isLoading } = useRecommendedExercises(playerId, { limit: 18 });
  const [expanded, setExpanded] = useState(false);

  if (isLoading) return null;
  if (!recommendations.length) return null;

  const visible = expanded ? recommendations : recommendations.slice(0, 6);

  return (
    <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Exercices recommandés
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Sélection automatique selon le profil de performance, la discipline et le poste de l'athlète.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((ex) => (
            <div
              key={ex.id}
              className="group flex flex-col gap-2 rounded-xl border bg-background/60 backdrop-blur p-3 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-2">
                <div className="h-10 w-10 rounded-lg bg-muted/40 flex items-center justify-center shrink-0 overflow-hidden">
                  {ex.image_url ? (
                    <img src={ex.image_url} alt={ex.name} className="h-full w-full object-cover" />
                  ) : (
                    <Dumbbell className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm leading-tight truncate">{ex.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {ex.category}
                    {ex.difficulty ? ` · ${ex.difficulty}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {ex.matchScore} pts
                </Badge>
              </div>

              {ex.matchReasons.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {ex.matchReasons.slice(0, 3).map((r, i) => (
                    <Badge
                      key={i}
                      variant={r.includes("⭐") ? "default" : "secondary"}
                      className="text-[9px] px-1.5 py-0"
                    >
                      {r}
                    </Badge>
                  ))}
                </div>
              )}

              {ex.youtube_url && (
                <a
                  href={ex.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-primary inline-flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Voir la vidéo
                </a>
              )}
            </div>
          ))}
        </div>

        {recommendations.length > 6 && (
          <div className="flex justify-center mt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Réduire" : `Voir les ${recommendations.length - 6} autres`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
