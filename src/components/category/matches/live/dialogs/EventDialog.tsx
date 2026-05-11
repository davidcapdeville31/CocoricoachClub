import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EventType, MatchEvent, Outcome, Period, TeamSide } from "../types";
import { EVENT_LABELS } from "../types";

export interface EventDialogPlayer { id: string; label: string }

export interface EventDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  eventType: EventType;
  /** Default chrono values */
  defaultMinute: number;
  defaultSecond?: number;
  defaultPeriod: Period;
  homeName: string;
  awayName: string;
  homePlayers: EventDialogPlayer[];
  awayPlayers: EventDialogPlayer[];
  /** Editing existing event */
  initial?: MatchEvent | null;
  onSubmit: (payload: Partial<MatchEvent>, chain?: { type: EventType }) => void;
}

const SUBTYPES: Partial<Record<EventType, { value: string; label: string }[]>> = {
  try: [
    { value: "ballon_porte", label: "Ballon porté" },
    { value: "interception", label: "Interception" },
    { value: "contre_attaque", label: "Contre-attaque" },
    { value: "pick_and_go", label: "Pick & go" },
    { value: "aile", label: "Aile" },
    { value: "penaltouche", label: "Pénaltouche" },
    { value: "melee", label: "Mêlée" },
    { value: "turnover", label: "Turnover" },
    { value: "autre", label: "Autre" },
  ],
  penalty_kick: [
    { value: "hors_jeu", label: "Hors-jeu" },
    { value: "plaqueur_ne_sort_pas", label: "Plaqueur ne sort pas" },
    { value: "grattage", label: "Grattage illégal" },
    { value: "melee_ecroulee", label: "Mêlée écroulée" },
    { value: "hors_jeu_ligne", label: "Hors-jeu de ligne" },
    { value: "en_avant_volontaire", label: "En-avant volontaire" },
    { value: "technique", label: "Faute technique" },
    { value: "anti_jeu", label: "Anti-jeu" },
    { value: "autre", label: "Autre" },
  ],
  foul: [
    { value: "hors_jeu", label: "Hors-jeu" },
    { value: "plaquage_haut", label: "Plaquage haut" },
    { value: "anti_jeu", label: "Anti-jeu" },
    { value: "autre", label: "Autre" },
  ],
  yellow_card: [
    { value: "anti_jeu", label: "Anti-jeu" },
    { value: "plaquage_haut", label: "Plaquage haut" },
    { value: "repetition", label: "Répétition de fautes" },
    { value: "autre", label: "Autre" },
  ],
  red_card: [
    { value: "brutalite", label: "Brutalité" },
    { value: "plaquage_dangereux", label: "Plaquage dangereux" },
    { value: "autre", label: "Autre" },
  ],
};

const ZONES = [
  { value: "in_22", label: "Dans les 22m" },
  { value: "22_to_50", label: "22m → 50m" },
  { value: "50_to_22_opp", label: "50m → 22m adverse" },
  { value: "in_22_opp", label: "Dans les 22m adverse" },
];

