// Selector for program themes (shared at club level).
// Includes a "+ New theme" inline creator.

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COLOR_OPTIONS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#06b6d4", "#3b82f6", "#6366f1",
  "#8b5cf6", "#ec4899", "#f43f5e", "#64748b",
];

export interface ProgramTheme {
  id: string;
  name: string;
  color: string;
  display_order: number;
  is_system: boolean;
}

interface ProgramThemeSelectorProps {
  categoryId: string;
  value?: string | null;
  onChange: (themeId: string | null) => void;
  className?: string;
}

export function ProgramThemeSelector({
  categoryId,
  value,
  onChange,
  className,
}: ProgramThemeSelectorProps) {
  const qc = useQueryClient();
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLOR_OPTIONS[0]);

  const { data: clubData } = useQuery({
    queryKey: ["category-club", categoryId],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("club_id")
        .eq("id", categoryId)
        .single();
      return data;
    },
    enabled: !!categoryId,
  });

  const clubId = clubData?.club_id;

  const { data: themes } = useQuery({
    queryKey: ["program-themes", clubId],
    queryFn: async (): Promise<ProgramTheme[]> => {
      const { data, error } = await supabase
        .from("program_themes")
        .select("id, name, color, display_order, is_system")
        .eq("club_id", clubId!)
        .order("display_order")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clubId,
  });

  const createTheme = useMutation({
    mutationFn: async () => {
      if (!clubId) throw new Error("Club introuvable");
      const trimmed = newName.trim();
      if (!trimmed) throw new Error("Donne un nom à la thématique");
      const maxOrder = Math.max(0, ...(themes ?? []).map((t) => t.display_order));
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("program_themes")
        .insert({
          club_id: clubId,
          name: trimmed,
          color: newColor,
          display_order: maxOrder + 10,
          is_system: false,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      toast.success("Thématique créée ✅");
      qc.invalidateQueries({ queryKey: ["program-themes", clubId] });
      setCreatorOpen(false);
      setNewName("");
      setNewColor(COLOR_OPTIONS[0]);
      onChange(id);
    },
    onError: (err: any) => toast.error(err?.message ?? "Erreur création thématique"),
  });

  const deleteTheme = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("program_themes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thématique supprimée");
      qc.invalidateQueries({ queryKey: ["program-themes", clubId] });
      qc.invalidateQueries({ queryKey: ["training-programs"] });
      if (value) onChange(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Suppression impossible"),
  });

  const selected = useMemo(
    () => (themes ?? []).find((t) => t.id === value) ?? null,
    [themes, value],
  );

  return (
    <>
      <div className={cn("flex items-center gap-2", className)}>
        <Select
          value={value ?? "__none__"}
          onValueChange={(v) => onChange(v === "__none__" ? null : v)}
        >
          <SelectTrigger className="rounded-2xl bg-muted/40 border-border/60 h-9">
            <SelectValue placeholder="Choisir une thématique…">
              {selected && (
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: selected.color }}
                  />
                  {selected.name}
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[320px]">
            <SelectItem value="__none__">
              <span className="text-muted-foreground">Sans thématique</span>
            </SelectItem>
            {(themes ?? []).map((t) => (
              <SelectItem key={t.id} value={t.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  {t.name}
                  {!t.is_system && (
                    <span className="text-[10px] text-muted-foreground">(perso)</span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 rounded-2xl h-9 w-9"
          onClick={() => setCreatorOpen(true)}
          title="Créer une nouvelle thématique"
        >
          <Plus className="h-4 w-4" />
        </Button>
        {selected && !selected.is_system && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-2xl h-9 w-9 text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm(`Supprimer la thématique « ${selected.name} » ?`)) {
                deleteTheme.mutate(selected.id);
              }
            }}
            title="Supprimer cette thématique"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Dialog open={creatorOpen} onOpenChange={setCreatorOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nouvelle thématique</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="theme-name" className="text-xs">Nom *</Label>
              <Input
                id="theme-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex : Préparation hivernale"
                className="rounded-2xl bg-muted/40 border-border/60"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Couleur</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-all",
                      newColor === c
                        ? "border-foreground scale-110 shadow-md"
                        : "border-transparent hover:scale-105",
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={`Couleur ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreatorOpen(false)}
              className="rounded-2xl"
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={() => createTheme.mutate()}
              disabled={createTheme.isPending}
              className="rounded-2xl gap-2"
            >
              {createTheme.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
