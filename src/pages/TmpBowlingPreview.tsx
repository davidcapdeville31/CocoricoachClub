import { useState } from "react";
import { BowlingSimplifiedDialog } from "@/components/bowling/BowlingSimplifiedDialog";
export default function TmpBowlingPreview() {
  const [open, setOpen] = useState(true);
  return <BowlingSimplifiedDialog open={open} onOpenChange={setOpen} date={new Date()} categoryId="00000000-0000-0000-0000-000000000000" athletePlayerId="00000000-0000-0000-0000-000000000001" />;
}
