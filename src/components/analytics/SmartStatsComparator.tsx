import { useMemo, useState } from "react";
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
import { BarChart3, Filter, UserCheck, Star, Users, Sparkles } from "lucide-react";
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

/* =========================================================================
 *  SmartStatsComparator
 *  -----------------------------------------------------------------------
 *  Comparateur intelligent générique (multi-sport) :
 *   - Choix de la métrique parmi N
 *   - Choix du scope (tout / sous-ensemble) — fourni par le wrapper
 *   - Mode "Par identité" (poste, latéralité, genre, âge…)
 *     ou "Joueurs" (sélection libre)
 * ========================================================================= */

export interface MetricDef {
  key: string;
  label: string;
  /** Suffixe affiché (ex: "%", "pts") */
  unit?: string;
  /** Nombre de décimales (défaut 1) */
  decimals?: number;
  /** Couleur barre (défaut primary) */
  color?: string;
  /** "higher" = mieux quand grand (défaut), "lower" = mieux quand petit */
  direction?: "higher" | "lower";
  /** Groupe optionnel pour grouper les options dans le select */
  group?: string;
}

export interface ScopeDef {
  key: string;
  label: string;
  /** Sous-libellé optionnel (ex: nb de parties) */
  hint?: string;
  /** Groupe optionnel pour grouper les scopes */
  group?: string;
}

export interface PlayerLite {
  id: string;
  name: string;
  first_name?: string | null;
}

interface SmartStatsComparatorProps {
  categoryId: string;
  /** Tous les joueurs concernés (avec ou sans données — on filtre derrière) */
  players: PlayerLite[];
  /** Métriques disponibles */
  metrics: MetricDef[];
  /** Scopes disponibles (le 1er = défaut) */
  scopes: ScopeDef[];
  /**
   * Calcule la valeur d'une métrique pour un joueur dans un scope donné.
   * Renvoie `null` si non disponible (le joueur sera ignoré dans la comparaison).
   */
  getValue: (playerId: string, metricKey: string, scopeKey: string) => number | null;
  /** Titre du panneau */
  title?: string;
  /** Sous-titre / description */
  description?: string;
}

type Mode = "identity" | "players";

const fmt = (val: number, m: MetricDef) =>
  `${val.toFixed(m.decimals ?? 1)}${m.unit ?? ""}`;

