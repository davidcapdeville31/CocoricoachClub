import { BowlingSimplifiedDialog } from "@/components/bowling/BowlingSimplifiedDialog";
export default function BowlingPreviewTmp() {
  const athlete = new URLSearchParams(location.search).get("athlete");
  return <div className="min-h-screen bg-gradient-to-r from-rose-400 via-sky-400 to-emerald-400 p-10 text-4xl">CALENDRIER DERRIÈRE<BowlingSimplifiedDialog open onOpenChange={() => {}} date={new Date()} categoryId="00000000-0000-0000-0000-000000000000" athletePlayerId={athlete ? "00000000-0000-0000-0000-000000000001" : undefined} /></div>;
}
