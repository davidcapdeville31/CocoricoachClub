import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3, Repeat, ShieldCheck, Clock, CalendarIcon, Activity, Thermometer } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface InjuryStatsPanelProps {
  categoryId: string;
}

type PeriodKey = "30" | "90" | "180" | "season" | "all" | "custom";

const PERIOD_LABELS: Record<PeriodKey, string> = {
  "30": "30 derniers jours",
  "90": "90 derniers jours",
  "180": "6 derniers mois",
  season: "Saison en cours",
  all: "Toutes les saisons",
  custom: "Période personnalisée",
};

function getPeriodRange(period: PeriodKey, customFrom?: Date, customTo?: Date): { from: Date | null; to: Date } {
  const now = new Date();
  const to = new Date(now);
  if (period === "all") return { from: null, to };
  if (period === "custom") {
    return { from: customFrom ?? null, to: customTo ?? to };
  }
  if (period === "season") {
    const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return { from: new Date(year, 7, 1), to };
  }
  const days = parseInt(period, 10);
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  return { from, to };
}

function classifyInjury(injuryType: string): "musculaire" | "articulaire" | "ligamentaire" | "osseuse" | "tendineuse" | "autre" {
  const t = (injuryType || "").toLowerCase();
  if (/(ligament|lca|lcp|lli|lle|entorse genou)/.test(t)) return "ligamentaire";
  if (/(entorse|luxation|m[ée]niscale|m[ée]nisque|capsul|articul)/.test(t)) return "articulaire";
  if (/(fracture|fissure|os|stress osseux)/.test(t)) return "osseuse";
  if (/(tendin|tendon|aponevros|fasciite)/.test(t)) return "tendineuse";
  if (/(élong|elong|claquage|d[ée]chirure|contusion|muscul|ischio|quadri|mollet|adducteur|psoas|coiffe)/.test(t))
    return "musculaire";
  return "autre";
}

const TYPE_LABELS: Record<string, string> = {
  musculaire: "Musculaires",
  articulaire: "Articulaires",
  ligamentaire: "Ligamentaires",
  osseuse: "Osseuses",
  tendineuse: "Tendineuses",
  autre: "Autres",
};

const TYPE_COLORS: Record<string, string> = {
  musculaire: "bg-orange-500/20 text-orange-700 dark:text-orange-400",
  articulaire: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  ligamentaire: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
  osseuse: "bg-red-500/20 text-red-700 dark:text-red-400",
  tendineuse: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  autre: "bg-muted text-muted-foreground",
};

