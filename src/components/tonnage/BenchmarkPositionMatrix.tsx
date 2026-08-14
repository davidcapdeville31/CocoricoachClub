import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Target, TrendingUp, TrendingDown, Minus, Weight, LineChart as LineChartIcon, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { computeBenchmarkLevel } from "@/lib/benchmarks/computeLevel";
import { matchesBenchmark, normalizeTestKey } from "@/lib/benchmarks/matchTestType";
import { synthesizeBenchmarks } from "@/lib/benchmarks/synthFromScoringScale";
import { collectLatestPlayerWeights } from "@/lib/benchmarks/playerWeights";
import {
  getPositionGroupsForSport,
  playerBelongsToGroup,
  type PositionGroup,
} from "@/lib/constants/sportPositionGroups";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { generateCsv, downloadCsv } from "@/lib/csv";

import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Props {
  categoryId: string;
  /** Si défini, restreint le tableau de résultats à ce joueur uniquement (vue athlète). */
  filterPlayerId?: string;
  /** Cache la carte header + selecteur (pour rendu multi-tests). */
  hideSelector?: boolean;
  /** Force l'affichage d'un test particulier (bypass du dropdown). */
  forcedKey?: string;
  /** Callback qui expose la liste des tests disponibles (pour un parent multi-tests). */
  onTestOptions?: (opts: { key: string; label: string; count: number }[]) => void;
  /** Si true, n'affiche rien : sert juste à émettre onTestOptions. */
  renderOnlyOptions?: boolean;
}


interface BenchmarkLevel {
  label: string;
  threshold: number | null;
  color: string;
}
interface Benchmark {
  id: string;
  name: string;
  test_category: string;
  test_type: string;
  unit: string | null;
  lower_is_better: boolean;
  levels: BenchmarkLevel[];
  use_body_weight_ratio: boolean;
  body_weight_multiplier: number | null;
  filter_type: string;
  filter_value: string | null;
  gender_filter: string | null;
}


interface CustomTest {
  id: string;
  name: string;
  unit: string | null;
  test_category?: string | null;
}

interface ResultPoint {
  date: string;
  value: number; // valeur utilisée pour le calcul du niveau (ratio si benchmark ratio, sinon kg/valeur brute)
  rawKg?: number; // charge brute en kg (pour affichage lorsque le test est en musculation)
  ratio?: number; // ratio charge / poids de corps (si applicable)
}

interface TestOption {
  key: string; // "bm:<id>" or "ct:<id>"
  label: string;
  benchmark: Benchmark; // real or synthetic
  count: number;
}

const UNKNOWN_POS = "Sans poste";

// Default ratio levels used when a custom test has "× PDC" unit but no benchmark
const DEFAULT_RATIO_LEVELS: BenchmarkLevel[] = [
  { label: "Insuffisant", threshold: 1, color: "#ef4444" },
  { label: "Moyen", threshold: 1.5, color: "#f59e0b" },
  { label: "Bon", threshold: 2, color: "#22c55e" },
  { label: "Très bon", threshold: 2.5, color: "#10b981" },
];

function isRatioUnit(u: string | null | undefined) {
  if (!u) return false;
  const s = u.toLowerCase().replace(/\s+/g, "");
  return s === "×pdc" || s === "xpdc";
}

