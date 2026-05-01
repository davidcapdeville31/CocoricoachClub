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
  const [metricKeys, setMetricKeys] = useState<string[]>(
    metrics.map((m) => m.key),
  );
  const [scopeKey, setScopeKey] = useState<string>(scopes[0]?.key ?? "");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[] | null>(null);
  const [selectedDim, setSelectedDim] = useState<string | null>(null);

  // Palette de couleurs HSL distinctes pour chaque métrique
  const palette = [
    "hsl(var(--primary))",
    "hsl(220 90% 60%)",
    "hsl(150 70% 45%)",
    "hsl(35 95% 55%)",
    "hsl(340 85% 60%)",
    "hsl(265 75% 62%)",
    "hsl(190 85% 50%)",
    "hsl(15 90% 58%)",
    "hsl(95 60% 48%)",
    "hsl(50 95% 55%)",
    "hsl(290 70% 60%)",
    "hsl(175 70% 42%)",
    "hsl(245 80% 65%)",
    "hsl(110 55% 50%)",
    "hsl(0 80% 60%)",
    "hsl(210 30% 55%)",
    "hsl(60 80% 50%)",
  ];
  const metricColor = (key: string) => {
    const m = metrics.find((x) => x.key === key);
    if (m?.color) return m.color;
    const idx = metrics.findIndex((x) => x.key === key);
    return palette[idx % palette.length];
  };

  const selectedMetrics = useMemo(
    () => metrics.filter((m) => metricKeys.includes(m.key)),
    [metrics, metricKeys],
  );
  // Métrique de référence (1ère sélectionnée) — pour direction de tri & format infos
  const metric = selectedMetrics[0];

  const toggleMetric = (key: string) => {
    setMetricKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  // Map metricKey -> (playerId -> valeur)
  const valuesByMetric = useMemo(() => {
    const out = new Map<string, Map<string, number>>();
    if (!scopeKey) return out;
    for (const m of selectedMetrics) {
      const inner = new Map<string, number>();
      for (const p of players) {
        const v = getValue(p.id, m.key, scopeKey);
        if (v !== null && v !== undefined && !isNaN(v)) inner.set(p.id, v);
      }
      out.set(m.key, inner);
    }
    return out;
  }, [players, selectedMetrics, scopeKey, getValue]);

  // Map joueur -> valeur de la métrique de référence (pour sélecteur joueurs et tri)
  const valueMap = useMemo(() => {
    return valuesByMetric.get(metric?.key ?? "") ?? new Map<string, number>();
  }, [valuesByMetric, metric]);

  const playersWithValue = useMemo(() => {
    // Joueur affiché si au moins une métrique sélectionnée a une valeur
    return players.filter((p) =>
      selectedMetrics.some((m) => valuesByMetric.get(m.key)?.has(p.id)),
    );
  }, [players, selectedMetrics, valuesByMetric]);

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
  // Pour chaque joueur (ou groupe identité) on construit un objet { name, [metricKey]: value, ... }
  const playersData = useMemo(() => {
    const filtered = playersWithValue.filter((p) => effectiveSelection.includes(p.id));
    return filtered
      .map((p) => {
        const row: Record<string, any> = {
          name: [p.first_name, p.name].filter(Boolean).join(" ") || p.name,
        };
        for (const m of selectedMetrics) {
          const v = valuesByMetric.get(m.key)?.get(p.id);
          row[m.key] = v ?? 0;
        }
        return row;
      })
      .sort((a, b) => {
        if (!metric) return 0;
        const av = Number(a[metric.key] ?? 0);
        const bv = Number(b[metric.key] ?? 0);
        return (metric.direction ?? "higher") === "lower" ? av - bv : bv - av;
      });
  }, [playersWithValue, effectiveSelection, valuesByMetric, selectedMetrics, metric]);

  const dims = availableDimensions;
  const activeDim = selectedDim ?? dims[0] ?? null;
  // Traduction FR des valeurs de dimension (genre, latéralité, catégorie d'âge, etc.)
  const VALUE_LABELS: Record<string, string> = {
    male: "Homme",
    female: "Femme",
    men: "Hommes",
    women: "Femmes",
    boys: "Garçons",
    girls: "Filles",
    mixed: "Mixte",
    other: "Autre",
    unknown: "Non renseigné",
    left: "Gauche",
    right: "Droite",
    ambidextrous: "Ambidextre",
    ambi: "Ambidextre",
    senior: "Senior",
    seniors: "Seniors",
    junior: "Junior",
    juniors: "Juniors",
    youth: "Jeunes",
    veteran: "Vétéran",
    veterans: "Vétérans",
    masters: "Masters",
  };
  const translateValue = (v: any): string => {
    if (v === null || v === undefined) return "—";
    const s = String(v).trim();
    const key = s.toLowerCase();
    return VALUE_LABELS[key] ?? s;
  };

  const identityData = useMemo(() => {
    if (!activeDim || selectedMetrics.length === 0) return [] as any[];
    // On agrège chaque métrique séparément puis on fusionne par groupe
    const groupMap = new Map<string, Record<string, any>>();
    for (const m of selectedMetrics) {
      const vmap = valuesByMetric.get(m.key) ?? new Map<string, number>();
      const rows = aggregateByDimension(activeDim, vmap, { primaryOnly });
      for (const r of rows) {
        const key = r.group.value;
        if (!groupMap.has(key)) groupMap.set(key, { name: translateValue(key), count: r.count });
        groupMap.get(key)![m.key] = r.avg ?? 0;
      }
    }
    const arr = Array.from(groupMap.values());
    if (metric) {
      arr.sort((a, b) => {
        const av = Number(a[metric.key] ?? 0);
        const bv = Number(b[metric.key] ?? 0);
        return (metric.direction ?? "higher") === "lower" ? av - bv : bv - av;
      });
    }
    return arr;
  }, [activeDim, valuesByMetric, selectedMetrics, primaryOnly, aggregateByDimension, metric]);

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
        <div className="grid gap-2 md:grid-cols-[1fr_auto] mt-3">
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
        {mode === "identity" && dims.length > 0 && (() => {
          const DIM_LABELS: Record<string, string> = {
            genre: "Genre",
            age_category: "Catégorie d'âge",
            laterality: "Latéralité",
            position: "Poste",
            discipline: "Discipline",
            technical_style: "Style technique",
            styles: "Styles",
            specialties: "Spécialités",
            profile: "Profil",
          };
          // Dimensions à masquer (peu pertinentes ou redondantes)
          const HIDDEN_DIMS = new Set([
            "birth_year",
            "sport",
            "sport_principal",
            "sport_gender",
            "positions_all",
            "position_all",
          ]);
          const visibleDims = dims.filter((d) => !HIDDEN_DIMS.has(d));
          if (visibleDims.length === 0) return null;
          const labelFor = (d: string) =>
            DIM_LABELS[d] ??
            d.replace(/_/g, " ").replace(/^./, (s) => s.toUpperCase());
          return (
            <div className="mt-2">
              <label className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">
                Dimension
              </label>
              <Select value={activeDim ?? undefined} onValueChange={setSelectedDim}>
                <SelectTrigger className="h-9 bg-muted/40 mt-0.5 w-full md:w-[280px]">
                  <SelectValue placeholder="Dimension" />
                </SelectTrigger>
                <SelectContent>
                  {visibleDims.map((d) => (
                    <SelectItem key={d} value={d}>
                      {labelFor(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })()}
      </CardHeader>

      <CardContent>
        {/* Chips toggle pour activer/désactiver chaque métrique — TOUJOURS visibles */}
        {metrics.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide mr-1">
              Statistiques
            </span>
            {metrics.map((m) => {
              const active = metricKeys.includes(m.key);
              const color = metricColor(m.key);
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => toggleMetric(m.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all ${
                    active
                      ? "border-transparent text-foreground shadow-sm"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
                  }`}
                  style={
                    active
                      ? { background: `color-mix(in oklab, ${color} 18%, transparent)` }
                      : undefined
                  }
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: color, opacity: active ? 1 : 0.4 }}
                  />
                  <span className="whitespace-nowrap">{m.label}</span>
                </button>
              );
            })}
            <div className="ml-auto flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px]"
                onClick={() => setMetricKeys(metrics.map((m) => m.key))}
              >
                Tout
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px]"
                onClick={() => setMetricKeys([])}
              >
                Aucune
              </Button>
            </div>
          </div>
        )}

        {metrics.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Aucune statistique disponible.
          </div>
        ) : metricKeys.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Sélectionne au moins une statistique ci-dessus pour afficher le graphique.
          </div>
        ) : !metric ? (
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
                ? "Aucun athlète n'a de valeur pour les statistiques sélectionnées dans ce scope."
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
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data}
                    margin={{ top: 16, right: 12, left: 0, bottom: 36 }}
                    barCategoryGap="20%"
                    barGap={2}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fontWeight: 500 }}
                      angle={0}
                      textAnchor="middle"
                      height={36}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      domain={(() => {
                        // Domaine Y resserré autour des valeurs pour amplifier
                        // visuellement les écarts entre les barres.
                        const vals: number[] = [];
                        for (const row of data as any[]) {
                          for (const m of selectedMetrics) {
                            const v = Number(row[m.key]);
                            if (Number.isFinite(v)) vals.push(v);
                          }
                        }
                        if (vals.length === 0) return [0, "auto"] as any;
                        const min = Math.min(...vals);
                        const max = Math.max(...vals);
                        if (max === min) return [Math.max(0, min - 1), max + 1] as any;
                        const pad = (max - min) * 0.25;
                        const lower = Math.max(0, Math.floor(min - pad));
                        const upper = Math.ceil(max + pad);
                        return [lower, upper] as any;
                      })()}
                    />
                    <Tooltip
                      cursor={false}
                      contentStyle={{
                        borderRadius: 12,
                        backdropFilter: "blur(8px)",
                        background: "hsl(var(--background) / 0.92)",
                        border: "1px solid hsl(var(--border))",
                      }}
                      formatter={(val: any, _name: any, props: any) => {
                        const m = metrics.find((x) => x.key === props?.dataKey);
                        return [m ? fmt(Number(val), m) : Number(val).toFixed(1), m?.label ?? props?.dataKey];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {selectedMetrics.map((m) => (
                      <Bar
                        key={m.key}
                        dataKey={m.key}
                        name={m.label}
                        fill={metricColor(m.key)}
                        maxBarSize={18}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {mode === "identity" && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(identityData as any[]).map((d) => (
                    <Badge key={d.name} variant="outline" className="text-[10px] gap-1">
                      <Users className="h-3 w-3" />
                      {d.name}: {d.count ?? "—"}
                    </Badge>
                  ))}
                </div>
              )}

              {mode === "players" && data.length > 0 && metric && (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" />
                    {data.length} athlète{data.length > 1 ? "s" : ""} · {selectedMetrics.length} stat{selectedMetrics.length > 1 ? "s" : ""}
                  </span>
                  <span>
                    {metric.label} — Min :{" "}
                    <strong className="text-foreground">
                      {fmt(Math.min(...data.map((d: any) => Number(d[metric.key] ?? 0))), metric)}
                    </strong>
                  </span>
                  <span>
                    Max :{" "}
                    <strong className="text-foreground">
                      {fmt(Math.max(...data.map((d: any) => Number(d[metric.key] ?? 0))), metric)}
                    </strong>
                  </span>
                  <span>
                    Moyenne :{" "}
                    <strong className="text-foreground">
                      {fmt(
                        data.reduce((s: number, d: any) => s + Number(d[metric.key] ?? 0), 0) / data.length,
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