export function EventDialog(props: EventDialogProps) {
  const { open, onOpenChange, eventType, defaultMinute, defaultSecond = 0, defaultPeriod, homeName, awayName, homePlayers, awayPlayers, initial, onSubmit } = props;

  const [side, setSide] = useState<TeamSide>(initial?.team_side ?? "home");
  const [minute, setMinute] = useState<number>(initial?.minute ?? defaultMinute);
  const [second, setSecond] = useState<number>(initial?.second ?? defaultSecond);
  const [period, setPeriod] = useState<Period>(initial?.period ?? defaultPeriod);
  const [playerId, setPlayerId] = useState<string | "">(initial?.player_id ?? "");
  const [subtype, setSubtype] = useState<string>(initial?.event_subtype ?? "");
  const [outcome, setOutcome] = useState<string>(initial?.outcome ?? "");
  const [zone, setZone] = useState<string>(initial?.metadata?.zone ?? "");
  const [kickDistance, setKickDistance] = useState<string>(initial?.metadata?.kickDistance?.toString() ?? "");
  const [contested, setContested] = useState<boolean>(!!initial?.metadata?.contested);
  const [motif, setMotif] = useState<string>(initial?.metadata?.motif ?? "");
  const [penaltyMode, setPenaltyMode] = useState<string>(initial?.metadata?.penaltyMode ?? "kick");
  const [tryAttemptConv, setTryAttemptConv] = useState<boolean>(true);

  useEffect(() => {
    if (open && !initial) {
      setSide("home"); setMinute(defaultMinute); setSecond(defaultSecond); setPeriod(defaultPeriod);
      setPlayerId(""); setSubtype(""); setOutcome("");
      setZone(""); setKickDistance(""); setContested(false); setMotif(""); setPenaltyMode("kick"); setTryAttemptConv(true);
    }
  }, [open, defaultMinute, defaultSecond, defaultPeriod, initial]);

  const subtypes = SUBTYPES[eventType] ?? [];
  const players = side === "home" ? homePlayers : awayPlayers;

  const showOutcomeWonLost = ["lineout", "scrum"].includes(eventType);
  const showOutcomeSuccessFail = ["conversion", "penalty_kick", "drop"].includes(eventType) || (eventType === "penalty_kick" && penaltyMode === "kick");
  const showZone = ["try", "lineout", "kick", "occupation"].includes(eventType);
  const showKickDistance = ["conversion", "penalty_kick", "drop", "kick"].includes(eventType);
  const showContested = ["lineout"].includes(eventType);
  const showPenaltyMode = eventType === "penalty_kick";
  const showCardMotif = ["yellow_card", "red_card"].includes(eventType);

  const submit = () => {
    const metadata: Record<string, any> = {};
    if (zone) metadata.zone = zone;
    if (kickDistance) metadata.kickDistance = parseInt(kickDistance) || null;
    if (contested) metadata.contested = true;
    if (motif) metadata.motif = motif;
    if (showPenaltyMode) metadata.penaltyMode = penaltyMode;

    const payload: Partial<MatchEvent> = {
      team_side: side,
      minute, second: 0, period,
      event_type: eventType,
      event_subtype: subtype || null,
      outcome: (outcome || null) as Outcome,
      player_id: playerId || null,
      metadata,
    };

    // Try → ask conversion next
    let chain: { type: EventType } | undefined;
    if (eventType === "try" && tryAttemptConv) chain = { type: "conversion" };
    if (eventType === "penalty_kick" && penaltyMode !== "kick") {
      payload.outcome = null;
    }
    onSubmit(payload, chain);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{EVENT_LABELS[eventType] ?? eventType}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Équipe</Label>
            <Select value={side} onValueChange={(v) => setSide(v as TeamSide)}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="home">{homeName}</SelectItem>
                <SelectItem value="away">{awayName}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Minute</Label>
              <Input type="number" min={0} max={120} value={minute} onChange={(e) => setMinute(parseInt(e.target.value) || 0)} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Période</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="H1">1ère MT</SelectItem>
                  <SelectItem value="HT">Mi-temps</SelectItem>
                  <SelectItem value="H2">2ème MT</SelectItem>
                  <SelectItem value="ET">Prolongation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {side === "home" && players.length > 0 && (
          <div>
            <Label className="text-xs">Joueur</Label>
            <Select value={playerId} onValueChange={setPlayerId}>
              <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
              <SelectContent>
                {players.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {subtypes.length > 0 && (
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={subtype} onValueChange={setSubtype}>
              <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
              <SelectContent>
                {subtypes.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {showPenaltyMode && (
          <div>
            <Label className="text-xs">Pénalité jouée</Label>
            <div className="grid grid-cols-4 gap-1 mt-1">
              {[
                { v: "kick", l: "Au pied" },
                { v: "penaltouche", l: "Pénaltouche" },
                { v: "scrum", l: "Mêlée" },
                { v: "quick", l: "Rapide" },
              ].map((o) => (
                <Button key={o.v} type="button" variant={penaltyMode === o.v ? "default" : "outline"} size="sm" onClick={() => setPenaltyMode(o.v)} className="text-xs">{o.l}</Button>
              ))}
            </div>
          </div>
        )}

        {(showOutcomeSuccessFail && (eventType !== "penalty_kick" || penaltyMode === "kick")) && (
          <div>
            <Label className="text-xs">Résultat</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Button type="button" variant={outcome === "success" ? "default" : "outline"} onClick={() => setOutcome("success")} className="bg-green-600/90 hover:bg-green-600 data-[variant=outline]:bg-transparent">Réussi</Button>
              <Button type="button" variant={outcome === "fail" ? "destructive" : "outline"} onClick={() => setOutcome("fail")}>Manqué</Button>
            </div>
          </div>
        )}

        {showOutcomeWonLost && (
          <div>
            <Label className="text-xs">Résultat</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              <Button type="button" variant={outcome === "won" ? "default" : "outline"} onClick={() => setOutcome("won")}>Gagnée</Button>
              <Button type="button" variant={outcome === "lost" ? "destructive" : "outline"} onClick={() => setOutcome("lost")}>Perdue</Button>
              <Button type="button" variant={outcome === "contested" ? "secondary" : "outline"} onClick={() => setOutcome("contested")}>Contestée</Button>
            </div>
          </div>
        )}

        {showZone && (
          <div>
            <Label className="text-xs">Zone du terrain</Label>
            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
              <SelectContent>
                {ZONES.map((z) => <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {showKickDistance && (
          <div>
            <Label className="text-xs">Distance du tir (m)</Label>
            <Input type="number" min={0} max={80} value={kickDistance} onChange={(e) => setKickDistance(e.target.value)} className="h-9 mt-1" />
          </div>
        )}

        {showContested && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={contested} onChange={(e) => setContested(e.target.checked)} />
            Contre adverse
          </label>
        )}

        {showCardMotif && (
          <div>
            <Label className="text-xs">Motif libre</Label>
            <Input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex : plaquage haut" className="h-9 mt-1" />
          </div>
        )}

        {eventType === "try" && !initial && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={tryAttemptConv} onChange={(e) => setTryAttemptConv(e.target.checked)} />
            Enchaîner sur la transformation
          </label>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
