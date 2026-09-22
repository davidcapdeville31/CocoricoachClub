import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { usePlayerGroups, PLAYER_GROUP_COLORS } from "@/hooks/usePlayerGroups";
import { labelizeTestType } from "@/hooks/useCustomTestLabels";
import {
  Users,
  UserCheck,
  Search,
  X,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import {
  exportTestsComparisonPdf,
  exportTestsComparisonCsv,
} from "@/lib/testsComparisonExport";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Props {
  categoryId: string;
}

type Mode = "players" | "groups";

interface Result {
  playerId: string;
  testKey: string;
  date: string;
  value: number;
  unit: string | null;
}

const norm = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * Lecture paginée : PostgREST plafonne chaque réponse à 1000 lignes.
 * Sans pagination, les résultats de tests les plus récents étaient tronqués.
 */
const PAGE_SIZE = 1000;
async function fetchAllRows<T>(
  build: (from: number, to: number) => any,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const chunk = (data || []) as T[];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
  }
  return rows;
}

const fullName = (p: any) =>
  [p.name ? String(p.name).toUpperCase() : "", p.first_name || ""].filter(Boolean).join(" ").trim() ||
  p.name ||
  "Athlète";

/**
 * Comparaison des tests physiques entre athlètes ou entre groupes.
 * Générique : fonctionne pour toutes les disciplines.
 */
