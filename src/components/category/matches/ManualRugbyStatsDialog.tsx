import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Save, Shield, MapPin } from "lucide-react";
import { ManualRugbyPositionDialog, type FieldPosition, type PositionableKind } from "./ManualRugbyPositionDialog";
import { useStatPreferences } from "@/hooks/use-stat-preferences";

interface ManualRugbyStatsDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  matchId: string;
  isHome: boolean;
  opponentName?: string;
  clubName?: string;
  initialOpponentScore?: number;
  /** Catégorie (utilisée pour filtrer les stats selon les préférences). */
  categoryId?: string;
  /** Type de sport pour résoudre la liste de référence. Defaults to "rugby_xv". */
  sportType?: string;
}

type StatRow = {
  // Points
  tries: number;
  conversionsMade: number; conversionsMissed: number;
  penaltiesMade: number; penaltiesMissed: number;
  drops: number; dropsMissed: number;
  // Conquête
  scrumsWon: number; scrumsLost: number;
  lineoutsWon: number; lineoutsLost: number;
  mauls: number; rucks: number;
  // Attaque
  knockOns: number; lineBreaks: number;
  passesMade: number; passesMissed: number;
  kicksMade: number; kicksMissed: number;
  // Défense
  tackles: number; missedTackles: number; turnoversWon: number;
  // Discipline
  fouls: number; yellowCards: number; redCards: number;
  // Positions par stat positionable
  positions?: Partial<Record<PositionableStatKey, FieldPosition[]>>;
};

type PositionableStatKey =
  | "tries"
  | "conversionsMade" | "conversionsMissed"
  | "penaltiesMade" | "penaltiesMissed"
  | "drops" | "dropsMissed"
  | "scrumsWon" | "scrumsLost" | "lineoutsWon" | "lineoutsLost";

const POSITIONABLE_KIND: Record<PositionableStatKey, PositionableKind> = {
  tries: "try",
  conversionsMade: "conversion",
  conversionsMissed: "conversion",
  penaltiesMade: "penalty_kick",
  penaltiesMissed: "penalty_kick",
  drops: "drop",
  dropsMissed: "drop",
  scrumsWon: "scrum_won",
  scrumsLost: "scrum_lost",
  lineoutsWon: "lineout_won",
  lineoutsLost: "lineout_lost",
};

const MISSED_POSITIONABLE: ReadonlySet<PositionableStatKey> = new Set([
  "conversionsMissed", "penaltiesMissed", "dropsMissed", "scrumsLost", "lineoutsLost",
]);

type Period = "H1" | "H2";
type Category = "points" | "attack" | "conquest" | "defense" | "discipline";
type PeriodStats = { H1: StatRow; H2: StatRow };
type NotesByPeriod = { H1: string; H2: string };

const EMPTY: StatRow = {
  tries: 0, conversionsMade: 0, conversionsMissed: 0,
  penaltiesMade: 0, penaltiesMissed: 0, drops: 0, dropsMissed: 0,
  scrumsWon: 0, scrumsLost: 0, lineoutsWon: 0, lineoutsLost: 0, mauls: 0, rucks: 0,
  knockOns: 0, lineBreaks: 0, passesMade: 0, passesMissed: 0, kicksMade: 0, kicksMissed: 0,
  tackles: 0, missedTackles: 0, turnoversWon: 0,
  fouls: 0, yellowCards: 0, redCards: 0,
};

const emptyStatRow = (): StatRow => ({ ...EMPTY, positions: {} });
const emptyPeriodStats = (): PeriodStats => ({ H1: emptyStatRow(), H2: emptyStatRow() });
const emptyNotes = (): NotesByPeriod => ({ H1: "", H2: "" });

type FieldDef = { key: keyof StatRow; label: string; short: string; category: Category };

