import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CircleDot } from "lucide-react";

interface Props {
  playerId?: string;
  categoryId: string;
  value: string | null;
  onChange: (ballId: string | null) => void;
  /** Label affiché au-dessus du select. */
  label?: string;
}

/**
 * Sélecteur de boule pour un bloc du mode simplifié.
 * Charge l'arsenal actif du joueur et propose un select compact.
 */
export function SimplifiedBallPicker({
  playerId,
  categoryId,
  value,
  onChange,
  label = "Boule utilisée",
}: Props) {
  const { data: arsenal } = useQuery({
    enabled: !!playerId,
    queryKey: ["bowling_arsenal_simplified", playerId, categoryId],
    queryFn: async () => {
      const { data: catalog } = await supabase
        .from("bowling_ball_catalog" as any)
        .select("*");
      const catalogMap = new Map((catalog as any[] || []).map((b: any) => [b.id, b]));

      const { data, error } = await supabase
        .from("player_bowling_arsenal" as any)
        .select("*")
        .eq("player_id", playerId!)
        .eq("category_id", categoryId)
        .eq("is_active", true)
        .order("created_at");
      if (error) throw error;

      return (data as any[]).map((item: any) => ({
        id: item.id as string,
        displayName:
          item.ball_catalog_id && catalogMap.has(item.ball_catalog_id)
            ? `${(catalogMap.get(item.ball_catalog_id) as any).brand} ${(catalogMap.get(item.ball_catalog_id) as any).model}`
            : `${item.custom_ball_brand || ""} ${item.custom_ball_name || "Custom"}`.trim(),
        weight: item.weight_lbs as number | null,
      }));
    },
  });

  if (!playerId) return null;
  if (!arsenal || arsenal.length === 0) return null;

  return (
    <div className="space-y-1">
      <Label className="text-xs flex items-center gap-1">
        <CircleDot className="h-3 w-3" />
        {label}
      </Label>
      <Select
        value={value || "__none__"}
        onValueChange={(v) => onChange(v === "__none__" ? null : v)}
      >
        <SelectTrigger className="h-9 text-sm bg-surface-sunken">
          <SelectValue placeholder="Sélectionner une boule" />
        </SelectTrigger>
        <SelectContent className="z-[100]">
          <SelectItem value="__none__" className="italic">
            Non définie
          </SelectItem>
          {arsenal.map((ball) => (
            <SelectItem key={ball.id} value={ball.id}>
              {ball.displayName} {ball.weight ? `(${ball.weight} lbs)` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Hook utilitaire pour afficher le nom d'une boule à partir de son id. */
export function useBallName(playerId: string | undefined, categoryId: string, ballId: string | null | undefined) {
  const { data } = useQuery({
    enabled: !!playerId && !!ballId,
    queryKey: ["bowling_ball_name", playerId, categoryId, ballId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_bowling_arsenal" as any)
        .select("id, custom_ball_brand, custom_ball_name, ball_catalog_id")
        .eq("id", ballId!)
        .maybeSingle();
      if (error || !data) return null;
      const row: any = data;
      if (row.ball_catalog_id) {
        const { data: cat } = await supabase
          .from("bowling_ball_catalog" as any)
          .select("brand, model")
          .eq("id", row.ball_catalog_id)
          .maybeSingle();
        if (cat) return `${(cat as any).brand} ${(cat as any).model}`;
      }
      return `${row.custom_ball_brand || ""} ${row.custom_ball_name || "Custom"}`.trim();
    },
  });
  return data ?? null;
}
