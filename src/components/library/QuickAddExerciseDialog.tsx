import { useState, useEffect } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DIFFICULTY_LEVELS,
  getSubcategoriesForCategory,
  getCategoriesForSport,
} from "@/lib/constants/exerciseCategories";
import { z } from "zod";

interface QuickAddExerciseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  initialCategory?: string;
  sportType?: string;
  onSuccess?: (exercise: { id: string; name: string; category: string }) => void;
}

const exerciseSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(200, "Nom trop long"),
  category: z.string().trim().min(1, "La catégorie est requise"),
  youtubeUrl: z
    .string()
    .trim()
    .max(500, "URL trop longue")
    .url("URL invalide")
    .optional()
    .or(z.literal("")),
  description: z.string().trim().max(2000, "Description trop longue").optional().or(z.literal("")),
});

const DATABASE_DIFFICULTY_LABELS: Record<string, "débutant" | "intermédiaire" | "avancé"> = {
  beginner: "débutant",
  intermediate: "intermédiaire",
  advanced: "avancé",
  débutant: "débutant",
  intermédiaire: "intermédiaire",
  avancé: "avancé",
};

export function QuickAddExerciseDialog({
  open,
  onOpenChange,
  initialName = "",
  initialCategory = "upper_push",
  sportType,
  onSuccess,
}: QuickAddExerciseDialogProps) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState(initialCategory);
  const [subcategory, setSubcategory] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("intermediate");
  const queryClient = useQueryClient();

  const availableSubcategories = getSubcategoriesForCategory(category);
  const availableCategories = getCategoriesForSport(sportType);

  useEffect(() => {
    if (initialName) setName(initialName);
  }, [initialName]);

  useEffect(() => {
    if (!open) {
      // reset after close
      setName(initialName || "");
      setSubcategory("");
      setYoutubeUrl("");
      setDescription("");
    }
  }, [open, initialName]);

  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);
    setSubcategory("");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      console.info("[QuickAddExerciseDialog] mutation déclenchée");
      const parsed = exerciseSchema.safeParse({ name, category, youtubeUrl, description });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || "Formulaire invalide");
      }

      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(authError.message);
      const user = auth?.user;
      if (!user) throw new Error("Vous devez être connecté pour créer un exercice");
      const databaseDifficulty = DATABASE_DIFFICULTY_LABELS[difficulty] ?? "intermédiaire";

      const payload = {
        user_id: user.id,
        coach_id: user.id,
        name: parsed.data.name,
        exercise_name: parsed.data.name,
        category: parsed.data.category,
        station_name: parsed.data.category,
        subcategory: subcategory || null,
        youtube_url: parsed.data.youtubeUrl || null,
        video_url: parsed.data.youtubeUrl || null,
        description: parsed.data.description || null,
        difficulty: databaseDifficulty,
        difficulty_level: databaseDifficulty,
        is_system: false,
        is_default: false,
      };

      console.info("[QuickAddExerciseDialog] insertion exercice", {
        hasCoachId: Boolean(payload.coach_id),
        is_default: payload.is_default,
        difficulty_level: payload.difficulty_level,
      });

      const { data, error } = await supabase
        .from("exercise_library")
        .insert(payload)
        .select("id, name, category")
        .single();

      if (error) {
        console.error("[QuickAddExerciseDialog] insert error", error);
        throw new Error(error.message || "Erreur lors de la création");
      }
      return data;
    },
    onSuccess: (data) => {
      toast.success("Exercice créé avec succès");
      queryClient.invalidateQueries({ queryKey: ["exercise-library"] });
      queryClient.invalidateQueries({ queryKey: ["v2-bank-sidebar-exercises"] });
      queryClient.invalidateQueries({ queryKey: ["exercise-library-picker"] });
      queryClient.invalidateQueries({ queryKey: ["merged-exercises"] });
      if (onSuccess && data) {
        onSuccess({ id: data.id, name: data.name, category: data.category });
      }
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Impossible de créer l'exercice");
    },
  });

  const handleSubmit = () => {
    console.info("[QuickAddExerciseDialog] clic Ajouter capturé");
    if (createMutation.isPending) {
      toast("Création de l'exercice en cours...");
      return;
    }
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un exercice à la bibliothèque</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom de l'exercice *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Squat"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Catégorie *</Label>
              <Select value={category} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {availableSubcategories.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="subcategory">Sous-catégorie</Label>
                <Select value={subcategory} onValueChange={setSubcategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optionnel" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubcategories.map((sub) => (
                      <SelectItem key={sub.value} value={sub.value}>
                        {sub.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulté</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="youtube">Lien YouTube (optionnel)</Label>
            <Input
              id="youtube"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              type="url"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optionnel)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description de l'exercice..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="button" onClick={handleSubmit} aria-busy={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {createMutation.isPending ? "Ajout en cours..." : "Ajouter"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
