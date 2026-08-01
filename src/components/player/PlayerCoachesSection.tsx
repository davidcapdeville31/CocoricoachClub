import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trophy as Whistle, Plus, X, Save, Edit2, Phone, Mail, User } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface PlayerCoachesSectionProps {
  playerId: string;
  categoryId: string;
  isViewer?: boolean;
}

interface Coach {
  id?: string;
  full_name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
}

export function PlayerCoachesSection({ playerId, categoryId, isViewer = false }: PlayerCoachesSectionProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [draftCoaches, setDraftCoaches] = useState<Coach[]>([]);

  const { data: coaches = [], isLoading } = useQuery({
    queryKey: ["player-coaches", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_coaches")
        .select("id, full_name, role, phone, email")
        .eq("player_id", playerId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Coach[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (next: Coach[]) => {
      // Strategy: delete all then insert valid ones (simple & safe)
      const { error: delErr } = await supabase
        .from("player_coaches")
        .delete()
        .eq("player_id", playerId);
      if (delErr) throw delErr;

      const valid = next
        .filter((c) => c.full_name?.trim() || c.phone?.trim() || c.email?.trim())
        .map((c) => ({
          player_id: playerId,
          category_id: categoryId,
          full_name: c.full_name?.trim() || "Entraîneur",
          role: c.role?.trim() || null,
          phone: c.phone?.trim() || null,
          email: c.email?.trim() || null,
        }));

      if (valid.length > 0) {
        const { error: insErr } = await supabase.from("player_coaches").insert(valid);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-coaches", playerId] });
      toast.success("Entraîneurs mis à jour");
      setIsEditing(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erreur lors de l'enregistrement"),
  });

  const startEdit = () => {
    setDraftCoaches(coaches.length > 0 ? coaches.map((c) => ({ ...c })) : []);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraftCoaches([]);
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-card shadow-md">
        <CardContent className="p-6">
          <p className="text-muted-foreground">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-card shadow-md">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Whistle className="h-5 w-5" />
              Entraîneurs
              {coaches.length > 0 && (
                <Badge variant="secondary" className="ml-1">{coaches.length}</Badge>
              )}
            </CardTitle>
          </CollapsibleTrigger>
          {!isViewer && (
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {isEditing ? (
                <>
                  <Button size="sm" variant="ghost" onClick={cancelEdit}>
                    <X className="h-4 w-4 mr-1" /> Annuler
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => saveMutation.mutate(draftCoaches)}
                    disabled={saveMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-1" /> Enregistrer
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={startEdit}>
                  <Edit2 className="h-4 w-4 mr-1" /> Modifier
                </Button>
              )}
            </div>
          )}
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {isEditing ? (
              <div className="space-y-3">
                {draftCoaches.map((c, idx) => (
                  <div key={idx} className="space-y-2 p-3 rounded-md border bg-background/50">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Entraîneur {idx + 1}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDraftCoaches((p) => p.filter((_, i) => i !== idx))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Nom complet</Label>
                        <Input
                          value={c.full_name || ""}
                          onChange={(e) => {
                            const u = [...draftCoaches]; u[idx].full_name = e.target.value; setDraftCoaches(u);
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Spécialité / Rôle</Label>
                        <Input
                          value={c.role || ""}
                          onChange={(e) => {
                            const u = [...draftCoaches]; u[idx].role = e.target.value; setDraftCoaches(u);
                          }}
                          placeholder="Ex: Préparateur physique"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Téléphone</Label>
                        <Input
                          type="tel"
                          value={c.phone || ""}
                          onChange={(e) => {
                            const u = [...draftCoaches]; u[idx].phone = e.target.value; setDraftCoaches(u);
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Email</Label>
                        <Input
                          type="email"
                          value={c.email || ""}
                          onChange={(e) => {
                            const u = [...draftCoaches]; u[idx].email = e.target.value; setDraftCoaches(u);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDraftCoaches((p) => [...p, { full_name: "", role: "", phone: "", email: "" }])}
                >
                  <Plus className="h-4 w-4 mr-1" /> Ajouter un entraîneur
                </Button>
              </div>
            ) : coaches.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Aucun entraîneur renseigné.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {coaches.map((c) => (
                  <div key={c.id} className="p-3 bg-muted/50 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{c.full_name}</span>
                      {c.role && <Badge variant="secondary" className="text-xs">{c.role}</Badge>}
                    </div>
                    {c.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <a href={`tel:${c.phone}`} className="hover:underline">{c.phone}</a>
                      </div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <a href={`mailto:${c.email}`} className="hover:underline break-all">{c.email}</a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
