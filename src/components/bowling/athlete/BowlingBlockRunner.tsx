// Saisie lancer-par-lancer mobile-first.
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Check, X, ArrowRight, Save, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TACTICAL_ZONES, zoneShort } from "@/lib/constants/bowlingTacticalZones";
import { summariseDeltas } from "@/lib/bowling/throwDeltas";

interface BlockRow {
  id: string;
  block_type: string;
  title: string;
  planned_throws: number | null;
  objectives: string[];
  config: any;
  pattern_id: string | null;
  coach_instruction: string | null;
  athlete_id: string | null;
  category_id: string;
}

interface Props {
  block: BlockRow;
  playerId: string;
  categoryId: string;
  sessionDate: string;
  onClose: () => void;
}

interface ThrowDraft {
  ball_arsenal_id?: string | null;
  axis_success?: boolean | null;
  speed_success?: boolean | null;
  breakpoint_success?: boolean | null;
  pocket_success?: boolean | null;
  strike_success?: boolean | null;
  spare_success?: boolean | null;
  target_zone?: string | null;
  actual_zone?: string | null;
  foot_board?: number | null;
  breakpoint_board?: number | null;
  speed_kmh?: number | null;
  comment?: string | null;
}

const YesNoBtn = ({ label, value, onChange }: { label: string; value: boolean | null | undefined; onChange: (v: boolean) => void }) => (
  <div className="flex flex-col gap-1">
    <Label className="text-[11px] text-muted-foreground">{label}</Label>
    <div className="flex gap-1">
      <button type="button" onClick={() => onChange(true)}
        className={cn("flex-1 h-9 rounded-md text-xs font-semibold border transition-all flex items-center justify-center gap-1",
          value === true ? "bg-emerald-500 text-white border-emerald-600 shadow-md" : "bg-background hover:bg-muted border-border")}>
        <Check className="h-3.5 w-3.5" /> Oui
      </button>
      <button type="button" onClick={() => onChange(false)}
        className={cn("flex-1 h-9 rounded-md text-xs font-semibold border transition-all flex items-center justify-center gap-1",
          value === false ? "bg-rose-500 text-white border-rose-600 shadow-md" : "bg-background hover:bg-muted border-border")}>
        <X className="h-3.5 w-3.5" /> Non
      </button>
    </div>
  </div>
);

