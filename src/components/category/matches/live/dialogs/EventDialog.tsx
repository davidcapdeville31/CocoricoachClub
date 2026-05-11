import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EventType, MatchEvent, Outcome, Period, TeamSide } from "../types";
import { EVENT_LABELS } from "../types";
import { isLight } from "./TeamColorsDialog";
import { RugbyFieldSVG } from "@/components/rugby/RugbyFieldSVG";
import { getKickDistances, getPositionLabel } from "@/lib/utils/kickingFieldZones";
import { MapPin } from "lucide-react";

export interface EventDialogPlayer { id: string; label: string }

export interface EventDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  eventType: EventType;
  /** Default chrono values */
  defaultMinute: number;
  defaultSecond?: number;
  defaultPeriod: Period;
  defaultSide?: TeamSide;
  homeName: string;
  awayName: string;
  homeColor?: string;
  awayColor?: string;
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

interface EventDialogDraft {
  side: TeamSide;
  minute: number;
  second: number;
  period: Period;
  playerId: string | "";
  subtype: string;
  outcome: string;
  zone: string;
  kickDistance: string;
  contested: boolean;
  motif: string;
  penaltyMode: string;
  tryAttemptConv: boolean;
  kickX: number | null;
  kickY: number | null;
  kickingSide: "left" | "right";
  setPieceResult: "" | "won" | "stolen_us" | "lost" | "stolen_opp";
}

function createDraft(params: {
  initial?: MatchEvent | null;
  defaultMinute: number;
  defaultSecond: number;
  defaultPeriod: Period;
  defaultSide?: TeamSide;
}): EventDialogDraft {
  const { initial, defaultMinute, defaultSecond, defaultPeriod, defaultSide } = params;

  return {
    side: initial?.team_side ?? defaultSide ?? "home",
    minute: initial?.minute ?? defaultMinute,
    second: initial?.second ?? defaultSecond,
    period: initial?.period ?? defaultPeriod,
    playerId: initial?.player_id ?? "",
    subtype: initial?.event_subtype ?? "",
    outcome: initial?.outcome ?? "",
    zone: initial?.metadata?.zone ?? "",
    kickDistance: initial?.metadata?.kickDistance?.toString() ?? "",
    contested: !!initial?.metadata?.contested,
    motif: initial?.metadata?.motif ?? "",
    penaltyMode: initial?.metadata?.penaltyMode ?? "kick",
    tryAttemptConv: true,
    kickX: typeof initial?.metadata?.kickX === "number" ? initial.metadata.kickX : null,
    kickY: typeof initial?.metadata?.kickY === "number" ? initial.metadata.kickY : null,
    kickingSide: initial?.metadata?.kickingSide === "left" ? "left" : "right",
    setPieceResult: (initial?.metadata?.setPieceResult as any) ?? "",
  };
}

