import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlaskConical, Clock, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCustomTestLabels, labelizeTestType } from "@/hooks/useCustomTestLabels";

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

export function AthleteTestResultsInput({ sessionId, notes, playerId, value, onChange, categoryId, sessionDate }: Props) {
  const tests = parseTestsFromNotes(notes);
  const customMap = useCustomTestLabels(tests.map((t) => t.test_type));
  const [pending, setPending] = useState<any[]>([]);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);

  const reload = async () => {
    const { data } = await supabase
      .from("pending_test_results")
      .select("test_category, test_type, result_value, result_unit, validation_status")
      .eq("training_session_id", sessionId)
      .eq("player_id", playerId);
    setPending(data || []);
  };

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

  const handleSendOne = async (t: TestRef) => {
    const key = `${t.test_category}::${t.test_type}`;
    const raw = value[key];
    if (raw == null || raw === "") {
      toast.error("Saisis d'abord un résultat");
      return;
    }
    const v = parseFloat(raw);
    if (!Number.isFinite(v)) {
      toast.error("Résultat invalide");
      return;
    }
    if (!categoryId) {
      toast.error("Catégorie manquante");
      return;
    }
    setSubmittingKey(key);
    const { error } = await supabase.from("pending_test_results").insert({
      player_id: playerId,
      category_id: categoryId,
      training_session_id: sessionId,
      test_date: sessionDate || new Date().toISOString().slice(0, 10),
      test_category: t.test_category,
      test_type: t.test_type,
      result_value: v,
      result_unit: t.result_unit || null,
      submitted_via: "athlete" as const,
      validation_status: "pending" as const,
    });
    setSubmittingKey(null);
    if (error) {
      toast.error("Erreur d'envoi : " + error.message);
      return;
    }
    toast.success("Résultat envoyé au staff pour validation");
    onChange({ ...value, [key]: "" });
    await reload();
  };

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
          const testLabel = labelizeTestType(t.test_type, customMap);
          const unit = t.result_unit || (t.test_type?.startsWith("custom:") ? customMap[t.test_type]?.unit || "" : "");
          return (
            <div key={idx} className="flex items-center gap-2 flex-wrap">
              <span className="text-xs flex-1 min-w-[140px] font-medium">
                {testLabel}
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
                    className="h-8 w-24 text-sm"
                  />
                  <span className="text-xs text-muted-foreground w-8">{t.result_unit || ""}</span>
                  {categoryId && (
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      className="h-8 px-2"
                      onClick={() => handleSendOne(t)}
                      disabled={submittingKey === key}
                    >
                      {submittingKey === key ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5 mr-1" />
                          Envoyer
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
