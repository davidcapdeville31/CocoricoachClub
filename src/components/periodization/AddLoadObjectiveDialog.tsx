import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  week_number: z.number().min(1, "Le numéro de semaine est requis"),
  start_date: z.string().min(1, "La date de début est requise"),
  end_date: z.string().min(1, "La date de fin est requise"),
  cycle_type: z.string().default("normal"),
  target_load_min: z.number().min(0).optional(),
  target_load_max: z.number().min(0).optional(),
  target_awcr_min: z.number().min(0).max(3).optional(),
  target_awcr_max: z.number().min(0).max(3).optional(),
  target_intensity: z.number().min(0).max(100).optional(),
  period_id: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface AddLoadObjectiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
}

const cycleTypes = [
  { value: "recovery", label: "Récupération", description: "Semaine de décharge" },
  { value: "normal", label: "Normal", description: "Charge standard" },
  { value: "intensification", label: "Intensification", description: "Montée en charge" },
  { value: "competition", label: "Compétition", description: "Affûtage pré-match" },
];

// Preset load objectives by cycle type
const loadPresets: Record<string, { loadMin: number; loadMax: number; awcrMin: number; awcrMax: number }> = {
  recovery: { loadMin: 200, loadMax: 400, awcrMin: 0.6, awcrMax: 0.9 },
  normal: { loadMin: 400, loadMax: 600, awcrMin: 0.8, awcrMax: 1.2 },
  intensification: { loadMin: 600, loadMax: 900, awcrMin: 1.0, awcrMax: 1.4 },
  competition: { loadMin: 300, loadMax: 500, awcrMin: 0.7, awcrMax: 1.0 },
};

export function AddLoadObjectiveDialog({
  open,
  onOpenChange,
  categoryId,
}: AddLoadObjectiveDialogProps) {
  const queryClient = useQueryClient();

  const { data: periods } = useQuery({
    queryKey: ["training_periods", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_periods")
        .select("*")
        .eq("category_id", categoryId)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      week_number: 1,
      start_date: "",
      end_date: "",
      cycle_type: "normal",
      target_load_min: 400,
      target_load_max: 600,
      target_awcr_min: 0.8,
      target_awcr_max: 1.3,
      notes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("training_cycles").insert({
        name: data.name,
        week_number: data.week_number,
        start_date: data.start_date,
        end_date: data.end_date,
        cycle_type: data.cycle_type,
        target_load_min: data.target_load_min,
        target_load_max: data.target_load_max,
        target_awcr_min: data.target_awcr_min,
        target_awcr_max: data.target_awcr_max,
        target_intensity: data.target_intensity,
        period_id: data.period_id || null,
        notes: data.notes,
        category_id: categoryId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_cycles", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["training_cycles_with_load", categoryId] });
      toast.success("Cycle créé avec succès");
      form.reset();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Erreur lors de la création du cycle");
      console.error(error);
    },
  });

  const handleCycleTypeChange = (value: string) => {
    form.setValue("cycle_type", value);
    
    // Apply preset values
    const preset = loadPresets[value];
    if (preset) {
      form.setValue("target_load_min", preset.loadMin);
      form.setValue("target_load_max", preset.loadMax);
      form.setValue("target_awcr_min", preset.awcrMin);
      form.setValue("target_awcr_max", preset.awcrMax);
    }
  };

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau cycle avec objectifs de charge</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom du cycle *</Label>
              <Input
                id="name"
                {...form.register("name")}
                placeholder="Ex: Semaine de charge"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="week_number">N° Semaine *</Label>
              <Input
                id="week_number"
                type="number"
                min="1"
                {...form.register("week_number", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cycle_type">Type de cycle</Label>
            <Select
              value={form.watch("cycle_type")}
              onValueChange={handleCycleTypeChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cycleTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div>
                      <span className="font-medium">{type.label}</span>
                      <span className="text-muted-foreground ml-2">
                        - {type.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Date de début *</Label>
              <Input
                id="start_date"
                type="date"
                {...form.register("start_date")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">Date de fin *</Label>
              <Input
                id="end_date"
                type="date"
                {...form.register("end_date")}
              />
            </div>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg space-y-4">
            <h4 className="font-medium">Objectifs de charge</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="target_load_min">Charge min</Label>
                <Input
                  id="target_load_min"
                  type="number"
                  min="0"
                  {...form.register("target_load_min", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target_load_max">Charge max</Label>
                <Input
                  id="target_load_max"
                  type="number"
                  min="0"
                  {...form.register("target_load_max", { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="target_awcr_min">AWCR min</Label>
                <Input
                  id="target_awcr_min"
                  type="number"
                  step="0.1"
                  min="0"
                  max="3"
                  {...form.register("target_awcr_min", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target_awcr_max">AWCR max</Label>
                <Input
                  id="target_awcr_max"
                  type="number"
                  step="0.1"
                  min="0"
                  max="3"
                  {...form.register("target_awcr_max", { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>

          {periods && periods.length > 0 && (
            <div className="space-y-2">
              <Label>Période associée (optionnel)</Label>
              <Select onValueChange={(value) => form.setValue("period_id", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une période" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((period) => (
                    <SelectItem key={period.id} value={period.id}>
                      {period.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...form.register("notes")}
              placeholder="Objectifs spécifiques, consignes..."
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                "Créer le cycle"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
