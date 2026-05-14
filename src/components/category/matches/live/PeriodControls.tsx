import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Flag, Play, Lock, Unlock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { Period } from "./types";

interface Props {
  matchId: string;
  period: Period;
  onPeriodChange: (p: Period) => void;
  onResetClock: () => void;
  isFinalized: boolean;
  homeScore: number;
  awayScore: number;
  onStartClock?: () => void;
  onStopClock?: () => void;
}

type Confirm = null | "end_h1" | "start_h2" | "finalize" | "reopen";

export function PeriodControls({ matchId, period, onPeriodChange, onResetClock, isFinalized, homeScore, awayScore, onStartClock, onStopClock }: Props) {
  const [confirm, setConfirm] = useState<Confirm>(null);
  const qc = useQueryClient();

  const updateMatch = async (patch: Record<string, any>) => {
    const { error } = await supabase.from("matches").update(patch).eq("id", matchId);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["match-live", matchId] });
  };

  const handleConfirm = async () => {
    try {
      if (confirm === "end_h1") {
        onPeriodChange("HT");
        onStopClock?.();
        toast.success("1ère mi-temps validée");
      } else if (confirm === "start_h2") {
        onPeriodChange("H2");
        onResetClock();
        onStartClock?.();
        toast.success("2ème mi-temps démarrée");
      } else if (confirm === "finalize") {
        await updateMatch({ is_finalized: true, score_home: homeScore, score_away: awayScore });
        onStopClock?.();
        toast.success("Match finalisé");
      } else if (confirm === "reopen") {
        await updateMatch({ is_finalized: false });
        toast.success("Match rouvert pour modification");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setConfirm(null);
    }
  };

  const messages: Record<Exclude<Confirm, null>, { title: string; desc: string }> = {
    end_h1: {
      title: "Êtes-vous sûr de valider la 1ère mi-temps ?",
      desc: "Toutes les statistiques et événements saisis sont enregistrés. Vous pourrez toujours y revenir pour les modifier.",
    },
    start_h2: {
      title: "Démarrer la 2ème mi-temps ?",
      desc: "Le chronomètre repartira de 00'00. Les événements de la 1ère mi-temps restent inchangés.",
    },
    finalize: {
      title: "Finaliser le match ?",
      desc: "Le score final et l'ensemble des statistiques seront enregistrés et le match sera clôturé. Vous pourrez le rouvrir si besoin.",
    },
    reopen: {
      title: "Rouvrir le match pour modification ?",
      desc: "Le match repassera en cours afin de modifier les événements et le score.",
    },
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isFinalized ? (
        <>
          <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Match finalisé</Badge>
          <Button size="sm" variant="outline" onClick={() => setConfirm("reopen")}>
            <Unlock className="h-4 w-4 mr-1" /> Rouvrir pour modifier
          </Button>
        </>
      ) : (
        <>
          {period === "H1" && (
            <Button size="sm" variant="default" onClick={() => setConfirm("end_h1")}>
              <Flag className="h-4 w-4 mr-1" /> Terminer la 1ère mi-temps
            </Button>
          )}
          {period === "HT" && (
            <Button size="sm" variant="default" onClick={() => setConfirm("start_h2")}>
              <Play className="h-4 w-4 mr-1" /> Démarrer la 2ème mi-temps
            </Button>
          )}
          {(period === "H2" || period === "ET") && (
            <Button size="sm" variant="default" onClick={() => setConfirm("finalize")}>
              <Lock className="h-4 w-4 mr-1" /> Finaliser le match
            </Button>
          )}
        </>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          {confirm && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{messages[confirm].title}</AlertDialogTitle>
                <AlertDialogDescription>{messages[confirm].desc}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Non</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirm}>Oui</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
