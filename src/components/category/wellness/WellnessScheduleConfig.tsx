import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  categoryId: string;
}

// 1 = Lundi ... 0 = Dimanche (compatible avec Date.getDay())
const DAYS: { value: number; short: string; long: string }[] = [
  { value: 1, short: "L", long: "Lundi" },
  { value: 2, short: "M", long: "Mardi" },
  { value: 3, short: "M", long: "Mercredi" },
  { value: 4, short: "J", long: "Jeudi" },
  { value: 5, short: "V", long: "Vendredi" },
  { value: 6, short: "S", long: "Samedi" },
  { value: 0, short: "D", long: "Dimanche" },
];

const DEFAULT_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function WellnessScheduleConfig({ categoryId }: Props) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<number[]>(DEFAULT_DAYS);
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["wellness_schedule", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_schedules")
        .select("days_of_week")
        .eq("category_id", categoryId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data?.days_of_week) {
      setSelected([...data.days_of_week].sort());
      setDirty(false);
    }
  }, [data]);

  const toggle = (day: number) => {
    setSelected(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("wellness_schedules")
        .upsert(
          { category_id: categoryId, days_of_week: selected },
          { onConflict: "category_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Planning Wellness mis à jour");
      queryClient.invalidateQueries({ queryKey: ["wellness_schedule", categoryId] });
      setDirty(false);
    },
    onError: () => toast.error("Erreur lors de l'enregistrement"),
  });

  const frequency = selected.length;
  const everyday = frequency === 7;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-primary" />
              Fréquence du Wellness — Jours
            </CardTitle>
            <CardDescription>
              Choisissez les jours où les athlètes doivent remplir leur wellness. Ce planning est partagé avec leur espace athlète.
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending || selected.length === 0}
          >
            <Save className="h-4 w-4 mr-1.5" />
            Enregistrer
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {DAYS.map(d => {
            const isOn = selected.includes(d.value);
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => toggle(d.value)}
                disabled={isLoading}
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl border-2 px-3 py-2 min-w-[64px] transition-all active:scale-95",
                  isOn
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface-sunken text-muted-foreground hover:border-primary/40"
                )}
              >
                <span className="text-xs font-medium">{d.long.slice(0, 3)}</span>
                <span className="text-[10px] opacity-70">{d.short}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {everyday
            ? "Wellness demandé tous les jours (7×/semaine)."
            : selected.length === 0
              ? "Sélectionnez au moins un jour."
              : `Wellness demandé ${frequency}×/semaine — ${DAYS.filter(d => selected.includes(d.value)).map(d => d.long).join(", ")}.`}
        </p>
      </CardContent>
    </Card>
  );
}
