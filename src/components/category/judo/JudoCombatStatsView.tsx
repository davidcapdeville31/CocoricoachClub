import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import {
  Plus,
  Trash2,
  Trophy,
  Timer,
  Swords,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  Hand,
  Flag,
  Zap,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  JUDO_TECHNIQUES,
  JUDO_TECHNIQUE_FAMILIES,
  techStatKey,
} from "@/lib/constants/judoTechniques";

// ============================================================================
// JUDO COMBAT — IJF RULE-AWARE SCORING UI
// ----------------------------------------------------------------------------
// Tap-based post-combat capture with implicit IJF rule engine:
//   - 2 Waza-ari → Ippon (waza-ari awasete ippon) → fin immédiate
//   - 3 Shido    → Hansoku-make → fin immédiate
//   - Osaekomi   : 10s = Waza-ari, 20s = Ippon
//   - Soumission : fin immédiate
//   - Yuko / Koka : SUPPRIMÉS (non disponibles)
//   - Golden Score : prolongation illimitée, fin sur 1er score / shido décisif
// ----------------------------------------------------------------------------
// Persistance : on conserve `stats: Record<string, number>` + `result` + `notes`
// pour ne pas casser le schéma. Toutes les valeurs sont stockées comme clés
// numériques ou flags (0/1). Le résultat est recalculé en live.
// ============================================================================

interface JudoRound {
  round_number: number;
  opponent_name: string;
  opponent_profile_id?: string | null;
  result: string;
  notes: string;
  stats: Record<string, number>;
  phase: string;
  isLocked?: boolean;
}

interface OpponentProfile {
  id: string;
  last_name: string;
  first_name?: string | null;
  gender?: string | null;
  weight_category?: string | null;
  handedness?: string | null;
}

interface SelectedPlayer {
  entryKey: string;
  playerId: string;
  playerName: string;
  playerGender?: string | null;
  playerWeightCategory?: string | null;
  rounds: JudoRound[];
}

interface Props {
  selectedPlayer: SelectedPlayer;
  phases: { value: string; label: string }[];
  opponentProfiles: OpponentProfile[] | undefined;
  addRound: (entryKey: string) => void;
  removeRound: (entryKey: string, roundNumber: number) => void;
  updateRound: (entryKey: string, roundNumber: number, updates: Partial<JudoRound>) => void;
  updateRoundStat: (
    entryKey: string,
    roundNumber: number,
    statKey: string,
    value: number,
  ) => void;
}

// ----- Stat keys -----------------------------------------------------------
const K = {
  // Scores
  wazariMe: "ijf_wazari_me",
  wazariOpp: "ijf_wazari_opp",
  ipponMe: "ijf_ippon_me",
  ipponOpp: "ijf_ippon_opp",
  // Pénalités
  shidoMe: "ijf_shido_me",
  shidoOpp: "ijf_shido_opp",
  hansokuDirectMe: "ijf_hansoku_direct_me",
  hansokuDirectOpp: "ijf_hansoku_direct_opp",
  // Ne-waza
  submissionMe: "ijf_submission_me",
  submissionOpp: "ijf_submission_opp",
  osaekomiMeSec: "ijf_osaekomi_me_sec",
  osaekomiOppSec: "ijf_osaekomi_opp_sec",
  // Temps
  combatDuration: "combatDuration",
  goldenScore: "goldenScore",
  goldenScoreDuration: "goldenScoreDuration",
  // Tactique
  dominanceStanding: "ijf_dominance_standing", // 0..100 (%)
  // Fin de combat (manuel coach) — enum: 1 ippon · 2 wazari · 3 wazari_awasete · 4 hansoku · 5 decision · 6 abandon · 7 forfait
  endMethod: "ijf_end_method",
  // Golden Score — décision en GS : 1 technique · 2 penalty · 3 shido_accumulation
  gsDecision: "ijf_gs_decision",
  // Défense
  defAttacksReceived: "ijf_def_attacks_received",
  defAttacksNeutralized: "ijf_def_attacks_neutralized",
  defScoresConceded: "ijf_def_scores_conceded",
  // Profil d'activité : 1 très actif · 2 actif · 3 neutre · 4 passif
  activityProfile: "ijf_activity_profile",
  // Profil combat : 1 dominant · 2 équilibré · 3 dominé · 4 contrôle sans score · 5 explosif · 6 défensif
  combatProfile: "ijf_combat_profile",
  // Style adversaire (bitmask) : 1 attaquant · 2 contreur · 4 physique · 8 technique · 16 kumikata · 32 passif
  opponentStyleMask: "ijf_opp_style_mask",
  // Ne-waza extended
  groundTimeSec: "groundTimeSeconds",
  groundPhases: "ijf_ne_phases",
  immoAttempts: "immobilizationAttempts",
  immoSuccess: "ijf_immo_success",
  immoMaxSec: "ijf_immo_max_sec",
  chokeAttempts: "chokeAttempts",
  chokeSuccess: "ijf_choke_success",
  armlockAttempts: "armLockAttempts",
  armlockSuccess: "ijf_armlock_success",
  transitionStandToGround: "ijf_transition_s2g",
  regainGround: "ijf_regain_ground",
  // Compat historique
  victoryModeIppon: "victoryModeIppon",
  victoryModeWazaari: "victoryModeWazaari",
  victoryModeHansoku: "victoryModeHansoku",
  hansokuMake: "hansokuMake",
} as const;

type EndCause =
  | "ippon_throw"
  | "wazari_awasete"
  | "wazari_score" // décision sur waza-ari en GS / shido décisif inverse
  | "hansoku_indirect"
  | "hansoku_direct"
  | "submission"
  | "osaekomi_ippon"
  | "decision"
  | "golden_score"
  | "pending";

interface ComputedResult {
  winner: "me" | "opp" | "draw" | "pending";
  cause: EndCause;
  causeLabel: string;
  ipponMe: number;
  ipponOpp: number;
  wazariMe: number;
  wazariOpp: number;
  shidoMe: number;
  shidoOpp: number;
  scoreLabel: string; // "I:0 W:1 / S:1" style
}

const num = (v: unknown) => Number(v) || 0;

