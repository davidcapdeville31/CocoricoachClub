import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, RotateCcw, UserPlus } from "lucide-react";
import { getPositionsForSport, getSportFieldConfig, type Position } from "@/lib/constants/sportPositions";

interface Player {
  id: string;
  name: string;
  first_name?: string | null;
  position: string | null;
  avatar_url?: string | null;
}

function normalizePos(s: string | null | undefined): string {
  return (s || "").toString().trim().toLowerCase();
}

function formatPlayerName(player: Pick<Player, "name" | "first_name">) {
  const last = (player.name || "").trim();
  const first = (player.first_name || "").trim();
  if (last && first) return `${last.toUpperCase()} ${first}`;
  return last || first || "";
}

interface SportFieldLineupProps {
  players: Player[];
  sportType: string;
  initialLineup?: Record<string, string>;
  initialSubstitutes?: string[];
  onLineupChange?: (lineup: Record<string, string>, substitutes: string[]) => void;
  readOnly?: boolean;
}

function RugbyFieldMarkings() {
  return (
    <div className="absolute inset-0">
      {/* Try lines */}
      <div className="absolute top-[5%] left-0 right-0 h-[1px] bg-white/50" />
      <div className="absolute bottom-[5%] left-0 right-0 h-[1px] bg-white/50" />
      {/* 22m lines */}
      <div className="absolute top-[25%] left-0 right-0 h-[1px] bg-white/30" />
      <div className="absolute bottom-[25%] left-0 right-0 h-[1px] bg-white/30" />
      {/* Halfway */}
      <div className="absolute top-[50%] left-0 right-0 h-[2px] bg-white/60" />
      {/* 10m lines */}
      <div className="absolute top-[40%] left-0 right-0 h-[1px] bg-white/20" />
      <div className="absolute bottom-[40%] left-0 right-0 h-[1px] bg-white/20" />
      {/* Touch lines */}
      <div className="absolute top-0 bottom-0 left-[2%] w-[1px] bg-white/40" />
      <div className="absolute top-0 bottom-0 right-[2%] w-[1px] bg-white/40" />
    </div>
  );
}

function FootballFieldMarkings() {
  return (
    <div className="absolute inset-0">
      {/* Field border */}
      <div className="absolute inset-[3%] border-2 border-white/60 rounded-sm" />
      {/* Halfway line */}
      <div className="absolute top-[50%] left-[3%] right-[3%] h-[2px] bg-white/60" />
      {/* Center circle */}
      <div className="absolute top-[50%] left-[50%] w-[15%] h-[12%] -translate-x-1/2 -translate-y-1/2 border-2 border-white/50 rounded-full" />
      {/* Center spot */}
      <div className="absolute top-[50%] left-[50%] w-2 h-2 -translate-x-1/2 -translate-y-1/2 bg-white/60 rounded-full" />
      {/* Top penalty area */}
      <div className="absolute top-[3%] left-[20%] right-[20%] h-[18%] border-2 border-white/50 border-t-0" />
      {/* Top goal area */}
      <div className="absolute top-[3%] left-[32%] right-[32%] h-[8%] border-2 border-white/40 border-t-0" />
      {/* Bottom penalty area */}
      <div className="absolute bottom-[3%] left-[20%] right-[20%] h-[18%] border-2 border-white/50 border-b-0" />
      {/* Bottom goal area */}
      <div className="absolute bottom-[3%] left-[32%] right-[32%] h-[8%] border-2 border-white/40 border-b-0" />
    </div>
  );
}

