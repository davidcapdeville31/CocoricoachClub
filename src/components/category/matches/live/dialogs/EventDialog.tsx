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
  const showZone = ["lineout", "kick", "occupation"].includes(eventType);
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
      minute, second, period,
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

  const selBase = "h-10 text-xs border-2 transition-all";
  const selOn = "bg-primary text-primary-foreground border-primary ring-2 ring-primary/40 shadow-md hover:bg-primary";
  const selOff = "bg-transparent border-border hover:bg-accent hover:text-accent-foreground";
  const cls = (active: boolean) => `${selBase} ${active ? selOn : selOff}`;

  const okOn = "bg-green-600 text-white border-green-600 ring-2 ring-green-400/50 shadow-md hover:bg-green-600";
  const koOn = "bg-red-600 text-white border-red-600 ring-2 ring-red-400/50 shadow-md hover:bg-red-600";
  const warnOn = "bg-amber-500 text-white border-amber-500 ring-2 ring-amber-300/50 shadow-md hover:bg-amber-500";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{EVENT_LABELS[eventType] ?? eventType}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Équipe : 2 gros boutons */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Équipe</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Button type="button" variant="outline" onClick={() => setSide("home")} className={`h-12 text-sm border-2 ${side === "home" ? selOn : selOff}`}>{homeName}</Button>
              <Button type="button" variant="outline" onClick={() => setSide("away")} className={`h-12 text-sm border-2 ${side === "away" ? selOn : selOff}`}>{awayName}</Button>
            </div>
          </div>

          {/* Chrono + période */}
          <div className="grid grid-cols-[auto_1fr] gap-3 items-end">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Min</Label>
                <Input type="number" min={0} max={120} value={minute} onChange={(e) => setMinute(parseInt(e.target.value) || 0)} className="h-10 mt-1 w-20" />
              </div>
              <div>
                <Label className="text-xs">Sec</Label>
                <Input type="number" min={0} max={59} value={second} onChange={(e) => setSecond(parseInt(e.target.value) || 0)} className="h-10 mt-1 w-20" />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Période</Label>
              <div className="grid grid-cols-4 gap-1 mt-1">
                {[
                  { v: "H1", l: "1ère MT" },
                  { v: "HT", l: "Mi-temps" },
                  { v: "H2", l: "2ème MT" },
                  { v: "ET", l: "Prolong." },
                ].map((o) => (
                  <Button key={o.v} type="button" variant="outline" onClick={() => setPeriod(o.v as Period)} className={cls(period === o.v)}>{o.l}</Button>
                ))}
              </div>
            </div>
          </div>

          {/* Joueur : grille de boutons */}
          {players.length > 0 && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Joueur</Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mt-1">
                {players.map((p) => (
                  <Button key={p.id} type="button" variant="outline" onClick={() => setPlayerId(playerId === p.id ? "" : p.id)} className={`${cls(playerId === p.id)} truncate justify-start px-2`}>
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Subtype : grille de boutons */}
          {subtypes.length > 0 && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-1">
                {subtypes.map((s) => (
                  <Button key={s.value} type="button" variant="outline" onClick={() => setSubtype(subtype === s.value ? "" : s.value)} className={cls(subtype === s.value)}>
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {showPenaltyMode && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Pénalité jouée</Label>
              <div className="grid grid-cols-4 gap-1.5 mt-1">
                {[
                  { v: "kick", l: "Au pied" },
                  { v: "penaltouche", l: "Pénaltouche" },
                  { v: "scrum", l: "Mêlée" },
                  { v: "quick", l: "Rapide" },
                ].map((o) => (
                  <Button key={o.v} type="button" variant="outline" onClick={() => setPenaltyMode(o.v)} className={cls(penaltyMode === o.v)}>{o.l}</Button>
                ))}
              </div>
            </div>
          )}

          {(showOutcomeSuccessFail && (eventType !== "penalty_kick" || penaltyMode === "kick")) && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Résultat</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Button type="button" variant="outline" onClick={() => setOutcome("success")} className={`h-11 text-sm border-2 ${outcome === "success" ? okOn : selOff}`}>Réussi</Button>
                <Button type="button" variant="outline" onClick={() => setOutcome("fail")} className={`h-11 text-sm border-2 ${outcome === "fail" ? koOn : selOff}`}>Manqué</Button>
              </div>
            </div>
          )}

          {showOutcomeWonLost && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Résultat</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <Button type="button" variant="outline" onClick={() => setOutcome("won")} className={`h-11 text-sm border-2 ${outcome === "won" ? okOn : selOff}`}>Gagnée</Button>
                <Button type="button" variant="outline" onClick={() => setOutcome("lost")} className={`h-11 text-sm border-2 ${outcome === "lost" ? koOn : selOff}`}>Perdue</Button>
                <Button type="button" variant="outline" onClick={() => setOutcome("contested")} className={`h-11 text-sm border-2 ${outcome === "contested" ? warnOn : selOff}`}>Contestée</Button>
              </div>
            </div>
          )}

          {showZone && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Zone du terrain</Label>
              <div className="grid grid-cols-2 gap-1.5 mt-1">
                {ZONES.map((z) => (
                  <Button key={z.value} type="button" variant="outline" onClick={() => setZone(zone === z.value ? "" : z.value)} className={cls(zone === z.value)}>{z.label}</Button>
                ))}
              </div>
            </div>
          )}
        </div>

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
