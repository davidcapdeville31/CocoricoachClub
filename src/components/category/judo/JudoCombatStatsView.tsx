import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { X, Plus, Trash2, Trophy, Swords, Hand, Zap, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoCompanionDock, VideoCompanionTrigger } from "@/components/shared/VideoCompanionPanel";

interface JudoRound {
  round_number: number;
  opponent_name: string;
  opponent_profile_id?: string | null;
  result: string;
  notes: string;
  stats: Record<string, number>;
  phase: string;
  isLocked?: boolean;
  video_url?: string | null;
}

interface OpponentProfile {
  id: string;
  last_name: string;
  first_name?: string | null;
  gender?: string | null;
  weight_category?: string | null;
  handedness?: string | null;
  combat_profile?: number | null;
  style_mask?: number | null;
  ground_standing_pref?: number | null;
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
  updateRoundStat: (entryKey: string, roundNumber: number, statKey: string, value: number) => void;
}

const K = {
  wazariMe: "ijf_wazari_me",
  wazariOpp: "ijf_wazari_opp",
  yukoMe: "ijf_yuko_me",
  yukoOpp: "ijf_yuko_opp",
  ipponMe: "ijf_ippon_me",
  ipponOpp: "ijf_ippon_opp",
  shidoMe: "ijf_shido_me",
  shidoOpp: "ijf_shido_opp",
  hansokuDirectMe: "ijf_hansoku_direct_me",
  hansokuDirectOpp: "ijf_hansoku_direct_opp",
  endMethod: "ijf_end_method",
  gsDecision: "ijf_gs_decision",
  goldenScore: "goldenScore",
  combatProfile: "ijf_combat_profile",
  opponentStyle: "ijf_opp_style_mask",
  immoScoreMe: "ijf_immo_score_me",
  immoScoreOpp: "ijf_immo_score_opp",
  transitionStandToGround: "ijf_transition_s2g",
  standingAttempts: "ijf_standing_attempts",
  standingSuccess: "ijf_standing_success",
} as const;

const num = (value: unknown) => Number(value) || 0;

function resolvedImmobilizationScore(stats: Record<string, number>, side: "me" | "opp") {
  const scoreKey = side === "me" ? K.immoScoreMe : K.immoScoreOpp;
  if (Object.prototype.hasOwnProperty.call(stats, scoreKey)) return num(stats[scoreKey]);
  const seconds = num(stats[side === "me" ? "ijf_osaekomi_me_sec" : "ijf_osaekomi_opp_sec"]);
  if (seconds >= 20) return 3;
  if (seconds >= 10) return 2;
  return 0;
}

function scoreLabel(round: JudoRound) {
  const stats = round.stats || {};
  const immoMe = resolvedImmobilizationScore(stats, "me");
  const immoOpp = resolvedImmobilizationScore(stats, "opp");
  const ipponMe = num(stats[K.ipponMe]) + (immoMe === 3 ? 1 : 0);
  const ipponOpp = num(stats[K.ipponOpp]) + (immoOpp === 3 ? 1 : 0);
  const wazariMe = num(stats[K.wazariMe]) + (immoMe === 2 ? 1 : 0);
  const wazariOpp = num(stats[K.wazariOpp]) + (immoOpp === 2 ? 1 : 0);
  const yukoMe = num(stats[K.yukoMe]) + (immoMe === 1 ? 1 : 0);
  const yukoOpp = num(stats[K.yukoOpp]) + (immoOpp === 1 ? 1 : 0);
  return `Ippon ${ipponMe}–${ipponOpp} · Waza-ari ${wazariMe}–${wazariOpp} · Yuko ${yukoMe}–${yukoOpp} · Shido ${num(stats[K.shidoMe])}–${num(stats[K.shidoOpp])}`;
}

