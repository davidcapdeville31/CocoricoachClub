import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FlaskConical, CheckCircle, Clock, CalendarRange } from "lucide-react";
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

interface Props {
  categoryId: string;
  /** Date du jour (yyyy-MM-dd) */
  date: string;
  players: PlayerLite[];
}

interface TestRef {
  test_category?: string;
  test_type: string;
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

const fullName = (p: PlayerLite) => `${p.first_name ? p.first_name + " " : ""}${p.name}`.trim();

/**
 * Affiche les campagnes de tests planifiées sur une période (TESTWINDOW) en cours,
 * avec une ligne par test et le % d'athlètes ayant renseigné leur résultat.
 * Générique : fonctionne pour toutes les disciplines.
 */
export function TestCampaignsCompletionCard({ categoryId, date, players }: Props) {
  // 1. Sessions de la catégorie contenant des tests (campagne TESTWINDOW ou tests planifiés sur une journée)
  const { data: sessions = [] } = useQuery({
    queryKey: ["decision-test-campaigns-sessions", categoryId, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("id, notes, training_type, session_date, session_start_time")
        .eq("category_id", categoryId)
        .like("notes", "%<!--TESTS:%")
        .order("session_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60_000,
  });

  // 2. Regroupement par fenêtre active (TESTWINDOW) ou par journée (test planifié sur 1 jour)
  const campaigns = useMemo(() => {
    const map = new Map<
      string,
      { start: string; end: string; sessionIds: string[]; tests: Map<string, TestRef> }
    >();
    (sessions as any[]).forEach((s) => {
      const testsInNotes = parseTestsFromNotes(s.notes);
      if (testsInNotes.length === 0) return;
      const win = parseTestWindowFromNotes(s.notes);
      let start: string;
      let end: string;
      if (win) {
        if (!(win.start <= date && date <= win.end)) return;
        start = win.start;
        end = win.end;
      } else {
        // Test planifié sur une seule journée : on l'affiche à partir du jour J
        if (!s.session_date || s.session_date > date) return;
        start = s.session_date;
        end = s.session_date;
      }
      const key = `${start}_${end}`;
      if (!map.has(key)) map.set(key, { start, end, sessionIds: [], tests: new Map() });
      const entry = map.get(key)!;
      entry.sessionIds.push(s.id);
      testsInNotes.forEach((t) => {
        const k = normalizeTestKey(t.test_type);
        if (k && !entry.tests.has(k)) entry.tests.set(k, t);
      });
    });
    return Array.from(map.values()).filter((c) => c.tests.size > 0);
  }, [sessions, date]);

  const allSessionIds = campaigns.flatMap((c) => c.sessionIds);
  const minStart = campaigns.reduce<string | null>(
    (acc, c) => (acc === null || c.start < acc ? c.start : acc),
    null,
  );
  const maxEnd = campaigns.reduce<string | null>(
    (acc, c) => (acc === null || c.end > acc ? c.end : acc),
    null,
  );

  // 3. Participants assignés à ces sessions
  const { data: participants = [] } = useQuery({
    queryKey: ["decision-test-campaigns-participants", allSessionIds.join(",")],
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

  // 4. Résultats validés sur la période
  const { data: genericTests = [] } = useQuery({
    queryKey: ["decision-test-campaigns-results", categoryId, minStart, maxEnd],
    queryFn: async () => {
      if (!minStart || !maxEnd) return [];
      const { data, error } = await supabase
        .from("generic_tests")
        .select("player_id, test_type, test_date")
        .eq("category_id", categoryId)
        .gte("test_date", minStart)
        .lte("test_date", maxEnd);
      if (error) throw error;
      return data || [];
    },
    enabled: !!minStart && !!maxEnd,
    refetchInterval: 60_000,
  });

  // 5. Résultats en attente de validation
  const { data: pendingTests = [] } = useQuery({
    queryKey: ["decision-test-campaigns-pending", allSessionIds.join(",")],
    queryFn: async () => {
      if (allSessionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("pending_test_results")
        .select("player_id, test_type, validation_status, training_session_id, test_date")
        .in("training_session_id", allSessionIds);
      if (error) throw error;
      return data || [];
    },
    enabled: allSessionIds.length > 0,
    refetchInterval: 60_000,
  });

  const allTestTypes = useMemo(
    () => campaigns.flatMap((c) => Array.from(c.tests.values()).map((t) => t.test_type)),
    [campaigns],
  );
  const customMap = useCustomTestLabels(allTestTypes);

  if (campaigns.length === 0) return null;

  return (
    <Card className="border-2 border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-cyan-600" />
          Campagnes de tests en cours
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {campaigns.map((campaign) => {
          const assigned = new Set(
            participants
              .filter((p: any) => campaign.sessionIds.includes(p.training_session_id))
              .map((p: any) => p.player_id),
          );
          const targetPlayers = assigned.size > 0 ? players.filter((p) => assigned.has(p.id)) : players;

          // On calcule d'abord les tests non complétés à 100%
          const activeTestEntries = Array.from(campaign.tests.entries()).map(([key, testRef]) => {
            const done = new Set<string>();
            const waiting = new Set<string>();

            (genericTests as any[]).forEach((g) => {
              if (normalizeTestKey(g.test_type) !== key) return;
              if (g.test_date < campaign.start || g.test_date > campaign.end) return;
              done.add(g.player_id);
            });
            (pendingTests as any[]).forEach((p) => {
              if (!campaign.sessionIds.includes(p.training_session_id)) return;
              if (normalizeTestKey(p.test_type) !== key) return;
              if (p.validation_status === "validated") done.add(p.player_id);
              else if (p.validation_status === "pending") waiting.add(p.player_id);
            });

            const total = targetPlayers.length;
            const doneList = targetPlayers.filter((p) => done.has(p.id));
            const pendingList = targetPlayers.filter((p) => !done.has(p.id) && waiting.has(p.id));
            const missingList = targetPlayers.filter((p) => !done.has(p.id) && !waiting.has(p.id));
            const doneCount = doneList.length;
            const pendingCount = pendingList.length;
            const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;

            return { key, testRef, doneList, pendingList, missingList, doneCount, pendingCount, total, percent };
          }).filter((t) => t.percent < 100);

          if (activeTestEntries.length === 0) return null;

          return (
            <div key={`${campaign.start}_${campaign.end}`} className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {format(new Date(campaign.start), "d MMM", { locale: getDateLocale() })} →{" "}
                {format(new Date(campaign.end), "d MMM yyyy", { locale: getDateLocale() })}
              </p>

              {activeTestEntries.map(({ key, testRef, doneList, pendingList, missingList, doneCount, pendingCount, total, percent }) => {
                return (
                  <div key={key} className="rounded-lg border p-3 space-y-2 bg-card">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate flex items-center gap-1.5">
                        <FlaskConical className="h-4 w-4 text-cyan-600 shrink-0" />
                        {labelizeTestType(testRef.test_type, customMap)}
                      </span>
                      <span
                        className={cn(
                          "text-lg font-bold shrink-0",
                          percent >= 80 ? "text-green-600" : percent >= 50 ? "text-yellow-600" : "text-red-600",
                        )}
                      >
                        {percent}%
                      </span>
                    </div>
                    <Progress
                      value={percent}
                      className={cn(
                        "h-2",
                        percent >= 80
                          ? "[&>div]:bg-green-500"
                          : percent >= 50
                            ? "[&>div]:bg-yellow-500"
                            : "[&>div]:bg-red-500",
                      )}
                    />
                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                      <span>
                        {doneCount}/{total} résultats enregistrés
                      </span>
                      {pendingCount > 0 && (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Clock className="h-3 w-3" />
                          {pendingCount} à valider
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                      {/* Colonne verte : athlètes ayant rempli */}
                      <div className="rounded-md border border-green-500/30 bg-green-500/5 p-1.5">
                        <p className="text-[10px] font-semibold text-green-700 dark:text-green-400 flex items-center gap-1 px-0.5 pb-1">
                          <CheckCircle className="h-3 w-3" />
                          Ont rempli ({doneCount})
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
                            {doneCount === 0 && (
                              <span className="text-[10px] text-muted-foreground italic px-0.5">Aucun</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Colonne rouge : athlètes n'ayant pas rempli */}
                      <div className="rounded-md border border-red-500/30 bg-red-500/5 p-1.5">
                        <p className="text-[10px] font-semibold text-red-700 dark:text-red-400 flex items-center gap-1 px-0.5 pb-1">
                          <Clock className="h-3 w-3" />
                          Pas rempli ({missingList.length + pendingCount})
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
                            {missingList.length === 0 && pendingCount === 0 && (
                              <span className="text-[10px] text-muted-foreground italic px-0.5">Complet ✅</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
