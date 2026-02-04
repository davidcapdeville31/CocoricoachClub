import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ClipboardCheck, Users, FileSpreadsheet, Mail, FileText } from "lucide-react";
import { AttendanceTab } from "@/components/category/attendance/AttendanceTab";
import { CategoryCollaborationTab } from "@/components/category/CategoryCollaborationTab";
import { MedicalRecordsTab } from "@/components/health/MedicalRecordsTab";
import { MatchSheetsSection } from "@/components/category/admin/MatchSheetsSection";
import { ConvocationsSection } from "@/components/category/admin/ConvocationsSection";
import { ColoredSubTabsList, ColoredSubTabsTrigger } from "@/components/ui/colored-subtabs";

interface AdminTabProps {
  categoryId: string;
}

export function AdminTab({ categoryId }: AdminTabProps) {
  return (
    <Tabs defaultValue="attendance" className="space-y-4">
      <div className="flex justify-center overflow-x-auto -mx-4 px-4 pb-2">
        <ColoredSubTabsList colorKey="admin" className="inline-flex w-max">
          <ColoredSubTabsTrigger 
            value="attendance" 
            colorKey="admin"
            icon={<ClipboardCheck className="h-4 w-4" />}
          >
            <span className="hidden sm:inline">Présences</span>
            <span className="sm:hidden">Prés</span>
          </ColoredSubTabsTrigger>
          <ColoredSubTabsTrigger 
            value="matchsheets" 
            colorKey="admin"
            icon={<FileSpreadsheet className="h-4 w-4" />}
          >
            <span className="hidden sm:inline">Feuilles de Match</span>
            <span className="sm:hidden">Feuilles</span>
          </ColoredSubTabsTrigger>
          <ColoredSubTabsTrigger 
            value="convocations" 
            colorKey="admin"
            icon={<Mail className="h-4 w-4" />}
          >
            <span className="hidden sm:inline">Convocations</span>
            <span className="sm:hidden">Convoc</span>
          </ColoredSubTabsTrigger>
          <ColoredSubTabsTrigger 
            value="medical" 
            colorKey="admin"
            icon={<FileText className="h-4 w-4" />}
          >
            <span className="hidden sm:inline">Certificats Médicaux</span>
            <span className="sm:hidden">Certif</span>
          </ColoredSubTabsTrigger>
          <ColoredSubTabsTrigger 
            value="staff" 
            colorKey="admin"
            icon={<Users className="h-4 w-4" />}
          >
            <span className="hidden sm:inline">Staff & Rôles</span>
            <span className="sm:hidden">Staff</span>
          </ColoredSubTabsTrigger>
        </ColoredSubTabsList>
      </div>

      <TabsContent value="attendance">
        <AttendanceTab categoryId={categoryId} />
      </TabsContent>

      <TabsContent value="matchsheets">
        <MatchSheetsSection categoryId={categoryId} />
      </TabsContent>

      <TabsContent value="convocations">
        <ConvocationsSection categoryId={categoryId} />
      </TabsContent>

      <TabsContent value="medical">
        <MedicalRecordsTab categoryId={categoryId} />
      </TabsContent>

      <TabsContent value="staff">
        <CategoryCollaborationTab categoryId={categoryId} />
      </TabsContent>
    </Tabs>
  );
}
