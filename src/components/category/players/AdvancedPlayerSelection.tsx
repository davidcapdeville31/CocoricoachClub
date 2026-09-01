import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, AlertTriangle, Search, Filter } from "lucide-react";
import { 
  getPositionGroupsForSport, 
  playerBelongsToGroup, 
  sportHasPositionGroups,
  getPositionGroupLabel,
  PositionGroup 
} from "@/lib/constants/sportPositionGroups";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategoryAttributes } from "@/hooks/useCategoryAttributes";
import { AthleteIdentityBadges } from "@/components/player/AthleteIdentityBadges";
import { useSeasonRosterFilter } from "@/contexts/SeasonRosterFilterContext";
import { useSeasonFilteredPlayerIds } from "@/hooks/use-season-filtered-players";
import { fetchCategoryRosterPlayers } from "@/lib/categoryRoster";

interface Player {
  id: string;
  name: string;
  first_name?: string | null;
  position?: string;
  season_id?: string | null;
}

interface AdvancedPlayerSelectionProps {
  categoryId: string;
  sportType?: string;
  selectedPlayers: string[];
  onSelectionChange: (playerIds: string[]) => void;
  selectionMode: "all" | "specific";
  onSelectionModeChange: (mode: "all" | "specific") => void;
  players?: Player[];
  maxHeight?: string;
  showInjuredFilter?: boolean;
  /** Hide category-wide mode when every assignment must target named athletes. */
  allowAll?: boolean;
}

