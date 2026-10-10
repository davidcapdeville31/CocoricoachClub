import { useState } from "react";
import { BowlingObservationButton } from "@/components/bowling/BowlingObservationButton";

/** Temporary inspection surface for the observation button color states. */
export default function BowlingObservationHarness() {
  const [pocket, setPocket] = useState<boolean | undefined>(true);
  const [pocket2, setPocket2] = useState<boolean | undefined>(false);
  const [pocket3, setPocket3] = useState<boolean | undefined>(undefined);
  const [split, setSplit] = useState<boolean | undefined>(true);
  const [split2, setSplit2] = useState<boolean | undefined>(false);
  const [split3, setSplit3] = useState<boolean | undefined>(undefined);
  return <main className="min-h-screen bg-background p-4 space-y-3">
    <BowlingObservationButton label="Poche" value={pocket} readOnly={false} tone="positive" onChange={setPocket} />
    <BowlingObservationButton label="Poche" value={pocket2} readOnly={false} tone="positive" onChange={setPocket2} />
    <BowlingObservationButton label="Poche" value={pocket3} readOnly={false} tone="positive" onChange={setPocket3} />
    <BowlingObservationButton label="Split" value={split} readOnly={false} tone="negative" clearable={false} onChange={setSplit} />
    <BowlingObservationButton label="Split" value={split2} readOnly={false} tone="negative" clearable={false} onChange={setSplit2} />
    <BowlingObservationButton label="Split" value={split3} readOnly={false} tone="negative" clearable={false} onChange={setSplit3} />
  </main>;
}
