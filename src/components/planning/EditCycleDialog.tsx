import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CycleFormFields } from "./CycleFormFields";
import { CycleColorPicker } from "./CycleColorPicker";
import { WeeklyIntensityVolumeDetails, averageWeekly, type WeeklyDetail } from "./WeeklyIntensityVolumeDetails";
import { AdvancedPlayerSelection } from "@/components/category/players/AdvancedPlayerSelection";


interface EditCycleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle: {
    id: string;
    periodization_category_id: string;
    name: string;
    color: string;
    start_date: string;
    end_date: string;
    objective: string | null;
    notes: string | null;
    cycle_type: string | null;
    intensity: number | null;
    volume: number | null;
    dominant_quality?: string | null;
    load_pattern?: string | null;
    fatigue_target?: string | null;
    sessions_per_week?: number | null;
    weekly_details?: WeeklyDetail[] | null;
  };
  categoryId: string;
  categories: { id: string; name: string; color: string }[];
  onDelete: (id: string) => void;
}

export function EditCycleDialog({ open, onOpenChange, cycle, categoryId, categories, onDelete }: EditCycleDialogProps) {
  const [name, setName] = useState(cycle.name);
  const [periodizationCategoryId, setPeriodizationCategoryId] = useState(cycle.periodization_category_id);
  const selectedCategory = categories.find(c => c.id === periodizationCategoryId);
  const defaultColor = selectedCategory?.color || cycle.color;
  const [customColor, setCustomColor] = useState(cycle.color !== selectedCategory?.color ? cycle.color : "");
  const color = customColor || defaultColor;
  const [startDate, setStartDate] = useState<Date>(new Date(cycle.start_date));
  const [endDate, setEndDate] = useState<Date>(new Date(cycle.end_date));
  const [objective, setObjective] = useState(cycle.objective || "");
  const [notes, setNotes] = useState(cycle.notes || "");
  const [cycleType, setCycleType] = useState(cycle.cycle_type || "");
  const [intensity, setIntensity] = useState(cycle.intensity || 0);
  const [volume, setVolume] = useState(cycle.volume || 0);
  const [dominantQuality, setDominantQuality] = useState(cycle.dominant_quality || "");
  const [weeklyDetails, setWeeklyDetails] = useState<WeeklyDetail[]>(
    Array.isArray(cycle.weekly_details) ? (cycle.weekly_details as WeeklyDetail[]) : []
  );
  const [selectionMode, setSelectionMode] = useState<"all" | "specific">("specific");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const { data: existingAssignments = [] } = useQuery({
    queryKey: ["periodization-cycle-players", cycle.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("periodization_cycle_players")
        .select("player_id")
        .eq("cycle_id", cycle.id);
      if (error) throw error;
      return data || [];
    },
  });
  useEffect(() => {
    if (existingAssignments.length > 0) {
      setSelectionMode("specific");
      setSelectedPlayers(existingAssignments.map((assignment: { player_id: string }) => assignment.player_id));
    } else {
      setSelectionMode("all");
      setSelectedPlayers([]);
    }
  }, [existingAssignments]);
  const avg = averageWeekly(weeklyDetails);
  const effectiveIntensity = avg ? avg.intensity : intensity;
  const effectiveVolume = avg ? avg.volume : volume;
  const queryClient = useQueryClient();

  const updateCycle = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("periodization_cycles")
        .update({
          periodization_category_id: periodizationCategoryId,
          name,
          color,
          start_date: format(startDate, "yyyy-MM-dd"),
          end_date: format(endDate, "yyyy-MM-dd"),
          objective: objective || null,
          notes: notes || null,
          cycle_type: cycleType || null,
          intensity: effectiveIntensity || null,
          volume: effectiveVolume || null,
          dominant_quality: dominantQuality || null,
          weekly_details: weeklyDetails.length > 0 ? weeklyDetails : null,
        } as any)
        .eq("id", cycle.id);
      if (error) throw error;

      const { error: deleteAssignmentsError } = await supabase
        .from("periodization_cycle_players")
        .delete()
        .eq("cycle_id", cycle.id);
      if (deleteAssignmentsError) throw deleteAssignmentsError;
      if (selectionMode === "specific" && selectedPlayers.length > 0) {
        const { error: assignmentError } = await supabase
          .from("periodization_cycle_players")
          .insert(selectedPlayers.map((playerId) => ({ cycle_id: cycle.id, player_id: playerId })));
        if (assignmentError) throw assignmentError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["periodization_cycles", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["periodization-cycle-players", cycle.id] });
      queryClient.invalidateQueries({ queryKey: ["athlete-current-cycles"] });
      queryClient.invalidateQueries({ queryKey: ["athlete-calendar-periodization-cycles"] });
      toast.success("Cycle mis à jour");
      onOpenChange(false);
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const isValid = name.trim() && periodizationCategoryId && startDate && endDate && endDate >= startDate && selectedPlayers.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le cycle</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Ligne de périodisation</Label>
            <Select value={periodizationCategoryId} onValueChange={setPeriodizationCategoryId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Nom du cycle</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <CycleColorPicker
            categoryId={categoryId}
            color={color}
            customColor={customColor}
            onCustomColorChange={setCustomColor}
          />


          <CycleFormFields
            cycleType={cycleType}
            onCycleTypeChange={setCycleType}
            intensity={effectiveIntensity}
            onIntensityChange={weeklyDetails.length > 0 ? () => {} : setIntensity}
            volume={effectiveVolume}
            onVolumeChange={weeklyDetails.length > 0 ? () => {} : setVolume}
            dominantQuality={dominantQuality}
            onDominantQualityChange={setDominantQuality}
            periodizationLineName={selectedCategory?.name}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date de début</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus locale={getDateLocale()} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Date de fin</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(endDate, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(d) => d && setEndDate(d)}
                    disabled={(date) => date < startDate}
                    initialFocus
                    locale={getDateLocale()}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {weeklyDetails.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Intensité et volume du cycle calculés en moyenne à partir du détail hebdomadaire.
            </p>
          )}

          <WeeklyIntensityVolumeDetails
            startDate={startDate}
            endDate={endDate}
            value={weeklyDetails}
            onChange={setWeeklyDetails}
          />


          <AdvancedPlayerSelection
            categoryId={categoryId}
            selectedPlayers={selectedPlayers}
            onSelectionChange={setSelectedPlayers}
             selectionMode={selectionMode}
             onSelectionModeChange={setSelectionMode}
             showInjuredFilter={false}
             allowAll={false}
             maxHeight="180px"
          />

          <div>
            <Label>Objectif</Label>
            <Input value={objective} onChange={(e) => setObjective(e.target.value)} />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete(cycle.id)}
              className="gap-1"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </Button>
            <Button className="flex-1" disabled={!isValid || updateCycle.isPending} onClick={() => updateCycle.mutate()}>
              Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
