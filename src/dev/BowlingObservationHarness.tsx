import { BowlingScoreSheet } from "@/components/athlete-portal/BowlingScoreSheet";

/** Temporary inspection surface for the bowling split/pocket observation controls. */
export default function BowlingObservationHarness() {
  return (
    <main className="min-h-screen bg-background p-4">
      <BowlingScoreSheet trackPockets />
    </main>
  );
}
