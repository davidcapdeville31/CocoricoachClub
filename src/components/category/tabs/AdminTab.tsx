import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttendanceTab } from "@/components/category/attendance/AttendanceTab";
import { ClipboardCheck } from "lucide-react";

interface AdminTabProps {
  categoryId: string;
}

export function AdminTab({ categoryId }: AdminTabProps) {
  return (
    <div className="space-y-4">
      <Card className="bg-gradient-card shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Administration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceTab categoryId={categoryId} />
        </CardContent>
      </Card>
    </div>
  );
}
