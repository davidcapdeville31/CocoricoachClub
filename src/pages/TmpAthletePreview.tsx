import { useState } from "react";
import { CircuitRoundStepper, buildCircuitLog } from "@/components/athlete-space/CircuitRoundStepper";
import { CollapsibleFormattedText } from "@/components/ui/formatted-text";
const cfg = { repsPerRound: 6, series: [{exerciseName:"Air squat",reps:"20"},{exerciseName:"Battements de jambes (flutter kicks)",reps:"30"},{exerciseName:"Sit-up",reps:"20"},{exerciseName:"Star jump",reps:"30"}] };
export default function TmpAthletePreview() {
  const [c, setC] = useState(buildCircuitLog(cfg, 4)!);
  return <div className="p-3 space-y-4 bg-background min-h-screen">
    <div className="rounded-xl border bg-card p-3"><CollapsibleFormattedText text={"Prise de conscience - Gestion des émotions\nObjectif : apprendre à identifier ses émotions et à continuer à jouer efficacement malgré elles.**\n\nL'objectif n'est pas de supprimer vos émotions, mais de **les identifier et d'éviter qu'elles prennent le contrôle de votre lancer suivant.**\n- point un\n- point deux"} /></div>
    <div className="rounded-xl border bg-card p-3"><CircuitRoundStepper value={c} onChange={setC} /></div>
    <pre id="state" className="text-[10px]">{JSON.stringify(c.rounds.slice(0,2))}</pre>
  </div>;
}