const FIELDS: FieldDef[] = [
  // Points
  { key: "tries", label: "Essais", short: "Ess", category: "points" },
  { key: "conversionsMade", label: "Transformations réussies", short: "Tr ✓", category: "points" },
  { key: "conversionsMissed", label: "Transformations manquées", short: "Tr ✗", category: "points" },
  { key: "penaltiesMade", label: "Pénalités réussies", short: "Pén ✓", category: "points" },
  { key: "penaltiesMissed", label: "Pénalités manquées", short: "Pén ✗", category: "points" },
  { key: "drops", label: "Drops réussis", short: "Drop ✓", category: "points" },
  { key: "dropsMissed", label: "Drops manqués", short: "Drop ✗", category: "points" },
  // Conquête
  { key: "scrumsWon", label: "Mêlées gagnées", short: "Mêlée ✓", category: "conquest" },
  { key: "scrumsLost", label: "Mêlées perdues", short: "Mêlée ✗", category: "conquest" },
  { key: "lineoutsWon", label: "Touches gagnées", short: "Touche ✓", category: "conquest" },
  { key: "lineoutsLost", label: "Touches perdues", short: "Touche ✗", category: "conquest" },
  { key: "mauls", label: "Ballons portés", short: "Maul", category: "conquest" },
  { key: "rucks", label: "Rucks", short: "Ruck", category: "conquest" },
  // Attaque
  { key: "knockOns", label: "En-avants", short: "En-av", category: "attack" },
  { key: "lineBreaks", label: "Franchissements", short: "Franch.", category: "attack" },
  { key: "passesMade", label: "Passes réussies", short: "Passe ✓", category: "attack" },
  { key: "passesMissed", label: "Passes manquées", short: "Passe ✗", category: "attack" },
  { key: "kicksMade", label: "Passes au pied réussies", short: "Pied ✓", category: "attack" },
  { key: "kicksMissed", label: "Passes au pied manquées", short: "Pied ✗", category: "attack" },
  // Défense
  { key: "tackles", label: "Plaquages réussis", short: "Plaq", category: "defense" },
  { key: "missedTackles", label: "Plaquages manqués", short: "Plaq ✗", category: "defense" },
  { key: "turnoversWon", label: "Ballons grattés", short: "Grattés", category: "defense" },
  // Discipline
  { key: "fouls", label: "Fautes", short: "Fautes", category: "discipline" },
  { key: "yellowCards", label: "Cartons jaunes", short: "J", category: "discipline" },
  { key: "redCards", label: "Cartons rouges", short: "R", category: "discipline" },
];

const CATEGORY_LABELS: Record<Category, string> = {
  points: "Points",
  attack: "Attaque",
  conquest: "Conquête",
  defense: "Défense",
  discipline: "Discipline",
};

/**
 * Mapping clé interne ManualRugby → clé du référentiel `RUGBY_STATS`
 * (utilisé par useStatPreferences / cases à cocher du dialogue Préférences).
 */
const FIELD_TO_REF_KEY: Record<keyof StatRow, string> = {
  tries: "tries",
  conversionsMade: "conversionsMade",
  conversionsMissed: "conversionsMissed",
  penaltiesMade: "penaltiesMade",
  penaltiesMissed: "penaltiesMissed",
  drops: "dropsMade",
  dropsMissed: "dropsMissed",
  scrumsWon: "scrumsWon",
  scrumsLost: "scrumsLost",
  lineoutsWon: "lineoutsWon",
  lineoutsLost: "lineoutsLost",
  mauls: "mauls",
  rucks: "rucks",
  knockOns: "knockOns",
  lineBreaks: "lineBreaks",
  passesMade: "passesMade",
  passesMissed: "passesMissed",
  kicksMade: "kicksMade",
  kicksMissed: "kicksMissed",
  tackles: "tackles",
  missedTackles: "tacklesMissed",
  turnoversWon: "turnoversWon",
  fouls: "fouls",
  yellowCards: "yellowCards",
  redCards: "redCards",
  // 'positions' n'est pas une stat, ignorée
  positions: "__ignore__",
};

const computePoints = (r: StatRow) =>
  r.tries * 5 + r.conversionsMade * 2 + r.penaltiesMade * 3 + r.drops * 3;

const sumPeriods = (ps: PeriodStats, fn: (r: StatRow) => number) => fn(ps.H1) + fn(ps.H2);

