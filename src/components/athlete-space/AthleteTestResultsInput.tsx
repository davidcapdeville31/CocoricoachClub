import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlaskConical, Clock, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCustomTestLabels, labelizeTestType } from "@/hooks/useCustomTestLabels";
import { useTranslation } from "react-i18next";
import { useAthleteAttendanceLock } from "@/hooks/useAthleteAttendanceLock";
import { AthleteAbsentLockNotice } from "./AthleteAbsentLockNotice";
import { parseTestWindowFromNotes } from "@/lib/utils/sessionNotes";
import { displayUnit } from "@/lib/constants/testUnits";


interface TestRef {
  test_category: string;
  test_type: string;
  result_unit?: string;
}

export type TestResultsState = Record<string, string>; // key = test_category::test_type

interface Props {
  sessionId: string;
  notes: string | null;
  playerId: string;
  value: TestResultsState;
  onChange: (next: TestResultsState) => void;
  categoryId?: string;
  sessionDate?: string;
}

function parseTestsFromNotes(notes: string | null): TestRef[] {
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

function labelize(v: string) {
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDay(d: string) {
  const [y, m, day] = d.split("-");
  return day && m && y ? `${day}/${m}/${y}` : d;
}


export function AthleteTestResultsInput({ sessionId, notes, playerId, value, onChange, categoryId, sessionDate }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const tests = parseTestsFromNotes(notes);
  const customMap = useCustomTestLabels(tests.map((t) => t.test_type));
  const { isAbsent: attendanceAbsent } = useAthleteAttendanceLock(sessionId, playerId);
  const [pending, setPending] = useState<any[]>([]);
  const [staffSaved, setStaffSaved] = useState<any[]>([]);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);


  const testWindow = parseTestWindowFromNotes(notes);
  // Test planifié sur une période : l'absence à la séance du 1er jour ne doit pas
  // bloquer la saisie, l'athlète fera le test un autre jour de la fenêtre.
  const isAbsent = attendanceAbsent && !testWindow;

  const fetchState = async () => {
    // When the coach defined a testing window, a result submitted on ANY session of the
    // period counts: the athlete can only submit each test once inside the window.
    const pendingQuery = supabase
      .from("pending_test_results")
      .select("test_category, test_type, result_value, result_unit, validation_status, test_date");
    const savedQuery = supabase
      .from("generic_tests")
      .select("test_category, test_type, result_value, result_unit, test_date");

    if (testWindow) {
      pendingQuery
        .eq("player_id", playerId)
        .gte("test_date", testWindow.start)
        .lte("test_date", testWindow.end);
      savedQuery
        .eq("player_id", playerId)
        .gte("test_date", testWindow.start)
        .lte("test_date", testWindow.end);
    } else {
      pendingQuery.eq("training_session_id", sessionId).eq("player_id", playerId);
      savedQuery.eq("player_id", playerId).ilike("notes", `%Session ID: ${sessionId}%`);
    }

    const [{ data: pendingData }, { data: savedData }] = await Promise.all([
      pendingQuery,
      savedQuery,
    ]);
    return { pendingData: pendingData || [], savedData: savedData || [] };
  };

  const reload = async () => {
    const { pendingData, savedData } = await fetchState();
    setPending(pendingData);
    setStaffSaved(savedData);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { pendingData, savedData } = await fetchState();
      if (!cancelled) {
        setPending(pendingData);
        setStaffSaved(savedData);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, playerId, testWindow?.start, testWindow?.end]);



  const handleSendOne = async (test: TestRef) => {
    if (isAbsent) {
      toast.error(t("athleteSpace.calendar.attendance.absentLockTitle"));
      return;
    }
    const key = `${test.test_category}::${test.test_type}`;
    const raw = value[key];

    if (testWindow) {
      // Safety net: one submission per test inside the testing window
      const { pendingData, savedData } = await fetchState();
      const already =
        pendingData.some(
          (p: any) =>
            p.test_category === test.test_category &&
            p.test_type === test.test_type &&
            p.validation_status !== "rejected",
        ) ||
        savedData.some(
          (p: any) => p.test_category === test.test_category && p.test_type === test.test_type,
        );
      if (already) {
        toast.error(t('athleteSpace.components.testResultsInput.alreadySubmittedInWindow'));
        setPending(pendingData);
        setStaffSaved(savedData);
        return;
      }
    }


    if (raw == null || raw === "") {
      toast.error(t('athleteSpace.components.testResultsInput.enterFirst'));
      return;
    }
    const v = parseFloat(raw);
    if (!Number.isFinite(v)) {
      toast.error(t('athleteSpace.components.testResultsInput.invalidResult'));
      return;
    }
    if (!categoryId) {
      toast.error(t('athleteSpace.components.testResultsInput.missingCategory'));
      return;
    }
    setSubmittingKey(key);
    const { error } = await supabase.from("pending_test_results").insert({
      player_id: playerId,
      category_id: categoryId,
      training_session_id: sessionId,
      test_date: sessionDate || new Date().toISOString().slice(0, 10),
      test_category: test.test_category,
      test_type: test.test_type,
      result_value: v,
      result_unit: test.result_unit || null,
      submitted_via: "athlete" as const,
      validation_status: "pending" as const,
    });
    setSubmittingKey(null);
    if (error) {
      toast.error(t('athleteSpace.components.testResultsInput.sendError', { message: error.message }));
      return;
    }
    toast.success(t('athleteSpace.components.testResultsInput.sent'));
    queryClient.invalidateQueries({ queryKey: ["athlete-space-test-campaigns"] });
    queryClient.invalidateQueries({ queryKey: ["athlete-space-past-campaigns"] });
    queryClient.invalidateQueries({ queryKey: ["athlete-space-sessions"] });
    onChange({ ...value, [key]: "" });
    await reload();
  };

  if (tests.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/30">
      <Label className="text-sm flex items-center gap-1.5">
        <FlaskConical className="h-4 w-4 text-primary" />
        {t('athleteSpace.components.testResultsInput.title')}
      </Label>
      {isAbsent && <AthleteAbsentLockNotice />}
      {testWindow && (
        <p className="text-[11px] rounded-md bg-primary/10 border border-primary/20 px-2 py-1.5 text-primary">
          {t('athleteSpace.components.testResultsInput.windowNotice', {
            start: formatDay(testWindow.start),
            end: formatDay(testWindow.end),
          })}
        </p>
      )}



      <div className="space-y-2">
        {tests.map((test, idx) => {
          const key = `${test.test_category}::${test.test_type}`;
          const existing = pending.find(
            (p) => p.test_category === test.test_category && p.test_type === test.test_type,
          );
          const staffRow = staffSaved.find(
            (p) => p.test_category === test.test_category && p.test_type === test.test_type,
          );
          const testLabel = labelizeTestType(test.test_type, customMap);
          const unit = test.result_unit || (test.test_type?.startsWith("custom:") ? customMap[test.test_type]?.unit || "" : "");
          return (
            <div key={idx} className="flex items-center gap-2 flex-wrap">
              <span className="text-xs flex-1 min-w-[140px] font-medium">
                {testLabel}
                <span className="text-muted-foreground ml-1">({labelize(test.test_category)})</span>
              </span>
              {staffRow ? (
                <Badge variant="default" className="text-[10px] gap-1" title={t('athleteSpace.components.testResultsInput.title')}>
                  {staffRow.result_value} {displayUnit(staffRow.result_unit || unit)} {t('athleteSpace.components.testResultsInput.staffValidated')}
                  {testWindow && staffRow.test_date ? ` · ${formatDay(staffRow.test_date)}` : ""}
                </Badge>
              ) : existing ? (
                <Badge
                  variant={existing.validation_status === "validated" ? "default" : existing.validation_status === "rejected" ? "destructive" : "secondary"}
                  className="text-[10px] gap-1"
                >
                  {existing.validation_status === "pending" && <Clock className="h-3 w-3" />}
                  {existing.result_value} {displayUnit(existing.result_unit || test.result_unit || "")}
                  {existing.validation_status === "pending" && t('athleteSpace.components.testResultsInput.pending')}
                  {existing.validation_status === "validated" && t('athleteSpace.components.testResultsInput.validated')}
                  {existing.validation_status === "rejected" && t('athleteSpace.components.testResultsInput.rejected')}
                  {testWindow && existing.test_date ? ` · ${formatDay(existing.test_date)}` : ""}
                </Badge>
              ) : (

                <>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    placeholder={t('athleteSpace.components.testResultsInput.resultPlaceholder')}
                    value={value[key] ?? ""}
                    onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                    className="h-8 w-24 text-sm"
                    disabled={isAbsent}
                  />

                  <span className="text-xs text-muted-foreground w-10">{displayUnit(unit)}</span>
                  {categoryId && (
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      className="h-8 px-2"
                      onClick={() => handleSendOne(test)}
                      disabled={submittingKey === key}
                    >
                      {submittingKey === key ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5 mr-1" />
                          {t('athleteSpace.components.testResultsInput.send')}
                        </>
                      )}
                    </Button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">
        {t('athleteSpace.components.testResultsInput.footer')}
      </p>
    </div>
  );
}

export function buildPendingTestRecords(
  state: TestResultsState,
  notes: string | null,
): Array<{ test_category: string; test_type: string; result_value: number; result_unit: string }> {
  const tests = parseTestsFromNotes(notes);
  const records: any[] = [];
  for (const t of tests) {
    const key = `${t.test_category}::${t.test_type}`;
    const raw = state[key];
    if (raw == null || raw === "") continue;
    const v = parseFloat(raw);
    if (!Number.isFinite(v)) continue;
    records.push({
      test_category: t.test_category,
      test_type: t.test_type,
      result_value: v,
      result_unit: t.result_unit || "",
    });
  }
  return records;
}

/**
 * When the coach defined a testing window, a test may only be submitted once for the whole
 * period. This filters out records already submitted (pending, validated) or saved by staff
 * inside the window, whatever the session used for the entry.
 */
export async function filterTestRecordsAgainstWindow<
  T extends { test_category: string; test_type: string },
>(records: T[], notes: string | null, playerId: string): Promise<T[]> {
  const win = parseTestWindowFromNotes(notes);
  if (!win || records.length === 0) return records;

  const [{ data: pendingData }, { data: savedData }] = await Promise.all([
    supabase
      .from("pending_test_results")
      .select("test_category, test_type, validation_status")
      .eq("player_id", playerId)
      .gte("test_date", win.start)
      .lte("test_date", win.end),
    supabase
      .from("generic_tests")
      .select("test_category, test_type")
      .eq("player_id", playerId)
      .gte("test_date", win.start)
      .lte("test_date", win.end),
  ]);

  const taken = new Set<string>();
  (pendingData || []).forEach((p: any) => {
    if (p.validation_status !== "rejected") taken.add(`${p.test_category}::${p.test_type}`);
  });
  (savedData || []).forEach((p: any) => taken.add(`${p.test_category}::${p.test_type}`));

  return records.filter((r) => !taken.has(`${r.test_category}::${r.test_type}`));
}
