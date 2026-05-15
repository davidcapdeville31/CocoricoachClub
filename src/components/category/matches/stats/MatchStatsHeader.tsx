import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Plane, Home, Trophy, X } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  homeName: string;
  awayName: string;
  scoreHome: number;
  scoreAway: number;
  matchDate: string;
  matchTime?: string | null;
  location?: string | null;
  competition?: string | null;
  isFinalized?: boolean;
  isHome: boolean;
  onClose?: () => void;
  rightSlot?: React.ReactNode;
}

export function MatchStatsHeader({
  homeName,
  awayName,
  scoreHome,
  scoreAway,
  matchDate,
  matchTime,
  location,
  competition,
  isFinalized,
  isHome,
  onClose,
  rightSlot,
}: Props) {
  const dt = new Date(matchDate);
  const won = scoreHome > scoreAway ? "home" : scoreAway > scoreHome ? "away" : null;

  return (
    <div className="relative overflow-hidden rounded-t-2xl border-b border-border bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 px-6 py-5 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(circle_at_top_right,white,transparent_60%)]" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium">
            {competition ? (
              <Badge className="border-white/20 bg-white/15 text-white hover:bg-white/20">
                <Trophy className="mr-1 h-3 w-3" />
                {competition}
              </Badge>
            ) : null}
            {isFinalized ? (
              <Badge className="border-emerald-300/40 bg-emerald-400/20 text-white">
                Finalisé
              </Badge>
            ) : (
              <Badge className="border-white/20 bg-white/10 text-white/90">
                En cours
              </Badge>
            )}
            <Badge className="border-white/20 bg-white/10 text-white/90">
              {isHome ? <Home className="mr-1 h-3 w-3" /> : <Plane className="mr-1 h-3 w-3" />}
              {isHome ? "Domicile" : "Extérieur"}
            </Badge>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className={`text-right ${won === "home" ? "opacity-100" : "opacity-80"}`}>
              <div className="text-base font-semibold tracking-tight md:text-xl">{homeName}</div>
              <div className="mt-0.5 text-[11px] uppercase tracking-wider text-white/70">Domicile</div>
            </div>
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-white/15 px-4 py-2 ring-1 ring-white/20 backdrop-blur-sm">
              <span className={`text-3xl font-black tabular-nums md:text-4xl ${won === "home" ? "text-white" : "text-white/80"}`}>{scoreHome}</span>
              <span className="text-2xl font-light text-white/50">—</span>
              <span className={`text-3xl font-black tabular-nums md:text-4xl ${won === "away" ? "text-white" : "text-white/80"}`}>{scoreAway}</span>
            </div>
            <div className={`text-left ${won === "away" ? "opacity-100" : "opacity-80"}`}>
              <div className="text-base font-semibold tracking-tight md:text-xl">{awayName}</div>
              <div className="mt-0.5 text-[11px] uppercase tracking-wider text-white/70">Extérieur</div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/85">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(dt, "EEEE d MMMM yyyy", { locale: fr })}
              {matchTime ? ` · ${matchTime.slice(0, 5)}` : ""}
            </span>
            {location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {location}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-start gap-2">
          {rightSlot}
          {onClose ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-white hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