export function ManualRugbyStatsDialog({
  open, onOpenChange, matchId, isHome,
  opponentName = "Adversaire", clubName = "Notre équipe",
  categoryId, sportType = "rugby_xv",
}: ManualRugbyStatsDialogProps) {
  const qc = useQueryClient();
  const clubSide: "home" | "away" = isHome ? "home" : "away";
  const oppSide: "home" | "away" = isHome ? "away" : "home";

  const [period, setPeriod] = useState<Period>("H1");
  const [category, setCategory] = useState<Category>("points");
  const [stats, setStats] = useState<Record<string, PeriodStats>>({});
  const [opponent, setOpponent] = useState<PeriodStats>(emptyPeriodStats());
  // Notes "minutes" libres : par joueur (et "opp" pour l'adversaire), par mi-temps, par catégorie
  const [notes, setNotes] = useState<Record<string, Record<Category, NotesByPeriod>>>({});
  const [saving, setSaving] = useState(false);
  const [confirmLiveOverwrite, setConfirmLiveOverwrite] = useState(false);
  const [posDialog, setPosDialog] = useState<{
    targetKey: string; // playerId or "opp"
    statKey: PositionableStatKey;
    contextLabel: string;
  } | null>(null);

  const { data: lineup = [], isLoading } = useQuery({
    queryKey: ["manual-stats-lineup", matchId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_lineups")
        .select("player_id, position, is_starter, players(id, name, first_name)")
        .eq("match_id", matchId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: existingEvents = [] } = useQuery({
    queryKey: ["manual-stats-events", matchId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_events" as any)
        .select("*")
        .eq("match_id", matchId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const hasLiveEvents = useMemo(
    () => existingEvents.some((e: any) => (e.metadata?.source ?? null) !== "manual"),
    [existingEvents]
  );

  const emptyNotesByCat = (): Record<Category, NotesByPeriod> => ({
    points: emptyNotes(), attack: emptyNotes(), conquest: emptyNotes(), defense: emptyNotes(), discipline: emptyNotes(),
  });

  // Pre-populate from existing events
  useEffect(() => {
    if (!open) return;
    const init: Record<string, PeriodStats> = {};
    const initNotes: Record<string, Record<Category, NotesByPeriod>> = {};
    lineup.forEach((l) => {
      init[l.player_id] = emptyPeriodStats();
      initNotes[l.player_id] = emptyNotesByCat();
    });
    initNotes["opp"] = emptyNotesByCat();
    const opp: PeriodStats = emptyPeriodStats();

    const applyEvent = (target: StatRow, e: any) => {
      const pushPos = (key: PositionableStatKey) => {
        if (typeof e.metadata?.kickX !== "number" || typeof e.metadata?.kickY !== "number") return;
        const side: "left" | "right" = e.metadata?.kickingSide === "left" ? "left" : "right";
        target.positions = target.positions ?? {};
        const arr = target.positions[key] ?? [];
        arr.push({ kickX: e.metadata.kickX, kickY: e.metadata.kickY, kickingSide: side });
        target.positions[key] = arr;
      };
      switch (e.event_type) {
        case "try": case "penalty_try": target.tries += 1; pushPos("tries"); break;
        case "conversion":
          if (e.outcome === "success") { target.conversionsMade += 1; pushPos("conversionsMade"); }
          else if (e.outcome === "fail") { target.conversionsMissed += 1; pushPos("conversionsMissed"); }
          break;
        case "penalty_kick":
          if (e.outcome === "success") { target.penaltiesMade += 1; pushPos("penaltiesMade"); }
          else if (e.outcome === "fail") { target.penaltiesMissed += 1; pushPos("penaltiesMissed"); }
          break;
        case "drop":
          if (e.outcome === "success") { target.drops += 1; pushPos("drops"); }
          else if (e.outcome === "fail") { target.dropsMissed += 1; pushPos("dropsMissed"); }
          break;
        case "scrum":
          if (e.outcome === "fail") { target.scrumsLost += 1; pushPos("scrumsLost"); }
          else { target.scrumsWon += 1; pushPos("scrumsWon"); }
          break;
        case "scrum_won": target.scrumsWon += 1; pushPos("scrumsWon"); break;
        case "scrum_lost": target.scrumsLost += 1; pushPos("scrumsLost"); break;
        case "lineout":
          if (e.outcome === "fail") { target.lineoutsLost += 1; pushPos("lineoutsLost"); }
          else { target.lineoutsWon += 1; pushPos("lineoutsWon"); }
          break;
        case "lineout_won": target.lineoutsWon += 1; pushPos("lineoutsWon"); break;
        case "lineout_lost": target.lineoutsLost += 1; pushPos("lineoutsLost"); break;
        case "maul": target.mauls += 1; break;
        case "ruck": target.rucks += 1; break;
        case "tackle":
          if (e.outcome === "fail") target.missedTackles += 1; else target.tackles += 1;
          break;
        case "missed_tackle": target.missedTackles += 1; break;
        case "knock_on": target.knockOns += 1; break;
        case "line_break": target.lineBreaks += 1; break;
        case "turnover": target.turnoversWon += 1; break;
        case "pass":
          if (e.outcome === "fail") target.passesMissed += 1; else target.passesMade += 1;
          break;
        case "kick":
          if (e.outcome === "fail") target.kicksMissed += 1; else target.kicksMade += 1;
          break;
        case "foul": target.fouls += 1; break;
        case "yellow_card": target.yellowCards += 1; break;
        case "red_card": target.redCards += 1; break;
      }
    };

    existingEvents.forEach((e: any) => {
      const per: Period = (e.period === "H2" || e.period === "ET") ? "H2" : "H1";
      if (e.team_side === oppSide) {
        applyEvent(opp[per], e);
      } else if (e.player_id && init[e.player_id]) {
        applyEvent(init[e.player_id][per], e);
      }
      // restitution des notes minutes
      const notesMap = e.metadata?.minutes_notes;
      if (notesMap && typeof notesMap === "object") {
        const targetKey = e.team_side === oppSide ? "opp" : (e.player_id || null);
        if (targetKey && initNotes[targetKey]) {
          (Object.keys(notesMap) as Category[]).forEach((cat) => {
            const v = notesMap[cat];
            if (v && typeof v === "string" && !initNotes[targetKey][cat]?.[per]) {
              initNotes[targetKey][cat][per] = v;
            }
          });
        }
      }
    });
    setStats(init);
    setOpponent(opp);
    setNotes(initNotes);
    setPeriod("H1");
    setCategory("points");
  }, [open, lineup, existingEvents, oppSide]);

  const sortedLineup = useMemo(
    () => [...lineup].sort((a, b) => (a.position ?? 99) - (b.position ?? 99)),
    [lineup]
  );

  const truncatePositions = (row: StatRow, key: keyof StatRow, value: number): StatRow => {
    if (!(key in POSITIONABLE_KIND)) return { ...row, [key]: Math.max(0, value || 0) };
    const pk = key as PositionableStatKey;
    const cur = row.positions?.[pk] ?? [];
    const next = cur.length > value ? cur.slice(0, Math.max(0, value)) : cur;
    return {
      ...row,
      [key]: Math.max(0, value || 0),
      positions: { ...(row.positions ?? {}), [pk]: next },
    };
  };

  const updatePlayerStat = (playerId: string, key: keyof StatRow, value: number) => {
    setStats((prev) => {
      const cur = prev[playerId] ?? emptyPeriodStats();
      return {
        ...prev,
        [playerId]: { ...cur, [period]: truncatePositions(cur[period], key, value) },
      };
    });
  };

  const updateOpponentStat = (key: keyof StatRow, value: number) => {
    setOpponent((prev) => ({
      ...prev,
      [period]: truncatePositions(prev[period], key, value),
    }));
  };

  const updatePlayerPositions = (playerId: string, key: PositionableStatKey, list: FieldPosition[]) => {
    setStats((prev) => {
      const cur = prev[playerId] ?? emptyPeriodStats();
      const row = cur[period];
      // Si l'utilisateur a placé des marqueurs sans renseigner le compteur, on aligne le compteur.
      const newCount = Math.max((row[key] as number) ?? 0, list.length);
      return {
        ...prev,
        [playerId]: {
          ...cur,
          [period]: { ...row, [key]: newCount, positions: { ...(row.positions ?? {}), [key]: list } },
        },
      };
    });
  };

  const updateOpponentPositions = (key: PositionableStatKey, list: FieldPosition[]) => {
    setOpponent((prev) => {
      const row = prev[period];
      const newCount = Math.max((row[key] as number) ?? 0, list.length);
      return {
        ...prev,
        [period]: { ...row, [key]: newCount, positions: { ...(row.positions ?? {}), [key]: list } },
      };
    });
  };

  const updateNote = (targetKey: string, value: string) => {
    setNotes((prev) => {
      const cur = prev[targetKey] ?? emptyNotesByCat();
      return {
        ...prev,
        [targetKey]: {
          ...cur,
          [category]: { ...cur[category], [period]: value },
        },
      };
    });
  };

  // Live computed scores (sum of both halves)
  const clubScore = useMemo(
    () => Object.values(stats).reduce((s, ps) => s + sumPeriods(ps, computePoints), 0),
    [stats]
  );
  const opponentScore = useMemo(() => sumPeriods(opponent, computePoints), [opponent]);

  // Préférences statistiques (par catégorie + override par match)
  const { enabledStatKeys, hasCustomPreferences } = useStatPreferences({
    categoryId: categoryId ?? "",
    sportType,
    matchId,
  });
  const enabledSet = useMemo(() => new Set(enabledStatKeys), [enabledStatKeys]);

  const visibleFields = useMemo(() => {
    const inCat = FIELDS.filter((f) => f.category === category);
    if (!categoryId || !hasCustomPreferences) return inCat;
    return inCat.filter((f) => {
      const refKey = FIELD_TO_REF_KEY[f.key];
      if (!refKey || refKey === "__ignore__") return true;
      return enabledSet.has(refKey);
    });
  }, [category, categoryId, hasCustomPreferences, enabledSet]);

  const buildEvents = () => {
    const events: any[] = [];
    const buildMinutesMeta = (targetKey: string, per: Period) => {
      const n = notes[targetKey];
      if (!n) return undefined;
      const byCat: Record<string, string> = {};
      (Object.keys(n) as Category[]).forEach((c) => {
        const v = n[c]?.[per];
        if (v && v.trim()) byCat[c] = v.trim();
      });
      return Object.keys(byCat).length > 0 ? byCat : undefined;
    };
    const push = (
      side: "home" | "away", player_id: string | null, per: Period,
      event_type: string, outcome: string | null, points = 0,
      minutesMeta?: Record<string, string>,
      pos?: FieldPosition,
    ) => {
      const metadata: any = { source: "manual" };
      if (minutesMeta) metadata.minutes_notes = minutesMeta;
      if (pos) {
        metadata.kickX = pos.kickX;
        metadata.kickY = pos.kickY;
        metadata.kickingSide = pos.kickingSide;
      }
      events.push({
        match_id: matchId, team_side: side, player_id,
        minute: 0, second: 0, period: per, event_type, outcome, points,
        metadata,
      });
    };
    const pushAll = (
      side: "home" | "away", pid: string | null, per: Period, r: StatRow,
      targetKey: string,
    ) => {
      const minutesMeta = buildMinutesMeta(targetKey, per);
      let firstAttached = false;
      const attach = () => {
        if (firstAttached || !minutesMeta) return undefined;
        firstAttached = true;
        return minutesMeta;
      };
      const posAt = (key: PositionableStatKey, i: number): FieldPosition | undefined =>
        r.positions?.[key]?.[i];
      for (let i = 0; i < r.tries; i++) push(side, pid, per, "try", null, 5, attach(), posAt("tries", i));
      for (let i = 0; i < r.conversionsMade; i++) push(side, pid, per, "conversion", "success", 2, attach(), posAt("conversionsMade", i));
      for (let i = 0; i < r.conversionsMissed; i++) push(side, pid, per, "conversion", "fail", 0, attach(), posAt("conversionsMissed", i));
      for (let i = 0; i < r.penaltiesMade; i++) push(side, pid, per, "penalty_kick", "success", 3, attach(), posAt("penaltiesMade", i));
      for (let i = 0; i < r.penaltiesMissed; i++) push(side, pid, per, "penalty_kick", "fail", 0, attach(), posAt("penaltiesMissed", i));
      for (let i = 0; i < r.drops; i++) push(side, pid, per, "drop", "success", 3, attach(), posAt("drops", i));
      for (let i = 0; i < r.dropsMissed; i++) push(side, pid, per, "drop", "fail", 0, attach(), posAt("dropsMissed", i));
      for (let i = 0; i < r.scrumsWon; i++) push(side, pid, per, "scrum", "success", 0, attach(), posAt("scrumsWon", i));
      for (let i = 0; i < r.scrumsLost; i++) push(side, pid, per, "scrum", "fail", 0, attach(), posAt("scrumsLost", i));
      for (let i = 0; i < r.lineoutsWon; i++) push(side, pid, per, "lineout", "success", 0, attach(), posAt("lineoutsWon", i));
      for (let i = 0; i < r.lineoutsLost; i++) push(side, pid, per, "lineout", "fail", 0, attach(), posAt("lineoutsLost", i));
      for (let i = 0; i < r.mauls; i++) push(side, pid, per, "maul", null, 0, attach());
      for (let i = 0; i < r.rucks; i++) push(side, pid, per, "ruck", null, 0, attach());
      for (let i = 0; i < r.tackles; i++) push(side, pid, per, "tackle", "success", 0, attach());
      for (let i = 0; i < r.missedTackles; i++) push(side, pid, per, "tackle", "fail", 0, attach());
      for (let i = 0; i < r.knockOns; i++) push(side, pid, per, "knock_on", null, 0, attach());
      for (let i = 0; i < r.lineBreaks; i++) push(side, pid, per, "line_break", null, 0, attach());
      for (let i = 0; i < r.turnoversWon; i++) push(side, pid, per, "turnover", null, 0, attach());
      for (let i = 0; i < r.passesMade; i++) push(side, pid, per, "pass", "success", 0, attach());
      for (let i = 0; i < r.passesMissed; i++) push(side, pid, per, "pass", "fail", 0, attach());
      for (let i = 0; i < r.kicksMade; i++) push(side, pid, per, "kick", "success", 0, attach());
      for (let i = 0; i < r.kicksMissed; i++) push(side, pid, per, "kick", "fail", 0, attach());
      for (let i = 0; i < r.fouls; i++) push(side, pid, per, "foul", null, 0, attach());
      for (let i = 0; i < r.yellowCards; i++) push(side, pid, per, "yellow_card", null, 0, attach());
      for (let i = 0; i < r.redCards; i++) push(side, pid, per, "red_card", null, 0, attach());
    };

    Object.entries(stats).forEach(([pid, ps]) => {
      pushAll(clubSide, pid, "H1", ps.H1, pid);
      pushAll(clubSide, pid, "H2", ps.H2, pid);
    });
    pushAll(oppSide, null, "H1", opponent.H1, "opp");
    pushAll(oppSide, null, "H2", opponent.H2, "opp");
    return events;
  };

  const performSave = async () => {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error: delErr } = await supabase.from("match_events" as any).delete().eq("match_id", matchId);
      if (delErr) throw delErr;
      const events = buildEvents().map((e) => ({ ...e, created_by: u.user?.id ?? null }));
      if (events.length > 0) {
        const { error: insErr } = await supabase.from("match_events" as any).insert(events);
        if (insErr) throw insErr;
      }
      const scorePatch = isHome
        ? { score_home: clubScore, score_away: opponentScore }
        : { score_away: clubScore, score_home: opponentScore };
      const { error: matchErr } = await supabase.from("matches").update(scorePatch as any).eq("id", matchId);
      if (matchErr) throw matchErr;
      toast.success("Statistiques enregistrées");
      qc.invalidateQueries({ queryKey: ["match_events", matchId] });
      qc.invalidateQueries({ queryKey: ["analytics_match_events", matchId] });
      qc.invalidateQueries({ queryKey: ["manual-stats-events", matchId] });
      qc.invalidateQueries({ queryKey: ["matches"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (hasLiveEvents) {
      setConfirmLiveOverwrite(true);
      return;
    }
    performSave();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] md:max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Saisie manuelle des statistiques</DialogTitle>
            <DialogDescription>
              Choisissez la mi-temps puis la catégorie. Les scores se calculent automatiquement
              à partir des essais, transformations, pénalités et drops des deux équipes.
              Le champ « Minutes » accepte les moments libres (ex. <em>12', 34'</em>).
            </DialogDescription>
          </DialogHeader>

          {/* Live score header */}
          <div className="rounded-lg border bg-muted/40 p-3 flex items-center justify-around gap-4">
            <div className="text-center">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{clubName}</div>
              <div className="text-3xl font-bold tabular-nums text-primary">{clubScore}</div>
            </div>
            <div className="text-2xl font-bold text-muted-foreground">–</div>
            <div className="text-center">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{opponentName}</div>
              <div className="text-3xl font-bold tabular-nums text-rose-600 dark:text-rose-400">{opponentScore}</div>
            </div>
          </div>

          {/* Period selector */}
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="H1">1ʳᵉ mi-temps</TabsTrigger>
              <TabsTrigger value="H2">2ᵉ mi-temps</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Category selector */}
          <Tabs value={category} onValueChange={(v) => setCategory(v as Category)}>
            <TabsList className="grid w-full grid-cols-5">
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                <TabsTrigger key={c} value={c}>{CATEGORY_LABELS[c]}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex-1 overflow-auto space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : sortedLineup.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                Aucun joueur dans la composition. Ajoutez d'abord la composition du match.
              </p>
            ) : (
              <>
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-background z-10">
                    <tr className="border-b">
                      <th className="text-left px-2 py-2 sticky left-0 bg-background z-10 min-w-[160px]">Joueur</th>
                      {visibleFields.map((f) => (
                        <th key={f.key} className="px-1 py-2 text-center text-xs font-medium text-muted-foreground" title={f.label}>
                          {f.short}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground min-w-[140px]">Minutes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLineup.map((l) => {
                      const p = l.players;
                      const name = [p?.first_name, p?.name].filter(Boolean).join(" ") || "Joueur";
                      const row = (stats[l.player_id] ?? emptyPeriodStats())[period];
                      const isSub = !l.is_starter;
                      const noteVal = notes[l.player_id]?.[category]?.[period] ?? "";
                      return (
                        <tr key={l.player_id} className={`border-b hover:bg-muted/30 ${isSub ? "bg-orange-50/30 dark:bg-orange-950/10" : ""}`}>
                          <td className="px-2 py-1.5 sticky left-0 bg-background z-10 border-r">
                            <div className="flex items-center gap-1.5">
                              <Badge variant={isSub ? "outline" : "default"} className="text-[10px] font-mono px-1.5 py-0 h-5">
                                {isSub ? `R` : `#${l.position ?? "?"}`}
                              </Badge>
                              <span className="text-xs font-medium truncate max-w-[140px]">{name}</span>
                            </div>
                          </td>
                          {visibleFields.map((f) => {
                            const isPositionable = (f.key as string) in POSITIONABLE_KIND;
                            const count = row[f.key] as number;
                            const placed = isPositionable ? (row.positions?.[f.key as PositionableStatKey]?.length ?? 0) : 0;
                            const allPlaced = isPositionable && count > 0 && placed >= count;
                            return (
                              <td key={f.key} className="px-0.5 py-0.5 text-center">
                                <div className="flex items-center justify-center gap-0.5">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={count === 0 ? "" : String(count)}
                                    onChange={(e) => updatePlayerStat(l.player_id, f.key, parseInt(e.target.value) || 0)}
                                    className="h-7 w-14 text-xs text-center"
                                    placeholder="0"
                                  />
                                  {isPositionable && (() => {
                                    const isMissed = MISSED_POSITIONABLE.has(f.key as PositionableStatKey);
                                    const cls = isMissed
                                      ? (allPlaced
                                          ? "bg-rose-600 text-white ring-rose-700 shadow-md shadow-rose-500/40"
                                          : placed > 0
                                            ? "bg-rose-500 text-white ring-rose-600 shadow-md shadow-rose-500/40"
                                            : "bg-rose-500/90 text-white ring-rose-600 shadow-sm shadow-rose-500/40 animate-pulse hover:animate-none")
                                      : (allPlaced
                                          ? "bg-emerald-500 text-white ring-emerald-600 shadow-md shadow-emerald-500/40"
                                          : placed > 0
                                            ? "bg-primary text-primary-foreground ring-primary shadow-md shadow-primary/40"
                                            : "bg-amber-400/90 text-amber-950 ring-amber-500 shadow-sm shadow-amber-500/40 animate-pulse hover:animate-none");
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => setPosDialog({ targetKey: l.player_id, statKey: f.key as PositionableStatKey, contextLabel: `${name} · ${period === "H1" ? "1ʳᵉ MT" : "2ᵉ MT"} · ${f.label}` })}
                                        title={count > 0 ? `Placer sur le terrain (${placed}/${count})` : "Placer sur le terrain"}
                                        className={`relative shrink-0 rounded-md p-1 ring-1 transition-all hover:scale-110 ${cls}`}
                                      >
                                        <MapPin className="h-4 w-4" strokeWidth={2.5} />
                                        {placed > 0 && (
                                          <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-background text-[9px] font-bold leading-[14px] text-center ring-1 ring-current">
                                            {placed}
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })()}
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-2 py-0.5">
                            <Input
                              value={noteVal}
                              onChange={(e) => updateNote(l.player_id, e.target.value)}
                              placeholder="ex. 12', 34'"
                              className="h-7 text-xs"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Opponent block */}
                <div className="rounded-lg border-2 border-rose-300 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    <h3 className="text-sm font-semibold">Équipe adverse — {opponentName}</h3>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {period === "H1" ? "1ʳᵉ MT" : "2ᵉ MT"} · {CATEGORY_LABELS[category]}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-2">
                    {visibleFields.map((f) => {
                      const isPositionable = (f.key as string) in POSITIONABLE_KIND;
                      const count = opponent[period][f.key] as number;
                      const placed = isPositionable ? (opponent[period].positions?.[f.key as PositionableStatKey]?.length ?? 0) : 0;
                      const allPlaced = isPositionable && count > 0 && placed >= count;
                      return (
                        <div key={f.key} className="flex flex-col items-center gap-1">
                          <label className="text-[10px] text-muted-foreground text-center" title={f.label}>{f.short}</label>
                          <div className="flex items-center gap-0.5">
                            <Input
                              type="number"
                              min={0}
                              value={count === 0 ? "" : String(count)}
                              onChange={(e) => updateOpponentStat(f.key, parseInt(e.target.value) || 0)}
                              className="h-8 w-16 text-xs text-center"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Minutes</label>
                    <Input
                      value={notes["opp"]?.[category]?.[period] ?? ""}
                      onChange={(e) => updateNote("opp", e.target.value)}
                      placeholder="ex. 18', 52'"
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving || sortedLineup.length === 0} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmLiveOverwrite} onOpenChange={setConfirmLiveOverwrite}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Statistiques temps réel détectées</AlertDialogTitle>
            <AlertDialogDescription>
              Des statistiques ont déjà été saisies en temps réel pour ce match. Si vous validez
              une saisie manuelle, ces données seront <strong>remplacées</strong>. Souhaitez-vous
              continuer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmLiveOverwrite(false)}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmLiveOverwrite(false); performSave(); }}>
              Continuer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {posDialog && (() => {
        const isOpp = posDialog.targetKey === "opp";
        const row = isOpp ? opponent[period] : (stats[posDialog.targetKey] ?? emptyPeriodStats())[period];
        const count = (row[posDialog.statKey] as number) ?? 0;
        const positions = row.positions?.[posDialog.statKey] ?? [];
        const missedKeys: PositionableStatKey[] = ["conversionsMissed", "penaltiesMissed", "dropsMissed", "scrumsLost", "lineoutsLost"];
        const isMissed = missedKeys.includes(posDialog.statKey);
        return (
          <ManualRugbyPositionDialog
            open
            onOpenChange={(o) => { if (!o) setPosDialog(null); }}
            kind={POSITIONABLE_KIND[posDialog.statKey]}
            count={count}
            positions={positions}
            contextLabel={posDialog.contextLabel}
            missed={isMissed}
            onSave={(list) => {
              if (isOpp) updateOpponentPositions(posDialog.statKey, list);
              else updatePlayerPositions(posDialog.targetKey, posDialog.statKey, list);
              setPosDialog(null);
            }}
          />
        );
      })()}
    </>
  );
}
