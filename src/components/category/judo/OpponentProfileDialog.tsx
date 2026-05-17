import { useEffect, useRef, useState } from "react";
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
import {
  JUDO_WEIGHT_CATEGORIES,
  JUDO_WEIGHT_CATEGORIES_MEN,
  JUDO_WEIGHT_CATEGORIES_WOMEN,
} from "@/lib/constants/sportTypes";
import { toast } from "sonner";
import { Camera, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
  favorite_attacks?: string | null;
  club_origin?: string | null;
  country?: string | null;
  birth_year?: number | null;
  notes?: string | null;
  combat_profile?: number | null;
  style_mask?: number | null;
  ground_standing_pref?: number | null;
  photo_url?: string | null;
  palmares?: string | null;
  age_category?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubId: string;
  categoryId?: string;
  initial?: OpponentProfile | null;
  /** Verrouille le sexe / la catégorie de poids (utilisé côté athlète) */
  lockedGender?: "male" | "female" | null;
  lockedWeight?: string | null;
}

const empty = (
  clubId: string,
  categoryId?: string,
  gender?: "male" | "female" | null,
  weight?: string | null,
): OpponentProfile => ({
  club_id: clubId,
  category_id: categoryId ?? null,
  last_name: "",
  first_name: "",
  gender: gender ?? null,
  weight_category: weight ?? null,
  handedness: "unknown",
  fighting_style: null,
  favorite_attacks: "",
  club_origin: "",
  country: "",
  birth_year: null,
  notes: "",
  combat_profile: null,
  style_mask: 0,
  ground_standing_pref: 50,
  photo_url: null,
  palmares: "",
  age_category: null,
});

const COMBAT_PROFILES = [
  { v: 1, label: "Dominant" },
  { v: 2, label: "Équilibré" },
  { v: 3, label: "Dominé" },
  { v: 4, label: "Contrôle sans score" },
  { v: 5, label: "Explosif" },
  { v: 6, label: "Défensif" },
];

const STYLES = [
  { bit: 1, label: "Attaquant" },
  { bit: 2, label: "Contreur" },
  { bit: 4, label: "Physique" },
  { bit: 8, label: "Technique" },
  { bit: 16, label: "Kumikata dominant" },
  { bit: 32, label: "Passif" },
];

const AGE_CATEGORIES = [
  "Benjamin", "Minime", "Cadet", "Junior", "Senior", "Vétéran",
];

const DOM_PRESETS = [
  { label: "100% sol", v: 0 },
  { label: "Sol dominant", v: 25 },
  { label: "Équilibré", v: 50 },
  { label: "Debout dominant", v: 75 },
  { label: "100% debout", v: 100 },
];

