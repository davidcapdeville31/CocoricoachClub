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
import { format } from "date-fns";

interface WellnessReminderButtonProps {
  categoryId: string;
}

export function WellnessReminderButton({ categoryId }: WellnessReminderButtonProps) {
  const [open, setOpen] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");

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
          title: "Aucun athlète à notifier",
          description:
            "Tous les athlètes sélectionnés ont déjà rempli leur wellness aujourd'hui.",
        });
      } else {
        toast({
          title: "Rappel envoyé ✅",
          description: `${targeted} athlète(s) notifié(s) — ${emails} email(s), ${pushes} push.`,
        });
      }
      setOpen(false);
      setSelectedIds(new Set());
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e?.message || "Impossible d'envoyer le rappel.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const displayPlayers =
    onlyMissing && selectedIds.size === 0 ? missingPlayers : players;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        title="Envoyer un rappel push + email aux athlètes"
      >
        <Megaphone className="h-4 w-4 mr-2" />
        Rappeler le Wellness
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>📣 Rappel Wellness</DialogTitle>
            <DialogDescription>
              Envoie une notification push + email aux athlètes pour leur
              rappeler de remplir leur wellness du jour.
            </DialogDescription>
          </DialogHeader>

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
                Seulement ceux qui n'ont pas rempli aujourd'hui
                <span className="ml-1 text-muted-foreground">
                  ({missingPlayers.length}/{players.length})
                </span>
              </Label>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                Sélection manuelle (optionnel)
                <span className="ml-1 text-xs text-muted-foreground">
                  — laisser vide = tout le groupe ci-dessus
                </span>
              </Label>
              <ScrollArea className="h-56 rounded-md border p-2">
                {displayPlayers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {onlyMissing
                      ? "Tous les athlètes ont rempli leur wellness ✅"
                      : "Aucun athlète."}
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
                              ✓ rempli
                            </span>
                          )}
                          {!p.user_id && (
                            <span className="text-xs text-muted-foreground">
                              (pas de compte)
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
              Annuler
            </Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Megaphone className="h-4 w-4 mr-2" />
                  Envoyer le rappel
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
