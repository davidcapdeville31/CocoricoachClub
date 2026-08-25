import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
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
import { AthleteIdentityBadges } from "@/components/player/AthleteIdentityBadges";
import { useSeasonGuard } from "@/hooks/use-season-guard";

interface ConvocationsSectionProps {
  categoryId: string;
}

function getEventTypes() {
  return [
    { value: "match", label: i18n.t("adminRecruitDocs.convocations.eventTypes.match"), icon: "🏆" },
    { value: "training", label: i18n.t("adminRecruitDocs.convocations.eventTypes.training"), icon: "⚽" },
    { value: "tournament", label: i18n.t("adminRecruitDocs.convocations.eventTypes.tournament"), icon: "🎯" },
    { value: "gathering", label: i18n.t("adminRecruitDocs.convocations.eventTypes.gathering"), icon: "👥" },
    { value: "meeting", label: i18n.t("adminRecruitDocs.convocations.eventTypes.meeting"), icon: "📋" },
  ];
}

export function ConvocationsSection({ categoryId }: ConvocationsSectionProps) {
  const { t } = useTranslation();
  const EVENT_TYPES = getEventTypes();
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
  const guard = useSeasonGuard(categoryId);

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
      if (!guard.assertDate(eventDate)) throw new Error("guard:date");
      if (selectedPlayers.length > 0 && !guard.assertPlayers(selectedPlayers)) throw new Error("guard:players");
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
      toast.success(t("adminRecruitDocs.convocations.toasts.convocationCreated"));
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      if (typeof err?.message === "string" && err.message.startsWith("guard:")) return;
      toast.error(t("adminRecruitDocs.convocations.toasts.createError"));
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
      toast.success(t("adminRecruitDocs.convocations.toasts.responseRecorded"));
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
      toast.success(t("adminRecruitDocs.convocations.toasts.convocationSent"));
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
      toast.success(t("adminRecruitDocs.convocations.toasts.convocationDeleted"));
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
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />{t("adminRecruitDocs.convocations.responseAccepted")}</Badge>;
      case "declined":
        return <Badge className="bg-red-100 text-red-700"><XCircle className="h-3 w-3 mr-1" />{t("adminRecruitDocs.convocations.responseDeclined")}</Badge>;
      case "maybe":
        return <Badge className="bg-amber-100 text-amber-700"><HelpCircle className="h-3 w-3 mr-1" />{t("adminRecruitDocs.convocations.responseMaybe")}</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{t("adminRecruitDocs.convocations.responsePending")}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            {t("adminRecruitDocs.convocations.title")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("adminRecruitDocs.convocations.subtitle")}
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          {t("adminRecruitDocs.convocations.newConvocation")}
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t("adminRecruitDocs.convocations.loading")}
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
                          <Badge variant="outline">{t("adminRecruitDocs.convocations.draft")}</Badge>
                        )}
                        {convocation.status === "sent" && (
                          <Badge className="bg-blue-100 text-blue-700">{t("adminRecruitDocs.convocations.sent")}</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(convocation.event_date), "EEEE d MMMM", { locale: getDateLocale() })}
                          {convocation.event_time && t("adminRecruitDocs.convocations.atTime", { time: convocation.event_time.slice(0, 5) })}
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
                          {t("adminRecruitDocs.convocations.send")}
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
            <p>{t("adminRecruitDocs.convocations.noConvocation")}</p>
            <Button className="mt-4" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {t("adminRecruitDocs.convocations.createConvocation")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("adminRecruitDocs.convocations.newConvocationTitle")}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>{t("adminRecruitDocs.convocations.titleLabel")}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("adminRecruitDocs.convocations.titlePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("adminRecruitDocs.convocations.eventTypeLabel")}</Label>
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
                <Label>{t("adminRecruitDocs.convocations.responseDeadline")}</Label>
                <Input
                  type="date"
                  value={responseDeadline}
                  onChange={(e) => setResponseDeadline(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("adminRecruitDocs.convocations.eventDate")}</Label>
                <Input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("adminRecruitDocs.convocations.time")}</Label>
                <Input
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>{t("adminRecruitDocs.convocations.location")}</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={t("adminRecruitDocs.convocations.locationPlaceholder")}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>{t("adminRecruitDocs.convocations.description")}</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("adminRecruitDocs.convocations.descriptionPlaceholder")}
                  rows={2}
                />
              </div>
            </div>

            {/* Player selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("adminRecruitDocs.convocations.convokedPlayers")}</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedPlayers(players?.map((p) => p.id) || [])}
                  >
                    {t("adminRecruitDocs.convocations.all")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedPlayers([])}
                  >
                    {t("adminRecruitDocs.convocations.none")}
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
                        <div className="flex items-center gap-1 ml-auto flex-wrap justify-end">
                          {player.position && (
                            <Badge variant="outline" className="text-xs">
                              {player.position}
                            </Badge>
                          )}
                          <AthleteIdentityBadges playerId={player.id} dimensions={["position"]} />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </Card>
              <p className="text-sm text-muted-foreground">
                {t("adminRecruitDocs.convocations.playersSelected", { count: selectedPlayers.length })}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t("adminRecruitDocs.convocations.cancel")}
            </Button>
            <Button 
              onClick={() => saveConvocation.mutate()}
              disabled={!name || !eventDate || selectedPlayers.length === 0 || saveConvocation.isPending}
            >
              {t("adminRecruitDocs.convocations.create")}
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
                {viewingConvocation && format(new Date(viewingConvocation.event_date), "EEEE d MMMM yyyy", { locale: getDateLocale() })}
                {viewingConvocation?.event_time && t("adminRecruitDocs.convocations.atTime", { time: viewingConvocation.event_time.slice(0, 5) })}
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
              <h4 className="font-medium">{t("adminRecruitDocs.convocations.playerResponses")}</h4>
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
                            {t("adminRecruitDocs.convocations.respondedOn", { date: format(new Date(recipient.response_date), "dd/MM à HH:mm") })}
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
                            <SelectItem value="pending">{t("adminRecruitDocs.convocations.responsePending")}</SelectItem>
                            <SelectItem value="accepted">{t("adminRecruitDocs.convocations.responseAccepted")}</SelectItem>
                            <SelectItem value="declined">{t("adminRecruitDocs.convocations.responseDeclined")}</SelectItem>
                            <SelectItem value="maybe">{t("adminRecruitDocs.convocations.responseMaybe")}</SelectItem>
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
              {t("adminRecruitDocs.convocations.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