export function AdvancedPlayerSelection({
  categoryId,
  sportType,
  selectedPlayers,
  onSelectionChange,
  selectionMode,
  onSelectionModeChange,
  players: externalPlayers,
  maxHeight = "200px",
  showInjuredFilter = true,
  allowAll = true,
}: AdvancedPlayerSelectionProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const { activeSeasonOnly, activeSeasonId } = useSeasonRosterFilter();
  const { allowedIds } = useSeasonFilteredPlayerIds(categoryId);
  const seasonScope = activeSeasonOnly && activeSeasonId ? activeSeasonId : "all";

  // Fetch players if not provided externally
  const { data: fetchedPlayers } = useQuery({
    queryKey: ["players", categoryId, "selection-roster", seasonScope],
    queryFn: async () => {
      const roster = await fetchCategoryRosterPlayers(categoryId);
      if (!activeSeasonOnly || !activeSeasonId) return roster;
      return roster.filter((p: any) => p.season_id === activeSeasonId);
    },
    enabled: !externalPlayers,
  });

  // Fetch injuries to identify injured players
  const { data: injuries } = useQuery({
    queryKey: ["active-injuries", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("injuries")
        .select("player_id")
        .eq("category_id", categoryId)
        .in("status", ["active", "recovering"]);
      if (error) throw error;
      return data;
    },
    enabled: showInjuredFilter,
  });

  const baseList = externalPlayers || fetchedPlayers || [];
  const players = useMemo(() => {
    if (!externalPlayers || !allowedIds) return baseList;
    return baseList.filter((p) => allowedIds.has(p.id));
  }, [baseList, externalPlayers, allowedIds]);
  const injuredPlayerIds = new Set(injuries?.map((i) => i.player_id) || []);
  const positionGroups = getPositionGroupsForSport(sportType);
  const hasPositionGroups = positionGroups.length > 0;

  // Identité Athlète : agrège toutes les positions (principale + secondaires)
  // pour qu'un pilier 2e ligne soit visible dans les 2 groupes.
  const { getPlayerValues } = useCategoryAttributes(categoryId);

  const playerMatchesGroup = (p: Player, group: PositionGroup): boolean => {
    if (playerBelongsToGroup(p.position, group)) return true;
    const allPositions = getPlayerValues(p.id, "position");
    return allPositions.some((pos) => playerBelongsToGroup(pos, group));
  };

  // Group players by position group
  const playersByGroup = useMemo(() => {
    if (!hasPositionGroups) return {};

    const grouped: Record<string, Player[]> = {};
    positionGroups.forEach(group => {
      grouped[group.id] = players.filter(p => playerMatchesGroup(p, group));
    });
    grouped["unassigned"] = players.filter(p =>
      !positionGroups.some(group => playerMatchesGroup(p, group))
    );
    return grouped;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, positionGroups, hasPositionGroups, getPlayerValues]);

  const healthyPlayers = useMemo(
    () => players.filter((p) => !injuredPlayerIds.has(p.id)),
    [players, injuredPlayerIds]
  );

  const injuredPlayers = useMemo(
    () => players.filter((p) => injuredPlayerIds.has(p.id)),
    [players, injuredPlayerIds]
  );

  // Filter players based on search and position filter
  const filteredPlayers = useMemo(() => {
    let filtered = players;
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply position group filter (étendu à l'identité athlète)
    if (positionFilter !== "all" && hasPositionGroups) {
      const group = positionGroups.find(g => g.id === positionFilter);
      if (group) {
        filtered = filtered.filter(p => playerMatchesGroup(p, group));
      }
    }

    return filtered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, searchQuery, positionFilter, positionGroups, hasPositionGroups, getPlayerValues]);

  const togglePlayer = (playerId: string) => {
    if (selectedPlayers.includes(playerId)) {
      onSelectionChange(selectedPlayers.filter((id) => id !== playerId));
    } else {
      onSelectionChange([...selectedPlayers, playerId]);
    }
  };

  const selectAll = () => {
    onSelectionChange(players.map((p) => p.id));
    onSelectionModeChange("specific");
  };

  const selectAllHealthy = () => {
    onSelectionChange(healthyPlayers.map((p) => p.id));
    onSelectionModeChange("specific");
  };

  const selectAllInjured = () => {
    onSelectionChange(injuredPlayers.map((p) => p.id));
    onSelectionModeChange("specific");
  };

  const selectByGroup = (group: PositionGroup) => {
    const groupPlayers = playersByGroup[group.id] || [];
    const groupPlayerIds = groupPlayers.map(p => p.id);
    
    // Add group players to existing selection (don't replace)
    const newSelection = [...new Set([...selectedPlayers, ...groupPlayerIds])];
    onSelectionChange(newSelection);
    onSelectionModeChange("specific");
  };

  const clearSelection = () => {
    onSelectionChange([]);
  };

  // Get unique positions for simple filter dropdown (for sports without predefined groups)
  const uniquePositions = useMemo(() => {
    const positions = new Set<string>();
    players.forEach(p => {
      if (p.position) positions.add(p.position);
    });
    return Array.from(positions).sort();
  }, [players]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4" />
          {t("roster.advancedSelection.title")}
        </Label>
        <div className="flex gap-2">
          {allowAll && (
            <Button
              type="button"
              variant={selectionMode === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                onSelectionModeChange("all");
                onSelectionChange([]);
              }}
            >
              {t("roster.advancedSelection.all")}
            </Button>
          )}
          <Button
            type="button"
            variant={selectionMode === "specific" ? "default" : "outline"}
            size="sm"
            onClick={() => onSelectionModeChange("specific")}
          >
            {t("roster.advancedSelection.specific")}
          </Button>
        </div>
      </div>

      {selectionMode === "specific" && (
        <>
          {/* Quick selection buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selectAll}
              className="text-xs"
            >
              <UserCheck className="h-3 w-3 mr-1" />
              {t("roster.advancedSelection.allCount", { count: players.length })}
            </Button>
            
            {showInjuredFilter && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAllHealthy}
                  className="text-xs border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950"
                >
                  <UserCheck className="h-3 w-3 mr-1" />
                  {t("roster.advancedSelection.healthyCount", { count: healthyPlayers.length })}
                </Button>
                {injuredPlayers.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAllInjured}
                    className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950"
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {t("roster.advancedSelection.injuredCount", { count: injuredPlayers.length })}
                  </Button>
                )}
              </>
            )}
            
            {selectedPlayers.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="text-xs text-muted-foreground"
              >
                {t("roster.advancedSelection.clear")}
              </Button>
            )}
          </div>

          {/* Position group quick selection (for rugby, football, etc.) */}
          {hasPositionGroups && (
            <div className="flex flex-wrap gap-2 p-2 border rounded-lg bg-muted/30">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Filter className="h-3 w-3" />
                {t("roster.advancedSelection.byPosition")}
              </span>
              {positionGroups.map(group => {
                const count = playersByGroup[group.id]?.length || 0;
                return (
                  <Button
                    key={group.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => selectByGroup(group)}
                    className="text-xs"
                  >
                    {getPositionGroupLabel(group, t)} ({count})
                  </Button>
                );
              })}
            </div>
          )}

          {/* Search and filter row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("roster.advancedSelection.searchPlaceholder")}
                className="pl-8 h-8 text-sm"
              />
            </div>
            
            {/* Position filter dropdown */}
            {(hasPositionGroups || uniquePositions.length > 0) && (
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder={t("roster.advancedSelection.allPositions")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("roster.advancedSelection.allPositions")}</SelectItem>
                  {hasPositionGroups ? (
                    positionGroups.map(group => (
                      <SelectItem key={group.id} value={group.id}>
                        {getPositionGroupLabel(group, t)}
                      </SelectItem>
                    ))
                  ) : (
                    uniquePositions.map(pos => (
                      <SelectItem key={pos} value={pos}>
                        {pos}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Player list */}
          <ScrollArea className="border rounded-md" style={{ maxHeight }}>
            <div className="p-2 grid grid-cols-2 gap-1">
              {filteredPlayers.map((player) => {
                const isInjured = injuredPlayerIds.has(player.id);
                const isSelected = selectedPlayers.includes(player.id);
                
                // Find which group this player belongs to
                const playerGroup = hasPositionGroups 
                  ? positionGroups.find(g => playerBelongsToGroup(player.position, g))
                  : null;

                return (
                  <div
                    key={player.id}
                    role="button"
                    tabIndex={0}
                    className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors select-none ${
                      isSelected
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted border border-transparent"
                    }`}
                    onClick={() => togglePlayer(player.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        togglePlayer(player.id);
                      }
                    }}
                  >
                    <Checkbox
                      checked={isSelected}
                      className="pointer-events-none"
                    />
                    <div className="flex-1 min-w-0 pointer-events-none">
                      <p className="text-sm font-medium truncate">{player.name}</p>
                      <div className="flex items-center gap-1 flex-wrap">
                        {player.position && (
                          <p className="text-xs text-muted-foreground">{player.position}</p>
                        )}
                        {playerGroup && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            {getPositionGroupLabel(playerGroup, t)}
                          </Badge>
                        )}
                        <AthleteIdentityBadges playerId={player.id} primaryOnly={false} />
                      </div>
                    </div>
                    {isInjured && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs shrink-0 pointer-events-none">
                        {t("roster.advancedSelection.injuredBadge")}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {selectedPlayers.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("roster.advancedSelection.selectedCount", { count: selectedPlayers.length })}
            </p>
          )}
        </>
      )}

      {selectionMode === "all" && (
        <p className="text-sm text-muted-foreground">
          {t("roster.advancedSelection.appliedToAll", { count: players.length })}
        </p>
      )}
    </div>
  );
}
