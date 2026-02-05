import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Edit2, Save, X, Phone, Mail, Calendar, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PlayerPersonalInfoSectionProps {
  playerId: string;
  isViewer?: boolean;
}

interface PlayerPersonalInfo {
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  club_origin: string | null;
}

export function PlayerPersonalInfoSection({ playerId, isViewer = false }: PlayerPersonalInfoSectionProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<PlayerPersonalInfo>({
    email: null,
    phone: null,
    birth_date: null,
    club_origin: null,
  });

  const { data: playerInfo, isLoading } = useQuery({
    queryKey: ["player-personal-info", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select(`email, phone, birth_date, club_origin, name`)
        .eq("id", playerId)
        .single();
      if (error) throw error;
      return data as PlayerPersonalInfo & { name: string };
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PlayerPersonalInfo) => {
      const { error } = await supabase
        .from("players")
        .update(data)
        .eq("id", playerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-personal-info", playerId] });
      queryClient.invalidateQueries({ queryKey: ["player", playerId] });
      toast.success("Fiche personnelle mise à jour");
      setIsEditing(false);
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });

  const handleStartEdit = () => {
    if (playerInfo) {
      setFormData({
        email: playerInfo.email,
        phone: playerInfo.phone,
        birth_date: playerInfo.birth_date,
        club_origin: playerInfo.club_origin,
      });
    }
    setIsEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const hasInfo = playerInfo?.email || playerInfo?.phone || playerInfo?.birth_date || playerInfo?.club_origin;

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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="h-5 w-5" />
          Fiche Personnelle
        </CardTitle>
        {!isViewer && (
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button size="sm" variant="ghost" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-1" />
                  Annuler
                </Button>
                <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                  <Save className="h-4 w-4 mr-1" />
                  Enregistrer
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={handleStartEdit}>
                <Edit2 className="h-4 w-4 mr-1" />
                {hasInfo ? "Modifier" : "Ajouter"}
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {isEditing ? (
          // Edit Mode
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="player_email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email de l'athlète
                </Label>
                <Input
                  id="player_email"
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value || null })}
                  placeholder="athlete@exemple.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player_phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Téléphone de l'athlète
                </Label>
                <Input
                  id="player_phone"
                  type="tel"
                  value={formData.phone || ""}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value || null })}
                  placeholder="+33 6 XX XX XX XX"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="player_birth_date" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Date de naissance
                </Label>
                <Input
                  id="player_birth_date"
                  type="date"
                  value={formData.birth_date || ""}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value || null })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player_club_origin" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Club d'origine
                </Label>
                <Input
                  id="player_club_origin"
                  value={formData.club_origin || ""}
                  onChange={(e) => setFormData({ ...formData, club_origin: e.target.value || null })}
                  placeholder="Nom du club précédent"
                />
              </div>
            </div>
          </div>
        ) : (
          // View Mode
          <div className="space-y-3">
            {hasInfo ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {playerInfo?.email && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <a href={`mailto:${playerInfo.email}`} className="text-sm hover:underline">
                        {playerInfo.email}
                      </a>
                    </div>
                  </div>
                )}
                {playerInfo?.phone && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Téléphone</p>
                      <a href={`tel:${playerInfo.phone}`} className="text-sm hover:underline">
                        {playerInfo.phone}
                      </a>
                    </div>
                  </div>
                )}
                {playerInfo?.birth_date && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Date de naissance</p>
                      <p className="text-sm">
                        {new Date(playerInfo.birth_date).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  </div>
                )}
                {playerInfo?.club_origin && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Club d'origine</p>
                      <p className="text-sm">{playerInfo.club_origin}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Aucune information personnelle renseignée.
                </p>
                {!isViewer && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Cliquez sur "Ajouter" pour compléter la fiche.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
