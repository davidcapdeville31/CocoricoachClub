import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Megaphone, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface WellnessReminderButtonProps {
  categoryId: string;
}

export function WellnessReminderButton({ categoryId }: WellnessReminderButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const queryClient = useQueryClient();

  const today = format(new Date(), "yyyy-MM-dd");

  const { data: lastReminder } = useQuery({
    queryKey: ["wellness-reminder-last", categoryId, today],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("wellness_reminder_log")
        .select("sent_at, targeted_count, sent_by")
        .eq("category_id", categoryId)
        .gte("sent_at", startOfDay.toISOString())
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: players = [] } = useQuery({
    queryKey: ["wellness-reminder-players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name, email, user_id")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const { data: filledToday = [] } = useQuery({
    queryKey: ["wellness-filled-today", categoryId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_tracking")
        .select("player_id")
        .eq("category_id", categoryId)
        .eq("tracking_date", today);
      if (error) throw error;
      return data?.map((d) => d.player_id) || [];
    },
    enabled: open,
  });

  const filledSet = new Set(filledToday);
  const missingPlayers = players.filter((p) => !filledSet.has(p.id));

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const playerIds =
        selectedIds.size > 0 ? Array.from(selectedIds) : undefined;
      const { data, error } = await supabase.functions.invoke(
        "manual-wellness-reminder",
        {
          body: {
            categoryId,
            playerIds,
            onlyMissing: selectedIds.size === 0 ? onlyMissing : false,
          },
        }
      );
      if (error) throw error;
      const targeted = data?.targeted ?? 0;
      const emails = data?.emailsSent ?? 0;
      const pushes = data?.pushSent ?? 0;
      if (targeted === 0) {
        toast({
          title: t("health.wellnessReminderButton.toastNoneToNotifyTitle"),
          description: t("health.wellnessReminderButton.toastNoneToNotifyDescription"),
        });
      } else {
        toast({
          title: t("health.wellnessReminderButton.toastSentTitle"),
          description: t("health.wellnessReminderButton.toastSentDescription", { targeted, emails, pushes }),
        });
      }
      queryClient.invalidateQueries({ queryKey: ["wellness-reminder-last", categoryId] });
      setOpen(false);
      setSelectedIds(new Set());
    } catch (e: any) {
      toast({
        title: t("health.wellnessReminderButton.toastErrorTitle"),
        description: e?.message || t("health.wellnessReminderButton.toastErrorDescription"),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const displayPlayers =
    onlyMissing && selectedIds.size === 0 ? missingPlayers : players;

  const alreadySent = !!lastReminder;
  const sentAgo = lastReminder
    ? formatDistanceToNow(new Date(lastReminder.sent_at), { addSuffix: true, locale: getDateLocale() })
    : null;

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant={alreadySent ? "secondary" : "outline"}
          onClick={() => setOpen(true)}
          title={
            alreadySent
              ? t("health.wellnessReminderButton.alreadySentTooltip", { time: sentAgo, count: lastReminder?.targeted_count })
              : t("health.wellnessReminderButton.sendTooltip")
          }
        >
          {alreadySent ? (
            <CheckCircle2 className="h-4 w-4 mr-2 text-status-optimal" />
          ) : (
            <Megaphone className="h-4 w-4 mr-2" />
          )}
          {t("health.wellnessReminderButton.buttonLabel")}
        </Button>
        {alreadySent ? (
          <Badge
            variant="outline"
            className="border-status-optimal/40 bg-status-optimal/10 text-status-optimal text-xs whitespace-nowrap"
          >
            {t("health.wellnessReminderButton.alreadySentBadge", { time: sentAgo, count: lastReminder?.targeted_count })}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground whitespace-nowrap">
            {t("health.wellnessReminderButton.noReminderBadge")}
          </Badge>
        )}
      </div>


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("health.wellnessReminderButton.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("health.wellnessReminderButton.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          {alreadySent && (
            <div className="rounded-lg border border-status-optimal/30 bg-status-optimal/10 p-3 text-sm">
              <p className="font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-status-optimal" />
                {t("health.wellnessReminderButton.alreadySentInfoTitle")}
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                {t("health.wellnessReminderButton.alreadySentInfoDescription", { count: lastReminder?.targeted_count, time: sentAgo })}
              </p>
            </div>
          )}



          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
              <Checkbox
                id="only-missing"
                checked={onlyMissing}
                onCheckedChange={(c) => {
                  setOnlyMissing(!!c);
                  setSelectedIds(new Set());
                }}
              />
              <Label htmlFor="only-missing" className="text-sm cursor-pointer">
                {t("health.wellnessReminderButton.onlyMissingLabel")}
                <span className="ml-1 text-muted-foreground">
                  ({missingPlayers.length}/{players.length})
                </span>
              </Label>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                {t("health.wellnessReminderButton.manualSelectionLabel")}
                <span className="ml-1 text-xs text-muted-foreground">
                  {t("health.wellnessReminderButton.manualSelectionHint")}
                </span>
              </Label>
              <ScrollArea className="h-56 rounded-md border p-2">
                {displayPlayers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {onlyMissing
                      ? t("health.wellnessReminderButton.allFilled")
                      : t("health.wellnessReminderButton.noPlayers")}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {displayPlayers.map((p) => {
                      const name = [p.first_name, p.name]
                        .filter(Boolean)
                        .join(" ");
                      const checked = selectedIds.has(p.id);
                      const filled = filledSet.has(p.id);
                      return (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggle(p.id)}
                          />
                          <span className="flex-1">{name}</span>
                          {filled && (
                            <span className="text-xs text-status-optimal">
                              {t("health.wellnessReminderButton.filled")}
                            </span>
                          )}
                          {!p.user_id && (
                            <span className="text-xs text-muted-foreground">
                              {t("health.wellnessReminderButton.noAccount")}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("health.wellnessReminderButton.cancel")}
            </Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("health.wellnessReminderButton.sending")}
                </>
              ) : (
                <>
                  <Megaphone className="h-4 w-4 mr-2" />
                  {t("health.wellnessReminderButton.send")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