export function JudoCombatStatsView({
  selectedPlayer,
  phases,
  opponentProfiles,
  addRound,
  removeRound,
  updateRound,
  updateRoundStat,
}: Props) {
  const [combatToDelete, setCombatToDelete] = useState<number | null>(null);
  const [activeRoundNumber, setActiveRoundNumber] = useState<number | null>(selectedPlayer.rounds[0]?.round_number ?? null);

  useEffect(() => {
    if (selectedPlayer.rounds.length === 0) {
      setActiveRoundNumber(null);
      return;
    }
    if (!selectedPlayer.rounds.some((round) => round.round_number === activeRoundNumber)) {
      setActiveRoundNumber(selectedPlayer.rounds[selectedPlayer.rounds.length - 1].round_number);
    }
  }, [selectedPlayer.rounds, activeRoundNumber]);

  const activeRound = selectedPlayer.rounds.find((round) => round.round_number === activeRoundNumber);
  const totals = useMemo(() => {
    const wins = selectedPlayer.rounds.filter((round) => round.result === "win").length;
    const losses = selectedPlayer.rounds.filter((round) => round.result === "loss").length;
    return { wins, losses, pending: selectedPlayer.rounds.length - wins - losses };
  }, [selectedPlayer.rounds]);

  const sortedOpps = useMemo(() => {
    const all = opponentProfiles || [];
    const matches = (opponent: OpponentProfile) =>
      (!selectedPlayer.playerGender || !opponent.gender || opponent.gender === selectedPlayer.playerGender) &&
      (!selectedPlayer.playerWeightCategory || !opponent.weight_category || opponent.weight_category === selectedPlayer.playerWeightCategory);
    return { matched: all.filter(matches), others: all.filter((opponent) => !matches(opponent)) };
  }, [opponentProfiles, selectedPlayer.playerGender, selectedPlayer.playerWeightCategory]);

  const fmtOpp = (opponent: OpponentProfile) =>
    `${opponent.last_name}${opponent.first_name ? ` ${opponent.first_name}` : ""}` +
    (opponent.weight_category ? ` (${opponent.weight_category.replace(/^judo_/, "")})` : "") +
    (opponent.handedness === "left" ? " G" : opponent.handedness === "right" ? " D" : "");

  if (selectedPlayer.rounds.length === 0 || !activeRound) {
    return (
      <div className="space-y-4 py-10 text-center text-muted-foreground">
        <Swords className="mx-auto h-12 w-12 opacity-40" />
        <p>Aucun combat enregistré pour {selectedPlayer.playerName}</p>
        <Button size="sm" onClick={() => addRound(selectedPlayer.entryKey)} className="gap-2">
          <Plus className="h-4 w-4" /> Ajouter un combat
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatPill label="Combats" value={selectedPlayer.rounds.length} />
        <StatPill label="Victoires" value={totals.wins} accent="success" />
        <StatPill label="Défaites" value={totals.losses} accent="danger" />
        <StatPill label="À compléter" value={totals.pending} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {selectedPlayer.rounds.map((round) => {
          const active = round.round_number === activeRoundNumber;
          return (
            <div key={round.round_number} className="group relative inline-flex">
              <Button
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveRoundNumber(round.round_number)}
                className={cn(
                  "h-8 gap-1.5 pr-7 text-xs",
                  !active && round.result === "win" && "border-emerald-500/60 text-emerald-700 dark:text-emerald-400",
                  !active && round.result === "loss" && "border-destructive/60 text-destructive",
                )}
              >
                <span className="font-bold">C{round.round_number}</span>
                {round.opponent_name && <span className="hidden max-w-[120px] truncate opacity-80 sm:inline">{round.opponent_name}</span>}
                {round.result === "win" && <Trophy className="h-3 w-3" />}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={(event) => {
                  event.stopPropagation();
                  setCombatToDelete(round.round_number);
                }}
                className="absolute right-0.5 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground hover:text-destructive"
                aria-label={`Supprimer combat ${round.round_number}`}
                title="Supprimer ce combat"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
        <Button size="sm" variant="ghost" onClick={() => addRound(selectedPlayer.entryKey)} className="h-8 gap-1 text-xs">
          <Plus className="h-3.5 w-3.5" /> Combat
        </Button>
      </div>

      <AlertDialog open={combatToDelete !== null} onOpenChange={(open) => !open && setCombatToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce combat ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le combat C{combatToDelete} et toutes ses données seront définitivement supprimés. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (combatToDelete !== null) removeRound(selectedPlayer.entryKey, combatToDelete);
                setCombatToDelete(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CombatReviewPanel
        key={activeRound.round_number}
        round={activeRound}
        phases={phases}
        sortedOpps={sortedOpps}
        fmtOpp={fmtOpp}
        opponentProfiles={opponentProfiles}
        onUpdate={(updates) => updateRound(selectedPlayer.entryKey, activeRound.round_number, updates)}
        onUpdateStat={(key, value) => updateRoundStat(selectedPlayer.entryKey, activeRound.round_number, key, value)}
        onRemove={() => removeRound(selectedPlayer.entryKey, activeRound.round_number)}
      />
    </div>
  );
}

function CombatReviewPanel({
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
  fmtOpp: (opponent: OpponentProfile) => string;
  opponentProfiles: OpponentProfile[] | undefined;
  onUpdate: (updates: Partial<JudoRound>) => void;
  onUpdateStat: (key: string, value: number) => void;
  onRemove: () => void;
}) {
  const [videoOpen, setVideoOpen] = useState(false);
  const standingAttempts = num(round.stats?.[K.standingAttempts]);
  const standingSuccess = num(round.stats?.[K.standingSuccess]);
  const standingRate = standingAttempts > 0 ? Math.round((standingSuccess / standingAttempts) * 100) : 0;

  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1 space-y-4">
        <Card className="space-y-3 border-l-4 border-l-primary p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <SectionHeader icon={<Trophy className="h-4 w-4 text-primary" />} title="Bilan du combat" />
            <VideoCompanionTrigger open={videoOpen} onToggle={() => setVideoOpen((open) => !open)} />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Phase</Label>
              <Select value={round.phase} onValueChange={(value) => onUpdate({ phase: value })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Phase" /></SelectTrigger>
                <SelectContent className="z-[200]">
                  {phases.map((phase) => <SelectItem key={phase.value} value={phase.value}>{phase.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label className="text-[10px] uppercase text-muted-foreground">Adversaire</Label>
              <div className="flex gap-1">
                <Select
                  value={round.opponent_profile_id || "__manual__"}
                  onValueChange={(value) => {
                    if (value === "__manual__") {
                      onUpdate({ opponent_profile_id: null });
                      return;
                    }
                    const opponent = (opponentProfiles || []).find((item) => item.id === value);
                    if (!opponent) return;
                    onUpdate({
                      opponent_profile_id: opponent.id,
                      opponent_name: `${opponent.last_name}${opponent.first_name ? ` ${opponent.first_name}` : ""}`,
                    });
                    if (opponent.combat_profile != null) onUpdateStat(K.combatProfile, Number(opponent.combat_profile));
                    if (opponent.style_mask != null) onUpdateStat(K.opponentStyle, Number(opponent.style_mask));
                  }}
                >
                  <SelectTrigger className="h-9 flex-1 text-xs"><SelectValue placeholder="Adversaire" /></SelectTrigger>
                  <SelectContent className="z-[200] max-h-[300px]">
                    <SelectItem value="__manual__">— Saisie libre —</SelectItem>
                    {sortedOpps.matched.length > 0 && <div className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">Catégorie de l'athlète</div>}
                    {sortedOpps.matched.map((opponent) => <SelectItem key={opponent.id} value={opponent.id}>{fmtOpp(opponent)}</SelectItem>)}
                    {sortedOpps.others.length > 0 && <div className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">Autres</div>}
                    {sortedOpps.others.map((opponent) => <SelectItem key={opponent.id} value={opponent.id}>{fmtOpp(opponent)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  value={round.opponent_name}
                  onChange={(event) => onUpdate({ opponent_name: event.target.value, opponent_profile_id: null })}
                  placeholder="Nom"
                  className="h-9 w-[140px] text-xs"
                />
              </div>
            </div>
          </div>

          <ResultChoice value={round.result} onChange={(result) => onUpdate({ result })} />
          <p className="text-center text-xs text-muted-foreground">{scoreLabel(round)}</p>

          <EnumPills
            label="Méthode de fin"
            value={num(round.stats?.[K.endMethod])}
            options={[
              { v: 1, label: "Ippon" },
              { v: 2, label: "Waza-ari" },
              { v: 3, label: "Waza-ari awasete ippon" },
              { v: 8, label: "Yuko" },
              { v: 4, label: "Hansoku-make" },
              { v: 5, label: "Décision" },
              { v: 6, label: "Abandon" },
              { v: 7, label: "Forfait" },
            ]}
            onChange={(value) => onUpdateStat(K.endMethod, value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={num(round.stats?.[K.goldenScore]) > 0 ? "default" : "outline"}
              size="sm"
              onClick={() => onUpdateStat(K.goldenScore, num(round.stats?.[K.goldenScore]) > 0 ? 0 : 1)}
            >
              Golden Score
            </Button>
            {num(round.stats?.[K.goldenScore]) > 0 && (
              <EnumPills
                label="Décision en Golden Score"
                value={num(round.stats?.[K.gsDecision])}
                options={[
                  { v: 1, label: "Technique" },
                  { v: 2, label: "Pénalité décisive" },
                  { v: 3, label: "Accumulation shido" },
                ]}
                onChange={(value) => onUpdateStat(K.gsDecision, value)}
              />
            )}
          </div>
        </Card>

        <Tabs defaultValue="score" className="space-y-3">
          <TabsList className="grid h-auto w-full grid-cols-4">
            <TabsTrigger value="score" className="py-1.5 text-[11px]">Score</TabsTrigger>
            <TabsTrigger value="newaza" className="py-1.5 text-[11px]">Ne-waza</TabsTrigger>
            <TabsTrigger value="tactique" className="py-1.5 text-[11px]">Tactique</TabsTrigger>
            <TabsTrigger value="details" className="py-1.5 text-[11px]">Détails</TabsTrigger>
          </TabsList>

          <TabsContent value="score" className="mt-0">
            <Card className="space-y-3 p-3">
              <SectionHeader icon={<Zap className="h-4 w-4 text-primary" />} title="Score" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ScoreColumn
                  label="Athlète"
                  ippon={num(round.stats?.[K.ipponMe])}
                  wazari={num(round.stats?.[K.wazariMe])}
                  yuko={num(round.stats?.[K.yukoMe])}
                  shido={num(round.stats?.[K.shidoMe])}
                  hansoku={num(round.stats?.[K.hansokuDirectMe]) > 0}
                  onIppon={(value) => onUpdateStat(K.ipponMe, Math.max(0, Math.min(1, value)))}
                  onWazari={(value) => onUpdateStat(K.wazariMe, Math.max(0, Math.min(2, value)))}
                  onYuko={(value) => onUpdateStat(K.yukoMe, Math.max(0, Math.min(9, value)))}
                  onShido={(value) => onUpdateStat(K.shidoMe, Math.max(0, Math.min(3, value)))}
                  onHansoku={(value) => onUpdateStat(K.hansokuDirectMe, value ? 1 : 0)}
                />
                <ScoreColumn
                  label="Adversaire"
                  opponent
                  ippon={num(round.stats?.[K.ipponOpp])}
                  wazari={num(round.stats?.[K.wazariOpp])}
                  yuko={num(round.stats?.[K.yukoOpp])}
                  shido={num(round.stats?.[K.shidoOpp])}
                  hansoku={num(round.stats?.[K.hansokuDirectOpp]) > 0}
                  onIppon={(value) => onUpdateStat(K.ipponOpp, Math.max(0, Math.min(1, value)))}
                  onWazari={(value) => onUpdateStat(K.wazariOpp, Math.max(0, Math.min(2, value)))}
                  onYuko={(value) => onUpdateStat(K.yukoOpp, Math.max(0, Math.min(9, value)))}
                  onShido={(value) => onUpdateStat(K.shidoOpp, Math.max(0, Math.min(3, value)))}
                  onHansoku={(value) => onUpdateStat(K.hansokuDirectOpp, value ? 1 : 0)}
                />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="newaza" className="mt-0 space-y-3">
            <Card className="space-y-4 p-3">
              <SectionHeader icon={<Hand className="h-4 w-4 text-primary" />} title="Immobilisation" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ImmobilizationChoice label="Athlète" value={resolvedImmobilizationScore(round.stats || {}, "me")} onChange={(value) => onUpdateStat(K.immoScoreMe, value)} />
                <ImmobilizationChoice label="Adversaire" value={resolvedImmobilizationScore(round.stats || {}, "opp")} onChange={(value) => onUpdateStat(K.immoScoreOpp, value)} />
              </div>
            </Card>
            <Card className="p-3">
              <CounterStat
                label="Liaisons debout-sol effectuées"
                value={num(round.stats?.[K.transitionStandToGround])}
                onChange={(value) => onUpdateStat(K.transitionStandToGround, value)}
              />
            </Card>
          </TabsContent>

          <TabsContent value="tactique" className="mt-0">
            <Card className="space-y-4 p-3">
              <SectionHeader icon={<Swords className="h-4 w-4 text-primary" />} title="Analyse tactique" />
              <EnumPills
                label="Profil du combat"
                value={num(round.stats?.[K.combatProfile])}
                options={[
                  { v: 1, label: "Dominant" },
                  { v: 2, label: "Équilibré" },
                  { v: 3, label: "Dominé" },
                ]}
                onChange={(value) => onUpdateStat(K.combatProfile, value)}
              />
              <EnumPills
                label="Style de l'adversaire"
                value={num(round.stats?.[K.opponentStyle])}
                options={[
                  { v: 1, label: "Actif" },
                  { v: 32, label: "Passif" },
                  { v: 2, label: "Contreur" },
                ]}
                onChange={(value) => onUpdateStat(K.opponentStyle, value)}
              />
            </Card>
          </TabsContent>

          <TabsContent value="details" className="mt-0 space-y-3">
            <Card className="space-y-3 p-3">
              <SectionHeader icon={<Zap className="h-4 w-4 text-primary" />} title="Techniques debout" />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <CounterStat label="Techniques tentées" value={standingAttempts} onChange={(value) => {
                  onUpdateStat(K.standingAttempts, value);
                  if (standingSuccess > value) onUpdateStat(K.standingSuccess, value);
                }} />
                <CounterStat label="Techniques réussies" value={standingSuccess} onChange={(value) => onUpdateStat(K.standingSuccess, Math.min(value, standingAttempts))} />
                <StatPill label="Réussite" value={standingAttempts > 0 ? `${standingRate}%` : "—"} accent={standingRate >= 50 ? "success" : "muted"} />
              </div>
            </Card>
            <Card className="space-y-2 p-3">
              <Label className="text-[10px] uppercase text-muted-foreground">Notes libres</Label>
              <Input
                value={round.notes || ""}
                onChange={(event) => onUpdate({ notes: event.target.value })}
                placeholder="Observations, plan tactique, points à travailler…"
                className="h-9 text-xs"
              />
              <div className="flex justify-end">
                <Button size="sm" variant="ghost" onClick={onRemove} className="gap-1 text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> Supprimer ce combat
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {videoOpen && (
        <aside className="sticky top-4 hidden h-[calc(100vh-7rem)] w-[380px] shrink-0 self-start lg:flex xl:w-[440px]">
          <VideoCompanionDock
            open={videoOpen}
            onClose={() => setVideoOpen(false)}
            storageKey={`judo-round-${round.round_number}-${round.opponent_name || "anon"}`}
            title="Vidéo du combat"
            initialUrl={round.video_url ?? null}
            onUrlChange={(url) => onUpdate({ video_url: url })}
          />
        </aside>
      )}
    </div>
  );
}

function ResultChoice({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase text-muted-foreground">Résultat</Label>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange("win")}
          className={cn("h-10", value === "win" && "border-emerald-500 bg-emerald-500 text-primary-foreground hover:bg-emerald-600")}
        >
          <Trophy className="mr-2 h-4 w-4" /> Victoire
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange("loss")}
          className={cn("h-10", value === "loss" && "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90")}
        >
          <X className="mr-2 h-4 w-4" /> Défaite
        </Button>
      </div>
    </div>
  );
}

function ScoreColumn({
  label,
  opponent = false,
  ippon,
  wazari,
  yuko,
  shido,
  hansoku,
  onIppon,
  onWazari,
  onYuko,
  onShido,
  onHansoku,
}: {
  label: string;
  opponent?: boolean;
  ippon: number;
  wazari: number;
  yuko: number;
  shido: number;
  hansoku: boolean;
  onIppon: (value: number) => void;
  onWazari: (value: number) => void;
  onYuko: (value: number) => void;
  onShido: (value: number) => void;
  onHansoku: (value: boolean) => void;
}) {
  return (
    <div className={cn("space-y-2 rounded-lg border p-3", opponent ? "bg-destructive/5" : "bg-primary/5")}>
      <p className="text-center text-[11px] font-bold uppercase">{label}</p>
      <CounterRow label="Ippon" value={ippon} max={1} onChange={onIppon} />
      <CounterRow label="Waza-ari" value={wazari} max={2} onChange={onWazari} />
      <CounterRow label="Yuko" value={yuko} max={9} onChange={onYuko} />
      <CounterRow label="Shido" value={shido} max={3} onChange={onShido} />
      <Button type="button" size="sm" variant={hansoku ? "destructive" : "outline"} onClick={() => onHansoku(!hansoku)} className="w-full text-xs">
        <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Hansoku-make direct
      </Button>
    </div>
  );
}

function ImmobilizationChoice({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const options = [
    { value: 0, label: "Aucun score" },
    { value: 1, label: "Yuko" },
    { value: 2, label: "Waza-ari" },
    { value: 3, label: "Ippon" },
  ];
  return (
    <div className="space-y-2">
      <Label className="text-[10px] uppercase text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={value === option.value ? "default" : "outline"}
            onClick={() => onChange(option.value)}
            className="h-9 text-xs"
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function StatPill({ label, value, accent = "muted" }: { label: string; value: string | number; accent?: "muted" | "success" | "danger" }) {
  return (
    <div className={cn(
      "rounded-lg border p-2 text-center",
      accent === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" :
      accent === "danger" ? "border-destructive/30 bg-destructive/10 text-destructive" : "bg-muted/40",
    )}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] uppercase opacity-80">{label}</p>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon?: React.ReactNode; title: string }) {
  return <div className="flex items-center gap-2">{icon}<h4 className="text-sm font-bold uppercase">{title}</h4></div>;
}

function EnumPills({ label, value, options, onChange }: { label: string; value: number; options: { v: number; label: string }[]; onChange: (value: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <Button
            key={option.v}
            type="button"
            size="sm"
            variant={value === option.v ? "default" : "outline"}
            onClick={() => onChange(value === option.v ? 0 : option.v)}
            className="h-8 text-xs"
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function CounterRow({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs font-semibold">{label}</p>
      <div className="flex items-center gap-1">
        <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => onChange(Math.max(0, value - 1))}>−</Button>
        <div className="w-8 text-center font-bold tabular-nums">{value}</div>
        <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => onChange(Math.min(max, value + 1))}>+</Button>
      </div>
    </div>
  );
}

function CounterStat({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-center">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <div className="flex items-center justify-center gap-2">
        <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => onChange(Math.max(0, value - 1))}>−</Button>
        <div className="w-12 text-lg font-bold tabular-nums">{value}</div>
        <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => onChange(value + 1)}>+</Button>
      </div>
    </div>
  );
}
