import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Users, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { JUDO_WEIGHT_CATEGORIES } from "@/lib/constants/sportTypes";
import { OpponentProfileDialog, type OpponentProfile } from "./OpponentProfileDialog";
import { toast } from "sonner";

interface Props {
  categoryId: string;
}

const handLabel = (h?: string | null) =>
  h === "left" ? "Gaucher" : h === "right" ? "Droitier" : h === "ambidextrous" ? "Ambidextre" : "—";
const genderLabel = (g?: string | null) =>
  g === "male" ? "H" : g === "female" ? "F" : g === "other" ? "Autre" : "—";
const styleLabel = (s?: string | null) =>
  s === "offensive" ? "Offensif" : s === "defensive" ? "Défensif" : s === "balanced" ? "Équilibré" : "—";
const styleVariant = (s?: string | null) =>
  s === "offensive" ? "destructive" : s === "defensive" ? "secondary" : s === "balanced" ? "default" : "outline";

export function JudoOpponentsTab({ categoryId }: Props) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OpponentProfile | null>(null);
  const [toDelete, setToDelete] = useState<OpponentProfile | null>(null);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [weightFilter, setWeightFilter] = useState<string>("all");

  const { data: category } = useQuery({
    queryKey: ["category-club", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, club_id")
        .eq("id", categoryId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const clubId = category?.club_id;

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["opponent-profiles", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from("opponent_profiles")
        .select("*")
        .eq("club_id", clubId)
        .order("last_name", { ascending: true });
      if (error) throw error;
      return data as OpponentProfile[];
    },
    enabled: !!clubId,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("opponent_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opponent-profiles", clubId] });
      toast.success("Adversaire supprimé");
      setToDelete(null);
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  const filtered = (profiles || []).filter((p) => {
    if (genderFilter !== "all" && p.gender !== genderFilter) return false;
    if (weightFilter !== "all" && p.weight_category !== weightFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = `${p.last_name} ${p.first_name || ""} ${p.club_origin || ""}`.toLowerCase();
      if (!name.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border border-border shadow-sm rounded-2xl bg-card">
        <div className="relative overflow-hidden bg-amber-600 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg ring-1 ring-white/30">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Profils adversaires</h2>
                <p className="text-xs text-white/80">
                  {profiles?.length || 0} adversaire{(profiles?.length || 0) > 1 ? "s" : ""} enregistré{(profiles?.length || 0) > 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-white text-amber-700 hover:bg-amber-50 shadow-lg font-semibold gap-2"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Ajouter un adversaire
            </Button>
          </div>
        </div>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un nom, un club…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={genderFilter} onValueChange={setGenderFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous sexes</SelectItem>
                <SelectItem value="male">Hommes</SelectItem>
                <SelectItem value="female">Femmes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={weightFilter} onValueChange={setWeightFilter}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {JUDO_WEIGHT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Chargement…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 rounded-xl bg-muted/30 border border-dashed">
              <p className="text-sm text-muted-foreground">
                {profiles?.length ? "Aucun adversaire ne correspond aux filtres." : "Aucun adversaire enregistré pour le moment."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Nom</th>
                    <th className="text-left px-3 py-2">Sexe</th>
                    <th className="text-left px-3 py-2">Catégorie</th>
                    <th className="text-left px-3 py-2">Latéralité</th>
                    <th className="text-left px-3 py-2">Profil</th>
                    <th className="text-left px-3 py-2">Club / Pays</th>
                    <th className="text-right px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">
                        {p.last_name} {p.first_name || ""}
                        {p.birth_year ? <span className="text-xs text-muted-foreground ml-1">({p.birth_year})</span> : null}
                      </td>
                      <td className="px-3 py-2">{genderLabel(p.gender)}</td>
                      <td className="px-3 py-2">
                        {p.weight_category ? (
                          <Badge variant="secondary">{p.weight_category.replace(/^judo_/, "")}</Badge>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2">{handLabel(p.handedness)}</td>
                      <td className="px-3 py-2">
                        {p.fighting_style ? (
                          <Badge variant={styleVariant(p.fighting_style) as any}>{styleLabel(p.fighting_style)}</Badge>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {[p.club_origin, p.country].filter(Boolean).join(" • ") || "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditing(p);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setToDelete(p)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {clubId && (
        <OpponentProfileDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          clubId={clubId}
          categoryId={categoryId}
          initial={editing}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet adversaire ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les combats déjà enregistrés conservent le nom mais perdront le lien vers le profil.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete?.id && remove.mutate(toDelete.id)}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
