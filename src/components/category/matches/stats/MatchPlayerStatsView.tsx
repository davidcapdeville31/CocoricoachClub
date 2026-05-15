import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TeamStats } from "../live/hooks/useMatchStats";
import type { MatchEvent } from "../live/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ArrowUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  matchId: string;
  events: MatchEvent[];
  players: Record<string, TeamStats & { events: number }>;
  clubSide: "home" | "away";
}

type SortKey = "name" | "points" | "tries" | "tackles" | "events";

export function MatchPlayerStatsView({ matchId, events, players, clubSide }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("events");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: lineup = [] } = useQuery({
    queryKey: ["match-stats-lineup", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_lineups")
        .select("player_id, position, is_starter, players(id, name, first_name)")
        .eq("match_id", matchId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const rows = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; position: string; isStarter: boolean; stats: TeamStats & { events: number } }
    >();
    for (const l of lineup) {
      if (!l.player_id) continue;
      map.set(l.player_id, {
        id: l.player_id,
        name: `${l.players?.first_name ?? ""} ${l.players?.name ?? ""}`.trim() || "—",
        position: l.position ?? "",
        isStarter: !!l.is_starter,
        stats: players[l.player_id] ?? ({ events: 0 } as any),
      });
    }
    // include players with events but not in lineup
    for (const [pid, st] of Object.entries(players)) {
      if (!map.has(pid)) {
        map.set(pid, { id: pid, name: "Joueur inconnu", position: "", isStarter: false, stats: st });
      }
    }
    let arr = Array.from(map.values());
    if (search.trim()) {
      const s = search.toLowerCase();
      arr = arr.filter((r) => r.name.toLowerCase().includes(s) || r.position.toLowerCase().includes(s));
    }
    arr.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "name": av = a.name; bv = b.name; break;
        case "points": av = a.stats.points ?? 0; bv = b.stats.points ?? 0; break;
        case "tries": av = a.stats.tries ?? 0; bv = b.stats.tries ?? 0; break;
        case "tackles": av = a.stats.tackles ?? 0; bv = b.stats.tackles ?? 0; break;
        case "events":
        default:
          av = a.stats.events ?? 0; bv = b.stats.events ?? 0;
      }
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [lineup, players, search, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const SortBtn = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <button
      onClick={() => toggleSort(k)}
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground",
        sortKey === k && "text-foreground",
        className,
      )}
    >
      {label}
      <ArrowUpDown className="h-3 w-3 opacity-50" />
    </button>
  );

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 -mx-1 flex items-center gap-2 rounded-xl bg-surface/80 px-3 py-2 backdrop-blur-md">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un joueur ou un poste…"
            className="h-9 bg-surface-sunken pl-8 text-sm"
          />
        </div>
        <Badge variant="outline" className="text-[11px]">{rows.length} joueur{rows.length > 1 ? "s" : ""}</Badge>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[1.6fr_repeat(8,minmax(40px,1fr))] items-center gap-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <SortBtn k="name" label="Joueur" />
        <SortBtn k="points" label="Pts" className="justify-center" />
        <SortBtn k="tries" label="Ess" className="justify-center" />
        <span className="text-center">Tr</span>
        <span className="text-center">Pén</span>
        <SortBtn k="tackles" label="Pl" className="justify-center" />
        <span className="text-center">Pl✗</span>
        <span className="text-center">EA</span>
        <span className="text-center">Crt</span>
        <SortBtn k="events" label="Act" className="justify-center" />
      </div>

      {/* Rows */}
      <ScrollArea className="h-[55vh] pr-2">
        <div className="space-y-1">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface-sunken/40 py-10 text-center text-sm text-muted-foreground">
              <User className="h-6 w-6 opacity-50" />
              Aucun joueur enregistré pour ce match
            </div>
          ) : null}
          {rows.map((r) => {
            const s = r.stats;
            const cards = (s.yellowCards ?? 0) + (s.redCards ?? 0);
            return (
              <div
                key={r.id}
                className={cn(
                  "group grid grid-cols-[1.6fr_repeat(8,minmax(40px,1fr))] items-center gap-1 rounded-xl border border-transparent bg-surface px-3 py-2 text-sm transition-all hover:border-brand-500/30 hover:bg-surface-elevated hover:shadow-sm",
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold uppercase",
                      r.isStarter
                        ? "bg-brand-500/15 text-brand-500"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {r.position || "—"}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{r.name}</div>
                    {!r.isStarter ? (
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Remplaçant</div>
                    ) : null}
                  </div>
                </div>
                <Cell value={s.points} accent="brand" />
                <Cell value={s.tries} accent="success" />
                <Cell value={s.conversionsAttempted ? `${s.conversionsMade}/${s.conversionsAttempted}` : "—"} />
                <Cell value={s.penaltiesAttempted ? `${s.penaltiesMade}/${s.penaltiesAttempted}` : "—"} />
                <Cell value={s.tackles} />
                <Cell value={s.missedTackles} accent={s.missedTackles > 0 ? "danger" : "muted"} />
                <Cell value={s.knockOns} accent={s.knockOns > 0 ? "danger" : "muted"} />
                <Cell value={cards || "—"} accent={cards ? "warning" : "muted"} />
                <Cell value={s.events ?? 0} accent="muted" />
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function Cell({
  value,
  accent = "muted",
}: {
  value: any;
  accent?: "brand" | "success" | "danger" | "warning" | "muted";
}) {
  const isZero = value === 0 || value === "—" || value === "0/0";
  const colorMap = {
    brand: "text-brand-500",
    success: "text-emerald-500",
    danger: "text-rose-500",
    warning: "text-amber-500",
    muted: "text-foreground",
  };
  return (
    <div
      className={cn(
        "text-center font-mono text-sm font-semibold tabular-nums",
        isZero ? "text-muted-foreground/50" : colorMap[accent],
      )}
    >
      {value}
    </div>
  );
}
