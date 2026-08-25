import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useTranslation } from "react-i18next";
import { useState, useMemo, useCallback } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Filter, Eye, Copy, Check, Mail, RefreshCw, FileSpreadsheet, Link2, ClipboardCopy, Archive, ArchiveRestore, CopyPlus, Search, ArrowDownAZ, Pencil } from "lucide-react";
import { fetchCategoryRosterPlayers } from "@/lib/categoryRoster";
import { format } from "date-fns";
import { toast } from "sonner";
import { AddPlayerDialogWithInvite } from "./AddPlayerDialogWithInvite";
import { BulkAddPlayersDialog } from "./BulkAddPlayersDialog";
import { LinkExistingPlayerDialog } from "./LinkExistingPlayerDialog";
import { DuplicatePlayerToCategoryDialog } from "./DuplicatePlayerToCategoryDialog";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";
import { useViewerPlayers } from "@/hooks/use-viewer-data";
import { getDisciplineLabel, getSpecialtyLabel } from "@/lib/constants/athleticProfiles";
import { isAthletismeCategory, isJudoCategory, isIndividualSport, isSkiCategory, isSurfCategory, isTriathlonCategory, isNatationCategory, ATHLETISME_SPECIALTIES, NATATION_SPECIALTIES } from "@/lib/constants/sportTypes";
import { getPositionsForSport } from "@/lib/constants/sportPositions";
import { getInvitationStatus } from "@/hooks/useResendInvitation";

import { AVIRON_ROLES } from "@/lib/constants/sportTypes";
import { AthleteIdentityBadges } from "@/components/player/AthleteIdentityBadges";
import { getAppBaseUrl } from "@/lib/appUrl";

function getAvironRoleLabel(role: string | null): string {
  if (!role) return "";
  const found = AVIRON_ROLES.find(r => r.value === role);
  return found ? found.label : role;
}

