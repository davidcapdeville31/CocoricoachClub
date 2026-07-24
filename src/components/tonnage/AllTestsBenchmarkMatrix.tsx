import { useState } from "react";
import { BenchmarkPositionMatrix } from "./BenchmarkPositionMatrix";

interface Props {
  categoryId: string;
  filterPlayerId?: string;
}

/**
 * Rend un bloc "tableau + graphique" par test avec au moins un résultat.
 * Utilisé dans l'espace athlète pour tout voir d'un coup, sans dropdown.
 */
export function AllTestsBenchmarkMatrix({ categoryId, filterPlayerId }: Props) {
  const [options, setOptions] = useState<{ key: string; label: string; count: number }[]>([]);

  const visible = options.filter((o) => o.count > 0);

  return (
    <div className="space-y-6">
      {/* Instance invisible pour collecter la liste des tests */}
      <BenchmarkPositionMatrix
        categoryId={categoryId}
        filterPlayerId={filterPlayerId}
        renderOnlyOptions
        onTestOptions={setOptions}
      />

      {visible.map((o) => (
        <BenchmarkPositionMatrix
          key={o.key}
          categoryId={categoryId}
          filterPlayerId={filterPlayerId}
          hideSelector
          forcedKey={o.key}
        />
      ))}
    </div>
  );
}
