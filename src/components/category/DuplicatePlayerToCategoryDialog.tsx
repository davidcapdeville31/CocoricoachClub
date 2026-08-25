import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, CopyPlus } from "lucide-react";

interface DuplicatePlayerToCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  player: { id: string; name: string; first_name?: string | null; user_id?: string | null } | null;
}

export function DuplicatePlayerToCategoryDialog({
  open,
  onOpenChange,
  categoryId,
  player,
}: DuplicatePlayerToCategoryDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (open) setSelected([]);
  }, [open, player?.id]);

  const fullName = player ? `${player.first_name ? player.first_name + " " : ""}${player.name}` : "";

  // Categories the current staff can see (RLS scoped), excluding the current one
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories-for-duplicate", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, club_id, clubs(name)")
        .order("name");
      if (error) throw error;
      return (data || []).filter((c: any) => c.id !== categoryId);
    },
    enabled: open,
  });

  // Categories where the player is already present (direct or linked)
  const { data: existingIds = [] } = useQuery({
    queryKey: ["player-existing-categories", player?.id],
    queryFn: async () => {
      if (!player) return [];
      const ids = new Set<string>();
      const { data: base } = await supabase
        .from("players")
        .select("category_id")
        .eq("id", player.id)
        .maybeSingle();
      if (base?.category_id) ids.add(base.category_id);
      const { data: links } = await supabase
        .from("player_categories")
        .select("category_id")
        .eq("player_id", player.id);
      links?.forEach((l: any) => ids.add(l.category_id));
      return Array.from(ids);
    },
    enabled: open && !!player,
  });

  const duplicate = useMutation({
    mutationFn: async () => {
      if (!player) throw new Error(t("roster.duplicatePlayerToCategoryDialog.toasts.playerNotFound"));
      const targets = categories.filter((c: any) => selected.includes(c.id));
      const rows = targets.map((c: any) => ({
        player_id: player.id,
        category_id: c.id,
        club_id: c.club_id,
        is_primary: false,
        status: player.user_id ? "pending" : "accepted",
      }));
      const { error } = await supabase.from("player_categories").insert(rows);
      if (error) throw error;
      return { count: rows.length, needsConsent: !!player.user_id };
    },
    onSuccess: ({ count, needsConsent }) => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
      queryClient.invalidateQueries({ queryKey: ["player-existing-categories", player?.id] });
      queryClient.invalidateQueries({ queryKey: ["existing-players-ids"] });
      toast.success(
        needsConsent
          ? t("roster.duplicatePlayerToCategoryDialog.toasts.pendingApproval", { count })
          : t("roster.duplicatePlayerToCategoryDialog.toasts.added", { count })
      );
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error?.message?.includes("duplicate")
        ? t("roster.duplicatePlayerToCategoryDialog.toasts.alreadyInCategory")
        : t("roster.duplicatePlayerToCategoryDialog.toasts.genericError", { message: error?.message ?? t("roster.duplicatePlayerToCategoryDialog.toasts.unknownError") }));
    },
  });

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CopyPlus className="h-5 w-5" />
            {t("roster.duplicatePlayerToCategoryDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("roster.duplicatePlayerToCategoryDialog.description", { name: fullName })}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : categories.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("roster.duplicatePlayerToCategoryDialog.noOtherCategory")}
            </p>
          ) : (
            <div className="space-y-1">
              {categories.map((c: any) => {
                const already = existingIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 ${
                      already ? "opacity-60" : "cursor-pointer hover:bg-accent/50"
                    }`}
                  >
                    <Checkbox
                      checked={already || selected.includes(c.id)}
                      disabled={already}
                      onCheckedChange={() => !already && toggle(c.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      {c.clubs?.name && (
                        <p className="truncate text-xs text-muted-foreground">{c.clubs.name}</p>
                      )}
                    </div>
                    {already && <Badge variant="secondary">{t("roster.duplicatePlayerToCategoryDialog.alreadyPresent")}</Badge>}
                  </label>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("roster.duplicatePlayerToCategoryDialog.cancel")}
          </Button>
          <Button
            onClick={() => {
              if (selected.length === 0) {
                toast.error(t("roster.duplicatePlayerToCategoryDialog.toasts.selectAtLeastOne"));
                return;
              }
              duplicate.mutate();
            }}
          >
            {duplicate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("roster.duplicatePlayerToCategoryDialog.duplicateButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