function PlayerInfoHover({ player, isSki }: { player: any; isSki: boolean }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    first_name: player.first_name || "",
    name: player.name || "",
    birth_date: player.birth_date || "",
    email: player.email || "",
    phone: player.phone || "",
    fis_code: player.fis_code || "",
  });
  const queryClient = useQueryClient();

  const infoLines: { label: string; value: string }[] = [];
  
  const fullName = player.first_name ? `${player.first_name} ${player.name}` : player.name;
  infoLines.push({ label: t("roster.playerInfoHover.fields.name"), value: fullName });

  if (player.birth_date) {
    infoLines.push({ label: t("roster.playerInfoHover.fields.birthDate"), value: format(new Date(player.birth_date), "dd/MM/yyyy") });
  }
  if (player.email) {
    infoLines.push({ label: t("roster.playerInfoHover.fields.email"), value: player.email });
  }
  if (player.phone) {
    infoLines.push({ label: t("roster.playerInfoHover.fields.phone"), value: player.phone });
  }
  if (isSki && player.fis_code) {
    infoLines.push({ label: t("roster.playerInfoHover.fields.fisCode"), value: player.fis_code });
  }
  if (isSki && player.fis_points != null && player.fis_points > 0) {
    infoLines.push({ label: t("roster.playerInfoHover.fields.fisPoints"), value: String(player.fis_points) });
  }
  if (isSki && player.fis_ranking != null) {
    infoLines.push({ label: t("roster.playerInfoHover.fields.fisRanking"), value: String(player.fis_ranking) });
  }
  if (player.position) {
    infoLines.push({ label: t("roster.playerInfoHover.fields.position"), value: player.position });
  }
  if (player.discipline) {
    infoLines.push({ label: t("roster.playerInfoHover.fields.discipline"), value: getDisciplineLabel(player.discipline) });
  }

  const copyAll = () => {
    const text = infoLines.map(l => `${l.label}: ${l.value}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(t("roster.playerInfoHover.toasts.copied"));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = async () => {
    const updates: Record<string, unknown> = {};
    if (editData.name.trim() && editData.name !== player.name) updates.name = editData.name.trim();
    if (editData.first_name !== (player.first_name || "")) updates.first_name = editData.first_name.trim() || null;
    if (editData.birth_date) updates.birth_date = editData.birth_date;
    if (editData.email !== player.email) updates.email = editData.email || null;
    if (editData.phone !== player.phone) updates.phone = editData.phone || null;
    if (isSki && editData.fis_code !== player.fis_code) updates.fis_code = editData.fis_code || null;

    if (Object.keys(updates).length === 0) {
      setEditing(false);
      return;
    }

    const { error } = await supabase.from("players").update(updates as any).eq("id", player.id);
    if (error) {
      toast.error(t("roster.playerInfoHover.toasts.updateError"));
      return;
    }
    toast.success(t("roster.playerInfoHover.toasts.updated"));
    queryClient.invalidateQueries({ queryKey: ["players"] });
    setEditing(false);
  };

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          aria-label={t("roster.playerInfoHover.editAriaLabel")}
          onClick={(e) => e.stopPropagation()}
        >
          <Pencil className="h-4 w-4 text-muted-foreground" />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{t("roster.playerInfoHover.title")}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => {
                setEditData({
                  first_name: player.first_name || "",
                  name: player.name || "",
                  birth_date: player.birth_date || "",
                  email: player.email || "",
                  phone: player.phone || "",
                  fis_code: player.fis_code || "",
                });
                setEditing(!editing);
              }}>
                {editing ? t("roster.playerInfoHover.cancel") : t("roster.playerInfoHover.edit")}
              </Button>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={copyAll}>
                {copied ? <Check className="h-3 w-3" /> : <ClipboardCopy className="h-3 w-3" />}
                {copied ? t("roster.playerInfoHover.copied") : t("roster.playerInfoHover.copy")}
              </Button>
            </div>
          </div>
          
          {editing ? (
            <div className="space-y-2">
              <div>
                <Label className="text-xs">{t("roster.playerInfoHover.editLabels.firstName")}</Label>
                <Input value={editData.first_name} onChange={(e) => setEditData({...editData, first_name: e.target.value})} className="h-8 text-xs" placeholder={t("roster.playerInfoHover.placeholders.firstName")} />
              </div>
              <div>
                <Label className="text-xs">{t("roster.playerInfoHover.editLabels.lastName")}</Label>
                <Input value={editData.name} onChange={(e) => setEditData({...editData, name: e.target.value})} className="h-8 text-xs" placeholder={t("roster.playerInfoHover.placeholders.lastName")} />
              </div>
              <div>
                <Label className="text-xs">{t("roster.playerInfoHover.editLabels.birthDate")}</Label>
                <Input type="date" value={editData.birth_date} onChange={(e) => setEditData({...editData, birth_date: e.target.value})} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">{t("roster.playerInfoHover.editLabels.email")}</Label>
                <Input value={editData.email} onChange={(e) => setEditData({...editData, email: e.target.value})} className="h-8 text-xs" placeholder={t("roster.playerInfoHover.placeholders.email")} />
              </div>
              <div>
                <Label className="text-xs">{t("roster.playerInfoHover.editLabels.phone")}</Label>
                <Input value={editData.phone} onChange={(e) => setEditData({...editData, phone: e.target.value})} className="h-8 text-xs" placeholder={t("roster.playerInfoHover.placeholders.phone")} />
              </div>
              {isSki && (
                <div>
                  <Label className="text-xs">{t("roster.playerInfoHover.editLabels.fisCode")}</Label>
                  <Input value={editData.fis_code} onChange={(e) => setEditData({...editData, fis_code: e.target.value})} className="h-8 text-xs" placeholder={t("roster.playerInfoHover.placeholders.fisCode")} />
                </div>
              )}
              <Button size="sm" className="w-full h-8 text-xs" onClick={handleSaveEdit}>{t("roster.playerInfoHover.save")}</Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {infoLines.map((line) => (
                <div key={line.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{line.label}</span>
                  <span className="font-medium text-right max-w-[160px] truncate">{line.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

interface PlayersTabProps {
  categoryId: string;
}

export function PlayersTab({ categoryId }: PlayersTabProps) {
  const { t } = useTranslation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [duplicatePlayer, setDuplicatePlayer] = useState<any | null>(null);
  const [disciplineFilter, setDisciplineFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "connected" | "pending">("all");
  const [sortOrder, setSortOrder] = useState<"az" | "za">("az");
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isViewer } = useViewerModeContext();
  const getPlayerProfilePath = useCallback(
    (playerId: string) => `/players/${playerId}?categoryId=${categoryId}`,
    [categoryId]
  );

  // In the effectif view we want to also see archived athletes (to reactivate them).
  // Other consumers of useViewerPlayers keep filtering archived out.
  const { data: allPlayers, isLoading } = useQuery({
    queryKey: ["players", categoryId, "roster", "with-archived"],
    queryFn: () => fetchCategoryRosterPlayers(categoryId, { includeArchived: true }),
    enabled: !!categoryId,
  });
  const players = allPlayers;

  // Fetch all athlete invitations for this category
  const { data: invitations } = useQuery({
    queryKey: ["athlete-invitations-list", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("athlete_invitations")
        .select("id, player_id, token, status, expires_at")
        .eq("category_id", categoryId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Group invitations by player_id (latest first)
  const invitationsByPlayer = useMemo(() => {
    const map = new Map<string, typeof invitations extends (infer T)[] | null ? T : never>();
    invitations?.forEach((inv) => {
      if (!map.has(inv.player_id)) {
        map.set(inv.player_id, inv);
      }
    });
    return map;
  }, [invitations]);

  // Fetch category to check sport type
  const { data: category } = useQuery({
    queryKey: ["category", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("rugby_type, club_id")
        .eq("id", categoryId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Determine if the current user can add/remove athletes.
  // Allowed: club owner, club admin/coach/administratif, category admin/coach/administratif.
  const { data: canManageAthletes = false } = useQuery({
    queryKey: ["can-manage-athletes", categoryId, (category as any)?.club_id],
    enabled: !!categoryId && !!(category as any)?.club_id,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const clubId = (category as any).club_id as string;

      const { data: ownedClub } = await supabase
        .from("clubs")
        .select("id")
        .eq("id", clubId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (ownedClub) return true;

      const { data: clubRoles } = await supabase
        .from("club_members")
        .select("role")
        .eq("club_id", clubId)
        .eq("user_id", user.id);
      if (clubRoles?.some((r: any) => r.role === "admin" || r.role === "coach" || r.role === "administratif")) return true;

      const { data: catRoles } = await supabase
        .from("category_members")
        .select("role")
        .eq("category_id", categoryId)
        .eq("user_id", user.id);
      const allowed = ["admin", "coach", "administratif"];
      return !!catRoles?.some((r: any) => allowed.includes(r.role));
    },
  });

  const sportType = category?.rugby_type || "XV";
  const isAthletics = isAthletismeCategory(sportType);
  const isJudo = isJudoCategory(sportType);
  const isSki = isSkiCategory(sportType);
  const isSurf = isSurfCategory(sportType);
  const isTriathlon = isTriathlonCategory(sportType);
  const isNatation = isNatationCategory(sportType);
  const isAviron = sportType.toLowerCase().includes("aviron");
  const isIndividual = isIndividualSport(sportType);
  
  // Determine which attribute column to show
  const showDiscipline = isAthletics || isJudo || isSki || isSurf || isTriathlon || isNatation;
  const showRole = isAviron;
  const showPosition = !isIndividual && !showDiscipline && !showRole;
  
  const attributeColumnLabel = isJudo 
    ? t("roster.playersTab.columns.attribute.weightCategory") 
    : showDiscipline
      ? t("roster.playersTab.columns.attribute.discipline")
      : isAviron 
        ? t("roster.playersTab.columns.attribute.role") 
        : t("roster.playersTab.columns.attribute.position");

  // Get positions for the sport (for dropdown display)
  const positions = useMemo(() => getPositionsForSport(sportType), [sportType]);
  const uniquePositionNames = useMemo(() => {
    const names = new Set(positions.map(p => p.name));
    return Array.from(names);
  }, [positions]);

  // Get unique disciplines/positions from players for filtering
  const availableFilters = useMemo(() => {
    if (!players) return [];
    if (showDiscipline) {
      const disciplines = new Set(
        players
          .map((p: any) => p.discipline)
          .filter((d: string | null) => d && d.length > 0)
      );
      return Array.from(disciplines) as string[];
    }
    if (showPosition) {
      const positions = new Set(
        players
          .map((p: any) => p.position)
          .filter((p: string | null) => p && p.length > 0)
      );
      return Array.from(positions) as string[];
    }
    return [];
  }, [players, showDiscipline, showPosition]);

  // Split players by archived state
  const archivedCount = useMemo(
    () => (players || []).filter((p: any) => !!p.archived_at).length,
    [players],
  );

  // Filter players
  const filteredPlayers = useMemo(() => {
    if (!players) return [];
    let list = players.filter((p: any) => (showArchived ? true : !p.archived_at));

    if (disciplineFilter !== "all") {
      if (showDiscipline) list = list.filter((p: any) => p.discipline === disciplineFilter);
      else if (showPosition) list = list.filter((p: any) => p.position === disciplineFilter);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((p: any) => {
        const full = `${p.first_name || ""} ${p.name || ""} ${p.name || ""} ${p.first_name || ""}`.toLowerCase();
        return full.includes(q);
      });
    }

    if (statusFilter !== "all") {
      list = list.filter((p: any) =>
        statusFilter === "connected" ? !!p.user_id : !p.user_id,
      );
    }

    const collator = new Intl.Collator("fr", { sensitivity: "base" });
    const sorted = [...list].sort((a: any, b: any) => {
      const an = `${a.first_name || ""} ${a.name || ""}`.trim();
      const bn = `${b.first_name || ""} ${b.name || ""}`.trim();
      return collator.compare(an, bn);
    });
    return sortOrder === "az" ? sorted : sorted.reverse();
  }, [players, disciplineFilter, showDiscipline, showPosition, showArchived, searchQuery, statusFilter, sortOrder]);


  const archivePlayer = useMutation({
    mutationFn: async ({ playerId, archive }: { playerId: string; archive: boolean }) => {
      const { error, count } = await supabase
        .from("players")
        .update({ archived_at: archive ? new Date().toISOString() : null } as any, { count: "exact" })
        .eq("id", playerId);
      if (error) throw error;
      if (!count || count === 0) throw new Error("PERMISSION_DENIED");
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
      queryClient.invalidateQueries({ queryKey: ["players", categoryId, "roster", "with-archived"] });
      toast.success(vars.archive ? t("roster.playersTab.toasts.archived") : t("roster.playersTab.toasts.unarchived"));
    },
    onError: (err: Error) => {
      if (err?.message === "PERMISSION_DENIED") {
        toast.error(t("roster.playersTab.toasts.archivePermissionDenied"));
      } else {
        toast.error(t("roster.playersTab.toasts.archiveError"));
      }
    },
  });

  const deletePlayer = useMutation({
    mutationFn: async (playerId: string) => {
      // Récupère le user_id lié (s'il existe) AVANT suppression pour purger OneSignal
      const { data: playerRow } = await supabase
        .from("players")
        .select("user_id, category_id")
        .eq("id", playerId)
        .maybeSingle();

      // Athlète multi-catégories ? On ne retire que le rattachement à CETTE catégorie
      const { data: links } = await supabase
        .from("player_categories")
        .select("id, category_id")
        .eq("player_id", playerId);

      const allCategoryIds = new Set<string>(
        [
          ...(links || []).map((l: any) => l.category_id as string),
          playerRow?.category_id as string | undefined,
        ].filter(Boolean) as string[]
      );

      if (allCategoryIds.size > 1 && allCategoryIds.has(categoryId)) {
        // Supprime uniquement le lien vers la catégorie courante
        const { error: linkError } = await supabase
          .from("player_categories")
          .delete()
          .eq("player_id", playerId)
          .eq("category_id", categoryId);
        if (linkError) throw linkError;

        // Si la catégorie courante était la catégorie principale, on bascule sur une autre
        if (playerRow?.category_id === categoryId) {
          const fallback = Array.from(allCategoryIds).find((c) => c !== categoryId);
          if (fallback) {
            const { error: updError } = await supabase
              .from("players")
              .update({ category_id: fallback })
              .eq("id", playerId);
            if (updError) throw updError;
          }
        }
        return { partial: true };
      }

      const { error, count } = await supabase
        .from("players")
        .delete({ count: "exact" })
        .eq("id", playerId);
      if (error) throw error;
      if (!count || count === 0) {
        throw new Error("PERMISSION_DENIED");
      }

      // Nettoyage OneSignal (best-effort, ne bloque pas la suppression)
      if (playerRow?.user_id) {
        try {
          await supabase.functions.invoke("delete-onesignal-user", {
            body: { user_id: playerRow.user_id },
          });
        } catch (err) {
          console.warn("[deletePlayer] OneSignal cleanup failed:", err);
        }
      }
      return { partial: false };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey?.[0];
          return typeof k === "string" && k.startsWith("players");
        },
      });
      queryClient.invalidateQueries({ queryKey: ["player-categories"] });
      toast.success(
        res?.partial
          ? t("roster.playersTab.toasts.deletedPartial")
          : t("roster.playersTab.toasts.deleted")
      );
    },
    onError: (err: Error) => {
      if (err?.message === "PERMISSION_DENIED") {
        toast.error(t("roster.playersTab.toasts.deletePermissionDenied"));
      } else {
        toast.error(t("roster.playersTab.toasts.deleteError"));
      }
    },
  });

  // Mutation pour mettre à jour la spécialité
  const updateSpecialty = useMutation({
    mutationFn: async ({ playerId, specialty }: { playerId: string; specialty: string }) => {
      const { error } = await supabase
        .from("players")
        .update({ specialty })
        .eq("id", playerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players", categoryId] });
      toast.success(t("roster.playersTab.toasts.specialtyUpdated"));
    },
    onError: () => {
      toast.error(t("roster.playersTab.toasts.specialtyUpdateError"));
    },
  });

  // Get display value for the attribute column
  const getAttributeDisplay = (player: any) => {
    if (showDiscipline) {
      if (!player.discipline) {
        return <span className="text-muted-foreground text-sm">—</span>;
      }
      // For athletics, show discipline + specialty (with inline edit)
      const disciplineLabel = getDisciplineLabel(player.discipline);
      const specialtyLabel = player.specialty ? getSpecialtyLabel(player.specialty) : null;
      const availableSpecialties = isAthletics && player.discipline 
        ? ATHLETISME_SPECIALTIES[player.discipline] || [] 
        : isNatation && player.discipline 
          ? NATATION_SPECIALTIES[player.discipline] || []
          : [];
      
      return (
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="outline" className="bg-primary/5">
            {disciplineLabel}
          </Badge>
          {(isAthletics || isNatation) && availableSpecialties.length > 0 && !isViewer ? (
            <Select 
              value={player.specialty || ""} 
              onValueChange={(val) => {
                updateSpecialty.mutate({ playerId: player.id, specialty: val });
              }}
            >
              <SelectTrigger 
                className="h-6 w-auto min-w-[80px] px-2 text-xs border-dashed"
                onClick={(e) => e.stopPropagation()}
              >
                <SelectValue placeholder={t("roster.playersTab.specialtyPlaceholder")} />
              </SelectTrigger>
              <SelectContent onClick={(e) => e.stopPropagation()}>
                {availableSpecialties.map((spec) => (
                  <SelectItem key={spec.value} value={spec.value}>
                    {spec.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : specialtyLabel ? (
            <Badge variant="secondary" className="font-normal">
              {specialtyLabel}
            </Badge>
          ) : null}
        </div>
      );
    }
    if (showRole) {
      return player.position ? (
        <Badge variant="outline" className="bg-accent text-accent-foreground">
          {getAvironRoleLabel(player.position)}
        </Badge>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      );
    }
    if (showPosition) {
      return (
        <div className="flex items-center gap-1 flex-wrap">
          {player.position ? (
            <Badge variant="secondary" className="font-normal">
              {player.position}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          )}
          <AthleteIdentityBadges playerId={player.id} dimensions={["position"]} />
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return <p className="text-muted-foreground">{t("roster.playersTab.loading")}</p>;
  }

  const hasAttributeColumn = showDiscipline || showPosition || showRole;
  const filterPlaceholder = showDiscipline 
    ? (isJudo ? t("roster.playersTab.filterPlaceholder.weightCategory") : t("roster.playersTab.filterPlaceholder.discipline"))
    : t("roster.playersTab.filterPlaceholder.position");

  return (
    <Card className="bg-gradient-card shadow-md">
      <CardHeader className="px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <CardTitle className="text-lg sm:text-xl">{t("roster.playersTab.title")}</CardTitle>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("roster.playersTab.searchPlaceholder")}
                className="pl-8"
              />
            </div>
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as any)}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <ArrowDownAZ className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="az">{t("roster.playersTab.sort.az")}</SelectItem>
                <SelectItem value="za">{t("roster.playersTab.sort.za")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-full sm:w-[170px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("roster.playersTab.status.all")}</SelectItem>
                <SelectItem value="connected">{t("roster.playersTab.status.connected")}</SelectItem>
                <SelectItem value="pending">{t("roster.playersTab.status.pending")}</SelectItem>
              </SelectContent>
            </Select>
            {hasAttributeColumn && availableFilters.length > 0 && (
              <Select value={disciplineFilter} onValueChange={setDisciplineFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={filterPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {showDiscipline 
                      ? (isJudo ? t("roster.playersTab.filterAll.weightCategories") : t("roster.playersTab.filterAll.disciplines"))
                      : t("roster.playersTab.filterAll.positions")}
                  </SelectItem>
                  {availableFilters.map((filter) => (
                    <SelectItem key={filter} value={filter}>
                      {showDiscipline ? getDisciplineLabel(filter) : filter}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {archivedCount > 0 && (
              <Button
                onClick={() => setShowArchived((v) => !v)}
                variant={showArchived ? "secondary" : "outline"}
                size="sm"
                className="gap-1.5"
              >
                <Archive className="h-4 w-4" />
                {showArchived ? t("roster.playersTab.archived.hide") : t("roster.playersTab.archived.show")} {t("roster.playersTab.archived.suffix")} ({archivedCount})
              </Button>
            )}
            {!isViewer && canManageAthletes && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button onClick={() => setIsLinkDialogOpen(true)} variant="outline" size="sm" className="gap-1.5 flex-1 sm:flex-none">
                  <Link2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("roster.playersTab.actions.link")}</span>
                </Button>
                <Button onClick={() => setIsBulkDialogOpen(true)} variant="outline" size="sm" className="gap-1.5 flex-1 sm:flex-none">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("roster.playersTab.actions.importExcel")}</span>
                </Button>
                <Button onClick={() => setIsAddDialogOpen(true)} size="sm" className="gap-1.5 flex-1 sm:flex-none">
                  <Plus className="h-4 w-4" />
                  <span>{t("roster.playersTab.actions.add")}</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">

        {filteredPlayers && filteredPlayers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              {disciplineFilter !== "all" 
                ? (showDiscipline 
                    ? (isJudo ? t("roster.playersTab.empty.weightCategory") : t("roster.playersTab.empty.discipline"))
                    : t("roster.playersTab.empty.position"))
                : t("roster.playersTab.empty.category")}
            </p>
            {!isViewer && canManageAthletes && disciplineFilter === "all" && (
              <Button onClick={() => setIsAddDialogOpen(true)} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                {t("roster.playersTab.actions.addFirst")}
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile : cartes empilées */}
            <div className="md:hidden space-y-2">
              {filteredPlayers?.map((player: any) => {
                const fullName = player.first_name 
                  ? `${player.first_name} ${player.name}` 
                  : player.name;
                const initials = fullName
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);
                const inv = invitationsByPlayer.get(player.id);
                const status = inv ? getInvitationStatus(inv.status, inv.expires_at) : null;
                const link = inv ? `${getAppBaseUrl()}/accept-athlete-invitation?token=${inv.token}` : "";

                const isArchived = !!player.archived_at;
                return (
                  <div
                    key={player.id}
                    className={`rounded-2xl border bg-card p-3 shadow-sm active:scale-[0.99] transition-transform cursor-pointer ${
                      isArchived
                        ? "border-l-4 border-l-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.08)]"
                        : ""
                    }`}

                    onClick={() => navigate(getPlayerProfilePath(player.id))}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-11 w-11 shrink-0">
                        <AvatarImage src={player.avatar_url || undefined} alt={fullName} />
                        <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 min-w-0 flex-wrap">
                          <p className="font-medium truncate">{fullName}</p>
                          {isArchived && (
                            <Badge variant="warning" className="text-xs">{t("roster.playersTab.badges.archived")}</Badge>
                          )}

                          <PlayerInfoHover player={player} isSki={isSki} />
                        </div>
                        {hasAttributeColumn && (
                          <div className="mt-1">{getAttributeDisplay(player)}</div>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                      {!isViewer && (
                        <div onClick={(e) => e.stopPropagation()} className="min-w-0">
                          {player.user_id ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 gap-1">
                              <Check className="h-3 w-3" /> {t("roster.playersTab.badges.connected")}
                            </Badge>
                          ) : inv ? (
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className={
                                status === "expired"
                                  ? "text-destructive border-destructive/30"
                                  : "text-amber-600 border-amber-300 dark:text-amber-400"
                              }>
                                {status === "expired" ? t("roster.playersTab.badges.expired") : t("roster.playersTab.badges.pending")}
                              </Badge>
                              {status === "pending" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    navigator.clipboard.writeText(link);
                                    setCopiedInviteId(inv.id);
                                    toast.success(t("roster.playersTab.inviteLinkCopied"));
                                    setTimeout(() => setCopiedInviteId(null), 2000);
                                  }}
                                >
                                  {copiedInviteId === inv.id ? (
                                    <Check className="h-3.5 w-3.5 text-green-600" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">{t("roster.playersTab.badges.noInvitation")}</span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 ml-auto" onClick={(e) => e.stopPropagation()}>
                        {!isViewer && canManageAthletes && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={t("roster.playersTab.actions.duplicate")}
                            onClick={() => setDuplicatePlayer(player)}
                          >
                            <CopyPlus className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                        {!isViewer && canManageAthletes && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={isArchived ? t("roster.playersTab.actions.unarchive") : t("roster.playersTab.actions.archive")}
                            onClick={() =>
                              archivePlayer.mutate({ playerId: player.id, archive: !isArchived })
                            }
                          >
                            {isArchived ? (
                              <ArchiveRestore className="h-4 w-4 text-primary" />
                            ) : (
                              <Archive className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        )}
                        {!isViewer && canManageAthletes && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              if (confirm(t("roster.playersTab.confirmDelete", { name: fullName }))) {
                                deletePlayer.mutate(player.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 h-8"
                          onClick={() => navigate(getPlayerProfilePath(player.id))}
                        >
                          <Eye className="h-4 w-4" />
                          {t("roster.playersTab.actions.profile")}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop / tablette : table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("roster.playersTab.columns.name")}</TableHead>
                    {hasAttributeColumn && <TableHead>{attributeColumnLabel}</TableHead>}
                    {!isViewer && <TableHead>{t("roster.playersTab.columns.registration")}</TableHead>}
                    <TableHead className="text-right">{t("roster.playersTab.columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlayers?.map((player: any) => {
                    const fullName = player.first_name 
                      ? `${player.first_name} ${player.name}` 
                      : player.name;
                    const initials = fullName
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);
                    const isArchived = !!player.archived_at;

                    return (
                      <TableRow 
                        key={player.id} 
                        className={`animate-fade-in cursor-pointer hover:bg-accent/50 ${
                          isArchived
                            ? "border-l-4 border-l-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.06)]"
                            : ""
                        }`}

                        onClick={() => navigate(getPlayerProfilePath(player.id))}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={player.avatar_url || undefined} alt={fullName} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <span>{fullName}</span>
                            {isArchived && (
                              <Badge variant="warning" className="text-xs">{t("roster.playersTab.badges.archived")}</Badge>
                            )}

                            <PlayerInfoHover player={player} isSki={isSki} />
                          </div>
                        </TableCell>
                        {hasAttributeColumn && (
                          <TableCell>
                            {getAttributeDisplay(player)}
                          </TableCell>
                        )}
                        {!isViewer && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              if (player.user_id) {
                                return (
                                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 gap-1">
                                    <Check className="h-3 w-3" />
                                    {t("roster.playersTab.badges.connected")}
                                  </Badge>
                                );
                              }
                              const inv = invitationsByPlayer.get(player.id);
                              if (!inv) {
                                return (
                                  <span className="text-xs text-muted-foreground">—</span>
                                );
                              }
                              const status = getInvitationStatus(inv.status, inv.expires_at);
                              const link = `${getAppBaseUrl()}/accept-athlete-invitation?token=${inv.token}`;
                              return (
                                <TooltipProvider>
                                  <div className="flex items-center gap-1.5">
                                    <Badge variant="outline" className={
                                      status === "expired" 
                                        ? "text-destructive border-destructive/30" 
                                        : "text-amber-600 border-amber-300 dark:text-amber-400"
                                    }>
                                      {status === "expired" ? t("roster.playersTab.badges.expired") : t("roster.playersTab.badges.pending")}
                                    </Badge>
                                    {status === "pending" && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7"
                                            onClick={() => {
                                              navigator.clipboard.writeText(link);
                                              setCopiedInviteId(inv.id);
                                              toast.success(t("roster.playersTab.inviteLinkCopied"));
                                              setTimeout(() => setCopiedInviteId(null), 2000);
                                            }}
                                          >
                                            {copiedInviteId === inv.id ? (
                                              <Check className="h-3.5 w-3.5 text-green-600" />
                                            ) : (
                                              <Copy className="h-3.5 w-3.5" />
                                            )}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{t("roster.playersTab.copyInviteLinkTooltip")}</TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                </TooltipProvider>
                              );
                            })()}
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {!isViewer && canManageAthletes && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title={t("roster.playersTab.actions.duplicate")}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDuplicatePlayer(player);
                                }}
                              >
                                <CopyPlus className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                            {!isViewer && canManageAthletes && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title={isArchived ? t("roster.playersTab.actions.unarchiveShort") : t("roster.playersTab.actions.archiveShort")}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  archivePlayer.mutate({ playerId: player.id, archive: !isArchived });
                                }}
                              >
                                {isArchived ? (
                                  <ArchiveRestore className="h-4 w-4 text-primary" />
                                ) : (
                                  <Archive className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                            )}
                            {!isViewer && canManageAthletes && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(t("roster.playersTab.confirmDelete", { name: fullName }))) {
                                    deletePlayer.mutate(player.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(getPlayerProfilePath(player.id));
                              }}
                            >
                              <Eye className="h-4 w-4" />
                              <span className="hidden sm:inline">{t("roster.playersTab.actions.viewFullProfile")}</span>
                              <span className="sm:hidden">{t("roster.playersTab.actions.profile")}</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>

      <AddPlayerDialogWithInvite
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        categoryId={categoryId}
      />
      <BulkAddPlayersDialog
        open={isBulkDialogOpen}
        onOpenChange={setIsBulkDialogOpen}
        categoryId={categoryId}
      />
      <LinkExistingPlayerDialog
        open={isLinkDialogOpen}
        onOpenChange={setIsLinkDialogOpen}
        categoryId={categoryId}
      />
      <DuplicatePlayerToCategoryDialog
        open={!!duplicatePlayer}
        onOpenChange={(o) => !o && setDuplicatePlayer(null)}
        categoryId={categoryId}
        player={duplicatePlayer}
      />
    </Card>
  );
}
