import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { History, CheckCircle, Clock, CalendarRange, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomTestLabels, labelizeTestType } from "@/hooks/useCustomTestLabels";
import { parseTestWindowFromNotes } from "@/lib/utils/sessionNotes";
import { normalizeTestKey } from "@/lib/benchmarks/matchTestType";
import { format } from "date-fns";
import { getDateLocale } from "@/lib/i18n/dateLocale";

interface PlayerLite {
  id: string;
  name: string;
  first_name?: string | null;
}

interface TestRef {
  test_category?: string;
  test_type: string;
}

interface Campaign {
  start: string;
  end: string;
  sessionIds: string[];
  tests: Map<string, TestRef>;
}

function parseTestsFromNotes(notes: string | null | undefined): TestRef[] {
  if (!notes) return [];
  const m = notes.match(/<!--TESTS:(.*?)-->/);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[1]);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

const fullName = (p: PlayerLite) => `${p.name}${p.first_name ? ` ${p.first_name}` : ""}`.trim();

const pctColor = (pct: number) =>
  pct >= 80 ? "text-green-600" : pct >= 50 ? "text-yellow-600" : "text-red-600";
const pctBar = (pct: number) =>
  pct >= 80 ? "[&>div]:bg-green-500" : pct >= 50 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-red-500";

/**
 * Historique annuel des campagnes de tests (TESTWINDOW + tests planifiés) :
 * chaque période passée ou en cours avec le taux de remplissage par test
 * et la liste des athlètes ayant rempli / pas rempli.
 * Générique : fonctionne pour toutes les disciplines.
 */
