import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getLevelForPercent, type BatteryLevel } from "@/lib/constants/testUnits";
import { cn } from "@/lib/utils";

interface BatteryResultsListProps {
  categoryId: string;
  batteryName: string;
  batteryLevels?: BatteryLevel[];
  totalMax: number;
}

interface GenericTestRow {
  id: string;
  player_id: string;
  test_date: string;
  result_value: number | null;
  result_unit: string | null;
  notes: string | null;
  test_type: string | null;
  players?: { id: string; name: string; first_name: string | null } | null;
}

/** Extract the points stored in the note (`Score 12 pts` or `Score 8/10 pts`). */
function parsePoints(notes: string | null): number {
  if (!notes) return 0;
  const m = notes.match(/Score\s+(\d+(?:[.,]\d+)?)/i);
  if (!m) return 0;
  return parseFloat(m[1].replace(",", "."));
}

/** Extract max points from note if in full format `Score N/M pts`. */
function parseMaxPoints(notes: string | null): number | null {
  if (!notes) return null;
  const m = notes.match(/Score\s+\d+(?:[.,]\d+)?\s*\/\s*(\d+(?:[.,]\d+)?)/i);
  if (!m) return null;
  return parseFloat(m[1].replace(",", "."));
}

/** Extract the test name from the note (`Test: 10m sprint (Droit) · Score ...`). */
function parseTestName(notes: string | null): string {
  if (!notes) return "Test";
  const m = notes.match(/Test:\s*(.+?)\s*·\s*Score/i);
  if (m) return m[1].trim();
  return notes.replace(/^\[.*?\]\s*/, "").trim();
}

export function BatteryResultsList({
  categoryId,
  batteryName,
  batteryLevels,
  totalMax,
}: BatteryResultsListProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: rows = [] } = useQuery({
    queryKey: ["battery-results-list", categoryId, batteryName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generic_tests")
        .select("id, player_id, test_date, result_value, result_unit, notes, test_type, players(id, name, first_name)")
        .eq("category_id", categoryId)
        .ilike("notes", `[Batterie: ${batteryName}]%`)
        .order("test_date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as GenericTestRow[];
    },
    enabled: !!categoryId && !!batteryName,
  });

  // Lookup max_points per test_name for this battery (to compute % per test → color)
  const { data: maxByTest = {} } = useQuery({
    queryKey: ["battery-items-max", categoryId, batteryName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_batteries")
        .select("items:test_battery_items(test_name, max_points)")
        .eq("category_id", categoryId)
        .eq("name", batteryName)
        .maybeSingle();
      if (error) throw error;
      const map: Record<string, number> = {};
      const items = (data as any)?.items || [];
      for (const it of items) {
        if (it?.test_name) map[String(it.test_name).trim().toLowerCase()] = Number(it.max_points) || 0;
      }
      return map;
    },
    enabled: !!categoryId && !!batteryName,
  });

  /** Group by player+date (one passation = same day for one athlete). */
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        playerId: string;
        playerName: string;
        date: string;
        rows: GenericTestRow[];
        totalPts: number;
      }
    >();
    for (const r of rows) {
      const key = `${r.player_id}__${r.test_date}`;
      const existing = map.get(key);
      const pts = parsePoints(r.notes);
      if (existing) {
        existing.rows.push(r);
        existing.totalPts += pts;
      } else {
        const playerName = r.players?.first_name
          ? `${r.players.first_name} ${r.players.name}`
          : r.players?.name || "Athlète";
        map.set(key, {
          playerId: r.player_id,
          playerName,
          date: r.test_date,
          rows: [r],
          totalPts: pts,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [rows]);

  if (grouped.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic px-1">
        Aucun athlète n’a encore passé cette batterie.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        Athlètes évalués ({grouped.length})
      </div>
      <div className="space-y-1">
        {grouped.map((g) => {
          const key = `${g.playerId}__${g.date}`;
          const isOpen = !!expanded[key];
          const percent = totalMax > 0 ? Math.round((g.totalPts / totalMax) * 100) : 0;
          const level = getLevelForPercent(percent, batteryLevels);
          return (
            <div key={key} className="rounded-xl border bg-background overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-2 text-left",
                  "hover:bg-muted/50 transition-colors"
                )}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-medium text-sm truncate">{g.playerName}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {format(new Date(g.date), "dd/MM/yyyy", { locale: fr })}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold tabular-nums">
                    {Math.round(g.totalPts)}/{totalMax}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {percent}%
                  </span>
                  <Badge
                    className="text-[11px] px-2 py-0.5"
                    style={{ backgroundColor: level.color, color: "white" }}
                  >
                    {level.label}
                  </Badge>
                </div>
              </button>
              {isOpen && (
                <div className="border-t bg-muted/20 px-3 py-2 space-y-1">
                  {g.rows.map((r) => {
                    const pts = parsePoints(r.notes);
                    const testName = parseTestName(r.notes);
                    const maxFromNote = parseMaxPoints(r.notes);
                    const maxFromLookup = maxByTest[testName.trim().toLowerCase()] || 0;
                    const max = maxFromNote ?? maxFromLookup;
                    const itemPct = max > 0 ? Math.round((pts / max) * 100) : 0;
                    const itemLevel = getLevelForPercent(itemPct, batteryLevels);
                    return (
                      <div
                        key={r.id}
                        className="flex items-center justify-between gap-2 text-xs py-1"
                      >
                        <span className="truncate flex-1">{testName}</span>
                        <span className="font-medium text-primary tabular-nums shrink-0">
                          {r.result_value} {r.result_unit || ""}
                        </span>
                        <Badge
                          className="text-[10px] shrink-0"
                          style={{ backgroundColor: itemLevel.color, color: "white" }}
                        >
                          {Math.round(pts)}{max > 0 ? `/${max}` : ""} pts
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
