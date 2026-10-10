import { BowlingSimplifiedDialog } from "@/components/bowling/BowlingSimplifiedDialog";
export default function TmpBowlingPreview() {
  return <BowlingSimplifiedDialog open onOpenChange={() => {}} date={new Date()} categoryId="00000000-0000-0000-0000-000000000000" athletePlayerId="00000000-0000-0000-0000-000000000001" />;
}
