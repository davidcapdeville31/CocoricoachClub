import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Users, Search, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchCategoryRosterPlayers } from "@/lib/categoryRoster";
import {
  PLAYER_GROUP_COLORS,
  usePlayerGroups,
  usePlayerGroupMutations,
} from "@/hooks/usePlayerGroups";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
}

const formatName = (p: any) => {
  const last = String(p.name || "").trim().toUpperCase();
  const first = String(p.first_name || "").trim();
  return [last, first].filter(Boolean).join(" ") || "—";
};

export function PlayerGroupsManagerDialog({ open, onOpenChange, categoryId }: Props) {
  const { data: groups = [] } = usePlayerGroups(open ? categoryId : null);
  const { createGroup, updateGroup, deleteGroup, setMembers } =
    usePlayerGroupMutations(categoryId);

  const { data: players = [] } = useQuery({
    queryKey: ["player-groups-roster", categoryId],
    queryFn: () => fetchCategoryRosterPlayers(categoryId),
    enabled: open && !!categoryId,
  });

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PLAYER_GROUP_COLORS[0]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [draftMembers, setDraftMembers] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) || null,
    [groups, selectedGroupId],
  );

  useEffect(() => {
    if (!open) {
      setSelectedGroupId(null);
      setSearch("");
      setNewName("");
    }
  }, [open]);

  useEffect(() => {
    if (selectedGroup) {
      setDraftMembers(selectedGroup.playerIds);
      setRenameValue(selectedGroup.name);
    }
  }, [selectedGroup?.id, selectedGroup?.playerIds.join(",")]);

  const sortedPlayers = useMemo(() => {
    const list = (players as any[]).map((p) => ({ id: p.id as string, label: formatName(p) }));
    list.sort((a, b) => a.label.localeCompare(b.label, "fr"));
    const q = search.trim().toLowerCase();
    return q ? list.filter((p) => p.label.toLowerCase().includes(q)) : list;
  }, [players, search]);

  const handleCreate = () => {
    if (!newName.trim()) {
      toast.error("Donne un nom au groupe");
      return;
    }
    createGroup.mutate(
      { name: newName, color: newColor },
      {
        onSuccess: (id) => {
          toast.success("Groupe créé");
          setNewName("");
          setSelectedGroupId(id);
        },
        onError: (e: any) =>
          toast.error(
            String(e?.message || "").includes("duplicate")
              ? "Un groupe porte déjà ce nom"
              : e?.message || "Erreur",
          ),
      },
    );
  };

  const handleSaveMembers = () => {
    if (!selectedGroupId) return;
    setMembers.mutate(
      { groupId: selectedGroupId, playerIds: draftMembers },
      {
        onSuccess: () => toast.success("Athlètes du groupe enregistrés"),
        onError: (e: any) => toast.error(e?.message || "Erreur"),
      },
    );
  };

  const toggleMember = (id: string) =>
    setDraftMembers((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto overscroll-contain">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Groupes d'athlètes
            </DialogTitle>
            <DialogDescription>
              Crée des groupes pour convoquer rapidement plusieurs athlètes lors des événements,
              tests ou séances.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-[260px_1fr]">
            {/* Liste des groupes */}
            <div className="space-y-3">
              <div className="space-y-2 rounded-xl border border-border bg-surface-sunken p-3">
                <Label className="text-xs">Nouveau groupe</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex : Groupe force"
                />
                <div className="flex flex-wrap gap-1.5">
                  {PLAYER_GROUP_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-transform",
                        newColor === c ? "scale-110 border-foreground" : "border-transparent",
                      )}
                      style={{ backgroundColor: c }}
                      aria-label={`Couleur ${c}`}
                    />
                  ))}
                </div>
                <Button size="sm" className="w-full" onClick={handleCreate}>
                  <Plus className="mr-1 h-4 w-4" /> Créer
                </Button>
              </div>

              <div className="max-h-[320px] space-y-1 overflow-y-auto overscroll-contain touch-pan-y">
                {groups.map((g) => (
                  <div
                    key={g.id}
                    onClick={() => setSelectedGroupId(g.id)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 transition-colors",
                      selectedGroupId === g.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted/60",
                    )}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: g.color }}
                    />
                    <span className="flex-1 truncate text-sm">{g.name}</span>
                    <Badge variant="secondary" className="shrink-0">
                      {g.playerIds.length}
                    </Badge>
                  </div>
                ))}
                {groups.length === 0 && (
                  <p className="px-2 py-3 text-xs text-muted-foreground">
                    Aucun groupe pour le moment.
                  </p>
                )}
              </div>
            </div>

            {/* Edition du groupe sélectionné */}
            <div className="space-y-3">
              {!selectedGroup ? (
                <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Sélectionne un groupe pour choisir ses athlètes.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="max-w-[220px]"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {PLAYER_GROUP_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() =>
                            updateGroup.mutate({ id: selectedGroup.id, color: c })
                          }
                          className={cn(
                            "h-5 w-5 rounded-full border-2",
                            selectedGroup.color === c
                              ? "scale-110 border-foreground"
                              : "border-transparent",
                          )}
                          style={{ backgroundColor: c }}
                          aria-label={`Couleur ${c}`}
                        />
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateGroup.mutate(
                          { id: selectedGroup.id, name: renameValue },
                          {
                            onSuccess: () => toast.success("Groupe renommé"),
                            onError: (e: any) => toast.error(e?.message || "Erreur"),
                          },
                        )
                      }
                    >
                      Renommer
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setPendingDelete(selectedGroup.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Rechercher un athlète..."
                      className="pl-7"
                    />
                  </div>

                  <div className="max-h-[320px] space-y-1 overflow-y-auto overscroll-contain touch-pan-y rounded-xl border border-border bg-surface-sunken p-2">
                    {sortedPlayers.map((p) => (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60"
                      >
                        <Checkbox
                          checked={draftMembers.includes(p.id)}
                          onCheckedChange={() => toggleMember(p.id)}
                        />
                        <span className="text-sm">{p.label}</span>
                      </label>
                    ))}
                    {sortedPlayers.length === 0 && (
                      <p className="px-2 py-1 text-xs text-muted-foreground">Aucun athlète</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{draftMembers.length} athlète(s)</Badge>
                    <Button size="sm" onClick={handleSaveMembers}>
                      <Check className="mr-1 h-4 w-4" /> Enregistrer
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce groupe ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le groupe sera supprimé. Les athlètes eux-mêmes ne sont pas supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingDelete) return;
                deleteGroup.mutate(pendingDelete, {
                  onSuccess: () => {
                    toast.success("Groupe supprimé");
                    setSelectedGroupId(null);
                  },
                  onError: (e: any) => toast.error(e?.message || "Erreur"),
                });
                setPendingDelete(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
