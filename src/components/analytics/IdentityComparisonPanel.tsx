import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useComparisonGroups } from "@/hooks/useComparisonGroups";
import { BarChart3, Users, Star } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface IdentityComparisonPanelProps {
  categoryId: string;
  /** Map playerId -> valeur numérique à comparer (ex: VMA, RPE moyen, charge…) */
  values: Map<string, number>;
  /** Libellé de la métrique affichée (ex: "VMA (km/h)") */
  metricLabel: string;
  /** Restreint aux dimensions intéressantes (ex: ['position','discipline','genre','age_category']) */
  allowedDimensions?: string[];
  /** Couleur Tailwind/HSL de la barre (défaut: primary) */
  barColor?: string;
}

const DIMENSION_LABELS: Record<string, string> = {
  position: "Poste",
  discipline: "Discipline",
  technical_style: "Style technique",
  performance_profile: "Profil de performance",
  genre: "Genre",
  age_category: "Catégorie d'âge",
  sport_principal: "Sport principal",
};

/**
 * Phase 5 — Identité Athlète :
 * Composant analytics réutilisable. Compare une métrique numérique entre
 * groupes dynamiquement construits à partir des tags d'identité.
 *
 * À brancher dans n'importe quel module (Tests, GPS, Charge, Wellness…).
 */
export function IdentityComparisonPanel({
  categoryId,
  values,
  metricLabel,
  allowedDimensions,
  barColor = "hsl(var(--primary))",
}: IdentityComparisonPanelProps) {
  const { availableDimensions, aggregateByDimension } = useComparisonGroups(categoryId);
  const [primaryOnly, setPrimaryOnly] = useState(false);

  const dims = useMemo(() => {
    const all = availableDimensions;
    if (!allowedDimensions) return all;
    return all.filter((d) => allowedDimensions.includes(d));
  }, [availableDimensions, allowedDimensions]);

  const [selectedDim, setSelectedDim] = useState<string | null>(null);

  // Auto-sélection à la première dimension dispo
  const activeDim = selectedDim ?? dims[0] ?? null;

  const data = useMemo(() => {
    if (!activeDim) return [];
    return aggregateByDimension(activeDim, values, { primaryOnly }).map((r) => ({
      name: r.group.value,
      count: r.count,
      avg: r.avg,
      min: r.min,
      max: r.max,
    }));
  }, [activeDim, values, primaryOnly, aggregateByDimension]);

  if (!dims.length) {
    return null;
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Comparaison par identité athlète
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {metricLabel} — moyenne par groupe
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={activeDim ?? undefined} onValueChange={setSelectedDim}>
              <SelectTrigger className="h-8 w-[180px] bg-muted/40">
                <SelectValue placeholder="Dimension" />
              </SelectTrigger>
              <SelectContent>
                {dims.map((d) => (
                  <SelectItem key={d} value={d}>
                    {DIMENSION_LABELS[d] ?? d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant={primaryOnly ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1"
              onClick={() => setPrimaryOnly((v) => !v)}
            >
              <Star className="h-3.5 w-3.5" />
              {primaryOnly ? "Primaire seul" : "Tous rôles"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Pas de données suffisantes pour comparer cette dimension.
          </div>
        ) : (
          <>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    angle={-25}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      backdropFilter: "blur(8px)",
                      background: "hsl(var(--background) / 0.9)",
                      border: "1px solid hsl(var(--border))",
                    }}
                    formatter={(val: any, key: string) => {
                      if (key === "avg") return [val, "Moyenne"];
                      if (key === "count") return [val, "Athlètes"];
                      return [val, key];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="avg" name="Moyenne" radius={[8, 8, 0, 0]}>
                    {data.map((_, i) => (
                      <Cell key={i} fill={barColor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {data.map((d) => (
                <Badge key={d.name} variant="outline" className="text-[10px] gap-1">
                  <Users className="h-3 w-3" />
                  {d.name}: {d.count}
                </Badge>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
