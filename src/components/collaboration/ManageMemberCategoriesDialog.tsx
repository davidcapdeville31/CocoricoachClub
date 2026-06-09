import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubId: string;
  member: { user_id: string; role: string; profile?: { full_name?: string; email?: string } } | null;
}

export function ManageMemberCategoriesDialog({ open, onOpenChange, clubId, member }: Props) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: categories, isLoading: catsLoading } = useQuery({
    queryKey: ["club-categories-for-member", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, rugby_type")
        .eq("club_id", clubId)
        .eq("is_archived", false)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: currentMemberships, isLoading: memLoading } = useQuery({
    queryKey: ["member-category-memberships", clubId, member?.user_id],
    queryFn: async () => {
      if (!member) return [];
      const catIds = (categories || []).map((c) => c.id);
      if (catIds.length === 0) return [];
      const { data, error } = await supabase
        .from("category_members")
        .select("category_id")
        .eq("user_id", member.user_id)
        .in("category_id", catIds);
      if (error) throw error;
      return data;
    },
    enabled: open && !!member && !!categories,
  });

  useEffect(() => {
    if (currentMemberships) {
      setSelected(new Set(currentMemberships.map((m: any) => m.category_id)));
    }
  }, [currentMemberships]);

  const save = useMutation({
    mutationFn: async () => {
      if (!member || !categories) return;
      const current = new Set((currentMemberships || []).map((m: any) => m.category_id));
      const toAdd = [...selected].filter((id) => !current.has(id));
      const toRemove = [...current].filter((id) => !selected.has(id));

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("category_members")
          .delete()
          .eq("user_id", member.user_id)
          .in("category_id", toRemove);
        if (error) throw error;
      }

      if (toAdd.length > 0) {
        const rows = toAdd.map((category_id) => ({
          category_id,
          user_id: member.user_id,
          role: member.role as any,
        }));
        const { error } = await supabase.from("category_members").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-category-memberships", clubId, member?.user_id] });
      queryClient.invalidateQueries({ queryKey: ["club-members", clubId] });
      toast.success("Catégories mises à jour");
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast.error(e?.message || "Erreur lors de la mise à jour");
    },
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const loading = catsLoading || memLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gérer les catégories</DialogTitle>
          <DialogDescription>
            {member?.profile?.full_name || member?.profile?.email || "Ce membre"} aura accès aux catégories cochées.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : categories && categories.length > 0 ? (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {categories.map((cat) => (
              <label
                key={cat.id}
                className="flex items-center gap-3 p-2 rounded-md border hover:bg-accent/50 cursor-pointer"
              >
                <Checkbox
                  checked={selected.has(cat.id)}
                  onCheckedChange={() => toggle(cat.id)}
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">{cat.name}</div>
                  {cat.rugby_type && (
                    <div className="text-xs text-muted-foreground">{cat.rugby_type}</div>
                  )}
                </div>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune catégorie dans ce club.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || loading}>
            {save.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