export function BenchmarkPositionMatrix({ categoryId, filterPlayerId, hideSelector, forcedKey, onTestOptions, renderOnlyOptions }: Props) {
  const [internalSelectedKey, setInternalSelectedKey] = useState<string>("");
  const selectedKey = forcedKey ?? internalSelectedKey;
  const setSelectedKey = setInternalSelectedKey;
  const autoSelectedRef = useRef(false);
  const [focusPlayer, setFocusPlayer] = useState<{ id: string; name: string } | null>(null);

  const { data: category } = useQuery({
    queryKey: ["category-matrix", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("rugby_type")
        .eq("id", categoryId)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const sportType = category?.rugby_type || "XV";
  const positionGroups = useMemo<PositionGroup[]>(
    () => getPositionGroupsForSport(sportType),
    [sportType],
  );

  const { data: dbBenchmarks = [] } = useQuery({
    queryKey: ["benchmarks-matrix", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("benchmarks")
        .select("*")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return (data || []).map((b: any) => ({
        ...b,
        levels: Array.isArray(b.levels) ? b.levels : [],
      })) as Benchmark[];
    },
  });



  const { data: players = [] } = useQuery({
    queryKey: ["players-matrix", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name, position, gender")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Récupère tous les résultats de tests génériques (utilisé pour dériver la liste
  // des custom tests référencés + pour les points de test). Déclaré tôt car
  // plusieurs queries en dépendent.
  const { data: genericTests = [] } = useQuery({
    queryKey: ["generic-tests-matrix", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generic_tests")
        .select("player_id, test_type, test_category, result_value, result_unit, test_date")
        .eq("category_id", categoryId)
        .order("test_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const referencedCustomIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of (genericTests as any[]) || []) {
      if (typeof t.test_type === "string" && t.test_type.startsWith("custom:")) {
        ids.add(t.test_type.slice("custom:".length));
      }
    }
    return Array.from(ids);
  }, [genericTests]);

  const { data: customTests = [] } = useQuery({
    queryKey: ["custom-tests-matrix", categoryId, referencedCustomIds.join(",")],
    enabled: !!categoryId,
    queryFn: async () => {
      const results = new Map<string, CustomTest & { scoring_scale?: any }>();
      const { data: linked, error } = await supabase
        .from("custom_test_categories")
        .select("custom_tests(id, name, unit, test_category, scoring_scale)")
        .eq("category_id", categoryId);
      if (error) throw error;
      for (const r of linked || []) {
        const ct = (r as any).custom_tests;
        if (ct) results.set(ct.id, ct);
      }
      const missing = referencedCustomIds.filter((id) => !results.has(id));
      if (missing.length) {
        const { data: extra } = await supabase
          .from("custom_tests")
          .select("id, name, unit, test_category, scoring_scale")
          .in("id", missing);
        for (const ct of extra || []) results.set(ct.id, ct as any);
      }
      return Array.from(results.values());
    },
  });

  // Fusionne les benchmarks BDD + ceux synthétisés à partir des scoring_scale
  // (variants poste / sexe) définis directement sur les tests personnalisés.
  const benchmarks = useMemo<Benchmark[]>(() => {
    const synth = synthesizeBenchmarks(customTests as any) as unknown as Benchmark[];
    return [...synth, ...dbBenchmarks];

  }, [dbBenchmarks, customTests]);



  const { data: bodyComps = [] } = useQuery({
    queryKey: ["body-comp-matrix", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("body_composition")
        .select("player_id, weight_kg, measurement_date")
        .eq("category_id", categoryId)
        .order("measurement_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: playerMeasurements = [] } = useQuery({
    queryKey: ["player-measurements-matrix", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_measurements")
        .select("player_id, weight_kg, measurement_date")
        .eq("category_id", categoryId)
        .order("measurement_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Récupère aussi les résultats de tests d'anthropométrie qui contiennent un poids
  // (test personnalisé "Poids", "Anthropométrie", etc. avec unité kg).
  const { data: weightTests = [] } = useQuery({
    queryKey: ["weight-tests-matrix", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generic_tests")
        .select("player_id, test_type, test_category, result_value, result_unit, test_date")
        .eq("category_id", categoryId)
        .order("test_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Poids le plus récent, toutes sources confondues
  // (body_composition + player_measurements + tests anthropométrie)
  const playerWeights = useMemo(
    () =>
      collectLatestPlayerWeights({
        bodyComps: bodyComps as any,
        playerMeasurements: playerMeasurements as any,
        weightTests: weightTests as any,
        customTests: customTests as any,
      }),
    [bodyComps, playerMeasurements, weightTests, customTests],
  );




  const { data: speedTests = [] } = useQuery({
    queryKey: ["speed-tests-matrix", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("speed_tests")
        .select("player_id, test_type, vma_kmh, speed_kmh, time_40m_seconds, test_date")
        .eq("category_id", categoryId)
        .order("test_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: strengthTests = [] } = useQuery({
    queryKey: ["strength-tests-matrix", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strength_tests")
        .select("player_id, test_name, weight_kg, test_date")
        .eq("category_id", categoryId)
        .order("test_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Restreint les jeux de données au joueur ciblé lorsque `filterPlayerId` est fourni.
  const genericTestsScoped = useMemo(
    () => (filterPlayerId ? (genericTests as any[]).filter((t) => t.player_id === filterPlayerId) : genericTests),
    [genericTests, filterPlayerId],
  );
  const speedTestsScoped = useMemo(
    () => (filterPlayerId ? (speedTests as any[]).filter((t) => t.player_id === filterPlayerId) : speedTests),
    [speedTests, filterPlayerId],
  );
  const strengthTestsScoped = useMemo(
    () => (filterPlayerId ? (strengthTests as any[]).filter((t) => t.player_id === filterPlayerId) : strengthTests),
    [strengthTests, filterPlayerId],
  );



  // ---------- Build combined test options (benchmarks + custom tests) ----------
  // Dedupe par test_type : on ne montre qu'une entrée par test, quel que soit
  // le nombre de barèmes personnalisés (poste / sexe) qui lui sont attachés.
  const testOptions: TestOption[] = useMemo(() => {
    const opts: TestOption[] = [];
    const seenTestTypes = new Set<string>();
    const covered = new Set<string>();

    for (const b of benchmarks) {
      if (seenTestTypes.has(b.test_type)) continue;
      seenTestTypes.add(b.test_type);

      // Choisit un "barème de référence" pour l'affichage : préférer le barème
      // sans filtre (base) plutôt qu'un poste-spécifique.
      const base =
        benchmarks.find(
          (x) => x.test_type === b.test_type && (!x.filter_value || x.filter_type === "all") && !x.gender_filter,
        ) || b;

      let count = 0;
      genericTestsScoped.forEach((t: any) => {
        if (matchesBenchmark(t.test_type, b.test_type, customTests as any)) count++;
      });
      speedTestsScoped.forEach((t: any) => {
        if (matchesBenchmark(t.test_type, b.test_type, customTests as any)) count++;
      });
      strengthTestsScoped.forEach((t: any) => {
        if (matchesBenchmark(t.test_name, b.test_type, customTests as any)) count++;
      });
      // Label : nom du test personnalisé si test_type = custom:<id>, sinon nom du barème
      let label = base.name;
      if (base.test_type.startsWith("custom:")) {
        const ct = customTests.find((c) => `custom:${c.id}` === base.test_type);
        if (ct) label = ct.name;
      }
      if (count === 0) continue;
      opts.push({ key: `bm:${base.id}`, label, benchmark: base, count });
      covered.add(normalizeTestKey(b.test_type));
      for (const ct of customTests) {
        if (normalizeTestKey(ct.name) === normalizeTestKey(b.test_type)) {
          covered.add(`custom:${ct.id}`);
        }
      }
    }

    // Custom tests sans barème associé → option synthétique
    for (const ct of customTests) {
      const nameKey = normalizeTestKey(ct.name);
      if (covered.has(nameKey) || covered.has(`custom:${ct.id}`)) continue;
      const testType = `custom:${ct.id}`;
      const count = genericTestsScoped.filter((t: any) => t.test_type === testType).length;
      // On masque les tests personnalisés sans barème ET sans résultat
      if (count === 0) continue;
      const isRatio = isRatioUnit(ct.unit);
      const ratioTemplate = benchmarks.find((b) => b.use_body_weight_ratio);
      const levels =
        isRatio
          ? ratioTemplate?.levels?.length
            ? ratioTemplate.levels
            : DEFAULT_RATIO_LEVELS
          : [];
      const synth: Benchmark = {
        id: `synthetic-${ct.id}`,
        name: ct.name,
        test_category: ct.test_category || "custom",
        test_type: testType,
        unit: ct.unit || null,
        lower_is_better: false,
        levels,
        use_body_weight_ratio: isRatio,
        body_weight_multiplier: null,
        filter_type: "all",
        filter_value: null,
        gender_filter: null,
      };
      opts.push({ key: `ct:${ct.id}`, label: ct.name, benchmark: synth, count });
    }

    // Preset tests (poids, cooper, body_fat, 40m, clean_1rm...) réalisés sans barème
    const presetLabel = (key: string) =>
      key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    // Generic tests presets
    const genericPresets = new Map<string, { count: number; unit: string | null; category: string | null }>();
    for (const t of genericTestsScoped as any[]) {
      if (!t.test_type || t.test_type.startsWith("custom:")) continue;
      if (covered.has(normalizeTestKey(t.test_type))) continue;
      const entry = genericPresets.get(t.test_type) || { count: 0, unit: t.result_unit, category: t.test_category };
      entry.count++;
      genericPresets.set(t.test_type, entry);
    }
    for (const [type, info] of genericPresets) {
      const isRatio = isRatioUnit(info.unit);
      const synth: Benchmark = {
        id: `synthetic-generic-${type}`,
        name: presetLabel(type),
        test_category: info.category || "generic",
        test_type: type,
        unit: info.unit || null,
        lower_is_better: false,
        levels: isRatio ? DEFAULT_RATIO_LEVELS : [],
        use_body_weight_ratio: isRatio,
        body_weight_multiplier: null,
        filter_type: "all",
        filter_value: null,
        gender_filter: null,
      };
      opts.push({ key: `gt:${type}`, label: presetLabel(type), benchmark: synth, count: info.count });
      covered.add(normalizeTestKey(type));
    }

    // Speed tests presets
    const speedPresets = new Map<string, number>();
    for (const t of speedTestsScoped as any[]) {
      if (!t.test_type || covered.has(normalizeTestKey(t.test_type))) continue;
      speedPresets.set(t.test_type, (speedPresets.get(t.test_type) || 0) + 1);
    }
    for (const [type, count] of speedPresets) {
      const isTime = /time|40m|1600/.test(type);
      const synth: Benchmark = {
        id: `synthetic-speed-${type}`,
        name: presetLabel(type),
        test_category: "speed",
        test_type: type,
        unit: isTime ? "s" : "km/h",
        lower_is_better: isTime,
        levels: [],
        use_body_weight_ratio: false,
        body_weight_multiplier: null,
        filter_type: "all",
        filter_value: null,
        gender_filter: null,
      };
      opts.push({ key: `sp:${type}`, label: presetLabel(type), benchmark: synth, count });
      covered.add(normalizeTestKey(type));
    }

    // Strength tests presets
    const strengthPresets = new Map<string, number>();
    for (const t of strengthTestsScoped as any[]) {
      if (!t.test_name || covered.has(normalizeTestKey(t.test_name))) continue;
      strengthPresets.set(t.test_name, (strengthPresets.get(t.test_name) || 0) + 1);
    }
    for (const [name, count] of strengthPresets) {
      const synth: Benchmark = {
        id: `synthetic-strength-${name}`,
        name: presetLabel(name),
        test_category: "strength",
        test_type: name,
        unit: "kg",
        lower_is_better: false,
        levels: [],
        use_body_weight_ratio: false,
        body_weight_multiplier: null,
        filter_type: "all",
        filter_value: null,
        gender_filter: null,
      };
      opts.push({ key: `st:${name}`, label: presetLabel(name), benchmark: synth, count });
      covered.add(normalizeTestKey(name));
    }

    // Dedupe : fusionne les entrées qui désignent le même test (alias normalisés,
    // ex. preset "weight" ≡ test personnalisé "Poids"). On garde l'entrée avec
    // un vrai barème (non synthétique) en priorité, sinon celle qui a le plus
    // de résultats. Le compteur retenu est le max pour éviter le double-comptage.
    const merged = new Map<string, TestOption>();
    for (const o of opts) {
      const k = normalizeTestKey(o.benchmark.test_type) || normalizeTestKey(o.label) || o.key;
      const existing = merged.get(k);
      if (!existing) {
        merged.set(k, o);
        continue;
      }
      const isSynthetic = (x: TestOption) => x.benchmark.id.startsWith("synthetic");
      const keep = !isSynthetic(existing) ? existing : !isSynthetic(o) ? o : existing.count >= o.count ? existing : o;
      merged.set(k, { ...keep, count: Math.max(existing.count, o.count) });
    }
    return Array.from(merged.values());
  }, [benchmarks, customTests, genericTestsScoped, speedTestsScoped, strengthTestsScoped]);

  // Emit options to parent (for multi-test rendering)
  useEffect(() => {
    if (!onTestOptions) return;
    onTestOptions(testOptions.map((o) => ({ key: o.key, label: o.label, count: o.count })));
  }, [testOptions, onTestOptions]);

  // Auto-select first option with data (skipped when parent forces a key)
  useEffect(() => {
    if (forcedKey) return;
    if (testOptions.length === 0) return;

    const current = testOptions.find((o) => o.key === internalSelectedKey) || null;
    const firstWithData = testOptions.find((o) => o.count > 0) || null;

    if (!internalSelectedKey || !current) {
      const first = firstWithData || testOptions[0];
      setInternalSelectedKey(first.key);
      autoSelectedRef.current = true;
      return;
    }

    if (autoSelectedRef.current && current.count === 0 && firstWithData && firstWithData.key !== internalSelectedKey) {
      setInternalSelectedKey(firstWithData.key);
    }
  }, [internalSelectedKey, testOptions, forcedKey]);

  const selectedOpt = useMemo(
    () => testOptions.find((o) => o.key === selectedKey) || null,
    [testOptions, selectedKey],
  );
  const bm = selectedOpt?.benchmark || null;

  // ---------- Build results for the selected test ----------
  const playerSeries = useMemo(() => {
    const map = new Map<string, ResultPoint[]>();
    if (!bm) return map;

    const push = (pid: string, date: string, point: ResultPoint) => {
      if (point.value == null || !isFinite(point.value)) return;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(point);
    };

    // Reconstitue rawKg + ratio à partir d'une valeur brute (kg ou ratio) selon le benchmark
    const buildPoint = (pid: string, date: string, raw: number): ResultPoint => {
      const w = playerWeights.get(pid);
      if (bm.use_body_weight_ratio) {
        // Heuristique : raw > 5 → c'est très probablement une charge en kg
        if (raw > 5) {
          if (w && w > 0) {
            const ratio = Number((raw / w).toFixed(2));
            return { date, value: ratio, rawKg: raw, ratio };
          }
          // Pas de poids : on garde la charge en kg, ratio inconnu
          return { date, value: raw, rawKg: raw };
        }
        // raw est déjà un ratio
        const rawKg = w && w > 0 ? Number((raw * w).toFixed(1)) : undefined;
        return { date, value: raw, rawKg, ratio: raw };
      }
      return { date, value: raw };
    };

    genericTestsScoped.forEach((t: any) => {
      if (!matchesBenchmark(t.test_type, bm.test_type, customTests as any)) return;
      const raw = Number(t.result_value);
      if (!isFinite(raw) || raw <= 0) return;
      push(t.player_id, t.test_date, buildPoint(t.player_id, t.test_date, raw));
    });

    if (bm.test_category === "speed" || bm.test_category === "sprint") {
      speedTestsScoped.forEach((t: any) => {
        if (!matchesBenchmark(t.test_type, bm.test_type, customTests as any)) return;
        const v = t.vma_kmh ?? t.speed_kmh ?? t.time_40m_seconds;
        if (v != null) push(t.player_id, t.test_date, { date: t.test_date, value: Number(v) });
      });
    }
    if (
      bm.test_category === "strength" ||
      bm.test_category === "force" ||
      bm.test_category === "musculation"
    ) {
      strengthTestsScoped.forEach((t: any) => {
        if (!matchesBenchmark(t.test_name, bm.test_type, customTests as any)) return;
        if (t.weight_kg != null) {
          const raw = Number(t.weight_kg);
          const w = playerWeights.get(t.player_id);
          if (bm.use_body_weight_ratio) {
            if (w && w > 0) {
              const ratio = Number((raw / w).toFixed(2));
              push(t.player_id, t.test_date, {
                date: t.test_date,
                value: ratio,
                rawKg: raw,
                ratio,
              });
            } else {
              // Sans poids : afficher la charge en kg, ratio inconnu
              push(t.player_id, t.test_date, { date: t.test_date, value: raw, rawKg: raw });
            }
          } else {
            push(t.player_id, t.test_date, { date: t.test_date, value: raw, rawKg: raw });
          }
        }
      });
    }

    for (const [pid, arr] of map) {
      // Dédup par date : garder le meilleur/dernier point (préfère celui qui a rawKg + ratio)
      const byDate = new Map<string, ResultPoint>();
      for (const p of arr) {
        const existing = byDate.get(p.date);
        if (!existing) {
          byDate.set(p.date, p);
          continue;
        }
        const scoreP = (p.rawKg != null ? 2 : 0) + (p.ratio != null ? 1 : 0);
        const scoreE = (existing.rawKg != null ? 2 : 0) + (existing.ratio != null ? 1 : 0);
        if (scoreP >= scoreE) byDate.set(p.date, p);
      }
      const deduped = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
      map.set(pid, deduped);
    }
    return map;
  }, [bm, genericTestsScoped, speedTestsScoped, strengthTestsScoped, customTests, playerWeights]);

  const allDates = useMemo(() => {
    const s = new Set<string>();
    for (const arr of playerSeries.values()) arr.forEach((p) => s.add(p.date));
    return Array.from(s).sort();
  }, [playerSeries]);

  // Résout le groupe de poste canonique d'un joueur
  const resolveGroup = (player: any): { id: string; label: string } => {
    const pos: string | undefined = player?.position;
    if (!pos) return { id: "__unknown__", label: UNKNOWN_POS };
    for (const g of positionGroups) {
      if (playerBelongsToGroup(pos, g)) return { id: g.id, label: g.label };
    }
    // Fallback : utilise directement la position brute
    return { id: pos.toLowerCase(), label: pos };
  };

  // Groupe les joueurs par groupe de poste canonique
  const playersByPosition = useMemo(() => {
    const groups = new Map<string, { label: string; list: any[] }>();
    const source = filterPlayerId
      ? (players as any[]).filter((p) => p.id === filterPlayerId)
      : (players as any[]);
    for (const p of source) {
      const g = resolveGroup(p);
      if (!groups.has(g.id)) groups.set(g.id, { label: g.label, list: [] });
      groups.get(g.id)!.list.push(p);
    }
    // Ordre : suivre positionGroups puis inconnus à la fin
    const orderedIds = [
      ...positionGroups.map((g) => g.id).filter((id) => groups.has(id)),
      ...Array.from(groups.keys()).filter(
        (id) => !positionGroups.some((g) => g.id === id) && id !== "__unknown__",
      ),
      "__unknown__",
    ].filter((id) => groups.has(id));
    return orderedIds.map((id) => [id, groups.get(id)!] as const);
  }, [players, positionGroups, filterPlayerId]);


  // Renvoie le barème le plus spécifique pour (groupe de poste, sexe)
  const getBenchmarkForPlayer = (groupId: string, gender: string | null): Benchmark | null => {
    if (!bm) return null;
      const selectedTestKey = normalizeTestKey(bm.test_type);
      const candidates = benchmarks.filter((b) => normalizeTestKey(b.test_type) === selectedTestKey);
    const group = positionGroups.find((g) => g.id === groupId) || null;
    const matchesGroup = (b: Benchmark) => {
      if (!b.filter_value) return false;
      if (b.filter_value === groupId) return true;
      return group ? playerBelongsToGroup(b.filter_value, group) : false;
    };
    // Priorité : poste + sexe > poste seul > poste (sexe non renseigné côté athlète)
    // > sexe seul > base
    const posAndGender = candidates.find(
      (b) => matchesGroup(b) && b.gender_filter === gender,
    );
    if (posAndGender) return posAndGender;
    const posOnly = candidates.find(
      (b) => matchesGroup(b) && !b.gender_filter,
    );
    if (posOnly) return posOnly;
    // Athlète sans sexe renseigné : on applique quand même le barème de son poste
    if (!gender) {
      const posAnyGender = candidates.find((b) => matchesGroup(b));
      if (posAnyGender) return posAnyGender;
    }
    const genderOnly = candidates.find(
      (b) => !b.filter_value && b.gender_filter === gender,
    );
    if (genderOnly) return genderOnly;
    if (!gender) {
      const anyGenderOnly = candidates.find((b) => !b.filter_value && !!b.gender_filter);
      if (anyGenderOnly) return anyGenderOnly;
    }
    return candidates.find((b) => !b.filter_value && !b.gender_filter) || null;

  };

  // Compat pour la table barème (affichage) : par groupe uniquement
  const getBenchmarkForGroup = (groupId: string): Benchmark | null => {
    if (!bm) return null;
    const group = positionGroups.find((g) => g.id === groupId) || null;
    return (
      benchmarks.find(
        (b) =>
          normalizeTestKey(b.test_type) === normalizeTestKey(bm.test_type) &&
          !!b.filter_value &&
          (b.filter_value === groupId || (group ? playerBelongsToGroup(b.filter_value, group) : false)),
      ) || benchmarks.find((b) => normalizeTestKey(b.test_type) === normalizeTestKey(bm.test_type) && !b.filter_value) || null
    );
  };


  const fmtDate = (d: string) => {
    try {
      return format(parseISO(d), "dd/MM/yy", { locale: fr });
    } catch {
      return d;
    }
  };

  // Build level range string (e.g. "1,0 – 1,2" or "< 1,0" or "> 1,4")
  const levelRangeString = (levels: BenchmarkLevel[], idx: number, lowerIsBetter: boolean) => {
    const lvl = levels[idx];
    if (lvl?.threshold == null) return "—";
    const next = levels[idx + 1];
    const fmt = (n: number) => n.toString().replace(".", ",");
    if (lowerIsBetter) {
      // First (best) = <= threshold ; last (worst) = > previous ; middle range
      if (idx === 0) return `≤ ${fmt(lvl.threshold)}`;
      if (!next) return `> ${fmt(levels[idx - 1].threshold ?? lvl.threshold)}`;
      return `${fmt(levels[idx - 1].threshold ?? lvl.threshold)} – ${fmt(lvl.threshold)}`;
    }
    // higher is better: idx 0 (worst) = < threshold ; last (best) = > previous ; middle = t..t+1
    if (idx === 0) return `< ${fmt(lvl.threshold)}`;
    if (!next) return `≥ ${fmt(lvl.threshold)}`;
    return `${fmt(lvl.threshold)} – ${fmt(next.threshold ?? lvl.threshold)}`;
  };

  // Export Excel : 2 onglets (Barème / Résultats), format long (1 ligne par joueuse et par date)
  const handleExportCsv = async () => {
    if (!bm || allDates.length === 0) return;
    const XLSX = await import("xlsx");
    const ratioTest = !!bm.use_body_weight_ratio;
    const unit = ratioTest ? "kg" : bm.unit || "";
    const lowerBetter = !!bm.lower_is_better;

    // Identifiant normalisé du test (minuscules, sans espaces ni accents)
    const testKey = (selectedOpt?.label || "test")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();

    // --- Onglet Résultats (format long) ---
    const resultRows: Record<string, string | number | null>[] = [];
    // --- Onglet Synthèse (1 ligne par joueur : 1er → dernier test) ---
    const summaryRows: Record<string, string | number | null>[] = [];

    const pct = (delta: number | null, base: number | null | undefined) =>
      delta != null && base != null && Number(base) !== 0
        ? Number(((delta / Math.abs(Number(base))) * 100).toFixed(1))
        : null;
    const trend = (delta: number | null) =>
      delta == null || delta === 0
        ? "stable"
        : (lowerBetter ? delta < 0 : delta > 0)
        ? "progression"
        : "régression";

    playersByPosition.forEach(([groupId, info]) => {
      info.list
        .filter((p: any) => playerSeries.has(p.id))
        .forEach((p: any) => {
          const series = playerSeries.get(p.id) || [];
          const weight = playerWeights.get(p.id) ?? null;
          const first = series[0];
          const last = series[series.length - 1];
          const playerName = p.first_name ? `${p.first_name} ${p.name}` : p.name;
          const metric = (pt: any) =>
            ratioTest && pt?.rawKg != null ? pt.rawKg : pt?.value;

          series.forEach((point, idx) => {
            const prev = series[idx - 1];
            const deltaPrev =
              prev && metric(prev) != null && metric(point) != null
                ? Number((metric(point) - metric(prev)).toFixed(2))
                : null;
            const deltaFirst =
              first && metric(first) != null && metric(point) != null
                ? Number((metric(point) - metric(first)).toFixed(2))
                : null;
            const ratioPrev =
              ratioTest && prev?.ratio != null && point.ratio != null
                ? Number((point.ratio - prev.ratio).toFixed(3))
                : null;
            const ratioFirst =
              ratioTest && first?.ratio != null && point.ratio != null
                ? Number((point.ratio - first.ratio).toFixed(3))
                : null;
            resultRows.push({
              test: testKey,
              poste: info.label,
              joueur: playerName,
              sexe: p.gender || "",
              num_test: idx + 1,
              date: point.date,
              date_precedente: prev?.date ?? null,
              valeur: ratioTest ? point.rawKg ?? point.value ?? null : point.value ?? null,
              unite: ratioTest ? "kg" : unit,
              poids_corps_kg: ratioTest ? weight : null,
              ratio: ratioTest ? point.ratio ?? null : null,
              delta_vs_precedent: deltaPrev,
              delta_pct_vs_precedent: pct(deltaPrev, metric(prev)),
              delta_ratio_vs_precedent: ratioPrev,
              tendance_vs_precedent: prev ? trend(deltaPrev) : null,
              delta_vs_premier: deltaFirst,
              delta_pct_vs_premier: pct(deltaFirst, metric(first)),
              delta_ratio_vs_premier: ratioFirst,
              tendance_vs_premier: idx > 0 ? trend(deltaFirst) : null,
            });
          });

          if (series.length >= 1) {
            const totalDelta =
              first && last && metric(first) != null && metric(last) != null
                ? Number((metric(last) - metric(first)).toFixed(2))
                : null;
            summaryRows.push({
              test: testKey,
              poste: info.label,
              joueur: playerName,
              sexe: p.gender || "",
              nb_tests: series.length,
              poids_corps_kg: ratioTest ? weight : null,
              premiere_date: first?.date ?? null,
              premiere_valeur: metric(first) ?? null,
              derniere_date: last?.date ?? null,
              derniere_valeur: metric(last) ?? null,
              unite: ratioTest ? "kg" : unit,
              delta_total: totalDelta,
              delta_pct_total: pct(totalDelta, metric(first)),
              ratio_premier: ratioTest ? first?.ratio ?? null : null,
              ratio_dernier: ratioTest ? last?.ratio ?? null : null,
              tendance_globale: series.length > 1 ? trend(totalDelta) : null,
            });
          }
        });
    });
    if (resultRows.length === 0) return;


    const slug = (selectedOpt?.label || "test")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .toLowerCase();

    const wb = XLSX.utils.book_new();

    // --- Onglet Barème (colonnes numériques min / max) ---
    if (bm.levels?.length) {
      const baremeRows: Record<string, string | number | null>[] = [];
      playersByPosition.forEach(([groupId, info]) => {
        const posBm = getBenchmarkForGroup(groupId);
        if (!posBm) return;
        const levels = posBm.levels || [];
        const lb = !!posBm.lower_is_better;
        levels.forEach((lvl, i) => {
          const t = lvl.threshold ?? null;
          const prevT = levels[i - 1]?.threshold ?? null;
          const nextT = levels[i + 1]?.threshold ?? null;
          let min: number | null;
          let max: number | null;
          if (lb) {
            min = i === 0 ? null : prevT;
            max = levels[i + 1] ? t : null;
          } else {
            min = i === 0 ? null : t;
            max = i === 0 ? t : levels[i + 1] ? nextT : null;
          }
          baremeRows.push({
            test: testKey,
            poste: info.label,

            niveau: lvl.label,
            min,
            max,
            unite: ratioTest ? "ratio (charge / poids de corps)" : unit,
            sens: lb ? "plus bas = mieux" : "plus haut = mieux",
          });
        });
      });
      if (baremeRows.length > 0) {
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(baremeRows),
          "Barème",
        );
      }
    }

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(resultRows),
      "Résultats",
    );

    if (summaryRows.length > 0) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(summaryRows),
        "Synthèse",
      );
    }


    XLSX.writeFile(wb, `tests-${slug}-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  if (renderOnlyOptions) return null;


  if (benchmarks.length === 0 && customTests.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Target className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">
            Aucun barème ni test personnalisé. Va dans <strong>Effectif → Tests</strong>.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isRatio = !!bm?.use_body_weight_ratio;
  const unitSuffix = isRatio ? "ratio" : bm?.unit || "";

  return (
    <div className="space-y-4">
      {/* HEADER + selector */}
      {!hideSelector && (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Vue effectif par poste & barème
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Sélectionne un test — résultats colorés selon le barème du poste, avec évolution.
              </p>
            </div>
            <div className="min-w-[260px]">
              <Select
                value={selectedKey}
                onValueChange={(value) => {
                  autoSelectedRef.current = false;
                  setSelectedKey(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un test" />
                </SelectTrigger>
                <SelectContent>
                  {testOptions.map((o) => (
                    <SelectItem key={o.key} value={o.key}>
                      {o.label}
                      <span className="ml-2 text-[10px] text-muted-foreground">
                        {o.count > 0
                          ? `${o.count} résultat${o.count > 1 ? "s" : ""}`
                          : "aucun résultat"}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {isRatio && (
            <div className="mt-2">
              <Badge variant="outline" className="text-[11px]">
                <Weight className="h-3 w-3 mr-1" />
                Ratio = charge (kg) ÷ poids de corps (kg)
              </Badge>
            </div>
          )}
        </CardHeader>
      </Card>
      )}

      {/* BARÈME PAR POSTE */}
      {bm && bm.levels?.length > 0 && (() => {
        const sameTest = benchmarks.filter(
          (b) => normalizeTestKey(b.test_type) === normalizeTestKey(bm.test_type),
        );
        const hasCustomBenchmark = sameTest.some((b) => !!b.filter_value || !!b.gender_filter);
        return hasCustomBenchmark;
      })() && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Barème — {selectedOpt?.label}
              {isRatio && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  (ratio charge ÷ poids de corps)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="bg-slate-700 text-white font-semibold min-w-[140px]">
                      Poste
                    </TableHead>
                    {bm.levels.map((l, i) => (
                      <TableHead
                        key={i}
                        className="text-white font-semibold text-center"
                        style={{ backgroundColor: l.color }}
                      >
                        {l.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {playersByPosition.map(([groupId, info]) => {
                    const posBm = getBenchmarkForGroup(groupId);
                    const levels = posBm?.levels || [];
                    return (
                      <TableRow key={groupId}>
                        <TableCell className="bg-slate-100 dark:bg-slate-800 font-medium text-center">
                          {info.label}
                        </TableCell>
                        {bm.levels.map((l, i) => (
                          <TableCell
                            key={i}
                            className="text-center font-mono text-sm"
                            style={{ backgroundColor: posBm ? `${l.color}20` : undefined }}
                          >
                            {posBm ? levelRangeString(levels, i, !!posBm.lower_is_better) : "—"}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>

              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* RÉSULTATS PAR JOUEUR */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                Résultats — {selectedOpt?.label}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Chaque cellule est colorée selon le niveau atteint et affiche la variation par
                rapport au test précédent. La colonne Évolution = variation du premier au dernier
                test.
              </p>

            </div>
            {bm && allDates.length > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCsv}>
                <FileDown className="h-3.5 w-3.5" /> Exporter Excel
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {!bm ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Sélectionne un test pour afficher les résultats.
            </div>
          ) : allDates.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Aucun résultat enregistré pour ce test.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[110px] bg-slate-700 text-white">Poste</TableHead>
                    <TableHead className="min-w-[180px] bg-slate-700 text-white">Joueur</TableHead>
                    {allDates.map((d) => (
                      <TableHead
                        key={d}
                        className="text-center min-w-[110px] bg-slate-700 text-white"
                      >
                        {fmtDate(d)}
                      </TableHead>
                    ))}
                    <TableHead className="text-center min-w-[110px] bg-slate-700 text-white">
                      Évolution
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {playersByPosition.map(([groupId, info]) => {
                    // Filter list to players who have any data
                    const listWithData = info.list.filter((p) => playerSeries.has(p.id));
                    if (listWithData.length === 0) return null;
                    return listWithData.map((p: any, idx: number) => {
                      const series = playerSeries.get(p.id) || [];
                      const weight = playerWeights.get(p.id);
                      const posBm = getBenchmarkForPlayer(groupId, p.gender || null);
                      const first = series[0];
                      const last = series[series.length - 1];
                      // Pour un test en ratio, on affiche l'évolution en kg + ratio
                      const useKgDelta = isRatio && first?.rawKg != null && last?.rawKg != null;
                      const evoDelta = first && last
                        ? useKgDelta ? (last.rawKg! - first.rawKg!) : (last.value - first.value)
                        : 0;
                      const evoUnit = useKgDelta ? " kg" : isRatio ? " ratio" : unitSuffix ? ` ${unitSuffix}` : "";
                      const evoBase = useKgDelta ? first?.rawKg : first?.value;
                      const evoPct =
                        evoBase != null && Number(evoBase) !== 0
                          ? (evoDelta / Math.abs(Number(evoBase))) * 100
                          : null;
                      const ratioDelta = isRatio && first?.ratio != null && last?.ratio != null
                        ? last.ratio - first.ratio
                        : null;

                      const evoImproved: 1 | 0 | -1 = first && last
                        ? posBm?.lower_is_better
                          ? evoDelta < 0 ? 1 : evoDelta > 0 ? -1 : 0
                          : evoDelta > 0 ? 1 : evoDelta < 0 ? -1 : 0
                        : 0;

                      const isLastInGroup = idx === listWithData.length - 1;

                      return (
                        <TableRow
                          key={p.id}
                          className={isLastInGroup ? "border-b-4 border-slate-300 dark:border-slate-600" : ""}
                        >
                          {idx === 0 ? (
                            <TableCell
                              rowSpan={listWithData.length}
                              className="align-middle font-semibold text-sm bg-slate-100 dark:bg-slate-800 border-r text-center"
                            >
                              {info.label}
                              <div className="text-[10px] text-muted-foreground font-normal">
                                {listWithData.length} joueur
                                {listWithData.length > 1 ? "s" : ""}
                              </div>
                            </TableCell>
                          ) : null}
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              <span>{p.first_name ? `${p.first_name} ${p.name}` : p.name}</span>
                              {p.gender && (
                                <span className="text-[10px] text-muted-foreground">
                                  {p.gender === "male" ? "♂" : p.gender === "female" ? "♀" : ""}
                                </span>
                              )}
                              {series.length >= 2 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 ml-auto text-primary hover:text-primary"
                                  title="Voir la courbe d'évolution du joueur"
                                  onClick={() =>
                                    setFocusPlayer({
                                      id: p.id,
                                      name: p.first_name ? `${p.first_name} ${p.name}` : p.name,
                                    })
                                  }
                                >
                                  <LineChartIcon className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          {allDates.map((d) => {
                            const point = series.find((s) => s.date === d);
                            const sIdx = series.findIndex((s) => s.date === d);
                            const prevPoint = sIdx > 0 ? series[sIdx - 1] : null;
                            const stepUseKg =
                              isRatio && point?.rawKg != null && prevPoint?.rawKg != null;
                            const stepDelta =
                              point && prevPoint
                                ? stepUseKg
                                  ? point.rawKg! - prevPoint.rawKg!
                                  : point.value - prevPoint.value
                                : null;
                            const stepBase = stepUseKg ? prevPoint?.rawKg : prevPoint?.value;
                            const stepPct =
                              stepDelta != null && stepBase != null && Number(stepBase) !== 0
                                ? (stepDelta / Math.abs(Number(stepBase))) * 100
                                : null;
                            const stepImproved =
                              stepDelta == null || stepDelta === 0
                                ? 0
                                : posBm?.lower_is_better
                                ? stepDelta < 0
                                  ? 1
                                  : -1
                                : stepDelta > 0
                                ? 1
                                : -1;
                            const stepUnit = stepUseKg
                              ? " kg"
                              : isRatio
                              ? " ratio"
                              : unitSuffix
                              ? ` ${unitSuffix}`
                              : "";

                            if (!point) {
                              return (
                                <TableCell
                                  key={d}
                                  className="text-center text-muted-foreground"
                                >
                                  —
                                </TableCell>
                              );
                            }
                            // Pour un test ratio, on ne calcule le niveau que si le ratio est connu.
                            // point.value contient déjà le ratio → on ne passe PAS le poids
                            // (sinon computeBenchmarkLevel multiplierait à nouveau les seuils).
                            const canComputeLevel =
                              !!posBm && (!isRatio || point.ratio != null);
                            const level = canComputeLevel
                              ? computeBenchmarkLevel(
                                  point.value,
                                  posBm!,
                                  isRatio ? null : weight,
                                )
                              : null;

                            const bgColor = level?.color
                              ? `${level.color}30`
                              : undefined;
                            return (
                              <TableCell
                                key={d}
                                className="text-center"
                                style={{ backgroundColor: bgColor }}
                              >
                                <div className="flex flex-col items-center gap-0.5">
                                  {isRatio ? (
                                    <>
                                      <span className="font-mono font-bold text-sm">
                                        {point.rawKg != null ? (
                                          <>
                                            {point.rawKg}
                                            <span className="text-[10px] font-normal text-muted-foreground ml-0.5">
                                              kg
                                            </span>
                                          </>
                                        ) : (
                                          <>
                                            {point.value}
                                            <span className="text-[10px] font-normal text-muted-foreground ml-0.5">
                                              ratio
                                            </span>
                                          </>
                                        )}
                                      </span>
                                      {point.ratio != null && point.rawKg != null && (
                                        <>
                                          {weight && (
                                            <span className="text-[10px] font-normal text-muted-foreground">
                                              PDC {weight} kg
                                            </span>
                                          )}
                                          <span className="text-[10px] font-normal text-muted-foreground">
                                            ratio {point.ratio.toFixed(2).replace(".", ",")}
                                          </span>
                                        </>
                                      )}
                                      {point.rawKg != null && point.ratio == null && (
                                        <span className="text-[9px] italic text-amber-600">
                                          poids athlète manquant
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="font-mono font-bold text-sm">
                                      {point.value}
                                      <span className="text-[10px] font-normal text-muted-foreground ml-0.5">
                                        {unitSuffix}
                                      </span>
                                    </span>
                                  )}
                                  {stepDelta != null && (
                                    <span
                                      className={`text-[10px] font-semibold ${
                                        stepImproved === 1
                                          ? "text-emerald-600"
                                          : stepImproved === -1
                                          ? "text-rose-600"
                                          : "text-muted-foreground"
                                      }`}
                                      title="Variation par rapport au test précédent"
                                    >
                                      {stepDelta > 0 ? "+" : ""}
                                      {stepDelta.toFixed(stepUseKg || !isRatio ? 1 : 2).replace(".", ",")}
                                      {stepUnit}
                                      {stepPct != null && (
                                        <> ({stepPct > 0 ? "+" : ""}{stepPct.toFixed(1).replace(".", ",")} %)</>
                                      )}
                                    </span>
                                  )}
                                  {level && (

                                    <span
                                      className="text-[10px] font-semibold"
                                      style={{ color: level.color }}
                                    >
                                      {level.label}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center">
                            {series.length < 2 ? (
                              <span className="text-muted-foreground text-xs">—</span>
                            ) : (
                              <div className="flex flex-col items-center gap-0.5">
                                <span
                                  className={`inline-flex items-center gap-1 font-semibold text-sm ${
                                    evoImproved === 1
                                      ? "text-emerald-600"
                                      : evoImproved === -1
                                      ? "text-rose-600"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {evoImproved === 1 ? (
                                    <TrendingUp className="h-4 w-4" />
                                  ) : evoImproved === -1 ? (
                                    <TrendingDown className="h-4 w-4" />
                                  ) : (
                                    <Minus className="h-4 w-4" />
                                  )}
                                  {evoDelta > 0 ? "+" : ""}
                                  {evoDelta.toFixed(useKgDelta ? 1 : 2).replace(".", ",")}
                                  <span className="text-[10px] font-normal ml-0.5">{evoUnit}</span>
                                </span>
                                {evoPct != null && (
                                  <span className="text-[10px] font-semibold text-muted-foreground">
                                    {evoPct > 0 ? "+" : ""}
                                    {evoPct.toFixed(1).replace(".", ",")} %
                                  </span>
                                )}
                                {ratioDelta != null && (
                                  <span className="text-[10px] font-normal text-muted-foreground">
                                    {ratioDelta > 0 ? "+" : ""}
                                    {ratioDelta.toFixed(2).replace(".", ",")} ratio
                                  </span>
                                )}

                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })}
                </TableBody>
              </Table>

              {/* GRAPHIQUE D'ÉVOLUTION */}
              {allDates.length >= 2 && (() => {
                const activePlayers = playersByPosition
                  .flatMap(([, info]) => info.list)
                  .filter((p: any) => (playerSeries.get(p.id) || []).length >= 2);
                if (activePlayers.length === 0) return null;

                const useRatioAxis = isRatio;
                const chartData = allDates.map((d) => {
                  const row: Record<string, any> = { date: fmtDate(d) };
                  activePlayers.forEach((p: any) => {
                    const pt = (playerSeries.get(p.id) || []).find((s) => s.date === d);
                    if (pt) {
                      const key = p.first_name ? `${p.first_name} ${p.name}` : p.name;
                      row[key] = useRatioAxis
                        ? pt.ratio != null
                          ? Number(pt.ratio.toFixed(3))
                          : null
                        : pt.value;
                    }
                  });
                  return row;
                });

                const palette = [
                  "hsl(var(--primary))",
                  "hsl(var(--accent))",
                  "#f59e0b",
                  "#10b981",
                  "#ef4444",
                  "#6366f1",
                  "#ec4899",
                  "#14b8a6",
                ];

                const lowerBetter = !!bm?.lower_is_better;
                const makePctRenderer = (key: string) => (props: any) => {
                  const { x, y, index } = props;
                  if (index === 0 || x == null || y == null) return null;
                  const curr = chartData[index]?.[key];
                  // Valeur précédente non nulle (évolution test à test)
                  let prev: any = null;
                  for (let j = index - 1; j >= 0; j--) {
                    if (chartData[j]?.[key] != null) { prev = chartData[j][key]; break; }
                  }
                  // Première valeur non nulle (évolution cumulée depuis le 1er test)
                  let base: any = null;
                  for (let j = 0; j < index; j++) {
                    if (chartData[j]?.[key] != null) { base = chartData[j][key]; break; }
                  }
                  if (prev == null || curr == null || prev === 0) return null;
                  const pct = ((curr - prev) / Math.abs(prev)) * 100;
                  const cumPct =
                    base != null && base !== 0 ? ((curr - base) / Math.abs(base)) * 100 : null;
                  const improved = lowerBetter ? pct < 0 : pct > 0;
                  const color = improved ? "hsl(142 71% 40%)" : "hsl(0 72% 51%)";
                  const cumImproved = cumPct == null ? null : lowerBetter ? cumPct < 0 : cumPct > 0;
                  const cumColor =
                    cumImproved == null
                      ? "hsl(var(--muted-foreground))"
                      : cumImproved
                      ? "hsl(142 71% 40%)"
                      : "hsl(0 72% 51%)";
                  return (
                    <g>
                      <text x={x + 12} y={y - 18} textAnchor="start" fontSize={10} fontWeight={700} fill={color}>
                        {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
                      </text>
                      {cumPct != null && (
                        <text x={x + 12} y={y - 6} textAnchor="start" fontSize={9} fontWeight={600} fill={cumColor}>
                          cum. {cumPct > 0 ? "+" : ""}{cumPct.toFixed(1)}%
                        </text>
                      )}
                    </g>
                  );
                };


                return (
                  <div className="mt-6">
                    <div className="mb-2 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-semibold">
                        Évolution — {useRatioAxis ? "ratio (charge / poids de corps)" : `valeur${unitSuffix ? ` (${unitSuffix})` : ""}`}
                      </h4>
                    </div>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 30, right: 40, left: 0, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            stroke="hsl(var(--muted-foreground))"
                            domain={["auto", "auto"]}
                            reversed={lowerBetter}
                          />
                          <RTooltip
                            contentStyle={{
                              background: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          {activePlayers.map((p: any, i: number) => {
                            const key = p.first_name ? `${p.first_name} ${p.name}` : p.name;
                            return (
                              <Line
                                key={p.id}
                                type="monotone"
                                dataKey={key}
                                stroke={palette[i % palette.length]}
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                activeDot={{ r: 6 }}
                                connectNulls
                                label={makePctRenderer(key)}
                              />
                            );
                          })}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {bm?.lower_is_better
                        ? "Axe inversé : une courbe descendante = progression."
                        : "Courbe montante = progression, descendante = régression."}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOG COURBE INDIVIDUELLE */}
      <Dialog open={!!focusPlayer} onOpenChange={(o) => !o && setFocusPlayer(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LineChartIcon className="h-4 w-4 text-primary" />
              Évolution — {focusPlayer?.name} · {selectedOpt?.label}
            </DialogTitle>
          </DialogHeader>
          {(() => {
            if (!focusPlayer) return null;
            const series = playerSeries.get(focusPlayer.id) || [];
            if (series.length < 2) {
              return (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Au moins 2 tests sont nécessaires pour tracer une courbe.
                </p>
              );
            }
            const useRatioAxis = isRatio;
            const lowerBetter = !!bm?.lower_is_better;
            const chartData = series.map((pt, i, arr) => {
              const value = useRatioAxis
                ? pt.ratio != null
                  ? Number(pt.ratio.toFixed(3))
                  : null
                : pt.value;
              let pctLabel: { text: string; color: string } | null = null;
              if (i > 0) {
                const prev = useRatioAxis
                  ? arr[i - 1].ratio ?? null
                  : arr[i - 1].value;
                if (prev != null && value != null && prev !== 0) {
                  const pct = ((value - prev) / Math.abs(prev)) * 100;
                  if (Math.abs(pct) >= 0.5) {
                    const improved = lowerBetter ? pct < 0 : pct > 0;
                    pctLabel = {
                      text: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`,
                      color: improved ? "hsl(142 71% 40%)" : "hsl(0 72% 51%)",
                    };
                  }
                }
              }
              return { date: fmtDate(pt.date), value, kg: pt.rawKg ?? null, pctLabel };
            });
            const renderPctLabel = (props: any) => {
              const { x, y, index } = props;
              const d = chartData[index];
              if (!d?.pctLabel) return null;
              return (
                <text
                  x={x + 12}
                  y={y - 8}
                  textAnchor="start"
                  fontSize={11}
                  fontWeight={700}
                  fill={d.pctLabel.color}
                >
                  {d.pctLabel.text}
                </text>
              );
            };
            return (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 30, right: 50, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      domain={["auto", "auto"]}
                      reversed={lowerBetter}
                    />
                    <RTooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      name={useRatioAxis ? "Ratio" : `Valeur${unitSuffix ? ` (${unitSuffix})` : ""}`}
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={{ r: 5 }}
                      activeDot={{ r: 7 }}
                      connectNulls
                      label={renderPctLabel}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <p className="mt-2 text-[11px] text-muted-foreground text-center">
                  {bm?.lower_is_better
                    ? "Axe inversé : courbe descendante = progression."
                    : "Courbe montante = progression, descendante = régression."}
                </p>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