export function OpponentProfileDialog({
  open,
  onOpenChange,
  clubId,
  categoryId,
  initial,
  lockedGender,
  lockedWeight,
}: Props) {
  const [form, setForm] = useState<OpponentProfile>(
    empty(clubId, categoryId, lockedGender, lockedWeight),
  );
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? { ...empty(clubId, categoryId, lockedGender, lockedWeight), ...initial }
          : empty(clubId, categoryId, lockedGender, lockedWeight),
      );
    }
  }, [open, initial, clubId, categoryId, lockedGender, lockedWeight]);

  const handlePhotoUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo trop lourde (max 5 Mo)");
      return;
    }
    try {
      setUploading(true);
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${clubId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("opponent-photos")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("opponent-photos").getPublicUrl(path);
      setForm((f) => ({ ...f, photo_url: pub.publicUrl }));
      toast.success("Photo téléchargée");
    } catch (e: any) {
      toast.error(e?.message || "Erreur upload");
    } finally {
      setUploading(false);
    }
  };

  const toggleStyle = (bit: number) => {
    const cur = form.style_mask ?? 0;
    setForm({ ...form, style_mask: (cur & bit) ? cur & ~bit : cur | bit });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.last_name.trim()) throw new Error("Le nom est obligatoire");
      const payload: any = {
        club_id: clubId,
        category_id: categoryId ?? null,
        last_name: form.last_name.trim(),
        first_name: form.first_name?.trim() || null,
        gender: (lockedGender ?? form.gender) || null,
        weight_category: (lockedWeight ?? form.weight_category) || null,
        handedness: form.handedness || "unknown",
        fighting_style: form.fighting_style || null,
        favorite_attacks: form.favorite_attacks?.trim() || null,
        club_origin: form.club_origin?.trim() || null,
        country: form.country?.trim() || null,
        birth_year: form.birth_year || null,
        notes: form.notes?.trim() || null,
        combat_profile: form.combat_profile ?? null,
        style_mask: form.style_mask ?? 0,
        ground_standing_pref:
          form.ground_standing_pref === null || form.ground_standing_pref === undefined
            ? null
            : form.ground_standing_pref,
        photo_url: form.photo_url || null,
        palmares: form.palmares?.trim() || null,
        age_category: form.age_category || null,
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
      qc.invalidateQueries({ queryKey: ["athlete-opp-profiles", clubId] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erreur lors de l'enregistrement"),
  });

  const styleMask = form.style_mask ?? 0;
  const dominance = form.ground_standing_pref ?? 50;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Modifier l'adversaire" : "Ajouter un adversaire"}</DialogTitle>
        </DialogHeader>

        {/* ============ Photo ============ */}
        <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/40 border">
          <div className="relative h-20 w-20 rounded-full overflow-hidden bg-muted flex items-center justify-center ring-2 ring-border">
            {form.photo_url ? (
              <img src={form.photo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <Camera className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Photo (optionnelle)</Label>
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-3.5 w-3.5 mr-1" />
                {uploading ? "Envoi…" : form.photo_url ? "Changer" : "Ajouter"}
              </Button>
              {form.photo_url && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setForm({ ...form, photo_url: null })}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ============ Identité ============ */}
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

          {!lockedGender && (
            <div className="space-y-1.5">
              <Label>Sexe</Label>
              <Select
                value={form.gender || ""}
                onValueChange={(v) => {
                  const g = (v || null) as any;
                  const allowed = g === "male" ? JUDO_WEIGHT_CATEGORIES_MEN : g === "female" ? JUDO_WEIGHT_CATEGORIES_WOMEN : null;
                  const keepWeight = !allowed || !form.weight_category || allowed.some((c) => c.value === form.weight_category);
                  setForm({ ...form, gender: g, weight_category: keepWeight ? form.weight_category : null });
                }}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Homme</SelectItem>
                  <SelectItem value="female">Femme</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {!lockedWeight && (
            <div className="space-y-1.5">
              <Label>Catégorie de poids</Label>
              <Select
                value={form.weight_category || ""}
                onValueChange={(v) => setForm({ ...form, weight_category: v || null })}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(form.gender === "male"
                    ? JUDO_WEIGHT_CATEGORIES_MEN
                    : form.gender === "female"
                    ? JUDO_WEIGHT_CATEGORIES_WOMEN
                    : JUDO_WEIGHT_CATEGORIES
                  ).map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Catégorie d'âge</Label>
            <Select
              value={form.age_category || ""}
              onValueChange={(v) => setForm({ ...form, age_category: v || null })}
            >
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {AGE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
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
        </div>

        {/* ============ Profil de combat ============ */}
        <div className="space-y-2 pt-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Profil du combattant
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {COMBAT_PROFILES.map((opt) => (
              <Button
                key={opt.v}
                type="button"
                size="sm"
                variant={form.combat_profile === opt.v ? "default" : "outline"}
                className={cn(
                  "h-7 text-[11px]",
                  form.combat_profile === opt.v && "bg-violet-600 hover:bg-violet-700",
                )}
                onClick={() =>
                  setForm({
                    ...form,
                    combat_profile: form.combat_profile === opt.v ? null : opt.v,
                  })
                }
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* ============ Style adversaire (multi) ============ */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Style adversaire (multi-sélection)
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {STYLES.map((s) => {
              const active = (styleMask & s.bit) === s.bit;
              return (
                <Button
                  key={s.bit}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className={cn(
                    "h-7 text-[11px]",
                    active && "bg-violet-600 hover:bg-violet-700",
                  )}
                  onClick={() => toggleStyle(s.bit)}
                >
                  {s.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* ============ Préférence Ne-waza / Tachi-waza ============ */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span>🤼 Ne-waza (sol)</span>
            <span className="text-muted-foreground">
              {dominance}% debout / {100 - dominance}% sol
            </span>
            <span>🥋 Tachi-waza (debout)</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={dominance}
            onChange={(e) =>
              setForm({ ...form, ground_standing_pref: parseInt(e.target.value, 10) })
            }
            className="w-full accent-violet-500"
          />
          <div className="flex flex-wrap gap-1">
            {DOM_PRESETS.map((opt) => (
              <Button
                key={opt.v}
                type="button"
                size="sm"
                variant={dominance === opt.v ? "default" : "outline"}
                className={cn(
                  "h-7 text-[10px]",
                  dominance === opt.v && "bg-violet-600 hover:bg-violet-700",
                )}
                onClick={() => setForm({ ...form, ground_standing_pref: opt.v })}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* ============ Notes texte ============ */}
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Attaques favorites</Label>
            <Textarea
              value={form.favorite_attacks || ""}
              onChange={(e) => setForm({ ...form, favorite_attacks: e.target.value })}
              rows={2}
              placeholder="Ex : Uchi-mata, Seoi-nage, Ko-uchi-gari…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Palmarès</Label>
            <Textarea
              value={form.palmares || ""}
              onChange={(e) => setForm({ ...form, palmares: e.target.value })}
              rows={3}
              placeholder="Champion régional 2023, 3e France Junior 2024…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
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
