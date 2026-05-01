import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Play, Trash2, Upload, Dumbbell, Lightbulb, Star, Filter, ChevronDown, ChevronUp, X, Video, BookOpen, Search, ImageIcon, Edit, RotateCcw, Shield, User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExerciseCardIcon } from "./ExerciseCardIcon";
import { ExerciseDescriptionCard, type ExerciseDescriptionData, type PositioningCriteria, type ExecutionCriteria, type SafetyPrevention } from "./ExerciseDescriptionCard";
import { ExerciseDescriptionForm, type ExerciseDescriptionFormData } from "./ExerciseDescriptionForm";
import { useMergedExercises, type MergedExercise } from "@/hooks/useMergedExercises";
import { ExerciseSourceBadge } from "./ExerciseSourceBadge";

// Stations HYROX regroupées sous un seul onglet
const HYROX_STATIONS = [
  "Ski Erg",
  "Sled Push",
  "Sled Pull",
  "Burpee Broad Jump",
  "Row",
  "Farmers Carry",
  "Sandbag Lunges",
  "Wall Balls",
];

// Onglets de filtrage (alignés sur les stations réellement présentes en base)
const EXERCISE_CATEGORIES = [
  "HYROX",
  "Haltérophilie",
  "Cardio/Endurance",
  "Vitesse/Plyométrie",
  "Gainage/Core",
  "Poids de corps/Calisthenics",
  "Athlétisme/Running drills",
  "Prévention/Renforcement",
  "Respiration",
  "Réathlétisation",
  "Tests & Évaluations",
];

// Muscles list (sorted alphabetically)
const MUSCLES = [
  "Abdominaux",
  "Adducteurs",
  "Avant-bras",
  "Biceps",
  "Cuisses (Quadriceps)",
  "Deltoïdes (Épaules)",
  "Dorsaux (Grand dorsal)",
  "Érecteurs du rachis",
  "Fessiers",
  "Ischio-jambiers",
  "Mollets",
  "Obliques",
  "Pectoraux",
  "Rhomboïdes",
  "Trapèzes",
  "Triceps"
].sort((a, b) => a.localeCompare(b, 'fr'));

// Equipment list (sorted alphabetically)
const EQUIPMENT = [
  "Abmat",
  "Anneaux",
  "Ballo",
  "Banc",
  "Barre",
  "Barre de traction",
  "Bosu",
  "Box",
  "Câbles",
  "Chaînes",
  "Corde",
  "Corde à sauter",
  "Echo Bike",
  "Élastiques",
  "GHD",
  "Haltères",
  "Kettlebell",
  "Machine",
  "Medball",
  "Parallettes",
  "Poids de corps",
  "Rameur",
  "Sac bulgare",
  "Sac de frappe",
  "Sandbag",
  "Serviette",
  "Ski Erg",
  "Sled",
  "Step",
  "Swiss ball",
  "TRX",
  "Wall ball"
].sort((a, b) => a.localeCompare(b, 'fr'));