export function TestsHistorySection({ categoryId }: { categoryId: string }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Effectif de la catégorie
  const { data: players = [] } = useQuery({
    queryKey: ["tests-history-players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return (data || []) as PlayerLite[];
    },
  });

  // Sessions contenant des tests (toutes dates — historique complet)
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["tests-history-sessions", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("id, notes, session_date")
        .eq("category_id", categoryId)
        .like("notes", "%<!--TESTS:%")
        .order("session_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Regroupement par fenêtre (TESTWINDOW) ou par journée
  const campaigns = useMemo<Campaign[]>(() => {
    const map = new Map<string, Campaign>();
    (sessions as any[]).forEach((s) => {
      const testsInNotes = parseTestsFromNotes(s.notes);
      if (testsInNotes.length === 0) return;
      const win = parseTestWindowFromNotes(s.notes);
      const start = win ? win.start : s.session_date;
      const end = win ? win.end : s.session_date;
      if (!start || !end) return;
      const key = `${start}_${end}`;
      if (!map.has(key)) map.set(key, { start, end, sessionIds: [], tests: new Map() });
      const entry = map.get(key)!;
      entry.sessionIds.push(s.id);
      testsInNotes.forEach((t) => {
        const k = normalizeTestKey(t.test_type);
        if (k && !entry.tests.has(k)) entry.tests.set(k, t);
      });
    });
    // Tri : plus récentes en premier
    return Array.from(map.values())
      .filter((c) => c.tests.size > 0)
      .sort((a, b) => (a.end < b.end ? 1 : a.end > b.end ? -1 : a.start < b.start ? 1 : -1));
  }, [sessions]);

  const allSessionIds = campaigns.flatMap((c) => c.sessionIds);
  const minStart = campaigns.reduce<string | null>(
    (acc, c) => (acc === null || c.start < acc ? c.start : acc),
    null,
  );
  const maxEnd = campaigns.reduce<string | null>(
    (acc, c) => (acc === null || c.end > acc ? c.end : acc),
    null,
  );

  const { data: participants = [] } = useQuery({
    queryKey: ["tests-history-participants", allSessionIds.join(",")],
    queryFn: async () => {
      if (allSessionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("event_participants")
        .select("player_id, training_session_id")
        .in("training_session_id", allSessionIds);
      if (error) throw error;
      return data || [];
    },
    enabled: allSessionIds.length > 0,
  });

  const { data: genericTests = [] } = useQuery({
    queryKey: ["tests-history-results", categoryId, minStart, maxEnd],
    queryFn: async () => {
      if (!minStart || !maxEnd) return [];
      const { data, error } = await supabase
        .from("generic_tests")
        .select("player_id, test_type, test_date, result_value, result_unit")
        .eq("category_id", categoryId)
        .gte("test_date", minStart)
        .lte("test_date", maxEnd);
      if (error) throw error;
      return data || [];
    },
    enabled: !!minStart && !!maxEnd,
  });

  const { data: pendingTests = [] } = useQuery({
    queryKey: ["tests-history-pending", allSessionIds.join(",")],
    queryFn: async () => {
      if (allSessionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("pending_test_results")
        .select("player_id, test_type, validation_status, training_session_id")
        .in("training_session_id", allSessionIds);
      if (error) throw error;
      return data || [];
    },
    enabled: allSessionIds.length > 0,
  });

  const allTestTypes = useMemo(
    () => campaigns.flatMap((c) => Array.from(c.tests.values()).map((t) => t.test_type)),
    [campaigns],
  );
  const customMap = useCustomTestLabels(allTestTypes);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <Card className="bg-gradient-card shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Historique des tests
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Suivi annuel des campagnes : période, taux de remplissage et athlètes à jour.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Chargement de l'historique…</p>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground border-2 border-dashed rounded-2xl">
            <History className="h-10 w-10 mx-auto mb-2 opacity-40" />
            Aucune campagne de tests pour le moment.
          </div>
        ) : (
          campaigns.map((campaign) => {
            const key = `${campaign.start}_${campaign.end}`;
            const isOpen = expanded.has(key);
            const isActive = campaign.start <= today && today <= campaign.end;

            const assigned = new Set(
              participants
                .filter((p: any) => campaign.sessionIds.includes(p.training_session_id))
                .map((p: any) => p.player_id),
            );
            const targetPlayers = assigned.size > 0 ? players.filter((p) => assigned.has(p.id)) : players;

            const testEntries = Array.from(campaign.tests.entries()).map(([tKey, testRef]) => {
              const done = new Set<string>();
              const waiting = new Set<string>();
              (genericTests as any[]).forEach((g) => {
                if (normalizeTestKey(g.test_type) !== tKey) return;
                if (g.test_date < campaign.start || g.test_date > campaign.end) return;
                done.add(g.player_id);
              });
              (pendingTests as any[]).forEach((p) => {
                if (!campaign.sessionIds.includes(p.training_session_id)) return;
                if (normalizeTestKey(p.test_type) !== tKey) return;
                if (p.validation_status === "validated") done.add(p.player_id);
                else if (p.validation_status === "pending") waiting.add(p.player_id);
              });
              const total = targetPlayers.length;
              const doneList = targetPlayers.filter((p) => done.has(p.id));
              const pendingList = targetPlayers.filter((p) => !done.has(p.id) && waiting.has(p.id));
              const missingList = targetPlayers.filter((p) => !done.has(p.id) && !waiting.has(p.id));
              const percent = total > 0 ? Math.round((doneList.length / total) * 100) : 0;
              return { tKey, testRef, doneList, pendingList, missingList, total, percent };
            });

            const globalPct =
              testEntries.length > 0
                ? Math.round(testEntries.reduce((s, t) => s + t.percent, 0) / testEntries.length)
                : 0;

            return (
              <div key={key} className="rounded-2xl border bg-muted/30 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
                >
                  <CalendarRange className="h-4 w-4 text-cyan-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">
                        {format(new Date(campaign.start), "d MMM", { locale: getDateLocale() })} →{" "}
                        {format(new Date(campaign.end), "d MMM yyyy", { locale: getDateLocale() })}
                      </span>
                      {isActive ? (
                        <Badge className="text-[10px] bg-green-500 text-white">En cours</Badge>
                      ) : campaign.end < today ? (
                        <Badge variant="secondary" className="text-[10px]">Terminée</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">À venir</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {testEntries.length} test{testEntries.length > 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Progress value={globalPct} className={cn("h-1.5 flex-1 max-w-[220px]", pctBar(globalPct))} />
                      <span className={cn("text-xs font-bold", pctColor(globalPct))}>{globalPct}%</span>
                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t pt-3">
                    {testEntries.map(({ tKey, testRef, doneList, pendingList, missingList, total, percent }) => (
                      <div key={tKey} className="rounded-lg border p-3 space-y-2 bg-card">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">
                            {labelizeTestType(testRef.test_type, customMap)}
                          </span>
                          <span className={cn("text-base font-bold shrink-0", pctColor(percent))}>
                            {percent}%
                          </span>
                        </div>
                        <Progress value={percent} className={cn("h-2", pctBar(percent))} />
                        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                          <span>{doneList.length}/{total} résultats enregistrés</span>
                          {pendingList.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] gap-1">
                              <Clock className="h-3 w-3" />
                              {pendingList.length} à valider
                            </Badge>
                          )}
                          {percent === 100 && (
                            <Badge className="text-[10px] gap-1 bg-green-500 text-white">
                              <CheckCircle className="h-3 w-3" />
                              Complet
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t">
                          <div className="rounded-md border border-green-500/30 bg-green-500/5 p-1.5">
                            <p className="text-[10px] font-semibold text-green-700 dark:text-green-400 px-0.5 pb-1">
                              Ont rempli ({doneList.length})
                            </p>
                            <div className="max-h-28 overflow-y-auto pr-0.5">
                              <div className="flex flex-wrap gap-1">
                                {doneList.map((p) => (
                                  <Badge
                                    key={p.id}
                                    className="text-[10px] bg-green-500/15 text-green-700 dark:text-green-300 border border-green-500/40 hover:bg-green-500/20"
                                  >
                                    {fullName(p)}
                                  </Badge>
                                ))}
                                {doneList.length === 0 && (
                                  <span className="text-[10px] text-muted-foreground italic px-0.5">Aucun</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="rounded-md border border-red-500/30 bg-red-500/5 p-1.5">
                            <p className="text-[10px] font-semibold text-red-700 dark:text-red-400 px-0.5 pb-1">
                              Pas rempli ({missingList.length + pendingList.length})
                            </p>
                            <div className="max-h-28 overflow-y-auto pr-0.5">
                              <div className="flex flex-wrap gap-1">
                                {pendingList.map((p) => (
                                  <Badge
                                    key={p.id}
                                    className="text-[10px] bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border border-yellow-500/40 hover:bg-yellow-500/20"
                                  >
                                    {fullName(p)} · à valider
                                  </Badge>
                                ))}
                                {missingList.map((p) => (
                                  <Badge
                                    key={p.id}
                                    className="text-[10px] bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/40 hover:bg-red-500/20"
                                  >
                                    {fullName(p)}
                                  </Badge>
                                ))}
                                {missingList.length === 0 && pendingList.length === 0 && (
                                  <span className="text-[10px] text-muted-foreground italic px-0.5">Complet ✅</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
