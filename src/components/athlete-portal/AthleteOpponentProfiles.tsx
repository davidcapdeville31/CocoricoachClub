import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Users, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  JUDO_WEIGHT_CATEGORIES_MEN,
  JUDO_WEIGHT_CATEGORIES_WOMEN,
} from "@/lib/constants/sportTypes";
import { toast } from "sonner";

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
const weightLabel = (w?: string | null) => (w ? w.replace(/^judo_/, "") : "—");

interface FormState {
  last_name: string;
  first_name: string;
  handedness: "left" | "right" | "ambidextrous" | "unknown";
  fighting_style: "" | "offensive" | "defensive" | "balanced";
  favorite_attacks: string;
  club_origin: string;
  country: string;
  birth_year: string;
  notes: string;
}

const emptyForm: FormState = {
  last_name: "",
  first_name: "",
  handedness: "unknown",
  fighting_style: "",
  favorite_attacks: "",
  club_origin: "",
  country: "",
  birth_year: "",
  notes: "",
};

export function AthleteOpponentProfiles({ playerId, categoryId }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  // Player + category info (gender, weight, club)
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
  const playerGender: "male" | "female" | null =
    player?.gender === "male" || player?.gender === "female" ? player.gender : null;
  const playerWeight: string | null = player?.discipline || null;

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["athlete-opp-profiles", clubId, playerGender, playerWeight],
    enabled: !!clubId,
    queryFn: async () => {
      let q = supabase
        .from("opponent_profiles")
        .select("*")
        .eq("club_id", clubId!)
        .order("last_name", { ascending: true });
      if (playerGender) q = q.eq("gender", playerGender);
      if (playerWeight) q = q.eq("weight_category", playerWeight);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  // Realtime: refresh list when any opponent is added/edited in this club
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

  const filtered = useMemo(() => {
    if (!profiles) return [];
    if (!search) return profiles;
    const q = search.toLowerCase();
    return profiles.filter((p) =>
      `${p.last_name} ${p.first_name || ""} ${p.club_origin || ""} ${p.country || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [profiles, search]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.last_name.trim()) throw new Error("Le nom est obligatoire");
      if (!clubId) throw new Error("Club introuvable");
      if (!playerGender || !playerWeight) {
        throw new Error("Ta catégorie (sexe + poids) doit être renseignée par ton coach avant d'ajouter un adversaire");
      }

      const { data: existing } = await supabase
        .from("opponent_profiles")
        .select("id, last_name, first_name")
        .eq("club_id", clubId)
        .eq("gender", playerGender)
        .eq("weight_category", playerWeight)
        .ilike("last_name", form.last_name.trim());

      if (existing && existing.length) {
        const dup = existing.find(
          (e) => (e.first_name || "").toLowerCase().trim() === form.first_name.toLowerCase().trim()
        );
        if (dup) throw new Error("Un adversaire avec ce nom existe déjà dans ta catégorie");
      }

      const payload = {
        club_id: clubId,
        category_id: categoryId,
        last_name: form.last_name.trim(),
        first_name: form.first_name.trim() || null,
        gender: playerGender,
        weight_category: playerWeight,
        handedness: form.handedness,
        fighting_style: form.fighting_style || null,
        favorite_attacks: form.favorite_attacks.trim() || null,
        club_origin: form.club_origin.trim() || null,
        country: form.country.trim() || null,
        birth_year: form.birth_year ? parseInt(form.birth_year, 10) : null,
        notes: form.notes.trim() || null,
      };
      const { error } = await supabase.from("opponent_profiles").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Adversaire ajouté à la liste du club");
      qc.invalidateQueries({ queryKey: ["athlete-opp-profiles", clubId] });
      qc.invalidateQueries({ queryKey: ["opponent-profiles", clubId] });
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e?.message || "Erreur lors de l'ajout"),
  });

  const allowedWeights =
    playerGender === "female" ? JUDO_WEIGHT_CATEGORIES_WOMEN : JUDO_WEIGHT_CATEGORIES_MEN;
  const myWeightLabel =
    allowedWeights.find((w) => w.value === playerWeight)?.label ||
    weightLabel(playerWeight);

  const canAdd = !!playerGender && !!playerWeight && !!clubId;

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
                <p className="text-xs text-white/85">
                  Ta catégorie : {playerGender === "female" ? "Féminin" : playerGender === "male" ? "Masculin" : "—"} {playerWeight ? myWeightLabel : ""}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-white text-amber-700 hover:bg-amber-50 shadow-lg font-semibold gap-2"
              onClick={() => {
                if (!canAdd) {
                  toast.error("Ta catégorie (sexe + poids) doit être renseignée par ton coach avant d'ajouter un adversaire");
                  return;
                }
                setForm(emptyForm);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </Button>
          </div>
        </div>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
            <Info className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              Tu ne vois que les adversaires de ta catégorie. Toute personne ajoutée sera visible par
              tout le club pour éviter les doublons.
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un nom, un club, un pays…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Chargement…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 rounded-xl bg-muted/30 border border-dashed">
              <p className="text-sm text-muted-foreground">
                {profiles?.length
                  ? "Aucun adversaire ne correspond à la recherche."
                  : "Aucun adversaire enregistré dans ta catégorie pour le moment."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Nom</th>
                    <th className="text-left px-3 py-2">Latéralité</th>
                    <th className="text-left px-3 py-2">Profil</th>
                    <th className="text-left px-3 py-2">Club / Pays</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">
                        {p.last_name} {p.first_name || ""}
                        {p.birth_year ? (
                          <span className="text-xs text-muted-foreground ml-1">({p.birth_year})</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{handLabel(p.handedness)}</td>
                      <td className="px-3 py-2">
                        {p.fighting_style ? (
                          <Badge variant={styleVariant(p.fighting_style) as any}>
                            {styleLabel(p.fighting_style)}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {[p.club_origin, p.country].filter(Boolean).join(" • ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajouter un adversaire</DialogTitle>
            <DialogDescription>
              Catégorie : {playerGender === "female" ? "Féminin" : "Masculin"} {myWeightLabel} —
              visible par tout le club.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nom *</Label>
              <Input
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                placeholder="DUPONT"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Prénom</Label>
              <Input
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                placeholder="Jean"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Latéralité</Label>
              <Select
                value={form.handedness}
                onValueChange={(v) => setForm({ ...form, handedness: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="right">Droitier</SelectItem>
                  <SelectItem value="left">Gaucher</SelectItem>
                  <SelectItem value="ambidextrous">Ambidextre</SelectItem>
                  <SelectItem value="unknown">Inconnue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Profil de combat</Label>
              <Select
                value={form.fighting_style}
                onValueChange={(v) => setForm({ ...form, fighting_style: v as any })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="offensive">Offensif</SelectItem>
                  <SelectItem value="defensive">Défensif</SelectItem>
                  <SelectItem value="balanced">Équilibré</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Année de naissance</Label>
              <Input
                type="number"
                value={form.birth_year}
                onChange={(e) => setForm({ ...form, birth_year: e.target.value })}
                placeholder="2002"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Club d'origine</Label>
              <Input
                value={form.club_origin}
                onChange={(e) => setForm({ ...form, club_origin: e.target.value })}
                placeholder="JC Paris"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Pays</Label>
              <Input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="France"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Attaques favorites</Label>
              <Textarea
                value={form.favorite_attacks}
                onChange={(e) => setForm({ ...form, favorite_attacks: e.target.value })}
                rows={2}
                placeholder="Ex : Uchi-mata, Seoi-nage, Ko-uchi-gari…"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder="Observations tactiques, points forts, faiblesses…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
