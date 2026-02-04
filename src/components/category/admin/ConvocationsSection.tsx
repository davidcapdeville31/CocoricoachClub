import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Plus, Mail, Users, Calendar, MapPin, Trash2, Edit, 
  Send, CheckCircle, XCircle, HelpCircle, Clock
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ConvocationsSectionProps {
  categoryId: string;
}

const EVENT_TYPES = [
  { value: "match", label: "Match", icon: "🏆" },
  { value: "training", label: "Entraînement", icon: "⚽" },
  { value: "tournament", label: "Tournoi", icon: "🎯" },
  { value: "gathering", label: "Regroupement", icon: "👥" },
  { value: "meeting", label: "Réunion", icon: "📋" },
];

export function ConvocationsSection({ categoryId }: ConvocationsSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewingConvocation, setViewingConvocation] = useState<any>(null);
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState("match");
  const [eventDate, setEventDate] = useState(new Date().toISOString().split("T")[0]);
  const [eventTime, setEventTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [responseDeadline, setResponseDeadline] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  
  const queryClient = useQueryClient();

  // Fetch convocations
  const { data: convocations, isLoading } = useQuery({
    queryKey: ["convocations", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convocations")
        .select("*, convocation_recipients(*, players(name))")
        .eq("category_id", categoryId)
        .order("event_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch players
  const { data: players } = useQuery({
    queryKey: ["players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, position")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => {
    setName("");
    setEventType("match");
    setEventDate(new Date().toISOString().split("T")[0]);
    setEventTime("");
    setLocation("");
    setDescription("");
    setResponseDeadline("");
    setSelectedPlayers([]);
    setViewingConvocation(null);
  };

  const openCreateDialog = () => {
    resetForm();
    // Select all players by default
    setSelectedPlayers(players?.map((p) => p.id) || []);
    setIsDialogOpen(true);
  };

  const saveConvocation = useMutation({
    mutationFn: async () => {
      const convocationData = {
        category_id: categoryId,
        name,
        event_type: eventType,
        event_date: eventDate,
        event_time: eventTime || null,
        location: location || null,
        description: description || null,
        response_deadline: responseDeadline || null,
        status: "draft",
      };

      const { data, error } = await supabase
        .from("convocations")
        .insert(convocationData)
        .select()
        .single();
      if (error) throw error;

      // Insert recipients
      if (selectedPlayers.length > 0) {
        const recipients = selectedPlayers.map((playerId) => ({
          convocation_id: data.id,
          player_id: playerId,
          response: "pending",
        }));

        const { error: recipientsError } = await supabase
          .from("convocation_recipients")
          .insert(recipients);
        if (recipientsError) throw recipientsError;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convocations"] });
      toast.success("Convocation créée");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error("Erreur lors de la création");
    },
  });

  const updateResponse = useMutation({
    mutationFn: async ({ recipientId, response }: { recipientId: string; response: string }) => {
      const { error } = await supabase
        .from("convocation_recipients")
        .update({ 
          response, 
          response_date: new Date().toISOString() 
        })
        .eq("id", recipientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convocations"] });
      toast.success("Réponse enregistrée");
    },
  });

  const sendConvocation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("convocations")
        .update({ status: "sent" })
        .eq("id", id);
      if (error) throw error;

      // Mark all recipients as notified
      await supabase
        .from("convocation_recipients")
        .update({ notified_at: new Date().toISOString() })
        .eq("convocation_id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convocations"] });
      toast.success("Convocation envoyée");
    },
  });

  const deleteConvocation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("convocations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convocations"] });
      toast.success("Convocation supprimée");
      setViewingConvocation(null);
    },
  });

  const togglePlayer = (playerId: string) => {
    if (selectedPlayers.includes(playerId)) {
      setSelectedPlayers(selectedPlayers.filter((id) => id !== playerId));
    } else {
      setSelectedPlayers([...selectedPlayers, playerId]);
    }
  };

  const getEventTypeInfo = (type: string) => {
    return EVENT_TYPES.find((t) => t.value === type) || EVENT_TYPES[0];
  };

  const getResponseStats = (recipients: any[]) => {
    const accepted = recipients?.filter((r) => r.response === "accepted").length || 0;
    const declined = recipients?.filter((r) => r.response === "declined").length || 0;
    const pending = recipients?.filter((r) => r.response === "pending").length || 0;
    const maybe = recipients?.filter((r) => r.response === "maybe").length || 0;
    return { accepted, declined, pending, maybe, total: recipients?.length || 0 };
  };

  const getResponseBadge = (response: string) => {
    switch (response) {
      case "accepted":
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />Accepté</Badge>;
      case "declined":
        return <Badge className="bg-red-100 text-red-700"><XCircle className="h-3 w-3 mr-1" />Décliné</Badge>;
      case "maybe":
        return <Badge className="bg-amber-100 text-amber-700"><HelpCircle className="h-3 w-3 mr-1" />Peut-être</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Convocations
          </h3>
          <p className="text-sm text-muted-foreground">
            Envoyez des convocations aux joueurs et suivez les réponses
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle convocation
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Chargement...
          </CardContent>
        </Card>
      ) : convocations && convocations.length > 0 ? (
        <div className="grid gap-4">
          {convocations.map((convocation) => {
            const typeInfo = getEventTypeInfo(convocation.event_type);
            const stats = getResponseStats(convocation.convocation_recipients);
            
            return (
              <Card 
                key={convocation.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setViewingConvocation(convocation)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg">{typeInfo.icon}</span>
                        <h4 className="font-semibold">{convocation.name}</h4>
                        {convocation.status === "draft" && (
                          <Badge variant="outline">Brouillon</Badge>
                        )}
                        {convocation.status === "sent" && (
                          <Badge className="bg-blue-100 text-blue-700">Envoyée</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(convocation.event_date), "EEEE d MMMM", { locale: fr })}
                          {convocation.event_time && ` à ${convocation.event_time.slice(0, 5)}`}
                        </span>
                        {convocation.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {convocation.location}
                          </span>
                        )}
                      </div>
                      {/* Response stats */}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="gap-1">
                          <Users className="h-3 w-3" />
                          {stats.total}
                        </Badge>
                        {stats.accepted > 0 && (
                          <Badge className="bg-green-100 text-green-700">
                            ✓ {stats.accepted}
                          </Badge>
                        )}
                        {stats.declined > 0 && (
                          <Badge className="bg-red-100 text-red-700">
                            ✗ {stats.declined}
                          </Badge>
                        )}
                        {stats.pending > 0 && (
                          <Badge variant="outline">
                            ? {stats.pending}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {convocation.status === "draft" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sendConvocation.mutate(convocation.id)}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Envoyer
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => deleteConvocation.mutate(convocation.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Aucune convocation créée</p>
            <Button className="mt-4" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Créer une convocation
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Nouvelle convocation</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Titre *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Convocation match J5"
                />
              </div>
              <div className="space-y-2">
                <Label>Type d'événement</Label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date limite de réponse</Label>
                <Input
                  type="date"
                  value={responseDeadline}
                  onChange={(e) => setResponseDeadline(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Date de l'événement *</Label>
                <Input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Heure</Label>
                <Input
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Lieu</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Adresse ou nom du lieu"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Informations complémentaires..."
                  rows={2}
                />
              </div>
            </div>

            {/* Player selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Joueurs convoqués</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedPlayers(players?.map((p) => p.id) || [])}
                  >
                    Tous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedPlayers([])}
                  >
                    Aucun
                  </Button>
                </div>
              </div>
              <Card>
                <ScrollArea className="h-[200px] p-3">
                  <div className="grid grid-cols-2 gap-2">
                    {players?.map((player) => (
                      <div
                        key={player.id}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                          selectedPlayers.includes(player.id)
                            ? "bg-primary/10"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => togglePlayer(player.id)}
                      >
                        <Checkbox
                          checked={selectedPlayers.includes(player.id)}
                          onCheckedChange={() => togglePlayer(player.id)}
                        />
                        <span className="font-medium text-sm">{player.name}</span>
                        {player.position && (
                          <Badge variant="outline" className="text-xs ml-auto">
                            {player.position}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </Card>
              <p className="text-sm text-muted-foreground">
                {selectedPlayers.length} joueur(s) sélectionné(s)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={() => saveConvocation.mutate()}
              disabled={!name || !eventDate || selectedPlayers.length === 0 || saveConvocation.isPending}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Convocation Dialog */}
      <Dialog open={!!viewingConvocation} onOpenChange={() => setViewingConvocation(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{getEventTypeInfo(viewingConvocation?.event_type).icon}</span>
              {viewingConvocation?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {viewingConvocation && format(new Date(viewingConvocation.event_date), "EEEE d MMMM yyyy", { locale: fr })}
                {viewingConvocation?.event_time && ` à ${viewingConvocation.event_time.slice(0, 5)}`}
              </span>
              {viewingConvocation?.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {viewingConvocation.location}
                </span>
              )}
            </div>

            {viewingConvocation?.description && (
              <p className="text-muted-foreground">{viewingConvocation.description}</p>
            )}

            <div className="space-y-2">
              <h4 className="font-medium">Réponses des joueurs</h4>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {viewingConvocation?.convocation_recipients?.map((recipient: any) => (
                    <div
                      key={recipient.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium">{recipient.players?.name}</p>
                        {recipient.response_date && (
                          <p className="text-xs text-muted-foreground">
                            Répondu le {format(new Date(recipient.response_date), "dd/MM à HH:mm")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {getResponseBadge(recipient.response)}
                        <Select
                          value={recipient.response}
                          onValueChange={(value) => updateResponse.mutate({ 
                            recipientId: recipient.id, 
                            response: value 
                          })}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">En attente</SelectItem>
                            <SelectItem value="accepted">Accepté</SelectItem>
                            <SelectItem value="declined">Décliné</SelectItem>
                            <SelectItem value="maybe">Peut-être</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingConvocation(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
