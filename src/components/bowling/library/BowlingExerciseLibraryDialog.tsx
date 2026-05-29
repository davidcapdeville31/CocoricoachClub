import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BOWLING_SEED_EXERCISES, BOWLING_LIBRARY_CATEGORY_LABEL } from "./bowlingLibrarySeed";
import type { BowlingBlockType } from "../blocks/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (config: Record<string, unknown>, category: BowlingBlockType, name: string) => void;
}

export function BowlingExerciseLibraryDialog({ open, onOpenChange, onPick }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bibliothèque d'exercices bowling</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="technical">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="technical">Technique</TabsTrigger>
            <TabsTrigger value="tactical">Tactique</TabsTrigger>
            <TabsTrigger value="games">Parties</TabsTrigger>
          </TabsList>
          {(["technical", "tactical", "games"] as const).map((cat) => (
            <TabsContent key={cat} value={cat} className="space-y-2 mt-3">
              {BOWLING_SEED_EXERCISES.filter((e) => e.category === cat).map((e) => (
                <div key={e.name} className="rounded-xl border p-3 flex items-center justify-between gap-3 hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{e.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{e.description}</p>
                  </div>
                  <Button size="sm" onClick={() => { onPick(e.config, e.category as BowlingBlockType, e.name); onOpenChange(false); }}>
                    Utiliser
                  </Button>
                </div>
              ))}
              {BOWLING_SEED_EXERCISES.filter((e) => e.category === cat).length === 0 && (
                <p className="text-sm text-muted-foreground italic">Aucun exercice — {BOWLING_LIBRARY_CATEGORY_LABEL[cat]}</p>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
