import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const periodSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  period_type: z.enum(["préparation", "compétition", "récupération", "trêve"]),
  start_date: z.string().min(1, "La date de début est requise"),
  end_date: z.string().min(1, "La date de fin est requise"),
  target_load_percentage: z.number().min(0).max(100).optional(),
  description: z.string().optional(),
});

type PeriodForm = z.infer<typeof periodSchema>;

interface AddPeriodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
}

export function AddPeriodDialog({ open, onOpenChange, categoryId }: AddPeriodDialogProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PeriodForm>({
    resolver: zodResolver(periodSchema),
    defaultValues: {
      name: "",
      period_type: "préparation",
      start_date: "",
      end_date: "",
      description: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: PeriodForm) => {
      const { error } = await supabase.from("training_periods").insert({
        name: data.name,
        period_type: data.period_type,
        start_date: data.start_date,
        end_date: data.end_date,
        target_load_percentage: data.target_load_percentage,
        description: data.description,
        category_id: categoryId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_periods", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["periodization-calendar", categoryId] });
      toast.success("Période créée avec succès");
      form.reset();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Erreur lors de la création de la période");
      console.error(error);
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const onSubmit = (data: PeriodForm) => {
    setIsSubmitting(true);
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une Période d'Entraînement</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Nom de la Période</Label>
            <Input
              id="name"
              {...form.register("name")}
              placeholder="Ex: Préparation Physique Générale"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="period_type">Type de Période</Label>
            <Select
              onValueChange={(value) => form.setValue("period_type", value as any)}
              defaultValue="préparation"
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="préparation">Préparation</SelectItem>
                <SelectItem value="compétition">Compétition</SelectItem>
                <SelectItem value="récupération">Récupération</SelectItem>
                <SelectItem value="trêve">Trêve</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">Date de Début</Label>
              <Input
                id="start_date"
                type="date"
                {...form.register("start_date")}
              />
              {form.formState.errors.start_date && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.start_date.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="end_date">Date de Fin</Label>
              <Input
                id="end_date"
                type="date"
                {...form.register("end_date")}
              />
              {form.formState.errors.end_date && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.end_date.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="target_load_percentage">Charge Cible (%)</Label>
            <Input
              id="target_load_percentage"
              type="number"
              min="0"
              max="100"
              {...form.register("target_load_percentage", { valueAsNumber: true })}
              placeholder="Ex: 75"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...form.register("description")}
              placeholder="Objectifs et notes de la période..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Création..." : "Créer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
