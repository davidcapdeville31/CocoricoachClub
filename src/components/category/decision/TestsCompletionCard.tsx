import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FlaskConical, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomTestLabels, labelizeTestType } from "@/hooks/useCustomTestLabels";
import { useTranslation } from "react-i18next";

interface PlayerLite {
  id: string;
  name: string;
  first_name?: string | null;
}

interface SessionLite {
  id: string;
  notes?: string | null;
  training_type?: string | null;
  session_start_time?: string | null;
}

interface Props {
  categoryId: string;
  date: string;
  sessions: SessionLite[];
  players: PlayerLite[];
  participants?: Array<{ player_id: string; training_session_id: string }>;
}

function parseTestsFromNotes(notes: string | null | undefined) {
  if (!notes) return [] as Array<{ test_category: string; test_type: string; result_unit?: string }>;
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

export function TestsCompletionCard({ categoryId, date, sessions, players, participants = [] }: Props) {
  const { t } = useTranslation();
  const testSessions = useMemo(
    () => sessions.filter((s) => parseTestsFromNotes(s.notes).length > 0),
    [sessions],
  );
  const sessionIds = testSessions.map((s) => s.id);

  const { data: genericTests = [] } = useQuery({
    queryKey: ["decision-tests-generic", categoryId, date, sessionIds.join(",")],
    queryFn: async () => {
      if (sessionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("generic_tests")
        .select("player_id, test_category, test_type, notes, test_date")
        .eq("category_id", categoryId)
        .eq("test_date", date);
      if (error) throw error;
      return data || [];
    },
    enabled: sessionIds.length > 0,
    refetchInterval: 60_000,
  });

  const { data: pendingTests = [] } = useQuery({
    queryKey: ["decision-tests-pending", categoryId, sessionIds.join(",")],
    queryFn: async () => {
      if (sessionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("pending_test_results")
        .select("player_id, test_category, test_type, validation_status, training_session_id")
        .in("training_session_id", sessionIds);
      if (error) throw error;
      return data || [];
    },
    enabled: sessionIds.length > 0,
    refetchInterval: 60_000,
  });

  const allTestTypes = useMemo(
    () => testSessions.flatMap((s) => parseTestsFromNotes(s.notes).map((t) => t.test_type)),
    [testSessions],
  );
  const customMap = useCustomTestLabels(allTestTypes);

  if (testSessions.length === 0) return null;

  return (
    <Card className="border-2 border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-cyan-600" />
          {t("decision.tests.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {testSessions.map((session) => {
          const tests = parseTestsFromNotes(session.notes);
          const assigned = participants
            .filter((p) => p.training_session_id === session.id)
            .map((p) => p.player_id);
          const targetPlayers = assigned.length > 0 ? players.filter((p) => assigned.includes(p.id)) : players;

          return (
            <div key={session.id} className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {session.session_start_time ? `${session.session_start_time.slice(0, 5)} · ` : ""}
                {session.training_type || t("decision.common.session")}
              </p>

              {tests.map((testRef, idx) => {
                const done = new Set<string>();
                const waiting = new Set<string>();
                genericTests.forEach((g: any) => {
                  if (
                    g.test_category === testRef.test_category &&
                    g.test_type === testRef.test_type &&
                    (g.notes || "").includes(`Session ID: ${session.id}`)
                  ) {
                    done.add(g.player_id);
                  }
                });
                pendingTests.forEach((p: any) => {
                  if (
                    p.training_session_id === session.id &&
                    p.test_category === testRef.test_category &&
                    p.test_type === testRef.test_type
                  ) {
                    if (p.validation_status === "validated") done.add(p.player_id);
                    else if (p.validation_status === "pending") waiting.add(p.player_id);
                  }
                });

                const total = targetPlayers.length;
                const doneCount = targetPlayers.filter((p) => done.has(p.id)).length;
                const pendingCount = targetPlayers.filter((p) => !done.has(p.id) && waiting.has(p.id)).length;
                const missing = targetPlayers.filter((p) => !done.has(p.id) && !waiting.has(p.id));
                const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;

                return (
                  <div key={idx} className="rounded-lg border p-3 space-y-2 bg-card">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
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
                        {t("decision.tests.resultsRecorded", { done: doneCount, total })}
                      </span>
                      {pendingCount > 0 && (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Clock className="h-3 w-3" />
                          {t("decision.tests.toValidate", { count: pendingCount })}
                        </Badge>
                      )}
                      {percent === 100 && (
                        <Badge className="text-[10px] gap-1 bg-green-500 text-white">
                          <CheckCircle className="h-3 w-3" />
                          {t("decision.tests.complete")}
                        </Badge>
                      )}
                    </div>
                    {missing.length > 0 && missing.length <= 8 && (
                      <div className="flex flex-wrap gap-1 pt-1 border-t">
                        {missing.map((p) => (
                          <Badge key={p.id} variant="outline" className="text-[10px]">
                            {fullName(p)}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {missing.length > 8 && (
                      <p className="text-[11px] text-muted-foreground pt-1 border-t">
                        {t("decision.tests.waitingAthletes", { count: missing.length })}
                      </p>
                    )}
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
