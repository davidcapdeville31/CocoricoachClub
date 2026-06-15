import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  Library,
  Search,
  ExternalLink,
  Image as ImageIcon,
  Video,
  Pencil,
  Upload,
  X,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  EXERCISE_CATEGORIES,
  CATEGORY_GROUPS,
  CATEGORY_GROUP_CONFIGS,
  DIFFICULTY_LEVELS,
  getCategoryLabel,
  getCategoriesByGroup,
  getCategoryGroup,
  getSubcategoriesForCategory,
  getSubcategoryLabel,
  EXERCISE_SUBCATEGORIES,
  SPORT_OPTIONS,
  getTerrainCategoriesForSport,
} from "@/lib/constants/exerciseCategories";

// Colored styles per group (aligned with coach library Screen 1)
const getGroupStyles = (group: string | null) => {
  switch (group) {
    case "halterophilie":
      return { border: "border-l-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/30", text: "text-yellow-700 dark:text-yellow-400" };
    case "musculation":
      return { border: "border-l-orange-500", bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400" };
    case "course":
      return { border: "border-l-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400" };
    case "ergo":
      return { border: "border-l-cyan-500", bg: "bg-cyan-50 dark:bg-cyan-950/30", text: "text-cyan-700 dark:text-cyan-400" };
    case "bodyweight":
      return { border: "border-l-purple-500", bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-400" };
    case "crossfit_hyrox":
      return { border: "border-l-red-500", bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400" };
    case "sled":
      return { border: "border-l-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400" };
    case "plyometrie":
      return { border: "border-l-lime-600", bg: "bg-lime-50 dark:bg-lime-950/30", text: "text-lime-700 dark:text-lime-400" };
    case "neuro":
      return { border: "border-l-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950/30", text: "text-indigo-700 dark:text-indigo-400" };
    case "stretching_mobility":
      return { border: "border-l-teal-500", bg: "bg-teal-50 dark:bg-teal-950/30", text: "text-teal-700 dark:text-teal-400" };
    case "reathletisation":
      return { border: "border-l-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400" };
    case "pilates":
      return { border: "border-l-pink-500", bg: "bg-pink-50 dark:bg-pink-950/30", text: "text-pink-700 dark:text-pink-400" };
    case "terrain":
      return { border: "border-l-green-600", bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-400" };
    default:
      return { border: "border-l-muted", bg: "bg-muted/30", text: "text-muted-foreground" };
  }
};
export function SuperAdminExerciseLibrary() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editExercise, setEditExercise] = useState<any>(null);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);

  // Fetch ALL exercises (system + user)
  const { data: exercises, isLoading } = useQuery({
    queryKey: ["super-admin-exercise-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_library")
        .select("*")
        .order("category")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const systemExercises = exercises?.filter((e) => e.is_system) || [];
  const userExercises = exercises?.filter((e) => !e.is_system) || [];

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exercise_library").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-exercise-library"] });
      toast.success("Exercice supprimé");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Map category label/value → group (handles legacy French label categories in DB)
  const LABEL_TO_GROUP: Record<string, string> = {
    "musculation": "musculation",
    "haltérophilie": "halterophilie",
    "halterophilie": "halterophilie",
    "crossfit": "crossfit_hyrox",
    "hyrox": "crossfit_hyrox",
    "poids de corps/calisthenics": "bodyweight",
    "calisthenics": "bodyweight",
    "gainage/core": "musculation",
    "prévention/renforcement": "reathletisation",
    "mobilité/stretching": "stretching_mobility",
    "athlétisme/running drills": "course",
    "vitesse/plyométrie": "plyometrie",
    "réathlétisation": "reathletisation",
    "cardio/endurance": "ergo",
    "respiration": "pilates",
    "tests & évaluations": "neuro",
    "sled push": "sled",
    "sled pull": "sled",
    "farmers carry": "crossfit_hyrox",
    "burpee broad jump": "crossfit_hyrox",
    "row": "ergo",
    "sandbag lunges": "crossfit_hyrox",
    "ski erg": "ergo",
    "wall balls": "crossfit_hyrox",
    "bodyweight_lower": "bodyweight",
  };

  const detectGroup = (category?: string | null): string | null => {
    if (!category) return null;
    // First check slug-based mapping from EXERCISE_CATEGORIES
    const slugGroup = getCategoryGroup(category);
    if (slugGroup) return slugGroup;
    // Then fallback to label-based mapping
    return LABEL_TO_GROUP[category.toLowerCase().trim()] || null;
  };

  const filterExercises = (list: any[], group: string) => {
    let filtered = group === "all" ? list : list.filter((e) => detectGroup(e.category) === group);
    if (activeSubcategory) {
      filtered = filtered.filter((e) => e.subcategory === activeSubcategory);
    }
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter((e) => e.name.toLowerCase().includes(s) || e.category?.toLowerCase().includes(s));
    }
    return filtered;
  };

  const getSubcategoriesForGroup = (list: any[], group: string) => {
    const groupExercises = group === "all" ? list : list.filter((e) => detectGroup(e.category) === group);
    const subcatValues = [...new Set(groupExercises.map((e) => e.subcategory).filter(Boolean))];
    return EXERCISE_SUBCATEGORIES.filter((s) => subcatValues.includes(s.value)).sort((a, b) => a.label.localeCompare(b.label));
  };

  const getYoutubeEmbedUrl = (url: string) => {
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)?.[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  };

  const renderExerciseCard = (exercise: any) => {
    const exerciseGroup = detectGroup(exercise.category);
    const config = exerciseGroup ? CATEGORY_GROUP_CONFIGS[exerciseGroup] : null;
    const Icon = config?.icon || Library;
    const styles = getGroupStyles(exerciseGroup);

    return (
      <Card
        key={exercise.id}
        className={cn(
          "overflow-hidden border-l-4 transition-all hover:shadow-md",
          styles.border
        )}
      >
        {/* Image */}
        {exercise.image_url && (
          <div className="aspect-video bg-muted overflow-hidden flex items-center justify-center">
            <img src={exercise.image_url} alt={exercise.name} className="w-full h-full object-contain" />
          </div>
        )}
        {/* Video embed */}
        {!exercise.image_url && exercise.youtube_url && getYoutubeEmbedUrl(exercise.youtube_url) && (
          <div className="aspect-video">
            <iframe
              src={getYoutubeEmbedUrl(exercise.youtube_url)!}
              className="w-full h-full"
              allowFullScreen
              title={exercise.name}
            />
          </div>
        )}
        <CardHeader className={cn("pb-2", styles.bg)}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Icon className={cn("h-4 w-4", styles.text)} />
              <CardTitle className="text-base">{exercise.name}</CardTitle>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditExercise(exercise)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => deleteMutation.mutate(exercise.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            <Badge
              variant="outline"
              className={cn("border", styles.bg, styles.text, styles.border)}
            >
              {getCategoryLabel(exercise.category)}
            </Badge>
            {exercise.subcategory && (
              <Badge variant="secondary" className="text-xs">
                {getSubcategoryLabel(exercise.subcategory)}
              </Badge>
            )}
            {exercise.is_system && (
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                Système
              </Badge>
            )}
          </div>
        </CardHeader>
        {exercise.description && (
          <CardContent className="pt-2 pb-2">
            <p className="text-sm text-muted-foreground line-clamp-2">{exercise.description}</p>
          </CardContent>
        )}
        {(exercise.youtube_url || exercise.image_url) && (
          <CardContent className="pt-0 pb-3 flex gap-3">
            {exercise.youtube_url && (
              <a
                href={exercise.youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Voir sur YouTube
              </a>
            )}
            {exercise.image_url && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <ImageIcon className="h-3 w-3" /> Photo
              </span>
            )}
          </CardContent>
        )}
      </Card>
    );
  };

  const renderGroupTabs = (exerciseList: any[]) => (
    <Tabs defaultValue="all" onValueChange={() => setActiveSubcategory(null)}>
      <TabsList className="flex flex-wrap h-auto gap-1 mb-4 bg-muted/50 p-2">
        {CATEGORY_GROUPS.map((group) => {
          const c = CATEGORY_GROUP_CONFIGS[group.value];
          const GIcon = c?.icon || Library;
          return (
            <TabsTrigger key={group.value} value={group.value} className="flex items-center gap-1.5 px-3 py-1.5 text-xs">
              <GIcon className={cn("h-3.5 w-3.5", c?.color)} />
              <span className="hidden sm:inline">{group.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
      {CATEGORY_GROUPS.map((group) => {
        const subcats = getSubcategoriesForGroup(exerciseList, group.value);
        return (
          <TabsContent key={group.value} value={group.value}>
            {subcats.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mb-4 p-2 bg-muted/30 rounded-lg">
                <button
                  onClick={() => setActiveSubcategory(null)}
                  className={cn("px-2.5 py-1 rounded-full text-xs font-medium transition-colors", !activeSubcategory ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted hover:bg-muted/80 text-muted-foreground")}
                >
                  <Filter className="h-3 w-3 inline mr-1" />Tous
                </button>
                {subcats.map((sub) => (
                  <button
                    key={sub.value}
                    onClick={() => setActiveSubcategory(activeSubcategory === sub.value ? null : sub.value)}
                    className={cn("px-2.5 py-1 rounded-full text-xs font-medium transition-colors", activeSubcategory === sub.value ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted hover:bg-muted/80 text-muted-foreground")}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}
            {filterExercises(exerciseList, group.value).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {search ? (
                  <>
                    Aucun exercice ne correspond à "<span className="font-semibold">{search}</span>" dans cette catégorie.
                    <button
                      onClick={() => setSearch("")}
                      className="ml-2 text-primary hover:underline"
                    >
                      Effacer la recherche
                    </button>
                  </>
                ) : (
                  "Aucun exercice"
                )}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filterExercises(exerciseList, group.value).map(renderExerciseCard)}
              </div>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Library className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Bibliothèque d'exercices</h2>
          <Badge variant="outline">{systemExercises.length} système</Badge>
          <Badge variant="secondary">{userExercises.length} perso</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 w-64" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button onClick={() => { setEditExercise(null); setAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter (Système)
          </Button>
        </div>
      </div>

      <Tabs defaultValue="system">
        <TabsList>
          <TabsTrigger value="system">Exercices système ({systemExercises.length})</TabsTrigger>
          <TabsTrigger value="user">Exercices utilisateurs ({userExercises.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="system" className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : (
            renderGroupTabs(systemExercises)
          )}
        </TabsContent>
        <TabsContent value="user" className="mt-4">
          {renderGroupTabs(userExercises)}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <ExerciseFormDialog
        open={addOpen || !!editExercise}
        onOpenChange={(open) => { if (!open) { setAddOpen(false); setEditExercise(null); } }}
        exercise={editExercise}
        isSystem={!editExercise || editExercise?.is_system}
        userId={user?.id || ""}
      />
    </div>
  );
}

// Shared form dialog for add/edit
function ExerciseFormDialog({
  open,
  onOpenChange,
  exercise,
  isSystem,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise: any | null;
  isSystem: boolean;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSport, setSelectedSport] = useState("all");

  const resetForm = () => {
    setName("");
    setCategory("");
    setSubcategory("");
    setYoutubeUrl("");
    setDescription("");
    setDifficulty("intermediate");
    setImageUrl("");
    setSelectedSport("all");
  };

  useEffect(() => {
    if (!open) return;

    if (exercise) {
      setName(exercise.name || "");
      setCategory(exercise.category || "");
      setSubcategory(exercise.subcategory || "");
      setYoutubeUrl(exercise.youtube_url || "");
      setDescription(exercise.description || "");
      setDifficulty(exercise.difficulty || "intermediate");
      setImageUrl(exercise.image_url || "");
    } else {
      resetForm();
    }
  }, [open, exercise]);

  const handleImageUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 2 Mo");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("exercise-images").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("exercise-images").getPublicUrl(path);
      setImageUrl(urlData.publicUrl);
      toast.success("Image uploadée");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name || !category) {
      toast.error("Le nom et la catégorie sont requis");
      return;
    }
    if (uploading) {
      toast.error("Attends la fin de l'upload de l'image avant d'enregistrer");
      return;
    }
    setSaving(true);
    try {
      const difficultyLevelFr =
        difficulty === "beginner" || difficulty === "débutant" ? "débutant" :
        difficulty === "advanced" || difficulty === "avancé" ? "avancé" :
        "intermédiaire";
      const ownerId = isSystem ? null : exercise?.user_id || userId;
      const payload = {
        name,
        exercise_name: name,
        category,
        station_name: category,
        subcategory: subcategory || null,
        youtube_url: youtubeUrl || null,
        video_url: youtubeUrl || null,
        description: description || null,
        difficulty,
        difficulty_level: difficultyLevelFr,
        image_url: imageUrl || null,
        is_system: isSystem,
        is_default: isSystem,
        user_id: ownerId,
        coach_id: ownerId,
      };

      if (exercise?.id) {
        const { error } = await supabase.from("exercise_library").update(payload).eq("id", exercise.id);
        if (error) throw error;
        toast.success("Exercice mis à jour");
      } else {
        const { error } = await supabase.from("exercise_library").insert(payload);
        if (error) throw error;
        toast.success("Exercice ajouté (système)");
      }
      queryClient.invalidateQueries({ queryKey: ["super-admin-exercise-library"] });
      queryClient.invalidateQueries({ queryKey: ["exercise-library"] });
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const availableSubcategories = getSubcategoriesForCategory(category);
  const terrainCategories = getTerrainCategoriesForSport(selectedSport);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{exercise ? "Modifier l'exercice" : "Ajouter un exercice système"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nom *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Squat, Bench Press..." />
          </div>

          <div className="space-y-2">
            <Label>Sport (pour exercices terrain)</Label>
            <Select value={selectedSport} onValueChange={setSelectedSport}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SPORT_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Catégorie *</Label>
              <Select value={category} onValueChange={(v) => { setCategory(v); setSubcategory(""); }}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {Object.entries(CATEGORY_GROUP_CONFIGS).map(([key, conf]) => {
                    const cats = key === "terrain" ? terrainCategories : EXERCISE_CATEGORIES.filter((c) => c.group === key);
                    if (cats.length === 0) return null;
                    return (
                      <SelectGroup key={key}>
                        <SelectLabel className={cn("text-xs font-semibold", conf.color)}>{conf.label || key}</SelectLabel>
                        {cats.map((cat) => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}
                      </SelectGroup>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Difficulté</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {availableSubcategories.length > 0 && (
            <div className="space-y-2">
              <Label>Sous-catégorie</Label>
              <Select value={subcategory} onValueChange={setSubcategory}>
                <SelectTrigger><SelectValue placeholder="Optionnel" /></SelectTrigger>
                <SelectContent>
                  {availableSubcategories.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Image Upload */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" /> Image (max 2 Mo)
            </Label>
             {imageUrl ? (
              <div className="group relative w-full max-w-xs bg-muted rounded-lg">
                <img src={imageUrl} alt="Preview" className="rounded-lg border max-h-60 w-full object-contain" />
                <button
                  type="button"
                  className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive/60 hover:bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  onClick={() => setImageUrl("")}
                  aria-label="Retirer l'image"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => document.getElementById("exercise-image-upload")?.click()}
              >
                <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{uploading ? "Upload en cours..." : "Cliquer pour uploader"}</p>
              </div>
            )}
            <input
              id="exercise-image-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
            />
          </div>

          {/* Video URL */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Video className="h-4 w-4" /> Lien vidéo (YouTube, etc.)
            </Label>
            <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description de l'exercice..." rows={3} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || !name || !category}>
              {saving ? "Enregistrement..." : exercise ? "Mettre à jour" : "Ajouter"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
