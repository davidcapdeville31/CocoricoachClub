import { TrainingProgramsList } from "./TrainingProgramsList";

interface ProgramsTabProps {
  categoryId: string;
}

export function ProgramsTab({ categoryId }: ProgramsTabProps) {
  return <TrainingProgramsList categoryId={categoryId} />;
}
