import { useEffect, useState } from "react";
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
import { Plus, Pencil, Trash2, Users, Search, Eye, Sparkles } from "lucide-react";
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
import { OpponentScoutingSheet } from "./scouting/OpponentScoutingSheet";
import { DangerStars } from "./scouting/scoutingWidgets";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  categoryId: string;
}

const handLabel = (h?: string | null) =>
  h === "left" ? "Gaucher" : h === "right" ? "Droitier" : h === "ambidextrous" ? "Ambidextre" : null;

export function JudoOpponentsTab({ categoryId }: Props) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scoutingOpen, setScoutingOpen] = useState(false);
  const [scoutingId, setScoutingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<OpponentProfile | null>(null);
  const [toDelete, setToDelete] = useState<OpponentProfile | null>(null);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [weightFilter, setWeightFilter] = useState<string>("all");
  const [ageFilter, setAgeFilter] = useState<string>("all");
  const [handFilter, setHandFilter] = useState<string>("all");
  const [dangerFilter, setDangerFilter] = useState<string>("all");

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
        .order("danger_level", { ascending: false, nullsFirst: false })
        .order("last_name", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!clubId,
  });

  useEffect(() => {
    if (!clubId) return;
    const channel = supabase
      .channel(`opponent-profiles-staff-${clubId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "opponent_profiles", filter: `club_id=eq.${clubId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["opponent-profiles", clubId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [clubId, qc]);

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
    if (ageFilter !== "all" && p.age_category !== ageFilter) return false;
    if (handFilter !== "all" && p.handedness !== handFilter) return false;
    if (dangerFilter !== "all" && (p.danger_level || 0) < parseInt(dangerFilter, 10)) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = `${p.last_name} ${p.first_name || ""} ${p.club_origin || ""} ${p.country || ""}`.toLowerCase();
      if (!name.includes(q)) return false;
    }
    return true;
  });

  const openScouting = (id: string) => {
    setScoutingId(id);
    setScoutingOpen(true);
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border border-border shadow-sm rounded-2xl bg-card">
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-amber-700 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg ring-1 ring-white/30">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Scouting adversaires</h2>
                <p className="text-xs text-white/80">
                  {profiles?.length || 0} fiche{(profiles?.length || 0) > 1 ? "s" : ""} • analyse tactique haut niveau
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-white text-slate-900 hover:bg-amber-50 shadow-lg font-semibold gap-2"
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
          {/* Filtres */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un nom, un club, un pays…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={genderFilter} onValueChange={setGenderFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous sexes</SelectItem>
                <SelectItem value="male">Hommes</SelectItem>
                <SelectItem value="female">Femmes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={weightFilter} onValueChange={setWeightFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {JUDO_WEIGHT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ageFilter} onValueChange={setAgeFilter}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous âges</SelectItem>
                {["Benjamin","Minime","Cadet","Junior","Senior","Vétéran"].map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={handFilter} onValueChange={setHandFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Latéralité</SelectItem>
                <SelectItem value="right">Droitier</SelectItem>
                <SelectItem value="left">Gaucher</SelectItem>
                <SelectItem value="ambidextrous">Ambidextre</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dangerFilter} onValueChange={setDangerFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tout danger</SelectItem>
                <SelectItem value="3">⭐ 3+</SelectItem>
                <SelectItem value="4">⭐ 4+</SelectItem>
                <SelectItem value="5">⭐ 5</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Chargement…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 rounded-xl bg-muted/30 border border-dashed">
              <Users className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {profiles?.length ? "Aucun adversaire ne correspond aux filtres." : "Aucun adversaire enregistré pour le moment."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((p: any) => {
                const top3 = ((p.tokui_waza as any[]) || [])
                  .slice()
                  .sort((a, b) => (Number(b.danger) * Number(b.frequency)) - (Number(a.danger) * Number(a.frequency)))
                  .slice(0, 3);
                const handed = handLabel(p.handedness);
                return (
                  <div
                    key={p.id}
                    className="group relative rounded-2xl border bg-card overflow-hidden hover:shadow-xl hover:border-amber-500/50 transition-all duration-200 cursor-pointer"
                    onClick={() => openScouting(p.id)}
                  >
                    {/* Header photo + danger */}
                    <div className="relative h-28 bg-gradient-to-br from-slate-800 to-slate-700 overflow-hidden">
                      {p.photo_url ? (
                        <img
                          src={p.photo_url}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-4xl font-bold text-white/30">
                            {(p.last_name?.[0] || "?").toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-transparent" />
                      {p.danger_level && (
                        <div className="absolute top-2 right-2 bg-rose-500/90 backdrop-blur px-2 py-1 rounded-full shadow-lg">
                          <DangerStars value={p.danger_level} onChange={() => {}} readonly size="sm" />
                        </div>
                      )}
                      <div className="absolute bottom-2 left-3 right-3 text-white">
                        <div className="font-bold truncate drop-shadow-md">
                          {p.last_name} {p.first_name || ""}
                        </div>
                        <div className="text-[10px] text-white/80 truncate">
                          {[p.club_origin, p.country].filter(Boolean).join(" • ") || "Sans club"}
                        </div>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-3 space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {p.weight_category && (
                          <Badge variant="secondary" className="text-[10px]">
                            {p.weight_category.replace(/^judo_/, "")}
                          </Badge>
                        )}
                        {p.age_category && (
                          <Badge variant="outline" className="text-[10px]">{p.age_category}</Badge>
                        )}
                        {handed && (
                          <Badge variant="outline" className="text-[10px]">{handed}</Badge>
                        )}
                      </div>

                      {top3.length > 0 ? (
                        <div className="space-y-1">
                          <div className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
                            <Sparkles className="h-2.5 w-2.5 text-amber-500" />
                            Top techniques
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {top3.map((t: any, i: number) => (
                              <Badge
                                key={i}
                                className={cn(
                                  "text-[10px] border-0 text-white",
                                  i === 0 ? "bg-rose-500" : i === 1 ? "bg-orange-500" : "bg-amber-500",
                                )}
                              >
                                {t.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] italic text-muted-foreground">
                          Aucune technique enregistrée
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex border-t bg-muted/30">
                      <button
                        className="flex-1 py-2 text-[11px] font-medium hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-400 transition-colors flex items-center justify-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          openScouting(p.id);
                        }}
                      >
                        <Eye className="h-3 w-3" />
                        Scouting
                      </button>
                      <div className="w-px bg-border" />
                      <button
                        className="px-3 hover:bg-destructive/10 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setToDelete(p);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                );
              })}
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

      <OpponentScoutingSheet
        open={scoutingOpen}
        onOpenChange={setScoutingOpen}
        opponentId={scoutingId}
      />

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
