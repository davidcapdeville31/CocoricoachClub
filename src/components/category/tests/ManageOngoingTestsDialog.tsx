import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Pencil, RefreshCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";
import { useSessionNotifications } from "@/lib/hooks/useSessionNotifications";
import { PlanTestsSection } from "./PlanTestsSection";
import { SessionFormDialog } from "../sessions/SessionFormDialog";

interface ManageOngoingTestsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  sportType?: string;
}

interface TestRef {
  test_category: string;
  test_type: string;
  result_unit?: string;
  label: string;
  category_label: string;
}

function parseTestRefs(notes: string | null | undefined): TestRef[] {
  if (!notes) return [];
  const match = notes.match(/<!--TESTS:(\[[\s\S]*?\])-->/);
  if (!match) return [];
  try {
    return JSON.parse(match[1]) as TestRef[];
  } catch {
    return [];
  }
}

export function ManageOngoingTestsDialog({
  open,
  onOpenChange,
  categoryId,
  sportType,
}: ManageOngoingTestsDialogProps) {
  const queryClient = useQueryClient();
  const { isViewer } = useViewerModeContext();
  const { notify } = useSessionNotifications();
  const [editSession, setEditSession] = useState<any | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");

  // Upcoming test sessions (this period + scheduled), soonest first
  const { data: sessions } = useQuery({
    queryKey: ["ongoing-test-sessions", categoryId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select(
          "id, session_date, session_start_time, session_end_time, location, notes, test_reminder_id, created_by_player_id",
        )
        .eq("category_id", categoryId)
        .eq("training_type", "test")
        .gte("session_date", today)
        .order("session_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["ongoing-test-sessions", categoryId] });
    queryClient.invalidateQueries({ queryKey: ["plan-tests-reminders", categoryId] });
    queryClient.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
    queryClient.invalidateQueries({ queryKey: ["training_sessions_annual", categoryId] });
    queryClient.invalidateQueries({ queryKey: ["today_sessions", categoryId] });
    queryClient.invalidateQueries({ queryKey: ["today-training-sessions", categoryId] });
  };

  const deleteSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data: sessionInfo } = await supabase
        .from("training_sessions")
        .select("id, category_id, session_date, session_start_time, training_type")
        .eq("id", sessionId)
        .maybeSingle();

      const [{ data: eventParts }, { data: attendance }] = await Promise.all([
        supabase.from("event_participants").select("player_id").eq("training_session_id", sessionId),
        supabase
          .from("training_attendance")
          .select("player_id")
          .eq("training_session_id", sessionId)
          .neq("status", "absent"),
      ]);
      const participantIds = Array.from(
        new Set(
          [...(attendance ?? []).map((a: any) => a.player_id), ...(eventParts ?? []).map((p: any) => p.player_id)].filter(
            Boolean,
          ),
        ),
      ) as string[];

      const { error } = await supabase.from("training_sessions").delete().eq("id", sessionId);
      if (error) throw error;
      return { sessionInfo, participantIds };
    },
    onSuccess: ({ sessionInfo, participantIds }) => {
      invalidateAll();
      if (sessionInfo) {
        notify({
          action: "deleted",
          sessionId: sessionInfo.id,
          categoryId,
          sessionDate: sessionInfo.session_date,
          sessionStartTime: sessionInfo.session_start_time,
          sessionType: "test",
          participantIds,
        });
      }
      toast.success("Séance de tests supprimée");
    },
    onError: () => toast.error("Suppression impossible"),
  });

  const { standalone, recurring } = useMemo(() => {
    const all = sessions || [];
    return {
      standalone: all.filter((s: any) => !s.test_reminder_id && !s.created_by_player_id),
      recurringCount: all.filter((s: any) => !!s.test_reminder_id).length,
    };
  }, [sessions]);

  return (
    <>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Gérer les tests en cours
          </DialogTitle>
          <DialogDescription>
            Tests en période (séances à venir) et tests programmés récurrents — modifie ou supprime
            ce dont tu n'as plus besoin.
          </DialogDescription>
        </DialogHeader>

        {/* --- Tests en période (séances à venir) --- */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Tests en période ({standalone.length})</h3>
          {standalone.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center rounded-xl border border-border/60 bg-surface-sunken/40">
              Aucun test planifié pour la période à venir.
            </p>
          ) : (
            <div className="space-y-2">
              {standalone.map((s: any) => {
                const tests = parseTestRefs(s.notes);
                return (
                  <div
                    key={s.id}
                    className="rounded-xl border border-border bg-background/40 p-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-medium">
                        {format(new Date(s.session_date), "EEEE dd MMMM yyyy", { locale: getDateLocale() })}
                        {s.session_start_time && (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            · {s.session_start_time.slice(0, 5)}
                            {s.session_end_time ? ` → ${s.session_end_time.slice(0, 5)}` : ""}
                          </span>
                        )}
                        {s.location && (
                          <span className="text-muted-foreground font-normal"> · 📍 {s.location}</span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {tests.length > 0 ? (
                          tests.map((t, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {t.label}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Séance de tests
                          </Badge>
                        )}
                      </div>
                    </div>
                    {!isViewer && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Modifier la séance"
                          onClick={() => setEditSession(s)}
                        >
                          <Pencil className="h-4 w-4 text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Supprimer la séance"
                          onClick={() => deleteSession.mutate(s.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* --- Tests programmés (récurrences) --- */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <RefreshCcw className="h-4 w-4 text-primary" />
            Tests programmés (récurrence)
          </h3>
          <PlanTestsSection categoryId={categoryId} sportType={sportType} hidePlanner />
        </div>
      </DialogContent>

      <SessionFormDialog
        open={!!editSession}
        onOpenChange={(o) => !o && setEditSession(null)}
        categoryId={categoryId}
        editSession={editSession}
        enableRecurrence={false}
      />
    </>
  );
}

import { useState } from "react";
