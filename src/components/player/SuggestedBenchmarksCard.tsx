import { useSuggestedBenchmarks } from "@/hooks/useSuggestedBenchmarks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Target, Weight } from "lucide-react";

interface SuggestedBenchmarksCardProps {
  playerId: string;
  categoryId: string;
}

/**
 * Phase 4 — Identité Athlète :
 * Affiche les barèmes recommandés pour CET athlète, classés par pertinence
 * vis-à-vis de ses attributs (postes, disciplines, profils de performance).
 */
export function SuggestedBenchmarksCard({ playerId, categoryId }: SuggestedBenchmarksCardProps) {
  const { suggestions, isLoading } = useSuggestedBenchmarks(playerId, categoryId);

  if (isLoading) return null;
  if (!suggestions.length) return null;

  // On affiche les 8 plus pertinents
  const top = suggestions.slice(0, 8);

  return (
    <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Barèmes recommandés pour cet athlète
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Sélection automatique basée sur l'identité de l'athlète (postes, disciplines, profils).
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {top.map((s) => (
            <div
              key={s.id}
              className="flex items-start justify-between gap-3 rounded-xl border bg-background/60 backdrop-blur p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-primary shrink-0" />
                  <p className="font-medium text-sm truncate">{s.name}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {s.test_category} · {s.test_type}
                  {s.unit ? ` · ${s.unit}` : ""}
                    {s.use_body_weight_ratio && s.body_weight_multiplier && (
                    <span className="ml-1 inline-flex items-center gap-0.5">
                      <Weight className="h-3 w-3" />
                      {s.body_weight_multiplier} ÷ PDC
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {s.matchReasons.map((r, idx) => (
                    <Badge
                      key={idx}
                      variant={r.includes("⭐") ? "default" : "secondary"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {s.matchScore} pts
              </Badge>
            </div>
          ))}
        </div>
        {suggestions.length > top.length && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            +{suggestions.length - top.length} autres barèmes pertinents disponibles
          </p>
        )}
      </CardContent>
    </Card>
  );
}
