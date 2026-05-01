// V2 Exercise Bank Sidebar — click-to-add exercise picker that mirrors the
// "Bibliothèque d'exercices" panel from the legacy program editor.
//
// - Search input + station/category tabs
// - Click on an exercise → onPick(exercise) so the parent can append it to the
//   currently active block.
// - Visually consistent with SaaS Premium tokens (rounded-2xl, bg-muted/40).

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Dumbbell, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PickedExercise } from "./ExercisePicker";

interface Props {
  onPick: (ex: PickedExercise) => void;
}

interface LibraryRow {
  id: string;
  name: string;
  category: string;
  station_name: string | null;
}

const QUICK_STATIONS = [
  "Musculation",
  "CrossFit",
  "Mobilité/Stretching",
  "Cardio",
  "Échauffement",
];

export function V2ExerciseBankSidebar({ onPick }: Props) {
  const [search, setSearch] = useState("");
  const [station, setStation] = useState<string>("all");

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ["v2-bank-sidebar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_library")
        .select("id, name, category, station_name")
        .order("name", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as LibraryRow[];
    },
  });

  const stations = useMemo(() => {
    const set = new Set<string>();
    exercises.forEach((e) => {
      if (e.station_name) set.add(e.station_name);
    });
    // Keep quick ones first, then any extra discovered
    const ordered = [
      ...QUICK_STATIONS.filter((s) => set.has(s)),
      ...Array.from(set).filter((s) => !QUICK_STATIONS.includes(s)).sort(),
    ];
    return ordered;
  }, [exercises]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return exercises.filter((e) => {
      if (station !== "all" && e.station_name !== station) return false;
      if (term && !e.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [exercises, search, station]);

  return (
    <>
      <div className="p-3 border-b space-y-2 flex-shrink-0">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-primary" />
          <span className="truncate">Banque d'exercices</span>
        </h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-2xl bg-muted/40 border-border/60"
          />
        </div>
      </div>

      <div className="px-2 py-2 border-b bg-muted/30 flex-shrink-0">
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            size="sm"
            variant={station === "all" ? "default" : "outline"}
            className={cn(
              "h-7 text-xs font-medium rounded-2xl",
              station === "all" && "bg-primary text-primary-foreground shadow-sm",
            )}
            onClick={() => setStation("all")}
          >
            Toutes
          </Button>
          {stations.map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={station === s ? "default" : "outline"}
              className={cn(
                "h-7 text-xs font-medium rounded-2xl",
                station === s && "bg-primary text-primary-foreground shadow-sm",
              )}
              onClick={() => setStation(s)}
            >
              <span className="truncate max-w-[100px]">{s}</span>
            </Button>
          ))}
        </div>
        <div className="mt-1.5 px-1">
          <span className="text-xs text-muted-foreground">
            {filtered.length} exercice{filtered.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Aucun exercice trouvé
            </p>
          )}
          {filtered.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() =>
                onPick({ id: ex.id, name: ex.name, category: ex.category })
              }
              className={cn(
                "w-full text-left rounded-xl border border-border/60 bg-muted/40",
                "px-3 py-2 hover:bg-muted/70 hover:border-primary/40 transition-colors",
                "flex items-start justify-between gap-2",
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{ex.name}</p>
                <p className="text-[10px] uppercase text-muted-foreground truncate">
                  {ex.category}
                </p>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </>
  );
}
