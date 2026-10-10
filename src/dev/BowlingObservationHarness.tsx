import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MobileBowlingFrames } from "@/components/bowling/MobileBowlingFrames";
import { changeThrow, emptyFrames } from "@/lib/bowling/scoreRules";
import { calculateBowlingStats } from "@/lib/bowling/scoreStats";
import type { FrameData, ThrowData } from "@/components/athlete-portal/BowlingScoreSheet";

function Harness() {
  const [frames, setFrames] = useState<FrameData[]>(emptyFrames);
  const onThrow = (f: number, t: number, v: string) => {
    const r = changeThrow(frames, f, t, v);
    if (!r.error) setFrames(r.frames);
    return r.frames;
  };
  const onObservation = (f: number, t: number, field: keyof ThrowData, value: boolean | undefined) => {
    setFrames(fs => fs.map((fr, fi) => fi !== f ? fr : ({ ...fr, throws: fr.throws.map((th, ti) => ti !== t ? th : ({ ...th, [field]: value ?? false, observed: value === undefined ? (th.observed ?? []).filter(k => k !== field) : [...new Set([...(th.observed ?? []), field])] })) })));
  };
  return <MobileBowlingFrames frames={frames} stats={calculateBowlingStats(frames)} gameNumber={1} readOnly={false} trackPockets onThrow={onThrow} onObservation={onObservation} />;
}

export function mountBowlingObservationHarness() {
  document.getElementById("bowling-harness")?.remove();
  const host = document.createElement("div");
  host.id = "bowling-harness";
  host.style.cssText = "position:fixed;inset:0;z-index:99999;background:hsl(225 50% 97%);overflow:auto;padding:8px";
  document.body.appendChild(host);
  createRoot(host).render(<Harness />);
}
