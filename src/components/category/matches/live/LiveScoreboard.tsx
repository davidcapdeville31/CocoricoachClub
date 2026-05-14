import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Trophy } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Period } from "./types";

interface Props {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  period: Period;
  onPeriodChange: (p: Period) => void;
  minute: number;
  onMinuteChange: (m: number) => void;
  seconds: number;
  onSecondsChange: (s: number) => void;
  homeColor?: string;
  awayColor?: string;
  running: boolean;
  onRunningChange: (r: boolean) => void;
}

function isLight(hex?: string) {
  if (!hex) return false;
  const h = hex.replace("#", "");
  if (h.length < 6) return false;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 160;
}

export function LiveScoreboard({ homeName, awayName, homeScore, awayScore, period, onPeriodChange, minute, onMinuteChange, seconds, onSecondsChange, homeColor, awayColor, running, onRunningChange }: Props) {
  const tickRef = useRef<number | null>(null);
  const startRef = useRef<{ at: number; baseSec: number } | null>(null);

  useEffect(() => {
    if (running) {
      startRef.current = { at: Date.now(), baseSec: minute * 60 + seconds };
      tickRef.current = window.setInterval(() => {
        if (!startRef.current) return;
        const elapsed = Math.floor((Date.now() - startRef.current.at) / 1000);
        const total = startRef.current.baseSec + elapsed;
        const m = Math.floor(total / 60);
        const s = total % 60;
        onSecondsChange(s);
        onMinuteChange(m);
      }, 500);
    } else if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  return (
    <Card className="sticky top-0 z-30 rounded-none border-x-0 border-t-0 bg-gradient-to-b from-background to-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="px-4 py-3 grid grid-cols-12 items-center gap-4">
        <div
          className="col-span-4 text-right rounded-xl px-3 py-2 transition-colors"
          style={homeColor ? { backgroundColor: homeColor, color: isLight(homeColor) ? "#0f172a" : "#fff" } : undefined}
        >
          <div className="text-xs uppercase tracking-wider opacity-80">Domicile</div>
          <div className="font-bold text-lg truncate">{homeName}</div>
        </div>
        <div className="col-span-4 text-center">
          <div className="font-mono text-5xl font-black tabular-nums tracking-tight flex items-center justify-center gap-3">
            <span className={homeScore > awayScore ? "text-green-500" : ""}>{homeScore}</span>
            <span className="text-muted-foreground/50 text-3xl">-</span>
            <span className={awayScore > homeScore ? "text-green-500" : ""}>{awayScore}</span>
          </div>
          <div className="flex items-center justify-center gap-2 mt-1">
            <div className="font-mono text-sm tabular-nums bg-muted px-2 py-0.5 rounded-md">
              {String(minute).padStart(2, "0")}'{String(seconds).padStart(2, "0")}
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRunning((r) => !r)}>
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setRunning(false); onSecondsChange(0); onMinuteChange(0); }}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Select value={period} onValueChange={(v) => onPeriodChange(v as Period)}>
              <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="H1">1ère mi-temps</SelectItem>
                <SelectItem value="HT">Mi-temps</SelectItem>
                <SelectItem value="H2">2ème mi-temps</SelectItem>
                <SelectItem value="ET">Prolongation</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div
          className="col-span-4 text-left rounded-xl px-3 py-2 transition-colors"
          style={awayColor ? { backgroundColor: awayColor, color: isLight(awayColor) ? "#0f172a" : "#fff" } : undefined}
        >
          <div className="text-xs uppercase tracking-wider opacity-80 flex items-center gap-1"><Trophy className="h-3 w-3" />Extérieur</div>
          <div className="font-bold text-lg truncate">{awayName}</div>
        </div>
      </div>
    </Card>
  );
}
