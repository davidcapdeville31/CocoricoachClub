import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BarChart3, Info, Loader2 } from "lucide-react";
import { getStatsForSport, getStatCategories } from "@/lib/constants/sportStats";
import { getStatDescription } from "@/lib/constants/statDescriptions";
import { useStatPreferences } from "@/hooks/use-stat-preferences";
import { groupStatsByTheme } from "@/lib/statSubGroups";
import {
  Tooltip as StatTooltip,
  TooltipContent as StatTooltipContent,
  TooltipTrigger as StatTooltipTrigger,
} from "@/components/ui/tooltip";

interface AthleteMatchStatsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  playerId: string;
  categoryId: string;
  sportType: string;
  matchLabel: string;
}

/**
 * Petite icône « i » qui explique à quoi sert une statistique. Les athlètes
 * découvrent le sens de chaque champ sans avoir à interroger le staff.
 *
 * L'infobulle est pilotée par un état partagé : un seul texte est visible à la
 * fois, un tap suffit sur mobile et le survol fonctionne à la souris.
 */
function StatInfo({
  id,
  label,
  text,
  active,
  onToggle,
}: {
  id: string;
  label: string;
  text: string;
  active: boolean;
  onToggle: (id: string | null) => void;
}) {
  return (
    <StatTooltip
      open={active}
      onOpenChange={(open) => onToggle(open ? id : null)}
      delayDuration={150}
    >
      <StatTooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Expliquer : ${label}`}
          className="shrink-0 rounded-full p-0.5 text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </StatTooltipTrigger>
      <StatTooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
        {text}
      </StatTooltipContent>
    </StatTooltip>
  );
}

/**
 * Saisie des statistiques de match par l'athlète elle-même (sports collectifs).
 * Réservé aux athlètes présentes dans la composition (match_lineups) quand la
 * catégorie autorise la saisie athlète. L'athlète ne lit/modifie que sa propre
 * ligne player_match_stats — les autres joueuses restent au staff.
 */
export function AthleteMatchStats({
  open,
  onOpenChange,
  matchId,
  playerId,
  categoryId,
  sportType,
  matchLabel,
}: AthleteMatchStatsProps) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, number>>({});
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  // Une seule explication visible à la fois dans la fenêtre.
  const [infoId, setInfoId] = useState<string | null>(null);

  const { stats: filteredStats, hasCustomPreferences, isLoading: loadingPrefs } = useStatPreferences({
    categoryId,
    sportType,
    matchId,
    isGoalkeeper: false,
  });

  const sportStats = hasCustomPreferences
    ? filteredStats
    : filteredStats.length > 0
      ? filteredStats
      : getStatsForSport(sportType, false);

  // Liste complète (standard + préférences) pour initialiser toutes les clés
  const allStats = useMemo(() => {
    const standard = [
      ...getStatsForSport(sportType, false),
      ...getStatsForSport(sportType, true),
    ];
    const keys = new Set(standard.map((s) => s.key));
    const merged = [...standard];
    sportStats.forEach((s) => {
      if (!keys.has(s.key)) {
        merged.push(s);
        keys.add(s.key);
      }
    });
    return merged;
  }, [sportType, sportStats]);

  const statCategories = getStatCategories(sportType).filter((cat) =>
    sportStats.some((s) => s.category === cat.key),
  );

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["athlete-own-match-stats", matchId, playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_match_stats")
        .select("*")
        .eq("match_id", matchId)
        .eq("player_id", playerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!matchId && !!playerId,
  });

  useEffect(() => {
    if (!open) {
      setInitialized(false);
      setValues({});
      setInfoId(null);
      return;
    }
    if (initialized || loadingPrefs || loadingExisting) return;
    const sportData =
      (existing as { sport_data?: Record<string, number> } | null)?.sport_data || {};
    const init: Record<string, number> = {};
    allStats.forEach((stat) => {
      const snakeKey = stat.key.replace(/([A-Z])/g, "_$1").toLowerCase();
      const row = (existing || {}) as Record<string, unknown>;
      const v =
        sportData[stat.key] ??
        (row[stat.key] as number | undefined) ??
        (row[snakeKey] as number | undefined) ??
        0;
      init[stat.key] = typeof v === "number" ? v : 0;
    });
    setValues(init);
    setInitialized(true);
  }, [open, initialized, loadingPrefs, loadingExisting, allStats, existing]);

  const updateValue = (statKey: string, value: number) => {
    setValues((prev) => {
      const updated = { ...prev, [statKey]: value };
      // Recalcule les pourcentages dérivés, comme côté staff
      allStats.forEach((s) => {
        if (s.computedFrom) {
          const { successKey, totalKey, failureKey } = s.computedFrom;
          if (statKey === successKey || statKey === totalKey || statKey === failureKey) {
            const success = Number(updated[successKey]) || 0;
            const total = totalKey
              ? Number(updated[totalKey]) || 0
              : success + (Number(updated[failureKey!]) || 0);
            updated[s.key] = total > 0 ? Math.round((success / total) * 100) : 0;
          }
        }
      });
      return updated;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const sportData: Record<string, number> = {};
      allStats.forEach((stat) => {
        const v = Number(values[stat.key]) || 0;
        if (v !== 0) sportData[stat.key] = v;
      });

      const payload = {
        match_id: matchId,
        player_id: playerId,
        tries: Number(values.tries) || 0,
        conversions: Number(values.conversions) || 0,
        penalties_scored: Number(values.penaltiesScored) || 0,
        drop_goals: Number(values.dropGoals) || 0,
        tackles: Number(values.tackles) || 0,
        tackles_missed: Number(values.tacklesMissed) || 0,
        defensive_recoveries: Number(values.defensiveRecoveries) || 0,
        carries: Number(values.carries) || 0,
        meters_gained: Number(values.metersGained) || 0,
        offloads: Number(values.offloads) || 0,
        turnovers_won: Number(values.turnoversWon) || 0,
        breakthroughs: Number(values.breakthroughs) || 0,
        total_contacts: Number(values.totalContacts) || 0,
        yellow_cards: Number(values.yellowCards) || 0,
        red_cards: Number(values.redCards) || 0,
        sport_data: sportData,
      };

      // Ne touche qu'à la propre ligne de l'athlète
      await supabase
        .from("player_match_stats")
        .delete()
        .eq("match_id", matchId)
        .eq("player_id", playerId);
      const { error } = await supabase.from("player_match_stats").insert(payload);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["player_match_stats", matchId] });
      queryClient.invalidateQueries({ queryKey: ["athlete-own-match-stats", matchId, playerId] });
      queryClient.invalidateQueries({ queryKey: ["cumulative_player_stats", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["player_all_match_stats"] });
      toast.success("Tes statistiques ont été enregistrées");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const hasData = existing != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5 text-primary" />
            Mes statistiques — {matchLabel}
          </DialogTitle>
        </DialogHeader>

        {!initialized ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sportStats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucune statistique activée pour cette catégorie.
          </p>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1">
            <div className="space-y-3 pb-2">
              {hasData && (
                <Badge variant="secondary" className="text-xs">
                  ✓ Statistiques déjà enregistrées — tu peux les corriger
                </Badge>
              )}
              {statCategories.map((cat) => {
                const catStats = sportStats.filter((s) => s.category === cat.key);
                if (catStats.length === 0) return null;
                // Côté athlète : uniquement les statistiques individuelles.
                // On masque les blocs collectifs/secondaires (Autres, Récupérations, Discipline).
                const HIDDEN_GROUPS = new Set(["_others", "recoveries", "discipline"]);
                const groups = groupStatsByTheme(cat.key, catStats, { sportType }).filter(
                  (g) => !HIDDEN_GROUPS.has(g.key),
                );
                return (
                  <div key={cat.key} className="rounded-lg border bg-card p-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      {cat.label}
                    </p>
                    {groups.map((group) => (
                      <div
                        key={group.key}
                        className={`rounded-md ${group.label ? `border p-2 ${group.color?.ring || "border-border/40"} ${group.color?.soft || ""}` : ""}`}
                      >
                        {group.label && (
                          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${group.color?.accent || "text-muted-foreground"}`}>
                            {group.label}
                          </p>
                        )}
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {group.items.map((stat) => {
                            const raw = values[stat.key] ?? 0;
                            if (stat.computedFrom) {
                              return (
                                <div key={stat.key} className="flex items-center justify-between gap-1">
                                  <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                                    <span className="truncate">{stat.shortLabel}</span>
                                    <StatInfo
                                      id={stat.key}
                                      label={stat.label}
                                      text={getStatDescription(stat, sportType, allStats)}
                                      active={infoId === stat.key}
                                      onToggle={setInfoId}
                                    />
                                  </span>
                                  <span className="text-sm font-semibold text-primary">{raw || 0}%</span>
                                </div>
                              );
                            }
                            // Libellés complets pour les plaquages afin d'éviter la confusion
                            // entre « plaquages réussis » et « plaquages tentés ».
                            const displayLabel =
                              stat.key === "tackles" || stat.key === "tacklesMissed"
                                ? stat.label
                                : stat.shortLabel;
                            return (
                              <div key={stat.key} className="flex items-center gap-1">
                                <span className="flex min-w-0 flex-1 items-center gap-1 text-xs text-muted-foreground">
                                  <span className="truncate">{displayLabel}</span>
                                  <StatInfo
                                    id={stat.key}
                                    label={displayLabel}
                                    text={getStatDescription(stat, sportType, allStats)}
                                    active={infoId === stat.key}
                                    onToggle={setInfoId}
                                  />
                                </span>
                                <Input
                                  type="number"
                                  value={raw === 0 ? "" : String(raw)}
                                  onChange={(e) => updateValue(stat.key, parseFloat(e.target.value) || 0)}
                                  min={stat.min ?? 0}
                                  max={stat.max}
                                  className="h-8 w-16 text-sm text-center"
                                  placeholder="0"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving || !initialized}>
            {saving ? "Enregistrement..." : hasData ? "Mettre à jour" : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