const ExerciseLibrary = () => {
  const {
    exercises,
    loading,
    userId,
    refetch,
    saveOverride,
    deleteOverride,
    createCustomExercise,
    updateCustomExercise,
    deleteCustomExercise,
  } = useMergedExercises();

  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [selectedStation, setSelectedStation] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<MergedExercise | null>(null);
  const [uploading, setUploading] = useState(false);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  
  // Filter states
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  
  
  // Collapsible filter sections
  const [musclesOpen, setMusclesOpen] = useState(false);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  
  const [formData, setFormData] = useState({
    station_name: "",
    exercise_name: "",
    description: "",
    difficulty_level: "débutant",
    tips: "",
    is_variation: false,
    video_file: null as File | null,
    youtube_url: "",
    muscles: [] as string[],
    equipment: [] as string[],
    image_file: null as File | null
  });
  
  // Technical description for new exercises
  const [formDescriptionData, setFormDescriptionData] = useState<ExerciseDescriptionFormData>({
    general_description: "",
    positioning_criteria: {},
    execution_criteria: {},
    safety_prevention: {}
  });
  
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Edit form data
  const [editFormData, setEditFormData] = useState({
    exercise_name: "",
    station_name: "",
    description: "",
    difficulty_level: "débutant",
    tips: "",
    muscles: [] as string[],
    equipment: [] as string[],
    youtube_url: "",
    image_file: null as File | null,
    imagePreview: null as string | null,
  });
  
  // Technical description for editing
  const [editDescriptionData, setEditDescriptionData] = useState<ExerciseDescriptionFormData>({
    general_description: "",
    positioning_criteria: {},
    execution_criteria: {},
    safety_prevention: {}
  });

  useEffect(() => {
    if (userId) {
      fetchFavorites(userId);
    }
  }, [userId]);

  const fetchFavorites = async (coachId: string) => {
    try {
      const { data, error } = await supabase
        .from('exercise_favorites')
        .select('exercise_id')
        .eq('coach_id', coachId);

      if (error) throw error;
      setFavorites(new Set(data?.map(f => f.exercise_id) || []));
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  };

  const toggleFavorite = async (exerciseId: string) => {
    if (!userId) {
      toast.error('Vous devez être connecté pour ajouter des favoris');
      return;
    }

    const isFavorite = favorites.has(exerciseId);
    
    try {
      if (isFavorite) {
        const { error } = await supabase
          .from('exercise_favorites')
          .delete()
          .eq('coach_id', userId)
          .eq('exercise_id', exerciseId);
        
        if (error) throw error;
        
        setFavorites(prev => {
          const newSet = new Set(prev);
          newSet.delete(exerciseId);
          return newSet;
        });
        toast.success('Retiré des favoris');
      } else {
        const { error } = await supabase
          .from('exercise_favorites')
          .insert({ coach_id: userId, exercise_id: exerciseId });
        
        if (error) throw error;
        
        setFavorites(prev => new Set([...prev, exerciseId]));
        toast.success('Ajouté aux favoris');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Erreur lors de la modification des favoris');
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error('Le fichier est trop volumineux (max 50MB)');
        return;
      }
      setFormData({ ...formData, video_file: file });
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Le fichier est trop volumineux (max 5MB)');
        return;
      }
      setFormData({ ...formData, image_file: file });
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Le fichier est trop volumineux (max 5MB)');
        return;
      }
      setEditFormData({ ...editFormData, image_file: file, imagePreview: URL.createObjectURL(file) });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      let videoUrl = formData.youtube_url || null;
      let imageUrl: string | null = null;

      // Upload image if provided
      if (formData.image_file) {
        setUploadingImage(true);
        const fileExt = formData.image_file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('exercise-images')
          .upload(fileName, formData.image_file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('exercise-images')
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
        setUploadingImage(false);
      }

      if (formData.video_file) {
        const fileExt = formData.video_file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('exercise-videos')
          .upload(fileName, formData.video_file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('exercise-videos')
          .getPublicUrl(fileName);

        videoUrl = publicUrl;
      }

      await createCustomExercise({
        station_name: formData.station_name,
        exercise_name: formData.exercise_name,
        description: formData.description,
        general_description: formDescriptionData.general_description,
        positioning_criteria: formDescriptionData.positioning_criteria,
        execution_criteria: formDescriptionData.execution_criteria,
        safety_prevention: formDescriptionData.safety_prevention,
        difficulty_level: formData.difficulty_level,
        tips: formData.tips,
        video_url: videoUrl,
        image_url: imageUrl,
        muscles: formData.muscles,
        equipment: formData.equipment
      });

      setDialogOpen(false);
      setFormData({
        station_name: "",
        exercise_name: "",
        description: "",
        difficulty_level: "débutant",
        tips: "",
        is_variation: false,
        video_file: null,
        youtube_url: "",
        muscles: [],
        equipment: [],
        image_file: null
      });
      setFormDescriptionData({
        general_description: "",
        positioning_criteria: {},
        execution_criteria: {},
        safety_prevention: {}
      });
      setVideoPreview(null);
      setImagePreview(null);
    } catch (error) {
      console.error('Error adding exercise:', error);
      toast.error("Erreur lors de l'ajout de l'exercice");
    } finally {
      setUploading(false);
      setUploadingImage(false);
    }
  };

  const handleDelete = async (exercise: MergedExercise) => {
    if (exercise.is_default && !exercise.is_overridden) {
      toast.error('Impossible de supprimer un exercice officiel');
      return;
    }

    if (!confirm('Supprimer cet exercice ?')) return;

    try {
      if (exercise.is_custom) {
        await deleteCustomExercise(exercise.id);
      } else if (exercise.is_overridden) {
        await deleteOverride(exercise.id);
      }
    } catch (error) {
      console.error('Error deleting exercise:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const openEditDialog = (exercise: MergedExercise) => {
    setEditingExercise(exercise);
    setEditFormData({
      exercise_name: exercise.exercise_name,
      station_name: exercise.station_name,
      description: exercise.description || "",
      difficulty_level: exercise.difficulty_level || "débutant",
      tips: exercise.tips || "",
      muscles: exercise.muscles || [],
      equipment: exercise.equipment || [],
      youtube_url: exercise.video_url || "",
      image_file: null,
      imagePreview: exercise.image_url,
    });
    setEditDescriptionData({
      general_description: exercise.general_description || "",
      positioning_criteria: (exercise.positioning_criteria as PositioningCriteria) || {},
      execution_criteria: (exercise.execution_criteria as ExecutionCriteria) || {},
      safety_prevention: (exercise.safety_prevention as SafetyPrevention) || {}
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExercise || !userId) return;
    
    setUploading(true);

    try {
      let imageUrl = editFormData.imagePreview;

      // Upload new image if provided
      if (editFormData.image_file) {
        const fileExt = editFormData.image_file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('exercise-images')
          .upload(fileName, editFormData.image_file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('exercise-images')
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

      if (editingExercise.is_custom) {
        // Update custom exercise directly
        await updateCustomExercise(editingExercise.id, {
          exercise_name: editFormData.exercise_name,
          station_name: editFormData.station_name,
          description: editFormData.description,
          general_description: editDescriptionData.general_description,
          positioning_criteria: editDescriptionData.positioning_criteria,
          execution_criteria: editDescriptionData.execution_criteria,
          safety_prevention: editDescriptionData.safety_prevention,
          difficulty_level: editFormData.difficulty_level,
          tips: editFormData.tips,
          muscles: editFormData.muscles,
          equipment: editFormData.equipment,
          video_url: editFormData.youtube_url,
          image_url: imageUrl,
        });
      } else {
        // Create/update override for official exercise
        await saveOverride({
          coach_id: userId,
          base_exercise_id: editingExercise.id,
          override_description: editFormData.description || null,
          override_general_description: editDescriptionData.general_description || null,
          override_positioning_criteria: editDescriptionData.positioning_criteria,
          override_execution_criteria: editDescriptionData.execution_criteria,
          override_safety_prevention: editDescriptionData.safety_prevention,
          override_tips: editFormData.tips || null,
          override_video_url: editFormData.youtube_url || null,
          override_image_url: imageUrl || null,
        });
      }

      setEditDialogOpen(false);
      setEditingExercise(null);
    } catch (error) {
      console.error('Error updating exercise:', error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setUploading(false);
    }
  };

  const handleRevertToOfficial = async (exercise: MergedExercise) => {
    if (!exercise.is_overridden) return;
    
    if (!confirm('Restaurer la version officielle de cet exercice ? Vos modifications seront perdues.')) return;
    
    await deleteOverride(exercise.id);
  };

  // Advanced filtering logic
  const filteredExercises = exercises.filter(exercise => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const nameMatch = exercise.exercise_name.toLowerCase().includes(query);
      const categoryMatch = exercise.station_name.toLowerCase().includes(query);
      if (!nameMatch && !categoryMatch) {
        return false;
      }
    }
    
    // Category filter
    if (selectedStation !== "all" && exercise.station_name !== selectedStation) {
      return false;
    }
    
    // Favorites filter
    if (showFavoritesOnly && !favorites.has(exercise.id)) {
      return false;
    }
    
    // Muscles filter (OR logic within muscles)
    if (selectedMuscles.length > 0) {
      const exerciseMuscles = exercise.muscles || [];
      if (!selectedMuscles.some(muscle => exerciseMuscles.includes(muscle))) {
        return false;
      }
    }
    
    // Equipment filter (OR logic within equipment)
    if (selectedEquipment.length > 0) {
      const exerciseEquipment = exercise.equipment || [];
      if (!selectedEquipment.some(eq => exerciseEquipment.includes(eq))) {
        return false;
      }
    }
    
    return true;
  });

  const clearAllFilters = () => {
    setShowFavoritesOnly(false);
    setSelectedMuscles([]);
    setSelectedEquipment([]);
    setSelectedStation("all");
    setSearchQuery("");
  };

  const hasActiveFilters = showFavoritesOnly || 
    selectedMuscles.length > 0 || 
    selectedEquipment.length > 0 ||
    searchQuery.trim().length > 0;

  const getDifficultyColor = (level: string | null) => {
    switch (level) {
      case 'débutant': return 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30';
      case 'intermédiaire': return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30';
      case 'avancé': return 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  // YouTube helpers
  const getYouTubeVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const getYouTubeEmbedUrl = (url: string) => {
    const videoId = getYouTubeVideoId(url);
    return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : null;
  };

  const isYouTubeUrl = (url: string | null) => {
    if (!url) return false;
    return url.includes('youtube.com') || url.includes('youtu.be');
  };

  // Vimeo helpers
  const getVimeoVideoId = (url: string) => {
    const regExp = /(?:vimeo.com\/|player.vimeo.com\/video\/)(\d+)/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  };

  const getVimeoEmbedUrl = (url: string) => {
    const videoId = getVimeoVideoId(url);
    return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
  };

  const isVimeoUrl = (url: string | null) => {
    if (!url) return false;
    return url.includes('vimeo.com');
  };

  // Detect video type
  const getVideoType = (url: string | null): 'youtube' | 'vimeo' | 'direct' | null => {
    if (!url) return null;
    if (isYouTubeUrl(url)) return 'youtube';
    if (isVimeoUrl(url)) return 'vimeo';
    return 'direct';
  };

  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
  const [selectedExerciseForDetail, setSelectedExerciseForDetail] = useState<MergedExercise | null>(null);

  const handleVideoClick = (videoUrl: string) => {
    setSelectedVideoUrl(videoUrl);
    setVideoDialogOpen(true);
  };

  // Render exercise visual - image if available, otherwise icon-based
  const renderExerciseVisual = (exercise: MergedExercise) => {
    const hasVideo = !!exercise.video_url;
    const hasImage = !!exercise.image_url;
    
    return (
      <div className="relative">
        {hasImage ? (
          <img 
            src={exercise.image_url!} 
            alt={exercise.exercise_name}
            className="h-14 w-14 rounded-lg object-cover border border-border"
          />
        ) : (
          <ExerciseCardIcon category={exercise.station_name} size="lg" className="h-14 w-14" />
        )}
        {hasVideo && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleVideoClick(exercise.video_url!);
            }}
            className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-colors"
          >
            <Video className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  };

  const FilterCheckboxList = ({ 
    items, 
    selected, 
    onToggle,
    color = "primary"
  }: { 
    items: string[]; 
    selected: string[]; 
    onToggle: (item: string) => void;
    color?: string;
  }) => (
    <ScrollArea className="h-48">
      <div className="grid grid-cols-2 gap-1 p-2">
        {items.map(item => (
          <label 
            key={item} 
            className={cn(
              "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-sm",
              selected.includes(item) 
                ? "bg-primary/10 text-primary" 
                : "hover:bg-muted"
            )}
          >
            <Checkbox
              checked={selected.includes(item)}
              onCheckedChange={() => onToggle(item)}
              className="h-4 w-4"
            />
            <span className="truncate">{item}</span>
          </label>
        ))}
      </div>
    </ScrollArea>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Dumbbell className="h-6 w-6 text-primary" />
            Ma Bibliothèque d'Exercices
          </h2>
          <p className="text-muted-foreground">
            {filteredExercises.length} exercices{hasActiveFilters ? ' (filtrés)' : ''} • Vos modifications sont privées
          </p>
        </div>

        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Créer un exercice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nouvel exercice personnalisé</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Select 
                    value={formData.station_name} 
                    onValueChange={(v) => setFormData({ ...formData, station_name: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXERCISE_CATEGORIES.map(station => (
                        <SelectItem key={station} value={station}>{station}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Nom de l'exercice</Label>
                  <Input
                    value={formData.exercise_name}
                    onChange={(e) => setFormData({ ...formData, exercise_name: e.target.value })}
                    placeholder="Ex: Développé couché / Bench Press"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Décrivez l'exercice en détail..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Niveau de difficulté</Label>
                  <Select 
                    value={formData.difficulty_level} 
                    onValueChange={(v) => setFormData({ ...formData, difficulty_level: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="débutant">Débutant</SelectItem>
                      <SelectItem value="intermédiaire">Intermédiaire</SelectItem>
                      <SelectItem value="avancé">Avancé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Muscles selection */}
                <div className="space-y-2">
                  <Label>Muscles travaillés</Label>
                  <div className="flex flex-wrap gap-1 min-h-[32px] p-2 border rounded-md bg-background">
                    {formData.muscles.length === 0 ? (
                      <span className="text-muted-foreground text-sm">Aucun muscle sélectionné</span>
                    ) : (
                      formData.muscles.map(muscle => (
                        <Badge 
                          key={muscle} 
                          variant="secondary"
                          className="cursor-pointer hover:bg-destructive/20"
                          onClick={() => setFormData({
                            ...formData,
                            muscles: formData.muscles.filter(m => m !== muscle)
                          })}
                        >
                          {muscle} <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))
                    )}
                  </div>
                  <Select
                    value=""
                    onValueChange={(v) => {
                      if (!formData.muscles.includes(v)) {
                        setFormData({ ...formData, muscles: [...formData.muscles, v] });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ajouter un muscle..." />
                    </SelectTrigger>
                    <SelectContent>
                      {MUSCLES.filter(m => !formData.muscles.includes(m)).map(muscle => (
                        <SelectItem key={muscle} value={muscle}>{muscle}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Equipment selection */}
                <div className="space-y-2">
                  <Label>Équipement</Label>
                  <div className="flex flex-wrap gap-1 min-h-[32px] p-2 border rounded-md bg-background">
                    {formData.equipment.length === 0 ? (
                      <span className="text-muted-foreground text-sm">Aucun équipement sélectionné</span>
                    ) : (
                      formData.equipment.map(eq => (
                        <Badge 
                          key={eq} 
                          variant="secondary"
                          className="cursor-pointer hover:bg-destructive/20"
                          onClick={() => setFormData({
                            ...formData,
                            equipment: formData.equipment.filter(e => e !== eq)
                          })}
                        >
                          {eq} <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))
                    )}
                  </div>
                  <Select
                    value=""
                    onValueChange={(v) => {
                      if (!formData.equipment.includes(v)) {
                        setFormData({ ...formData, equipment: [...formData.equipment, v] });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ajouter un équipement..." />
                    </SelectTrigger>
                    <SelectContent>
                      {EQUIPMENT.filter(e => !formData.equipment.includes(e)).map(eq => (
                        <SelectItem key={eq} value={eq}>{eq}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>


                {/* Technical description form */}
                <div className="pt-4 border-t">
                  <ExerciseDescriptionForm
                    data={formDescriptionData}
                    onChange={setFormDescriptionData}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Conseils</Label>
                  <Textarea
                    value={formData.tips}
                    onChange={(e) => setFormData({ ...formData, tips: e.target.value })}
                    placeholder="Points clés à retenir..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Lien YouTube (optionnel)</Label>
                  <Input
                    value={formData.youtube_url}
                    onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=..."
                    type="url"
                  />
                </div>

                {/* Image upload */}
                <div className="space-y-2">
                  <Label>Photo de l'exercice (optionnel)</Label>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      id="image-upload"
                    />
                    <label htmlFor="image-upload" className="cursor-pointer">
                      {imagePreview ? (
                        <div className="relative">
                          <img 
                            src={imagePreview} 
                            alt="Preview"
                            className="max-h-32 mx-auto rounded object-cover"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-0 right-0 h-6 w-6"
                            onClick={(e) => {
                              e.preventDefault();
                              setFormData({ ...formData, image_file: null });
                              setImagePreview(null);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <ImageIcon className="h-8 w-8" />
                          <span className="text-sm">Cliquez pour ajouter une photo (max 5MB)</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Ou uploader une vidéo (optionnel)</Label>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoChange}
                      className="hidden"
                      id="video-upload"
                    />
                    <label htmlFor="video-upload" className="cursor-pointer">
                      {videoPreview ? (
                        <video 
                          src={videoPreview} 
                          className="max-h-32 mx-auto rounded"
                          controls
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Upload className="h-8 w-8" />
                          <span className="text-sm">Cliquez pour uploader (max 50MB)</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={uploading || !formData.station_name || !formData.exercise_name}>
                  {uploading ? 'Création en cours...' : 'Créer l\'exercice'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un exercice par nom..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => setSearchQuery("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Advanced Filters Section */}
      <Card className="border-primary/20">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Filtres avancés</h3>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-muted-foreground">
                <X className="h-4 w-4 mr-1" />
                Effacer les filtres
              </Button>
            )}
          </div>

          {/* Favorites toggle */}
          <div className="flex items-center gap-3">
            <Button
              variant={showFavoritesOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={cn(
                "gap-2",
                showFavoritesOnly && "bg-warning hover:bg-warning/90 text-warning-foreground"
              )}
            >
              <Star className={cn("h-4 w-4", showFavoritesOnly && "fill-current")} />
              Favoris
            </Button>
          </div>

          {/* Filter collapsibles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Muscles filter */}
            <Collapsible open={musclesOpen} onOpenChange={setMusclesOpen}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="outline" 
                  className={cn(
                    "w-full justify-between",
                    selectedMuscles.length > 0 && "border-destructive/50 bg-destructive/10"
                  )}
                >
                  <span className="flex items-center gap-2">
                    Trier par muscle {selectedMuscles.length > 0 && `(${selectedMuscles.length})`}
                  </span>
                  {musclesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 border rounded-lg bg-card">
                <FilterCheckboxList
                  items={MUSCLES}
                  selected={selectedMuscles}
                  onToggle={(item) => {
                    setSelectedMuscles(prev =>
                      prev.includes(item)
                        ? prev.filter(i => i !== item)
                        : [...prev, item]
                    );
                  }}
                />
              </CollapsibleContent>
            </Collapsible>

            {/* Equipment filter */}
            <Collapsible open={equipmentOpen} onOpenChange={setEquipmentOpen}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="outline" 
                  className={cn(
                    "w-full justify-between",
                    selectedEquipment.length > 0 && "border-info/50 bg-info/10"
                  )}
                >
                  <span className="flex items-center gap-2">
                    Trier par équipement {selectedEquipment.length > 0 && `(${selectedEquipment.length})`}
                  </span>
                  {equipmentOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 border rounded-lg bg-card">
                <FilterCheckboxList
                  items={EQUIPMENT}
                  selected={selectedEquipment}
                  onToggle={(item) => {
                    setSelectedEquipment(prev =>
                      prev.includes(item)
                        ? prev.filter(i => i !== item)
                        : [...prev, item]
                    );
                  }}
                />
              </CollapsibleContent>
            </Collapsible>

          </div>

          {/* Active filters display */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {showFavoritesOnly && (
                <Badge variant="secondary" className="bg-warning/20 text-warning">
                  <Star className="h-3 w-3 mr-1 fill-current" />
                  Favoris
                  <X 
                    className="h-3 w-3 ml-1 cursor-pointer hover:text-destructive" 
                    onClick={() => setShowFavoritesOnly(false)}
                  />
                </Badge>
              )}
              {selectedMuscles.map(muscle => (
                <Badge key={muscle} variant="secondary" className="bg-destructive/20 text-destructive">
                  {muscle}
                  <X 
                    className="h-3 w-3 ml-1 cursor-pointer" 
                    onClick={() => setSelectedMuscles(prev => prev.filter(m => m !== muscle))}
                  />
                </Badge>
              ))}
              {selectedEquipment.map(eq => (
                <Badge key={eq} variant="secondary" className="bg-info/20 text-info">
                  {eq}
                  <X 
                    className="h-3 w-3 ml-1 cursor-pointer" 
                    onClick={() => setSelectedEquipment(prev => prev.filter(e => e !== eq))}
                  />
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Tabs */}
      <Tabs value={selectedStation} onValueChange={setSelectedStation} className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all">Tous</TabsTrigger>
          {EXERCISE_CATEGORIES.map(cat => (
            <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedStation} className="mt-4">
          {filteredExercises.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Dumbbell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun exercice trouvé avec ces filtres</p>
              {hasActiveFilters && (
                <Button variant="link" onClick={clearAllFilters} className="mt-2">
                  Effacer les filtres
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredExercises.map((exercise) => (
                <Card 
                  key={exercise.id} 
                  className="group hover:shadow-card-hover transition-all duration-200 border-border/50 hover:border-primary/30 cursor-pointer"
                  onClick={() => setSelectedExerciseForDetail(selectedExerciseForDetail?.id === exercise.id ? null : exercise)}
                >
                  <CardContent className="p-4">
                    {/* Header row: Icon + Name + Actions */}
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      {renderExerciseVisual(exercise)}
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1">
                        {/* Exercise name */}
                        <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                          {exercise.exercise_name}
                        </h3>
                        
                        {/* Source badge + Category */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <ExerciseSourceBadge 
                            isDefault={exercise.is_default} 
                            isOverridden={exercise.is_overridden} 
                            isCustom={exercise.is_custom} 
                          />
                          <Badge variant="outline" className="text-xs font-normal">
                            {exercise.station_name}
                          </Badge>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex flex-col gap-1">
                        {/* Edit button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(exercise);
                          }}
                          className="p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-primary/10 hover:text-primary transition-colors"
                          title="Modifier"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        
                        {/* Favorite */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(exercise.id);
                          }}
                          className={cn(
                            "p-1.5 rounded-md transition-colors",
                            favorites.has(exercise.id)
                              ? "bg-warning/20 text-warning"
                              : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted"
                          )}
                        >
                          <Star className={cn("h-4 w-4", favorites.has(exercise.id) && "fill-current")} />
                        </button>
                        
                        {/* Revert to official (only for overridden) */}
                        {exercise.is_overridden && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRevertToOfficial(exercise);
                            }}
                            className="p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-info/10 hover:text-info transition-colors"
                            title="Restaurer la version officielle"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                        
                        {/* Delete (only for custom exercises) */}
                        {exercise.is_custom && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(exercise);
                            }}
                            className="p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Difficulty + Tags row */}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {exercise.difficulty_level && (
                        <Badge className={cn("text-xs", getDifficultyColor(exercise.difficulty_level))}>
                          {exercise.difficulty_level}
                        </Badge>
                      )}
                      {exercise.muscles?.slice(0, 2).map(muscle => (
                        <Badge key={muscle} variant="outline" className="text-xs bg-destructive/5 border-destructive/20 text-destructive">
                          {muscle}
                        </Badge>
                      ))}
                      {exercise.equipment?.slice(0, 1).map(eq => (
                        <Badge key={eq} variant="outline" className="text-xs bg-info/5 border-info/20 text-info">
                          {eq}
                        </Badge>
                      ))}
                      {((exercise.muscles?.length || 0) + (exercise.equipment?.length || 0)) > 3 && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          +{(exercise.muscles?.length || 0) + (exercise.equipment?.length || 0) - 3}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Expandable technical description - shows when exercise is selected */}
                    {selectedExerciseForDetail?.id === exercise.id && (
                      <div className="mt-4 pt-3 border-t animate-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center gap-2 mb-3">
                          <BookOpen className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-sm text-primary">Fiche technique</span>
                        </div>
                        <ExerciseDescriptionCard
                          exerciseName={exercise.exercise_name}
                          data={{
                            general_description: exercise.general_description,
                            positioning_criteria: exercise.positioning_criteria as ExerciseDescriptionData['positioning_criteria'],
                            execution_criteria: exercise.execution_criteria as ExerciseDescriptionData['execution_criteria'],
                            safety_prevention: exercise.safety_prevention as ExerciseDescriptionData['safety_prevention'],
                          }}
                          variant="compact"
                          defaultOpen={true}
                        />
                      </div>
                    )}
                    
                    {/* Collapsed: Show only description preview and tips */}
                    {selectedExerciseForDetail?.id !== exercise.id && (
                      <>
                        {/* Description preview */}
                        {(exercise.general_description || exercise.description) && (
                          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                            {exercise.general_description || exercise.description}
                          </p>
                        )}
                        
                        {/* Tips */}
                        {exercise.tips && (
                          <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground bg-warning/5 border border-warning/20 p-2 rounded-md">
                            <Lightbulb className="h-3 w-3 mt-0.5 text-warning flex-shrink-0" />
                            <span className="line-clamp-2">{exercise.tips}</span>
                          </div>
                        )}
                        
                        {/* Click hint */}
                        <div className="mt-3 flex items-center gap-2 text-sm font-medium text-primary bg-primary/20 hover:bg-primary/30 px-3 py-2 rounded-lg cursor-pointer transition-colors border border-primary/30 hover:border-primary/50">
                          <BookOpen className="h-4 w-4" />
                          <span>Cliquez pour voir la fiche technique</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Video Dialog */}
      <Dialog open={videoDialogOpen} onOpenChange={(open) => {
        setVideoDialogOpen(open);
        if (!open) setSelectedVideoUrl(null);
      }}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Vidéo de démonstration</DialogTitle>
          </DialogHeader>
          <div className="aspect-video bg-black flex items-center justify-center">
            {!selectedVideoUrl && (
              <div className="text-white/50 text-sm">Chargement...</div>
            )}
            {selectedVideoUrl && getVideoType(selectedVideoUrl) === 'youtube' && (
              <iframe
                key={selectedVideoUrl}
                src={getYouTubeEmbedUrl(selectedVideoUrl) || ''}
                className="w-full h-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            )}
            {selectedVideoUrl && getVideoType(selectedVideoUrl) === 'vimeo' && (
              <iframe
                key={selectedVideoUrl}
                src={getVimeoEmbedUrl(selectedVideoUrl) || ''}
                className="w-full h-full"
                allowFullScreen
                allow="autoplay; fullscreen; picture-in-picture"
              />
            )}
            {selectedVideoUrl && getVideoType(selectedVideoUrl) === 'direct' && (
              <video
                key={selectedVideoUrl}
                src={selectedVideoUrl}
                className="w-full h-full"
                controls
                autoPlay
                playsInline
                preload="auto"
                onError={(e) => {
                  console.error('Video error:', e);
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Exercise Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) setEditingExercise(null);
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              {editingExercise?.is_custom ? "Modifier mon exercice" : "Personnaliser l'exercice"}
            </DialogTitle>
            {!editingExercise?.is_custom && (
              <p className="text-sm text-muted-foreground">
                Vos modifications seront privées et n'affecteront pas les autres coachs.
              </p>
            )}
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {editingExercise?.is_custom && (
              <>
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Select 
                    value={editFormData.station_name} 
                    onValueChange={(v) => setEditFormData({ ...editFormData, station_name: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXERCISE_CATEGORIES.map(station => (
                        <SelectItem key={station} value={station}>{station}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Nom de l'exercice</Label>
                  <Input
                    value={editFormData.exercise_name}
                    onChange={(e) => setEditFormData({ ...editFormData, exercise_name: e.target.value })}
                    required
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                placeholder="Décrivez l'exercice..."
                rows={3}
              />
            </div>

            {/* Technical description form */}
            <div className="pt-2 border-t">
              <ExerciseDescriptionForm
                data={editDescriptionData}
                onChange={setEditDescriptionData}
              />
            </div>

            <div className="space-y-2">
              <Label>Conseils</Label>
              <Textarea
                value={editFormData.tips}
                onChange={(e) => setEditFormData({ ...editFormData, tips: e.target.value })}
                placeholder="Points clés à retenir..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Lien vidéo (YouTube)</Label>
              <Input
                value={editFormData.youtube_url}
                onChange={(e) => setEditFormData({ ...editFormData, youtube_url: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
                type="url"
              />
            </div>

            {/* Image upload */}
            <div className="space-y-2">
              <Label>Photo de l'exercice</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleEditImageChange}
                  className="hidden"
                  id="edit-image-upload"
                />
                <label htmlFor="edit-image-upload" className="cursor-pointer">
                  {editFormData.imagePreview ? (
                    <div className="relative">
                      <img 
                        src={editFormData.imagePreview} 
                        alt="Preview"
                        className="max-h-32 mx-auto rounded object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-0 right-0 h-6 w-6"
                        onClick={(e) => {
                          e.preventDefault();
                          setEditFormData({ ...editFormData, image_file: null, imagePreview: null });
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ImageIcon className="h-8 w-8" />
                      <span className="text-sm">Cliquez pour ajouter une photo (max 5MB)</span>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {editingExercise?.is_custom && (
              <>
                {/* Muscles selection */}
                <div className="space-y-2">
                  <Label>Muscles travaillés</Label>
                  <div className="flex flex-wrap gap-1 min-h-[32px] p-2 border rounded-md bg-background">
                    {editFormData.muscles.length === 0 ? (
                      <span className="text-muted-foreground text-sm">Aucun muscle sélectionné</span>
                    ) : (
                      editFormData.muscles.map(muscle => (
                        <Badge 
                          key={muscle} 
                          variant="secondary"
                          className="cursor-pointer hover:bg-destructive/20"
                          onClick={() => setEditFormData({
                            ...editFormData,
                            muscles: editFormData.muscles.filter(m => m !== muscle)
                          })}
                        >
                          {muscle} <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))
                    )}
                  </div>
                  <Select
                    value=""
                    onValueChange={(v) => {
                      if (!editFormData.muscles.includes(v)) {
                        setEditFormData({ ...editFormData, muscles: [...editFormData.muscles, v] });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ajouter un muscle..." />
                    </SelectTrigger>
                    <SelectContent>
                      {MUSCLES.filter(m => !editFormData.muscles.includes(m)).map(muscle => (
                        <SelectItem key={muscle} value={muscle}>{muscle}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Equipment selection */}
                <div className="space-y-2">
                  <Label>Équipement</Label>
                  <div className="flex flex-wrap gap-1 min-h-[32px] p-2 border rounded-md bg-background">
                    {editFormData.equipment.length === 0 ? (
                      <span className="text-muted-foreground text-sm">Aucun équipement sélectionné</span>
                    ) : (
                      editFormData.equipment.map(eq => (
                        <Badge 
                          key={eq} 
                          variant="secondary"
                          className="cursor-pointer hover:bg-destructive/20"
                          onClick={() => setEditFormData({
                            ...editFormData,
                            equipment: editFormData.equipment.filter(e => e !== eq)
                          })}
                        >
                          {eq} <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))
                    )}
                  </div>
                  <Select
                    value=""
                    onValueChange={(v) => {
                      if (!editFormData.equipment.includes(v)) {
                        setEditFormData({ ...editFormData, equipment: [...editFormData.equipment, v] });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ajouter un équipement..." />
                    </SelectTrigger>
                    <SelectContent>
                      {EQUIPMENT.filter(e => !editFormData.equipment.includes(e)).map(eq => (
                        <SelectItem key={eq} value={eq}>{eq}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Niveau de difficulté</Label>
                  <Select 
                    value={editFormData.difficulty_level} 
                    onValueChange={(v) => setEditFormData({ ...editFormData, difficulty_level: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="débutant">Débutant</SelectItem>
                      <SelectItem value="intermédiaire">Intermédiaire</SelectItem>
                      <SelectItem value="avancé">Avancé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExerciseLibrary;