function computeResult(stats: Record<string, number> | undefined, manualResult: string): ComputedResult {
  const s = stats || {};
  const wazariMe = num(s[K.wazariMe]);
  const wazariOpp = num(s[K.wazariOpp]);
  const ipponMe = num(s[K.ipponMe]);
  const ipponOpp = num(s[K.ipponOpp]);
  const shidoMe = num(s[K.shidoMe]);
  const shidoOpp = num(s[K.shidoOpp]);
  const subMe = num(s[K.submissionMe]) > 0;
  const subOpp = num(s[K.submissionOpp]) > 0;
  const hansokuDirectMe = num(s[K.hansokuDirectMe]) > 0;
  const hansokuDirectOpp = num(s[K.hansokuDirectOpp]) > 0;
  const osaeMe = num(s[K.osaekomiMeSec]);
  const osaeOpp = num(s[K.osaekomiOppSec]);

  // Calcul des "effectifs" (osaekomi qui dégénèrent en score)
  // 10s → waza-ari, 20s → ippon. On ajoute aux compteurs visibles.
  const wMeEff = wazariMe + (osaeMe >= 10 && osaeMe < 20 ? 1 : 0);
  const wOppEff = wazariOpp + (osaeOpp >= 10 && osaeOpp < 20 ? 1 : 0);
  const iMeEff = ipponMe + (osaeMe >= 20 ? 1 : 0);
  const iOppEff = ipponOpp + (osaeOpp >= 20 ? 1 : 0);

  // Waza-ari awasete ippon
  const wazariIpponMe = wMeEff >= 2;
  const wazariIpponOpp = wOppEff >= 2;

  const scoreLabel = `Ippon ${iMeEff}–${iOppEff} · Waza-ari ${wMeEff}–${wOppEff} · Shido ${shidoMe}–${shidoOpp}`;

  // Priorités IJF de fin de combat (premier vrai)
  // 1) Soumission immédiate
  if (subMe) return mk("opp", "submission", "Soumission (abandon athlète)");
  if (subOpp) return mk("me", "submission", "Soumission adverse");
  // 2) Hansoku-make direct
  if (hansokuDirectMe) return mk("opp", "hansoku_direct", "Hansoku-make direct (athlète)");
  if (hansokuDirectOpp) return mk("me", "hansoku_direct", "Hansoku-make direct (adversaire)");
  // 3) 3 Shido = Hansoku-make indirect
  if (shidoMe >= 3) return mk("opp", "hansoku_indirect", "Hansoku-make (3 shido athlète)");
  if (shidoOpp >= 3) return mk("me", "hansoku_indirect", "Hansoku-make (3 shido adversaire)");
  // 4) Ippon direct (projection / osaekomi 20s)
  if (iMeEff > 0) {
    return mk(
      "me",
      osaeMe >= 20 ? "osaekomi_ippon" : "ippon_throw",
      osaeMe >= 20 ? "Ippon — Osaekomi 20s" : "Ippon",
    );
  }
  if (iOppEff > 0) {
    return mk(
      "opp",
      osaeOpp >= 20 ? "osaekomi_ippon" : "ippon_throw",
      osaeOpp >= 20 ? "Ippon adverse — Osaekomi 20s" : "Ippon adverse",
    );
  }
  // 5) Waza-ari awasete ippon
  if (wazariIpponMe) return mk("me", "wazari_awasete", "Waza-ari awasete ippon");
  if (wazariIpponOpp) return mk("opp", "wazari_awasete", "Waza-ari awasete ippon (adverse)");

  // Pas de fin nette → état "en cours" / décision possible
  // On ne respecte manualResult QUE s'il y a au moins un score / pénalité saisi
  const hasAnyActivity =
    wMeEff > 0 || wOppEff > 0 || iMeEff > 0 || iOppEff > 0 || shidoMe > 0 || shidoOpp > 0;
  if (
    hasAnyActivity &&
    (manualResult === "win" || manualResult === "loss" || manualResult === "draw")
  ) {
    const winner = manualResult === "win" ? "me" : manualResult === "loss" ? "opp" : "draw";
    const cause: EndCause = num(s[K.goldenScore]) > 0 ? "golden_score" : "decision";
    return {
      winner,
      cause,
      causeLabel:
        cause === "golden_score" ? "Décision Golden Score" : "Décision (waza-ari / shido)",
      ipponMe: iMeEff,
      ipponOpp: iOppEff,
      wazariMe: wMeEff,
      wazariOpp: wOppEff,
      shidoMe,
      shidoOpp,
      scoreLabel,
    };
  }

  return {
    winner: "pending",
    cause: "pending",
    causeLabel: "Combat en cours / résultat à confirmer",
    ipponMe: iMeEff,
    ipponOpp: iOppEff,
    wazariMe: wMeEff,
    wazariOpp: wOppEff,
    shidoMe,
    shidoOpp,
    scoreLabel,
  };

  function mk(winner: "me" | "opp", cause: EndCause, causeLabel: string): ComputedResult {
    return {
      winner,
      cause,
      causeLabel,
      ipponMe: iMeEff,
      ipponOpp: iOppEff,
      wazariMe: wMeEff,
      wazariOpp: wOppEff,
      shidoMe,
      shidoOpp,
      scoreLabel,
    };
  }
}

