import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Trophy, Download, CheckCircle2, Loader2, AlertCircle, RotateCw, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  prepareMatchCache,
  getPrepareSteps,
  getLastPreparation,
  type PrepareProgress,
  type PrepareStep,
} from "@/lib/matchPrepareCache";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  matchId: string;
  isJudo?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  fullWidth?: boolean;
}

export function PrepareMatchButton({
  matchId,
  isJudo = false,
  variant = "outline",
  size = "sm",
  className,
  fullWidth = true,
}: Props) {

  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Map<PrepareStep, PrepareProgress>>(new Map());
  const [lastPreparedAt, setLastPreparedAt] = useState<number | null>(null);
  const [errorStep, setErrorStep] = useState<PrepareStep | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    getLastPreparation(matchId).then(setLastPreparedAt).catch(() => {});
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [matchId]);

  const allSteps = getPrepareSteps();

  const launch = async () => {
    setRunning(true);
    setErrorStep(null);
    setSteps(new Map());
    try {
      await prepareMatchCache(matchId, (p) => {
        setSteps((prev) => {
          const next = new Map(prev);
          next.set(p.step, p);
          if (p.status === "error") setErrorStep(p.step);
          return next;
        });
      });
      const ts = Date.now();
      setLastPreparedAt(ts);
      toast.success("Match prêt pour le mode hors-ligne");
    } catch (e: any) {
      toast.error(e?.message ?? "Échec de la préparation");
    } finally {
      setRunning(false);
    }
  };

  const handleClick = () => {
    if (!isOnline) {
      toast.error("Vous êtes hors-ligne. Reconnectez-vous pour préparer le match.");
      return;
    }
    setOpen(true);
    if (!running && steps.size === 0) {
      // Auto-start on open
      void launch();
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={!isOnline}
        className={cn(
          "gap-1.5 text-xs",
          fullWidth && "w-full justify-start",
          !isOnline && "opacity-50",
          className,
        )}
        title={!isOnline ? "Indisponible hors-ligne" : "Préparer le match pour le mode hors-ligne"}
      >
        {!isOnline ? (
          <WifiOff className="h-3.5 w-3.5" />
        ) : (
          <Trophy className="h-3.5 w-3.5 text-amber-500" />
        )}
        <span>Préparer le match</span>
        {lastPreparedAt ? (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            {format(new Date(lastPreparedAt), "d MMM HH:mm", { locale: fr })}
          </span>
        ) : (
          <Download className="ml-auto h-3 w-3 opacity-70" />
        )}
      </Button>

      <Dialog open={open} onOpenChange={(o) => (running ? null : setOpen(o))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Préparation du match
            </DialogTitle>
            <DialogDescription>
              Téléchargement des données nécessaires pour utiliser ce match hors-ligne.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 py-2">
            {allSteps.map((s) => {
              const state = steps.get(s.id);
              const status = state?.status ?? "pending";
              return (
                <div
                  key={s.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    status === "running" && "bg-brand-500/10",
                    status === "done" && "bg-emerald-500/5",
                    status === "error" && "bg-rose-500/10",
                    status === "pending" && "bg-surface-sunken/40",
                  )}
                >
                  <div className="flex h-5 w-5 items-center justify-center">
                    {status === "running" && (
                      <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
                    )}
                    {status === "done" && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    )}
                    {status === "error" && (
                      <AlertCircle className="h-4 w-4 text-rose-500" />
                    )}
                    {status === "pending" && (
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={cn(
                      "truncate",
                      status === "done" && "text-foreground",
                      status === "pending" && "text-muted-foreground",
                    )}>
                      {s.label}
                    </div>
                    {state?.error ? (
                      <div className="text-[11px] text-rose-500">{state.error}</div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            {errorStep ? (
              <Button onClick={launch} disabled={running} className="gap-1.5">
                <RotateCw className="h-3.5 w-3.5" />
                Réessayer
              </Button>
            ) : null}
            <Button
              variant={errorStep ? "outline" : "default"}
              onClick={() => setOpen(false)}
              disabled={running}
            >
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
