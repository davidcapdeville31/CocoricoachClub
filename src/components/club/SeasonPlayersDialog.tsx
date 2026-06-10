import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Users, Loader2, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seasonId: string;
  seasonName: string;
  clubId: string;
  categories: any[];
}

export function SeasonPlayersDialog({
  open,
  onOpenChange,
  seasonId,
  seasonName,
  clubId,
  categories,
}: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const categoryIds = useMemo(() => categories.map((c: any) => c.id), [categories]);

  const { data: players = [], isLoading } = useQuery({
    queryKey: ["season-dialog-players", clubId, categoryIds],
    queryFn: async () => {
      if (categoryIds.length === 0) return [];
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name, category_id, season_id, avatar_url")
        .in("category_id", categoryIds)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open && categoryIds.length > 0,
  });

  useEffect(() => {
    if (open) {
      const ids = new Set<string>(
        players.filter((p: any) => p.season_id === seasonId).map((p: any) => p.id),
      );
      setSelected(ids);
    }
  }, [open, players, seasonId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p: any) =>
      `${p.first_name ?? ""} ${p.name ?? ""}`.toLowerCase().includes(q),
    );
  }, [players, search]);

  const grouped = useMemo(() => {
    const byCat: Record<string, any[]> = {};
    for (const p of filtered) {
      const key = p.category_id || "none";
      (byCat[key] ||= []).push(p);
    }
    return byCat;
  }, [filtered]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      const initial = new Set(
        players.filter((p: any) => p.season_id === seasonId).map((p: any) => p.id),
      );
      const toAdd = [...selected].filter((id) => !initial.has(id));
      const toRemove = [...initial].filter((id) => !selected.has(id));

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from("players")
          .update({ season_id: seasonId })
          .in("id", toAdd);
        if (error) throw error;
      }
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("players")
          .update({ season_id: null })
          .in("id", toRemove);
        if (error) throw error;
      }
      return { added: toAdd.length, removed: toRemove.length };
    },
    onSuccess: ({ added, removed }) => {
      qc.invalidateQueries({ queryKey: ["season-player-counts"] });
      qc.invalidateQueries({ queryKey: ["season-dialog-players"] });
      qc.invalidateQueries({ queryKey: ["players"] });
      toast.success(`Mis à jour : +${added} ajouté(s), -${removed} retiré(s)`);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const selectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((p: any) => next.add(p.id));
      return next;
    });
  };
  const clearAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((p: any) => next.delete(p.id));
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Joueurs de la saison « {seasonName} »
          </DialogTitle>
          <DialogDescription>
            Cochez les athlètes à inclure dans cette saison. Les athlètes décochés ne seront plus rattachés à cette saison (mais resteront dans l'effectif).
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={selectAllVisible}>
            Tout cocher
          </Button>
          <Button variant="outline" size="sm" onClick={clearAllVisible}>
            Tout décocher
          </Button>
          <Badge variant="secondary">{selected.size} sélectionné(s)</Badge>
        </div>

        <ScrollArea className="h-[420px] pr-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun joueur trouvé
            </p>
          ) : (
            <div className="space-y-4">
              {categories.map((cat: any) => {
                const list = grouped[cat.id] || [];
                if (list.length === 0) return null;
                return (
                  <div key={cat.id}>
                    <h4 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                      {cat.name} ({list.length})
                    </h4>
                    <div className="space-y-1">
                      {list.map((p: any) => {
                        const checked = selected.has(p.id);
                        const otherSeason = p.season_id && p.season_id !== seasonId;
                        const displayName = p.first_name
                          ? `${p.first_name} ${p.name}`
                          : p.name;
                        return (
                          <label
                            key={p.id}
                            className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/40 cursor-pointer"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggle(p.id)}
                            />
                            <span className="text-sm flex-1">{displayName}</span>
                            {otherSeason && (
                              <Badge variant="outline" className="text-[10px]">
                                Autre saison
                              </Badge>
                            )}
                            {!p.season_id && (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                Sans saison
                              </Badge>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
