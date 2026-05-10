import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Check,
  ChevronLeft,
  ChevronRight,
  Timer,
  Swords,
} from "lucide-react";
import { JUDO_STATS } from "@/lib/constants/sportStats";
import {
  JUDO_TECHNIQUES,
  JUDO_TECHNIQUE_FAMILIES,
  techStatKey,
} from "@/lib/constants/judoTechniques";

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

// Categories shown as a wizard at the top of the dialog.
const JUDO_WIZARD_CATEGORIES = [
  { key: "general", label: "Général" },
  { key: "scoring", label: "Score & Résultat" },
  { key: "attack", label: "Attaque" },
  { key: "defense", label: "Défense" },
  { key: "penalties", label: "Pénalités" },
  { key: "newaza", label: "Ne-waza" },
  { key: "physique", label: "Physique" },
] as const;

type WizardCatKey = typeof JUDO_WIZARD_CATEGORIES[number]["key"];

// Map wizard categories to JUDO_STATS slices
const STAT_KEYS_BY_WIZARD: Record<WizardCatKey, string[]> = {
  general: [], // dedicated header inputs (opponent / phase / result)
  scoring: [
    "victoryModeIppon",
    "victoryModeWazaari",
    "victoryModeDecision",
    "victoryModeHansoku",
    "victoryModeYuko",
    "finalScore",
    "combatDuration",
  ],
  attack: [
    "attackAttempts",
    "attackEffective",
    "techniqueNageWaza",
    "techniqueNeWaza",
    "dominantSideRight",
    "dominantSideLeft",
    "entryTypeDirect",
    "entryTypeCombo",
    "entryTypeCounter",
  ],
  defense: [
    "attacksReceived",
    "scoresConceded",
    "attacksNeutralized",
  ],
  penalties: ["shidoReceived", "shidoProvoked", "hansokuMake"],
  newaza: [
    "groundTimeSeconds",
    "immobilizationAttempts",
    "armLockAttempts",
    "chokeAttempts",
    "neWazaSuccess",
  ],
  physique: [
    "effectiveEngagementTime",
    "passivityPhases",
    "goldenScore",
    "goldenScoreDuration",
  ],
};

