import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Users, Pencil, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  JUDO_WEIGHT_CATEGORIES,
  JUDO_WEIGHT_CATEGORIES_MEN,
  JUDO_WEIGHT_CATEGORIES_WOMEN,
} from "@/lib/constants/sportTypes";
import { toast } from "sonner";
import {
  OpponentProfileDialog,
  type OpponentProfile,
} from "@/components/category/judo/OpponentProfileDialog";
import { OpponentScoutingSheet } from "@/components/category/judo/scouting/OpponentScoutingSheet";

interface Props {
  playerId: string;
  categoryId: string;
}

const handLabel = (h?: string | null) =>
  h === "left" ? "Gaucher" : h === "right" ? "Droitier" : h === "ambidextrous" ? "Ambidextre" : "—";
const styleLabel = (s?: string | null) =>
  s === "offensive" ? "Offensif" : s === "defensive" ? "Défensif" : s === "balanced" ? "Équilibré" : "—";
const styleVariant = (s?: string | null) =>
  s === "offensive" ? "destructive" : s === "defensive" ? "secondary" : s === "balanced" ? "default" : "outline";
const genderLabel = (g?: string | null) =>
  g === "male" ? "H" : g === "female" ? "F" : g === "other" ? "Autre" : "—";

export function AthleteOpponentProfiles({ playerId, categoryId }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [weightFilter, setWeightFilter] = useState("all");
  const [ageFilter, setAgeFilter] = useState("all");
  const [handFilter, setHandFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OpponentProfile | null>(null);
  const [toDelete, setToDelete] = useState<OpponentProfile | null>(null);
  const [scoutingId, setScoutingId] = useState<string | null>(null);
  const [scoutingOpen, setScoutingOpen] = useState(false);

  const { data: player } = useQuery({
    queryKey: ["athlete-opp-player", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name, gender, discipline, category_id, categories!inner(id, club_id, name)")
        .eq("id", playerId)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const clubId: string | undefined = player?.categories?.club_id;
  const playerWeight: string | null = player?.discipline || null;
  const inferredGender: "male" | "female" | null = playerWeight
    ? JUDO_WEIGHT_CATEGORIES_MEN.some((w) => w.value === playerWeight)
      ? "male"
      : JUDO_WEIGHT_CATEGORIES_WOMEN.some((w) => w.value === playerWeight)
      ? "female"
      : null
    : null;
  const playerGender: "male" | "female" | null =
    player?.gender === "male" || player?.gender === "female" ? player.gender : inferredGender;

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["athlete-opp-profiles", clubId],
    enabled: !!clubId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opponent_profiles")
        .select("*")
        .eq("club_id", clubId!)
        .order("last_name", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  useEffect(() => {
    if (!clubId) return;
    const channel = supabase
      .channel(`opponent-profiles-athlete-${clubId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "opponent_profiles", filter: `club_id=eq.${clubId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["athlete-opp-profiles", clubId] });
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
      toast.success("Adversaire supprimé");
      qc.invalidateQueries({ queryKey: ["athlete-opp-profiles", clubId] });
      setToDelete(null);
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  const filtered = useMemo(() => {
    let list = profiles || [];
    if (genderFilter !== "all") list = list.filter((p) => p.gender === genderFilter);
    if (weightFilter !== "all") list = list.filter((p) => p.weight_category === weightFilter);
    if (ageFilter !== "all") list = list.filter((p) => p.age_category === ageFilter);
    if (handFilter !== "all") list = list.filter((p) => p.handedness === handFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        `${p.last_name} ${p.first_name || ""} ${p.club_origin || ""} ${p.country || ""}`
          .toLowerCase()
          .includes(q),
      );
    }
    return list;
  }, [profiles, search, genderFilter, weightFilter, ageFilter, handFilter]);

  if (!clubId) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">Chargement…</p>
    );
  }

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
                <h2 className="text-lg font-bold text-white tracking-tight">Liste adversaires</h2>
                <p className="text-xs text-white/85">
                  Banque commune du club — {profiles?.length || 0} adversaire
                  {(profiles?.length || 0) > 1 ? "s" : ""}
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
              Ajouter
            </Button>
          </div>
        </div>
        <CardContent className="p-4 space-y-3">
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
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {JUDO_WEIGHT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ageFilter} onValueChange={setAgeFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous âges</SelectItem>
                {["Benjamin","Minime","Cadet","Junior","Senior","Vétéran"].map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={handFilter} onValueChange={setHandFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Latéralité</SelectItem>
                <SelectItem value="right">Droitier</SelectItem>
                <SelectItem value="left">Gaucher</SelectItem>
                <SelectItem value="ambidextrous">Ambidextre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Chargement…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 rounded-xl bg-muted/30 border border-dashed">
              <p className="text-sm text-muted-foreground">
                {profiles?.length
                  ? "Aucun adversaire ne correspond aux filtres."
                  : "Aucun adversaire dans la banque du club pour le moment."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 w-12"></th>
                    <th className="text-left px-3 py-2">Nom</th>
                    <th className="text-left px-3 py-2">Sexe</th>
                    <th className="text-left px-3 py-2">Catégorie</th>
                    <th className="text-left px-3 py-2">Âge</th>
                    <th className="text-left px-3 py-2">Latéralité</th>
                    <th className="text-left px-3 py-2">Profil</th>
                    <th className="text-left px-3 py-2">Club / Pays</th>
                    <th className="text-right px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2">
                        {p.photo_url ? (
                          <img
                            src={p.photo_url}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover ring-1 ring-border"
                          />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-semibold">
                            {(p.last_name?.[0] || "?").toUpperCase()}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {p.last_name} {p.first_name || ""}
                        {p.birth_year ? (
                          <span className="text-xs text-muted-foreground ml-1">({p.birth_year})</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{genderLabel(p.gender)}</td>
                      <td className="px-3 py-2">
                        {p.weight_category ? (
                          <Badge variant="secondary">{p.weight_category.replace(/^judo_/, "")}</Badge>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{p.age_category || "—"}</td>
                      <td className="px-3 py-2">{handLabel(p.handedness)}</td>
                      <td className="px-3 py-2">
                        {p.fighting_style ? (
                          <Badge variant={styleVariant(p.fighting_style) as any}>
                            {styleLabel(p.fighting_style)}
                          </Badge>
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
                            title="Ouvrir la fiche scouting"
                            onClick={() => {
                              setScoutingId(p.id);
                              setScoutingOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setToDelete(p)}
                          >
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

      <OpponentProfileDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clubId={clubId}
        categoryId={categoryId}
        initial={editing}
        lockedGender={editing ? null : playerGender}
        lockedWeight={editing ? null : playerWeight}
      />

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
              L'adversaire sera retiré de la banque du club pour tout le monde.
              Les combats déjà enregistrés conservent le nom mais perdront le lien.
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
