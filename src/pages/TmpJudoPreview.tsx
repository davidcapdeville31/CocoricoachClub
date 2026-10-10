import { JudoSessionDialog } from "@/components/judo/session/JudoSessionDialog";
export default function TmpJudoPreview() {
  return <JudoSessionDialog open onOpenChange={() => {}} date={new Date()} categoryId="00000000-0000-0000-0000-000000000000" athletePlayerId="x" />;
}
