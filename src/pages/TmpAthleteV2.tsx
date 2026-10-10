import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import "@/index.css";
import "@/i18n";
import { AthleteSpaceRpe } from "@/components/athlete-space/AthleteSpaceRpe";
import { CircuitRoundStepper } from "@/components/athlete-space/CircuitRoundStepper";
import { buildCircuitLog, type CircuitLog } from "@/lib/weight/circuitLog";
const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function CheckPage() {
 const [c, setC] = useState<CircuitLog>(() => buildCircuitLog({ repsPerRound: 6, series: [{ exerciseName: "Squat avec haltères", reps: 10 }, { exerciseName: "Pompes au poids du corps", reps: 8 }, { exerciseName: "Développé militaire debout", reps: 12 }] }, 6) || {exercises:[],rounds:[]});
 return <QueryClientProvider client={qc}><AuthProvider><TooltipProvider><Toaster /><main className="mx-auto max-w-3xl p-3"><AthleteSpaceRpe playerId="11111111-1111-1111-1111-111111111111" categoryId="22222222-2222-2222-2222-222222222222" hideHistory /><section aria-label="Circuit de test" className="mt-6 border-t border-border py-5"><h2 className="mb-3 text-lg font-semibold">Circuit · 3 exercices · 6 tours</h2><CircuitRoundStepper value={c} onChange={setC} /></section></main></TooltipProvider></AuthProvider></QueryClientProvider>;
}
const root = document.getElementById("root"); if(root) createRoot(root).render(<CheckPage />);