const fmtMMSS = (sec: number) => {
  if (!sec || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export function JudoCombatStatsView({
  selectedPlayer,
  phases,
  opponentProfiles,
  addRound,
  removeRound,
  updateRound,
  updateRoundStat,
}: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const activeCat = JUDO_WIZARD_CATEGORIES[activeIdx];

  const totalCombatSeconds = useMemo(
    () =>
      selectedPlayer.rounds.reduce(
        (sum, r) => sum + (Number(r.stats?.combatDuration) || 0),
        0,
      ),
    [selectedPlayer.rounds],
  );

  const wins = selectedPlayer.rounds.filter((r) => r.result === "win").length;
  const losses = selectedPlayer.rounds.filter((r) => r.result === "loss").length;

  const goNext = () =>
    setActiveIdx((i) => Math.min(i + 1, JUDO_WIZARD_CATEGORIES.length - 1));
  const goPrev = () => setActiveIdx((i) => Math.max(i - 1, 0));

  const fmtOpp = (o: OpponentProfile) =>
    `${o.last_name}${o.first_name ? " " + o.first_name : ""}` +
    (o.weight_category ? ` (${o.weight_category.replace(/^judo_/, "")})` : "") +
    (o.handedness === "left" ? " G" : o.handedness === "right" ? " D" : "");

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

  const renderOpponentSelect = (round: JudoRound) => (
    <div className="flex gap-1">
      <Select
        value={round.opponent_profile_id || "__manual__"}
        onValueChange={(v) => {
          if (v === "__manual__") {
            updateRound(selectedPlayer.entryKey, round.round_number, {
              opponent_profile_id: null,
            });
          } else {
            const op = (opponentProfiles || []).find((o) => o.id === v);
            if (op) {
              updateRound(selectedPlayer.entryKey, round.round_number, {
                opponent_profile_id: op.id,
                opponent_name: `${op.last_name}${op.first_name ? " " + op.first_name : ""}`,
              });
            }
          }
        }}
      >
        <SelectTrigger className="h-8 text-xs">
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
          updateRound(selectedPlayer.entryKey, round.round_number, {
            opponent_name: e.target.value,
            opponent_profile_id: null,
          })
        }
        placeholder="Nom"
        className="h-8 w-[110px] text-xs"
      />
    </div>
  );

  // ======================
  // Render: empty state
  // ======================
  if (selectedPlayer.rounds.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground space-y-4">
        <Swords className="h-10 w-10 mx-auto opacity-40" />
        <p>Aucun combat enregistré pour {selectedPlayer.playerName}</p>
        <Button
          size="sm"
          onClick={() => addRound(selectedPlayer.entryKey)}
          className="gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
        >
          <Plus className="h-4 w-4" /> Ajouter un combat
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* HEADER: cumul + wizard categories */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border p-2 text-center bg-muted/40">
          <p className="text-lg font-bold">{selectedPlayer.rounds.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase">Combats</p>
        </div>
        <div className="rounded-lg border p-2 text-center bg-green-100 dark:bg-green-900/20">
          <p className="text-lg font-bold text-green-700 dark:text-green-400">
            {wins}V / {losses}D
          </p>
          <p className="text-[10px] text-muted-foreground uppercase">Bilan</p>
        </div>
        <div className="rounded-lg border p-2 text-center bg-blue-100 dark:bg-blue-900/20">
          <p className="text-lg font-bold text-blue-700 dark:text-blue-400 flex items-center justify-center gap-1">
            <Timer className="h-4 w-4" />
            {fmtMMSS(totalCombatSeconds)}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase">Temps cumulé</p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={goPrev} disabled={activeIdx === 0}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 flex gap-1 overflow-x-auto pb-1">
          {JUDO_WIZARD_CATEGORIES.map((c, idx) => (
            <Button
              key={c.key}
              variant={idx === activeIdx ? "default" : "outline"}
              size="sm"
              className="shrink-0 text-xs h-8 gap-1"
              onClick={() => setActiveIdx(idx)}
            >
              {c.label}
              {idx < activeIdx && <Check className="h-3 w-3 text-green-400" />}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={goNext}
          disabled={activeIdx >= JUDO_WIZARD_CATEGORIES.length - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* CATEGORY CONTENT */}
      {activeCat.key === "general" ? (
        <GeneralTable
          rounds={selectedPlayer.rounds}
          phases={phases}
          renderOpponent={renderOpponentSelect}
          onRemove={(rn) => removeRound(selectedPlayer.entryKey, rn)}
          onUpdate={(rn, u) => updateRound(selectedPlayer.entryKey, rn, u)}
        />
      ) : activeCat.key === "attack" ? (
        <AttackBlock
          rounds={selectedPlayer.rounds}
          onUpdateStat={(rn, k, v) => updateRoundStat(selectedPlayer.entryKey, rn, k, v)}
        />
      ) : (
        <StatsTable
          rounds={selectedPlayer.rounds}
          statKeys={STAT_KEYS_BY_WIZARD[activeCat.key]}
          onUpdateStat={(rn, k, v) => updateRoundStat(selectedPlayer.entryKey, rn, k, v)}
        />
      )}

      <div className="flex items-center justify-between pt-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => addRound(selectedPlayer.entryKey)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> Ajouter un combat
        </Button>
        {activeIdx < JUDO_WIZARD_CATEGORIES.length - 1 && (
          <Button size="sm" onClick={goNext} className="gap-1">
            <Check className="h-4 w-4" />
            Valider → {JUDO_WIZARD_CATEGORIES[activeIdx + 1].label}
          </Button>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// Sub-components
// =====================================================================

function GeneralTable({
  rounds,
  phases,
  renderOpponent,
  onRemove,
  onUpdate,
}: {
  rounds: JudoRound[];
  phases: { value: string; label: string }[];
  renderOpponent: (r: JudoRound) => React.ReactNode;
  onRemove: (rn: number) => void;
  onUpdate: (rn: number, u: Partial<JudoRound>) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 whitespace-nowrap">#</TableHead>
            <TableHead className="whitespace-nowrap">Phase</TableHead>
            <TableHead className="whitespace-nowrap">Adversaire</TableHead>
            <TableHead className="w-40 whitespace-nowrap">Résultat</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rounds.map((r) => (
            <TableRow key={r.round_number}>
              <TableCell className="font-bold">{r.round_number}</TableCell>
              <TableCell>
                <Select
                  value={r.phase}
                  onValueChange={(v) => onUpdate(r.round_number, { phase: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
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
              </TableCell>
              <TableCell>{renderOpponent(r)}</TableCell>
              <TableCell>
                <Select
                  value={r.result}
                  onValueChange={(v) => onUpdate(r.round_number, { result: v })}
                >
                  <SelectTrigger className="h-8 text-xs whitespace-nowrap [&>span]:truncate">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent className="z-[200]">
                    <SelectItem value="win">
                      <span className="flex items-center gap-1">
                        <Trophy className="h-3 w-3 text-green-500" /> Victoire
                      </span>
                    </SelectItem>
                    <SelectItem value="loss">Défaite</SelectItem>
                    <SelectItem value="draw">Égalité</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onRemove(r.round_number)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function StatsTable({
  rounds,
  statKeys,
  onUpdateStat,
}: {
  rounds: JudoRound[];
  statKeys: string[];
  onUpdateStat: (roundNumber: number, key: string, value: number) => void;
}) {
  const fields = statKeys
    .map((k) => JUDO_STATS.find((s) => s.key === k))
    .filter(Boolean) as typeof JUDO_STATS;

  if (fields.length === 0) {
    return (
      <Card className="p-4 text-center text-sm text-muted-foreground">
        Aucune donnée à saisir dans cette catégorie.
      </Card>
    );
  }

  return (
    <Card className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20 sticky left-0 bg-card z-10">Combat</TableHead>
            {fields.map((f) => (
              <TableHead key={f.key} className="text-center text-[10px] min-w-[90px]">
                {f.shortLabel}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rounds.map((r) => (
            <TableRow key={r.round_number}>
              <TableCell className="font-semibold sticky left-0 bg-card z-10">
                #{r.round_number}
                {r.opponent_name && (
                  <div className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                    {r.opponent_name}
                  </div>
                )}
              </TableCell>
              {fields.map((f) => (
                <TableCell key={f.key} className="p-1">
                  <Input
                    type="number"
                    value={r.stats?.[f.key] ?? ""}
                    onChange={(e) =>
                      onUpdateStat(r.round_number, f.key, parseFloat(e.target.value) || 0)
                    }
                    min={0}
                    max={f.max}
                    className="h-8 text-xs text-center"
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function AttackBlock({
  rounds,
  onUpdateStat,
}: {
  rounds: JudoRound[];
  onUpdateStat: (roundNumber: number, key: string, value: number) => void;
}) {
  const [selectedRoundNumber, setSelectedRoundNumber] = useState<number>(
    rounds[0]?.round_number ?? 1,
  );
  const [familyFilter, setFamilyFilter] = useState<string>("all");

  const round = rounds.find((r) => r.round_number === selectedRoundNumber) || rounds[0];

  const visibleTechniques =
    familyFilter === "all"
      ? JUDO_TECHNIQUES
      : JUDO_TECHNIQUES.filter((t) => t.family === familyFilter);

  // Aggregate per-technique totals across all combats (for tournament view).
  const cumul = useMemo(() => {
    const out: Record<string, { att: number; suc: number; pts: number }> = {};
    for (const r of rounds) {
      for (const t of JUDO_TECHNIQUES) {
        const att = Number(r.stats?.[techStatKey(t.key, "att")]) || 0;
        const suc = Number(r.stats?.[techStatKey(t.key, "suc")]) || 0;
        const pts = Number(r.stats?.[techStatKey(t.key, "pts")]) || 0;
        if (att || suc || pts) {
          if (!out[t.key]) out[t.key] = { att: 0, suc: 0, pts: 0 };
          out[t.key].att += att;
          out[t.key].suc += suc;
          out[t.key].pts += pts;
        }
      }
    }
    return out;
  }, [rounds]);

  return (
    <div className="space-y-3">
      {/* Combat & family selector */}
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs">Combat :</Label>
        <Select
          value={String(selectedRoundNumber)}
          onValueChange={(v) => setSelectedRoundNumber(Number(v))}
        >
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[200]">
            {rounds.map((r) => (
              <SelectItem key={r.round_number} value={String(r.round_number)}>
                #{r.round_number}
                {r.opponent_name ? ` — ${r.opponent_name}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {/* Per-technique table for the selected combat */}
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">Technique</TableHead>
              <TableHead className="text-center w-24">Tentatives</TableHead>
              <TableHead className="text-center w-24">Réussies</TableHead>
              <TableHead className="text-center w-24">Points</TableHead>
              <TableHead className="text-center w-20">% réussite</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleTechniques.map((t) => {
              const att = Number(round?.stats?.[techStatKey(t.key, "att")]) || 0;
              const suc = Number(round?.stats?.[techStatKey(t.key, "suc")]) || 0;
              const pts = Number(round?.stats?.[techStatKey(t.key, "pts")]) || 0;
              const pct = att > 0 ? Math.round((suc / att) * 100) : null;
              return (
                <TableRow key={t.key}>
                  <TableCell className="text-xs">
                    <div className="font-medium">{t.label}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {JUDO_TECHNIQUE_FAMILIES.find((f) => f.key === t.family)?.label}
                    </div>
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      min={0}
                      value={att || ""}
                      onChange={(e) =>
                        onUpdateStat(
                          round!.round_number,
                          techStatKey(t.key, "att"),
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      className="h-8 text-xs text-center"
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      min={0}
                      max={att || undefined}
                      value={suc || ""}
                      onChange={(e) =>
                        onUpdateStat(
                          round!.round_number,
                          techStatKey(t.key, "suc"),
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      className="h-8 text-xs text-center"
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      min={0}
                      value={pts || ""}
                      onChange={(e) =>
                        onUpdateStat(
                          round!.round_number,
                          techStatKey(t.key, "pts"),
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      className="h-8 text-xs text-center"
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  </TableCell>
                  <TableCell className="text-center text-xs">
                    {pct !== null ? (
                      <Badge
                        variant={pct >= 50 ? "default" : pct >= 25 ? "secondary" : "outline"}
                      >
                        {pct}%
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Cumulative recap across all combats */}
      {Object.keys(cumul).length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Cumul du tournoi (toutes attaques utilisées)
          </h4>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Technique</TableHead>
                  <TableHead className="text-center">Tentées</TableHead>
                  <TableHead className="text-center">Réussies</TableHead>
                  <TableHead className="text-center">Points</TableHead>
                  <TableHead className="text-center">% réussite</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(cumul)
                  .sort((a, b) => b[1].pts - a[1].pts || b[1].suc - a[1].suc)
                  .map(([techKey, c]) => {
                    const tech = JUDO_TECHNIQUES.find((t) => t.key === techKey);
                    const pct = c.att > 0 ? Math.round((c.suc / c.att) * 100) : null;
                    return (
                      <TableRow key={techKey}>
                        <TableCell className="text-xs font-medium">
                          {tech?.label ?? techKey}
                        </TableCell>
                        <TableCell className="text-center">{c.att}</TableCell>
                        <TableCell className="text-center">{c.suc}</TableCell>
                        <TableCell className="text-center font-bold">{c.pts}</TableCell>
                        <TableCell className="text-center text-xs">
                          {pct !== null ? `${pct}%` : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}
