import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";
import { Search, UserPlus, Users, Settings2, Check, X, CircleHelp, Minus, ChevronDown, ArrowUpDown, Sparkles, Loader2 } from "lucide-react";
import { filterCompetitionParticipants, INITIAL_COMPETITION_PARTICIPANTS } from "@/lib/competitionParticipants";
import { buildParticipationRows, participationCounts, participationLabels, type ParticipationStatus, type ParticipationCorrection } from "@/lib/competitionParticipation";
import { toast } from "sonner";
import "@/styles/competition-participants.css";

interface Props { matchId: string; isIndividual: boolean; onManageInvitations: () => void; onManageLineup: () => void; }
function Status({status, label, secondary = false}: {status: ParticipationStatus; label: string; secondary?: boolean}) {
  const Icon = status === "present" ? Check : status === "absent" ? X : status === "to_verify" ? CircleHelp : Minus;
  return <span className="competition-status" data-status={status} data-secondary={secondary}><Icon className="h-3 w-3 shrink-0" />{label}</span>;
}
export function CompetitionParticipantsSection({matchId, isIndividual, onManageInvitations, onManageLineup}: Props) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<"all" | ParticipationStatus>("all");
  const [sort, setSort] = useState<{key: "name" | "category" | "participation"; descending: boolean}>({key:"name", descending:false});
  const {isViewer} = useViewerModeContext();
  const client = useQueryClient();
  const invitations = useQuery({queryKey:["match_participants",matchId], refetchInterval:15000, queryFn:async()=>{
    const {data,error} = await supabase.from("match_participants").select("player_id, attendance_status").eq("match_id",matchId); if(error) throw error; return data || [];
  }});
  const lineup = useQuery({queryKey:["match_lineup",matchId], refetchInterval:15000, queryFn:async()=>{
    const {data,error} = await supabase.from("match_lineups").select("*, players(id, name, first_name)").eq("match_id",matchId); if(error) throw error; return data || [];
  }});
  const effective = useQuery({queryKey:["competition-effective-participation",matchId], refetchInterval:15000, queryFn:async()=>{
    const [results, rounds, match, permission] = await Promise.all([
      supabase.from("competition_results").select("player_id, participation_status").eq("match_id",matchId),
      supabase.from("competition_rounds").select("player_id, result, final_time_seconds, ranking, competition_round_stats(id)").eq("match_id",matchId),
      supabase.from("matches").select("match_date, end_date").eq("id",matchId).single(),
      supabase.rpc("can_manage_competition_participation",{_match_id:matchId}),
    ]);
    if(results.error) throw results.error; if(rounds.error) throw rounds.error; if(match.error) throw match.error;
    return {corrections:results.data || [], rounds:rounds.data || [], date:match.data.match_date, canManage:permission.data === true};
  }});
  useEffect(()=>{
    const channel = supabase.channel(`participation-dashboard-${matchId}`);
    for(const table of ["match_participants","match_lineups","competition_rounds","competition_results"]) {
      channel.on("postgres_changes", {event:"*",schema:"public",table,filter:`match_id=eq.${matchId}`},()=>{
        void client.invalidateQueries({queryKey:["match_participants",matchId]});
        void client.invalidateQueries({queryKey:["match_lineup",matchId]});
        void client.invalidateQueries({queryKey:["competition-effective-participation",matchId]});
      });
    }
    channel.subscribe(); return ()=>{void supabase.removeChannel(channel);};
  },[matchId,client]);
  const ids = Array.from(new Set([...(invitations.data || []),...(lineup.data || []),...(effective.data?.rounds || []),...(effective.data?.corrections || [])].map(r=>r.player_id))).sort();
  const identities = useQuery({queryKey:["competition-participant-identities",ids], enabled:ids.length>0, queryFn:async()=>{
    const batches = [];
    for(let offset=0;offset<ids.length;offset+=200) {
      const {data,error} = await supabase.from("players_safe").select("id, name, first_name, avatar_url, discipline, specialty").in("id",ids.slice(offset,offset+200)); if(error) throw error; batches.push(...(data || []));
    } return batches;
  }});
  const future = (effective.data?.date || "") > new Date().toLocaleDateString("en-CA");
  const rows = buildParticipationRows(invitations.data || [],lineup.data || [],identities.data || [],effective.data?.rounds || [],effective.data?.corrections || [],isIndividual,future).map(row=>{
    const identity = identities.data?.find(p=>p.id===row.id);
    const clean = (value:string)=>value.replace(/^judo_/i,"").replace(/_/g," ");
    const category = row.disciplines.length ? row.disciplines.map(clean).join(", ") : [identity?.discipline,identity?.specialty].filter((v):v is string=>Boolean(v)).map(clean).join(" · ");
    return {...row,category:category || "—"};
  });
  const counts = participationCounts(rows);
  const confirmed = rows.filter(r=>r.invited && r.attendance === "present").length;
  const noResponse = rows.filter(r=>r.invited && (!r.attendance || r.attendance === "no_response")).length;
  const filtered = filterCompetitionParticipants(rows,search).filter(r=>filter === "all" || r.participation === filter).sort((a,b)=>{
    const first = sort.key === "participation" ? participationLabels[a.participation] : a[sort.key];
    const second = sort.key === "participation" ? participationLabels[b.participation] : b[sort.key];
    return first.localeCompare(second,"fr",{numeric:true,sensitivity:"base"}) * (sort.descending ? -1 : 1);
  });
  const visible = showAll ? filtered : filtered.slice(0,INITIAL_COMPETITION_PARTICIPANTS);
  const mutation = useMutation({mutationFn:async({playerId,status}:{playerId:string;status:ParticipationStatus})=>{
    const {error} = await supabase.rpc("set_competition_participation",{_match_id:matchId,_player_id:playerId,_status:status}); if(error) throw error;
  },onMutate:async({playerId,status})=>{
    await client.cancelQueries({queryKey:["competition-effective-participation",matchId]});
    const previous = client.getQueryData<typeof effective.data>(["competition-effective-participation",matchId]);
    if(previous) client.setQueryData(["competition-effective-participation",matchId],{...previous,corrections:[...previous.corrections.filter(r=>r.player_id!==playerId),{player_id:playerId,participation_status:status}] satisfies ParticipationCorrection[]});
    return {previous};
  },onError:(_error,_variables,context)=>{
    if(context?.previous) client.setQueryData(["competition-effective-participation",matchId],context.previous);
    toast.error("La participation n’a pas été enregistrée. Réessayez.");
  },onSuccess:()=>{toast.success("Participation enregistrée");},onSettled:()=>{void client.invalidateQueries({queryKey:["competition-effective-participation",matchId]});}});
  const loading = invitations.isPending || lineup.isPending || effective.isPending || (ids.length>0 && identities.isPending);
  const error = invitations.isError || lineup.isError || effective.isError || identities.isError;
  const canManage = !isViewer && effective.data?.canManage;
  const changeSort = (key:typeof sort.key)=>setSort(s=>({key,descending:s.key===key ? !s.descending : false}));
  const rsvp = (row:typeof rows[number])=> row.attendance === "present" ? <Status secondary status="present" label="Confirmée" /> : row.attendance === "absent" ? <Status secondary status="absent" label="Refusée" /> : row.attendance === "pending" ? <Status secondary status="to_verify" label="En attente" /> : <Status secondary status="unset" label={row.invited ? "Sans réponse" : "Non convoqué"} />;
  return <section className="mt-3 border-t border-border pt-3 space-y-2 min-w-0" aria-label="Participants à la compétition">
    <div className="flex items-center justify-between flex-wrap gap-2">
      <h5 className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4" />Participants à la compétition</h5>
      {!isViewer && <div className="flex gap-1.5 flex-wrap"><Button variant="outline" size="sm" className="h-9 gap-1" onClick={onManageInvitations}><UserPlus className="h-3.5 w-3.5" />{isIndividual ? "Ajouter / gérer" : "Convocations"}</Button>{!isIndividual && <Button variant="outline" size="sm" className="h-9 gap-1" onClick={onManageLineup}><Settings2 className="h-3.5 w-3.5" />Composition</Button>}</div>}
    </div>
    {!loading && !error && <div className="flex flex-wrap gap-x-3 gap-y-1 items-center" aria-live="polite">
      <span className="text-xs font-semibold">Participants : {counts.total}</span>
      <Status status="present" label={`Présents : ${counts.present}`} /><Status status="absent" label={`Absents : ${counts.absent}`} /><Status status="to_verify" label={`À vérifier : ${counts.to_verify}`} />{counts.unset>0 && <Status status="unset" label={`Non renseignés : ${counts.unset}`} />}
      <span className="text-[11px] text-muted-foreground">Convocations : {confirmed} confirmées · {noResponse} sans réponse</span>
    </div>}
    {rows.length>0 && <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-32 max-w-xs"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" /><Input aria-label="Rechercher un participant" placeholder="Nom ou prénom" value={search} onChange={e=>setSearch(e.target.value)} className="pl-8 h-9 text-xs" /></div>
      <div className="flex flex-wrap gap-1" aria-label="Filtrer la participation">{(["all","present","absent","to_verify"] as const).map(value=><Button key={value} variant="outline" size="sm" className="h-9 px-2 text-xs" aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value === "all" ? "Tous" : value === "present" ? "Présents" : value === "absent" ? "Absents" : "À vérifier"}</Button>)}</div>
    </div>}
    {error ? <div role="alert" className="text-sm text-destructive">Impossible de charger les participants. <Button variant="ghost" size="sm" onClick={()=>{void invitations.refetch();void lineup.refetch();void effective.refetch();if(ids.length)void identities.refetch();}}>Réessayer</Button></div> : loading ? <p role="status" className="text-xs text-muted-foreground">Chargement des participants…</p> : rows.length===0 ? <p className="text-xs text-muted-foreground py-2">Aucun participant pour le moment</p> : <>
      <table className="competition-participants-table"><thead><tr>{([['name','Athlète'],['category','Catégorie']] as const).map(([key,label])=><th key={key} scope="col" aria-sort={sort.key===key ? sort.descending ? "descending" : "ascending" : "none"}><Button variant="ghost" size="sm" className="h-7 px-1 text-xs gap-1" onClick={()=>changeSort(key)}>{label}<ArrowUpDown className="h-3 w-3" /></Button></th>)}<th scope="col" className="hidden sm:table-cell">Convocation</th><th scope="col" aria-sort={sort.key==='participation' ? sort.descending ? 'descending' : 'ascending' : 'none'}><Button variant="ghost" size="sm" className="h-7 px-1 text-xs gap-1" onClick={()=>changeSort('participation')}>Participation<ArrowUpDown className="h-3 w-3" /></Button></th></tr></thead>
      <tbody>{visible.map(row=><tr key={row.id}>
        <td><div className="flex items-center gap-1.5 min-w-0"><Avatar className="hidden md:flex h-5 w-5 shrink-0"><AvatarImage src={row.player?.avatar_url || undefined} alt="" /><AvatarFallback className="text-[9px]">{row.name.slice(0,2).toUpperCase()}</AvatarFallback></Avatar><span className="truncate font-medium" title={row.name}>{row.name}</span></div><details className="sm:hidden text-[10px] text-muted-foreground"><summary className="cursor-pointer">Convocation</summary>{rsvp(row)}</details></td>
        <td className="truncate" title={row.category}>{row.category}</td><td className="hidden sm:table-cell">{rsvp(row)}</td>
        <td>{canManage ? <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="competition-participation-trigger gap-0.5 max-w-full" aria-label={`Participation de ${row.name} : ${participationLabels[row.participation]}`} onClick={e=>e.stopPropagation()}><Status status={row.participation} label={participationLabels[row.participation]} />{mutation.isPending && mutation.variables?.playerId===row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3 shrink-0" />}</Button></DropdownMenuTrigger><DropdownMenuContent align="end">{(["present","absent","to_verify"] as const).map(status=><DropdownMenuItem key={status} onSelect={()=>{if(mutation.isPending){toast.info("Enregistrement en cours");return;}mutation.mutate({playerId:row.id,status});}}><Status status={status} label={participationLabels[status]} /></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu> : <Status status={row.participation} label={participationLabels[row.participation]} />}{row.automatic && <span title="Présence déduite de résultats individuels enregistrés" aria-label="Présence déduite automatiquement" className="inline-flex items-center text-muted-foreground ml-1 text-[9px]"><Sparkles className="h-3 w-3" /><span className="hidden lg:inline">Auto</span></span>}</td>
      </tr>)}</tbody></table>
      {filtered.length===0 && <p className="text-xs text-muted-foreground py-2">Aucun participant trouvé</p>}
      {filtered.length>INITIAL_COMPETITION_PARTICIPANTS && <Button variant="outline" className="w-full h-9 text-xs" onClick={()=>setShowAll(value=>!value)}>{showAll ? "Réduire la liste" : `Voir les ${filtered.length} participants`}</Button>}
    </>}
  </section>;
}