export function SmartStatsComparator({
  categoryId,
  players,
  metrics,
  scopes,
  getValue,
  title = "Comparateur intelligent",
  description = "Compare n'importe quelle statistique entre athlètes",
}: SmartStatsComparatorProps) {
  const { availableDimensions, aggregateByDimension } = useComparisonGroups(categoryId);

  const [mode, setMode] = useState<Mode>("players");
  const [primaryOnly, setPrimaryOnly] = useState(false);
  const [metricKey, setMetricKey] = useState<string>(metrics[0]?.key ?? "");
  const [scopeKey, setScopeKey] = useState<string>(scopes[0]?.key ?? "");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[] | null>(null);
  const [selectedDim, setSelectedDim] = useState<string | null>(null);

  const metric = useMemo(
    () => metrics.find((m) => m.key === metricKey) ?? metrics[0],
    [metrics, metricKey],
  );

  // Map playerId -> valeur pour la métrique + scope sélectionnés
  const valueMap = useMemo(() => {
    const m = new Map<string, number>();
    if (!metric || !scopeKey) return m;
    for (const p of players) {
      const v = getValue(p.id, metric.key, scopeKey);
      if (v !== null && v !== undefined && !isNaN(v)) m.set(p.id, v);
    }
    return m;
  }, [players, metric, scopeKey, getValue]);

  const playersWithValue = useMemo(
    () => players.filter((p) => valueMap.has(p.id)),
    [players, valueMap],
  );

  const effectiveSelection = useMemo(() => {
    if (selectedPlayerIds !== null) return selectedPlayerIds;
    return playersWithValue.map((p) => p.id);
  }, [selectedPlayerIds, playersWithValue]);

  const togglePlayer = (id: string) => {
    setSelectedPlayerIds((prev) => {
      const base = prev ?? playersWithValue.map((p) => p.id);
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    });
  };

  // ========== Données graphique ==========
  const playersData = useMemo(() => {
    return playersWithValue
      .filter((p) => effectiveSelection.includes(p.id))
      .map((p) => ({
        name: [p.first_name, p.name].filter(Boolean).join(" ") || p.name,
        value: Number(valueMap.get(p.id) ?? 0),
      }))
      .sort((a, b) =>
        (metric?.direction ?? "higher") === "lower"
          ? a.value - b.value
          : b.value - a.value,
      );
  }, [playersWithValue, effectiveSelection, valueMap, metric]);

  const dims = availableDimensions;
  const activeDim = selectedDim ?? dims[0] ?? null;
  const identityData = useMemo(() => {
    if (!activeDim) return [];
    return aggregateByDimension(activeDim, valueMap, { primaryOnly })
      .map((r) => ({
        name: r.group.value,
        value: r.avg ?? 0,
        count: r.count,
      }))
      .sort((a, b) =>
        (metric?.direction ?? "higher") === "lower"
          ? a.value - b.value
          : b.value - a.value,
      );
  }, [activeDim, valueMap, primaryOnly, aggregateByDimension, metric]);

  const data = mode === "identity" ? identityData : playersData;

  // ========== Métriques groupées dans le select ==========
  const metricsByGroup = useMemo(() => {
    const map = new Map<string, MetricDef[]>();
    for (const m of metrics) {
      const g = m.group ?? "Statistiques";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(m);
    }
    return map;
  }, [metrics]);

  const scopesByGroup = useMemo(() => {
    const map = new Map<string, ScopeDef[]>();
    for (const s of scopes) {
      const g = s.group ?? "Période";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(s);
    }
    return map;
  }, [scopes]);

  return (
    <Card className="rounded-2xl border-primary/20 shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              {title}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>

          <div className="inline-flex rounded-xl bg-muted/50 p-0.5">
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
          </div>
        </div>

        {/* Barre de filtres */}
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto] mt-3">
          {/* Sélection métrique */}
          <div>
            <label className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">
              Statistique
            </label>
            <Select value={metric?.key} onValueChange={setMetricKey}>
              <SelectTrigger className="h-9 bg-muted/40 mt-0.5">
                <SelectValue placeholder="Choisir une stat" />
              </SelectTrigger>
              <SelectContent className="max-h-[60vh]">
                {Array.from(metricsByGroup.entries()).map(([group, list]) => (
                  <div key={group}>
                    <div className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase text-muted-foreground tracking-wide">
                      {group}
                    </div>
                    {list.map((m) => (
                      <SelectItem key={m.key} value={m.key}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sélection scope */}
          <div>
            <label className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">
              Période / Sélection
            </label>
            <Select value={scopeKey} onValueChange={setScopeKey}>
              <SelectTrigger className="h-9 bg-muted/40 mt-0.5">
                <SelectValue placeholder="Choisir un scope" />
              </SelectTrigger>
              <SelectContent className="max-h-[60vh]">
                {Array.from(scopesByGroup.entries()).map(([group, list]) => (
                  <div key={group}>
                    <div className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase text-muted-foreground tracking-wide">
                      {group}
                    </div>
                    {list.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        <span className="flex items-center gap-2">
                          <span>{s.label}</span>
                          {s.hint && (
                            <span className="text-[10px] text-muted-foreground">
                              {s.hint}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Switch primaire (mode identité) */}
          {mode === "identity" && dims.length > 0 && (
            <div className="flex items-end">
              <Button
                type="button"
                variant={primaryOnly ? "default" : "outline"}
                size="sm"
                className="h-9 gap-1"
                onClick={() => setPrimaryOnly((v) => !v)}
              >
                <Star className="h-3.5 w-3.5" />
                {primaryOnly ? "Primaire" : "Tous rôles"}
              </Button>
            </div>
          )}
        </div>

        {/* Sélection dimension (mode identité) */}
        {mode === "identity" && dims.length > 0 && (
          <div className="mt-2">
            <label className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">
              Dimension
            </label>
            <Select value={activeDim ?? undefined} onValueChange={setSelectedDim}>
              <SelectTrigger className="h-9 bg-muted/40 mt-0.5 w-full md:w-[280px]">
                <SelectValue placeholder="Dimension" />
              </SelectTrigger>
              <SelectContent>
                {dims.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d.replace(/_/g, " ").replace(/^./, (s) => s.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {!metric ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Aucune statistique disponible.
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {mode === "identity"
              ? dims.length === 0
                ? "Aucune identité athlète renseignée. Remplis les fiches pour activer la comparaison par groupe."
                : "Pas assez de données pour cette dimension."
              : playersWithValue.length === 0
                ? "Aucun athlète n'a de valeur pour cette statistique dans ce scope."
                : "Sélectionne au moins un athlète."}
          </div>
        ) : (
          <div className={mode === "players" ? "grid gap-4 md:grid-cols-[240px_1fr]" : ""}>
            {/* Sélecteur joueurs */}
            {mode === "players" && (
              <div className="rounded-xl border bg-muted/20 p-2">
                <div className="flex items-center justify-between px-1 pb-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {effectiveSelection.length}/{playersWithValue.length}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px]"
                      onClick={() =>
                        setSelectedPlayerIds(playersWithValue.map((p) => p.id))
                      }
                    >
                      Tous
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => setSelectedPlayerIds([])}
                    >
                      Aucun
                    </Button>
                  </div>
                </div>
                <ScrollArea className="h-[300px] pr-2">
                  <div className="space-y-1">
                    {playersWithValue.map((p) => {
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
                            {fmt(valueMap.get(p.id) ?? 0, metric)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data}
                    margin={{ top: 16, right: 12, left: 0, bottom: 36 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      angle={-25}
                      textAnchor="end"
                      height={56}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        backdropFilter: "blur(8px)",
                        background: "hsl(var(--background) / 0.92)",
                        border: "1px solid hsl(var(--border))",
                      }}
                      formatter={(val: any) => [fmt(Number(val), metric), metric.label]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="value"
                      name={metric.label}
                      radius={[8, 8, 0, 0]}
                    >
                      {data.map((_, i) => (
                        <Cell key={i} fill={metric.color ?? "hsl(var(--primary))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {mode === "identity" && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(identityData as any[]).map((d) => (
                    <Badge key={d.name} variant="outline" className="text-[10px] gap-1">
                      <Users className="h-3 w-3" />
                      {d.name}: {d.count}
                    </Badge>
                  ))}
                </div>
              )}

              {mode === "players" && data.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" />
                    {data.length} athlète{data.length > 1 ? "s" : ""}
                  </span>
                  <span>
                    Min :{" "}
                    <strong className="text-foreground">
                      {fmt(Math.min(...data.map((d) => d.value)), metric)}
                    </strong>
                  </span>
                  <span>
                    Max :{" "}
                    <strong className="text-foreground">
                      {fmt(Math.max(...data.map((d) => d.value)), metric)}
                    </strong>
                  </span>
                  <span>
                    Moyenne :{" "}
                    <strong className="text-foreground">
                      {fmt(
                        data.reduce((s, d) => s + d.value, 0) / data.length,
                        metric,
                      )}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
