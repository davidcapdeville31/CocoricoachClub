import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JUDO_WEIGHT_CATEGORIES } from "@/lib/constants/sportTypes";
import { toast } from "sonner";

export interface OpponentProfile {
  id?: string;
  club_id: string;
  category_id?: string | null;
  last_name: string;
  first_name?: string | null;
  gender?: "male" | "female" | "other" | null;
  weight_category?: string | null;
  handedness?: "left" | "right" | "ambidextrous" | "unknown" | null;
  fighting_style?: "offensive" | "defensive" | "balanced" | null;
  club_origin?: string | null;
  country?: string | null;
  birth_year?: number | null;
  notes?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubId: string;
  categoryId?: string;
  initial?: OpponentProfile | null;
}

const empty = (clubId: string, categoryId?: string): OpponentProfile => ({
  club_id: clubId,
  category_id: categoryId ?? null,
  last_name: "",
  first_name: "",
  gender: null,
  weight_category: null,
  handedness: "unknown",
  fighting_style: null,
  club_origin: "",
  country: "",
  birth_year: null,
  notes: "",
});

export function OpponentProfileDialog({ open, onOpenChange, clubId, categoryId, initial }: Props) {
  const [form, setForm] = useState<OpponentProfile>(empty(clubId, categoryId));
  const qc = useQueryClient();

  useEffect(() => {
    if (open) setForm(initial ? { ...initial } : empty(clubId, categoryId));
  }, [open, initial, clubId, categoryId]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.last_name.trim()) throw new Error("Le nom est obligatoire");
      const payload = {
        club_id: clubId,
        category_id: categoryId ?? null,
        last_name: form.last_name.trim(),
        first_name: form.first_name?.trim() || null,
        gender: form.gender || null,
        weight_category: form.weight_category || null,
        handedness: form.handedness || "unknown",
        fighting_style: form.fighting_style || null,
        club_origin: form.club_origin?.trim() || null,
        country: form.country?.trim() || null,
        birth_year: form.birth_year || null,
        notes: form.notes?.trim() || null,
      };
      if (form.id) {
        const { error } = await supabase.from("opponent_profiles").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("opponent_profiles").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Profil mis à jour" : "Profil ajouté");
      qc.invalidateQueries({ queryKey: ["opponent-profiles", clubId] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erreur lors de l'enregistrement"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Modifier l'adversaire" : "Ajouter un adversaire"}</DialogTitle>
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
              value={form.first_name || ""}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              placeholder="Jean"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sexe</Label>
            <Select
              value={form.gender || ""}
              onValueChange={(v) => setForm({ ...form, gender: (v || null) as any })}
            >
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Homme</SelectItem>
                <SelectItem value="female">Femme</SelectItem>
                <SelectItem value="other">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Catégorie de poids</Label>
            <Select
              value={form.weight_category || ""}
              onValueChange={(v) => setForm({ ...form, weight_category: v || null })}
            >
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {JUDO_WEIGHT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Latéralité</Label>
            <Select
              value={form.handedness || "unknown"}
              onValueChange={(v) => setForm({ ...form, handedness: v as any })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
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
              value={form.fighting_style || ""}
              onValueChange={(v) => setForm({ ...form, fighting_style: (v || null) as any })}
            >
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
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
              value={form.birth_year ?? ""}
              onChange={(e) =>
                setForm({ ...form, birth_year: e.target.value ? parseInt(e.target.value, 10) : null })
              }
              placeholder="2002"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Club d'origine</Label>
            <Input
              value={form.club_origin || ""}
              onChange={(e) => setForm({ ...form, club_origin: e.target.value })}
              placeholder="JC Paris"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Pays</Label>
            <Input
              value={form.country || ""}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              placeholder="France"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Notes (style de combat, prises favorites…)</Label>
            <Textarea
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Observations tactiques, points forts, faiblesses…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
