// Wrapper utilisé dans FieldSessionDialog pour remplacer l'ancienne UI "Exercice DTN"
// par les nouveaux builders structurés (technique / tactique / parties / échauffement)
// + critères de réussite. Stocke le résultat sous forme BowlingBlockDraft sérialisée
// dans `bowling_dtn_variables` (champ déjà persisté par le flux existant).
import { useMemo } from "react";
import {
  BowlingTechnicalBuilder,
  BowlingTacticalBuilder,
  BowlingGamesBuilder,
  BowlingWarmupBuilder,
} from "./builders";
import { BowlingSuccessCriteria as CriteriaForm } from "./BowlingSuccessCriteria";
import { BowlingBlockPreview, buildAutoTitle } from "./BowlingBlockPreview";
import { Card } from "@/components/ui/card";
import { EMPTY_BLOCK, type BowlingBlockDraft, type BowlingBlockType } from "./types";

interface Props {
  parent: "bowling_technique" | "bowling_tactique" | "bowling_parties";
  categoryId: string;
  variables: Record<string, unknown>;
  onVariablesChange: (v: Record<string, unknown>) => void;
  hideSuccessCriteria?: boolean;
}

const parentToType = (p: Props["parent"]): BowlingBlockType =>
  p === "bowling_technique" ? "technical" : p === "bowling_tactique" ? "tactical" : "games";

export function BowlingBlockInlineEditor({ parent, categoryId, variables, onVariablesChange, hideSuccessCriteria }: Props) {
  const draft: BowlingBlockDraft = useMemo(() => {
    const stored = (variables?.__bowling_block__ as BowlingBlockDraft | undefined) ?? null;
    const block_type = parentToType(parent);
    if (stored && stored.block_type === block_type) return stored;
    return { ...EMPTY_BLOCK, block_type };
  }, [variables, parent]);

  const update = (next: BowlingBlockDraft) => {
    const title = next.title?.trim() || buildAutoTitle(next);
    onVariablesChange({
      ...(variables || {}),
      __bowling_block__: { ...next, title },
    });
  };

  const renderBuilder = () => {
    const common = { value: draft, onChange: update, categoryId };
    switch (draft.block_type) {
      case "technical": return <BowlingTechnicalBuilder {...common} />;
      case "tactical": return <BowlingTacticalBuilder {...common} />;
      case "games": return <BowlingGamesBuilder {...common} />;
      case "warmup": return <BowlingWarmupBuilder {...common} />;
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Configuration du bloc bowling
      </p>

      {renderBuilder()}

      {!hideSuccessCriteria && (
        <Card className="p-3 space-y-2 bg-muted/30">
          <p className="text-xs font-semibold text-muted-foreground">Critères de réussite</p>
          <CriteriaForm
            value={draft.success_criteria}
            onChange={(c) => update({ ...draft, success_criteria: c })}
          />
        </Card>
      )}

      <BowlingBlockPreview block={draft} />
    </div>
  );
}