export function EventDialog(props: EventDialogProps) {
  const { open, onOpenChange, eventType, defaultMinute, defaultSecond = 0, defaultPeriod, defaultSide, homeName, awayName, homeColor, awayColor, homePlayers, awayPlayers, initial, onSubmit } = props;

  const [draft, setDraft] = useState<EventDialogDraft>(() =>
    createDraft({ initial, defaultMinute, defaultSecond, defaultPeriod, defaultSide })
  );

  useEffect(() => {
    if (!open) return;

    setDraft(createDraft({ initial, defaultMinute, defaultSecond, defaultPeriod, defaultSide }));
  }, [open, eventType, initial?.id]);

  const setField = <K extends keyof EventDialogDraft,>(field: K, value: EventDialogDraft[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const subtypes = SUBTYPES[eventType] ?? [];
  const players = draft.side === "home" ? homePlayers : awayPlayers;
  const oppositePlayers = draft.side === "home" ? awayPlayers : homePlayers;
  const canSelectPlayer = players.length > 0;
  const isOpponentSide = !canSelectPlayer && oppositePlayers.length > 0;

  const showOutcomeWonLost = ["lineout", "scrum"].includes(eventType);
  const isKickAttempt =
    eventType === "conversion" ||
    eventType === "drop" ||
    (eventType === "penalty_kick" && draft.penaltyMode === "kick");
  const isPenaltouche = eventType === "penalty_kick" && draft.penaltyMode === "penaltouche";
  const isSetPiece = eventType === "lineout" || eventType === "scrum";
  // Terrain visible : tirs au but, set-pieces, OU pénaltouche réussie (pour placer le point de chute)
  const showField = isKickAttempt || isSetPiece || (isPenaltouche && draft.outcome === "success");
  const showOutcomeSuccessFail =
    eventType === "conversion" ||
    eventType === "drop" ||
    (eventType === "penalty_kick" && (draft.penaltyMode === "kick" || draft.penaltyMode === "penaltouche"));
  const showZone = ["kick", "occupation"].includes(eventType); // touche utilise désormais le terrain
  const showKickDistance = eventType === "kick";
  const showContested = false; // remplacé par "Volée" dans les outcomes set-piece
  const showPenaltyMode = eventType === "penalty_kick";
  const showCardMotif = ["yellow_card", "red_card"].includes(eventType);

  const kickDistanceFromField =
    isKickAttempt && draft.kickX !== null && draft.kickY !== null
      ? Math.round(getKickDistances(draft.kickX, draft.kickY, draft.kickingSide === "right").distFromPosts)
      : null;
  const kickPositionLabel =
    showField && draft.kickX !== null && draft.kickY !== null
      ? getPositionLabel(draft.kickX, draft.kickY, draft.kickingSide === "right")
      : "";

  // Couleur du marqueur sur le terrain selon l'outcome
  const markerFill =
    draft.outcome === "success" || draft.outcome === "won"
      ? "#22c55e"
      : draft.outcome === "fail" || draft.outcome === "lost"
      ? "#ef4444"
      : "none";
  const markerSymbol =
    draft.outcome === "success" || draft.outcome === "won"
      ? "✓"
      : draft.outcome === "fail" || draft.outcome === "lost"
      ? "✗"
      : "";

  const submit = () => {
    const metadata: Record<string, any> = {};
    if (draft.zone) metadata.zone = draft.zone;
    if (draft.kickDistance) metadata.kickDistance = parseInt(draft.kickDistance) || null;
    if (draft.contested) metadata.contested = true;
    if (draft.motif) metadata.motif = draft.motif;
    if (showPenaltyMode) metadata.penaltyMode = draft.penaltyMode;
    if (showField && draft.kickX !== null && draft.kickY !== null) {
      metadata.kickX = draft.kickX;
      metadata.kickY = draft.kickY;
      metadata.kickingSide = draft.kickingSide;
      if (isKickAttempt && kickDistanceFromField !== null) metadata.kickDistance = kickDistanceFromField;
    }
    if (isSetPiece && draft.setPieceResult) metadata.setPieceResult = draft.setPieceResult;

    const payload: Partial<MatchEvent> = {
      team_side: draft.side,
      minute: draft.minute,
      second: draft.second,
      period: draft.period,
      event_type: eventType,
      event_subtype: draft.subtype || null,
      outcome: (draft.outcome || null) as Outcome,
      player_id: draft.playerId || null,
      metadata,
    };

    // Try → ask conversion next
    let chain: { type: EventType } | undefined;
    if (eventType === "try" && draft.tryAttemptConv) chain = { type: "conversion" };
    if (eventType === "penalty_kick" && draft.penaltyMode !== "kick" && draft.penaltyMode !== "penaltouche") {
      payload.outcome = null;
    }
    onSubmit(payload, chain);
  };

  const selBase = "h-10 text-xs border-2 transition-all";
  const selOn = "bg-primary text-primary-foreground border-primary ring-2 ring-primary/40 shadow-md hover:bg-primary";
  const selOff = "bg-transparent border-border hover:bg-accent hover:text-accent-foreground";
  const cls = (active: boolean) => `${selBase} ${active ? selOn : selOff}`;

  const okOn = "bg-success text-success-foreground border-success ring-2 ring-success/40 shadow-md hover:bg-success";
  const koOn = "bg-destructive text-destructive-foreground border-destructive ring-2 ring-destructive/40 shadow-md hover:bg-destructive";
  const warnOn = "bg-warning text-warning-foreground border-warning ring-2 ring-warning/40 shadow-md hover:bg-warning";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{EVENT_LABELS[eventType] ?? eventType}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Équipe : 2 gros boutons aux couleurs choisies */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Équipe</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {([
                { side: "home" as TeamSide, name: homeName, color: homeColor },
                { side: "away" as TeamSide, name: awayName, color: awayColor },
              ]).map(({ side, name, color }) => {
                const active = draft.side === side;
                const light = color ? isLight(color) : false;
                return (
                  <Button
                    key={side}
                    type="button"
                    variant="outline"
                    onClick={() => setDraft((prev) => ({ ...prev, side, playerId: side === prev.side ? prev.playerId : "" }))}
                    className={`h-12 text-sm border-2 transition-all ${active ? "ring-2 ring-offset-2 shadow-md" : "bg-transparent border-border hover:bg-accent"}`}
                    style={active && color ? {
                      backgroundColor: color,
                      borderColor: color,
                      color: light ? "#0f172a" : "#fff",
                    } : undefined}
                  >
                    {name}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Chrono + période */}
          <div className="grid grid-cols-[auto_1fr] gap-3 items-end">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Min</Label>
                <Input type="number" min={0} max={120} value={draft.minute} onChange={(e) => setField("minute", parseInt(e.target.value) || 0)} className="h-10 mt-1 w-20" />
              </div>
              <div>
                <Label className="text-xs">Sec</Label>
                <Input type="number" min={0} max={59} value={draft.second} onChange={(e) => setField("second", parseInt(e.target.value) || 0)} className="h-10 mt-1 w-20" />
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
                  <Button key={o.v} type="button" variant="outline" onClick={() => setField("period", o.v as Period)} className={cls(draft.period === o.v)}>{o.l}</Button>
                ))}
              </div>
            </div>
          </div>

          {/* Joueur : sélection limitée à mon équipe (feuille de match) */}
          {canSelectPlayer ? (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Joueur</Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mt-1">
                {players.map((p) => (
                  <Button key={p.id} type="button" variant="outline" onClick={() => setField("playerId", draft.playerId === p.id ? "" : p.id)} className={`${cls(draft.playerId === p.id)} truncate justify-start px-2`}>
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {isOpponentSide
                ? "Action adverse — sélection du joueur non disponible (effectif adverse non saisi)."
                : "Aucun joueur dans la feuille de match. Renseigne la composition pour pouvoir cocher l'auteur de l'action."}
            </div>
          )}

          {/* Subtype : grille de boutons */}
          {subtypes.length > 0 && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-1">
                {subtypes.map((s) => (
                <Button key={s.value} type="button" variant="outline" onClick={() => setField("subtype", draft.subtype === s.value ? "" : s.value)} className={cls(draft.subtype === s.value)}>
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
                  <Button key={o.v} type="button" variant="outline" onClick={() => setField("penaltyMode", o.v)} className={cls(draft.penaltyMode === o.v)}>{o.l}</Button>
                ))}
              </div>
            </div>
          )}

          {showField && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  {isKickAttempt
                    ? "Position du tir"
                    : isPenaltouche
                    ? "Point de chute en touche"
                    : eventType === "lineout"
                    ? "Position de la touche"
                    : "Position de la mêlée"}
                </Label>
                <div className="flex gap-1">
                  <Button type="button" variant={draft.kickingSide === "left" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setField("kickingSide", "left")}>← Gauche</Button>
                  <Button type="button" variant={draft.kickingSide === "right" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setField("kickingSide", "right")}>Droite →</Button>
                </div>
              </div>
              <div className="relative w-full">
                <RugbyFieldSVG
                  goalsOnRight={draft.kickingSide === "right"}
                  showCursorTracker
                  onClick={(x, y) => {
                    let snappedX = x;
                    let snappedY = y;
                    // Touche / pénaltouche : snap sur le rectangle extérieur du terrain
                    if (eventType === "lineout" || isPenaltouche) {
                      const leftPct = (20 / 600) * 100;    // ~3.33%
                      const rightPct = (580 / 600) * 100;  // ~96.67%
                      const topPct = (14 / 400) * 100;     // ~3.5%
                      const bottomPct = (386 / 400) * 100; // ~96.5%
                      // Clamp à l'intérieur du rectangle
                      const cx = Math.min(Math.max(x, leftPct), rightPct);
                      const cy = Math.min(Math.max(y, topPct), bottomPct);
                      // Distance à chaque bord
                      const dTop = Math.abs(cy - topPct);
                      const dBot = Math.abs(cy - bottomPct);
                      const dLeft = Math.abs(cx - leftPct);
                      const dRight = Math.abs(cx - rightPct);
                      const minD = Math.min(dTop, dBot, dLeft, dRight);
                      if (minD === dTop)        { snappedX = cx; snappedY = topPct; }
                      else if (minD === dBot)   { snappedX = cx; snappedY = bottomPct; }
                      else if (minD === dLeft)  { snappedX = leftPct; snappedY = cy; }
                      else                      { snappedX = rightPct; snappedY = cy; }
                    }
                    setDraft((prev) => ({ ...prev, kickX: snappedX, kickY: snappedY }));
                  }}
                >
                  {draft.kickX !== null && draft.kickY !== null && (
                    <g>
                      <circle
                        cx={(draft.kickX / 100) * 600}
                        cy={(draft.kickY / 100) * 400}
                        r={14}
                        fill={isPenaltouche ? "#22c55e" : markerFill}
                        opacity={0.85}
                        stroke="white"
                        strokeWidth={3}
                        strokeDasharray={!isPenaltouche && markerFill === "none" ? "4 4" : undefined}
                      />
                      {(isPenaltouche || markerSymbol) && (
                        <text x={(draft.kickX / 100) * 600} y={(draft.kickY / 100) * 400 + 4} textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
                          {isPenaltouche ? "✓" : markerSymbol}
                        </text>
                      )}
                    </g>
                  )}
                </RugbyFieldSVG>
              </div>
              {draft.kickX !== null && draft.kickY !== null && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>{kickPositionLabel}</span>
                  {isKickAttempt && kickDistanceFromField !== null && <span className="ml-2">≈ {kickDistanceFromField}m des poteaux</span>}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                {isKickAttempt
                  ? "Cliquez sur le terrain pour placer le tir, puis sélectionnez Réussi ou Manqué."
                  : isPenaltouche
                  ? "Cliquez sur le bord du terrain où le ballon est tombé en touche."
                  : "Cliquez sur le terrain pour placer la conquête, puis indiquez le résultat."}
              </p>
            </div>
          )}

          {(showOutcomeSuccessFail && (eventType !== "penalty_kick" || draft.penaltyMode === "kick")) && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Résultat</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Button type="button" variant="outline" onClick={() => setField("outcome", "success")} className={`h-11 text-sm border-2 ${draft.outcome === "success" ? okOn : selOff}`}>Réussi</Button>
                <Button type="button" variant="outline" onClick={() => setField("outcome", "fail")} className={`h-11 text-sm border-2 ${draft.outcome === "fail" ? koOn : selOff}`}>Manqué</Button>
              </div>
            </div>
          )}

          {showOutcomeWonLost && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Résultat</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                <Button type="button" variant="outline"
                  onClick={() => setDraft((p) => ({ ...p, outcome: "won", setPieceResult: "won" }))}
                  className={`h-11 text-xs border-2 ${draft.setPieceResult === "won" ? okOn : selOff}`}>
                  {eventType === "lineout" ? "Touche gagnée" : "Mêlée gagnée"}
                </Button>
                <Button type="button" variant="outline"
                  onClick={() => setDraft((p) => ({ ...p, outcome: "won", setPieceResult: "stolen_us" }))}
                  className={`h-11 text-xs border-2 ${draft.setPieceResult === "stolen_us" ? okOn : selOff}`}>
                  Volée à l'adv.
                </Button>
                <Button type="button" variant="outline"
                  onClick={() => setDraft((p) => ({ ...p, outcome: "lost", setPieceResult: "lost" }))}
                  className={`h-11 text-xs border-2 ${draft.setPieceResult === "lost" ? koOn : selOff}`}>
                  {eventType === "lineout" ? "Touche perdue" : "Mêlée perdue"}
                </Button>
                <Button type="button" variant="outline"
                  onClick={() => setDraft((p) => ({ ...p, outcome: "lost", setPieceResult: "stolen_opp" }))}
                  className={`h-11 text-xs border-2 ${draft.setPieceResult === "stolen_opp" ? koOn : selOff}`}>
                  Volée par adv.
                </Button>
              </div>
            </div>
          )}

          {showZone && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Zone du terrain</Label>
              <div className="grid grid-cols-2 gap-1.5 mt-1">
                {ZONES.map((z) => (
                  <Button key={z.value} type="button" variant="outline" onClick={() => setField("zone", draft.zone === z.value ? "" : z.value)} className={cls(draft.zone === z.value)}>{z.label}</Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {showKickDistance && (
          <div>
            <Label className="text-xs">Distance du tir (m)</Label>
            <Input type="number" min={0} max={80} value={draft.kickDistance} onChange={(e) => setField("kickDistance", e.target.value)} className="h-9 mt-1" />
          </div>
        )}

        {showContested && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.contested} onChange={(e) => setField("contested", e.target.checked)} />
            Contre adverse
          </label>
        )}

        {showCardMotif && (
          <div>
            <Label className="text-xs">Motif libre</Label>
            <Input value={draft.motif} onChange={(e) => setField("motif", e.target.value)} placeholder="Ex : plaquage haut" className="h-9 mt-1" />
          </div>
        )}

        {eventType === "try" && !initial && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.tryAttemptConv} onChange={(e) => setField("tryAttemptConv", e.target.checked)} />
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
