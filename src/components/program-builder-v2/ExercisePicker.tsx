// V2 — A7.3: lightweight exercise picker
//
// Combobox over public.exercise_library, filtered by name. Returns the picked
// exercise to the parent. Designed to live inside a TrainingBlockWrapper.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PickedExercise {
  id: string;
  name: string;
  category: string;
}

interface Props {
  onPick: (ex: PickedExercise) => void;
}

export function ExercisePicker({ onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ["exercise-library-picker", search],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("exercise_library")
        .select("id, name, category")
        .order("name", { ascending: true })
        .limit(40);
      if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PickedExercise[];
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-2xl h-8 gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter un exercice
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 p-2 rounded-2xl backdrop-blur bg-popover/95 shadow-xl border-border/60"
      >
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="rounded-2xl bg-muted/40 border-border/60 pl-8 h-9 text-sm"
          />
        </div>
        <div className="max-h-72 overflow-auto space-y-0.5">
          {isLoading && (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          {!isLoading && exercises.length === 0 && (
            <p className="text-xs text-center text-muted-foreground py-6">
              Aucun exercice trouvé.
            </p>
          )}
          {exercises.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => {
                onPick(ex);
                setOpen(false);
                setSearch("");
              }}
              className={cn(
                "w-full text-left px-2.5 py-1.5 rounded-xl text-sm",
                "hover:bg-muted/60 transition-colors",
                "flex items-center justify-between gap-2",
              )}
            >
              <span className="truncate">{ex.name}</span>
              <span className="text-[10px] uppercase text-muted-foreground shrink-0">
                {ex.category}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
