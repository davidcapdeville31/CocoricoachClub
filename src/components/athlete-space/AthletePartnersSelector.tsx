import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { fetchCategoryRosterPlayers } from "@/lib/categoryRoster";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

interface Props {
  categoryId: string;
  /** Current athlete — excluded from the list. */
  selfPlayerId: string;
  value: string[];
  onChange: (ids: string[]) => void;
}

/**
 * Sélection d'un ou plusieurs coéquipiers de la même catégorie ayant réalisé
 * la séance avec l'athlète. Générique : disponible pour toutes les disciplines.
 */
export function AthletePartnersSelector({ categoryId, selfPlayerId, value, onChange }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const { data: players = [] } = useQuery({
    queryKey: ["athlete-partners-roster", categoryId, selfPlayerId],
    queryFn: async () => {
      const format = (rows: any[]) =>
        (rows || [])
          .filter((p: any) => p.id !== selfPlayerId)
          .map((p: any) => {
            const last = String(p.name || "").trim();
            const first = String(p.first_name || "").trim();
            const label = [last.toUpperCase(), first].filter(Boolean).join(" ") || "—";
            return { id: p.id as string, name: label };
          })
          .sort((a, b) => a.name.localeCompare(b.name, "fr"));

      // Les athlètes n'ont pas accès en lecture directe aux autres joueurs (RLS) :
      // on passe par une fonction sécurisée qui ne renvoie que nom/prénom.
      const { data: rpcRows, error: rpcError } = await supabase.rpc("get_category_roster_min", {
        _category_id: categoryId,
      });
      if (!rpcError && rpcRows && rpcRows.length > 0) return format(rpcRows as any[]);

      try {
        const roster = await fetchCategoryRosterPlayers(categoryId);
        return format(roster as any[]);
      } catch {
        return [];
      }
    },
    enabled: !!categoryId,
  });


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => p.name.toLowerCase().includes(q));
  }, [players, search]);

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          {t("athleteSpace.partners.title", "Avec qui as-tu fait la séance ? (optionnel)")}
        </Label>
        {value.length > 0 && (
          <Badge variant="secondary">
            {t("athleteSpace.partners.selected", "{{count}} sélectionné(s)", { count: value.length })}
          </Badge>
        )}
      </div>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("athleteSpace.partners.search", "Rechercher un athlète...")}
      />
      <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-surface-sunken p-2 space-y-1">
        {filtered.map((p) => (
          <label
            key={p.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60"
          >
            <Checkbox checked={value.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
            <span className="text-sm">{p.name}</span>
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            {t("athleteSpace.partners.empty", "Aucun athlète trouvé")}
          </p>
        )}
      </div>
    </div>
  );
}