function HandballFieldMarkings() {
  return (
    <div className="absolute inset-0">
      {/* Field border */}
      <div className="absolute inset-[3%] border-2 border-white/60" />
      {/* Halfway line */}
      <div className="absolute top-[50%] left-[3%] right-[3%] h-[2px] bg-white/60" />
      {/* Center circle */}
      <div className="absolute top-[50%] left-[50%] w-[8%] h-[6%] -translate-x-1/2 -translate-y-1/2 border-2 border-white/50 rounded-full" />
      {/* Top goal area (6m arc) */}
      <div className="absolute top-[3%] left-[25%] right-[25%] h-[20%] border-2 border-white/50 border-t-0 rounded-b-full" />
      {/* Top 9m line (dashed) */}
      <div className="absolute top-[28%] left-[18%] right-[18%] h-[1px] border-b-2 border-dashed border-white/40" />
      {/* Bottom goal area (6m arc) */}
      <div className="absolute bottom-[3%] left-[25%] right-[25%] h-[20%] border-2 border-white/50 border-b-0 rounded-t-full" />
      {/* Bottom 9m line (dashed) */}
      <div className="absolute bottom-[28%] left-[18%] right-[18%] h-[1px] border-t-2 border-dashed border-white/40" />
      {/* Goals */}
      <div className="absolute top-[3%] left-[40%] right-[40%] h-[3%] bg-white/30" />
      <div className="absolute bottom-[3%] left-[40%] right-[40%] h-[3%] bg-white/30" />
    </div>
  );
}

function VolleyballFieldMarkings() {
  return (
    <div className="absolute inset-0">
      {/* Court border */}
      <div className="absolute inset-[5%] border-2 border-white/70" />
      {/* Net line (center) */}
      <div className="absolute top-[50%] left-[5%] right-[5%] h-[3px] bg-white/80" />
      {/* Attack lines (3m from net) */}
      <div className="absolute top-[35%] left-[5%] right-[5%] h-[2px] bg-white/50" />
      <div className="absolute bottom-[35%] left-[5%] right-[5%] h-[2px] bg-white/50" />
      {/* Service zones indicators */}
      <div className="absolute bottom-[5%] right-[5%] w-[15%] h-[1px] bg-white/40" />
      <div className="absolute top-[5%] left-[5%] w-[15%] h-[1px] bg-white/40" />
    </div>
  );
}

function BasketballFieldMarkings() {
  return (
    <div className="absolute inset-0">
      {/* Court border */}
      <div className="absolute inset-[3%] border-2 border-white/60" />
      {/* Halfway line */}
      <div className="absolute top-[50%] left-[3%] right-[3%] h-[2px] bg-white/60" />
      {/* Center circle */}
      <div className="absolute top-[50%] left-[50%] w-[12%] h-[8%] -translate-x-1/2 -translate-y-1/2 border-2 border-white/50 rounded-full" />
      {/* Top 3-point arc */}
      <div className="absolute top-[3%] left-[15%] right-[15%] h-[30%] border-2 border-white/50 border-t-0 rounded-b-full" />
      {/* Top key/paint */}
      <div className="absolute top-[3%] left-[30%] right-[30%] h-[20%] border-2 border-white/50 border-t-0" />
      {/* Top free throw circle */}
      <div className="absolute top-[18%] left-[50%] w-[12%] h-[8%] -translate-x-1/2 border-2 border-dashed border-white/40 rounded-full" />
      {/* Top basket */}
      <div className="absolute top-[5%] left-[50%] w-[3%] h-[1.5%] -translate-x-1/2 bg-white/60" />
      {/* Bottom 3-point arc */}
      <div className="absolute bottom-[3%] left-[15%] right-[15%] h-[30%] border-2 border-white/50 border-b-0 rounded-t-full" />
      {/* Bottom key/paint */}
      <div className="absolute bottom-[3%] left-[30%] right-[30%] h-[20%] border-2 border-white/50 border-b-0" />
      {/* Bottom free throw circle */}
      <div className="absolute bottom-[18%] left-[50%] w-[12%] h-[8%] -translate-x-1/2 border-2 border-dashed border-white/40 rounded-full" />
      {/* Bottom basket */}
      <div className="absolute bottom-[5%] left-[50%] w-[3%] h-[1.5%] -translate-x-1/2 bg-white/60" />
    </div>
  );
}

