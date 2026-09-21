import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { usePlayerGroups, PLAYER_GROUP_COLORS } from "@/hooks/usePlayerGroups";
import { useAthlete360, type Athlete360Row } from "@/hooks/analytics/useAthlete360";
import {
  exportAthlete360Csv,
  exportAthlete360Pdf,
  type Athlete360ExportSubject,
} from "@/lib/athlete360Export";
import { toast } from "sonner";
import { format, parseISO, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";
import {
  Users,
  UserCheck,
  Search,
  X,
  Layers,
  FileText,
  FileSpreadsheet,
  Activity,
  ClipboardCheck,
  Trophy,
  Zap,
  HeartPulse,
  Scale,
  BarChart3,
} from "lucide-react";
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

interface Props {
  categoryId: string;
}

type Mode = "players" | "groups";

type Domain = "tests" | "app" | "presence" | "load" | "health" | "weight";

const DOMAINS: { key: Domain; label: string; icon: React.ReactNode }[] = [
  { key: "tests", label: "Performance (tests)", icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { key: "app", label: "Assiduité dans l'app", icon: <Activity className="h-3.5 w-3.5" /> },
  { key: "presence", label: "Présences", icon: <ClipboardCheck className="h-3.5 w-3.5" /> },
  { key: "load", label: "Charge d'entraînement", icon: <Zap className="h-3.5 w-3.5" /> },
  { key: "health", label: "Santé / blessures", icon: <HeartPulse className="h-3.5 w-3.5" /> },
  { key: "weight", label: "Poids", icon: <Scale className="h-3.5 w-3.5" /> },
];

const norm = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const pctText = (v: number | null) => (v == null ? "—" : `${v} %`);

const rateClass = (v: number | null) => {
  if (v == null) return "text-muted-foreground";
  if (v >= 80) return "text-emerald-600 font-semibold";
  if (v >= 50) return "text-amber-600 font-semibold";
  return "text-red-600 font-semibold";
};

const avg = (values: (number | null)[]) => {
  const list = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (list.length === 0) return null;
  return Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 100) / 100;
};

/**
 * Comparaison 360° : croise tests, assiduité app, présences, charge,
 * blessures et poids pour un ou plusieurs athlètes (ou groupes).
 * Générique — toutes disciplines.
 */
export function Athlete360ComparisonPanel({ categoryId }: Props) {
  const [mode, setMode] = useState<Mode>("players");
  const [search, setSearch] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [restrictGroup, setRestrictGroup] = useState<string | null>(null);
  const [selectedTests, setSelectedTests] = useState<string[] | null>(null);
  const [testSearch, setTestSearch] = useState("");
  const [domains, setDomains] = useState<Domain[]>(DOMAINS.map((d) => d.key));
  const has = (d: Domain) => domains.includes(d);

  const [startDate, setStartDate] = useState(() => format(subMonths(new Date(), 3), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const { data: groups = [] } = usePlayerGroups(categoryId);
  const { players, rows, testOptions, isLoading } = useAthlete360(categoryId, startDate, endDate);

  const rowById = useMemo(() => {
    const m = new Map<string, Athlete360Row>();
    rows.forEach((r) => m.set(r.id, r));
    return m;
  }, [rows]);

  const restrictSet = useMemo(() => {
    if (!restrictGroup) return null;
    const g = groups.find((x) => x.id === restrictGroup);
    return g ? new Set(g.playerIds) : null;
  }, [restrictGroup, groups]);

  const visiblePlayers = useMemo(() => {
    const words = norm(search).split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      if (restrictSet && !restrictSet.has(r.id) && !selectedPlayers.includes(r.id)) return false;
      if (words.length === 0) return true;
      if (selectedPlayers.includes(r.id)) return true;
      const hay = norm(r.name);
      return words.every((w) => hay.includes(w));
    });
  }, [rows, search, restrictSet, selectedPlayers]);

  const effectiveTests = selectedTests ?? testOptions.map((t) => t.key);

  const visibleTests = useMemo(() => {
    const q = norm(testSearch);
    if (!q) return testOptions;
    return testOptions.filter((t) => norm(t.label).includes(q));
  }, [testOptions, testSearch]);

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const setPreset = (preset: string) => {
    const now = new Date();
    let start = now;
    let end = now;
    if (preset === "week") start = subDays(now, 7);
    else if (preset === "month") {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else if (preset === "3months") start = subMonths(now, 3);
    else if (preset === "season")
      start = new Date(now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1, 8, 1);
    setStartDate(format(start, "yyyy-MM-dd"));
    setEndDate(format(end, "yyyy-MM-dd"));
  };

  const testStatsFor = (playerRows: Athlete360Row[]) => {
    return testOptions
      .filter((opt) => effectiveTests.includes(opt.key))
      .map((opt) => {
        const values: number[] = [];
        const deltas: number[] = [];
        let lastDate: string | null = null;
        playerRows.forEach((r) => {
          const list = r.tests.filter((t) => t.testKey === opt.key);
          if (list.length === 0) return;
          const first = list[0];
          const last = list[list.length - 1];
          values.push(last.value);
          if (first.date !== last.date) deltas.push(Number((last.value - first.value).toFixed(2)));
          if (!lastDate || last.date > lastDate) lastDate = last.date;
        });
        if (values.length === 0) return null;
        return {
          label: opt.label,
          unit: opt.unit,
          value: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)),
          date: lastDate,
          delta: deltas.length
            ? Number((deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(2))
            : null,
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);
  };

  /** Sujets comparés : athlètes cochés ou groupes cochés (moyennes). */
  const subjects = useMemo(() => {
    if (mode === "players") {
      return selectedPlayers
        .map((pid) => rowById.get(pid))
        .filter((r): r is Athlete360Row => !!r)
        .map((r, i) => ({
          key: r.id,
          name: r.name,
          color: PLAYER_GROUP_COLORS[i % PLAYER_GROUP_COLORS.length],
          count: undefined as number | undefined,
          row: r,
          members: [r],
          tests: testStatsFor([r]),
        }));
    }
    return selectedGroups
      .map((gid) => groups.find((g) => g.id === gid))
      .filter((g): g is NonNullable<typeof g> => !!g)
      .map((g) => {
        const members = g.playerIds
          .map((pid) => rowById.get(pid))
          .filter((r): r is Athlete360Row => !!r);
        const aggregated: Athlete360Row = {
          id: g.id,
          name: g.name,
          wellnessDone: members.reduce((s, m) => s + m.wellnessDone, 0),
          wellnessTotal: members.reduce((s, m) => s + m.wellnessTotal, 0),
          wellnessRate: avg(members.map((m) => m.wellnessRate)),
          rpeDone: members.reduce((s, m) => s + m.rpeDone, 0),
          rpeTotal: members.reduce((s, m) => s + m.rpeTotal, 0),
          rpeRate: avg(members.map((m) => m.rpeRate)),
          appRate: avg(members.map((m) => m.appRate)),
          trainingPresent: members.reduce((s, m) => s + m.trainingPresent, 0),
          trainingTotal: members.reduce((s, m) => s + m.trainingTotal, 0),
          trainingRate: avg(members.map((m) => m.trainingRate)),
          muscuPresent: members.reduce((s, m) => s + m.muscuPresent, 0),
          muscuTotal: members.reduce((s, m) => s + m.muscuTotal, 0),
          muscuRate: avg(members.map((m) => m.muscuRate)),
          terrainPresent: members.reduce((s, m) => s + m.terrainPresent, 0),
          terrainTotal: members.reduce((s, m) => s + m.terrainTotal, 0),
          terrainRate: avg(members.map((m) => m.terrainRate)),
          matchPresent: members.reduce((s, m) => s + m.matchPresent, 0),
          matchCalled: members.reduce((s, m) => s + m.matchCalled, 0),
          matchRate: avg(members.map((m) => m.matchRate)),
          totalLoad: members.reduce((s, m) => s + m.totalLoad, 0),
          weeklyLoad: avg(members.map((m) => m.weeklyLoad)),
          acuteLoad: avg(members.map((m) => m.acuteLoad)),
          chronicLoad: avg(members.map((m) => m.chronicLoad)),
          acwr: avg(members.filter((m) => !m.acwrInsufficient).map((m) => m.acwr)),
          acwrInsufficient: members.length > 0 && members.every((m) => m.acwrInsufficient),
          loadSessions: members.reduce((s, m) => s + m.loadSessions, 0),
          injuryCount: members.reduce((s, m) => s + m.injuryCount, 0),
          injuryDays: members.reduce((s, m) => s + m.injuryDays, 0),
          injuryActive: members.some((m) => m.injuryActive),
          injuryTypes: Array.from(new Set(members.flatMap((m) => m.injuryTypes))),
          weightFirst: avg(members.map((m) => m.weightFirst)),
          weightLast: avg(members.map((m) => m.weightLast)),
          weightDelta: avg(members.map((m) => m.weightDelta)),
          weightSeries: [],
          tests: [],
        };
        return {
          key: g.id,
          name: g.name,
          color: g.color,
          count: members.length,
          row: aggregated,
          members,
          tests: testStatsFor(members),
        };
      });
  }, [mode, selectedPlayers, selectedGroups, rowById, groups, testOptions, effectiveTests]);

  const hasSelection = subjects.length > 0;

  // Courbes de poids
  const weightChart = useMemo(() => {
    const dates = new Set<string>();
    const series = subjects.map((s) => {
      const points = new Map<string, number>();
      if (mode === "players") {
        s.row.weightSeries.forEach((p) => points.set(p.date, p.weight));
      } else {
        const byDate = new Map<string, number[]>();
        s.members.forEach((m) =>
          m.weightSeries.forEach((p) => {
            if (!byDate.has(p.date)) byDate.set(p.date, []);
            byDate.get(p.date)!.push(p.weight);
          }),
        );
        byDate.forEach((vals, d) =>
          points.set(d, Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1))),
        );
      }
      points.forEach((_, d) => dates.add(d));
      return { name: s.name, color: s.color, points };
    });
    const sorted = Array.from(dates).sort();
    const data = sorted.map((d) => {
      const entry: Record<string, string | number> = { date: format(parseISO(d), "dd/MM") };
      series.forEach((s) => {
        const v = s.points.get(d);
        if (v != null) entry[s.name] = v;
      });
      return entry;
    });
    return { data, series };
  }, [subjects, mode]);

  const runExport = async (kind: "pdf" | "csv") => {
    if (!hasSelection) {
      toast.error("Sélectionne au moins un athlète ou un groupe.");
      return;
    }
    const ctx = {
      categoryId,
      mode,
      periodLabel: `${format(parseISO(startDate), "dd/MM/yyyy")} — ${format(parseISO(endDate), "dd/MM/yyyy")}`,
      subjects: subjects.map<Athlete360ExportSubject>((s) => ({
        name: s.name,
        count: s.count,
        appRate: s.row.appRate,
        wellnessRate: s.row.wellnessRate,
        rpeRate: s.row.rpeRate,
        trainingRate: s.row.trainingRate,
        muscuRate: s.row.muscuRate,
        terrainRate: s.row.terrainRate,
        matchRate: s.row.matchRate,
        matchPresent: s.row.matchPresent,
        matchCalled: s.row.matchCalled,
        weeklyLoad: s.row.weeklyLoad,
        acwr: s.row.acwr,
        acwrInsufficient: s.row.acwrInsufficient,
        injuryCount: s.row.injuryCount,
        injuryDays: s.row.injuryDays,
        weightLast: s.row.weightLast,
        weightDelta: s.row.weightDelta,
        tests: s.tests,
      })),
    };
    try {
      if (kind === "pdf") await exportAthlete360Pdf(ctx);
      else exportAthlete360Csv(ctx);
      toast.success(kind === "pdf" ? "Export PDF généré" : "Export CSV généré");
    } catch (e) {
      console.error("[Athlete360] export", e);
      toast.error("Export impossible");
    }
  };

  const SectionTitle = ({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) => (
    <div className="mb-2 flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      <h4 className="text-sm font-semibold">{title}</h4>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-primary" />
              Comparaison 360°
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Croise tests, assiduité, présences, charge, blessures et poids pour les athlètes choisis.
            </p>
          </div>
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
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Choix des données à comparer */}
        <div className="rounded-xl border bg-muted/20 p-2">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <Label className="text-[11px] font-semibold">Données à comparer</Label>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={() => setDomains(DOMAINS.map((d) => d.key))}
            >
              Tout
            </Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setDomains([])}>
              Aucune
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DOMAINS.map((d) => (
              <Badge
                key={d.key}
                variant={has(d.key) ? "default" : "outline"}
                className="cursor-pointer gap-1 px-2 py-1 text-[11px]"
                onClick={() => setDomains((prev) => toggle(prev, d.key) as Domain[])}
              >
                {d.icon}
                {d.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Barre période + export */}
        <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-muted/20 p-2">
          <div className="space-y-1">
            <Label className="text-[11px]">Du</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 w-[140px] text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Au</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 w-[140px] text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {[
              { k: "week", l: "7 jours" },
              { k: "month", l: "Mois" },
              { k: "3months", l: "3 mois" },
              { k: "season", l: "Saison" },
            ].map((p) => (
              <Button
                key={p.k}
                size="sm"
                variant="outline"
                className="h-8 rounded-lg text-[11px]"
                onClick={() => setPreset(p.k)}
              >
                {p.l}
              </Button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
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
        </div>

        {/* Sélection */}
        <div className={`grid gap-4 ${has("tests") ? "lg:grid-cols-2" : ""}`}>
          <div className="rounded-xl border bg-muted/20 p-3">
            {mode === "players" ? (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[180px] flex-1">
                    <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Rechercher un nom ou prénom…"
                      className="h-8 pl-7 pr-7 text-xs"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => setSelectedPlayers(visiblePlayers.map((p) => p.id))}
                  >
                    Tous
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => setSelectedPlayers([])}
                  >
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
                    {visiblePlayers.map((p) => (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selectedPlayers.includes(p.id)}
                          onCheckedChange={() => setSelectedPlayers((prev) => toggle(prev, p.id))}
                        />
                        <span className="truncate">{p.name}</span>
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
                    <span className="ml-auto text-[10px] text-muted-foreground">{g.playerIds.length}</span>
                  </label>
                ))}
                {groups.length === 0 && (
                  <p className="px-2 py-3 text-xs text-muted-foreground">Aucun groupe créé.</p>
                )}
              </div>
            )}
          </div>

          {/* Sélection des tests */}
          {has("tests") && (
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[160px] flex-1">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={testSearch}
                  onChange={(e) => setTestSearch(e.target.value)}
                  placeholder="Rechercher un test…"
                  className="h-8 pl-7 text-xs"
                />
              </div>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setSelectedTests(null)}>
                Tous
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setSelectedTests([])}>
                Aucun
              </Button>
            </div>
            <div className="max-h-[220px] touch-pan-y overflow-y-auto overscroll-contain pr-1">
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
                    {t.unit && <span className="text-[10px] text-muted-foreground">({t.unit})</span>}
                  </label>
                ))}
                {visibleTests.length === 0 && (
                  <p className="px-2 py-3 text-xs text-muted-foreground">Aucun test enregistré.</p>
                )}
              </div>
            </div>
          </div>
          )}
        </div>


        {isLoading && <p className="py-6 text-center text-xs text-muted-foreground">Chargement des données…</p>}

        {!isLoading && !hasSelection && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sélectionne un ou plusieurs {mode === "players" ? "athlètes" : "groupes"} pour lancer la comparaison.
          </p>
        )}

        {hasSelection && (
          <div className="space-y-5">
            {/* Tableau de synthèse */}
            <div className="rounded-xl border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-xs">
                  <thead className="bg-muted/40 text-[11px] text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">{mode === "players" ? "Athlète" : "Groupe"}</th>
                      {has("app") && <th className="p-2 text-center">Assiduité app</th>}
                      {has("presence") && <th className="p-2 text-center">Entraînements</th>}
                      {has("presence") && <th className="p-2 text-center">Musculation</th>}
                      {has("presence") && <th className="p-2 text-center">Terrain</th>}
                      {has("presence") && <th className="p-2 text-center">Compétitions</th>}
                      {has("load") && <th className="p-2 text-center">Charge / sem.</th>}
                      {has("load") && <th className="p-2 text-center">Ratio charge</th>}
                      {has("health") && <th className="p-2 text-center">Blessures</th>}
                      {has("weight") && <th className="p-2 text-center">Poids</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map((s) => (
                      <tr key={s.key} className="border-t">
                        <td className="p-2">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: s.color }}
                            />
                            <span className="font-medium">{s.name}</span>
                            {s.count != null && (
                              <span className="text-[10px] text-muted-foreground">({s.count})</span>
                            )}
                          </span>
                        </td>
                        <td className={`p-2 text-center ${rateClass(s.row.appRate)}`}>{pctText(s.row.appRate)}</td>
                        <td className={`p-2 text-center ${rateClass(s.row.trainingRate)}`}>
                          {pctText(s.row.trainingRate)}
                          <div className="text-[10px] font-normal text-muted-foreground">
                            {s.row.trainingPresent}/{s.row.trainingTotal}
                          </div>
                        </td>
                        <td className={`p-2 text-center ${rateClass(s.row.muscuRate)}`}>
                          {pctText(s.row.muscuRate)}
                          <div className="text-[10px] font-normal text-muted-foreground">
                            {s.row.muscuPresent}/{s.row.muscuTotal}
                          </div>
                        </td>
                        <td className={`p-2 text-center ${rateClass(s.row.terrainRate)}`}>
                          {pctText(s.row.terrainRate)}
                          <div className="text-[10px] font-normal text-muted-foreground">
                            {s.row.terrainPresent}/{s.row.terrainTotal}
                          </div>
                        </td>
                        <td className={`p-2 text-center ${rateClass(s.row.matchRate)}`}>
                          {pctText(s.row.matchRate)}
                          <div className="text-[10px] font-normal text-muted-foreground">
                            {s.row.matchPresent}/{s.row.matchCalled}
                          </div>
                        </td>
                        <td className="p-2 text-center">
                          {s.row.weeklyLoad != null ? Math.round(s.row.weeklyLoad) : "—"}
                          <div className="text-[10px] text-muted-foreground">{s.row.loadSessions} séances</div>
                        </td>
                        <td className="p-2 text-center">
                          {s.row.acwrInsufficient || s.row.acwr == null ? (
                            <span className="text-[10px] text-muted-foreground">Reprise — lecture limitée</span>
                          ) : (
                            <span
                              className={
                                s.row.acwr >= 0.8 && s.row.acwr <= 1.3
                                  ? "font-semibold text-emerald-600"
                                  : "font-semibold text-red-600"
                              }
                            >
                              {s.row.acwr.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          <span className={s.row.injuryCount > 0 ? "font-semibold text-amber-600" : ""}>
                            {s.row.injuryCount}
                          </span>
                          <div className="text-[10px] text-muted-foreground">{s.row.injuryDays} j indispo.</div>
                        </td>
                        <td className="p-2 text-center">
                          {s.row.weightLast != null ? `${s.row.weightLast} kg` : "—"}
                          {s.row.weightDelta != null && (
                            <div
                              className={`text-[10px] ${
                                s.row.weightDelta > 0 ? "text-amber-600" : "text-emerald-600"
                              }`}
                            >
                              {s.row.weightDelta > 0 ? "+" : ""}
                              {s.row.weightDelta} kg
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tests physiques */}
            <div className="rounded-xl border p-3">
              <SectionTitle
                icon={<BarChart3 className="h-4 w-4" />}
                title="Tests physiques"
                hint="dernier résultat et évolution depuis le premier"
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-xs">
                  <thead className="bg-muted/40 text-[11px] text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Test</th>
                      {subjects.map((s) => (
                        <th key={s.key} className="p-2 text-center">
                          {s.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {testOptions
                      .filter((o) => effectiveTests.includes(o.key))
                      .map((opt) => {
                        const cells = subjects.map((s) => s.tests.find((t) => t.label === opt.label) || null);
                        if (cells.every((c) => c === null)) return null;
                        return (
                          <tr key={opt.key} className="border-t">
                            <td className="p-2 font-medium">
                              {opt.label}
                              {opt.unit && (
                                <span className="ml-1 text-[10px] text-muted-foreground">({opt.unit})</span>
                              )}
                            </td>
                            {cells.map((c, i) => (
                              <td key={subjects[i].key} className="p-2 text-center">
                                {c ? (
                                  <>
                                    <span className="font-semibold">{c.value}</span>
                                    <div className="text-[10px] text-muted-foreground">
                                      {c.date ? format(parseISO(c.date), "dd/MM/yy") : "—"}
                                      {c.delta != null && (
                                        <span className={c.delta > 0 ? " text-emerald-600" : " text-red-600"}>
                                          {" "}
                                          {c.delta > 0 ? "+" : ""}
                                          {c.delta}
                                        </span>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Détail par bloc */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border p-3">
                <SectionTitle icon={<Activity className="h-4 w-4" />} title="Assiduité dans l'app" />
                <div className="space-y-2">
                  {subjects.map((s) => (
                    <div key={s.key} className="rounded-lg bg-muted/30 p-2 text-xs">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Wellness <span className={rateClass(s.row.wellnessRate)}>{pctText(s.row.wellnessRate)}</span> (
                        {s.row.wellnessDone}/{s.row.wellnessTotal}) · RPE{" "}
                        <span className={rateClass(s.row.rpeRate)}>{pctText(s.row.rpeRate)}</span> ({s.row.rpeDone}/
                        {s.row.rpeTotal})
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border p-3">
                <SectionTitle icon={<ClipboardCheck className="h-4 w-4" />} title="Présences" />
                <div className="space-y-2">
                  {subjects.map((s) => (
                    <div key={s.key} className="rounded-lg bg-muted/30 p-2 text-xs">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Entraînements <span className={rateClass(s.row.trainingRate)}>{pctText(s.row.trainingRate)}</span>{" "}
                        · Musculation{" "}
                        <span className={rateClass(s.row.muscuRate)}>{pctText(s.row.muscuRate)}</span> · Terrain{" "}
                        <span className={rateClass(s.row.terrainRate)}>{pctText(s.row.terrainRate)}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        <Trophy className="mr-1 inline h-3 w-3" />
                        Compétitions {s.row.matchPresent}/{s.row.matchCalled} ({pctText(s.row.matchRate)})
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border p-3">
                <SectionTitle icon={<Zap className="h-4 w-4" />} title="Charge d'entraînement" />
                <div className="space-y-2">
                  {subjects.map((s) => (
                    <div key={s.key} className="rounded-lg bg-muted/30 p-2 text-xs">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Total {s.row.totalLoad} · Moyenne hebdo{" "}
                        {s.row.weeklyLoad != null ? Math.round(s.row.weeklyLoad) : "—"} · Aiguë{" "}
                        {s.row.acuteLoad ?? "—"} · Chronique {s.row.chronicLoad ?? "—"}
                      </p>
                      <p className="text-[11px]">
                        Ratio :{" "}
                        {s.row.acwrInsufficient || s.row.acwr == null ? (
                          <span className="text-muted-foreground">Reprise — lecture limitée</span>
                        ) : (
                          <span
                            className={
                              s.row.acwr >= 0.8 && s.row.acwr <= 1.3 ? "text-emerald-600" : "text-red-600"
                            }
                          >
                            {s.row.acwr.toFixed(2)}
                          </span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border p-3">
                <SectionTitle icon={<HeartPulse className="h-4 w-4" />} title="Blessures" />
                <div className="space-y-2">
                  {subjects.map((s) => (
                    <div key={s.key} className="rounded-lg bg-muted/30 p-2 text-xs">
                      <p className="font-medium">
                        {s.name}
                        {s.row.injuryActive && (
                          <Badge variant="outline" className="ml-2 border-amber-400 text-[10px] text-amber-600">
                            En cours
                          </Badge>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {s.row.injuryCount} épisode(s) · {s.row.injuryDays} jour(s) d'indisponibilité
                        {s.row.injuryTypes.length > 0 && ` · ${s.row.injuryTypes.join(", ")}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Courbe de poids */}
            {weightChart.data.length > 0 && (
              <div className="rounded-xl border p-3">
                <SectionTitle icon={<Scale className="h-4 w-4" />} title="Courbe de poids" hint="sur la période" />
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={weightChart.data}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} unit=" kg" width={55} />
                    <RTooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {weightChart.series.map((s) => (
                      <Line
                        key={s.name}
                        type="monotone"
                        dataKey={s.name}
                        stroke={s.color}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
