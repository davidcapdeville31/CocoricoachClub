import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  CircleDot,
  Image as ImageIcon,
  Loader2,
  Upload,
} from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BOWLING_BALL_BRANDS,
  COVER_TYPES,
  CORE_TYPES,
  getCoverTypeLabel,
  getCoreTypeLabel,
} from "@/lib/constants/bowlingBallBrands";

interface BallForm {
  brand: string;
  model: string;
  cover_type: string;
  core_type: string;
  rg: string;
  differential: string;
  intermediate_diff: string;
  factory_surface: string;
}

const EMPTY_FORM: BallForm = {
  brand: "",
  model: "",
  cover_type: "reactive",
  core_type: "symmetric",
  rg: "",
  differential: "",
  intermediate_diff: "",
  factory_surface: "",
};

export function SuperAdminArsenalBank() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingBall, setEditingBall] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<BallForm>(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: balls, isLoading } = useQuery({
    queryKey: ["super_admin_arsenal_bank"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bowling_ball_catalog" as any)
        .select("*")
        .eq("is_system", true)
        .order("brand")
        .order("model");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setImageFile(null);
    setEditingBall(null);
    setCreateOpen(true);
  };

  const openEdit = (ball: any) => {
    setEditingBall(ball);
    setForm({
      brand: ball.brand || "",
      model: ball.model || "",
      cover_type: ball.cover_type || "reactive",
      core_type: ball.core_type || "symmetric",
      rg: ball.rg?.toString() || "",
      differential: ball.differential?.toString() || "",
      intermediate_diff: ball.intermediate_diff?.toString() || "",
      factory_surface: ball.factory_surface || "",
    });
    setImageFile(null);
    setCreateOpen(true);
  };

  const uploadImage = async (ballId: string, file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `balls/${ballId}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("bowling-ball-images")
      .upload(filePath, file, { upsert: true });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage
      .from("bowling-ball-images")
      .getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.brand || !form.model) throw new Error("Marque et modèle requis");
      const payload: any = {
        brand: form.brand,
        model: form.model,
        cover_type: form.cover_type || "reactive",
        core_type: form.core_type || "symmetric",
        rg: form.rg ? parseFloat(form.rg) : null,
        differential: form.differential ? parseFloat(form.differential) : null,
        intermediate_diff: form.intermediate_diff
          ? parseFloat(form.intermediate_diff)
          : null,
        factory_surface: form.factory_surface || null,
        is_system: true,
      };

      let ballId: string;
      if (editingBall) {
        const { error } = await supabase
          .from("bowling_ball_catalog" as any)
          .update(payload)
          .eq("id", editingBall.id);
        if (error) throw error;
        ballId = editingBall.id;
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from("bowling_ball_catalog" as any)
          .insert({ ...payload, created_by: user?.id })
          .select()
          .single();
        if (error) throw error;
        ballId = (data as any).id;
      }

      if (imageFile) {
        const publicUrl = await uploadImage(ballId, imageFile);
        await supabase
          .from("bowling_ball_catalog" as any)
          .update({ image_url: publicUrl } as any)
          .eq("id", ballId);
      }
    },
    onSuccess: () => {
      toast.success(editingBall ? "Boule mise à jour" : "Boule ajoutée à la banque");
      qc.invalidateQueries({ queryKey: ["super_admin_arsenal_bank"] });
      qc.invalidateQueries({ queryKey: ["bowling_ball_catalog_full"] });
      setCreateOpen(false);
      setEditingBall(null);
      setForm(EMPTY_FORM);
      setImageFile(null);
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("bowling_ball_catalog" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Boule supprimée de la banque");
      qc.invalidateQueries({ queryKey: ["super_admin_arsenal_bank"] });
      qc.invalidateQueries({ queryKey: ["bowling_ball_catalog_full"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(
    () =>
      (balls || []).filter(
        (b: any) =>
          !search ||
          b.brand.toLowerCase().includes(search.toLowerCase()) ||
          b.model.toLowerCase().includes(search.toLowerCase()),
      ),
    [balls, search],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CircleDot className="h-5 w-5 text-primary" />
                Banque Arsenal système
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Boules de bowling partagées avec tous les clients qui activent
                la discipline « Bowling ». Les boules ajoutées par un client
                dans son propre Arsenal restent privées à son club.
              </p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Nouvelle boule système
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une boule..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <span className="text-xs text-muted-foreground ml-auto">
              {filtered.length} boule{filtered.length > 1 ? "s" : ""}
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search ? "Aucune boule trouvée" : "Aucune boule système"}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((b: any) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => openEdit(b)}
                  className="group text-left rounded-2xl border bg-card hover:border-primary hover:shadow-md transition-all p-3 flex gap-3"
                >
                  {b.image_url ? (
                    <img
                      src={b.image_url}
                      alt=""
                      className="h-16 w-16 rounded-xl object-cover border shrink-0"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-muted border flex items-center justify-center shrink-0">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">
                          {b.brand} {b.model}
                        </div>
                      </div>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">
                        {getCoverTypeLabel(b.cover_type)}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {getCoreTypeLabel(b.core_type)}
                      </Badge>
                      {b.rg && (
                        <Badge variant="outline" className="text-[10px]">
                          RG {b.rg}
                        </Badge>
                      )}
                      {b.differential && (
                        <Badge variant="outline" className="text-[10px]">
                          Diff {b.differential}
                        </Badge>
                      )}
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(b.id);
                      }}
                      className="inline-flex items-center gap-1 mt-2 text-[11px] text-destructive hover:underline"
                    >
                      <Trash2 className="h-3 w-3" /> Supprimer
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / edit dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBall ? "Modifier la boule système" : "Nouvelle boule système"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Marque *</Label>
                <Select
                  value={form.brand}
                  onValueChange={(v) => setForm((f) => ({ ...f, brand: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir..." />
                  </SelectTrigger>
                  <SelectContent>
                    {[...BOWLING_BALL_BRANDS].sort((a, b) => a.localeCompare(b)).map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Modèle *</Label>
                <Input
                  value={form.model}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, model: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Couverture</Label>
                <Select
                  value={form.cover_type}
                  onValueChange={(v) => setForm((f) => ({ ...f, cover_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COVER_TYPES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Noyau</Label>
                <Select
                  value={form.core_type}
                  onValueChange={(v) => setForm((f) => ({ ...f, core_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CORE_TYPES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>RG</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={form.rg}
                  onChange={(e) => setForm((f) => ({ ...f, rg: e.target.value }))}
                />
              </div>
              <div>
                <Label>Différentiel</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={form.differential}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, differential: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Diff. intermédiaire (Mass Bias)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={form.intermediate_diff}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, intermediate_diff: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Surface actuelle</Label>
                <Input
                  value={form.factory_surface}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, factory_surface: e.target.value }))
                  }
                  placeholder="ex: 3000 grit"
                />
              </div>
            </div>

            <div>
              <Label>Photo de la boule</Label>
              <div className="flex items-center gap-2 mt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {imageFile ? "Changer la photo" : "Choisir une photo"}
                </Button>
                {imageFile && (
                  <span className="text-xs text-muted-foreground truncate">
                    {imageFile.name}
                  </span>
                )}
                {!imageFile && editingBall?.image_url && (
                  <img
                    src={editingBall.image_url}
                    alt=""
                    className="h-10 w-10 rounded border object-cover"
                  />
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && file.size > 5 * 1024 * 1024) {
                      toast.error("Fichier trop volumineux (max 5 Mo)");
                      return;
                    }
                    setImageFile(file || null);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingBall ? "Enregistrer" : "Ajouter à la banque"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette boule système ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous les clients ne verront plus cette boule dans leur catalogue
              Arsenal. Les boules déjà attribuées aux athlètes restent
              inchangées. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && del.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
