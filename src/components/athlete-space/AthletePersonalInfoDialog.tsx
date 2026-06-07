import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Users, Mail, Phone, Calendar, MapPin, UserCircle2, Trophy, Cake, ShieldAlert } from "lucide-react";
import { useAthleteAttributes } from "@/hooks/useAthleteAttributes";
import { AthleteIdentityBadges } from "@/components/player/AthleteIdentityBadges";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId: string;
  categoryId: string;
  sportType?: string;
  playerName: string;
}

function computeAge(birthDate: string | null) {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function AthletePersonalInfoDialog({
  open,
  onOpenChange,
  playerId,
  categoryId,
  sportType,
  playerName,
}: Props) {
  const { data: personalInfo, isLoading: personalLoading } = useQuery({
    queryKey: ["athlete-personal-info-dialog", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select(`
          name,
          avatar_url,
          email,
          phone,
          birth_date,
          club_origin,
          fis_code,
          gender,
          parent_contact_1_name,
          parent_contact_1_phone,
          parent_contact_1_email,
          parent_contact_1_relation,
          parent_contact_2_name,
          parent_contact_2_phone,
          parent_contact_2_email,
          parent_contact_2_relation,
          dietary_requirements,
          allergies,
          medical_notes,
          emergency_notes
        `)
        .eq("id", playerId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: open && !!playerId,
  });

  const { data: coaches = [], isLoading: coachesLoading } = useQuery({
    queryKey: ["athlete-personal-info-dialog-coaches", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_coaches")
        .select("id, full_name, role, phone, email")
        .eq("player_id", playerId)
        .eq("category_id", categoryId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!playerId && !!categoryId,
  });

  const { data: attributes = [] } = useAthleteAttributes(open ? playerId : null);

  const age = useMemo(() => computeAge(personalInfo?.birth_date ?? null), [personalInfo?.birth_date]);

  const hasAdditionalInfo = Boolean(
    personalInfo?.parent_contact_1_name ||
      personalInfo?.parent_contact_2_name ||
      personalInfo?.dietary_requirements ||
      personalInfo?.allergies ||
      personalInfo?.medical_notes ||
      personalInfo?.emergency_notes,
  );

  const identityDimensions = useMemo(
    () => [...new Set(attributes.map((attribute) => attribute.dimension))],
    [attributes],
  );

  const isLoading = personalLoading || coachesLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Informations personnelles</DialogTitle>
          <DialogDescription>
            Vue simple de la fiche personnelle, de l'identité athlète, des informations complémentaires et des entraîneurs.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="bg-gradient-card shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <User className="h-5 w-5" />
                    Fiche personnelle
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col items-center gap-3 border-b pb-4">
                    <Avatar className="h-28 w-28">
                      <AvatarImage src={personalInfo?.avatar_url || undefined} alt={personalInfo?.name || playerName} />
                      <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
                        {getInitials(personalInfo?.name || playerName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                      <p className="font-semibold">{personalInfo?.name || playerName}</p>
                      {sportType ? <p className="text-sm text-muted-foreground">{sportType}</p> : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {personalInfo?.email ? (
                      <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <a href={`mailto:${personalInfo.email}`} className="text-sm hover:underline break-all">
                            {personalInfo.email}
                          </a>
                        </div>
                      </div>
                    ) : null}

                    {personalInfo?.phone ? (
                      <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Téléphone</p>
                          <a href={`tel:${personalInfo.phone}`} className="text-sm hover:underline">
                            {personalInfo.phone}
                          </a>
                        </div>
                      </div>
                    ) : null}

                    {personalInfo?.birth_date ? (
                      <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Date de naissance</p>
                          <p className="text-sm">{new Date(personalInfo.birth_date).toLocaleDateString("fr-FR")}</p>
                        </div>
                      </div>
                    ) : null}

                    {personalInfo?.club_origin ? (
                      <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Club d'origine</p>
                          <p className="text-sm">{personalInfo.club_origin}</p>
                        </div>
                      </div>
                    ) : null}

                    {personalInfo?.gender ? (
                      <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                        <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Genre</p>
                          <p className="text-sm">
                            {personalInfo.gender === "male" ? "Masculin" : personalInfo.gender === "female" ? "Féminin" : "Autre"}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {personalInfo?.fis_code ? (
                      <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                        <Trophy className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Code FIS</p>
                          <p className="text-sm font-mono">{personalInfo.fis_code}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {!personalInfo?.email &&
                  !personalInfo?.phone &&
                  !personalInfo?.birth_date &&
                  !personalInfo?.club_origin &&
                  !personalInfo?.gender &&
                  !personalInfo?.fis_code ? (
                    <p className="text-sm text-muted-foreground">Aucune information personnelle renseignée.</p>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="bg-gradient-card shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ShieldAlert className="h-5 w-5" />
                    Identité athlète
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {age !== null ? (
                      <Badge variant="secondary" className="gap-1.5">
                        <Cake className="h-3.5 w-3.5" />
                        {age} ans
                      </Badge>
                    ) : null}

                    {personalInfo?.gender ? (
                      <Badge variant="secondary" className="gap-1.5">
                        <UserCircle2 className="h-3.5 w-3.5" />
                        {personalInfo.gender === "male" ? "Masculin" : personalInfo.gender === "female" ? "Féminin" : "Autre"}
                      </Badge>
                    ) : null}
                  </div>

                  {identityDimensions.length > 0 ? (
                    <AthleteIdentityBadges playerId={playerId} dimensions={identityDimensions} className="gap-2" />
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucune identité athlète renseignée.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="bg-gradient-card shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5" />
                    Informations complémentaires
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {hasAdditionalInfo ? (
                    <>
                      {(personalInfo?.parent_contact_1_name || personalInfo?.parent_contact_2_name) ? (
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-muted-foreground">Contacts parentaux</h4>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {personalInfo?.parent_contact_1_name ? (
                              <div className="space-y-2 rounded-lg bg-muted/50 p-3">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{personalInfo.parent_contact_1_name}</span>
                                  {personalInfo.parent_contact_1_relation ? (
                                    <Badge variant="secondary" className="text-xs">{personalInfo.parent_contact_1_relation}</Badge>
                                  ) : null}
                                </div>
                                {personalInfo.parent_contact_1_phone ? (
                                  <a href={`tel:${personalInfo.parent_contact_1_phone}`} className="flex items-center gap-2 text-sm hover:underline">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    {personalInfo.parent_contact_1_phone}
                                  </a>
                                ) : null}
                                {personalInfo.parent_contact_1_email ? (
                                  <a href={`mailto:${personalInfo.parent_contact_1_email}`} className="flex items-center gap-2 text-sm hover:underline break-all">
                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                    {personalInfo.parent_contact_1_email}
                                  </a>
                                ) : null}
                              </div>
                            ) : null}

                            {personalInfo?.parent_contact_2_name ? (
                              <div className="space-y-2 rounded-lg bg-muted/50 p-3">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{personalInfo.parent_contact_2_name}</span>
                                  {personalInfo.parent_contact_2_relation ? (
                                    <Badge variant="secondary" className="text-xs">{personalInfo.parent_contact_2_relation}</Badge>
                                  ) : null}
                                </div>
                                {personalInfo.parent_contact_2_phone ? (
                                  <a href={`tel:${personalInfo.parent_contact_2_phone}`} className="flex items-center gap-2 text-sm hover:underline">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    {personalInfo.parent_contact_2_phone}
                                  </a>
                                ) : null}
                                {personalInfo.parent_contact_2_email ? (
                                  <a href={`mailto:${personalInfo.parent_contact_2_email}`} className="flex items-center gap-2 text-sm hover:underline break-all">
                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                    {personalInfo.parent_contact_2_email}
                                  </a>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {(personalInfo?.dietary_requirements || personalInfo?.allergies) ? (
                        <div className="space-y-2 rounded-lg bg-muted/50 p-3">
                          <h4 className="text-sm font-medium">Régime alimentaire</h4>
                          {personalInfo?.dietary_requirements ? <p className="text-sm">{personalInfo.dietary_requirements}</p> : null}
                          {personalInfo?.allergies ? (
                            <div className="flex items-start gap-2">
                              <Badge variant="destructive" className="text-xs">Allergies</Badge>
                              <p className="text-sm">{personalInfo.allergies}</p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {(personalInfo?.medical_notes || personalInfo?.emergency_notes) ? (
                        <div className="space-y-2 rounded-lg bg-muted/50 p-3">
                          <h4 className="text-sm font-medium">Notes médicales</h4>
                          {personalInfo?.medical_notes ? <p className="text-sm">{personalInfo.medical_notes}</p> : null}
                          {personalInfo?.emergency_notes ? (
                            <div className="border-t pt-2">
                              <Badge variant="outline" className="mb-2 border-destructive text-destructive">Urgence</Badge>
                              <p className="text-sm">{personalInfo.emergency_notes}</p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucune information complémentaire renseignée.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gradient-card shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5" />
                    Entraîneurs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {coaches.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                      {coaches.map((coach) => (
                        <div key={coach.id} className="space-y-2 rounded-lg bg-muted/50 p-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{coach.full_name}</span>
                            {coach.role ? <Badge variant="secondary" className="text-xs">{coach.role}</Badge> : null}
                          </div>
                          {coach.phone ? (
                            <a href={`tel:${coach.phone}`} className="flex items-center gap-2 text-sm hover:underline">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {coach.phone}
                            </a>
                          ) : null}
                          {coach.email ? (
                            <a href={`mailto:${coach.email}`} className="flex items-center gap-2 text-sm hover:underline break-all">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {coach.email}
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun entraîneur renseigné.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}