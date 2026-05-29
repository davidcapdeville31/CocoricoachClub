// Dialog principal — flux 3 étapes : Type → Configurer → Critères de réussite.
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Save, Library } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BowlingBlockTypePicker } from "./BowlingBlockTypePicker";
import {
  BowlingTechnicalBuilder,
  BowlingTacticalBuilder,
  BowlingGamesBuilder,
  BowlingWarmupBuilder,
} from "./builders";
import { BowlingSuccessCriteria as CriteriaForm } from "./BowlingSuccessCriteria";
import { BowlingBlockPreview, buildAutoTitle } from "./BowlingBlockPreview";
import { BowlingExerciseLibraryDialog } from "../library/BowlingExerciseLibraryDialog";
import { EMPTY_BLOCK, type BowlingBlockDraft, type BowlingBlockType } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categoryId: string;
  athleteId?: string | null;
  sessionId?: string | null;
  source?: "coach" | "athlete";
  editBlock?: BowlingBlockDraft | null;
  onSaved?: () => void;
}

export function BowlingTrainingBuilderDialog({
  open, onOpenChange, categoryId, athleteId, sessionId, source = "coach", editBlock, onSaved,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(editBlock ? 2 : 1);
  const [block, setBlock] = useState<BowlingBlockDraft>(editBlock || { ...EMPTY_BLOCK });
  const [libraryOpen, setLibraryOpen] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setStep(editBlock ? 2 : 1);
      setBlock(editBlock || { ...EMPTY_BLOCK });
    }
  }, [open, editBlock]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const title = buildAutoTitle(block);
      const payload = {
        session_id: sessionId ?? null,
        category_id: categoryId,
        athlete_id: athleteId ?? null,
        source,
        block_type: block.block_type,
        title,
        duration_min: block.duration_min,
        planned_throws: block.planned_throws,
        priority: block.priority,
        coach_instruction: block.coach_instruction || null,
        internal_note: block.internal_note || null,
        objectives: block.objectives,
        success_criteria: block.success_criteria as any,
        pattern_id: block.pattern_id,
        config: block.config as any,
        status: "planned",
      };
      const { error } = await supabase.from("bowling_training_blocks").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bloc bowling créé");
      qc.invalidateQueries({ queryKey: ["bowling_training_blocks"] });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const applyLibrary = (cfg: Record<string, unknown>, category: BowlingBlockType, name: string) => {
    setBlock((b) => ({
      ...b,
      block_type: category,
      title: name,
      planned_throws: (cfg as any).planned_throws ?? b.planned_throws ?? 20,
      config: { ...(b.config || {}), ...cfg } as any,
      objectives: ((cfg as any).target_outcomes ?? b.objectives ?? []) as string[],
    }));
    setStep(2);
  };

  const builderForType = () => {
    const common = { value: block, onChange: setBlock, categoryId };
    switch (block.block_type) {
      case "technical": return <BowlingTechnicalBuilder {...common} />;
      case "tactical": return <BowlingTacticalBuilder {...common} />;
      case "games": return <BowlingGamesBuilder {...common} />;
      case "warmup": return <BowlingWarmupBuilder {...common} />;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span>Séance bowling — Étape {step}/3</span>
              <Button variant="outline" size="sm" onClick={() => setLibraryOpen(true)}>
                <Library className="h-4 w-4 mr-1" /> Bibliothèque
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {step === 1 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Choisissez le type de bloc à créer.</p>
                <BowlingBlockTypePicker value={block.block_type} onChange={(t) => setBlock({ ...block, block_type: t, config: {}, objectives: [] })} />
              </div>
            )}

            {step === 2 && builderForType()}

            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Définissez les critères de réussite pour évaluer l'exercice.</p>
                <CriteriaForm value={block.success_criteria} onChange={(c) => setBlock({ ...block, success_criteria: c })} />
                <BowlingBlockPreview block={block} />
              </div>
            )}

            {step !== 3 && <BowlingBlockPreview block={block} />}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
            <Button variant="outline" onClick={() => (step > 1 ? setStep((s) => (s - 1) as any) : onOpenChange(false))}>
              <ArrowLeft className="h-4 w-4 mr-1" /> {step > 1 ? "Précédent" : "Annuler"}
            </Button>
            {step < 3 ? (
              <Button onClick={() => setStep((s) => (s + 1) as any)}>
                Suivant <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-1" /> Enregistrer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BowlingExerciseLibraryDialog open={libraryOpen} onOpenChange={setLibraryOpen} onPick={applyLibrary} />
    </>
  );
}
