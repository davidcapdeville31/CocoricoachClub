import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Award, Trash2, Plus, Medal, Trophy, Pencil, X } from "lucide-react";
import { toast } from "sonner";


interface MedalsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  categoryId: string;
  competitionName: string;
  competitionDate: string;
}

type MedalType = "gold" | "silver" | "bronze" | "ranking" | "title";

const MEDAL_TYPE_OPTIONS: { value: MedalType; label: string; icon: string }[] = [
  { value: "gold", label: "Or", icon: "🥇" },
  { value: "silver", label: "Argent", icon: "🥈" },
  { value: "bronze", label: "Bronze", icon: "🥉" },
  { value: "ranking", label: "Classement (place)", icon: "🏅" },
  { value: "title", label: "Titre personnalisé", icon: "🏆" },
];

export function MedalsDialog({
  open,
  onOpenChange,
  matchId,
  categoryId,
  competitionName,
  competitionDate,
}: MedalsDialogProps) {
  const queryClient = useQueryClient();
  const [medalType, setMedalType] = useState<MedalType>("gold");
  const [rank, setRank] = useState<string>("");
  const [customTitle, setCustomTitle] = useState("");
  const [teamLabel, setTeamLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [isCollective, setIsCollective] = useState(false);
  // editingKey: medal.id (single) or `group:${group_id}` (group). Null = create mode.
  const [editingKey, setEditingKey] = useState<string | null>(null);

  // Get all relevant match IDs: this match + any sub-matches (parent_match_id = matchId)
  const { data: relevantMatchIds = [] } = useQuery({
    queryKey: ["medal-relevant-match-ids", matchId],
    queryFn: async () => {
      const { data: subs } = await supabase
        .from("matches")
        .select("id")
        .eq("parent_match_id", matchId);
      return [matchId, ...(subs?.map((s) => s.id) || [])];
    },
    enabled: open,
  });

  // Fetch participants from player_match_stats + competition_rounds across all relevant matches
  const { data: participantIds = [] } = useQuery({
    queryKey: ["medal-participants", matchId, relevantMatchIds.join(",")],
    queryFn: async () => {
      if (relevantMatchIds.length === 0) return [];
      const ids = new Set<string>();
      const { data: pms } = await supabase
        .from("player_match_stats")
        .select("player_id")
        .in("match_id", relevantMatchIds);
      (pms || []).forEach((r: any) => r.player_id && ids.add(r.player_id));

      const { data: rounds } = await supabase
        .from("competition_rounds")
        .select("player_id")
        .in("match_id", relevantMatchIds);
      (rounds || []).forEach((r: any) => r.player_id && ids.add(r.player_id));

      return Array.from(ids);
    },
    enabled: open && relevantMatchIds.length > 0,
  });

  const { data: allPlayers } = useQuery({
    queryKey: ["players-for-medals", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Only show players who actually participated in this competition (or its sub-matches).
  // Fallback: if no participation data is recorded yet, show all (so the user is not blocked).
  const players = useMemo(() => {
    if (!allPlayers) return [];
    if (participantIds.length === 0) return allPlayers;
    const set = new Set(participantIds);
    return allPlayers.filter((p) => set.has(p.id));
  }, [allPlayers, participantIds]);

  const { data: medals } = useQuery({
    queryKey: ["match-medals", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_medals")
        .select("*, players(id, name, first_name)")
        .eq("match_id", matchId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const resetForm = () => {
    setMedalType("gold");
    setRank("");
    setCustomTitle("");
    setTeamLabel("");
    setNotes("");
    setSelectedPlayerIds([]);
    setIsCollective(false);
    setEditingKey(null);
  };

  // Reset when dialog closes
  useEffect(() => {
    if (!open) resetForm();
  }, [open]);

  const saveMedal = useMutation({
    mutationFn: async () => {
      if (selectedPlayerIds.length === 0) {
        throw new Error("Sélectionne au moins un athlète");
      }
      if (medalType === "ranking" && !rank) {
        throw new Error("Indique la place obtenue");
      }
      if (medalType === "title" && !customTitle.trim()) {
        throw new Error("Indique le titre");
      }

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      // EDIT: delete old rows for this medal then re-insert
      if (editingKey) {
        if (editingKey.startsWith("group:")) {
          const gid = editingKey.slice(6);
          const { error } = await supabase.from("player_medals").delete().eq("group_id", gid);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("player_medals").delete().eq("id", editingKey);
          if (error) throw error;
        }
      }

      const groupId = selectedPlayerIds.length > 1 ? crypto.randomUUID() : null;
      const rows = selectedPlayerIds.map((pid) => ({
        match_id: matchId,
        player_id: pid,
        category_id: categoryId,
        medal_type: medalType,
        rank: medalType === "ranking" ? parseInt(rank) : null,
        custom_title: customTitle.trim() || null,
        team_label: isCollective ? (teamLabel.trim() || null) : null,
        group_id: groupId,
        notes: notes.trim() || null,
        awarded_date: competitionDate.split("T")[0],
        created_by: userId,
      }));

      const { error } = await supabase.from("player_medals").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["match-medals", matchId] });
      queryClient.invalidateQueries({ queryKey: ["player-medals"] });
      toast.success(editingKey ? "Médaille mise à jour" : "Médaille ajoutée au palmarès");
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message || "Erreur"),
  });

  const deleteMedal = useMutation({
    mutationFn: async (medal: { id: string; group_id: string | null }) => {
      const query = supabase.from("player_medals").delete();
      if (medal.group_id) {
        const { error } = await query.eq("group_id", medal.group_id);
        if (error) throw error;
      } else {
        const { error } = await query.eq("id", medal.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["match-medals", matchId] });
      queryClient.invalidateQueries({ queryKey: ["player-medals"] });
      toast.success("Médaille supprimée");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const togglePlayer = (pid: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]
    );
  };

  const startEdit = (group: { kind: "group" | "single"; items: any[] }) => {
    const first = group.items[0];
    setEditingKey(group.kind === "group" ? `group:${first.group_id}` : first.id);
    setMedalType(first.medal_type);
    setRank(first.rank ? String(first.rank) : "");
    setCustomTitle(first.custom_title || "");
    setTeamLabel(first.team_label || "");
    setNotes(first.notes || "");
    setIsCollective(group.items.length > 1 || !!first.team_label);
    setSelectedPlayerIds(group.items.map((m: any) => m.player_id));
  };

  const groupedMedals = (() => {
    if (!medals) return [];
    const groups = new Map<string, typeof medals>();
    const singles: typeof medals = [];
    for (const m of medals) {
      if (m.group_id) {
        if (!groups.has(m.group_id)) groups.set(m.group_id, []);
        groups.get(m.group_id)!.push(m);
      } else {
        singles.push(m);
      }
    }
    return [
      ...Array.from(groups.values()).map((arr) => ({ kind: "group" as const, items: arr })),
      ...singles.map((s) => ({ kind: "single" as const, items: [s] })),
    ];
  })();

  const getMedalIcon = (type: string) => {
    const opt = MEDAL_TYPE_OPTIONS.find((o) => o.value === type);
    return opt?.icon || "🏅";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Médailles & Palmarès
          </DialogTitle>
          <DialogDescription>
            {competitionName} — Récompenses pour cette compétition
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-4">
          <div className="space-y-6 pb-4">
            {groupedMedals.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Médailles attribuées ({groupedMedals.length})
                </h3>
                <div className="space-y-2">
                  {groupedMedals.map((g, idx) => {
                    const first = g.items[0];
                    const editKey = g.kind === "group" ? `group:${first.group_id}` : first.id;
                    const isBeingEdited = editingKey === editKey;
                    return (
                      <div
                        key={idx}
                        className={`flex items-start justify-between gap-3 p-3 rounded-lg border bg-card ${
                          isBeingEdited ? "ring-2 ring-primary" : ""
                        }`}
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-2xl">{getMedalIcon(first.medal_type)}</span>
                            <span className="font-semibold">
                              {first.medal_type === "ranking"
                                ? `${first.rank}ᵉ place`
                                : first.medal_type === "title"
                                ? first.custom_title
                                : MEDAL_TYPE_OPTIONS.find((o) => o.value === first.medal_type)?.label}
                            </span>
                            {first.custom_title && first.medal_type !== "title" && (
                              <Badge variant="outline" className="text-xs">
                                {first.custom_title}
                              </Badge>
                            )}
                            {first.team_label && (
                              <Badge variant="secondary" className="text-xs">
                                {first.team_label}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {g.items
                              .map((m: any) =>
                                [m.players?.first_name, m.players?.name].filter(Boolean).join(" ")
                              )
                              .join(", ")}
                          </p>
                          {first.notes && (
                            <p className="text-xs text-muted-foreground italic">{first.notes}</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEdit(g)}
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() =>
                              deleteMedal.mutate({ id: first.id, group_id: first.group_id })
                            }
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-4 p-4 rounded-lg border-2 border-dashed">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  {editingKey ? (
                    <>
                      <Pencil className="h-4 w-4" />
                      Modifier la médaille
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Ajouter une médaille
                    </>
                  )}
                </h3>
                {editingKey && (
                  <Button variant="ghost" size="sm" onClick={resetForm}>
                    <X className="h-3.5 w-3.5 mr-1" /> Annuler
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Type de récompense</Label>
                  <Select value={medalType} onValueChange={(v) => setMedalType(v as MedalType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEDAL_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.icon} {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {medalType === "ranking" && (
                  <div className="space-y-2">
                    <Label>Place obtenue</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Ex: 4"
                      value={rank}
                      onChange={(e) => setRank(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>
                  Titre personnalisé{" "}
                  {medalType === "title" ? (
                    <span className="text-destructive">*</span>
                  ) : (
                    <span className="text-muted-foreground">(optionnel)</span>
                  )}
                </Label>
                <Input
                  placeholder="Ex: Champion de France, Vainqueur tournoi X..."
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="collective"
                  checked={isCollective}
                  onCheckedChange={(c) => setIsCollective(!!c)}
                />
                <Label htmlFor="collective" className="text-sm cursor-pointer">
                  Médaille collective (doublette / équipe)
                </Label>
              </div>

              {isCollective && (
                <div className="space-y-2">
                  <Label>Nom du groupe (optionnel)</Label>
                  <Input
                    placeholder="Ex: Doublette Dupont/Martin, Équipe A..."
                    value={teamLabel}
                    onChange={(e) => setTeamLabel(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>
                  Athlète{isCollective ? "s bénéficiaires" : " bénéficiaire"}
                  {isCollective && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (sélectionne plusieurs athlètes)
                    </span>
                  )}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {participantIds.length > 0
                    ? `Seuls les athlètes ayant participé à cette compétition (${players.length}) sont listés.`
                    : "Aucune participation enregistrée — tous les athlètes de la catégorie sont affichés."}
                </p>
                <div className="max-h-40 overflow-y-auto rounded border p-2">
                  <div className="space-y-1">
                    {players.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Aucun athlète disponible.
                      </p>
                    ) : (
                      players.map((p) => (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 p-1.5 rounded hover:bg-accent cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedPlayerIds.includes(p.id)}
                            onCheckedChange={() => togglePlayer(p.id)}
                          />
                          <span className="text-sm">
                            {[p.first_name, p.name].filter(Boolean).join(" ")}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes (optionnel)</Label>
                <Textarea
                  placeholder="Détails, performance, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <Button
                className="w-full"
                onClick={() => saveMedal.mutate()}
                disabled={saveMedal.isPending}
              >
                <Trophy className="h-4 w-4 mr-2" />
                {editingKey ? "Mettre à jour la médaille" : "Ajouter au palmarès"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
