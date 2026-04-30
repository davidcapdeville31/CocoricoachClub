import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Lock, Heart } from "lucide-react";
import { INJURY_CATEGORIES } from "@/lib/constants/rugbyInjuries";

interface InjuryLibraryDialogProps {
  categoryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InjuryLibraryDialog({ categoryId, open, onOpenChange }: InjuryLibraryDialogProps) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [injuryCat, setInjuryCat] = useState<string>("musculaire");
  const [description, setDescription] = useState("");
  const [dmin, setDmin] = useState<number | "">("");
  const [dmax, setDmax] = useState<number | "">("");
  const [filterCat, setFilterCat] = useState<string>("all");

  const { data: items, refetch } = useQuery({
    queryKey: ["injury-library", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("injury_library")
        .select("*")
        .or(`is_system_default.eq.true,category_id.eq.${categoryId}`)
        .order("is_system_default", { ascending: false })
        .order("injury_category")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const reset = () => {
    setEditingId(null);
    setName("");
    setInjuryCat("musculaire");
    setDescription("");
    setDmin("");
    setDmax("");
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setName(item.name);
    setInjuryCat(item.injury_category);
    setDescription(item.description || "");
    setDmin(item.typical_duration_days_min ?? "");
    setDmax(item.typical_duration_days_max ?? "");
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nom requis");
      const payload = {
        name: name.trim(),
        injury_category: injuryCat,
        description: description.trim() || null,
        typical_duration_days_min: dmin === "" ? null : Number(dmin),
        typical_duration_days_max: dmax === "" ? null : Number(dmax),
        category_id: categoryId,
        is_system_default: false,
      };
      if (editingId) {
        const { error } = await supabase.from("injury_library").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("injury_library").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Blessure modifiée" : "Blessure ajoutée");
      reset();
      refetch();
      qc.invalidateQueries({ queryKey: ["injury-library"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("injury_library").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Blessure supprimée");
      refetch();
      qc.invalidateQueries({ queryKey: ["injury-library"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const filteredItems = (items || []).filter((it: any) =>
    filterCat === "all" ? true : it.injury_category === filterCat
  );
  const grouped = filteredItems.reduce((acc: Record<string, any[]>, it: any) => {
    (acc[it.injury_category] ||= []).push(it);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-rose-500" />
            Bibliothèque de blessures
          </DialogTitle>
          <DialogDescription>
            Les blessures pré-enregistrées (système) sont disponibles pour tous. Tu peux ajouter tes propres blessures personnalisées.
          </DialogDescription>
        </DialogHeader>

        {/* Add/edit form */}
        <div className="px-6 pb-3 border-b bg-muted/30 space-y-2">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-5">
              <Label className="text-xs">Nom *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Tendinopathie rotulienne" className="h-8" />
            </div>
            <div className="col-span-3">
              <Label className="text-xs">Catégorie</Label>
              <Select value={injuryCat} onValueChange={setInjuryCat}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INJURY_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Durée min (j)</Label>
              <Input type="number" value={dmin} onChange={(e) => setDmin(e.target.value === "" ? "" : Number(e.target.value))} className="h-8" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Durée max (j)</Label>
              <Input type="number" value={dmax} onChange={(e) => setDmax(e.target.value === "" ? "" : Number(e.target.value))} className="h-8" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Description (optionnel)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="text-sm" />
          </div>
          <div className="flex justify-end gap-2 pb-2">
            {editingId && <Button variant="ghost" size="sm" onClick={reset}>Annuler</Button>}
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {editingId ? "Enregistrer modifications" : "Ajouter blessure"}
            </Button>
          </div>
        </div>

        <div className="px-6 pt-3 pb-2 flex items-center gap-2 flex-wrap border-b">
          <Label className="text-xs text-muted-foreground">Filtrer par catégorie :</Label>
          <Button
            variant={filterCat === "all" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilterCat("all")}
          >
            Toutes ({items?.length || 0})
          </Button>
          {INJURY_CATEGORIES.map((c) => {
            const count = (items || []).filter((it: any) => it.injury_category === c.value).length;
            return (
              <Button
                key={c.value}
                variant={filterCat === c.value ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setFilterCat(c.value)}
              >
                {c.label} ({count})
              </Button>
            );
          })}
        </div>

        <ScrollArea className="flex-1 px-6 py-3">
          <div className="space-y-4">
            {Object.entries(grouped).map(([cat, list]) => (
              <div key={cat} className="space-y-1.5">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                  {INJURY_CATEGORIES.find((c) => c.value === cat)?.label || cat}
                </h4>
                <div className="space-y-1">
                  {list.map((it: any) => (
                    <div key={it.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{it.name}</span>
                          {it.is_system_default ? (
                            <Badge variant="secondary" className="text-[10px] h-4">
                              <Lock className="h-2.5 w-2.5 mr-0.5" />Système
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] h-4">Perso</Badge>
                          )}
                          {(it.typical_duration_days_min || it.typical_duration_days_max) && (
                            <Badge variant="outline" className="text-[10px] h-4">
                              {it.typical_duration_days_min}–{it.typical_duration_days_max} j
                            </Badge>
                          )}
                        </div>
                        {it.description && (
                          <p className="text-xs text-muted-foreground truncate">{it.description}</p>
                        )}
                      </div>
                      {!it.is_system_default && (
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(it)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => {
                              if (confirm(`Supprimer "${it.name}" ?`)) remove.mutate(it.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!items?.length && (
              <p className="text-center text-muted-foreground py-8 text-sm">Aucune blessure</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
