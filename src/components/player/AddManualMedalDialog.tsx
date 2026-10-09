import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const TYPES = [
  { v: "gold", l: "🥇 Or" },
  { v: "silver", l: "🥈 Argent" },
  { v: "bronze", l: "🥉 Bronze" },
  { v: "ranking", l: "🏅 Classement" },
  { v: "title", l: "🏆 Titre" },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  playerId: string;
  categoryId: string;
}

export function AddManualMedalDialog({ open, onOpenChange, playerId, categoryId }: Props) {
  const qc = useQueryClient();
  const [type, setType] = useState("gold");
  const [competition, setCompetition] = useState("");
  const [date, setDate] = useState("");
  const [rank, setRank] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setType("gold"); setCompetition(""); setDate(""); setRank(""); setTitle(""); setLocation(""); setNotes("");
  };

  const save = async () => {
    if (!competition.trim()) return toast.error("Indiquez le nom de la compétition");
    if (!date) return toast.error("Indiquez la date");
    if (type === "ranking" && !rank) return toast.error("Indiquez la place obtenue");
    if (type === "title" && !title.trim()) return toast.error("Indiquez l'intitulé du titre");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("player_manual_medals").insert({
      player_id: playerId,
      category_id: categoryId,
      medal_type: type,
      rank: type === "ranking" ? Number(rank) : null,
      custom_title: title.trim() || null,
      competition_name: competition.trim(),
      location: location.trim() || null,
      notes: notes.trim() || null,
      awarded_date: date,
      created_by: u.user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error("Erreur lors de l'ajout : " + error.message);
    toast.success("Palmarès ajouté");
    qc.invalidateQueries({ queryKey: ["player-medals", playerId] });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter un palmarès</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Récompense</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {TYPES.map((t) => (
                <Button key={t.v} type="button" size="sm" variant={type === t.v ? "default" : "outline"} onClick={() => setType(t.v)}>
                  {t.l}
                </Button>
              ))}
            </div>
          </div>
          {type === "ranking" && (
            <div><Label>Place</Label><Input type="number" min={1} value={rank} onChange={(e) => setRank(e.target.value)} /></div>
          )}
          <div>
            <Label>{type === "title" ? "Intitulé du titre" : "Précision (optionnel)"}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === "title" ? "Championne de France" : "-57 kg, Relais…"} />
          </div>
          <div><Label>Compétition</Label><Input value={competition} onChange={(e) => setCompetition(e.target.value)} placeholder="Championnat de France 2019" /></div>
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>Lieu (optionnel)</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <div><Label>Notes (optionnel)</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={save} disabled={saving}>Ajouter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
