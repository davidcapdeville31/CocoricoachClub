import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Bell, Check, CalendarDays, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getDateLocale } from "@/lib/i18n/dateLocale";
import { cn } from "@/lib/utils";

interface CalendarNotification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  notification_subtype: string | null;
  metadata: Record<string, unknown> | null;
}

interface CalendarNotificationsPanelProps {
  categoryId: string;
  onOpenSession: (sessionId: string) => void;
}

export function CalendarNotificationsPanel({ categoryId, onOpenSession }: CalendarNotificationsPanelProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["calendar-athlete-notifications", categoryId, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, message, created_at, notification_subtype, metadata")
        .eq("user_id", user.id)
        .eq("category_id", categoryId)
        .eq("notification_type", "athlete_session")
        .eq("is_read", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as CalendarNotification[];
    },
    enabled: Boolean(categoryId && user?.id),
    staleTime: 30_000,
  });

  const { data: players = [] } = useQuery({
    queryKey: ["calendar-notification-players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name")
        .eq("category_id", categoryId);
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(categoryId) && notifications.length > 0,
    staleTime: 60_000,
  });

  const playerNames = useMemo(() => {
    const map = new Map<string, string>();
    players.forEach((player) => {
      map.set(player.id, player.first_name ? `${player.first_name} ${player.name}` : player.name);
    });
    return map;
  }, [players]);

  const markRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-athlete-notifications", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["unread-athlete-sessions-count", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("category_id", categoryId)
        .eq("notification_type", "athlete_session")
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-athlete-notifications", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["unread-athlete-sessions-count", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  if (isLoading || notifications.length === 0) return null;

  return (
    <section className="rounded-xl border border-destructive/25 bg-destructive/5 p-3" aria-labelledby="calendar-notifications-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-destructive" />
          <h3 id="calendar-notifications-title" className="text-sm font-semibold">
            {t("planning.calendarViews.notifications.title")}
          </h3>
          <Badge variant="destructive" className="h-5 min-w-5 justify-center px-1.5 text-xs">
            {notifications.length > 9 ? "9+" : notifications.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending}
        >
          <Check className="h-3 w-3" />
          {t("planning.calendarViews.notifications.markAllRead")}
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("planning.calendarViews.notifications.subtitle")}
      </p>
      <ScrollArea className="mt-3 max-h-56">
        <div className="space-y-1.5 pr-3">
          {notifications.map((notification) => {
            const metadata = notification.metadata || {};
            const sessionId = typeof metadata.session_id === "string" ? metadata.session_id : null;
            const playerId = typeof metadata.player_id === "string" ? metadata.player_id : null;
            const playerName = playerId ? playerNames.get(playerId) : null;
            const date = typeof metadata.session_date === "string" ? metadata.session_date : null;
            const time = typeof metadata.time === "string" ? metadata.time.slice(0, 5) : null;
            const dateLabel = date
              ? format(new Date(`${date}T12:00:00`), "EEEE d MMMM", { locale: getDateLocale() })
              : null;
            const isSelfPlanned = notification.notification_subtype === "self_planned";

            return (
              <div key={notification.id} className="flex items-center gap-2 rounded-lg border bg-background/70 px-2.5 py-2">
                <CalendarDays className="h-4 w-4 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {playerName && <><UserRound className="mr-1 inline h-3 w-3" />{playerName} · </>}
                    {isSelfPlanned
                      ? t("planning.calendarViews.notifications.sessionAdded")
                      : notification.title.replace(/^\S+\s/, "")}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {dateLabel}{time ? ` · ${time}` : ""} · {notification.message}
                  </p>
                </div>
                {sessionId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("h-7 shrink-0 px-2 text-xs", "border-destructive/30 text-destructive hover:bg-destructive/10")}
                    onClick={() => {
                      markRead.mutate(notification.id);
                      onOpenSession(sessionId);
                    }}
                  >
                    {t("planning.calendarViews.notifications.open")}
                  </Button>
                )}
                {!sessionId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    title={t("planning.calendarViews.notifications.markRead")}
                    onClick={() => markRead.mutate(notification.id)}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </section>
  );
}
