import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Clock } from "lucide-react";

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

export function AthleteTestResultsInput({ sessionId, notes, playerId, value, onChange }: Props) {
  const tests = parseTestsFromNotes(notes);
  const [pending, setPending] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("pending_test_results")
        .select("test_category, test_type, result_value, result_unit, validation_status")
        .eq("training_session_id", sessionId)
        .eq("player_id", playerId);
      if (!cancelled) setPending(data || []);
    })();
    return () => { cancelled = true; };
  }, [sessionId, playerId]);

  if (tests.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/30">
      <Label className="text-sm flex items-center gap-1.5">
        <FlaskConical className="h-4 w-4 text-primary" />
        Mes résultats de tests (en attente de validation staff)
      </Label>
      <div className="space-y-2">
        {tests.map((t, idx) => {
          const key = `${t.test_category}::${t.test_type}`;
          const existing = pending.find(
            (p) => p.test_category === t.test_category && p.test_type === t.test_type,
          );
          return (
            <div key={idx} className="flex items-center gap-2 flex-wrap">
              <span className="text-xs flex-1 min-w-[140px] font-medium">
                {labelize(t.test_type)}
                <span className="text-muted-foreground ml-1">({labelize(t.test_category)})</span>
              </span>
              {existing ? (
                <Badge
                  variant={existing.validation_status === "validated" ? "default" : existing.validation_status === "rejected" ? "destructive" : "secondary"}
                  className="text-[10px] gap-1"
                >
                  {existing.validation_status === "pending" && <Clock className="h-3 w-3" />}
                  {existing.result_value} {existing.result_unit || t.result_unit || ""}
                  {existing.validation_status === "pending" && " — en attente"}
                  {existing.validation_status === "validated" && " ✓"}
                  {existing.validation_status === "rejected" && " ✕"}
                </Badge>
              ) : (
                <>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    placeholder="Résultat"
                    value={value[key] ?? ""}
                    onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                    className="h-8 w-28 text-sm"
                  />
                  <span className="text-xs text-muted-foreground w-10">{t.result_unit || ""}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Tes résultats seront envoyés au staff pour validation avant d'être ajoutés à ton historique.
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
