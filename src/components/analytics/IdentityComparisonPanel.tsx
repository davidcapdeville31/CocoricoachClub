import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useComparisonGroups } from "@/hooks/useComparisonGroups";
import { BarChart3, Users, Star, Filter, UserCheck } from "lucide-react";
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
  /** Restreint aux dimensions intéressantes (laisser vide = toutes) */
  allowedDimensions?: string[];
  /** Couleur Tailwind/HSL de la barre (défaut: primary) */
  barColor?: string;
}

const DIMENSION_LABELS: Record<string, string> = {
  position: "Poste",
  discipline: "Discipline",
  technical_style: "Style technique",
  genre: "Genre",
  age_category: "Catégorie d'âge",
  sport_principal: "Sport principal",
  laterality: "Latéralité",
  lateralite: "Latéralité",
  hands: "Nombre de mains",
  bowling_hands: "Nombre de mains",
  profile: "Profil",
  niveau: "Niveau",
  level: "Niveau",
};

const labelFor = (dim: string) =>
  DIMENSION_LABELS[dim] ?? dim.replace(/_/g, " ").replace(/^./, (s) => s.toUpperCase());

type Mode = "identity" | "players";

/**
 * Compare une métrique numérique entre athlètes :
 *  - Mode "Identité" : agrégation par dimension (poste, latéralité, genre, âge…)
 *  - Mode "Joueurs"  : sélection libre d'athlètes pour comparaison directe
 */
export function IdentityComparisonPanel({
  categoryId,
  values,
  metricLabel,
  allowedDimensions,
  barColor = "hsl(var(--primary))",
}: IdentityComparisonPanelProps) {
  const { availableDimensions, aggregateByDimension } = useComparisonGroups(categoryId);
  const [mode, setMode] = useState<Mode>("identity");
  const [primaryOnly, setPrimaryOnly] = useState(false);

  // ===== Mode IDENTITÉ =====
  const dims = useMemo(() => {
    const all = availableDimensions;
    if (!allowedDimensions || allowedDimensions.length === 0) return all;
    return all.filter((d) => allowedDimensions.includes(d));
  }, [availableDimensions, allowedDimensions]);

  const [selectedDim, setSelectedDim] = useState<string | null>(null);
  const activeDim = selectedDim ?? dims[0] ?? null;

  const identityData = useMemo(() => {
    if (!activeDim) return [];
    return aggregateByDimension(activeDim, values, { primaryOnly }).map((r) => ({
      name: r.group.value,
      count: r.count,
      avg: r.avg,
      min: r.min,
      max: r.max,
    }));
  }, [activeDim, values, primaryOnly, aggregateByDimension]);

  // ===== Mode JOUEURS =====
  const { data: players = [] } = useQuery({
    queryKey: ["identity_panel_players", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Joueurs ayant une valeur (sinon inutile de proposer)
  const playersWithValue = useMemo(
    () => players.filter((p: any) => values.has(p.id)),
    [players, values],
  );

  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[] | null>(null);
  const effectiveSelection = useMemo(() => {
    if (selectedPlayerIds !== null) return selectedPlayerIds;
    // Par défaut : tout le monde sélectionné
    return playersWithValue.map((p: any) => p.id);
  }, [selectedPlayerIds, playersWithValue]);

  const togglePlayer = (id: string) => {
    setSelectedPlayerIds((prev) => {
      const base = prev ?? playersWithValue.map((p: any) => p.id);
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    });
  };
  const selectAll = () => setSelectedPlayerIds(playersWithValue.map((p: any) => p.id));
  const clearAll = () => setSelectedPlayerIds([]);

  const playersData = useMemo(() => {
    return playersWithValue
      .filter((p: any) => effectiveSelection.includes(p.id))
      .map((p: any) => ({
        name: [p.first_name, p.name].filter(Boolean).join(" ") || p.name,
        avg: Number(values.get(p.id) ?? 0),
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [playersWithValue, effectiveSelection, values]);

  const data = mode === "identity" ? identityData : playersData;
  const showIdentityControls = mode === "identity" && dims.length > 0;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Comparaison entre athlètes
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {metricLabel}
              {mode === "identity" ? " — moyenne par groupe" : " — par athlète sélectionné"}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Toggle mode */}
            <div className="inline-flex rounded-xl bg-muted/50 p-0.5">
              <Button
                type="button"
                size="sm"
                variant={mode === "identity" ? "default" : "ghost"}
                className="h-7 rounded-lg gap-1.5 text-xs"
                onClick={() => setMode("identity")}
              >
                <Filter className="h-3.5 w-3.5" />
                Par identité
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "players" ? "default" : "ghost"}
                className="h-7 rounded-lg gap-1.5 text-xs"
                onClick={() => setMode("players")}
              >
                <UserCheck className="h-3.5 w-3.5" />
                Joueurs
              </Button>
            </div>

            {showIdentityControls && (
              <>
                <Select value={activeDim ?? undefined} onValueChange={setSelectedDim}>
                  <SelectTrigger className="h-8 w-[180px] bg-muted/40">
                    <SelectValue placeholder="Dimension" />
                  </SelectTrigger>
                  <SelectContent>
                    {dims.map((d) => (
                      <SelectItem key={d} value={d}>
                        {labelFor(d)}
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
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {mode === "identity" && dims.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Aucune identité athlète renseignée. Remplis les fiches (poste, latéralité,
            catégorie d'âge…) pour activer la comparaison par groupe.
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {mode === "identity"
              ? "Pas de données suffisantes pour comparer cette dimension."
              : "Sélectionne au moins un athlète disposant d'une valeur."}
          </div>
        ) : (
          <div className={mode === "players" ? "grid gap-4 md:grid-cols-[220px_1fr]" : ""}>
            {/* Sélecteur de joueurs */}
            {mode === "players" && (
              <div className="rounded-xl border bg-muted/20 p-2">
                <div className="flex items-center justify-between px-1 pb-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {effectiveSelection.length}/{playersWithValue.length} sélectionnés
                  </span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px]"
                      onClick={selectAll}
                    >
                      Tous
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px]"
                      onClick={clearAll}
                    >
                      Aucun
                    </Button>
                  </div>
                </div>
                <ScrollArea className="h-[260px] pr-2">
                  <div className="space-y-1">
                    {playersWithValue.map((p: any) => {
                      const checked = effectiveSelection.includes(p.id);
                      const label =
                        [p.first_name, p.name].filter(Boolean).join(" ") || p.name;
                      return (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => togglePlayer(p.id)}
                          />
                          <span className="truncate">{label}</span>
                          <span className="ml-auto text-muted-foreground tabular-nums">
                            {values.get(p.id)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div>
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
                        if (key === "avg")
                          return [val, mode === "identity" ? "Moyenne" : "Valeur"];
                        if (key === "count") return [val, "Athlètes"];
                        return [val, key];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="avg"
                      name={mode === "identity" ? "Moyenne" : "Valeur"}
                      radius={[8, 8, 0, 0]}
                    >
                      {data.map((_, i) => (
                        <Cell key={i} fill={barColor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {mode === "identity" && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(data as any[]).map((d) => (
                    <Badge key={d.name} variant="outline" className="text-[10px] gap-1">
                      <Users className="h-3 w-3" />
                      {d.name}: {d.count}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