export function BowlingBlockRunner({ block, playerId, categoryId, sessionDate, onClose }: Props) {
  const qc = useQueryClient();
  const isTactical = block.block_type === "tactical";
  const isTechnical = block.block_type === "technical";

  const { data: throws = [] } = useQuery({
    queryKey: ["bowling_throw_results", block.id, playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bowling_throw_results")
        .select("*")
        .eq("block_id", block.id)
        .eq("athlete_id", playerId)
        .order("throw_number", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: balls = [] } = useQuery({
    queryKey: ["player_bowling_arsenal", playerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("player_bowling_arsenal")
        .select("id, custom_ball_name")
        .eq("player_id", playerId);
      return data || [];
    },
  });

  const [draft, setDraft] = useState<ThrowDraft>({});
  const nextThrowNumber = (throws[throws.length-1]?.throw_number || 0) + 1;
  const target = block.planned_throws || 0;
  const progress = target > 0 ? Math.min(100, Math.round((throws.length / target) * 100)) : 0;

  const saveThrow = useMutation({
    mutationFn: async () => {
      const payload = {
        ...draft,
        throw_number: nextThrowNumber,
        exercise_index: 0,
        success_global:
          (draft.pocket_success === true) ||
          (draft.strike_success === true) ||
          (draft.spare_success === true) ||
          (isTechnical && draft.axis_success === true),
      };
      const { data, error } = await supabase.functions.invoke("athlete-bowling-training", {
        body: {
          action: "save_throw",
          category_id: categoryId,
          player_id: playerId,
          session_date: sessionDate,
          block_id: block.id,
          throw_payload: payload,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Erreur");
      return data;
    },
    onSuccess: (data) => {
      const deltas = summariseDeltas(data?.throw?.foot_delta, data?.throw?.breakpoint_delta);
      if (deltas) toast.success(`Lancer ${nextThrowNumber} · ${deltas}`);
      else toast.success(`Lancer ${nextThrowNumber} enregistré`);
      setDraft({ ball_arsenal_id: draft.ball_arsenal_id }); // garde la boule choisie
      qc.invalidateQueries({ queryKey: ["bowling_throw_results", block.id, playerId] });
    },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const removeLast = useMutation({
    mutationFn: async () => {
      const last = throws[throws.length-1];
      if (!last) return;
      const { error } = await supabase.from("bowling_throw_results").delete().eq("id", last.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bowling_throw_results", block.id, playerId] }),
  });

  const finish = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("athlete-bowling-training", {
        body: { action: "complete_block", category_id: categoryId, player_id: playerId, session_date: sessionDate, block_id: block.id },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Bloc terminé"); onClose(); },
  });

  return (
    <div className="space-y-3">
      <Card className="p-3 bg-gradient-to-br from-primary/8 to-primary/2">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="font-semibold text-sm">{block.title}</p>
          <Badge variant="outline" className="text-[10px]">{throws.length}/{target || "∞"} lancers</Badge>
        </div>
        {block.coach_instruction && <p className="text-xs text-muted-foreground italic">{block.coach_instruction}</p>}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </Card>

      <Card className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">Lancer #{nextThrowNumber}</p>
          {throws.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => removeLast.mutate()}>
              <Undo2 className="h-3.5 w-3.5 mr-1" /> Annuler dernier
            </Button>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Boule utilisée</Label>
          <Select value={draft.ball_arsenal_id || "__none__"} onValueChange={(v) => setDraft({ ...draft, ball_arsenal_id: v === "__none__" ? null : v })}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Choisir une boule" /></SelectTrigger>
            <SelectContent className="z-[100]">
              <SelectItem value="__none__" className="italic text-xs">Non renseigné</SelectItem>
              {balls.map((b: any) => <SelectItem key={b.id} value={b.id} className="text-xs">{b.custom_ball_name || "Boule"}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isTactical && (
          <>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Zone jouée</Label>
              <Select value={draft.actual_zone || ""} onValueChange={(v) => setDraft({ ...draft, actual_zone: v })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Choisir une zone" /></SelectTrigger>
                <SelectContent className="z-[100]">
                  {TACTICAL_ZONES.map((z) => <SelectItem key={z.value} value={z.value} className="text-xs">{z.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Latte au pied</Label>
                <Input type="number" value={draft.foot_board ?? ""} onChange={(e) => setDraft({ ...draft, foot_board: e.target.value === "" ? null : Number(e.target.value) })} className="h-9 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Point de sortie (latte)</Label>
                <Input type="number" value={draft.breakpoint_board ?? ""} onChange={(e) => setDraft({ ...draft, breakpoint_board: e.target.value === "" ? null : Number(e.target.value) })} className="h-9 text-xs" />
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {isTechnical && <YesNoBtn label="Axe respecté" value={draft.axis_success} onChange={(v) => setDraft({ ...draft, axis_success: v })} />}
          <YesNoBtn label="Poche" value={draft.pocket_success} onChange={(v) => setDraft({ ...draft, pocket_success: v })} />
          <YesNoBtn label="Strike" value={draft.strike_success} onChange={(v) => setDraft({ ...draft, strike_success: v })} />
          <YesNoBtn label="Spare" value={draft.spare_success} onChange={(v) => setDraft({ ...draft, spare_success: v })} />
          {isTechnical && <YesNoBtn label="Point de sortie" value={draft.breakpoint_success} onChange={(v) => setDraft({ ...draft, breakpoint_success: v })} />}
          {isTechnical && <YesNoBtn label="Vitesse cible" value={draft.speed_success} onChange={(v) => setDraft({ ...draft, speed_success: v })} />}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Vitesse (km/h, optionnel)</Label>
            <Input type="number" step="0.1" value={draft.speed_kmh ?? ""} onChange={(e) => setDraft({ ...draft, speed_kmh: e.target.value === "" ? null : Number(e.target.value) })} className="h-9 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Commentaire</Label>
            <Input value={draft.comment ?? ""} onChange={(e) => setDraft({ ...draft, comment: e.target.value })} className="h-9 text-xs" />
          </div>
        </div>

        <Button onClick={() => saveThrow.mutate()} disabled={saveThrow.isPending} className="w-full h-11 text-base">
          Lancer suivant <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </Card>

      {throws.length > 0 && (
        <Card className="p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Historique ({throws.length})</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {throws.map((t: any) => (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="text-[10px] w-8 justify-center">{t.throw_number}</Badge>
                <div className="flex flex-wrap gap-1 flex-1">
                  {t.actual_zone && <Badge variant="secondary" className="text-[10px]">{zoneShort(t.actual_zone)}</Badge>}
                  {t.pocket_success && <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 border-emerald-500/30">Poche</Badge>}
                  {t.strike_success && <Badge className="text-[10px] bg-amber-500/15 text-amber-700 border-amber-500/30">Strike</Badge>}
                  {t.spare_success && <Badge className="text-[10px] bg-blue-500/15 text-blue-700 border-blue-500/30">Spare</Badge>}
                </div>
                {summariseDeltas(t.foot_delta, t.breakpoint_delta) && (
                  <span className="text-[10px] text-muted-foreground italic">
                    {summariseDeltas(t.foot_delta, t.breakpoint_delta)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex gap-2 sticky bottom-0">
        <Button variant="outline" className="flex-1" onClick={onClose}>Fermer</Button>
        <Button className="flex-1" onClick={() => finish.mutate()} disabled={finish.isPending}>
          <Save className="h-4 w-4 mr-1" /> Terminer le bloc
        </Button>
      </div>
    </div>
  );
}
