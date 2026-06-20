import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, ChevronRight, Users, Pencil, Check, X, LogOut } from "lucide-react";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddCategoryDialog } from "@/components/categories/AddCategoryDialog";
import { CollaborationTab } from "@/components/collaboration/CollaborationTab";
import { SnapshotClubButton } from "@/components/club/SnapshotClubButton";
import { SnapshotCategoryButton } from "@/components/category/SnapshotCategoryButton";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { GlobalPlayerSearch } from "@/components/search/GlobalPlayerSearch";
import { ViewerModeProvider, useViewerModeContext } from "@/contexts/ViewerModeContext";

function ClubDetailsContent() {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const { isViewer } = useViewerModeContext();
  const { signOut } = useAuth();

  const { data: club } = useQuery({
    queryKey: ["club", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("*")
        .eq("id", clubId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("club_id", clubId)
        .eq("is_archived", false)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", categoryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories", clubId] });
      toast.success("Catégorie supprimée avec succès");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression de la catégorie");
    },
  });

  const renameCategory = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("categories")
        .update({ name })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories", clubId] });
      toast.success("Nom de la catégorie mis à jour");
      setEditingId(null);
    },
    onError: () => {
      toast.error("Erreur lors du renommage");
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-background pt-[max(env(safe-area-inset-top),1.5rem)] pb-6 sm:pb-8 px-4 border-b border-border">
        <div className="container mx-auto max-w-6xl">
          <div className="flex justify-between items-start gap-2 mb-4 flex-wrap">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="text-[#ED2939] hover:bg-[#ED2939]/10 shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Retour aux clubs</span>
              <span className="sm:hidden">Retour</span>
            </Button>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0 [&_button]:text-[#ED2939] [&_button:hover]:bg-[#ED2939]/10">
              <NotificationBell />
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                title="Déconnexion"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#ED2939] break-words">{club?.name}</h1>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <Tabs defaultValue="categories" className="space-y-6">
          <TabsList>
            <TabsTrigger value="categories">Catégories</TabsTrigger>
            {!isViewer && (
              <TabsTrigger value="collaboration">Collaboration</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="categories" className="space-y-4">
            <div className="flex justify-between items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">Catégories</h2>
              {!isViewer && (
                <div className="flex items-center gap-2 flex-wrap">
                  {clubId && <SnapshotClubButton clubId={clubId} clubName={club?.name} />}
                  <Button onClick={() => setIsAddDialogOpen(true)} size="sm" className="gap-2 shrink-0">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Créer / Modifier une catégorie</span>
                    <span className="sm:hidden">Créer / Modifier</span>
                  </Button>
                </div>
              )}
            </div>

            {categories && categories.length === 0 ? (
          <Card className="bg-gradient-card shadow-md">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                Aucune catégorie créée pour ce club
              </p>
              {!isViewer && (
                <Button
                  onClick={() => setIsAddDialogOpen(true)}
                  variant="outline"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Créer votre première catégorie
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {categories?.map((category) => {
              const isEditing = editingId === category.id;
              return (
              <div
                key={category.id}
                className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group cursor-pointer"
                onClick={() => { if (!isEditing) navigate(`/categories/${category.id}`); }}
              >
                {/* Category image/icon */}
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center border flex-shrink-0">
                  {category.cover_image_url ? (
                    <img 
                      src={category.cover_image_url} 
                      alt={category.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Users className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                {/* Name and info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <Input
                        autoFocus
                        value={editingName}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const trimmed = editingName.trim();
                            if (trimmed && trimmed !== category.name) {
                              renameCategory.mutate({ id: category.id, name: trimmed });
                            } else {
                              setEditingId(null);
                            }
                          } else if (e.key === "Escape") {
                            setEditingId(null);
                          }
                        }}
                        className="h-8 max-w-[260px]"
                      />
                    ) : (
                      <span className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                        {category.name}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full flex-shrink-0">
                      {category.rugby_type === "7" ? "7s" : 
                       category.rugby_type === "academie" ? "Académie" : 
                       category.rugby_type === "national_team" ? "Équipe Nat." : 
                       category.rugby_type}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Créé le {new Date(category.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!isViewer && isEditing && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          const trimmed = editingName.trim();
                          if (trimmed && trimmed !== category.name) {
                            renameCategory.mutate({ id: category.id, name: trimmed });
                          } else {
                            setEditingId(null);
                          }
                        }}
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {!isViewer && !isEditing && (
                    <>
                      <span onClick={(e) => e.stopPropagation()}>
                        <SnapshotCategoryButton categoryId={category.id} categoryName={category.name} />
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-100 sm:opacity-70 sm:hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingName(category.name);
                          setEditingId(category.id);
                        }}
                        title="Renommer"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <ConfirmDeleteButton
                        severity="high"
                        entityKind="la catégorie"
                        entityName={category.name}
                        description="Tous les joueurs, séances, programmes, statistiques et invitations rattachés à cette catégorie seront définitivement perdus. Cette action est irréversible."
                        successToast="Catégorie supprimée"
                        onConfirm={() => deleteCategory.mutateAsync(category.id)}
                        triggerClassName="h-8 w-8 opacity-100 sm:opacity-70 sm:hover:opacity-100"
                      />
                    </>
                  )}
                  {!isEditing && <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </TabsContent>

      {!isViewer && (
        <TabsContent value="collaboration">
          <CollaborationTab clubId={clubId!} />
        </TabsContent>
      )}
    </Tabs>
  </div>

      {!isViewer && (
        <AddCategoryDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          clubId={clubId!}
        />
      )}
    </div>
  );
}

export default function ClubDetails() {
  const { clubId } = useParams();
  
  return (
    <ViewerModeProvider clubId={clubId}>
      <ClubDetailsContent />
    </ViewerModeProvider>
  );
}