export function TestsComparisonPanel({ categoryId }: Props) {
  const [mode, setMode] = useState<Mode>("players");
  const [playerSearch, setPlayerSearch] = useState("");
  const [testSearch, setTestSearch] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedTests, setSelectedTests] = useState<string[] | null>(null);
  const [restrictGroup, setRestrictGroup] = useState<string | null>(null);

  const { data: groups = [] } = usePlayerGroups(categoryId);

  const { data: players = [] } = useQuery({
    queryKey: ["tests-compare-players", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name, position")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: generic = [] } = useQuery({
    queryKey: ["tests-compare-generic", categoryId],
    enabled: !!categoryId,
    queryFn: async () =>
      fetchAllRows<any>((from, to) =>
        supabase
          .from("generic_tests")
          .select("player_id, test_type, result_value, result_unit, test_date")
          .eq("category_id", categoryId)
          .order("test_date", { ascending: true })
          .range(from, to),
      ),
  });

  const { data: strength = [] } = useQuery({
    queryKey: ["tests-compare-strength", categoryId],
    enabled: !!categoryId,
    queryFn: async () =>
      fetchAllRows<any>((from, to) =>
        supabase
          .from("strength_tests")
          .select("player_id, test_name, weight_kg, test_date")
          .eq("category_id", categoryId)
          .order("test_date", { ascending: true })
          .range(from, to),
      ),
  });

  const { data: speed = [] } = useQuery({
    queryKey: ["tests-compare-speed", categoryId],
    enabled: !!categoryId,
    queryFn: async () =>
      fetchAllRows<any>((from, to) =>
        supabase
          .from("speed_tests")
          .select("player_id, test_type, vma_kmh, speed_kmh, time_40m_seconds, test_date")
          .eq("category_id", categoryId)
          .order("test_date", { ascending: true })
          .range(from, to),
      ),
  });

  const customIds = useMemo(() => {
    const ids = new Set<string>();
    (generic as any[]).forEach((t) => {
      if (typeof t.test_type === "string" && t.test_type.startsWith("custom:"))
        ids.add(t.test_type.slice("custom:".length).toLowerCase());
    });
    return Array.from(ids);
  }, [generic]);

  const { data: customTests = [] } = useQuery({
    queryKey: ["tests-compare-custom", categoryId, customIds.join(",")],
    enabled: customIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_tests")
        .select("id, name, unit")
        .in("id", customIds);
      if (error) throw error;
      return data || [];
    },
  });

  const customMap = useMemo(() => {
    const map: Record<string, { name: string; unit: string | null }> = {};
    (customTests as any[]).forEach((c) => {
      map[`custom:${String(c.id).toLowerCase()}`] = { name: c.name, unit: c.unit };
    });
    return map;
  }, [customTests]);

  // ---- Résultats normalisés ----
  const results = useMemo<Result[]>(() => {
    const out: Result[] = [];
    (generic as any[]).forEach((t) => {
      const v = Number(t.result_value);
      if (!isFinite(v)) return;
      out.push({
        playerId: t.player_id,
        testKey: t.test_type,
        date: t.test_date,
        value: v,
        unit: t.result_unit ?? null,
      });
    });
    (strength as any[]).forEach((t) => {
      const v = Number(t.weight_kg);
      if (!isFinite(v) || !t.test_name) return;
      out.push({
        playerId: t.player_id,
        testKey: `strength:${t.test_name}`,
        date: t.test_date,
        value: v,
        unit: "kg",
      });
    });
    (speed as any[]).forEach((t) => {
      const v = t.vma_kmh ?? t.speed_kmh ?? t.time_40m_seconds;
      if (v == null || !isFinite(Number(v))) return;
      out.push({
        playerId: t.player_id,
        testKey: t.test_type || "speed",
        date: t.test_date,
        value: Number(v),
        unit: t.time_40m_seconds != null && t.vma_kmh == null && t.speed_kmh == null ? "s" : "km/h",
      });
    });
    return out;
  }, [generic, strength, speed]);

  const testOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string; unit: string | null; count: number }>();
    for (const r of results) {
      const existing = map.get(r.testKey);
      if (existing) {
        existing.count += 1;
        if (!existing.unit && r.unit) existing.unit = r.unit;
        continue;
      }
      const label = r.testKey.startsWith("strength:")
        ? r.testKey.slice("strength:".length)
        : labelizeTestType(r.testKey, customMap);
      map.set(r.testKey, {
        key: r.testKey,
        label,
        unit: r.unit ?? customMap[r.testKey]?.unit ?? null,
        count: 1,
      });
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [results, customMap]);

  const effectiveTests = selectedTests ?? testOptions.map((t) => t.key);

  const playersById = useMemo(() => {
    const m = new Map<string, any>();
    (players as any[]).forEach((p) => m.set(p.id, p));
    return m;
  }, [players]);

  const restrictSet = useMemo(() => {
    if (!restrictGroup) return null;
    const g = groups.find((x) => x.id === restrictGroup);
    return g ? new Set(g.playerIds) : null;
  }, [restrictGroup, groups]);

  const visiblePlayers = useMemo(() => {
    const q = norm(playerSearch);
    const words = q.split(/\s+/).filter(Boolean);
    return (players as any[]).filter((p) => {
      if (restrictSet && !restrictSet.has(p.id) && !selectedPlayers.includes(p.id)) return false;
      if (words.length === 0) return true;
      if (selectedPlayers.includes(p.id)) return true;
      const hay = norm(`${p.name || ""} ${p.first_name || ""}`);
      return words.every((w) => hay.includes(w));
    });
  }, [players, playerSearch, restrictSet, selectedPlayers]);

  const visibleTests = useMemo(() => {
    const q = norm(testSearch);
    if (!q) return testOptions;
    return testOptions.filter((t) => norm(t.label).includes(q));
  }, [testOptions, testSearch]);

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  // ---- Séries de comparaison par test ----
  const charts = useMemo(() => {
    const byTest = new Map<string, Result[]>();
    for (const r of results) {
      if (!effectiveTests.includes(r.testKey)) continue;
      if (!byTest.has(r.testKey)) byTest.set(r.testKey, []);
      byTest.get(r.testKey)!.push(r);
    }

    const latestPerPlayer = (rows: Result[]) => {
      const m = new Map<string, { first: Result; last: Result }>();
      for (const r of rows.slice().sort((a, b) => a.date.localeCompare(b.date))) {
        const e = m.get(r.playerId);
        if (!e) m.set(r.playerId, { first: r, last: r });
        else e.last = r;
      }
      return m;
    };

    const out: {
      key: string;
      label: string;
      unit: string | null;
      rows: { name: string; value: number; delta: number | null; date: string; color: string; count?: number }[];
    }[] = [];

    for (const opt of testOptions) {
      if (!effectiveTests.includes(opt.key)) continue;
      const rows = byTest.get(opt.key) || [];
      const latest = latestPerPlayer(rows);
      const entries: {
        name: string;
        value: number;
        delta: number | null;
        date: string;
        color: string;
        count?: number;
      }[] = [];

      if (mode === "players") {
        for (const pid of selectedPlayers) {
          const e = latest.get(pid);
          if (!e) continue;
          entries.push({
            name: fullName(playersById.get(pid) || {}),
            value: Number(e.last.value.toFixed(2)),
            delta: e.first.date === e.last.date ? null : Number((e.last.value - e.first.value).toFixed(2)),
            date: e.last.date,
            color: PLAYER_GROUP_COLORS[entries.length % PLAYER_GROUP_COLORS.length],
          });
        }
      } else {
        for (const gid of selectedGroups) {
          const g = groups.find((x) => x.id === gid);
          if (!g) continue;
          const vals: number[] = [];
          let lastDate = "";
          for (const pid of g.playerIds) {
            const e = latest.get(pid);
            if (!e) continue;
            vals.push(e.last.value);
            if (e.last.date > lastDate) lastDate = e.last.date;
          }
          if (vals.length === 0) continue;
          entries.push({
            name: g.name,
            value: Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)),
            delta: null,
            date: lastDate,
            color: g.color,
            count: vals.length,
          });
        }
      }

      if (entries.length === 0) continue;
      entries.sort((a, b) => b.value - a.value);
      out.push({ key: opt.key, label: opt.label, unit: opt.unit, rows: entries });
    }
    return out;
  }, [results, effectiveTests, testOptions, mode, selectedPlayers, selectedGroups, groups, playersById]);

  const hasSelection = mode === "players" ? selectedPlayers.length > 0 : selectedGroups.length > 0;

  // Détail athlète par athlète : tous les résultats des tests sélectionnés
  const playerDetails = useMemo(() => {
    if (mode !== "players" || selectedPlayers.length === 0) return [];
    const labelOf = new Map(testOptions.map((t) => [t.key, t]));
    return selectedPlayers.map((pid) => {
      const rows = results
        .filter((r) => r.playerId === pid && effectiveTests.includes(r.testKey))
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date));
      const byTest = new Map<string, Result[]>();
      rows.forEach((r) => {
        if (!byTest.has(r.testKey)) byTest.set(r.testKey, []);
        byTest.get(r.testKey)!.push(r);
      });
      return {
        playerId: pid,
        name: fullName(playersById.get(pid) || {}),
        tests: Array.from(byTest.entries())
          .map(([key, list]) => {
            const opt = labelOf.get(key);
            const first = list[0];
            const last = list[list.length - 1];
            return {
              key,
              label: opt?.label || key,
              unit: opt?.unit ?? last.unit ?? null,
              last,
              delta: first.date === last.date ? null : Number((last.value - first.value).toFixed(2)),
              history: list,
            };
          })
          .sort((a, b) => a.label.localeCompare(b.label)),
      };
    });
  }, [mode, selectedPlayers, results, effectiveTests, testOptions, playersById]);

  const runExport = async (kind: "pdf" | "csv") => {
    if (charts.length === 0) {
      toast.error("Aucune donnée à exporter pour cette sélection.");
      return;
    }
    const ctx = {
      categoryId,
      mode,
      charts: charts.map((c) => ({
        label: c.label,
        unit: c.unit,
        rows: c.rows.map((r) => ({
          name: r.name,
          value: r.value,
          delta: r.delta,
          date: r.date,
          count: r.count,
        })),
      })),
    };
    try {
      if (kind === "pdf") await exportTestsComparisonPdf(ctx);
      else exportTestsComparisonCsv(ctx);
      toast.success(kind === "pdf" ? "Export PDF généré" : "Export CSV généré");
    } catch (e) {
      console.error("[TestsComparisonPanel] export", e);
      toast.error("Export impossible");
    }
  };


  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Comparaison des tests physiques
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Compare les athlètes entre eux ou les groupes entre eux, test par test.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-muted/50 p-0.5">
            <Button
              type="button"
              size="sm"
              variant={mode === "players" ? "default" : "ghost"}
              className="h-7 gap-1.5 rounded-lg text-xs"
              onClick={() => setMode("players")}
            >
              <UserCheck className="h-3.5 w-3.5" />
              Athlètes
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "groups" ? "default" : "ghost"}
              className="h-7 gap-1.5 rounded-lg text-xs"
              onClick={() => setMode("groups")}
              disabled={groups.length === 0}
            >
              <Users className="h-3.5 w-3.5" />
              Groupes
            </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/20 p-2">
          <span className="mr-auto text-[11px] text-muted-foreground">
            Exporter la comparaison affichée
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 rounded-lg text-xs"
            onClick={() => runExport("pdf")}
          >
            <FileText className="h-3.5 w-3.5" />
            PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 rounded-lg text-xs"
            onClick={() => runExport("csv")}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Sélection athlètes / groupes */}
          <div className="rounded-xl border bg-muted/20 p-3">
            {mode === "players" ? (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[180px] flex-1">
                    <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={playerSearch}
                      onChange={(e) => setPlayerSearch(e.target.value)}
                      placeholder="Rechercher un nom ou prénom…"
                      className="h-8 pl-7 pr-7 text-xs"
                    />
                    {playerSearch && (
                      <button
                        type="button"
                        onClick={() => setPlayerSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setSelectedPlayers(visiblePlayers.map((p: any) => p.id))}>
                    Tous
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setSelectedPlayers([])}>
                    Aucun
                  </Button>
                </div>

                {groups.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <Badge
                      variant={restrictGroup === null ? "default" : "outline"}
                      className="cursor-pointer text-[10px]"
                      onClick={() => setRestrictGroup(null)}
                    >
                      Tous
                    </Badge>
                    {groups.map((g) => (
                      <Badge
                        key={g.id}
                        variant={restrictGroup === g.id ? "default" : "outline"}
                        className="cursor-pointer gap-1 text-[10px]"
                        onClick={() => setRestrictGroup(restrictGroup === g.id ? null : g.id)}
                      >
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
                        {g.name}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="max-h-[220px] touch-pan-y overflow-y-auto overscroll-contain pr-1">
                  <div className="space-y-0.5">
                    {visiblePlayers.map((p: any) => (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selectedPlayers.includes(p.id)}
                          onCheckedChange={() => setSelectedPlayers((prev) => toggle(prev, p.id))}
                        />
                        <span className="truncate">{fullName(p)}</span>
                      </label>
                    ))}
                    {visiblePlayers.length === 0 && (
                      <p className="px-2 py-3 text-xs text-muted-foreground">Aucun athlète trouvé.</p>
                    )}
                  </div>
                </div>
                <p className="mt-1 px-1 text-[11px] text-muted-foreground">
                  {selectedPlayers.length} athlète(s) sélectionné(s)
                </p>
              </>
            ) : (
              <div className="space-y-1">
                <p className="px-1 pb-1 text-[11px] font-semibold text-muted-foreground">
                  Groupes à comparer (moyenne du groupe)
                </p>
                {groups.map((g) => (
                  <label
                    key={g.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedGroups.includes(g.id)}
                      onCheckedChange={() => setSelectedGroups((prev) => toggle(prev, g.id))}
                    />
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                    <span className="truncate">{g.name}</span>
                    <span className="ml-auto text-muted-foreground">{g.playerIds.length}</span>
                  </label>
                ))}
                {groups.length === 0 && (
                  <p className="px-2 py-3 text-xs text-muted-foreground">
                    Aucun groupe créé. Crée des groupes dans Effectif.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Sélection des tests */}
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[180px] flex-1">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={testSearch}
                  onChange={(e) => setTestSearch(e.target.value)}
                  placeholder="Rechercher un test…"
                  className="h-8 pl-7 text-xs"
                />
              </div>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setSelectedTests(null)}>
                Tous les tests
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setSelectedTests([])}>
                Aucun
              </Button>
            </div>
            <div className="max-h-[260px] touch-pan-y overflow-y-auto overscroll-contain pr-1">
              <div className="space-y-0.5">
                {visibleTests.map((t) => (
                  <label
                    key={t.key}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={effectiveTests.includes(t.key)}
                      onCheckedChange={() =>
                        setSelectedTests((prev) => toggle(prev ?? testOptions.map((o) => o.key), t.key))
                      }
                    />
                    <span className="truncate">{t.label}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">{t.count}</span>
                  </label>
                ))}
                {visibleTests.length === 0 && (
                  <p className="px-2 py-3 text-xs text-muted-foreground">Aucun test trouvé.</p>
                )}
              </div>
            </div>
            <p className="mt-1 px-1 text-[11px] text-muted-foreground">
              {effectiveTests.length}/{testOptions.length} test(s) affiché(s)
            </p>
          </div>
        </div>

        {/* Graphiques */}
        {!hasSelection ? (
          <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
            {mode === "players"
              ? "Coche au moins un athlète pour lancer la comparaison."
              : "Coche au moins un groupe pour comparer les moyennes."}
          </div>
        ) : charts.length === 0 ? (
          <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
            Aucun résultat de test pour cette sélection.
          </div>
        ) : (
          <div className="space-y-4">
            {charts.map((c) => (
              <div key={c.key} className="rounded-xl border bg-card p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold">
                    {c.label}
                    {c.unit ? <span className="ml-1 text-xs text-muted-foreground">({c.unit})</span> : null}
                  </h4>
                  <Badge variant="outline" className="text-[10px]">
                    {c.rows.length} {mode === "players" ? "athlète(s)" : "groupe(s)"}
                  </Badge>
                </div>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={c.rows} margin={{ top: 8, right: 8, left: 0, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <RTooltip
                        contentStyle={{
                          borderRadius: 12,
                          backdropFilter: "blur(8px)",
                          background: "hsl(var(--background) / 0.92)",
                          border: "1px solid hsl(var(--border))",
                        }}
                        formatter={(v: any) => [`${v}${c.unit ? ` ${c.unit}` : ""}`, mode === "players" ? "Valeur" : "Moyenne"]}
                      />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {c.rows.map((r, i) => (
                          <Cell key={i} fill={r.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.rows.map((r) => (
                    <Badge key={r.name} variant="outline" className="gap-1 text-[10px]">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                      {r.name}: {r.value}
                      {c.unit ? ` ${c.unit}` : ""}
                      {r.count ? ` (${r.count})` : ""}
                      {r.date ? (
                        <span className="text-muted-foreground">
                          · {format(parseISO(r.date), "dd/MM/yy", { locale: fr })}
                        </span>
                      ) : null}
                      {r.delta != null && (
                        <span
                          className={
                            r.delta > 0 ? "text-emerald-600" : r.delta < 0 ? "text-red-500" : "text-muted-foreground"
                          }
                        >
                          {r.delta > 0 ? (
                            <TrendingUp className="inline h-3 w-3" />
                          ) : r.delta < 0 ? (
                            <TrendingDown className="inline h-3 w-3" />
                          ) : (
                            <Minus className="inline h-3 w-3" />
                          )}
                          {r.delta > 0 ? `+${r.delta}` : r.delta}
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {playerDetails.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Détail des résultats par athlète</h4>
            {playerDetails.map((p) => (
              <div key={p.playerId} className="rounded-xl border bg-card p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{p.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {p.tests.length} test(s)
                  </Badge>
                </div>
                {p.tests.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucun résultat sur les tests sélectionnés.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] text-xs">
                      <thead>
                        <tr className="text-left text-[11px] text-muted-foreground">
                          <th className="py-1 pr-2 font-medium">Test</th>
                          <th className="py-1 pr-2 font-medium">Dernier résultat</th>
                          <th className="py-1 pr-2 font-medium">Date</th>
                          <th className="py-1 pr-2 font-medium">Évolution</th>
                          <th className="py-1 font-medium">Historique</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.tests.map((t) => (
                          <tr key={t.key} className="border-t border-border/60">
                            <td className="py-1.5 pr-2">{t.label}</td>
                            <td className="py-1.5 pr-2 font-semibold">
                              {t.last.value}
                              {t.unit ? ` ${t.unit}` : ""}
                            </td>
                            <td className="py-1.5 pr-2 text-muted-foreground">
                              {format(parseISO(t.last.date), "dd/MM/yy", { locale: fr })}
                            </td>
                            <td className="py-1.5 pr-2">
                              {t.delta == null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <span
                                  className={
                                    t.delta > 0
                                      ? "text-emerald-600"
                                      : t.delta < 0
                                        ? "text-red-500"
                                        : "text-muted-foreground"
                                  }
                                >
                                  {t.delta > 0 ? `+${t.delta}` : t.delta}
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 text-[11px] text-muted-foreground">
                              {t.history
                                .slice(-6)
                                .map(
                                  (h) =>
                                    `${format(parseISO(h.date), "dd/MM/yy", { locale: fr })}: ${h.value}`,
                                )
                                .join("  ·  ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