// Basketball 3x3 (FIBA) - demi-terrain unique avec 1 panier en haut
function Basketball3x3FieldMarkings() {
  return (
    <div className="absolute inset-0">
      {/* Court border (demi-terrain) */}
      <div className="absolute inset-[3%] border-2 border-white/60" />
      {/* Ligne médiane (limite arrière du demi-terrain 3x3) */}
      <div className="absolute bottom-[3%] left-[3%] right-[3%] h-[2px] bg-white/60" />
      {/* Arc à 3 points (6.75m FIBA) - en haut autour du panier */}
      <div className="absolute top-[3%] left-[12%] right-[12%] h-[42%] border-2 border-white/60 border-t-0 rounded-b-full" />
      {/* Raquette (zone restrictive) */}
      <div className="absolute top-[3%] left-[32%] right-[32%] h-[26%] border-2 border-white/55 border-t-0" />
      {/* Cercle des LF */}
      <div className="absolute top-[24%] left-[50%] w-[16%] h-[10%] -translate-x-1/2 border-2 border-dashed border-white/45 rounded-full" />
      {/* Panier */}
      <div className="absolute top-[5%] left-[50%] w-[4%] h-[1.5%] -translate-x-1/2 bg-white/70" />
      {/* Demi-cercle restrictive sous le panier */}
      <div className="absolute top-[5%] left-[50%] w-[10%] h-[6%] -translate-x-1/2 border-2 border-white/40 border-t-0 rounded-b-full" />
    </div>
  );
}