const fmtMMSS = (sec: number) => {
  if (!sec || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const parseMMSS = (txt: string): number => {
  const m = txt.match(/^\s*(\d+)\s*:\s*(\d{1,2})\s*$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const n = parseInt(txt, 10);
  return Number.isFinite(n) ? n : 0;
};

// ============================================================================
// MAIN VIEW
// ============================================================================
export function JudoCombatStatsView({
  selectedPlayer,
  phases,
  opponentProfiles,
  addRound,
  removeRound,
  updateRound,
  updateRoundStat,
}: Props) {
  const [activeRoundNumber, setActiveRoundNumber] = useState<number | null>(
    selectedPlayer.rounds[0]?.round_number ?? null,
  );

  // Si on ajoute / supprime, on s'aligne sur un combat existant
  useEffect(() => {
    if (selectedPlayer.rounds.length === 0) {
      setActiveRoundNumber(null);
      return;
    }
    if (!selectedPlayer.rounds.find((r) => r.round_number === activeRoundNumber)) {
      setActiveRoundNumber(selectedPlayer.rounds[selectedPlayer.rounds.length - 1].round_number);
    }
  }, [selectedPlayer.rounds, activeRoundNumber]);

  const activeRound = selectedPlayer.rounds.find((r) => r.round_number === activeRoundNumber);

  // ------- Cumul tournoi --------
  const totals = useMemo(() => {
    let wins = 0,
      losses = 0,
      draws = 0,
      totalSec = 0,
      gsCount = 0,
      ippon = 0,
      wazari = 0,
      shido = 0,
      hansoku = 0;
    for (const r of selectedPlayer.rounds) {
      const c = computeResult(r.stats, r.result);
      if (c.winner === "me") wins++;
      else if (c.winner === "opp") losses++;
      else if (c.winner === "draw") draws++;
      totalSec += num(r.stats?.[K.combatDuration]);
      if (num(r.stats?.[K.goldenScore]) > 0) gsCount++;
      ippon += c.ipponMe;
      wazari += c.wazariMe;
      shido += c.shidoMe;
      if (c.cause === "hansoku_direct" || c.cause === "hansoku_indirect") {
        if (c.winner === "opp") hansoku++;
      }
    }
    return { wins, losses, draws, totalSec, gsCount, ippon, wazari, shido, hansoku };
  }, [selectedPlayer.rounds]);

  // ------- Opponents select --------
  const sortedOpps = useMemo(() => {
    const all = opponentProfiles || [];
    const matches = (o: OpponentProfile) =>
      (!selectedPlayer.playerGender || !o.gender || o.gender === selectedPlayer.playerGender) &&
      (!selectedPlayer.playerWeightCategory ||
        !o.weight_category ||
        o.weight_category === selectedPlayer.playerWeightCategory);
    return {
      matched: all.filter(matches),
      others: all.filter((o) => !matches(o)),
    };
  }, [opponentProfiles, selectedPlayer.playerGender, selectedPlayer.playerWeightCategory]);

  const fmtOpp = (o: OpponentProfile) =>
    `${o.last_name}${o.first_name ? " " + o.first_name : ""}` +
    (o.weight_category ? ` (${o.weight_category.replace(/^judo_/, "")})` : "") +
    (o.handedness === "left" ? " G" : o.handedness === "right" ? " D" : "");

  // ----- Empty state -----
  if (selectedPlayer.rounds.length === 0 || !activeRound) {
    return (
      <div className="text-center py-10 text-muted-foreground space-y-4">
        <Swords className="h-12 w-12 mx-auto opacity-40" />
        <p>Aucun combat enregistré pour {selectedPlayer.playerName}</p>
        <Button
          size="sm"
          onClick={() => addRound(selectedPlayer.entryKey)}
          className="gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
        >
          <Plus className="h-4 w-4" /> Démarrer un combat
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* CUMUL TOURNOI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatPill label="Combats" value={selectedPlayer.rounds.length} />
        <StatPill
          label="Bilan"
          value={`${totals.wins}V / ${totals.losses}D${totals.draws ? ` / ${totals.draws}E` : ""}`}
          accent="success"
        />
        <StatPill
          label="Temps cumulé"
          value={fmtMMSS(totals.totalSec)}
          accent="info"
          icon={<Timer className="h-3.5 w-3.5" />}
        />
        <StatPill
          label="Golden Score"
          value={`${totals.gsCount} combat${totals.gsCount > 1 ? "s" : ""}`}
          accent={totals.gsCount > 0 ? "warning" : "muted"}
        />
      </div>

      {/* ROUND SELECTOR */}
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedPlayer.rounds.map((r) => {
          const c = computeResult(r.stats, r.result);
          const active = r.round_number === activeRoundNumber;
          return (
            <Button
              key={r.round_number}
              variant={active ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveRoundNumber(r.round_number)}
              className={cn(
                "h-8 gap-1.5 text-xs",
                !active && c.winner === "me" && "border-emerald-500/60 text-emerald-700 dark:text-emerald-400",
                !active && c.winner === "opp" && "border-red-500/60 text-red-700 dark:text-red-400",
              )}
            >
              <span className="font-bold">C{r.round_number}</span>
              {r.opponent_name && (
                <span className="hidden sm:inline opacity-80 truncate max-w-[120px]">
                  {r.opponent_name}
                </span>
              )}
              {c.winner === "me" && <Trophy className="h-3 w-3" />}
            </Button>
          );
        })}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => addRound(selectedPlayer.entryKey)}
          className="h-8 gap-1 text-xs"
        >
          <Plus className="h-3.5 w-3.5" /> Combat
        </Button>
      </div>

      {/* ACTIVE COMBAT PANEL */}
      <CombatPanel
        key={activeRound.round_number}
        round={activeRound}
        phases={phases}
        sortedOpps={sortedOpps}
        fmtOpp={fmtOpp}
        opponentProfiles={opponentProfiles}
        onUpdate={(u) => updateRound(selectedPlayer.entryKey, activeRound.round_number, u)}
        onUpdateStat={(k, v) =>
          updateRoundStat(selectedPlayer.entryKey, activeRound.round_number, k, v)
        }
        onRemove={() => removeRound(selectedPlayer.entryKey, activeRound.round_number)}
      />
    </div>
  );
}

// ============================================================================
// COMBAT PANEL (per round)
// ============================================================================
function CombatPanel({
  round,
  phases,
  sortedOpps,
  fmtOpp,
  opponentProfiles,
  onUpdate,
  onUpdateStat,
  onRemove,
}: {
  round: JudoRound;
  phases: { value: string; label: string }[];
  sortedOpps: { matched: OpponentProfile[]; others: OpponentProfile[] };
  fmtOpp: (o: OpponentProfile) => string;
  opponentProfiles: OpponentProfile[] | undefined;
  onUpdate: (u: Partial<JudoRound>) => void;
  onUpdateStat: (k: string, v: number) => void;
  onRemove: () => void;
}) {
  const result = useMemo(() => computeResult(round.stats, round.result), [round.stats, round.result]);

  // Autosave du résultat calculé dans `result` (et compat victoryMode*)
  useEffect(() => {
    const targetResult =
      result.winner === "me"
        ? "win"
        : result.winner === "opp"
        ? "loss"
        : result.winner === "draw"
        ? "draw"
        : "";
    if (targetResult !== (round.result || "")) {
      onUpdate({ result: targetResult });
    }
    // Compat anciens flags
    const flags: Array<[string, number]> = [
      [
        K.victoryModeIppon,
        result.winner === "me" &&
        (result.cause === "ippon_throw" || result.cause === "osaekomi_ippon")
          ? 1
          : 0,
      ],
      [K.victoryModeWazaari, result.winner === "me" && result.cause === "wazari_awasete" ? 1 : 0],
      [
        K.victoryModeHansoku,
        result.winner === "me" &&
        (result.cause === "hansoku_direct" || result.cause === "hansoku_indirect")
          ? 1
          : 0,
      ],
      [
        K.hansokuMake,
        result.cause === "hansoku_direct" || result.cause === "hansoku_indirect" ? 1 : 0,
      ],
    ];
    for (const [k, v] of flags) {
      if (num(round.stats?.[k]) !== v) onUpdateStat(k, v);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.winner, result.cause]);

  return (
    <div className="space-y-4">
      {/* ============== HEADER COMBAT ============== */}
      <Card className="p-3 space-y-3 border-l-4 border-l-destructive shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Phase</Label>
            <Select value={round.phase} onValueChange={(v) => onUpdate({ phase: v })}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Phase" />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                {phases.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 md:col-span-2">
            <Label className="text-[10px] uppercase text-muted-foreground">Adversaire</Label>
            <div className="flex gap-1">
              <Select
                value={round.opponent_profile_id || "__manual__"}
                onValueChange={(v) => {
                  if (v === "__manual__") {
                    onUpdate({ opponent_profile_id: null });
                  } else {
                    const op = (opponentProfiles || []).find((o) => o.id === v);
                    if (op) {
                      onUpdate({
                        opponent_profile_id: op.id,
                        opponent_name: `${op.last_name}${op.first_name ? " " + op.first_name : ""}`,
                      });
                    }
                  }
                }}
              >
                <SelectTrigger className="h-9 text-xs flex-1">
                  <SelectValue placeholder="Adversaire" />
                </SelectTrigger>
                <SelectContent className="z-[200] max-h-[300px]">
                  <SelectItem value="__manual__">— Saisie libre —</SelectItem>
                  {sortedOpps.matched.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">
                        Catégorie de l'athlète
                      </div>
                      {sortedOpps.matched.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {fmtOpp(o)}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {sortedOpps.others.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">
                        Autres
                      </div>
                      {sortedOpps.others.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {fmtOpp(o)}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              <Input
                value={round.opponent_name}
                onChange={(e) =>
                  onUpdate({ opponent_name: e.target.value, opponent_profile_id: null })
                }
                placeholder="Nom"
                className="h-9 w-[140px] text-xs"
              />
            </div>
          </div>
        </div>

        {/* RESULT BANNER */}
        <ResultBanner result={result} />

        {/* DURÉES */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <DurationInput
            label="Durée totale"
            value={num(round.stats?.[K.combatDuration])}
            onChange={(v) => onUpdateStat(K.combatDuration, v)}
          />
          <DurationInput
            label="Durée Golden Score"
            value={num(round.stats?.[K.goldenScoreDuration])}
            onChange={(v) => {
              onUpdateStat(K.goldenScoreDuration, v);
              if (v > 0 && num(round.stats?.[K.goldenScore]) === 0) onUpdateStat(K.goldenScore, 1);
              if (v === 0 && num(round.stats?.[K.goldenScore]) > 0) onUpdateStat(K.goldenScore, 0);
            }}
            disabled={num(round.stats?.[K.goldenScore]) === 0}
          />
          <div className="col-span-2 sm:col-span-2 flex items-end">
            <Button
              type="button"
              variant={num(round.stats?.[K.goldenScore]) > 0 ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-9 w-full gap-2 text-xs",
                num(round.stats?.[K.goldenScore]) > 0 &&
                  "bg-amber-500 hover:bg-amber-500/90 text-white",
              )}
              onClick={() =>
                onUpdateStat(K.goldenScore, num(round.stats?.[K.goldenScore]) > 0 ? 0 : 1)
              }
            >
              <Flag className="h-4 w-4" />
              Golden Score {num(round.stats?.[K.goldenScore]) > 0 ? "ON" : "OFF"}
            </Button>
          </div>
        </div>

        {/* MÉTHODE DE FIN (manuelle, complète l'auto-calcul) */}
        <EnumPills
          label="Méthode de fin"
          value={num(round.stats?.[K.endMethod])}
          options={[
            { v: 1, label: "Ippon" },
            { v: 2, label: "Waza-ari" },
            { v: 3, label: "Waza-ari awasete ippon" },
            { v: 4, label: "Hansoku-make" },
            { v: 5, label: "Décision" },
            { v: 6, label: "Abandon" },
            { v: 7, label: "Forfait" },
          ]}
          onChange={(v) => onUpdateStat(K.endMethod, v)}
        />

        {/* DÉCISION GOLDEN SCORE — visible si GS=ON */}
        {num(round.stats?.[K.goldenScore]) > 0 && (
          <EnumPills
            label="Type de décision en GS"
            value={num(round.stats?.[K.gsDecision])}
            color="amber"
            options={[
              { v: 1, label: "Technique" },
              { v: 2, label: "Pénalité décisive" },
              { v: 3, label: "Accumulation shido" },
            ]}
            onChange={(v) => onUpdateStat(K.gsDecision, v)}
          />
        )}
      </Card>

      {/* ============== SCORES (OFFENSIVE) ============== */}
      <Card className="p-3 space-y-3">
        <SectionHeader icon={<Zap className="h-4 w-4 text-emerald-500" />} title="Scores IJF" hint="2 Waza-ari = Ippon automatique" />
        <div className="grid grid-cols-2 gap-3">
          <ScoreColumn
            label="Athlète"
            color="emerald"
            ippon={num(round.stats?.[K.ipponMe])}
            wazari={num(round.stats?.[K.wazariMe])}
            onIppon={(v) => onUpdateStat(K.ipponMe, Math.max(0, Math.min(1, v)))}
            onWazari={(v) => onUpdateStat(K.wazariMe, Math.max(0, Math.min(2, v)))}
          />
          <ScoreColumn
            label="Adversaire"
            color="red"
            ippon={num(round.stats?.[K.ipponOpp])}
            wazari={num(round.stats?.[K.wazariOpp])}
            onIppon={(v) => onUpdateStat(K.ipponOpp, Math.max(0, Math.min(1, v)))}
            onWazari={(v) => onUpdateStat(K.wazariOpp, Math.max(0, Math.min(2, v)))}
          />
        </div>
      </Card>

      {/* ============== PÉNALITÉS ============== */}
      <Card className="p-3 space-y-3">
        <SectionHeader
          icon={<ShieldAlert className="h-4 w-4 text-amber-500" />}
          title="Pénalités (Shido)"
          hint="3 Shido = Hansoku-make"
        />
        <div className="grid grid-cols-2 gap-3">
          <ShidoColumn
            label="Athlète"
            color="amber"
            shido={num(round.stats?.[K.shidoMe])}
            hansokuDirect={num(round.stats?.[K.hansokuDirectMe]) > 0}
            onShido={(v) => onUpdateStat(K.shidoMe, Math.max(0, Math.min(3, v)))}
            onHansokuDirect={(v) => onUpdateStat(K.hansokuDirectMe, v ? 1 : 0)}
          />
          <ShidoColumn
            label="Adversaire"
            color="amber"
            shido={num(round.stats?.[K.shidoOpp])}
            hansokuDirect={num(round.stats?.[K.hansokuDirectOpp]) > 0}
            onShido={(v) => onUpdateStat(K.shidoOpp, Math.max(0, Math.min(3, v)))}
            onHansokuDirect={(v) => onUpdateStat(K.hansokuDirectOpp, v ? 1 : 0)}
          />
        </div>
      </Card>

      {/* ============== NE-WAZA ============== */}
      <Card className="p-3 space-y-3">
        <SectionHeader
          icon={<Hand className="h-4 w-4 text-blue-500" />}
          title="Ne-waza (sol)"
          hint="Osaekomi : 10s = Waza-ari · 20s = Ippon — Soumission = fin immédiate"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <OsaekomiTimer
            label="Osaekomi Athlète"
            color="emerald"
            seconds={num(round.stats?.[K.osaekomiMeSec])}
            onChange={(v) => onUpdateStat(K.osaekomiMeSec, v)}
          />
          <OsaekomiTimer
            label="Osaekomi Adversaire"
            color="red"
            seconds={num(round.stats?.[K.osaekomiOppSec])}
            onChange={(v) => onUpdateStat(K.osaekomiOppSec, v)}
          />
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant={num(round.stats?.[K.submissionMe]) > 0 ? "default" : "outline"}
            className={cn(
              "h-12 gap-2 text-xs",
              num(round.stats?.[K.submissionMe]) > 0 && "bg-red-600 hover:bg-red-700 text-white",
            )}
            onClick={() =>
              onUpdateStat(K.submissionMe, num(round.stats?.[K.submissionMe]) > 0 ? 0 : 1)
            }
          >
            <AlertTriangle className="h-4 w-4" />
            Soumission athlète (abandon)
          </Button>
          <Button
            type="button"
            variant={num(round.stats?.[K.submissionOpp]) > 0 ? "default" : "outline"}
            className={cn(
              "h-12 gap-2 text-xs",
              num(round.stats?.[K.submissionOpp]) > 0 &&
                "bg-emerald-600 hover:bg-emerald-700 text-white",
            )}
            onClick={() =>
              onUpdateStat(K.submissionOpp, num(round.stats?.[K.submissionOpp]) > 0 ? 0 : 1)
            }
          >
            <Trophy className="h-4 w-4" />
            Soumission adverse
          </Button>
        </div>
      </Card>

      {/* ============== NE-WAZA DÉTAILLÉ (volumes, transitions) ============== */}
      <Card className="p-3 space-y-3">
        <SectionHeader
          icon={<Hand className="h-4 w-4 text-amber-500" />}
          title="Ne-waza détaillé"
          hint="Volumes, transitions, soumissions"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <CounterStat label="Phases au sol" value={num(round.stats?.[K.groundPhases])} onChange={(v) => onUpdateStat(K.groundPhases, v)} />
          <CounterStat label="Temps sol (s)" value={num(round.stats?.[K.groundTimeSec])} step={5} onChange={(v) => onUpdateStat(K.groundTimeSec, v)} />
          <CounterStat label="Transitions debout→sol" value={num(round.stats?.[K.transitionStandToGround])} onChange={(v) => onUpdateStat(K.transitionStandToGround, v)} />
          <CounterStat label="Reprises au sol" value={num(round.stats?.[K.regainGround])} onChange={(v) => onUpdateStat(K.regainGround, v)} />
        </div>
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AttemptSuccessRow
            label="Immobilisations"
            attempts={num(round.stats?.[K.immoAttempts])}
            success={num(round.stats?.[K.immoSuccess])}
            extraLabel="Max (s)"
            extraValue={num(round.stats?.[K.immoMaxSec])}
            onAttempts={(v) => onUpdateStat(K.immoAttempts, v)}
            onSuccess={(v) => onUpdateStat(K.immoSuccess, v)}
            onExtra={(v) => onUpdateStat(K.immoMaxSec, v)}
            extraStep={5}
          />
          <AttemptSuccessRow
            label="Étranglements"
            attempts={num(round.stats?.[K.chokeAttempts])}
            success={num(round.stats?.[K.chokeSuccess])}
            onAttempts={(v) => onUpdateStat(K.chokeAttempts, v)}
            onSuccess={(v) => onUpdateStat(K.chokeSuccess, v)}
          />
          <AttemptSuccessRow
            label="Clés articulaires"
            attempts={num(round.stats?.[K.armlockAttempts])}
            success={num(round.stats?.[K.armlockSuccess])}
            onAttempts={(v) => onUpdateStat(K.armlockAttempts, v)}
            onSuccess={(v) => onUpdateStat(K.armlockSuccess, v)}
          />
        </div>
      </Card>

      {/* ============== DÉFENSE ============== */}
      <Card className="p-3 space-y-3">
        <SectionHeader
          icon={<ShieldAlert className="h-4 w-4 text-red-500" />}
          title="Défense"
          hint="Volume défensif et résistance"
        />
        <div className="grid grid-cols-3 gap-2">
          <CounterStat label="Attaques subies" value={num(round.stats?.[K.defAttacksReceived])} onChange={(v) => onUpdateStat(K.defAttacksReceived, v)} color="red" />
          <CounterStat label="Attaques neutralisées" value={num(round.stats?.[K.defAttacksNeutralized])} onChange={(v) => onUpdateStat(K.defAttacksNeutralized, v)} color="emerald" />
          <div className="rounded-lg border-2 border-dashed border-amber-500/40 bg-amber-500/5 p-2 flex flex-col items-center justify-center">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Scores concédés</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {num(round.stats?.[K.wazariOpp]) + num(round.stats?.[K.ipponOpp])}
            </p>
            <p className="text-[9px] text-muted-foreground">auto (Waza-ari + Ippon adverse)</p>
          </div>
        </div>
        {num(round.stats?.[K.defAttacksReceived]) > 0 && (
          <div className="rounded-lg bg-muted/40 p-2 text-center text-xs">
            <span className="font-bold">
              {Math.round(
                (num(round.stats?.[K.defAttacksNeutralized]) /
                  Math.max(1, num(round.stats?.[K.defAttacksReceived]))) *
                  100,
              )}
              %
            </span>{" "}
            d'attaques neutralisées
          </div>
        )}
        <EnumPills
          label="Profil d'activité défensive"
          value={num(round.stats?.[K.activityProfile])}
          options={[
            { v: 1, label: "Très actif" },
            { v: 2, label: "Actif" },
            { v: 3, label: "Neutre" },
            { v: 4, label: "Passif" },
          ]}
          onChange={(v) => onUpdateStat(K.activityProfile, v)}
        />
      </Card>

      {/* ============== COACH INTELLIGENCE ============== */}
      <Card className="p-3 space-y-3">
        <SectionHeader
          icon={<Swords className="h-4 w-4 text-violet-500" />}
          title="Analyse tactique"
          hint="Lecture coach rapide"
        />
        <EnumPills
          label="Profil de combat"
          value={num(round.stats?.[K.combatProfile])}
          color="violet"
          options={[
            { v: 1, label: "Dominant" },
            { v: 2, label: "Équilibré" },
            { v: 3, label: "Dominé" },
            { v: 4, label: "Contrôle sans score" },
            { v: 5, label: "Explosif" },
            { v: 6, label: "Défensif" },
          ]}
          onChange={(v) => onUpdateStat(K.combatProfile, v)}
        />
        <TagPills
          label="Style adversaire (multi-sélection)"
          mask={num(round.stats?.[K.opponentStyleMask])}
          options={[
            { bit: 1, label: "Attaquant" },
            { bit: 2, label: "Contreur" },
            { bit: 4, label: "Physique" },
            { bit: 8, label: "Technique" },
            { bit: 16, label: "Kumikata dominant" },
            { bit: 32, label: "Passif" },
          ]}
          onChange={(m) => onUpdateStat(K.opponentStyleMask, m)}
        />
        <Separator />
        <DominanceSlider
          value={num(round.stats?.[K.dominanceStanding])}
          onChange={(v) => onUpdateStat(K.dominanceStanding, v)}
        />
      </Card>

      {/* ============== TECHNIQUES OFFENSIVE (DÉTAIL) ============== */}
      <Card className="p-3 space-y-3">
        <SectionHeader
          icon={<Zap className="h-4 w-4 text-blue-500" />}
          title="Détail techniques offensives"
          hint="Saisie optionnelle pour analyse fine"
        />
        <OffensiveSynthesis round={round} />
        <AttackBlock round={round} onUpdateStat={onUpdateStat} />
      </Card>

      {/* ============== NOTES + ACTIONS ============== */}
      <Card className="p-3 space-y-2">
        <Label className="text-[10px] uppercase text-muted-foreground">Notes libres</Label>
        <Input
          value={round.notes || ""}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          placeholder="Observations, plan tactique, points à travailler…"
          className="h-9 text-xs"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={onRemove}
            className="text-destructive hover:text-destructive gap-1"
          >
            <Trash2 className="h-3.5 w-3.5" /> Supprimer ce combat
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// SUB COMPONENTS
// ============================================================================
function StatPill({
  label,
  value,
  accent = "muted",
  icon,
}: {
  label: string;
  value: string | number;
  accent?: "muted" | "success" | "info" | "warning";
  icon?: React.ReactNode;
}) {
  const cls =
    accent === "success"
      ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900"
      : accent === "info"
      ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900"
      : accent === "warning"
      ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900"
      : "bg-muted/40";
  return (
    <div className={cn("rounded-lg border p-2 text-center", cls)}>
      <p className="text-lg font-bold flex items-center justify-center gap-1">
        {icon}
        {value}
      </p>
      <p className="text-[10px] uppercase opacity-80">{label}</p>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  hint,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="text-sm font-bold uppercase tracking-wide">{title}</h4>
      </div>
      {hint && <p className="text-[10px] text-muted-foreground hidden sm:block">{hint}</p>}
    </div>
  );
}

function ResultBanner({ result }: { result: ComputedResult }) {
  const isPending = result.winner === "pending";
  const winnerColor =
    result.winner === "me"
      ? "bg-emerald-500 text-white"
      : result.winner === "opp"
      ? "bg-red-500 text-white"
      : result.winner === "draw"
      ? "bg-amber-500 text-white"
      : "bg-muted text-foreground";
  const winnerLabel =
    result.winner === "me"
      ? "VICTOIRE"
      : result.winner === "opp"
      ? "DÉFAITE"
      : result.winner === "draw"
      ? "ÉGALITÉ"
      : "EN COURS";
  return (
    <div
      className={cn(
        "rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2",
        winnerColor,
        isPending && "border-2 border-dashed border-border",
      )}
    >
      <div className="flex items-center gap-3">
        <Badge
          variant="secondary"
          className={cn(
            "h-7 px-3 text-[11px] font-extrabold tracking-wider",
            !isPending && "bg-white/95 text-foreground",
          )}
        >
          {winnerLabel}
        </Badge>
        <div className="leading-tight">
          <p className="text-xs font-semibold">{result.causeLabel}</p>
          <p className="text-[11px] opacity-90">{result.scoreLabel}</p>
        </div>
      </div>
    </div>
  );
}

function DurationInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(fmtMMSS(value));
  useEffect(() => setText(fmtMMSS(value)), [value]);
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase text-muted-foreground">{label}</Label>
      <Input
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange(parseMMSS(text))}
        placeholder="0:00"
        className="h-9 text-center text-xs font-mono"
      />
    </div>
  );
}

function ScoreColumn({
  label,
  color,
  ippon,
  wazari,
  onIppon,
  onWazari,
}: {
  label: string;
  color: "emerald" | "red";
  ippon: number;
  wazari: number;
  onIppon: (v: number) => void;
  onWazari: (v: number) => void;
}) {
  const palette =
    color === "emerald"
      ? {
          ring: "ring-emerald-500",
          btn: "bg-emerald-500 hover:bg-emerald-600 text-white",
          soft: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300",
        }
      : {
          ring: "ring-red-500",
          btn: "bg-red-500 hover:bg-red-600 text-white",
          soft: "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300",
        };
  return (
    <div className={cn("rounded-lg border p-2 space-y-2", palette.soft)}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-center">{label}</p>
      <CounterRow label="Ippon" value={ippon} max={1} onChange={onIppon} btnClass={palette.btn} />
      <CounterRow
        label="Waza-ari"
        value={wazari}
        max={2}
        onChange={onWazari}
        btnClass={palette.btn}
        helper={wazari >= 2 ? "→ Ippon !" : undefined}
      />
    </div>
  );
}

function ShidoColumn({
  label,
  color,
  shido,
  hansokuDirect,
  onShido,
  onHansokuDirect,
}: {
  label: string;
  color: "amber";
  shido: number;
  hansokuDirect: boolean;
  onShido: (v: number) => void;
  onHansokuDirect: (v: boolean) => void;
}) {
  return (
    <div className="rounded-lg border p-2 space-y-2 bg-amber-50/60 dark:bg-amber-950/20">
      <p className="text-[11px] font-bold uppercase tracking-wide text-center">{label}</p>
      <CounterRow
        label="Shido"
        value={shido}
        max={3}
        onChange={onShido}
        btnClass="bg-amber-500 hover:bg-amber-600 text-white"
        helper={
          shido >= 3
            ? "→ Hansoku-make !"
            : shido === 2
            ? "Pression forte"
            : shido === 1
            ? "Avertissement"
            : undefined
        }
      />
      <Button
        type="button"
        size="sm"
        variant={hansokuDirect ? "default" : "outline"}
        onClick={() => onHansokuDirect(!hansokuDirect)}
        className={cn(
          "w-full h-9 gap-1.5 text-xs",
          hansokuDirect && "bg-red-600 hover:bg-red-700 text-white",
        )}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Hansoku-make direct
      </Button>
    </div>
  );
}

function CounterRow({
  label,
  value,
  max,
  onChange,
  btnClass,
  helper,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
  btnClass: string;
  helper?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex-1">
        <p className="text-xs font-semibold">{label}</p>
        {helper && <p className="text-[10px] opacity-80">{helper}</p>}
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8"
          onClick={() => onChange(value - 1)}
          disabled={value <= 0}
        >
          −
        </Button>
        <div className="w-8 text-center font-bold tabular-nums">{value}</div>
        <Button
          type="button"
          size="icon"
          className={cn("h-8 w-8", btnClass)}
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
        >
          +
        </Button>
      </div>
    </div>
  );
}

function OsaekomiTimer({
  label,
  color,
  seconds,
  onChange,
}: {
  label: string;
  color: "emerald" | "red";
  seconds: number;
  onChange: (v: number) => void;
}) {
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        onChange(seconds + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, seconds]);

  const reached = seconds >= 20 ? "ippon" : seconds >= 10 ? "wazari" : "none";
  const palette =
    color === "emerald"
      ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
      : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300";

  // Progress jusqu'à 20s
  const pct = Math.min(100, (seconds / 20) * 100);

  return (
    <div className={cn("rounded-lg border p-2 space-y-2", palette)}>
      <p className="text-[11px] font-bold uppercase tracking-wide">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <div className="text-2xl font-bold font-mono tabular-nums">
          {seconds}s
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={running ? "default" : "outline"}
            className={cn("h-9 gap-1", running && "bg-emerald-600 text-white")}
            onClick={() => setRunning((r) => !r)}
          >
            {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {running ? "Stop" : "Start"}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9"
            onClick={() => {
              setRunning(false);
              onChange(0);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="h-2 rounded-full bg-white/60 dark:bg-black/40 overflow-hidden relative">
        <div
          className={cn(
            "h-full transition-all",
            reached === "ippon" ? "bg-red-500" : reached === "wazari" ? "bg-amber-500" : "bg-foreground/30",
          )}
          style={{ width: `${pct}%` }}
        />
        <div className="absolute inset-y-0 left-[50%] w-px bg-foreground/30" />
      </div>
      <p className="text-[10px] font-semibold">
        {reached === "ippon"
          ? "✓ Ippon (≥ 20s)"
          : reached === "wazari"
          ? "✓ Waza-ari (≥ 10s) — continuer pour Ippon"
          : `Encore ${10 - seconds}s pour Waza-ari`}
      </p>
    </div>
  );
}

function DominanceSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  // 0 = 100% sol, 100 = 100% debout, 50 = équilibré
  const v = Math.max(0, Math.min(100, value || 50));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] font-semibold">
        <span>🤼 Ne-waza (sol)</span>
        <span className="text-muted-foreground">
          {v}% debout / {100 - v}% sol
        </span>
        <span>🥋 Tachi-waza (debout)</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={v}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-violet-500"
      />
      <div className="flex flex-wrap gap-1">
        {[
          { label: "100% sol", v: 0 },
          { label: "Sol dominant", v: 25 },
          { label: "Équilibré", v: 50 },
          { label: "Debout dominant", v: 75 },
          { label: "100% debout", v: 100 },
        ].map((opt) => (
          <Button
            key={opt.v}
            type="button"
            size="sm"
            variant={v === opt.v ? "default" : "outline"}
            className="h-7 text-[10px]"
            onClick={() => onChange(opt.v)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

// ----- Techniques offensive (table existante allégée) ----------------------
function AttackBlock({
  round,
  onUpdateStat,
}: {
  round: JudoRound;
  onUpdateStat: (key: string, value: number) => void;
}) {
  const [familyFilter, setFamilyFilter] = useState<string>("all");
  const STANDING_FAMILIES = ["te", "koshi", "ashi", "sutemi"];
  const GROUND_FAMILIES = ["ne_osae", "ne_shime", "ne_kansetsu"];
  const visibleTechniques =
    familyFilter === "all"
      ? JUDO_TECHNIQUES
      : JUDO_TECHNIQUES.filter((t) => t.family === familyFilter);
  const standingTechs = visibleTechniques.filter((t) => STANDING_FAMILIES.includes(t.family));
  const groundTechs = visibleTechniques.filter((t) => GROUND_FAMILIES.includes(t.family));

  const renderTechRow = (t: typeof JUDO_TECHNIQUES[number]) => {
    const att = num(round.stats?.[techStatKey(t.key, "att")]);
    const suc = num(round.stats?.[techStatKey(t.key, "suc")]);
    const pts = num(round.stats?.[techStatKey(t.key, "pts")]);
    const pct = att > 0 ? Math.round((suc / att) * 100) : null;
    return (
      <TableRow key={t.key}>
        <TableCell className="text-xs">
          <div className="font-medium">{t.label}</div>
          <div className="text-[10px] text-muted-foreground">
            {JUDO_TECHNIQUE_FAMILIES.find((f) => f.key === t.family)?.label}
          </div>
        </TableCell>
        {(["att", "suc", "pts"] as const).map((k) => {
          const value = k === "att" ? att : k === "suc" ? suc : pts;
          return (
            <TableCell key={k} className="p-1">
              <Input
                type="number"
                min={0}
                max={k === "suc" ? att || undefined : undefined}
                value={value || ""}
                onChange={(e) =>
                  onUpdateStat(techStatKey(t.key, k), parseFloat(e.target.value) || 0)
                }
                className="h-8 text-xs text-center"
                onWheel={(e) => e.currentTarget.blur()}
              />
            </TableCell>
          );
        })}
        <TableCell className="text-center text-xs">
          {pct !== null ? (
            <Badge variant={pct >= 50 ? "default" : pct >= 25 ? "secondary" : "outline"}>
              {pct}%
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      </TableRow>
    );
  };

  const renderTechTable = (techs: typeof JUDO_TECHNIQUES, title: string, headerBg: string) => {
    if (techs.length === 0) return null;
    return (
      <Card className="overflow-x-auto">
        <div className={cn("px-3 py-2 text-xs font-bold uppercase tracking-wide", headerBg)}>
          {title}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px] whitespace-nowrap">Technique</TableHead>
              <TableHead className="text-center w-20">Tent.</TableHead>
              <TableHead className="text-center w-20">Réuss.</TableHead>
              <TableHead className="text-center w-20">Pts</TableHead>
              <TableHead className="text-center w-20">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{techs.map(renderTechRow)}</TableBody>
        </Table>
      </Card>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs">Famille :</Label>
        <Select value={familyFilter} onValueChange={setFamilyFilter}>
          <SelectTrigger className="h-8 w-[220px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[200]">
            <SelectItem value="all">Toutes les techniques</SelectItem>
            {JUDO_TECHNIQUE_FAMILIES.map((f) => (
              <SelectItem key={f.key} value={f.key}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {renderTechTable(
        standingTechs,
        "Tachi-waza — Attaques debout",
        "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200",
      )}
      {renderTechTable(
        groundTechs,
        "Ne-waza — Attaques au sol",
        "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200",
      )}
    </div>
  );
}

// ============================================================================
// Helpers UI ajoutés (v2)
// ============================================================================
function EnumPills({
  label,
  value,
  options,
  onChange,
  color = "blue",
}: {
  label: string;
  value: number;
  options: { v: number; label: string }[];
  onChange: (v: number) => void;
  color?: "blue" | "amber" | "violet" | "emerald" | "red";
}) {
  const activeCls =
    color === "amber"
      ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
      : color === "violet"
      ? "bg-violet-500 hover:bg-violet-600 text-white border-violet-500"
      : color === "emerald"
      ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500"
      : color === "red"
      ? "bg-red-500 hover:bg-red-600 text-white border-red-500"
      : "bg-blue-500 hover:bg-blue-600 text-white border-blue-500";
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = value === o.v;
          return (
            <Button
              key={o.v}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onChange(active ? 0 : o.v)}
              className={cn("h-8 text-xs", active && activeCls)}
            >
              {o.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function TagPills({
  label,
  mask,
  options,
  onChange,
}: {
  label: string;
  mask: number;
  options: { bit: number; label: string }[];
  onChange: (mask: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = (mask & o.bit) === o.bit;
          return (
            <Button
              key={o.bit}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onChange(active ? mask & ~o.bit : mask | o.bit)}
              className={cn(
                "h-8 text-xs",
                active && "bg-violet-500 hover:bg-violet-600 text-white border-violet-500",
              )}
            >
              {o.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function CounterStat({
  label,
  value,
  onChange,
  step = 1,
  color = "muted",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  color?: "muted" | "red" | "emerald" | "amber";
}) {
  const tint =
    color === "red"
      ? "bg-red-50 dark:bg-red-950/30"
      : color === "emerald"
      ? "bg-emerald-50 dark:bg-emerald-950/30"
      : color === "amber"
      ? "bg-amber-50 dark:bg-amber-950/30"
      : "bg-muted/40";
  return (
    <div className={cn("rounded-lg border p-2 space-y-1 text-center", tint)}>
      <p className="text-[10px] uppercase text-muted-foreground leading-tight">{label}</p>
      <div className="flex items-center justify-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-7 w-7"
          onClick={() => onChange(Math.max(0, value - step))}
          disabled={value <= 0}
        >
          −
        </Button>
        <div className="w-10 text-base font-bold tabular-nums">{value}</div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-7 w-7"
          onClick={() => onChange(value + step)}
        >
          +
        </Button>
      </div>
    </div>
  );
}

function AttemptSuccessRow({
  label,
  attempts,
  success,
  onAttempts,
  onSuccess,
  extraLabel,
  extraValue,
  onExtra,
  extraStep = 1,
}: {
  label: string;
  attempts: number;
  success: number;
  onAttempts: (v: number) => void;
  onSuccess: (v: number) => void;
  extraLabel?: string;
  extraValue?: number;
  onExtra?: (v: number) => void;
  extraStep?: number;
}) {
  const pct = attempts > 0 ? Math.round((success / attempts) * 100) : null;
  return (
    <div className="rounded-lg border p-2 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase">{label}</p>
        {pct !== null && (
          <Badge variant={pct >= 50 ? "default" : pct >= 25 ? "secondary" : "outline"} className="text-[10px]">
            {pct}%
          </Badge>
        )}
      </div>
      <div className={cn("grid gap-1.5", extraLabel ? "grid-cols-3" : "grid-cols-2")}>
        <CounterStat label="Tentatives" value={attempts} onChange={onAttempts} />
        <CounterStat label="Réussies" value={success} onChange={(v) => onSuccess(Math.min(v, attempts || v))} color="emerald" />
        {extraLabel && onExtra && (
          <CounterStat label={extraLabel} value={extraValue || 0} onChange={onExtra} step={extraStep} />
        )}
      </div>
    </div>
  );
}

function OffensiveSynthesis({ round }: { round: JudoRound }) {
  const synth = useMemo(() => {
    let att = 0, suc = 0, pts = 0;
    for (const t of JUDO_TECHNIQUES) {
      att += num(round.stats?.[techStatKey(t.key, "att")]);
      suc += num(round.stats?.[techStatKey(t.key, "suc")]);
      pts += num(round.stats?.[techStatKey(t.key, "pts")]);
    }
    const pct = att > 0 ? Math.round((suc / att) * 100) : null;
    return { att, suc, pts, pct };
  }, [round.stats]);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <StatPill label="Total attaques" value={synth.att} />
      <StatPill label="Attaques efficaces" value={synth.suc} accent="success" />
      <StatPill label="Points générés" value={synth.pts} accent="info" />
      <StatPill
        label="% efficacité"
        value={synth.pct !== null ? `${synth.pct}%` : "—"}
        accent={synth.pct !== null && synth.pct >= 50 ? "success" : synth.pct !== null && synth.pct >= 25 ? "warning" : "muted"}
      />
    </div>
  );
}
