import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";
import { Search, UserPlus, Users, Settings2 } from "lucide-react";
import { filterCompetitionParticipants, mergeCompetitionParticipants, INITIAL_COMPETITION_PARTICIPANTS } from "@/lib/competitionParticipants";

interface Props {
  matchId: string;
  isIndividual: boolean;
  onManageInvitations: () => void;
  onManageLineup: () => void;
}

export function CompetitionParticipantsSection({ matchId, isIndividual, onManageInvitations, onManageLineup }: Props) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const { isViewer } = useViewerModeContext();
  const invitations = useQuery({
    queryKey: ["match_participants", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("match_participants").select("player_id, attendance_status").eq("match_id", matchId);
      if (error) throw error;
      return data || [];
    },
  });
  const lineup = useQuery({
    queryKey: ["match_lineup", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("match_lineups").select("*, players(id, name, first_name)").eq("match_id", matchId);
      if (error) throw error;
      return data || [];
    },
  });
  const ids = Array.from(new Set([...(invitations.data || []), ...(lineup.data || [])].map((row) => row.player_id))).sort();
  const identities = useQuery({
    queryKey: ["competition-participant-identities", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const batches = [];
      for (let offset = 0; offset < ids.length; offset += 200) {
        const { data, error } = await supabase.from("players_safe").select("id, name, first_name, avatar_url, discipline, specialty").in("id", ids.slice(offset, offset + 200));
        if (error) throw error;
        batches.push(...(data || []));
      }
      return batches;
    },
  });
  const participants = mergeCompetitionParticipants(invitations.data || [], lineup.data || [], identities.data || []);
  const filtered = filterCompetitionParticipants(participants, search);
  const visible = showAll || search.trim() ? filtered : filtered.slice(0, INITIAL_COMPETITION_PARTICIPANTS);
  const loading = invitations.isPending || lineup.isPending || (ids.length > 0 && identities.isPending);
  const error = invitations.isError || lineup.isError || identities.isError;

  return (
    <section className="mt-4 border-t border-border pt-4 space-y-3 min-w-0" aria-label="Participants à la compétition">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h5 className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 shrink-0" />Participants à la compétition {loading ? "" : `(${participants.length})`}</h5>
        {!isViewer && <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="min-h-10 gap-1.5" onClick={onManageInvitations}><UserPlus className="h-4 w-4" />{isIndividual ? "Ajouter / gérer" : "Convocations"}</Button>
          {!isIndividual && <Button variant="outline" size="sm" className="min-h-10 gap-1.5" onClick={onManageLineup}><Settings2 className="h-4 w-4" />Composition</Button>}
        </div>}
      </div>
      {participants.length > 0 && <div className="relative max-w-sm">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input aria-label="Rechercher un participant" placeholder="Nom ou prénom" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
      </div>}
      {error ? <div role="alert" className="text-sm text-destructive">Impossible de charger les participants. <Button variant="ghost" size="sm" onClick={() => { void invitations.refetch(); void lineup.refetch(); if (ids.length > 0) void identities.refetch(); }}>Réessayer</Button></div>
        : loading ? <p role="status" className="text-sm text-muted-foreground">Chargement des participants…</p>
        : participants.length === 0 ? <p className="text-sm text-muted-foreground py-2">Aucun participant pour le moment</p>
        : filtered.length === 0 ? <p className="text-sm text-muted-foreground">Aucun participant trouvé</p>
        : <ul className="divide-y divide-border">
          {visible.map((participant) => {
            const identity = identities.data?.find((player) => player.id === participant.id);
            const cleanLabel = (value: string) => value.replace(/^judo_/i, "").replace(/_/g, " ");
            const discipline = [identity?.discipline, identity?.specialty].filter((value): value is string => !!value).map(cleanLabel).join(" · ");
            return <li key={participant.id} className="flex items-center gap-3 py-2.5 min-w-0">
              <Avatar className="h-9 w-9 shrink-0"><AvatarImage src={participant.player?.avatar_url || undefined} alt="" /><AvatarFallback className="text-xs">{participant.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium break-words">{participant.name}</p>
                <div className="flex gap-1 flex-wrap">
                  {participant.invited && <Badge variant="outline" className="text-[10px] text-foreground">Convoqué</Badge>}
                  {participant.composed && <Badge variant="outline" className="text-[10px] bg-muted text-foreground">{isIndividual ? "Inscrit" : "Composition"}</Badge>}
                  {participant.attendance && <Badge variant="outline" data-attendance={participant.attendance} className="text-[10px] text-foreground">{participant.attendance === "present" ? "Présent" : participant.attendance === "absent" ? "Absent" : "Sans réponse"}</Badge>}
                </div>
                {(participant.disciplines.length > 0 || discipline) && <p className="text-xs text-muted-foreground break-words">{participant.disciplines.length > 0 ? participant.disciplines.map(cleanLabel).join(", ") : discipline}</p>}
              </div>
            </li>;
          })}
        </ul>}
      {!search.trim() && participants.length > INITIAL_COMPETITION_PARTICIPANTS && <Button variant="ghost" className="w-full min-h-10" onClick={() => setShowAll((value) => !value)}>{showAll ? "Réduire la liste" : `Voir tous les participants (${participants.length})`}</Button>}
    </section>
  );
}