export function InjuryStatsPanel({ categoryId }: InjuryStatsPanelProps) {
  const [period, setPeriod] = useState<PeriodKey>("season");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);
  const { from, to } = useMemo(() => getPeriodRange(period, customFrom, customTo), [period, customFrom, customTo]);

  const { data: injuries } = useQuery({
    queryKey: ["injury-stats", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("injuries")
        .select("id, player_id, injury_type, injury_date, actual_return_date, status, players(name)")
        .eq("category_id", categoryId);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: illnesses } = useQuery({
    queryKey: ["illness-stats", categoryId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("illnesses")
        .select("id, player_id, illness_type, illness_date, actual_return_date, status, players(name)")
        .eq("category_id", categoryId);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: playersCount } = useQuery({
    queryKey: ["injury-stats-players-count", categoryId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("players")
        .select("id", { count: "exact", head: true })
        .eq("category_id", categoryId);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const stats = useMemo(() => {
    const list = (injuries || []).filter((i: any) => {
      const d = new Date(i.injury_date);
      if (from && d < from) return false;
      if (d > to) return false;
      return true;
    });

    const counts: Record<string, number> = {};
    for (const i of list) {
      const cat = classifyInjury(i.injury_type);
      counts[cat] = (counts[cat] || 0) + 1;
    }
    const total = list.length;
    const distribution = Object.entries(counts)
      .map(([key, n]) => ({ key, n, pct: total ? (n / total) * 100 : 0 }))
      .sort((a, b) => b.n - a.n);

    const grouped = new Map<string, { player: string; type: string; count: number }>();
    for (const i of list) {
      const key = `${i.player_id}::${(i.injury_type || "").toLowerCase().trim()}`;
      const playerName = (i as any).players?.name || "Athlète";
      const cur = grouped.get(key);
      if (cur) cur.count += 1;
      else grouped.set(key, { player: playerName, type: i.injury_type, count: 1 });
    }
    const relapses = Array.from(grouped.values())
      .filter((g) => g.count >= 2)
      .sort((a, b) => b.count - a.count);

    const durations: number[] = [];
    for (const i of list) {
      const start = new Date(i.injury_date);
      const end = i.actual_return_date ? new Date(i.actual_return_date) : to;
      const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      durations.push(days);
    }
    const avgDuration = durations.length
      ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
      : 0;

    // Illnesses on same period
    const illList = (illnesses || []).filter((i: any) => {
      const d = new Date(i.illness_date);
      if (from && d < from) return false;
      if (d > to) return false;
      return true;
    });
    const illTotal = illList.length;
    const illDurations: number[] = [];
    for (const i of illList) {
      const start = new Date(i.illness_date);
      const end = i.actual_return_date ? new Date(i.actual_return_date) : to;
      illDurations.push(Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))));
    }
    const illAvgDuration = illDurations.length
      ? Math.round(illDurations.reduce((s, d) => s + d, 0) / illDurations.length)
      : 0;

    const allDates = [
      ...list.map((i: any) => new Date(i.injury_date).getTime()),
      ...illList.map((i: any) => new Date(i.illness_date).getTime()),
      to.getTime(),
    ];
    const windowStart = from ?? new Date(Math.min(...allDates));
    const windowDays = Math.max(1, Math.round((to.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24)));
    let injuryDays = 0;
    for (const i of list) {
      const s = new Date(i.injury_date);
      const e = i.actual_return_date ? new Date(i.actual_return_date) : to;
      const start = s < windowStart ? windowStart : s;
      const end = e > to ? to : e;
      injuryDays += Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    }
    let illnessDays = 0;
    for (const i of illList) {
      const s = new Date(i.illness_date);
      const e = i.actual_return_date ? new Date(i.actual_return_date) : to;
      const start = s < windowStart ? windowStart : s;
      const end = e > to ? to : e;
      illnessDays += Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    }
    const unavailableDays = injuryDays + illnessDays;
    const denom = windowDays * Math.max(1, playersCount || 0);
    const availabilityPct = playersCount && denom > 0 ? Math.max(0, Math.min(100, 100 - (unavailableDays / denom) * 100)) : 100;

    return { total, distribution, relapses, avgDuration, availabilityPct, injuryDays, illnessDays, illTotal, illAvgDuration };
  }, [injuries, illnesses, from, to, playersCount]);

  const periodLabel =
    period === "custom"
      ? customFrom && customTo
        ? `du ${format(customFrom, "dd/MM/yyyy")} au ${format(customTo, "dd/MM/yyyy")}`
        : "période personnalisée"
      : PERIOD_LABELS[period].toLowerCase();

  return (
    <Card className="bg-gradient-card shadow-md">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Statistiques des blessures
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {PERIOD_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {period === "custom" && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[160px] justify-start text-left font-normal",
                        !customFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customFrom ? format(customFrom, "dd/MM/yyyy") : "Du..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customFrom}
                      onSelect={setCustomFrom}
                      locale={fr}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[160px] justify-start text-left font-normal",
                        !customTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customTo ? format(customTo, "dd/MM/yyyy") : "Au..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customTo}
                      onSelect={setCustomTo}
                      locale={fr}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-surface">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Disponibilité athlètes</CardTitle>
              <ShieldCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.availabilityPct.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Sur {periodLabel}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-surface">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Temps moyen d'indispo</CardTitle>
              <Clock className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.avgDuration} j</div>
              <p className="text-xs text-muted-foreground mt-1">
                Moyenne sur {stats.total} blessure{stats.total > 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-surface">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Rechutes détectées</CardTitle>
              <Repeat className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.relapses.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Même blessure ≥ 2 fois / athlète
              </p>
            </CardContent>
          </Card>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-3">Répartition par type de blessure</h3>
          {stats.total === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune blessure sur cette période.</p>
          ) : (
            <div className="space-y-2">
              {stats.distribution.map(({ key, n, pct }) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge className={TYPE_COLORS[key]}>{TYPE_LABELS[key] || key}</Badge>
                      <span className="text-muted-foreground">
                        {n} blessure{n > 1 ? "s" : ""}
                      </span>
                    </div>
                    <span className="font-semibold">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Repeat className="h-4 w-4" />
            Détail des rechutes
          </h3>
          {stats.relapses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune rechute détectée sur cette période.
            </p>
          ) : (
            <div className="space-y-2">
              {stats.relapses.map((r, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface border"
                >
                  <div>
                    <div className="font-medium">{r.player}</div>
                    <div className="text-sm text-muted-foreground">{r.type}</div>
                  </div>
                  <Badge variant="destructive">{r.count}× sur la période</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