export function SportFieldLineup({ 
  players, 
  sportType = "XV", 
  initialLineup = {},
  initialSubstitutes = [],
  onLineupChange,
  readOnly = false 
}: SportFieldLineupProps) {
  const [lineup, setLineup] = useState<Record<string, string>>(initialLineup);
  const [substitutes, setSubstitutes] = useState<string[]>(initialSubstitutes);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);

  const positions = getPositionsForSport(sportType);
  const fieldConfig = getSportFieldConfig(sportType);

  // Players already on the field (starters)
  const starterIds = useMemo(() => Object.values(lineup), [lineup]);
  
  // Available players (not starters, not substitutes)
  const availablePlayers = useMemo(() => {
    return players.filter(p => !starterIds.includes(p.id) && !substitutes.includes(p.id));
  }, [players, starterIds, substitutes]);

  // Substitute players
  const substitutePlayers = useMemo(() => {
    return players.filter(p => substitutes.includes(p.id));
  }, [players, substitutes]);

  const handlePositionClick = (positionId: string) => {
    if (readOnly) return;
    setSelectedPosition(selectedPosition === positionId ? null : positionId);
  };

  const handlePlayerSelect = (playerId: string) => {
    if (!selectedPosition || readOnly) return;
    
    const newLineup = { ...lineup, [selectedPosition]: playerId };
    setLineup(newLineup);
    onLineupChange?.(newLineup, substitutes);
    setSelectedPosition(null);
  };

  const handleRemovePlayer = (positionId: string) => {
    if (readOnly) return;
    const newLineup = { ...lineup };
    delete newLineup[positionId];
    setLineup(newLineup);
    onLineupChange?.(newLineup, substitutes);
  };

  const handleToggleSubstitute = (playerId: string) => {
    if (readOnly) return;
    
    let newSubs: string[];
    if (substitutes.includes(playerId)) {
      newSubs = substitutes.filter(id => id !== playerId);
    } else {
      // Check if we've reached the max substitutes
      if (substitutes.length >= fieldConfig.substitutes) {
        return; // Don't add more
      }
      newSubs = [...substitutes, playerId];
    }
    setSubstitutes(newSubs);
    onLineupChange?.(lineup, newSubs);
  };

  const handleRemoveSubstitute = (playerId: string) => {
    if (readOnly) return;
    const newSubs = substitutes.filter(id => id !== playerId);
    setSubstitutes(newSubs);
    onLineupChange?.(lineup, newSubs);
  };

  const resetLineup = () => {
    setLineup({});
    setSubstitutes([]);
    onLineupChange?.({}, []);
  };

  const getPlayerName = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    return player ? formatPlayerName(player) : "";
  };

  const filledPositions = Object.keys(lineup).length;
  const totalPositions = positions.length;

  // Individual sports don't have a field (judo, aviron, bowling)
  if (fieldConfig.noField) {
    const sportLabels: Record<string, string> = {
      judo: "Combattants sélectionnés",
      aviron: "Rameurs sélectionnés",
      bowling: "Athlètes sélectionnés",
    };
    const sportMessages: Record<string, string> = {
      judo: "Le judo ne nécessite pas de composition tactique. Utilisez la vue liste.",
      aviron: "L'aviron ne nécessite pas de composition tactique. Utilisez la vue liste.",
      bowling: "Le bowling ne nécessite pas de composition tactique. Utilisez la vue liste.",
    };
    
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {sportLabels[fieldConfig.type] || "Participants sélectionnés"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm mb-4">
            {sportMessages[fieldConfig.type] || "Ce sport ne nécessite pas de composition tactique. Utilisez la vue liste."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const renderFieldMarkings = () => {
    switch (fieldConfig.type) {
      case "football":
        return <FootballFieldMarkings />;
      case "handball":
        return <HandballFieldMarkings />;
      case "volleyball":
        return <VolleyballFieldMarkings />;
      case "basketball":
        return <BasketballFieldMarkings />;
      case "basketball_3x3":
        return <Basketball3x3FieldMarkings />;
      default:
        return <RugbyFieldMarkings />;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" />
              Titulaires {fieldConfig.label}
              <Badge variant="secondary">
                {filledPositions}/{totalPositions}
              </Badge>
            </CardTitle>
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={resetLineup}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sport Field */}
          <div 
            className={`relative w-full bg-gradient-to-b ${fieldConfig.bgColor} rounded-lg overflow-hidden`}
            style={{ aspectRatio: fieldConfig.aspectRatio, maxHeight: "400px" }}
          >
            {/* Field markings */}
            {renderFieldMarkings()}

            {/* Player positions */}
            {positions.map((pos) => {
              const playerId = lineup[pos.id];
              const isSelected = selectedPosition === pos.id;
              const assignedPlayer = playerId ? players.find(p => p.id === playerId) : null;
              const avatar = assignedPlayer?.avatar_url || null;
              
              return (
                <div
                  key={pos.id}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                >
                  <button
                    onClick={() => handlePositionClick(pos.id)}
                    onDoubleClick={() => playerId && handleRemovePlayer(pos.id)}
                    className={`
                      relative flex items-center justify-center
                      w-12 h-12 rounded-full transition-all overflow-hidden
                      ${assignedPlayer 
                        ? "shadow-lg ring-2 ring-white/80" 
                        : "bg-white/20 border-2 border-dashed border-white/50 text-white"
                      }
                      ${!assignedPlayer || !avatar ? (assignedPlayer ? "bg-primary text-primary-foreground" : "") : ""}
                      ${isSelected ? "ring-4 ring-yellow-400 scale-110" : ""}
                      ${!readOnly ? "hover:scale-105 cursor-pointer" : ""}
                    `}
                    disabled={readOnly}
                    title={playerId ? `${getPlayerName(playerId)} - Double-clic pour retirer` : pos.name}
                  >
                    {assignedPlayer && avatar ? (
                      <img src={avatar} alt={getPlayerName(playerId)} className="w-full h-full object-cover" />
                    ) : assignedPlayer ? (
                      <span className="text-[10px] font-bold uppercase">
                        {(assignedPlayer.first_name?.[0] || "") + (assignedPlayer.name?.[0] || "")}
                      </span>
                    ) : (
                      <span className="text-xs font-bold">{pos.id}</span>
                    )}
                    {/* Number badge */}
                    {assignedPlayer && (
                      <span className="absolute -top-1 -right-1 text-[9px] font-bold text-white bg-primary border border-white rounded-full w-4 h-4 flex items-center justify-center shadow">
                        {pos.id}
                      </span>
                    )}
                    {playerId && (
                      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-medium text-white bg-black/60 px-1 rounded whitespace-nowrap max-w-[70px] truncate">
                        {getPlayerName(playerId)}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Player selection for position */}
          {!readOnly && selectedPosition && (() => {
            const posMeta = positions.find(p => p.id === selectedPosition);
            const targetName = normalizePos(posMeta?.name);
            const targetId = normalizePos(posMeta?.id);
            const isMatch = (p: Player) => {
              const pp = normalizePos(p.position);
              if (!pp) return false;
              return pp === targetName || pp === targetId || pp.includes(targetName) || targetName.includes(pp);
            };
            const matching = availablePlayers.filter(isMatch);
            const others = availablePlayers.filter(p => !isMatch(p));
            return (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">
                  Position {selectedPosition}: {posMeta?.name}
                </p>
                <Select onValueChange={handlePlayerSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un athlète..." />
                  </SelectTrigger>
                  <SelectContent>
                    {matching.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] uppercase tracking-wide font-bold text-amber-600 dark:text-amber-400">
                          ★ Postes correspondants
                        </div>
                        {matching.map((player) => (
                          <SelectItem
                            key={player.id}
                            value={player.id}
                            className="bg-gradient-to-r from-amber-400/40 to-yellow-300/30 dark:from-amber-500/40 dark:to-yellow-400/30 border-l-4 border-amber-500 font-bold text-amber-900 dark:text-amber-100 my-0.5 focus:bg-amber-400/60 focus:text-amber-950"
                          >
                            ★ {formatPlayerName(player)} {player.position && `(${player.position})`}
                          </SelectItem>
                        ))}
                        {others.length > 0 && (
                          <div className="px-2 py-1 mt-1 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold border-t">
                            Autres athlètes
                          </div>
                        )}
                      </>
                    )}
                    {others.map((player) => (
                      <SelectItem key={player.id} value={player.id}>
                        {formatPlayerName(player)} {player.position && `(${player.position})`}
                      </SelectItem>
                    ))}
                    {availablePlayers.length === 0 && (
                      <SelectItem value="none" disabled>
                        Tous les athlètes sont assignés
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Substitutes Section */}
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-5 w-5 text-orange-500" />
            Remplaçants
            <Badge variant="outline" className="text-orange-600 border-orange-300">
              {substitutes.length}/{fieldConfig.substitutes}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Current substitutes */}
          {substitutePlayers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {substitutePlayers.map((player, index) => (
                <Badge 
                  key={player.id} 
                  variant="secondary" 
                  className="text-sm py-1 px-2 flex items-center gap-1"
                >
                  <span className="font-bold text-orange-600">{fieldConfig.starters + index + 1}</span>
                  <span>{formatPlayerName(player)}</span>
                  {!readOnly && (
                    <button
                      onClick={() => handleRemoveSubstitute(player.id)}
                      className="ml-1 text-muted-foreground hover:text-destructive"
                    >
                      ×
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          )}

          {/* Add substitutes */}
          {!readOnly && substitutes.length < fieldConfig.substitutes && availablePlayers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Sélectionner les remplaçants ({fieldConfig.substitutes - substitutes.length} places restantes)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                {availablePlayers.map((player) => (
                  <div 
                    key={player.id}
                    className="flex items-center gap-2 p-2 rounded border hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleToggleSubstitute(player.id)}
                  >
                    <Checkbox 
                      checked={substitutes.includes(player.id)}
                      onCheckedChange={() => handleToggleSubstitute(player.id)}
                    />
                    <span className="text-sm truncate">{formatPlayerName(player)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {substitutes.length >= fieldConfig.substitutes && (
            <p className="text-xs text-muted-foreground">
              Effectif complet ({fieldConfig.totalSquad} joueurs au total)
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
